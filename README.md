# SECU — eSecurityIn AI Receptionist & AI Buddy

SECU is an AI-powered virtual receptionist and assistant designed for eSecurityIn, a cybersecurity and IT training institute.

Visitors can interact with SECU through text and voice, explore courses and seminars, take cybersecurity quizzes, and submit enquiries.

## Features

- AI-powered conversations using Google Gemini
- AI vision and gesture detection
- Voice interaction and text-to-speech
- Knowledge-base-driven responses
- Course and seminar information
- Cybersecurity quizzes
- Visitor lead capture
- Administrator dashboard and authentication
- MongoDB-backed data storage
- Local filesystem storage for uploaded assets

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS |
| Backend | Python, FastAPI |
| Database | MongoDB Atlas |
| AI and Vision | Google Gemini API |
| Text-to-Speech | OpenAI API |
| Authentication | JWT, bcrypt |
| Storage | Local filesystem |

## Project Structure

```text
SECU/
├── backend/
│   ├── app/
│   │   ├── agent/
│   │   └── services/
│   ├── knowledge/
│   ├── tests/
│   ├── server.py
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── .env.example
│
├── .gitignore
└── README.md
```

## Prerequisites

Install the following:

- Python 3.11 or later
- Node.js and npm
- MongoDB Atlas account
- Google Gemini API key
- OpenAI API key (for server-side text-to-speech)

## Installation and Setup

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd SECU
```

### 2. Configure the backend

Create and activate a Python virtual environment.

**Windows PowerShell:**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

Create your backend environment file:

```powershell
Copy-Item .env.example .env
```

Open `backend/.env` and configure:

| Variable | Description |
|---|---|
| MONGO_URL | MongoDB connection URI |
| DB_NAME | Your MongoDB database name |
| JWT_SECRET | Random secret of at least 32 characters |
| ADMIN_EMAIL | Administrator email |
| ADMIN_PASSWORD | Administrator password |
| GEMINI_API_KEY | Google Gemini API key |
| LLM_PROVIDER | AI provider (`gemini`) |
| LLM_MODEL | Gemini model name |
| OPENAI_API_KEY | OpenAI API key for TTS |
| CORS_ORIGINS | Allowed frontend origins |
| PUBLIC_BASE_URL | Backend base URL |

For local development, the application URLs are:

```dotenv
CORS_ORIGINS=http://localhost:3000
PUBLIC_BASE_URL=http://127.0.0.1:8000
```

Use your own MongoDB Atlas connection URI, database name, API keys and administrator credentials.

### 3. Configure the frontend

Open a second terminal from the project root:

```powershell
cd frontend
npm install
```

Create the frontend environment file:

```powershell
Copy-Item .env.example .env
```

Configure:

```dotenv
VITE_BACKEND_URL=http://127.0.0.1:8000
```

### 4. Start the backend

From the backend directory, with the virtual environment activated:

```powershell
uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

Backend API:

```text
http://127.0.0.1:8000
```

Health check:

```text
http://127.0.0.1:8000/api/health
```

### 5. Start the frontend

From the frontend directory:

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

## API Configuration

SECU uses separate API credentials:

- Google Gemini for AI conversations and vision.
- OpenAI for server-side text-to-speech.

API access and billing are managed independently by their respective providers. A ChatGPT subscription does not include OpenAI API credits.

## Testing

From the backend directory:

```powershell
pytest -q -m "not integration"
```

Integration tests requiring paid external API services can be run separately when those services are configured and available.

## Security

- Never commit `.env` files or API credentials.
- Use your own MongoDB database and API keys.
- Configure a unique, secure JWT secret.
- Set your own administrator email and password.
- Do not expose backend API keys through frontend `VITE_` variables.
- Local uploaded data is stored in `backend/local_storage/` and should not be committed.

## License

Add your chosen license before distributing or accepting contributions.
