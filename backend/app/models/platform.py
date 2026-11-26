from sqlalchemy import CheckConstraint, ForeignKeyConstraint, UniqueConstraint
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Text,
    Float,
    JSON,
    CheckConstraint,
    UniqueConstraint,
    Index,
    func,
)

from app.db.base import Base


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(Integer, primary_key=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    birth_date = Column(Date, nullable=True)
    sex_at_birth = Column(String(30), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id = Column(Integer, primary_key=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Store only the SHA-256 hash of the refresh token.
    refresh_token_hash = Column(
        String(64),
        nullable=False,
        unique=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    expires_at = Column(
        DateTime(timezone=True),
        nullable=False,
    )

    revoked_at = Column(DateTime(timezone=True), nullable=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    ip_hash = Column(String(64), nullable=True)
    user_agent_hash = Column(String(64), nullable=True)

    revoke_reason = Column(String(80), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "expires_at > created_at",
            name="ck_auth_sessions_expiry",
        ),
        Index(
            "ix_auth_sessions_user_expires",
            "user_id",
            "expires_at",
        ),
    )


class PrivacyNoticeVersion(Base):
    __tablename__ = "privacy_notice_versions"

    id = Column(Integer, primary_key=True)

    notice_code = Column(String(80), nullable=False)
    version = Column(String(32), nullable=False)
    language = Column(String(10), nullable=False)

    content_sha256 = Column(String(64), nullable=False)
    document_uri = Column(String(512), nullable=True)

    published_at = Column(DateTime(timezone=True), nullable=False)
    effective_at = Column(DateTime(timezone=True), nullable=False)
    retired_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "notice_code",
            "version",
            "language",
            name="uq_privacy_notice_version_language",
        ),
    )


class ConsentEvent(Base):
    __tablename__ = "consent_events"

    id = Column(Integer, primary_key=True)

    # Nullable so historical evidence can survive account deletion.
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Pseudonymous reference retained independently of the user row.
    subject_ref_hash = Column(String(64), nullable=False)

    purpose_code = Column(String(80), nullable=False)

    action = Column(String(20), nullable=False)

    notice_version_id = Column(
        Integer,
        ForeignKey(
            "privacy_notice_versions.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )

    language = Column(String(10), nullable=False)
    capture_method = Column(String(40), nullable=False)

    ip_hash = Column(String(64), nullable=True)

    recorded_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "action IN ('granted', 'withdrawn', 'declined', 'reaffirmed')",
            name="ck_consent_events_action",
        ),
        Index(
            "ix_consent_events_user_purpose",
            "user_id",
            "purpose_code",
            "recorded_at",
        ),
    )


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(Integer, primary_key=True)

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    consultation_record_id = Column(
        Integer,
        ForeignKey("consultation_records.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    storage_provider = Column(String(40), nullable=False)

    # Private object-storage key, never a public download URL.
    object_key = Column(String(512), nullable=False, unique=True)

    original_filename = Column(String(255), nullable=False)
    content_type = Column(String(120), nullable=False)

    byte_size = Column(BigInteger, nullable=False)
    sha256 = Column(String(64), nullable=False)

    purpose = Column(String(50), nullable=False)
    scan_status = Column(String(24), nullable=False, default="pending")

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    retention_until = Column(DateTime(timezone=True), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "byte_size > 0",
            name="ck_uploaded_files_positive_size",
        ),
        Index(
            "ix_uploaded_files_user_created",
            "user_id",
            "created_at",
        ),
    )
    __table_args__ = __table_args__ + (
        UniqueConstraint(
            "id",
            "user_id",
            name="uq_uploaded_files_id_user",
        ),
        ForeignKeyConstraint(
            ["consultation_record_id", "user_id"],
            ["consultation_records.id", "consultation_records.user_id"],
            name="fk_uploaded_files_consultation_owner",
        ),
    )


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id = Column(Integer, primary_key=True)

    model_family = Column(String(100), nullable=False)
    component = Column(String(60), nullable=False)
    version = Column(String(40), nullable=False)

    artifact_sha256 = Column(String(64), nullable=False)
    artifact_storage_key = Column(String(512), nullable=False)

    class_mapping_sha256 = Column(String(64), nullable=True)

    framework = Column(String(50), nullable=True)
    input_specification = Column(JSON, nullable=True)
    output_labels = Column(JSON, nullable=True)

    validation_metrics = Column(JSON, nullable=True)
    validation_dataset_version = Column(String(100), nullable=True)

    is_approved_for_inference = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    registered_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    activated_at = Column(DateTime(timezone=True), nullable=True)
    retired_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "model_family",
            "component",
            "version",
            name="uq_model_versions_component_version",
        ),
    )


class ModelInferenceRun(Base):
    __tablename__ = "model_inference_runs"

    id = Column(Integer, primary_key=True)

    consultation_record_id = Column(
        Integer,
        ForeignKey("consultation_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    model_version_id = Column(
        Integer,
        ForeignKey("model_versions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    stage = Column(String(60), nullable=False)
    output_summary = Column(JSON, nullable=True)

    confidence = Column(Float, nullable=True)
    latency_ms = Column(Float, nullable=True)

    abstained = Column(Boolean, nullable=False, default=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    __table_args__ = (
        CheckConstraint(
            "confidence IS NULL OR "
            "(confidence >= 0 AND confidence <= 1)",
            name="ck_model_inference_confidence_range",
        ),
        CheckConstraint(
            "latency_ms IS NULL OR "
            "(latency_ms >= 0 AND latency_ms < 'Infinity'::double precision)",
            name="ck_model_inference_latency_nonnegative_finite",
        ),
    )


class KnowledgeSource(Base):
    __tablename__ = "knowledge_sources"

    id = Column(Integer, primary_key=True)

    source_name = Column(String(255), nullable=False)
    publisher = Column(String(255), nullable=True)

    source_type = Column(String(60), nullable=False)
    source_uri = Column(Text, nullable=False)

    license_reference = Column(Text, nullable=True)

    language = Column(String(10), nullable=False)
    source_version = Column(String(100), nullable=True)

    verification_status = Column(
        String(30),
        nullable=False,
        default="pending",
    )

    source_sha256 = Column(String(64), nullable=True)

    retrieved_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    last_verified_at = Column(DateTime(timezone=True), nullable=True)

    is_active = Column(Boolean, nullable=False, default=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True)

    source_id = Column(
        Integer,
        ForeignKey("knowledge_sources.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    external_identifier = Column(String(255), nullable=True)

    title = Column(String(500), nullable=False)
    language = Column(String(10), nullable=False)
    version = Column(String(100), nullable=True)

    content_sha256 = Column(String(64), nullable=False)
    content_storage_key = Column(String(512), nullable=True)

    published_at = Column(DateTime(timezone=True), nullable=True)
    effective_at = Column(DateTime(timezone=True), nullable=True)
    superseded_at = Column(DateTime(timezone=True), nullable=True)

    ingestion_status = Column(
        String(30),
        nullable=False,
        default="pending",
    )

    retrieved_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "source_id",
            "external_identifier",
            "version",
            "language",
            name="uq_knowledge_document_source_version",
        ),
    )


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(Integer, primary_key=True)

    document_id = Column(
        Integer,
        ForeignKey("knowledge_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    chunk_index = Column(Integer, nullable=False)
    content_text = Column(Text, nullable=False)

    content_sha256 = Column(String(64), nullable=False)

    token_count = Column(Integer, nullable=True)
    metadata_json = Column(JSON, nullable=True)

    # Reference to an external vector record if semantic retrieval
    # is enabled later. This is not itself a vector embedding.
    embedding_reference = Column(String(255), nullable=True)
    embedding_model = Column(String(120), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "document_id",
            "chunk_index",
            name="uq_knowledge_chunk_position",
        ),
        CheckConstraint(
            "chunk_index >= 0",
            name="ck_knowledge_chunk_index",
        ),
    )


class MedicineCatalogue(Base):
    __tablename__ = "medicine_catalogue"

    id = Column(Integer, primary_key=True)

    external_source = Column(String(100), nullable=False)
    external_identifier = Column(String(255), nullable=False)

    generic_name = Column(String(500), nullable=True)
    normalized_generic_name = Column(String(500), nullable=True)

    brand_name = Column(String(500), nullable=True)
    manufacturer_name = Column(String(255), nullable=True)

    strength = Column(String(150), nullable=True)
    dosage_form = Column(String(120), nullable=True)

    ingredients = Column(JSON, nullable=True)

    # Retain registry provenance and original response when permitted.
    registry_payload = Column(JSON, nullable=True)

    source_updated_at = Column(DateTime(timezone=True), nullable=True)

    last_synced_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    is_active = Column(Boolean, nullable=False, default=True)

    __table_args__ = (
        UniqueConstraint(
            "external_source",
            "external_identifier",
            name="uq_medicine_catalogue_external_record",
        ),
        Index(
            "ix_medicine_catalogue_generic_name",
            "normalized_generic_name",
        ),
        Index(
            "ix_medicine_catalogue_brand_name",
            "brand_name",
        ),
    )
