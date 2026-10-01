# SECU — eSecurityIn AI Receptionist & AI Buddy

SECU is an interactive AI character for the reception of **eSecurityIn**, a cybersecurity & IT training institute. Students walk up to a touchscreen and talk naturally (voice or text) with SECU, who answers from an approved knowledge base, discusses seminars/courses, runs a cybersecurity quiz, and captures leads.

## Architecture
- **Frontend**: React 19 + Vite + Tailwind v4 + shadcn/ui (dark futuristic kiosk UI)
- **Backend**: FastAPI (Python) with modular services
- **Database**: MongoDB (sessions, messages, leads, users)
- **AI**: LLM via a provider-agnostic abstraction (`app/services/llm.py`), default Gemini `gemini-3-flash-preview` through the Emergent universal key
- **Voice**: Browser Web Speech API (STT) + SpeechSynthesis (TTS) in V1; server-side `stt.py` / `tts.py` abstraction points for future providers

## Voice pipeline
Mic → Speech-to-Text (browser) → Conversation manager (`/api/chat`) → Knowledge retrieval → LLM → Guardrails → Text-to-Speech (browser) → Speaker.

## Project structure
```
backend/
  server.py                 # FastAPI app, routes, auth, startup seeding
  app/agent/prompts.py      # SECU system prompt
  app/agent/guardrails.py   # prompt-injection & secret-leak guardrails
  app/services/llm.py       # LLM abstraction (provider/model from env)
  app/services/knowledge.py # structured knowledge retrieval
  app/services/stt.py/tts.py/camera.py  # future provider abstractions (disabled in V1)
  knowledge/*.json          # institute, courses, seminars, faq, contact, quiz
frontend/
  src/pages/                # Reception, Admin, Login
  src/components/           # Avatar, VoiceVisualizer, LeadForm, QuizModal, CoursesModal
  src/hooks/useVoice.js     # Web Speech API STT + TTS
  src/services/api.js       # API client
```

## Environment variables
See `.env.example`. Backend `backend/.env` needs: `MONGO_URL`, `DB_NAME`, `EMERGENT_LLM_KEY` (or your own `LLM_API_KEY`), `LLM_PROVIDER`, `LLM_MODEL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

## Running (this environment)
Backend and frontend are managed by supervisor. After `.env` or dependency changes:
```
sudo supervisorctl restart backend
sudo supervisorctl restart frontend
```

## API endpoints
`GET /api/health`, `POST /api/chat`, `POST /api/voice/transcribe`, `POST /api/voice/speak`,
`POST /api/leads`, `GET /api/leads` (admin), `GET /api/analytics` (admin),
`GET /api/quiz`, `POST /api/quiz/answer`, `POST /api/auth/login`, `GET /api/auth/me`.

## Admin login
Default seeded admin (see `/app/memory/test_credentials.md`):
`admin@esecurityin.com` / `SecuAdmin@2026`

## Editing the knowledge base
Edit JSON files in `backend/knowledge/`. Only add **verified** info. Files contain `_TODO` markers where the institute's real data should be filled in. Add quiz questions to `knowledge/quiz.json`.

## Security notes
JWT admin auth, bcrypt password hashing, ODM-parameterised queries, input validation, output guardrails (no system-prompt/secret leakage), CORS via env, no API keys in frontend, user-friendly errors (no stack traces).

## Privacy / future camera architecture
V1 does **not** use facial recognition, person identification, emotion/age/gender inference, or automatic photography. `app/services/camera.py` (`CameraService`) is an isolated, disabled interface for a future opt-in "Take a selfie" feature.
