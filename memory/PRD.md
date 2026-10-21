# SECU — eSecurityIn AI Receptionist & AI Buddy (PRD)

## Original problem statement
Build SECU, an interactive AI character for the reception of eSecurityIn (a cybersecurity & IT training institute). Students walk up to a touchscreen and talk naturally with SECU via voice. SECU is a friendly AI buddy (English + Hinglish) that greets visitors, answers from an approved knowledge base, discusses seminars/courses, runs a cybersecurity quiz, and captures leads. Includes an authenticated admin dashboard with analytics. Real voice, real LLM, real DB, real security controls — no fake demo.

## Architecture
- Frontend: React 19 + Vite + Tailwind v4 + shadcn/ui (dark futuristic kiosk UI). 3D hacker avatar via @react-three/fiber + three.
- Backend: FastAPI, modular (`app/agent`, `app/services`, `knowledge/`).
- DB: MongoDB (sessions, messages, leads, users).
- AI: provider-agnostic `llm.py` + `vision.py` → Gemini `gemini-3-flash-preview` via Emergent universal key.
- Voice: browser Web Speech API (STT) + SpeechSynthesis (TTS), hands-free continuous mode.
- Auth: JWT admin, bcrypt hashing, seeded admin.

## User personas
- Student/visitor at reception (voice-first, English/Hinglish).
- Institute admin (reviews leads & analytics).

## Core requirements (static)
AI voice conversation, Hinglish, knowledge base (institute/courses/seminars/faq/contact), conversation state, quiz, lead capture to DB, admin dashboard + auth, logging, error handling, security (guardrails, no secret/system-prompt leakage, CORS, input validation, rate-safe), privacy (no facial recognition/auto-photo in V1 default).

## Implemented
### V1 (2026-10-01)
- Backend: /api/health, /api/chat (LLM + KB retrieval + guardrails), /api/leads (+validation), /api/quiz (+answer), /api/analytics, /api/auth/login + /me, /api/voice/* abstraction stubs. Admin seeding + indexes.
- Knowledge base JSON (verified-only course: Cyber Security Course 45 days) with TODO markers.
- Frontend: Reception kiosk (animated avatar, waveform, mic + text), Courses/Quiz/Lead modals, Admin dashboard (stat cards, Recharts interest chart, leads table + status + CSV), Login.
- Guardrails: prompt-injection handling, secret-leak sanitisation. Tested 100%.

### V2 (2026-10-03)
- 3D hacker avatar (hooded figure, glowing state-colored eyes, animated mouth on speech, orbiting rings, matrix particles) with 2D fallback via error boundary.
- Consented camera interaction: `POST /api/vision/observe` (Gemini vision) — SECU reacts to a live frame commenting ONLY on neutral visible things (clothing colour) and offers a selfie; strict prompt forbids age/gender/ethnicity/body/health/emotion/identity. Camera is opt-in (off by default); frames not stored.
- Branded selfie capture with 3-2-1 countdown + download.
- Hands-free continuous voice (auto-listen, mic auto-pauses while SECU speaks, resumes after). Tested 100%.

### V3 (2026-10-03)
- Admin **Knowledge Base editor** (`/admin` → Knowledge Base tab): edit institute, courses (name/duration/fee/category/summary/prereq), seminars, contact, FAQ. KB now lives in Mongo (`knowledge` doc, seeded from JSON), cached in `KB_CACHE`; SECU answers from it live. Endpoints: GET/PUT `/api/knowledge` (admin), GET `/api/knowledge/public`.
- **Selfie QR sharing**: branded selfie uploaded to Emergent Object Storage; QR (`qrcode.react`) links to public `/api/selfie/{id}`. Endpoints: POST `/api/selfie/upload`, GET `/api/selfie/{id}`.
- **Server-side TTS voice picker**: OpenAI TTS via Emergent key (`tts-1`, 9 voices, default nova), browser TTS fallback. Endpoints: GET `/api/voice/voices`, POST `/api/voice/synthesize`.
- **Gesture recognition** via Gemini vision (wave/thumbs_up/peace/heart) — SECU reacts while camera on. Endpoint: POST `/api/vision/gesture`. Tested 100% (25/25 backend).

### V4 (2026-10-03)
- **Batch timings**: courses now have a `batch` field in the Knowledge editor (dates/timings); shown on the Courses screen and used by SECU (verified via chat: SECU states the batch start time).
- **Selfie Wall**: reception dock **Wall** button opens a live gallery (`/api/selfies/recent`, refreshes every 15s) of selfies visitors opted to share. Selfie upload has an **opt-out checkbox** (`on_wall`, default on); opted-out selfies never appear on the wall. Tested: opted-out selfie excluded from wall.

## Security / Privacy
JWT + bcrypt, token-gated admin APIs, output sanitisation, CORS via env, no keys in frontend, user-friendly errors. Camera strictly opt-in; vision prompt enforces neutral-only commentary; `app/services/camera.py` remains a disabled isolated interface for future auto-features.

## Backlog / remaining
- P1: Fill real institute data (fees, more courses, seminar dates, contact) into `backend/knowledge/*.json` (TODO markers in place).
- P2: Server-side STT/TTS providers (stt.py/tts.py) for higher-quality voice.
- P2: RAG + vector DB upgrade of knowledge retrieval.
- P2: Switch deprecated FastAPI startup hooks to lifespan; add DialogDescription for a11y; THREE.Clock→Timer.
- P2: Conversation duration + hourly footfall analytics; lead source/session linkage views.

## Admin
admin@esecurityin.com / SecuAdmin@2026 (see /app/memory/test_credentials.md).

## v3 (June 2026)
- "Hey SECU" wake word: kiosk listens from idle (browser speech recognition); detects English/Hindi spellings (hey secu/seku/sekyu, हे सेकू). Pause → back to wake mode; 90s silence → auto reset to wake mode.
- Avatar: Pixabay hacker-mask GIF converted to looping /secu-hacker.webm + .mp4 (+poster); glow/speed/tint change per state (WAKE/LISTENING/THINKING/SPEAKING). Three.js avatar removed.
- Indian voice: default voice "Indian" = browser en-IN / hi-IN voice (Neerja, Swara, Google हिन्दी etc.); OpenAI voices still selectable. Hindi mode greets in Hinglish.
- Tested: iteration_5 (frontend 95% → codec issue fixed with WebM).
