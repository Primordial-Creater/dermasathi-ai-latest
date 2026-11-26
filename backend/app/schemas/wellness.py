from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.services.language_service import resolve_language


class WellnessGuidanceRequest(BaseModel):
    skin_concern: str = Field(..., min_length=1, max_length=500, description="User-described skin or wellness concern")
    season: str | None = Field(default="autumn", max_length=30)
    dosha_predominance: str | None = Field(default=None, max_length=40)
    dietary_preference: str | None = Field(default="vegetarian", max_length=40)
    language: str = Field(default="en", max_length=20)
    reported_symptoms: list[str] = Field(default_factory=list, max_length=20)
    current_medications: list[str] = Field(default_factory=list, max_length=30)
    known_allergies: list[str] = Field(default_factory=list, max_length=30)
    relevant_conditions: list[str] = Field(default_factory=list, max_length=30)

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        code, _ = resolve_language(value)
        return code

    @field_validator("reported_symptoms", "current_medications", "known_allergies", "relevant_conditions")
    @classmethod
    def clean_lists(cls, value: list[str]) -> list[str]:
        return [item.strip()[:300] for item in value if isinstance(item, str) and item.strip()]


class HerbGuidance(BaseModel):
    herb_name: str
    sanskrit_name: str
    skin_benefits: str
    usage_guidance: str
    safety_precautions: str


class WellnessAIHerb(BaseModel):
    model_config = ConfigDict(extra="forbid")

    herb_name: str = Field(min_length=1, max_length=100)
    sanskrit_name: str = Field(default="Not supplied", max_length=160)
    skin_benefits: str = Field(min_length=1, max_length=900)
    usage_guidance: str = Field(min_length=1, max_length=900)
    safety_precautions: str = Field(min_length=1, max_length=1000)


class WellnessAIEnhancement(BaseModel):
    """Question-specific response; no forced repetition of generic baseline lists."""

    model_config = ConfigDict(extra="forbid")

    response_language: str = Field(min_length=1, max_length=80)
    direct_answer: str = Field(min_length=1, max_length=3000)
    ayurvedic_perspective: str = Field(default="", max_length=1800)
    relevant_wellness_guidance: list[str] = Field(default_factory=list, max_length=10)
    dietary_recommendations: list[str] = Field(default_factory=list, max_length=8)
    lifestyle_practices: list[str] = Field(default_factory=list, max_length=8)
    traditional_topical_care: list[WellnessAIHerb] = Field(default_factory=list, max_length=5)
    safety_precautions: list[str] = Field(default_factory=list, max_length=10)
    follow_up_questions: list[str] = Field(default_factory=list, max_length=6)
    evidence_note: str = Field(min_length=1, max_length=1200)
    medical_safety_note: str = Field(min_length=1, max_length=1200)


class LifestyleGuidanceResponse(BaseModel):
    record_id: int | None = None
    direct_answer: str | None = None
    concern_analysis: str
    ayurvedic_perspective: str
    dietary_recommendations: list[str]
    lifestyle_practices: list[str]
    traditional_topical_care: list[HerbGuidance]
    evidence_based_prevention: list[str]
    cautionary_note: str = (
        "Ayurvedic and traditional wellness suggestions are supportive information, not diagnosis or treatment. "
        "They do not replace evaluation or treatment by a qualified healthcare professional."
    )
    requested_language: str = "English"
    response_language: str = "English"
    ai_enhancement_status: str = "unavailable"
    additional_wellness_guidance: list[str] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)
    evidence_note: str | None = None
    medical_safety_note: str | None = None
    analysis_provider: str | None = None
    analysis_model: str | None = None
    fallback_used: bool = False
