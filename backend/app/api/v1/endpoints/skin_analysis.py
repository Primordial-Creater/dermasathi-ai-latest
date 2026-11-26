from __future__ import annotations

import logging
import mimetypes
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.skin_analysis import SkinAnalysisResponse, ImageQualityMetrics
from app.services.ai_provider_manager import AIProvidersUnavailable
from app.services.consultation_audit import persist_consultation
from app.services.skin_pipeline import skin_pipeline
from app.services.language_service import resolve_language

logger = logging.getLogger(__name__)
router = APIRouter()
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _mime_type(file: UploadFile) -> str:
    mime = (file.content_type or "").lower().strip()
    if mime in ALLOWED_MIME_TYPES:
        return mime
    guessed, _ = mimetypes.guess_type(file.filename or "")
    if guessed in ALLOWED_MIME_TYPES:
        return guessed
    raise HTTPException(status_code=415, detail="Please upload a JPEG, PNG, or WebP image.")


def _persist_skin_result(db: Session, user: User, file: UploadFile, contents: bytes, language: str, response: SkinAnalysisResponse, symptoms: str, duration: str, affected_area: str) -> None:
    persist_consultation(
        db,
        user,
        session_type="skin_photo",
        input_payload={
            "filename": Path(file.filename or "skin_image").name,
            "content_type": file.content_type,
            "size_bytes": len(contents),
            "symptoms_provided": bool(symptoms.strip()),
            "duration_provided": bool(duration.strip()),
            "affected_area_provided": bool(affected_area.strip()),
        },
        result_payload=response,
        language=language,
        triage_urgency=response.referral.urgency,
        referral_needed=True,
        clinical_flags={"is_high_risk": response.is_high_risk, "abstained": response.abstained, "red_flags": response.referral.red_flags_present},
        quality_passed=response.quality_gate.is_acceptable,
    )


@router.post("/analyze-image", response_model=SkinAnalysisResponse)
async def analyze_skin_image(
    file: UploadFile = File(...),
    language: str = Form("en"),
    symptoms: str = Form(""),
    duration: str = Form(""),
    affected_area: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    mime_type = _mime_type(file)
    try:
        language_code, _ = resolve_language(language)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    contents = await file.read(settings.MAX_UPLOAD_SIZE_BYTES + 1)
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded image file is empty.")
    if len(contents) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds the maximum permitted file size.")

    context = "\n".join(
        part for part in [
            f"User-reported affected body area: {affected_area.strip()[:250]}" if affected_area.strip() else "",
            f"User-reported duration: {duration.strip()[:150]}" if duration.strip() else "",
            f"User-reported symptoms: {symptoms.strip()[:1500]}" if symptoms.strip() else "",
        ] if part
    )
    try:
        response = await skin_pipeline.process_image(
            contents,
            language=language_code,
            image_mime_type=mime_type,
            user_context=context,
        )
    except AIProvidersUnavailable as exc:
        logger.warning("Skin analysis providers unavailable: %s", exc.failure_codes)
        raise HTTPException(status_code=503, detail="Skin image assessment is temporarily unavailable.") from exc
    except Exception as exc:
        logger.exception("Skin analysis failed")
        raise HTTPException(status_code=503, detail="Skin image assessment could not be completed.") from exc

    _persist_skin_result(db, current_user, file, contents, language_code, response, symptoms, duration, affected_area)
    return response


@router.post("/quality-check", response_model=ImageQualityMetrics)
async def quick_quality_check(file: UploadFile = File(...)):
    _mime_type(file)
    contents = await file.read(settings.MAX_UPLOAD_SIZE_BYTES + 1)
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    if len(contents) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Image exceeds maximum permitted file size.")
    try:
        _, metrics, _ = skin_pipeline.quality_gate.evaluate(contents)
        return metrics
    except Exception as exc:
        logger.exception("Image quality check failed")
        raise HTTPException(status_code=422, detail="The uploaded image could not be decoded.") from exc
