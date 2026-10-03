"""Vision service — SECU reacts to a consented live camera frame.

Privacy policy (enforced in the prompt): SECU may only comment on NEUTRAL, clearly
visible things (clothing colour/style, cap, glasses, bag, background) and offer a
selfie. It must NEVER infer or comment on age, gender, ethnicity, body, health,
attractiveness or emotion, and must never identify the person. Camera is opt-in
on the client; frames are processed transiently and never stored.
"""
import os
import uuid
import json
import logging
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

logger = logging.getLogger("secu.vision")

_API_KEY = os.environ.get("EMERGENT_LLM_KEY")
_PROVIDER = os.environ.get("LLM_PROVIDER", "gemini")
_MODEL = os.environ.get("LLM_MODEL", "gemini-3-flash-preview")

VISION_SYSTEM = """You are SECU, eSecurityIn's friendly AI buddy, looking at a live
webcam frame of a visitor standing at the reception.

Reply with ONE short, warm, casual line (max 18 words), in English or light Hinglish,
as if you are happily chatting with them.

You MAY give a friendly compliment about NEUTRAL, clearly visible things ONLY:
clothing colour or style, a cap/hat, glasses, a bag, or the background.
Then you MAY playfully offer to take a selfie together.

STRICT RULES:
- NEVER comment on or guess age, gender, ethnicity, race, body shape, weight,
  attractiveness, health, mood or emotions.
- NEVER try to identify or name the person.
- If no person is clearly visible, reply with exactly: NONE
- Use at most one emoji.

Example: "Loving that blue hoodie! 😎 Wanna take a quick selfie?"
"""


async def observe(image_base64: str) -> str:
    if not _API_KEY:
        raise RuntimeError("LLM_API_KEY_MISSING")
    chat = LlmChat(
        api_key=_API_KEY,
        session_id=f"secu-vision-{uuid.uuid4()}",
        system_message=VISION_SYSTEM,
    ).with_model(_PROVIDER, _MODEL)
    img = ImageContent(image_base64=image_base64)
    reply = await chat.send_message(
        UserMessage(text="Look at this camera frame and respond following your rules.",
                    file_contents=[img]))
    return (reply or "").strip()


GESTURE_SYSTEM = """You are SECU, eSecurityIn's friendly AI buddy watching a live webcam frame.
Detect if the visitor is clearly making ONE of these hand gestures:
- "wave" (open hand raised, waving hello)
- "thumbs_up" (thumb up)
- "peace" (V / victory / peace sign)
- "heart" (hand heart)
- "none" (no clear gesture)

Respond with STRICT JSON only, no markdown, exactly:
{"gesture": "<wave|thumbs_up|peace|heart|none>", "comment": "<short fun reaction in English or light Hinglish, max 14 words, one emoji; empty string if gesture is none>"}

RULES:
- Only report a gesture if it is clearly visible. If unsure, use "none".
- NEVER comment on age, gender, ethnicity, body, health or emotion.
- React ONLY to the gesture itself.
Examples:
{"gesture":"wave","comment":"Hey hey! 👋 Great to see you!"}
{"gesture":"thumbs_up","comment":"Thumbs up! 😎 You're awesome!"}
{"gesture":"none","comment":""}
"""


async def detect_gesture(image_base64: str) -> dict:
    if not _API_KEY:
        raise RuntimeError("LLM_API_KEY_MISSING")
    chat = LlmChat(
        api_key=_API_KEY,
        session_id=f"secu-gesture-{uuid.uuid4()}",
        system_message=GESTURE_SYSTEM,
    ).with_model(_PROVIDER, _MODEL)
    img = ImageContent(image_base64=image_base64)
    reply = await chat.send_message(
        UserMessage(text="Detect the gesture and return the JSON.", file_contents=[img]))
    raw = (reply or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
    try:
        data = json.loads(raw)
    except Exception:
        return {"gesture": "none", "comment": ""}
    gesture = str(data.get("gesture", "none")).lower()
    if gesture not in ("wave", "thumbs_up", "peace", "heart"):
        gesture = "none"
    comment = str(data.get("comment", "")).strip()
    return {"gesture": gesture, "comment": comment if gesture != "none" else ""}
