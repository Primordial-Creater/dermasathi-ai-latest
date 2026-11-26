from sqlalchemy import CheckConstraint, Date, ForeignKeyConstraint, Time
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Boolean,
    Float,
    JSON,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
    Index,
    func,
)

from app.db.base import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    title = Column(String(200), nullable=True)
    language = Column(String(10), nullable=False, server_default="en")
    channel = Column(String(30), nullable=False, server_default="web")
    status = Column(String(20), nullable=False, server_default="active")

    started_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    last_activity_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    archived_at = Column(DateTime(timezone=True), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('active', 'archived', 'closed')",
            name="ck_conversations_status",
        ),
        Index(
            "ix_conversations_user_activity",
            "user_id",
            "last_activity_at",
        ),
    )


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(Integer, primary_key=True)

    conversation_id = Column(
        Integer,
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )

    sequence_no = Column(Integer, nullable=False)
    role = Column(String(20), nullable=False)
    content_text = Column(Text, nullable=False)
    content_format = Column(String(20), nullable=False, server_default="text")
    language = Column(String(10), nullable=False, server_default="en")
    message_metadata = Column(JSON, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    redacted_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "conversation_id",
            "sequence_no",
            name="uq_conversation_message_sequence",
        ),
        CheckConstraint(
            "role IN ('user', 'assistant', 'system', 'tool')",
            name="ck_conversation_message_role",
        ),
        CheckConstraint(
            "sequence_no >= 1",
            name="ck_conversation_message_sequence",
        ),
        Index(
            "ix_conversation_messages_conversation_created",
            "conversation_id",
            "created_at",
        ),
    )


class AIInteraction(Base):
    __tablename__ = "ai_interactions"

    id = Column(Integer, primary_key=True)

    conversation_id = Column(
        Integer,
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    request_message_id = Column(
        Integer,
        ForeignKey("conversation_messages.id", ondelete="SET NULL"),
        nullable=True,
    )

    response_message_id = Column(
        Integer,
        ForeignKey("conversation_messages.id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )

    consultation_record_id = Column(
        Integer,
        ForeignKey("consultation_records.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    primary_provider = Column(String(80), nullable=True)
    primary_model = Column(String(160), nullable=True)

    actual_provider = Column(String(80), nullable=True)
    actual_model = Column(String(160), nullable=True)

    fallback_used = Column(
        Boolean,
        nullable=False,
        server_default="false",
    )

    fallback_reason = Column(String(255), nullable=True)
    status = Column(String(30), nullable=False, server_default="pending")

    latency_ms = Column(Float, nullable=True)
    confidence = Column(Float, nullable=True)
    abstained = Column(Boolean, nullable=False, server_default="false")

    request_metadata = Column(JSON, nullable=True)
    response_metadata = Column(JSON, nullable=True)
    error_code = Column(String(80), nullable=True)

    started_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    completed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'succeeded', 'failed', "
            "'fallback_succeeded', 'abstained')",
            name="ck_ai_interactions_status",
        ),
        Index(
            "ix_ai_interactions_conversation_started",
            "conversation_id",
            "started_at",
        ),
    )
    __table_args__ = __table_args__ + (
        CheckConstraint(
            "confidence IS NULL OR "
            "(confidence >= 0 AND confidence <= 1)",
            name="ck_ai_interactions_confidence_range",
        ),
        CheckConstraint(
            "latency_ms IS NULL OR "
            "(latency_ms >= 0 AND latency_ms < 'Infinity'::double precision)",
            name="ck_ai_interactions_latency_nonnegative_finite",
        ),
    )


class AIInteractionSource(Base):
    __tablename__ = "ai_interaction_sources"

    id = Column(Integer, primary_key=True)

    ai_interaction_id = Column(
        Integer,
        ForeignKey("ai_interactions.id", ondelete="CASCADE"),
        nullable=False,
    )

    knowledge_chunk_id = Column(
        Integer,
        ForeignKey("knowledge_chunks.id", ondelete="RESTRICT"),
        nullable=False,
    )

    source_rank = Column(Integer, nullable=False)
    relevance_score = Column(Float, nullable=True)
    citation_metadata = Column(JSON, nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "ai_interaction_id",
            "knowledge_chunk_id",
            name="uq_ai_interaction_source_chunk",
        ),
        CheckConstraint(
            "source_rank >= 1",
            name="ck_ai_interaction_source_rank",
        ),
    )


class ActivityEvent(Base):
    __tablename__ = "activity_events"

    id = Column(Integer, primary_key=True)

    # Null user_id supports failed anonymous authentication events.
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    event_code = Column(String(100), nullable=False)
    actor_type = Column(String(30), nullable=False)
    target_type = Column(String(60), nullable=True)
    target_id = Column(String(100), nullable=True)

    outcome = Column(String(20), nullable=False)
    request_id = Column(String(100), nullable=True)

    event_metadata = Column(JSON, nullable=True)

    ip_hash = Column(String(64), nullable=True)
    user_agent_hash = Column(String(64), nullable=True)

    occurred_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        CheckConstraint(
            "outcome IN ('success', 'failure', 'denied', 'error')",
            name="ck_activity_events_outcome",
        ),
        Index(
            "ix_activity_events_user_time",
            "user_id",
            "occurred_at",
        ),
        Index(
            "ix_activity_events_code_time",
            "event_code",
            "occurred_at",
        ),
    )


class ReminderEvent(Base):
    __tablename__ = "reminder_events"

    id = Column(Integer, primary_key=True)

    reminder_id = Column(
        Integer,
        ForeignKey("medication_reminders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    action_code = Column(String(30), nullable=False)

    previous_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=True)

    scheduled_date_snapshot = Column(Date, nullable=True)
    scheduled_time_snapshot = Column(Time, nullable=True)

    snooze_until = Column(DateTime(timezone=True), nullable=True)
    notes = Column(String(255), nullable=True)
    source = Column(String(30), nullable=False, server_default="patient")

    occurred_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        CheckConstraint(
            "action_code IN ('created', 'taken', 'skipped', "
            "'snoozed', 'missed', 'rescheduled', 'cancelled')",
            name="ck_reminder_events_action",
        ),
        Index(
            "ix_reminder_events_user_time",
            "user_id",
            "occurred_at",
        ),
        Index(
            "ix_reminder_events_reminder_time",
            "reminder_id",
            "occurred_at",
        ),
    )
    __table_args__ = __table_args__ + (
        ForeignKeyConstraint(
            ["reminder_id", "user_id"],
            ["medication_reminders.id", "medication_reminders.user_id"],
            name="fk_reminder_events_reminder_owner",
        ),
    )


class ConversationMessageFile(Base):
    __tablename__ = "conversation_message_files"

    id = Column(Integer, primary_key=True)

    message_id = Column(
        Integer,
        ForeignKey("conversation_messages.id", ondelete="CASCADE"),
        nullable=False,
    )

    uploaded_file_id = Column(
        Integer,
        ForeignKey("uploaded_files.id", ondelete="CASCADE"),
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint(
            "message_id",
            "uploaded_file_id",
            name="uq_conversation_message_file",
        ),
    )
