"""Text-to-Speech service — OpenAI TTS via the Emergent universal key.

Gives SECU a natural server-side voice (voice/speed selectable). The browser's
SpeechSynthesis remains a client-side fallback if this is unavailable. Note: OpenAI
voices are English-optimised, so Hindi words carry a mild English accent.
"""
import os
import logging
from emergentintegrations.llm.openai import OpenAITextToSpeech

logger = logging.getLogger("secu.tts")

_API_KEY = os.environ.get("EMERGENT_LLM_KEY")
VOICES = ["alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"]
DEFAULT_VOICE = "nova"


async def synthesize(text: str, voice: str = DEFAULT_VOICE, speed: float = 1.05) -> bytes:
    if not _API_KEY:
        raise RuntimeError("LLM_API_KEY_MISSING")
    if voice not in VOICES:
        voice = DEFAULT_VOICE
    speed = max(0.5, min(2.0, float(speed)))
    text = (text or "")[:4096]
    tts = OpenAITextToSpeech(api_key=_API_KEY)
    return await tts.generate_speech(text=text, model="tts-1", voice=voice,
                                     speed=speed, response_format="mp3")
