from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.emergency import EmergencyAssessmentRequest, EmergencyAssessmentResponse
from app.services.consultation_audit import persist_consultation
from app.services.triage_service import TriageService

router = APIRouter()


@router.post("/assess", response_model=EmergencyAssessmentResponse)
def assess_emergency_risk(
    req: EmergencyAssessmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Deterministic triage runs first. Gemini must never override this result.
    result = TriageService.assess_emergency(req)
    priority = result.triage_priority
    urgency = "emergency" if priority == "IMMEDIATE_EMERGENCY" else (
        "prompt_consult" if priority == "URGENT_EVALUATION" else "routine"
    )
    persist_consultation(
        db,
        current_user,
        session_type="emergency_triage",
        input_payload=req,
        result_payload=result,
        language=req.language,
        triage_urgency=urgency,
        referral_needed=urgency != "routine",
        clinical_flags={
            "is_emergency": result.is_emergency,
            "triage_priority": result.triage_priority,
        },
    )
    return result


# DERMASATHI_GEMINI_FALLBACK_EMERGENCY_V1
@router.post("/gemini-fallback")
async def gemini_fallback_emergency(payload: dict):
    from app.ml.feature_gemini_fallback import generate_json_fallback
    language = str(payload.get("language") or "en")
    return generate_json_fallback("emergency", payload, language)
