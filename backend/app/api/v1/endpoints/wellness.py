from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.wellness import WellnessGuidanceRequest, LifestyleGuidanceResponse
from app.services.consultation_audit import persist_consultation
from app.services.wellness_service import WellnessService
from app.services.wellness_ai_service import WellnessAIService

router = APIRouter()


async def _run_wellness(
    req: WellnessGuidanceRequest,
    db: Session,
    current_user: User,
) -> LifestyleGuidanceResponse:
    try:
        baseline = WellnessService.get_guidance(req)
        result = await WellnessAIService.enrich(req, baseline)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unsupported language or request value",
        ) from exc

    record = persist_consultation(
        db,
        current_user,
        session_type="wellness",
        input_payload=req,
        result_payload=result,
        language=req.language,
        referral_needed=False,
    )
    return result.model_copy(update={"record_id": record.id})


@router.post("/guidance", response_model=LifestyleGuidanceResponse)
async def get_wellness_guidance(
    req: WellnessGuidanceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await _run_wellness(req, db, current_user)


@router.post("/gemini-fallback", response_model=LifestyleGuidanceResponse, include_in_schema=False)
async def legacy_wellness_fallback(
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Authenticated compatibility alias; now routed through the central provider manager."""
    try:
        request = WellnessGuidanceRequest.model_validate(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid wellness request",
        ) from exc
    return await _run_wellness(request, db, current_user)
