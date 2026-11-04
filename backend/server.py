"""SECU — eSecurityIn AI Receptionist backend (FastAPI + MongoDB)."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import sys
import json
import base64
import uuid
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator, EmailStr

sys.path.append(str(ROOT_DIR))
from app.agent.prompts import SYSTEM_PROMPT
from app.agent import guardrails
from app.services import knowledge
from app.services import llm
from app.services import vision
from app.services import tts as tts_service
from app.services import storage

# ---------------------------------------------------------------------------
# Config / infra
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("secu")

# MongoDB configuration
mongo_url = os.getenv("MONGO_URL", "").strip()
db_name = os.getenv("DB_NAME", "").strip()

if not mongo_url:
    raise RuntimeError(
        "MONGO_URL is missing. Add your MongoDB connection URI to backend/.env"
    )

if not db_name:
    raise RuntimeError(
        "DB_NAME is missing. Add your database name to backend/.env"
    )

client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=10000,
)

db = client[db_name]

JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
JWT_ALGO = "HS256"
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").strip()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")

if len(JWT_SECRET) < 32:
    raise RuntimeError(
        "JWT_SECRET must be configured with at least 32 characters in backend/.env"
    )

if not ADMIN_EMAIL:
    raise RuntimeError("ADMIN_EMAIL is missing from backend/.env")

if not ADMIN_PASSWORD:
    raise RuntimeError("ADMIN_PASSWORD is missing from backend/.env")

STATES = ["IDLE", "WELCOME", "VISITOR_DISCOVERY", "CASUAL_CONVERSATION",
          "SEMINAR_DISCUSSION", "COURSE_DISCUSSION", "QUIZ", "LEAD_CAPTURE", "GOODBYE"]

# In-memory KB cache (source of truth is the Mongo `knowledge` doc).
KB_CACHE: dict = {}


async def load_kb():
    global KB_CACHE
    doc = await db.knowledge.find_one({"_id": "kb"})
    if not doc:
        seed = knowledge.seed()
        await db.knowledge.insert_one({"_id": "kb", **seed,
                                       "updated_at": now_iso()})
        KB_CACHE = seed
    else:
        doc.pop("_id", None)
        doc.pop("updated_at", None)
        KB_CACHE = doc
    return KB_CACHE

app = FastAPI(title="SECU API")
api = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Helpers / models
# ---------------------------------------------------------------------------
PyObjectId = Annotated[str, BeforeValidator(str)]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(hours=8)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_admin(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return {"id": str(user["_id"]), "email": user["email"], "role": user.get("role")}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    language: Optional[str] = "auto"


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    state: str


class LeadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str
    email: Optional[str] = None
    college: Optional[str] = None
    year: Optional[str] = None
    interest: Optional[str] = "Cyber Security"
    session_id: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class QuizAnswer(BaseModel):
    question_id: int
    answer_index: int


PHONE_RE = re.compile(r"^[+]?\d[\d\s\-]{7,14}$")

# ---------------------------------------------------------------------------
# Conversation state heuristic
# ---------------------------------------------------------------------------
def infer_state(text: str, current: str) -> str:
    t = (text or "").lower()
    if any(w in t for w in ["quiz", "challenge", "test me"]):
        return "QUIZ"
    if any(w in t for w in ["seminar", "workshop"]):
        return "SEMINAR_DISCUSSION"
    if any(w in t for w in ["course", "duration", "fee", "fees", "class", "syllabus"]):
        return "COURSE_DISCUSSION"
    if any(w in t for w in ["bye", "goodbye", "thanks", "thank you", "see you"]):
        return "GOODBYE"
    if any(w in t for w in ["call me", "more info", "contact me", "my number", "interested"]):
        return "LEAD_CAPTURE"
    if current in ("IDLE", "WELCOME"):
        return "VISITOR_DISCOVERY"
    return "CASUAL_CONVERSATION"


# ---------------------------------------------------------------------------
# Routes: health
# ---------------------------------------------------------------------------
@api.get("/health")
async def health():
    db_ok = True
    try:
        await db.command("ping")
    except Exception:
        db_ok = False

    return {
        "status": "ok" if db_ok else "degraded",
        "service": "SECU",
        "db": db_ok,
        "llm_configured": bool(os.environ.get("GEMINI_API_KEY")),
        "tts_configured": bool(os.environ.get("OPENAI_API_KEY")),
        "time": now_iso()
    }


# ---------------------------------------------------------------------------
# Routes: chat
# ---------------------------------------------------------------------------
@api.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    user_text = (req.message or "").strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    if len(user_text) > 2000:
        user_text = user_text[:2000]

    # Session
    session = None
    if req.session_id:
        try:
            session = await db.sessions.find_one({"_id": ObjectId(req.session_id)})
        except Exception:
            session = None
    if not session:
        res = await db.sessions.insert_one({
            "started_at": now_iso(), "ended_at": None,
            "language": req.language or "auto", "lead_created": False, "state": "WELCOME"})
        session = {"_id": res.inserted_id, "state": "WELCOME"}
    session_id = str(session["_id"])

    # History
    history_docs = await db.messages.find(
        {"session_id": session_id}).sort("timestamp", 1).to_list(50)
    history = [{"role": d["role"], "message": d["message"]} for d in history_docs]

    new_state = infer_state(user_text, session.get("state", "WELCOME"))

    # Retrieve knowledge + build augmented system prompt
    kb = knowledge.as_context_string(user_text, KB_CACHE)
    system = SYSTEM_PROMPT + "\n\nAPPROVED KNOWLEDGE BASE (only use facts from here):\n" + kb

    # Guardrail: prompt injection -> safe handling (still let LLM reply, prompt is robust)
    try:
        reply = await llm.generate_reply(system, history, user_text, session_id)
    except Exception as e:
        logger.error("LLM error: %s", type(e).__name__)
        reply = ("Oops! My brain glitched for a second. 😅 "
                 "Could you say that again?")
    reply = guardrails.sanitize_output(reply) or \
        "I don't have that information right now. Let me connect you with our reception team."

    ts = now_iso()
    await db.messages.insert_one({"session_id": session_id, "role": "user",
                                  "message": user_text, "timestamp": ts})
    await db.messages.insert_one({"session_id": session_id, "role": "assistant",
                                  "message": reply, "timestamp": now_iso()})
    await db.sessions.update_one({"_id": ObjectId(session_id)},
                                 {"$set": {"state": new_state, "ended_at": now_iso()}})

    return ChatResponse(reply=reply, session_id=session_id, state=new_state)


# ---------------------------------------------------------------------------
# Routes: voice (server-side STT/TTS abstraction; V1 uses browser Web Speech API)
# ---------------------------------------------------------------------------
@api.post("/voice/transcribe")
async def voice_transcribe():
    # V1 performs speech-to-text in the browser (Web Speech API). This endpoint is
    # the server-side abstraction point for a future STT provider (see app/services/stt.py).
    return {"ok": True, "mode": "browser-web-speech-api",
            "note": "STT is handled client-side in V1. Server STT provider can be plugged here."}


class VisionRequest(BaseModel):
    image_base64: str


@api.post("/vision/observe")
async def vision_observe(req: VisionRequest):
    """Consented camera interaction: SECU reacts to a single live frame.
    Frames are processed transiently and never stored."""
    data = (req.image_base64 or "").strip()
    if not data:
        raise HTTPException(status_code=400, detail="No image provided")
    if "," in data[:60] and data[:5] == "data:":
        data = data.split(",", 1)[1]
    try:
        comment = await vision.observe(data)
    except Exception as e:
        logger.error("Vision error: %s", type(e).__name__)
        raise HTTPException(status_code=502, detail="Vision temporarily unavailable")
    comment = guardrails.sanitize_output(comment) or ""
    if comment.strip().upper().startswith("NONE") or not comment.strip():
        return {"ok": True, "comment": None}
    return {"ok": True, "comment": comment.strip()}


@api.post("/voice/speak")
async def voice_speak():
    # V1 performs text-to-speech in the browser (SpeechSynthesis). Abstraction point for
    # a future TTS provider (see app/services/tts.py).
    return {"ok": True, "mode": "browser-speech-synthesis",
            "note": "TTS is handled client-side in V1. Server TTS provider can be plugged here."}


# ---------------------------------------------------------------------------
# Routes: leads
# ---------------------------------------------------------------------------
@api.post("/leads")
async def create_lead(lead: LeadCreate):
    phone = lead.phone.strip()
    if not PHONE_RE.match(phone):
        raise HTTPException(status_code=400, detail="Please provide a valid phone number.")
    doc = {
        "name": lead.name.strip(),
        "phone": phone,
        "email": (lead.email or "").strip() or None,
        "college": (lead.college or "").strip() or None,
        "year": (lead.year or "").strip() or None,
        "interest": lead.interest or "Cyber Security",
        "source": "AI Reception",
        "status": "New",
        "created_at": now_iso(),
    }
    res = await db.leads.insert_one(doc)
    if lead.session_id:
        try:
            await db.sessions.update_one({"_id": ObjectId(lead.session_id)},
                                         {"$set": {"lead_created": True}})
        except Exception:
            pass
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    return {"ok": True, "lead": doc}


@api.get("/leads")
async def list_leads(admin: dict = Depends(get_current_admin)):
    docs = await db.leads.find().sort("created_at", -1).to_list(1000)
    for d in docs:
        d["id"] = str(d.pop("_id"))
    return {"leads": docs}


class LeadStatusUpdate(BaseModel):
    status: str


@api.patch("/leads/{lead_id}")
async def update_lead_status(lead_id: str, body: LeadStatusUpdate,
                             admin: dict = Depends(get_current_admin)):
    if body.status not in ("New", "Contacted", "Enrolled"):
        raise HTTPException(status_code=400, detail="Invalid status")
    await db.leads.update_one({"_id": ObjectId(lead_id)}, {"$set": {"status": body.status}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Routes: quiz
# ---------------------------------------------------------------------------
def _load_quiz() -> dict:
    with open(ROOT_DIR / "knowledge" / "quiz.json", "r", encoding="utf-8") as f:
        return json.load(f)


@api.get("/quiz")
async def get_quiz():
    data = _load_quiz()
    questions = [{"id": q["id"], "question": q["question"], "options": q["options"]}
                 for q in data["questions"]]
    return {"title": data["title"], "questions": questions, "total": len(questions)}


@api.post("/quiz/answer")
async def answer_quiz(ans: QuizAnswer):
    data = _load_quiz()
    q = next((x for x in data["questions"] if x["id"] == ans.question_id), None)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    correct = ans.answer_index == q["answer"]
    return {"correct": correct, "correct_index": q["answer"]}


# ---------------------------------------------------------------------------
# Routes: analytics
# ---------------------------------------------------------------------------
@api.get("/analytics")
async def analytics(admin: dict = Depends(get_current_admin)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    total_conversations = await db.sessions.count_documents({})
    today_conversations = await db.sessions.count_documents({"started_at": {"$regex": f"^{today}"}})
    total_leads = await db.leads.count_documents({})
    today_leads = await db.leads.count_documents({"created_at": {"$regex": f"^{today}"}})

    interest_cursor = db.leads.aggregate([
        {"$group": {"_id": "$interest", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}])
    interest = [{"name": d["_id"] or "Other", "count": d["count"]}
                async for d in interest_cursor]

    recent = await db.leads.find().sort("created_at", -1).to_list(8)
    for d in recent:
        d["id"] = str(d.pop("_id"))

    return {
        "total_conversations": total_conversations,
        "today_conversations": today_conversations,
        "total_leads": total_leads,
        "today_leads": today_leads,
        "interest": interest,
        "recent_leads": recent,
    }


# ---------------------------------------------------------------------------
# Routes: auth
# ---------------------------------------------------------------------------
@api.post("/auth/login")
async def login(body: LoginRequest):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(str(user["_id"]), email)
    return {"token": token, "user": {"email": email, "name": user.get("name"),
                                     "role": user.get("role")}}


@api.get("/auth/me")
async def me(admin: dict = Depends(get_current_admin)):
    return admin


# ---------------------------------------------------------------------------
# Routes: knowledge base (admin editor + public course list)
# ---------------------------------------------------------------------------
@api.get("/knowledge")
async def get_knowledge(admin: dict = Depends(get_current_admin)):
    return KB_CACHE


class KnowledgeUpdate(BaseModel):
    institute: Optional[dict] = None
    courses: Optional[dict] = None
    seminars: Optional[dict] = None
    faq: Optional[dict] = None
    contact: Optional[dict] = None


@api.put("/knowledge")
async def update_knowledge(body: KnowledgeUpdate, admin: dict = Depends(get_current_admin)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    update["updated_at"] = now_iso()
    await db.knowledge.update_one({"_id": "kb"}, {"$set": update}, upsert=True)
    await load_kb()
    return {"ok": True, "knowledge": KB_CACHE}


class CourseIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    duration: str = ""
    fee: str = ""
    category: str = ""
    batch: str = ""
    summary: str = ""
    prerequisites: str = ""


async def _save_courses(courses: list):
    await db.knowledge.update_one({"_id": "kb"}, {"$set": {"courses.courses": courses, "updated_at": now_iso()}}, upsert=True)
    await load_kb()


async def _courses_with_ids() -> list:
    courses = list((KB_CACHE.get("courses") or {}).get("courses") or [])
    if any(not c.get("id") for c in courses):
        courses = [{**c, "id": c.get("id") or uuid.uuid4().hex[:12]} for c in courses]
        await _save_courses(courses)
    return courses


@api.get("/admin/courses")
async def list_courses(admin: dict = Depends(get_current_admin)):
    return {"courses": await _courses_with_ids()}


@api.post("/admin/courses")
async def add_course(body: CourseIn, admin: dict = Depends(get_current_admin)):
    courses = await _courses_with_ids()
    course = {"id": uuid.uuid4().hex[:12], **body.model_dump()}
    await _save_courses(courses + [course])
    return {"ok": True, "course": course}


@api.put("/admin/courses/{course_id}")
async def edit_course(course_id: str, body: CourseIn, admin: dict = Depends(get_current_admin)):
    courses = await _courses_with_ids()
    if not any(c["id"] == course_id for c in courses):
        raise HTTPException(status_code=404, detail="Course not found")
    course = {"id": course_id, **body.model_dump()}
    await _save_courses([course if c["id"] == course_id else c for c in courses])
    return {"ok": True, "course": course}


@api.delete("/admin/courses/{course_id}")
async def delete_course(course_id: str, admin: dict = Depends(get_current_admin)):
    courses = await _courses_with_ids()
    remaining = [c for c in courses if c["id"] != course_id]
    if len(remaining) == len(courses):
        raise HTTPException(status_code=404, detail="Course not found")
    await _save_courses(remaining)
    return {"ok": True}


@api.get("/knowledge/public")
async def public_knowledge():
    """Public subset used by the reception UI (courses + contact)."""
    return {"courses": KB_CACHE.get("courses", {}), "contact": KB_CACHE.get("contact", {})}


# ---------------------------------------------------------------------------
# Routes: voice TTS (server-side OpenAI voice)
# ---------------------------------------------------------------------------
class SpeakRequest(BaseModel):
    text: str
    voice: Optional[str] = "nova"
    speed: Optional[float] = 1.05


@api.get("/voice/voices")
async def list_voices():
    return {"voices": tts_service.VOICES, "default": tts_service.DEFAULT_VOICE}


@api.post("/voice/synthesize")
async def voice_synthesize(req: SpeakRequest):
    text = (req.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")
    audio = b""
    try:
        audio = await tts_service.synthesize(text, req.voice or "nova", req.speed or 1.05)
    except Exception as e:
        logger.error("TTS error: %s", type(e).__name__)
        raise HTTPException(status_code=502, detail="TTS temporarily unavailable")
    return Response(content=audio, media_type="audio/mpeg")


# ---------------------------------------------------------------------------
# Routes: vision gesture detection
# ---------------------------------------------------------------------------
@api.post("/vision/gesture")
async def vision_gesture(req: VisionRequest):
    data = (req.image_base64 or "").strip()
    if not data:
        raise HTTPException(status_code=400, detail="No image provided")
    if data[:5] == "data:" and "," in data[:60]:
        data = data.split(",", 1)[1]
    try:
        result = await vision.detect_gesture(data)
    except Exception as e:
        logger.error("Gesture error: %s", type(e).__name__)
        return {"ok": True, "gesture": "none", "comment": ""}
    result["comment"] = guardrails.sanitize_output(result.get("comment", "")) or ""
    return {"ok": True, **result}


# ---------------------------------------------------------------------------
# Routes: selfie upload + serve (for QR sharing)
# ---------------------------------------------------------------------------
class SelfieUpload(BaseModel):
    image_base64: str
    on_wall: Optional[bool] = True


@api.post("/selfie/upload")
async def selfie_upload(body: SelfieUpload):
    data = (body.image_base64 or "").strip()
    if not data:
        raise HTTPException(status_code=400, detail="No image provided")
    if data[:5] == "data:" and "," in data[:60]:
        data = data.split(",", 1)[1]
    try:
        raw = base64.b64decode(data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")
    selfie_id = str(uuid.uuid4())
    path = f"{storage.APP_NAME}/selfies/{selfie_id}.png"
    result = {}
    try:
        result = storage.put_object(path, raw, "image/png")
    except Exception:
        raise HTTPException(status_code=502, detail="Could not save selfie right now")
    await db.selfies.insert_one({
        "_id": selfie_id, "storage_path": result.get("path", path),
        "on_wall": bool(body.on_wall), "created_at": now_iso()})
    base = os.environ.get("PUBLIC_BASE_URL") or ""
    url = f"{base.rstrip('/')}/api/selfie/{selfie_id}" if base else f"/api/selfie/{selfie_id}"
    return {"ok": True, "id": selfie_id, "url": url, "path": f"/api/selfie/{selfie_id}"}


@api.get("/selfies/recent")
async def selfies_recent():
    """Public wall: recent opt-in selfies for the reception gallery."""
    docs = await db.selfies.find({"on_wall": True}).sort("created_at", -1).to_list(12)
    base = os.environ.get("PUBLIC_BASE_URL") or ""
    items = []
    for d in docs:
        sid = d["_id"]
        url = f"{base.rstrip('/')}/api/selfie/{sid}" if base else f"/api/selfie/{sid}"
        items.append({"id": sid, "url": url, "created_at": d.get("created_at")})
    return {"selfies": items}


@api.get("/selfie/{selfie_id}")
async def selfie_get(selfie_id: str):
    rec = await db.selfies.find_one({"_id": selfie_id})
    if not rec:
        raise HTTPException(status_code=404, detail="Selfie not found")
    content, ctype = b"", "image/png"
    try:
        content, ctype = storage.get_object(rec["storage_path"])
    except Exception:
        raise HTTPException(status_code=404, detail="Selfie not found")
    return Response(content=content, media_type=ctype or "image/png")


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.on_event("startup")
async def startup():
    # Verify MongoDB connection
    await client.admin.command("ping")
    logger.info("Connected to MongoDB database: %s", db.name)

    await db.users.create_index("email", unique=True)
    await db.leads.create_index("created_at")
    await db.messages.create_index("session_id")

    await load_kb()

    # Initialize local filesystem storage
    try:
        storage.init_storage()
        logger.info("Local storage initialized.")
    except Exception as e:
        logger.error("Storage initialization failed: %s", type(e).__name__)

    # Seed admin account if it doesn't exist
    existing = await db.users.find_one({"email": ADMIN_EMAIL.lower()})

    if not existing:
        await db.users.insert_one({
            "email": ADMIN_EMAIL.lower(),
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "SECU Admin",
            "role": "admin",
            "created_at": now_iso()
        })
        logger.info("Seeded admin user.")

    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one(
            {"email": ADMIN_EMAIL.lower()},
            {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}}
        )
        logger.info("Updated admin password.")



@app.on_event("shutdown")
async def shutdown():
    client.close()
