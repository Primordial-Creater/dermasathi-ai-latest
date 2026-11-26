from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SymptomCheckRequest(BaseModel):
    symptoms: list[str] = Field(
        ...,
        min_length=1,
        max_length=30,
        description="User-reported symptoms, such as itching, redness, flaking or burning.",
    )
    duration_days: int | None = Field(None, ge=0, le=36500, description="Duration in days")
    affected_body_locations: list[str] = Field(
        default_factory=list,
        max_length=20,
        description="Locations such as scalp, face, arms, torso or legs.",
    )
    severity: str = Field(default="moderate", max_length=30)
    has_fever: bool = False
    has_rapid_spread: bool = False
    has_pain_or_bleeding: bool = False
    language: str = Field(default="en", max_length=20)


class SymptomDifferential(BaseModel):
    condition_name: str = Field(min_length=1, max_length=160)
    educational_summary: str = Field(min_length=1, max_length=800)
    relevance_level: str = Field(min_length=1, max_length=30)
    relevance_label: str | None = Field(default=None, max_length=100)
    common_triggers: list[str] = Field(default_factory=list, max_length=12)


class SymptomDifferentialExplanation(BaseModel):
    condition_name: str = Field(min_length=1, max_length=160)
    explanation: str = Field(min_length=1, max_length=1000)
    why_it_may_fit: list[str] = Field(default_factory=list, max_length=5)
    what_is_not_established: list[str] = Field(default_factory=list, max_length=5)


class SymptomAISuggestion(BaseModel):
    condition_name: str = Field(min_length=1, max_length=160)
    why_it_may_fit: list[str] = Field(default_factory=list, max_length=5)
    what_is_not_established: list[str] = Field(default_factory=list, max_length=5)
    questions_to_distinguish: list[str] = Field(default_factory=list, max_length=5)


class SymptomAIEnhancement(BaseModel):
    """Strict provider payload. It may explain/localize, never change triage."""

    model_config = ConfigDict(extra="forbid")

    triage_label: str = Field(min_length=1, max_length=100)
    triage_explanation: str = Field(min_length=1, max_length=1000)
    localized_differentials: list[SymptomDifferential] = Field(min_length=1, max_length=8)
    localized_red_flags: list[str] = Field(max_length=12)
    localized_self_care_precautions: list[str] = Field(min_length=1, max_length=12)
    localized_referral_guidance: str = Field(min_length=1, max_length=1000)
    localized_disclaimer: str = Field(min_length=1, max_length=1000)
    plain_language_summary: str = Field(min_length=1, max_length=1600)
    differential_explanations: list[SymptomDifferentialExplanation] = Field(min_length=1, max_length=8)
    follow_up_questions: list[str] = Field(default_factory=list, max_length=8)
    additional_self_care: list[str] = Field(default_factory=list, max_length=8)
    lifestyle_guidance: list[str] = Field(default_factory=list, max_length=8)
    uncertainty_note: str = Field(min_length=1, max_length=1000)
    ai_suggested_differentials: list[SymptomAISuggestion] = Field(default_factory=list, max_length=3)


class SymptomCheckResponse(BaseModel):
    record_id: int | None = None
    triage_level: Literal["emergency", "prompt_consult", "routine"]
    differentials: list[SymptomDifferential]
    red_flags: list[str]
    self_care_precautions: list[str]
    referral_guidance: str
    disclaimer: str = (
        "This symptom assessment is educational and does not constitute a medical diagnosis. "
        "Seek immediate medical attention if you experience severe pain, difficulty breathing, or rapid worsening."
    )

    # AI-enhanced, localized explanation fields. Defaults preserve compatibility
    # for existing clients and deterministic-only responses.
    requested_language: str = "en"
    response_language: str = "English"
    analysis_provider: str | None = None
    analysis_model: str | None = None
    fallback_used: bool = False
    ai_enhancement_status: Literal[
        "completed", "unavailable", "fallback_english", "emergency_fast_path"
    ] = "unavailable"
    triage_label: str | None = None
    triage_explanation: str | None = None
    plain_language_summary: str | None = None
    differential_explanations: list[SymptomDifferentialExplanation] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)
    additional_self_care: list[str] = Field(default_factory=list)
    lifestyle_guidance: list[str] = Field(default_factory=list)
    uncertainty_note: str | None = None
    ai_suggested_differentials: list[SymptomAISuggestion] = Field(default_factory=list)
