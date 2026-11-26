"""Authenticated multilingual medication safety explanation endpoint.

Deterministic local rules identify only a small set of known warnings. AI may
localize and explain those results but cannot add alerts or declare medicines safe.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.medications import DrugInteractionRequest, DrugSafetyResponse
from app.services.consultation_audit import persist_consultation
from app.services.language_service import resolve_language
from app.services.medication_ai_service import MedicationAIService
from app.services.medication_service import MedicationService

router = APIRouter()


async def _check_and_persist(
    req: DrugInteractionRequest,
    db: Session,
    current_user: User,
) -> DrugSafetyResponse:
    try:
        language_code, _language_name = resolve_language(req.language)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unsupported language. Select one of the supported application languages.",
        ) from exc

    # Deterministic rules execute first and remain the only source of alert status.
    baseline = MedicationService.check_safety(req)
    result = await MedicationAIService.enrich(req, baseline)

    flags = {
        "safety_status": result.safety_status,
        "review_required": result.review_required,
        "known_interaction_alert_count": len(result.interaction_alerts),
        "allergy_review_required": result.allergy_review_required,
        "unrecognized_medication_count": len(result.unrecognized_medications),
        "ai_enhancement_status": result.ai_enhancement_status,
        "response_language": result.response_language,
        "limited_rule_database": True,
    }
    record = persist_consultation(
        db,
        current_user,
        session_type="medication_safety",
        input_payload=req,
        result_payload=result,
        language=language_code,
        referral_needed=result.safety_status in {"known_interaction_alert", "warning_detected"},
        clinical_flags=flags,
    )
    return result.model_copy(update={"record_id": record.id})


@router.post("/check-safety", response_model=DrugSafetyResponse)
async def check_medication_safety(
    req: DrugInteractionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DrugSafetyResponse:
    return await _check_and_persist(req, db, current_user)


# Legacy client alias. It is authenticated and now uses the same validated
# central provider + deterministic safety workflow; no direct legacy Gemini call.
@router.post("/gemini-fallback", response_model=DrugSafetyResponse, include_in_schema=False)
async def gemini_fallback_medications(
    req: DrugInteractionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DrugSafetyResponse:
    return await _check_and_persist(req, db, current_user)
