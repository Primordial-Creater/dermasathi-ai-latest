DERMASATHIAI - STAGE 1 BACKEND REPAIR PATCH

Scope:
- Restore authenticated symptoms routes (/api/v1/symptoms/analyze and hidden compatibility alias /check).
- Keep Alembic as the only schema migration mechanism; no create_all() call is added.
- Remove mandatory local .keras model loading from FastAPI startup.
- Make health checks independent of local ML model files.
- Defer imports of old local skin inference modules until the legacy routes are called.

This patch does NOT yet implement the Gemini/Groq provider manager or replace skin-analysis inference.
The legacy skin route is temporarily left behind a lazy import until Stage 2 replaces it with
provider-based vision analysis. Do not delete model files or requirements yet.

Apply from Windows PowerShell after backing up backend/app:

  cd D:\DermaSathi-AI
  Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\DermaSathiAI-Stage1-Patch.zip" -DestinationPath . -Force

Then run an import check:

  cd D:\DermaSathi-AI\backend
  $env:PYTHONPATH = (Get-Location).Path
  python -c "from app.main import app; print('APP_IMPORT_OK', app.title); print('ROUTES', len(app.routes))"
  Remove-Item Env:PYTHONPATH

If the import succeeds, start the backend in this PowerShell window:

  cd D:\DermaSathi-AI\backend
  $env:PYTHONPATH = (Get-Location).Path
  python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

In a second PowerShell window:

  Invoke-RestMethod http://127.0.0.1:8000/api/v1/health/status

Do not run alembic upgrade, drop schema, restore dumps, or delete models as part of this stage.
