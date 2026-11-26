# DERMASATHIAI_PERSISTENCE_SERVICE_V1

"""
Shared persistence operations for DermaSathiAI.

Important:
- Every patient-owned query verifies user ownership.
- This module never commits transactions.
- The API endpoint/service caller owns commit and rollback.
- Patient-visible conversation content is stored in messages.
- Activity metadata must not contain raw credentials or file contents.
"""

from __future__ import annotations

import json
import math
import re

from datetime import datetime, timezone
from typing import Any, Optional, Mapping

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.consultation import ConsultationRecord
from app.models.prescription import MedicationReminder
from app.models.platform import UploadedFile, KnowledgeChunk

from app.models.persistence import (
    Conversation,
    ConversationMessage,
    AIInteraction,
    AIInteractionSource,
    ActivityEvent,
    ReminderEvent,
    ConversationMessageFile,
)


class PersistenceError(Exception):
    """Base persistence operation error."""


class OwnershipError(PersistenceError):
    """Requested resource is unavailable to this patient."""


class PersistenceValidationError(PersistenceError):
    """Invalid persistence input."""


def _require_active_user(db: Session, user_id: int) -> User:

    if not isinstance(user_id, int) or user_id <= 0:
        raise PersistenceValidationError("Invalid user ID.")

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .one_or_none()
    )

    if user is None or not user.is_active:
        raise OwnershipError("User account unavailable.")

    return user


def _owned_conversation(
    db: Session,
    user_id: int,
    conversation_id: int,
    lock: bool = False,
) -> Conversation:

    query = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == user_id,
        Conversation.deleted_at.is_(None),
    )

    if lock:
        query = query.with_for_update()

    conversation = query.one_or_none()

    if conversation is None:
        raise OwnershipError("Conversation unavailable.")

    return conversation


def _validate_json_payload(
    payload: Optional[Mapping[str, Any]],
    max_bytes: int = 1_000_000,
) -> Optional[dict]:

    if payload is None:
        return None

    if not isinstance(payload, Mapping):
        raise PersistenceValidationError(
            "Payload must be a JSON-compatible mapping."
        )

    try:
        encoded = json.dumps(payload, ensure_ascii=False)
    except (TypeError, ValueError) as exc:
        raise PersistenceValidationError(
            "Payload is not JSON serializable."
        ) from exc

    if len(encoded.encode("utf-8")) > max_bytes:
        raise PersistenceValidationError(
            "Payload exceeds the configured size limit."
        )

    return dict(payload)


_SECRET_KEY = re.compile(
    r"password|secret|token|api[_-]?key|authorization|cookie|"
    r"file[_-]?bytes|image[_-]?bytes|base64",
    re.IGNORECASE,
)


def _safe_metadata(value: Any, depth: int = 0) -> Any:

    if depth > 4:
        return "[truncated]"

    if value is None or isinstance(value, (bool, int)):
        return value

    if isinstance(value, float):
        return value if math.isfinite(value) else None

    if isinstance(value, str):
        return value[:1000]

    if isinstance(value, Mapping):

        result = {}

        for key, item in list(value.items())[:50]:

            key = str(key)[:100]

            if _SECRET_KEY.search(key):
                continue

            result[key] = _safe_metadata(item, depth + 1)

        return result

    if isinstance(value, (list, tuple)):
        return [
            _safe_metadata(item, depth + 1)
            for item in list(value)[:50]
        ]

    return str(value)[:500]


def create_conversation(
    db: Session,
    user_id: int,
    language: str = "en",
    channel: str = "web",
    title: Optional[str] = None,
) -> Conversation:

    _require_active_user(db, user_id)

    if channel not in {"web", "mobile", "voice", "api"}:
        raise PersistenceValidationError("Unsupported channel.")

    conversation = Conversation(
        user_id=user_id,
        language=language[:10],
        channel=channel,
        title=title[:200] if title else None,
        status="active",
    )

    db.add(conversation)
    db.flush()

    return conversation


