# DermaSathiAI

India-focused multilingual healthcare information and care-navigation application. The platform combines a React/Vite frontend, FastAPI backend, PostgreSQL persistence, and configurable Gemini/Groq AI providers. It provides educational support and does not replace a qualified clinician or emergency service.

## Repository contents

- `frontend/` — React 18, TypeScript and Vite application.
- `backend/` — FastAPI services, API endpoints, SQLAlchemy models and Alembic migrations.
- `docker-compose.yml` — local multi-container stack with a persistent PostgreSQL volume.
- `.env.example` — configuration template only; it contains no real credentials.

## Local Docker setup

1. Install Docker Desktop and start it.
2. Copy `.env.example` to `.env`.
3. Replace `POSTGRES_PASSWORD` and `DATABASE_URL` with matching values. Replace `SECRET_KEY` with a unique random secret. Add your Gemini and Groq API keys if you want live AI responses.
4. Start the stack:

   ```bash
   docker compose up --build -d
   ```

5. Open the frontend at `http://localhost`, API docs at `http://localhost:8000/docs`, and health at `http://localhost:8000/api/v1/health/status`.

The database is stored in the Docker named volume `dermasathi_postgres_data`. `docker compose down` keeps the volume. **Do not run `docker compose down -v` unless you intend to delete that database volume.**

The Compose database is a fresh database for this stack. Your existing Windows PostgreSQL database is not copied, uploaded or modified by this repository.

## Local development

Backend (Python 3.13 recommended by the backend Dockerfile):

```powershell
cd backend
$env:PYTHONPATH = (Get-Location).Path
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Frontend is developed in Docker in the current project workflow. Configure `VITE_API_BASE_URL` to the browser-reachable backend origin; for local development this is typically `http://localhost:8000`.

## Database migrations

Migrations are applied by the backend container at startup using `alembic upgrade head`. To inspect migration history locally, run `alembic history` from the backend directory. Back up any production database before applying migrations.

## Authentication and user data

Access tokens are held in frontend memory. Refresh tokens are sent in an HttpOnly cookie. Clinical records are retrieved through authenticated, user-scoped API endpoints. Do not expose database credentials or user records to the frontend or repository.

## Important release and deployment notes

- Do not commit `.env`, API keys, signing secrets, database dumps, uploaded documents, patient records, `node_modules`, `.venv`, or build output.
- The current Compose file is intended for local demonstration/self-hosting. A public production deployment must use HTTPS, a managed or secured PostgreSQL service, strong secrets, a restricted CORS allowlist, rate limits, backups, monitoring, and private object storage for original medical uploads.
- The PWA can be installed on localhost for local testing; public installations require HTTPS.
- Find Care opens an external live map search. The app does not currently maintain its own verified in-app provider directory.
- AI-generated skin/report explanations are educational and must not be presented as confirmed diagnoses. A result should only be shown as AI-enriched when a provider response validates successfully.
