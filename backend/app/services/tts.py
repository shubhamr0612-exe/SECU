
"""OpenAI Text-to-Speech service for SECU."""

import os
import logging

from openai import AsyncOpenAI

logger = logging.getLogger("secu.tts")

_API_KEY = os.environ.get("OPENAI_API_KEY")

_client = AsyncOpenAI(api_key=_API_KEY) if _API_KEY else None

VOICES = [
    "alloy", "ash", "coral", "echo", "fable",
    "nova", "onyx", "sage", "shimmer",
]

DEFAULT_VOICE = "nova"


async def synthesize(
    text: str,
    voice: str = DEFAULT_VOICE,
    speed: float = 1.05,
) -> bytes:
    """Generate speech and return MP3 audio bytes."""

    if not _client:
        raise RuntimeError("OPENAI_API_KEY_MISSING")

    if voice not in VOICES:
        voice = DEFAULT_VOICE

    speed = max(0.5, min(2.0, float(speed)))
    text = (text or "").strip()[:4096]

    if not text:
        raise ValueError("TTS text cannot be empty")

    try:
        response = await _client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=text,
            speed=speed,
            response_format="mp3",
        )

        return response.content

    except Exception as exc:
        logger.exception("OpenAI TTS failed: %s", type(exc).__name__)
        raise