def append_message(
    db: Session,
    user_id: int,
    conversation_id: int,
    role: str,
    content: str,
    language: str = "en",
    content_format: str = "text",
    metadata: Optional[Mapping[str, Any]] = None,
) -> ConversationMessage:

    _require_active_user(db, user_id)

    if role not in {"user", "assistant", "system", "tool"}:
        raise PersistenceValidationError("Invalid message role.")

    if not isinstance(content, str) or not content.strip():
        raise PersistenceValidationError("Message content is empty.")

    if len(content) > 100_000:
        raise PersistenceValidationError("Message is too large.")

    conversation = _owned_conversation(
        db,
        user_id,
        conversation_id,
        lock=True,
    )

    last_sequence = (
        db.query(func.max(ConversationMessage.sequence_no))
        .filter(
            ConversationMessage.conversation_id == conversation.id
        )
        .scalar()
    )

    message = ConversationMessage(
        conversation_id=conversation.id,
        sequence_no=(last_sequence or 0) + 1,
        role=role,
        content_text=content,
        content_format=content_format[:20],
        language=language[:10],
        message_metadata=_safe_metadata(metadata),
    )

    conversation.last_activity_at = datetime.now(timezone.utc)

    db.add(message)
    db.flush()

    return message


def create_consultation_record(
    db: Session,
    user_id: int,
    session_type: str,
    input_payload: Optional[Mapping[str, Any]],
    result_payload: Optional[Mapping[str, Any]],
    language: str = "en",
    **clinical_fields,
) -> ConsultationRecord:

    _require_active_user(db, user_id)

    allowed_fields = {
        "quality_passed",
        "quality_metrics",
        "suspected_categories",
        "calibrated_confidence",
        "abstained",
        "abstention_reason",
        "triage_urgency",
        "referral_needed",
        "clinical_flags",
    }

    unexpected = set(clinical_fields) - allowed_fields

    if unexpected:
        raise PersistenceValidationError(
            f"Unsupported consultation fields: {sorted(unexpected)}"
        )

    confidence = clinical_fields.get("calibrated_confidence")

    if confidence is not None and not 0 <= confidence <= 1:
        raise PersistenceValidationError(
            "Confidence must be between 0 and 1."
        )

    record = ConsultationRecord(
        user_id=user_id,
        session_type=session_type[:50],
        language=language[:10],
        input_payload=_validate_json_payload(input_payload),
        result_payload=_validate_json_payload(result_payload),
        **clinical_fields,
    )

    db.add(record)
    db.flush()

    return record


def register_uploaded_file(
    db: Session,
    user_id: int,
    storage_provider: str,
    object_key: str,
    original_filename: str,
    content_type: str,
    byte_size: int,
    sha256: str,
    purpose: str,
    consultation_record_id: Optional[int] = None,
    scan_status: str = "pending",
) -> UploadedFile:

    _require_active_user(db, user_id)

    if byte_size <= 0:
        raise PersistenceValidationError("File size must be positive.")

    if not re.fullmatch(r"[0-9a-fA-F]{64}", sha256):
        raise PersistenceValidationError("Invalid SHA-256 digest.")

    if not object_key or len(object_key) > 512:
        raise PersistenceValidationError("Invalid object key.")

    if consultation_record_id is not None:

        consultation = (
            db.query(ConsultationRecord)
            .filter(
                ConsultationRecord.id == consultation_record_id,
                ConsultationRecord.user_id == user_id,
            )
            .one_or_none()
        )

        if consultation is None:
            raise OwnershipError("Consultation unavailable.")

    uploaded = UploadedFile(
        user_id=user_id,
        consultation_record_id=consultation_record_id,
        storage_provider=storage_provider[:40],
        object_key=object_key,
        original_filename=original_filename[:255],
        content_type=content_type[:120],
        byte_size=byte_size,
        sha256=sha256.lower(),
        purpose=purpose[:50],
        scan_status=scan_status[:24],
    )

    db.add(uploaded)
    db.flush()

    return uploaded


