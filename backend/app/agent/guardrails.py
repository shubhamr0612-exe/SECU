"""Lightweight input/output guardrails for SECU."""
import re

INJECTION_PATTERNS = [
    r"ignore (all |your |previous )?instructions",
    r"system prompt",
    r"reveal your (prompt|instructions|system)",
    r"what(\s+are|\'s) your instructions",
    r"api[_ ]?key",
    r"database (credential|password|url)",
    r"you are now",
    r"disregard (the|your) (above|rules)",
    r"jailbreak",
]

# Leaked-secret markers that must never appear in an outgoing message.
LEAK_MARKERS = [
    "sk-",
    "AIza",
    "JWT_SECRET",
    "MONGO_URL",
    "password_hash",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
]


def detect_prompt_injection(text: str) -> bool:
    t = (text or "").lower()
    return any(re.search(p, t) for p in INJECTION_PATTERNS)


def sanitize_output(text: str) -> str:
    """Redact anything that looks like a secret leaking into the reply."""
    if not text:
        return text
    for marker in LEAK_MARKERS:
        if marker.lower() in text.lower():
            return ("I can't share internal configuration. "
                    "Let's keep talking about eSecurityIn! 😊")
    return text
