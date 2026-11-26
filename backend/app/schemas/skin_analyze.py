"""
DermaSathiAI — Skin Analysis API Schemas (Dual-Model)
======================================================
Pydantic v2 request / response schemas for:
  POST /api/v1/skin/analyze

Design notes:
- No internal file paths or model filenames are exposed.
- ``requires_professional_review`` is always True — this is hard-coded
  at the API layer and cannot be overridden.
- The medical disclaimer is injected by the schema default (not by the
  service layer) so it is consistent regardless of the prediction path.
- Numeric values are capped to 4 decimal places at the service layer;
  schemas accept any valid float.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


DISCLAIMER = (
    "This is an AI-assisted assessment tool for informational purposes only. "
    "It is NOT a medical diagnosis. Always consult a qualified healthcare "
    "professional for medical advice, diagnosis, and treatment."
)


class SkinAnalyzeTopPrediction(BaseModel):
    """One entry in the ranked top-K prediction list."""
    class_name: str = Field(description="Predicted class name.")
    class_index: int = Field(description="Model output index for this class.")
    raw_probability: float = Field(
        ge=0.0, le=1.0,
        description="Raw softmax probability (before temperature calibration).",
    )
    calibrated_probability: float = Field(
        ge=0.0, le=1.0,
        description="Temperature-scaled calibrated probability.",
    )


class SkinAnalyzeQualityInfo(BaseModel):
    """Image quality assessment result (included in every response)."""
    quality_status: str = Field(description="usable | poor_quality | rejected | corrupt")
    quality_score: float = Field(ge=0.0, le=1.0)
    issues: list[str] = Field(default_factory=list)
    user_action: Optional[str] = None


class SkinAnalyzeResponse(BaseModel):
    """
    Response from POST /api/v1/skin/analyze.

    ``status`` values
    -----------------
    assessment_available    — confident prediction made
    assessment_unavailable  — abstained; confidence / uncertainty too low
    unsupported_condition   — V2 flagged image as out-of-distribution
    image_rejected          — quality gate or decode failure
    model_unavailable       — models not loaded (server misconfiguration)
    """
    status: str = Field(description="Overall analysis status.")

    # Primary prediction (present when status == assessment_available or
    # assessment_unavailable with partial data)
    predicted_class: Optional[str] = Field(
        None,
        description="Top predicted disease class (V1 classifier).",
    )
    top_predictions: list[SkinAnalyzeTopPrediction] = Field(
        default_factory=list,
        description="Top-K ranked predictions from V1 classifier.",
    )
    raw_probability: Optional[float] = Field(
        None,
        description="Raw softmax probability of the top prediction.",
    )
    calibrated_confidence: Optional[float] = Field(
        None,
        description="Temperature-calibrated confidence of the top prediction.",
    )
    uncertainty: Optional[float] = Field(
        None,
        description="Normalised predictive entropy (0=certain, 1=maximally uncertain).",
    )
    is_high_risk: bool = Field(
        False,
        description=(
            "True if the predicted class belongs to the high-risk group "
            "(Basal cell carcinoma, Melanoma, Squamous cell carcinoma)."
        ),
    )

    # Diagnostic / UX fields
    reason: Optional[str] = Field(
        None,
        description="Human-readable explanation of why the prediction was abstained or unavailable.",
    )
    quality: Optional[SkinAnalyzeQualityInfo] = Field(
        None,
        description="Image quality assessment details.",
    )
    processing_time_ms: Optional[float] = Field(
        None,
        description="End-to-end pipeline latency in milliseconds.",
    )

    # Always-present safety fields
    requires_professional_review: bool = Field(
        True,
        description="Always True. This tool does not replace medical evaluation.",
    )
    disclaimer: str = Field(
        DISCLAIMER,
        description="Medical disclaimer text.",
    )


class SkinAnalyzeErrorResponse(BaseModel):
    """Error response for 4xx / 5xx HTTP codes."""
    status: str = "error"
    detail: str
    requires_professional_review: bool = True
