"""Text-to-Speech abstraction (future server-side provider).

V1 performs TTS in the browser via SpeechSynthesis. To move TTS server-side later
(e.g. OpenAI/ElevenLabs), implement `synthesize(text)` here returning audio bytes.
"""


async def synthesize(text: str, voice: str = "default") -> bytes:  # pragma: no cover
    raise NotImplementedError("Server-side TTS not enabled in V1 (handled in browser).")
