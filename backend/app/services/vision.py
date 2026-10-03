"""Vision service — SECU reacts to a consented live camera frame.

Privacy policy (enforced in the prompt): SECU may only comment on NEUTRAL, clearly
visible things (clothing colour/style, cap, glasses, bag, background) and offer a
selfie. It must NEVER infer or comment on age, gender, ethnicity, body, health,
attractiveness or emotion, and must never identify the person. Camera is opt-in
on the client; frames are processed transiently and never stored.
"""
import os
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
        session_id="secu-vision",
        system_message=VISION_SYSTEM,
    ).with_model(_PROVIDER, _MODEL)
    img = ImageContent(image_base64=image_base64)
    reply = await chat.send_message(
        UserMessage(text="Look at this camera frame and respond following your rules.",
                    file_contents=[img]))
    return (reply or "").strip()
