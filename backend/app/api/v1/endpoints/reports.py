import os
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Depends
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.medical_report import MedicalReportAnalysisResponse
from app.services.ai_provider_manager import ai_provider_manager
from app.services.consultation_audit import persist_consultation
from app.services.document_ai_service import document_ai_service
from app.services.language_service import resolve_language

router = APIRouter()

ALLOWED_REPORT_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"]


@router.get("/status", summary="Check DermaSathiAI document analysis status")
async def get_report_analyzer_status():
    """Return sanitized provider configuration; never expose credentials."""
    provider_status = ai_provider_manager.configuration_status()
    return {
        # Legacy fields retained for existing UI clients.
        "gemini_configured": provider_status["primary_key_configured"],
        "model": settings.GEMINI_MODEL,
        "supported_formats": ALLOWED_REPORT_EXTENSIONS,
        "max_upload_size_mb": settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024),
        "ai_providers": provider_status,
    }


@router.post(
    "/analyze",
    response_model=MedicalReportAnalysisResponse,
    summary="Analyze a medical report using the central AI provider chain",
)
async def analyze_medical_report(
    file: UploadFile = File(..., description="Medical report PDF or image"),
    language: str = Form("en", description="Selected DermaSathiAI language code"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filename = os.path.basename((file.filename or "medical_report").replace("\\", "/"))
    extension = os.path.splitext(filename)[1].lower()
    if extension not in ALLOWED_REPORT_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported document format '{extension}'. Supported: {', '.join(ALLOWED_REPORT_EXTENSIONS)}.",
        )

    try:
        language_code, _ = resolve_language(language)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unsupported language code. Select a supported DermaSathiAI language.",
        ) from exc

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The uploaded document is empty.")
    if len(content) > settings.MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)} MB upload limit.",
        )

    result = await document_ai_service.analyze_report(
        file_bytes=content,
        filename=filename,
        language=language_code,
    )

    urgency = result.urgency_level if result.urgency_level in {"routine", "monitor", "consult_doctor", "emergency"} else "monitor"
    triage_urgency = {
        "routine": "routine",
        "monitor": "routine",
        "consult_doctor": "prompt_consult",
        "emergency": "emergency",
    }[urgency]

    record = persist_consultation(
        db,
        current_user,
        session_type="medical_report",
        input_payload={
            "filename": filename,
            "content_type": file.content_type,
            "size_bytes": len(content),
            "page_count": result.source_page_count,
        },
        result_payload=result,
        language=language_code,
        triage_urgency=triage_urgency,
        referral_needed=urgency in {"consult_doctor", "emergency"},
        clinical_flags={
            "urgency_level": urgency,
            "abnormal_value_count": len(result.abnormal_values),
            "fallback_used": result.fallback_used,
        },
    )
    return result.model_copy(update={"record_id": record.id})


# Backward-compatible route: fallback now happens internally in the manager.
# This alias deliberately uses the same authenticated handler and persistence.
router.add_api_route(
    "/gemini-fallback",
    analyze_medical_report,
    methods=["POST"],
    response_model=MedicalReportAnalysisResponse,
    include_in_schema=False,
)
