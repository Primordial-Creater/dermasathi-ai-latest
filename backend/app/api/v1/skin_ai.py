"""Central-provider skin image endpoint. Keeps the existing /skin/analyze URL."""

from __future__ import annotations

import logging
import mimetypes
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.skin_analysis import SkinAnalysisResponse
from app.services.ai_provider_manager import AIProvidersUnavailable, ai_provider_manager
from app.services.consultation_audit import persist_consultation
from app.services.skin_pipeline import skin_pipeline
from app.services.language_service import resolve_language

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/skin", tags=["Skin Analysis"])
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _mime_type(file: UploadFile) -> str:
    mime = (file.content_type or "").lower().strip()
    if mime in ALLOWED_MIME_TYPES:
        return mime
    guessed, _ = mimetypes.guess_type(file.filename or "")
    if guessed in ALLOWED_MIME_TYPES:
        return guessed
    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail="Please upload a JPEG, PNG, or WebP image.",
    )


@router.post("/analyze", response_model=SkinAnalysisResponse, summary="AI-assisted skin image assessment")
async def analyze_skin_image(
    file: UploadFile = File(..., description="JPEG, PNG, or WebP skin photograph"),
    language: str = Form("en"),
    symptoms: str = Form(""),
    duration: str = Form(""),
    affected_area: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SkinAnalysisResponse:
    mime_type = _mime_type(file)
    try:
        language_code, _ = resolve_language(language)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    content = await file.read(settings.MAX_UPLOAD_SIZE_BYTES + 1)
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="The uploaded image exceeds the permitted file size.")

    context_parts = []
    if affected_area.strip():
        context_parts.append(f"User-reported affected body area: {affected_area.strip()[:250]}")
    if duration.strip():
        context_parts.append(f"User-reported duration: {duration.strip()[:150]}")
    if symptoms.strip():
        context_parts.append(f"User-reported symptoms: {symptoms.strip()[:1500]}")
    user_context = "\n".join(context_parts)

    try:
        response = await skin_pipeline.process_image(
            content,
            language=language_code,
            image_mime_type=mime_type,
            user_context=user_context,
        )
    except AIProvidersUnavailable as exc:
        logger.warning("Skin assessment providers unavailable: %s", exc.failure_codes)
        raise HTTPException(
            status_code=503,
            detail="Skin image assessment is temporarily unavailable. Please try again later.",
        ) from exc
    except Exception as exc:
        logger.exception("Skin image assessment failed")
        raise HTTPException(
            status_code=503,
            detail="Skin image assessment could not be completed. Please try again later.",
        ) from exc

    record = persist_consultation(
        db,
        current_user,
        session_type="skin_photo",
        input_payload={
            "filename": Path(file.filename or "skin_image").name,
            "content_type": mime_type,
            "size_bytes": len(content),
            "symptoms_provided": bool(symptoms.strip()),
            "duration_provided": bool(duration.strip()),
            "affected_area_provided": bool(affected_area.strip()),
        },
        result_payload=response,
        language=language_code,
        triage_urgency=response.referral.urgency,
        referral_needed=True,
        clinical_flags={
            "is_high_risk": response.is_high_risk,
            "abstained": response.abstained,
            "red_flags": response.referral.red_flags_present,
        },
        quality_passed=response.quality_gate.is_acceptable,
    )
    return response.model_copy(update={"record_id": record.id})


@router.get("/status", summary="Check skin AI provider readiness")
async def get_skin_ai_status() -> dict:
    provider_status = ai_provider_manager.configuration_status()
    ready = bool(
        provider_status.get("primary_key_configured")
        or provider_status.get("fallback_key_configured")
    )
    return {
        "service_ready": ready,
        "message": "Remote AI vision assessment is configured." if ready else "No AI provider key is configured on the server.",
        "local_models_enabled": False,
        "providers": provider_status,
    }
