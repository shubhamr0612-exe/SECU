
"""Gemini Vision service for SECU.

Camera frames are processed transiently and are not stored by this service.
"""

import os
import json
import base64
import logging

from google import genai
from google.genai import types

logger = logging.getLogger("secu.vision")

_API_KEY = os.environ.get("GEMINI_API_KEY")
_MODEL = os.environ.get("LLM_MODEL", "gemini-3-flash-preview")

_client = genai.Client(api_key=_API_KEY) if _API_KEY else None


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

Example: "Loving that blue hoodie! Wanna take a quick selfie?"
"""


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
"""


def _decode_image(image_base64: str):
    """Convert a base64 image or data URL into Gemini image bytes."""

    mime_type = "image/jpeg"
    encoded = image_base64

    if image_base64.startswith("data:"):
        header, encoded = image_base64.split(",", 1)
        mime_type = header.split(";")[0].replace("data:", "") or mime_type

    image_bytes = base64.b64decode(encoded)

    return types.Part.from_bytes(
        data=image_bytes,
        mime_type=mime_type,
    )


async def _analyze_image(image_base64: str, system_prompt: str, instruction: str) -> str:
    if not _client:
        raise RuntimeError("GEMINI_API_KEY_MISSING")

    image_part = _decode_image(image_base64)

    response = await _client.aio.models.generate_content(
        model=_MODEL,
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=instruction),
                    image_part,
                ],
            )
        ],
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.4,
        ),
    )

    return (response.text or "").strip()


async def observe(image_base64: str) -> str:
    """Return one short, privacy-conscious observation about the camera frame."""

    try:
        reply = await _analyze_image(
            image_base64,
            VISION_SYSTEM,
            "Look at this camera frame and respond following your rules.",
        )
        return reply or "NONE"

    except Exception as exc:
        logger.exception("Gemini vision observation failed: %s", type(exc).__name__)
        raise


async def detect_gesture(image_base64: str) -> dict:
    """Detect a clearly visible hand gesture."""

    try:
        raw = await _analyze_image(
            image_base64,
            GESTURE_SYSTEM,
            "Detect the gesture and return the requested JSON.",
        )

        # Remove optional Markdown code fences.
        if raw.startswith("```"):
            raw = raw.strip("`").strip()
            if raw.lower().startswith("json"):
                raw = raw[4:].strip()

        data = json.loads(raw)

        gesture = str(data.get("gesture", "none")).lower()

        if gesture not in ("wave", "thumbs_up", "peace", "heart"):
            gesture = "none"

        comment = str(data.get("comment", "")).strip()

        return {
            "gesture": gesture,
            "comment": comment if gesture != "none" else "",
        }

    except json.JSONDecodeError:
        logger.warning("Gemini returned invalid gesture JSON")
        return {"gesture": "none", "comment": ""}

    except Exception as exc:
        logger.exception("Gemini gesture detection failed: %s", type(exc).__name__)
        raise