def link_message_file(
    db: Session,
    user_id: int,
    message_id: int,
    uploaded_file_id: int,
) -> ConversationMessageFile:

    _require_active_user(db, user_id)

    message = (
        db.query(ConversationMessage)
        .join(
            Conversation,
            Conversation.id == ConversationMessage.conversation_id,
        )
        .filter(
            ConversationMessage.id == message_id,
            Conversation.user_id == user_id,
            Conversation.deleted_at.is_(None),
        )
        .one_or_none()
    )

    if message is None:
        raise OwnershipError("Message unavailable.")

    uploaded = (
        db.query(UploadedFile)
        .filter(
            UploadedFile.id == uploaded_file_id,
            UploadedFile.user_id == user_id,
            UploadedFile.deleted_at.is_(None),
        )
        .one_or_none()
    )

    if uploaded is None:
        raise OwnershipError("Uploaded file unavailable.")

    link = ConversationMessageFile(
        message_id=message_id,
        uploaded_file_id=uploaded_file_id,
    )

    db.add(link)
    db.flush()

    return link


def create_ai_interaction(
    db: Session,
    user_id: int,
    conversation_id: int,
    request_message_id: Optional[int] = None,
    response_message_id: Optional[int] = None,
    consultation_record_id: Optional[int] = None,
    primary_provider: Optional[str] = None,
    primary_model: Optional[str] = None,
    actual_provider: Optional[str] = None,
    actual_model: Optional[str] = None,
    fallback_used: bool = False,
    fallback_reason: Optional[str] = None,
    status: str = "pending",
    latency_ms: Optional[float] = None,
    confidence: Optional[float] = None,
    abstained: bool = False,
    request_metadata: Optional[Mapping[str, Any]] = None,
    response_metadata: Optional[Mapping[str, Any]] = None,
) -> AIInteraction:

    _require_active_user(db, user_id)
    _owned_conversation(db, user_id, conversation_id)

    allowed_statuses = {
        "pending",
        "succeeded",
        "failed",
        "fallback_succeeded",
        "abstained",
    }

    if status not in allowed_statuses:
        raise PersistenceValidationError("Invalid AI interaction status.")

    for message_id in (request_message_id, response_message_id):

        if message_id is None:
            continue

        exists = (
            db.query(ConversationMessage.id)
            .filter(
                ConversationMessage.id == message_id,
                ConversationMessage.conversation_id == conversation_id,
            )
            .first()
        )

        if exists is None:
            raise OwnershipError(
                "Message does not belong to this conversation."
            )

    if consultation_record_id is not None:

        consultation = (
            db.query(ConsultationRecord)
            .filter(
                ConsultationRecord.id == consultation_record_id,
                ConsultationRecord.user_id == user_id,
            )
            .one_or_none()
        )

        if consultation is None:
            raise OwnershipError("Consultation unavailable.")

    if latency_ms is not None and latency_ms < 0:
        raise PersistenceValidationError("Invalid latency.")

    if confidence is not None and not 0 <= confidence <= 1:
        raise PersistenceValidationError("Invalid confidence.")

    interaction = AIInteraction(
        conversation_id=conversation_id,
        request_message_id=request_message_id,
        response_message_id=response_message_id,
        consultation_record_id=consultation_record_id,
        primary_provider=primary_provider,
        primary_model=primary_model,
        actual_provider=actual_provider,
        actual_model=actual_model,
        fallback_used=fallback_used,
        fallback_reason=fallback_reason,
        status=status,
        latency_ms=latency_ms,
        confidence=confidence,
        abstained=abstained,
        request_metadata=_safe_metadata(request_metadata),
        response_metadata=_safe_metadata(response_metadata),
        completed_at=(
            datetime.now(timezone.utc)
            if status != "pending"
            else None
        ),
    )

    db.add(interaction)
    db.flush()

    return interaction


