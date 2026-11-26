from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.health_assistant import HealthAssistantRequest, HealthAssistantResponse
from app.services.consultation_audit import persist_consultation
from app.services.health_assistant_service import HealthAssistantService

router = APIRouter()


@router.post("/chat", response_model=HealthAssistantResponse)
async def health_assistant_chat(
    req: HealthAssistantRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await HealthAssistantService.answer(req)
    record = persist_consultation(
        db,
        current_user,
        session_type="health_assistant",
        input_payload=req,
        result_payload=result,
        language=req.language,
        referral_needed=result.emergency_fast_path,
    )
    return result.model_copy(update={"record_id": record.id})
