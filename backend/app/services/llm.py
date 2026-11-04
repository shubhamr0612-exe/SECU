
"""Gemini-powered LLM service for SECU."""

import os
import logging

from google import genai
from google.genai import types

logger = logging.getLogger("secu.llm")

_API_KEY = os.environ.get("GEMINI_API_KEY")
_MODEL = os.environ.get("LLM_MODEL", "gemini-3-flash-preview")

_client = genai.Client(api_key=_API_KEY) if _API_KEY else None


async def generate_reply(
    system_prompt: str,
    history: list,
    user_text: str,
    session_id: str,
) -> str:
    """Generate an assistant reply using Gemini."""

    if not _client:
        raise RuntimeError("GEMINI_API_KEY_MISSING")

    contents = []

    # Reconstruct recent conversation history.
    for turn in history[-10:]:
        role = turn.get("role")
        message = turn.get("message", "")

        if not message or role not in ("user", "assistant"):
            continue

        contents.append(
            types.Content(
                role="user" if role == "user" else "model",
                parts=[types.Part.from_text(text=message)],
            )
        )

    # Add the current user message.
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=user_text)],
        )
    )

    try:
        response = await _client.aio.models.generate_content(
            model=_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.7,
            ),
        )

        return (response.text or "").strip()

    except Exception as exc:
        logger.exception("Gemini reply generation failed: %s", type(exc).__name__)
        raise
