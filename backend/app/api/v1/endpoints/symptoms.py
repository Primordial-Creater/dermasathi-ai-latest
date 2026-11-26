"""Authenticated multilingual symptom assessment endpoint.

Deterministic red-flag triage always runs first and remains authoritative.
The central AI provider only adds/localizes educational explanations; it cannot
change triage level, ownership checks, persistence, or emergency instructions.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.symptoms import SymptomCheckRequest, SymptomCheckResponse
from app.services.consultation_audit import persist_consultation
from app.services.language_service import resolve_language
from app.services.symptom_ai_service import SymptomAIService
from app.services.symptom_service import SymptomService

router = APIRouter()


async def _assess(
    req: SymptomCheckRequest,
    db: Session,
    current_user: User,
) -> SymptomCheckResponse:
    try:
        language_code, _language_name = resolve_language(req.language)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unsupported language. Select one of the supported application languages.",
        ) from exc

    # Never allow an LLM to decide whether an emergency exists.
    deterministic_result = SymptomService.evaluate(req)
    result = await SymptomAIService.enrich(req, deterministic_result)

    urgency = {
        "emergency": "emergency",
        "prompt_consult": "prompt_consult",
        "routine": "routine",
    }.get(deterministic_result.triage_level, "prompt_consult")

    record = persist_consultation(
        db,
        current_user,
        session_type="symptom_assessment",
        input_payload=req,
        result_payload=result,
        language=language_code,
        triage_urgency=urgency,
        referral_needed=urgency != "routine",
        clinical_flags={
            "triage_level": deterministic_result.triage_level,
            "red_flag_count": len(deterministic_result.red_flags),
            "ai_enhancement_status": result.ai_enhancement_status,
            "response_language": result.response_language,
        },
    )
    return result.model_copy(update={"record_id": record.id})


@router.post("/analyze", response_model=SymptomCheckResponse)
@router.post("/check", response_model=SymptomCheckResponse, include_in_schema=False)
async def analyze_symptoms(
    req: SymptomCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SymptomCheckResponse:
    """Run deterministic triage, add AI explanations, and persist the result."""
    return await _assess(req, db, current_user)
