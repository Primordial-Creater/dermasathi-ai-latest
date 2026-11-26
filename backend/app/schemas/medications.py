from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DrugInteractionRequest(BaseModel):
    medications: list[str] = Field(
        ..., min_length=1, max_length=30,
        description="Medication names, including strength or formulation when known.",
    )
    allergies: list[str] = Field(default_factory=list, max_length=30, description="Known medication or ingredient allergies")
    patient_conditions: list[str] = Field(default_factory=list, max_length=30, description="Relevant conditions, e.g. pregnancy, kidney or liver disease")
    language: str = Field(default="en", max_length=20)

    @field_validator("medications")
    @classmethod
    def validate_medications(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value if isinstance(item, str) and item.strip()]
        if not cleaned:
            raise ValueError("At least one non-empty medication name is required")
        return cleaned

    @field_validator("allergies", "patient_conditions")
    @classmethod
    def clean_optional_text_lists(cls, value: list[str]) -> list[str]:
        return [item.strip() for item in value if isinstance(item, str) and item.strip()]


class InteractionAlert(BaseModel):
    drugs_involved: list[str]
    severity: Literal["high", "moderate", "low"]
    clinical_effect: str
    recommendation: str


class DrugProfile(BaseModel):
    name: str
    category: str
    common_skin_uses: str
    general_safety_precautions: list[str]
    potential_side_effects: list[str]


class LocalizedDrugProfile(BaseModel):
    """Localized text for an already identified profile; identity is immutable."""
    name: str
    category: str
    common_skin_uses: str
    general_safety_precautions: list[str]
    potential_side_effects: list[str]


class MedicationAIEnhancement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    response_language: str = Field(min_length=1, max_length=80)
    plain_language_summary: str = Field(min_length=1, max_length=1600)
    localized_database_coverage_note: str = Field(min_length=1, max_length=1200)
    localized_clinical_disclaimer: str = Field(min_length=1, max_length=1200)
    localized_interaction_alerts: list[InteractionAlert] = Field(max_length=20)
    localized_allergy_warnings: list[str] = Field(max_length=30)
    localized_condition_precautions: list[str] = Field(max_length=30)
    localized_identified_drugs: list[LocalizedDrugProfile] = Field(max_length=30)
    unrecognized_medicine_explanations: list[str] = Field(max_length=30)
    additional_precautions: list[str] = Field(max_length=10)
    follow_up_questions: list[str] = Field(max_length=8)
    uncertainty_note: str = Field(min_length=1, max_length=1200)


class DrugSafetyResponse(BaseModel):
    record_id: int | None = None
    # None means that the limited rules did not establish combination safety.
    # False means a known rule or warning requires the combination not to be
    # treated as safe. This API intentionally never returns True.
    safe_to_combine: bool | None = None
    safety_status: Literal[
        "known_interaction_alert",
        "warning_detected",
        "not_established_by_limited_rules",
    ] = "not_established_by_limited_rules"
    review_required: bool = True
    database_coverage_note: str = (
        "The built-in medication rules cover only a small subset of medicines. "
        "No detected interaction does not mean that a combination is safe. "
        "Confirm all medicines, doses and allergies with a pharmacist or prescriber."
    )
    matched_medications: list[str] = Field(default_factory=list)
    unrecognized_medications: list[str] = Field(default_factory=list)
    allergy_review_required: bool = False
    interaction_alerts: list[InteractionAlert] = Field(default_factory=list)
    allergy_warnings: list[str] = Field(default_factory=list)
    condition_precautions: list[str] = Field(default_factory=list)
    identified_drugs: list[DrugProfile] = Field(default_factory=list)
    clinical_disclaimer: str = (
        "Medication information is educational only and is not a prescribing or dispensing decision. "
        "Do not start, stop, combine or change a medicine without advice from a qualified clinician or pharmacist."
    )
    requested_language: str = "English"
    response_language: str = "English"
    ai_enhancement_status: Literal["completed", "unavailable", "fallback_english"] = "unavailable"
    plain_language_summary: str | None = None
    unrecognized_medicine_explanations: list[str] = Field(default_factory=list)
    additional_precautions: list[str] = Field(default_factory=list)
    follow_up_questions: list[str] = Field(default_factory=list)
    uncertainty_note: str | None = None
    analysis_provider: str | None = None
    analysis_model: str | None = None
    fallback_used: bool = False
