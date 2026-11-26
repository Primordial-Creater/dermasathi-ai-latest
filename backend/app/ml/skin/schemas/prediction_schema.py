"""
DermaSathiAI — ML Prediction Schemas
=====================================
Pydantic schemas for ML pipeline input/output.
These are internal ML schemas, separate from API schemas.
"""

from __future__ import annotations

import enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class QualityStatus(str, enum.Enum):
    """Image quality assessment result."""
    USABLE = "usable"
    POOR_QUALITY = "poor_quality"
    CORRUPT = "corrupt"
    DUPLICATE = "duplicate"
    REVIEW_REQUIRED = "review_required"
    REJECTED = "rejected"


class PredictionStatus(str, enum.Enum):
    """Overall prediction decision status."""
    ASSESSMENT_AVAILABLE = "assessment_available"
    ASSESSMENT_UNAVAILABLE = "assessment_unavailable"
    IMAGE_REJECTED = "image_rejected"
    MODEL_UNAVAILABLE = "model_unavailable"


class QualityIssue(str, enum.Enum):
    """Individual quality issue types."""
    BLUR = "blur"
    UNDEREXPOSED = "underexposed"
    OVEREXPOSED = "overexposed"
    LOW_RESOLUTION = "low_resolution"
    HIGH_RESOLUTION = "high_resolution"
    LOW_CONTRAST = "low_contrast"
    INVALID_FORMAT = "invalid_format"
    CORRUPT_FILE = "corrupt_file"
    FILE_TOO_SMALL = "file_too_small"
    FILE_TOO_LARGE = "file_too_large"
    EXTREME_ASPECT_RATIO = "extreme_aspect_ratio"


class ImageQualityResult(BaseModel):
    """Result from ImageQualityGate."""
    quality_status: QualityStatus
    quality_score: float = Field(ge=0.0, le=1.0)
    issues: list[QualityIssue] = Field(default_factory=list)
    details: dict[str, Any] = Field(default_factory=dict)
    user_action: Optional[str] = None

    model_config = ConfigDict(use_enum_values=True)


class ClassPrediction(BaseModel):
    """A single class prediction with probability."""
    class_name: str
    class_index: int
    raw_probability: float = Field(ge=0.0, le=1.0)


class PredictionResult(BaseModel):
    """Complete prediction result from the inference pipeline."""
    status: PredictionStatus
    model_name: Optional[str] = None
    model_version: Optional[str] = None
    prediction: Optional[str] = None
    top_predictions: list[ClassPrediction] = Field(default_factory=list)
    raw_probability: Optional[float] = None
    calibrated_confidence: Optional[float] = None
    uncertainty: Optional[float] = None
    requires_professional_review: bool = True
    reason: Optional[str] = None
    quality_result: Optional[ImageQualityResult] = None
    processing_time_ms: Optional[float] = None

    model_config = ConfigDict(use_enum_values=True)


class DatasetAuditRecord(BaseModel):
    """Single image audit record."""
    image_id: str
    file_path: str
    source_dataset: Optional[str] = None
    original_label: Optional[str] = None
    canonical_label: Optional[str] = None
    quality_status: QualityStatus = QualityStatus.REVIEW_REQUIRED
    issues: list[str] = Field(default_factory=list)
    width: Optional[int] = None
    height: Optional[int] = None
    file_size_bytes: Optional[int] = None
    image_hash: Optional[str] = None
    is_duplicate: bool = False
    duplicate_of: Optional[str] = None

    model_config = ConfigDict(use_enum_values=True)


class DatasetManifestEntry(BaseModel):
    """Canonical dataset manifest entry."""
    image_id: str
    source_dataset: Optional[str] = None
    source_image_id: Optional[str] = None
    original_label: Optional[str] = None
    canonical_label: Optional[str] = None
    patient_id: Optional[str] = None
    body_site: Optional[str] = None
    acquisition_type: Optional[str] = None
    diagnosis_method: Optional[str] = None
    annotation_method: Optional[str] = None
    license: Optional[str] = None
    image_hash: Optional[str] = None
    quality_status: Optional[str] = None
    split: Optional[str] = None  # train / val / test
    file_path: Optional[str] = None

    model_config = ConfigDict(use_enum_values=True)


class ExperimentMetadata(BaseModel):
    """Metadata for a training experiment."""
    experiment_id: str
    timestamp: str
    model_name: str
    dataset_version: Optional[str] = None
    class_mapping: dict[str, int] = Field(default_factory=dict)
    image_size: int = 224
    augmentation_config: dict[str, Any] = Field(default_factory=dict)
    optimizer: str = "adam"
    learning_rate: float = 0.001
    finetune_learning_rate: float = 0.00001
    batch_size: int = 32
    epochs_head: int = 10
    epochs_finetune: int = 20
    seed: int = 42
    notes: Optional[str] = None
