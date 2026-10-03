"""SECU — eSecurityIn AI Receptionist backend (FastAPI + MongoDB)."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import sys
import json
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator, EmailStr

sys.path.append(str(ROOT_DIR))
from app.agent.prompts import SYSTEM_PROMPT
from app.agent import guardrails
from app.services import knowledge
from app.services import llm
from app.services import vision

# ---------------------------------------------------------------------------
# Config / infra
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("secu")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@esecurityin.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "SecuAdmin@2026")

STATES = ["IDLE", "WELCOME", "VISITOR_DISCOVERY", "CASUAL_CONVERSATION",
          "SEMINAR_DISCUSSION", "COURSE_DISCUSSION", "QUIZ", "LEAD_CAPTURE", "GOODBYE"]

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
    return {"status": "ok", "service": "SECU", "db": db_ok,
            "llm_configured": bool(os.environ.get("EMERGENT_LLM_KEY")), "time": now_iso()}


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
    kb = knowledge.as_context_string(user_text)
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
    await db.users.create_index("email", unique=True)
    await db.leads.create_index("created_at")
    await db.messages.create_index("session_id")
    existing = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
    if not existing:
        await db.users.insert_one({
            "email": ADMIN_EMAIL.lower(), "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "SECU Admin", "role": "admin", "created_at": now_iso()})
        logger.info("Seeded admin user.")
    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one({"email": ADMIN_EMAIL.lower()},
                                  {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})
        logger.info("Updated admin password.")


@app.on_event("shutdown")
async def shutdown():
    client.close()
