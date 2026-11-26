"""Shared persistence for authenticated clinical assessments."""
from typing import Any, Optional

from fastapi import HTTPException, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.models.consultation import ConsultationRecord


def persist_consultation(
    db: Session,
    current_user: Any,
    *,
    session_type: str,
    input_payload: Any,
    result_payload: Any,
    language: str = "en",
    triage_urgency: str = "routine",
    referral_needed: bool = False,
    clinical_flags: Optional[Any] = None,
    quality_passed: bool = True,
) -> ConsultationRecord:
    """Persist the validated request and structured result for the owning user.

    No uploaded image/document bytes or API credentials are stored here.
    A persistence failure is returned as 503 rather than silently reporting
    a successful assessment that was not saved.
    """
    record = ConsultationRecord(
        user_id=current_user.id,
        session_type=session_type,
        quality_passed=quality_passed,
        triage_urgency=triage_urgency,
        referral_needed=referral_needed,
        clinical_flags=jsonable_encoder(clinical_flags) if clinical_flags is not None else None,
        language=(language or "en")[:10],
        input_payload=jsonable_encoder(input_payload),
        result_payload=jsonable_encoder(result_payload),
    )
    try:
        db.add(record)
        db.commit()
        db.refresh(record)
        return record
    except Exception as exc:
        db.rollback()
        logger.exception(
            "Consultation persistence failed for user_id=%s session_type=%s",
            current_user.id,
            session_type,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The assessment was generated but could not be safely saved. Please retry.",
        ) from exc
