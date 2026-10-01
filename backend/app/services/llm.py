"""LLM abstraction layer for SECU.

Provider/model are read from env so they can be swapped without touching callers.
Uses the emergentintegrations LlmChat with the Emergent universal key.
"""
import os
import logging
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger("secu.llm")

_API_KEY = os.environ.get("EMERGENT_LLM_KEY")
_PROVIDER = os.environ.get("LLM_PROVIDER", "gemini")
_MODEL = os.environ.get("LLM_MODEL", "gemini-3-flash-preview")


async def generate_reply(system_prompt: str, history: list, user_text: str,
                         session_id: str) -> str:
    """Generate a single assistant reply.

    history: list of {"role": "user"|"assistant", "message": str} (most recent last).
    Conversation context is reconstructed into the system prompt because a fresh
    LlmChat instance is created per request (stateless backend, state in Mongo).
    """
    if not _API_KEY:
        raise RuntimeError("LLM_API_KEY_MISSING")

    convo = ""
    for turn in history[-10:]:
        who = "Student" if turn.get("role") == "user" else "SECU"
        convo += f"{who}: {turn.get('message')}\n"

    full_system = system_prompt
    if convo:
        full_system += "\n\nRECENT CONVERSATION (for context):\n" + convo

    chat = LlmChat(
        api_key=_API_KEY,
        session_id=session_id,
        system_message=full_system,
    ).with_model(_PROVIDER, _MODEL)

    reply = await chat.send_message(UserMessage(text=user_text))
    return (reply or "").strip()