def add_ai_interaction_source(
    db: Session,
    user_id: int,
    ai_interaction_id: int,
    knowledge_chunk_id: int,
    source_rank: int,
    relevance_score: Optional[float] = None,
    citation_metadata: Optional[Mapping[str, Any]] = None,
) -> AIInteractionSource:

    _require_active_user(db, user_id)

    interaction = (
        db.query(AIInteraction)
        .join(
            Conversation,
            Conversation.id == AIInteraction.conversation_id,
        )
        .filter(
            AIInteraction.id == ai_interaction_id,
            Conversation.user_id == user_id,
        )
        .one_or_none()
    )

    if interaction is None:
        raise OwnershipError("AI interaction unavailable.")

    if source_rank < 1:
        raise PersistenceValidationError("Source rank must be positive.")

    chunk = (
        db.query(KnowledgeChunk)
        .filter(KnowledgeChunk.id == knowledge_chunk_id)
        .one_or_none()
    )

    if chunk is None:
        raise PersistenceValidationError("Knowledge chunk unavailable.")

    source = AIInteractionSource(
        ai_interaction_id=ai_interaction_id,
        knowledge_chunk_id=knowledge_chunk_id,
        source_rank=source_rank,
        relevance_score=relevance_score,
        citation_metadata=_safe_metadata(citation_metadata),
    )

    db.add(source)
    db.flush()

    return source


def record_activity_event(
    db: Session,
    event_code: str,
    actor_type: str,
    outcome: str,
    user_id: Optional[int] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    request_id: Optional[str] = None,
    metadata: Optional[Mapping[str, Any]] = None,
    ip_hash: Optional[str] = None,
    user_agent_hash: Optional[str] = None,
) -> ActivityEvent:

    if user_id is not None:
        _require_active_user(db, user_id)

    if outcome not in {"success", "failure", "denied", "error"}:
        raise PersistenceValidationError("Invalid activity outcome.")

    event = ActivityEvent(
        user_id=user_id,
        event_code=event_code[:100],
        actor_type=actor_type[:30],
        target_type=target_type[:60] if target_type else None,
        target_id=str(target_id)[:100] if target_id else None,
        outcome=outcome,
        request_id=request_id[:100] if request_id else None,
        event_metadata=_safe_metadata(metadata),
        ip_hash=ip_hash,
        user_agent_hash=user_agent_hash,
    )

    db.add(event)
    db.flush()

    return event


def record_reminder_event(
    db: Session,
    user_id: int,
    reminder_id: int,
    action_code: str,
    notes: Optional[str] = None,
    snooze_until: Optional[datetime] = None,
    source: str = "patient",
) -> ReminderEvent:

    _require_active_user(db, user_id)

    allowed_actions = {
        "created",
        "taken",
        "skipped",
        "snoozed",
        "missed",
        "rescheduled",
        "cancelled",
    }

    if action_code not in allowed_actions:
        raise PersistenceValidationError("Invalid reminder action.")

    reminder = (
        db.query(MedicationReminder)
        .filter(
            MedicationReminder.id == reminder_id,
            MedicationReminder.user_id == user_id,
        )
        .with_for_update()
        .one_or_none()
    )

    if reminder is None:
        raise OwnershipError("Reminder unavailable.")

    previous_status = reminder.status

    status_map = {
        "taken": "taken",
        "skipped": "skipped",
        "snoozed": "snoozed",
        "missed": "missed",
        "rescheduled": "scheduled",
        "cancelled": "cancelled",
    }

    if action_code in status_map:
        reminder.status = status_map[action_code]
        reminder.action_timestamp = datetime.now(timezone.utc)

    if notes is not None:
        reminder.notes = notes[:255]

    event = ReminderEvent(
        reminder_id=reminder.id,
        user_id=user_id,
        action_code=action_code,
        previous_status=previous_status,
        new_status=reminder.status,
        scheduled_date_snapshot=reminder.scheduled_date,
        scheduled_time_snapshot=reminder.scheduled_time,
        snooze_until=snooze_until,
        notes=notes[:255] if notes else None,
        source=source[:30],
    )

    db.add(event)
    db.flush()

    return event
