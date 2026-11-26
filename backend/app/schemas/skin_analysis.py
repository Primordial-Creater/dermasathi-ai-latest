"""Backward-compatible and extended response schemas for AI skin assessment."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field


ConfidenceLevel = Literal["low", "moderate", "high", "insufficient"]


class ImageQualityMetrics(BaseModel):
    # Existing computer-vision quality-gate fields.
    is_acceptable: bool = False
    blur_score: float = 0.0
    is_blurry: bool = False
    brightness_score: float = 0.0
    is_underexposed: bool = False
    is_overexposed: bool = False
    resolution: list[int] = Field(default_factory=list)
    feedback_messages: list[str] = Field(default_factory=list)

    # Stable normalized fields for newer clients.
    status: str = "not_assessed"
    score: Optional[float] = None
    issues: list[str] = Field(default_factory=list)
    user_action: Optional[str] = None


class CandidateFinding(BaseModel):
    category_name: str
    # Deliberately nullable: an LLM's self-estimate is not a calibrated probability.
    calibrated_probability: Optional[float] = None
    confidence_level: ConfidenceLevel = "insufficient"
    general_information: str = ""
    typical_clinical_features: list[str] = Field(default_factory=list)


class ReferralRecommendation(BaseModel):
    urgency: Literal["routine", "prompt_consult", "emergency"] = "routine"
    recommended_timeframe: str = "Seek professional evaluation if the finding persists or worsens."
    recommended_specialist: str = "Qualified dermatologist or medical practitioner"
    actionable_instructions: list[str] = Field(default_factory=list)
    red_flags_present: list[str] = Field(default_factory=list)


class SkinAnalysisTopPrediction(BaseModel):
    class_name: str
    class_index: int = 0
    raw_probability: Optional[float] = None
    calibrated_probability: Optional[float] = None


class SkinAIImageQuality(BaseModel):
    suitable: bool = True
    lighting: Literal["good", "acceptable", "poor", "unknown"] = "unknown"
    focus: Literal["clear", "mild_blur", "severe_blur", "unknown"] = "unknown"
    framing: Literal["good", "acceptable", "poor", "unknown"] = "unknown"
    comments: list[str] = Field(default_factory=list)


class SkinAIAppearanceAssessment(BaseModel):
    classification: Literal[
        "normal_appearing", "dryness_features", "oily_features",
        "irritation_features", "pigmentation_features", "lesion_present", "uncertain"
    ] = "uncertain"
    body_area: str = "Not identifiable from the image"
    visible_features: list[str] = Field(default_factory=list)
    description: str = ""


class SkinAIConditionCandidate(BaseModel):
    condition_name: str
    confidence_level: ConfidenceLevel = "insufficient"
    rationale: str = ""
    supporting_observations: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    distinguishing_questions: list[str] = Field(default_factory=list)


class SkinAIPrediction(BaseModel):
    label: str = "uncertain_dermatologic_finding"
    display_label: str = "Uncertain finding"
    scope: Literal["local_14", "other_dermatologic", "normal_appearing", "uncertain"] = "uncertain"
    confidence_level: ConfidenceLevel = "insufficient"
    rationale: str = "The image does not support a reliable assessment."


class SkinMedicineInformation(BaseModel):
    medicine_or_category: str
    purpose: str = ""
    common_safety_considerations: list[str] = Field(default_factory=list)
    interaction_cautions: list[str] = Field(default_factory=list)
    verification_required: bool = True
    prescription_or_dosage_provided: bool = False


class SkinLifestyleRecommendation(BaseModel):
    area: str
    recommendation: str
    frequency: str = "As appropriate"
    cautions: list[str] = Field(default_factory=list)


class SkinDietRecommendation(BaseModel):
    recommendation: str
    rationale: str = ""
    cautions: list[str] = Field(default_factory=list)


class SkinAyurvedaInformation(BaseModel):
    topic: str
    traditional_context: str = ""
    supportive_wellness_information: str = ""
    evidence_level: Literal["traditional_educational", "limited_evidence", "not_established"] = "traditional_educational"
    safety_notes: list[str] = Field(default_factory=list)


class SkinAyurvedaRoutineStep(BaseModel):
    step: str
    timing: str = ""
    purpose: str = ""
    safety_boundary: str = ""


class SkinCareGuidance(BaseModel):
    medical_next_steps: list[str] = Field(default_factory=list)
    medicine_information: list[SkinMedicineInformation] = Field(default_factory=list)
    medicine_disclaimer: str = (
        "This is medicine education, not a prescription. Confirm medicines and suitability "
        "with a qualified clinician or pharmacist."
    )
    lifestyle_plan: list[SkinLifestyleRecommendation] = Field(default_factory=list)
    dietary_guidance: list[SkinDietRecommendation] = Field(default_factory=list)
    monitoring_timeline: list[str] = Field(default_factory=list)
    ayurveda_information: list[SkinAyurvedaInformation] = Field(default_factory=list)
    ayurveda_routine: list[SkinAyurvedaRoutineStep] = Field(default_factory=list)
    ayurveda_safety_notes: list[str] = Field(default_factory=list)
    ayurveda_evidence_level: Literal["traditional_educational", "limited_evidence", "not_established"] = "traditional_educational"
    nearby_care_search_required: bool = True
    care_disclaimer: str = "Supportive information only; it does not replace medical assessment."


class SkinAIAnalysisPayload(BaseModel):
    response_language: str = "English"
    status: Literal["supported", "needs_better_image", "abstain"] = "abstain"
    message: str = "The image could not be assessed reliably."
    image_quality: SkinAIImageQuality = Field(default_factory=SkinAIImageQuality)
    appearance_assessment: SkinAIAppearanceAssessment = Field(default_factory=SkinAIAppearanceAssessment)
    prediction: SkinAIPrediction = Field(default_factory=SkinAIPrediction)
    alternatives: list[SkinAIConditionCandidate] = Field(default_factory=list)
    # Expanded reasoning: distinguish observed morphology from information that
    # would require history, examination, testing, or clinician review.
    differential_comparison: list[str] = Field(default_factory=list)
    what_image_cannot_establish: list[str] = Field(default_factory=list)
    clinical_questions_to_distinguish: list[str] = Field(default_factory=list)
    visible_observations: list[str] = Field(default_factory=list)
    affected_area: str = "Not identifiable from the image"
    possible_triggers_to_discuss: list[str] = Field(default_factory=list)
    reported_symptoms_summary: str = "No symptom history was supplied with this image."
    follow_up_questions: list[str] = Field(default_factory=list)
    red_flags: list[str] = Field(default_factory=list)
    risk_level: Literal["low", "moderate", "high", "unknown"] = "unknown"
    referral_required: bool = True
    recommended_specialist: str = "Qualified dermatologist or medical practitioner"
    referral_timeframe: str = "Seek professional review if the finding persists, changes, or worsens."
    next_action: list[str] = Field(default_factory=list)
    care: SkinCareGuidance = Field(default_factory=SkinCareGuidance)
    doctor_summary: str = ""
    diagnosis_confirmed: Literal[False] = False
    professional_evaluation_required: Literal[True] = True
    disclaimer: str = (
        "AI-assisted educational assessment only. This is not a confirmed diagnosis "
        "and must not replace an in-person clinical evaluation."
    )


class SkinAnalysisResponse(BaseModel):
    """Superset response preserving legacy fields and adding structured assessment."""

    record_id: Optional[int] = None
    analysis_provider: Optional[str] = None
    analysis_model: Optional[str] = None
    fallback_used: bool = False
    provider_latency_ms: Optional[int] = None
    status: str = "ABSTAINED"
    model_name: Optional[str] = None
    model_version: Optional[str] = None
    prediction: Optional[str] = None
    predicted_class: Optional[str] = None
    top_predictions: list[SkinAnalysisTopPrediction] = Field(default_factory=list)
    raw_probability: Optional[float] = None
    calibrated_confidence: Optional[float] = None
    uncertainty: Optional[float] = None
    is_high_risk: bool = False
    quality: Optional[ImageQualityMetrics] = None
    quality_gate: ImageQualityMetrics = Field(default_factory=ImageQualityMetrics)
    findings: list[CandidateFinding] = Field(default_factory=list)
    uncertainty_score: Optional[float] = None
    abstained: bool = True
    abstention_reason: Optional[str] = None
    reason: Optional[str] = None
    referral: ReferralRecommendation = Field(default_factory=ReferralRecommendation)
    assessment: Optional[SkinAIAnalysisPayload] = None
    care: Optional[SkinCareGuidance] = None
    clinical_disclaimer: str = (
        "DERMASATHIAI provides informational AI assistance, not a formal diagnosis or prescription. "
        "Always consult a qualified healthcare professional."
    )
    requires_professional_review: bool = True
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    processing_time_ms: Optional[float] = None


class SkinAnalysisErrorResponse(BaseModel):
    status: str = "error"
    detail: str
    requires_professional_review: bool = True
