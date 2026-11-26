"""FastAPI router for the DermaSathiAI demo AI orchestrator.

Add to the existing FastAPI app with:
    from app.ml.demo_router import router as demo_ai_router
    app.include_router(demo_ai_router, prefix="/api/v1")

The router intentionally strips private `_meta` telemetry before returning data
so provider/model names stay backend-only.
"""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from .demo_orchestrator import DemoOrchestrator

router = APIRouter(prefix="/ai", tags=["AI Demo"])
_ORCH: DemoOrchestrator | None = None
MAX_IMAGE_BYTES = int(os.getenv("DERMASATHIAI_MAX_IMAGE_BYTES", str(12 * 1024 * 1024)))


def orchestrator() -> DemoOrchestrator:
    global _ORCH
    if _ORCH is None:
        _ORCH = DemoOrchestrator()
    return _ORCH


def public_only(result: dict) -> dict:
    return {k: v for k, v in result.items() if not k.startswith("_")}


class TriageRequest(BaseModel):
    symptoms: str = Field(min_length=1, max_length=8000)
    duration: str = Field(default="", max_length=1000)
    age: str = Field(default="", max_length=100)
    history: str = Field(default="", max_length=4000)
    language: str = Field(default="en", max_length=32)


class ConditionCareRequest(BaseModel):
    condition: str = Field(min_length=1, max_length=200)
    user_context: str = Field(default="", max_length=4000)
    prescription_text: str = Field(default="", max_length=10000)
    language: str = Field(default="en", max_length=32)


@router.post("/skin-analysis")
async def skin_analysis(
    image: UploadFile = File(...),
    user_context: str = Form(default=""),
    language: str = Form(default="en"),
):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Please upload an image file.")

    payload = await image.read(MAX_IMAGE_BYTES + 1)
    if len(payload) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large.")

    suffix = Path(image.filename or "upload.jpg").suffix.lower() or ".jpg"
    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(prefix="dermasathi_", suffix=suffix, delete=False) as tmp:
            tmp.write(payload)
            tmp_path = Path(tmp.name)
        result = orchestrator().analyze_skin(tmp_path, user_context, language)
        return public_only(result)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail="AI service is temporarily unavailable.") from exc
    finally:
        if tmp_path:
            tmp_path.unlink(missing_ok=True)


@router.post("/triage")
def triage(request: TriageRequest):
    try:
        return public_only(orchestrator().triage(
            request.symptoms, request.duration, request.age, request.history, request.language
        ))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="AI service is temporarily unavailable.") from exc




@router.post("/condition-care")
def condition_care(request: ConditionCareRequest):
    try:
        care, meta, error = orchestrator().generate_care(request.condition, request.user_context, request.prescription_text, request.language)
        if error:
            return {"status":"temporarily_unavailable", "condition":request.condition, "message":"Supplemental care information is temporarily unavailable; please retry."}
        return public_only(care)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="AI service is temporarily unavailable.") from exc


@router.get("/health")
def health():
    return {
        "status": "ok",
        "service": "dermasathi-demo-ai",
        "local_skin_model_expected": True,
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")),
    }
