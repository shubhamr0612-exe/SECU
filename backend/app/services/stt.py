"""Speech-to-Text abstraction (future server-side provider).

V1 performs STT in the browser via the Web Speech API for zero-latency, no-key
operation. To move STT server-side later (e.g. OpenAI Whisper), implement
`transcribe(audio_bytes)` here and call it from routes/voice without changing the agent.
"""


async def transcribe(audio_bytes: bytes, language: str = "en-IN") -> str:  # pragma: no cover
    raise NotImplementedError("Server-side STT not enabled in V1 (handled in browser).")
