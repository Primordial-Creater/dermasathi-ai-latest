from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.schemas.medications import (
    DrugInteractionRequest,
    DrugSafetyResponse,
)
from app.services.ai_provider_manager import AIProvidersUnavailable
from app.services.medication_ai_service import MedicationAIService
from app.services.medication_service import MedicationService


def test_unknown_combination_is_not_declared_safe():
    request = DrugInteractionRequest(medications=["unknown medicine A", "unknown medicine B"])
    result = MedicationService.check_safety(request)

    assert result.safe_to_combine is None
    assert result.safety_status == "not_established_by_limited_rules"
    assert result.review_required is True
    assert result.unrecognized_medications == ["unknown medicine A", "unknown medicine B"]


def test_known_isotretinoin_doxycycline_pair_is_flagged():
    request = DrugInteractionRequest(medications=["Isotretinoin 20 mg", "Doxycycline 100mg"])
    result = MedicationService.check_safety(request)

    assert result.safe_to_combine is False
    assert result.safety_status == "known_interaction_alert"
    assert len(result.interaction_alerts) == 1
    assert result.interaction_alerts[0].severity == "high"


def test_tretinoin_benzoyl_peroxide_pair_is_recognized_without_false_unknown():
    request = DrugInteractionRequest(medications=["tretinoin 0.025%", "benzoyl peroxide 2.5%"])
    result = MedicationService.check_safety(request)

    assert result.safety_status == "known_interaction_alert"
    assert result.unrecognized_medications == []
    assert len(result.interaction_alerts) == 1


def test_pregnancy_retinoid_precaution_is_preserved():
    request = DrugInteractionRequest(
        medications=["isotretinoin"],
        patient_conditions=["pregnancy"],
    )
    result = MedicationService.check_safety(request)

    assert result.safety_status == "warning_detected"
    assert result.safe_to_combine is False
    assert len(result.condition_precautions) == 1


def _valid_payload(baseline: DrugSafetyResponse, language: str = "Hindi") -> dict:
    return {
        "response_language": language,
        "plain_language_summary": "स्थानीय नियमों के आधार पर दवाओं की जानकारी दी गई है।",
        "localized_database_coverage_note": "यह सूची सीमित है और पूरी जानकारी नहीं देती।",
        "localized_clinical_disclaimer": "यह जानकारी चिकित्सकीय सलाह का विकल्प नहीं है।",
        "localized_interaction_alerts": [item.model_dump() for item in baseline.interaction_alerts],
        "localized_allergy_warnings": list(baseline.allergy_warnings),
        "localized_condition_precautions": list(baseline.condition_precautions),
        "localized_identified_drugs": [item.model_dump() for item in baseline.identified_drugs],
        "unrecognized_medicine_explanations": ["इस दवा की पहचान उपलब्ध सीमित सूची में नहीं हुई।" for _ in baseline.unrecognized_medications],
        "additional_precautions": ["दवा की पुष्टि फार्मासिस्ट से करें।"],
        "follow_up_questions": ["दवा की सही मात्रा और रूप क्या है?"],
        "uncertainty_note": "यह सीमित जाँच पूर्ण दवा-सुरक्षा समीक्षा नहीं है।",
    }


@pytest.mark.asyncio
async def test_ai_localization_preserves_deterministic_alert_and_severity(monkeypatch):
    request = DrugInteractionRequest(
        medications=["isotretinoin", "doxycycline"],
        language="hi",
    )
    baseline = MedicationService.check_safety(request)
    payload = _valid_payload(baseline)

    class FakeManager:
        async def generate(self, *args, **kwargs):
            kwargs["json_validator"](payload)
            return SimpleNamespace(
                data=payload,
                provider="gemini",
                model="gemini-4-hydrogen",
                fallback_used=False,
            )

    monkeypatch.setattr("app.services.medication_ai_service.ai_provider_manager", FakeManager())
    result = await MedicationAIService.enrich(request, baseline)

    assert result.ai_enhancement_status == "completed"
    assert result.response_language == "Hindi"
    assert result.safety_status == baseline.safety_status
    assert result.safe_to_combine is False
    assert result.interaction_alerts[0].severity == "high"
    assert result.analysis_provider == "gemini"


@pytest.mark.asyncio
async def test_ai_cannot_invent_interaction_alert(monkeypatch):
    request = DrugInteractionRequest(medications=["unknown X", "unknown Y"], language="en")
    baseline = MedicationService.check_safety(request)
    payload = _valid_payload(baseline)
    payload["localized_interaction_alerts"] = [
        {"drugs_involved": ["unknown X", "unknown Y"], "severity": "high", "clinical_effect": "Invented", "recommendation": "Invented"}
    ]

    class FakeManager:
        async def generate(self, *args, **kwargs):
            kwargs["json_validator"](payload)
            return SimpleNamespace(data=payload, provider="gemini", model="x", fallback_used=False)

    monkeypatch.setattr("app.services.medication_ai_service.ai_provider_manager", FakeManager())
    result = await MedicationAIService.enrich(request, baseline)

    assert result.interaction_alerts == []
    assert result.safety_status == "not_established_by_limited_rules"
    assert result.ai_enhancement_status == "unavailable"


@pytest.mark.asyncio
async def test_provider_failure_retains_deterministic_warning(monkeypatch):
    request = DrugInteractionRequest(
        medications=["isotretinoin"],
        patient_conditions=["pregnancy"],
        language="mr",
    )
    baseline = MedicationService.check_safety(request)

    class FakeManager:
        async def generate(self, *args, **kwargs):
            raise AIProvidersUnavailable(["gemini:http_503", "groq:http_429"])

    monkeypatch.setattr("app.services.medication_ai_service.ai_provider_manager", FakeManager())
    result = await MedicationAIService.enrich(request, baseline)

    assert result.safety_status == "warning_detected"
    assert result.condition_precautions == baseline.condition_precautions
    assert result.ai_enhancement_status == "fallback_english"
    assert result.response_language == "English"


def test_response_never_claims_safe_when_no_local_rule_matches():
    response = MedicationService.check_safety(
        DrugInteractionRequest(medications=["paracetamol", "cetirizine"])
    )
    payload = response.model_dump()

    assert payload["safe_to_combine"] is None
    assert payload["review_required"] is True
    assert "does not mean" in payload["database_coverage_note"]


def test_blank_medication_name_is_rejected():
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        DrugInteractionRequest(medications=["  ", ""])


def test_reported_allergy_always_requires_review_even_without_exact_match():
    result = MedicationService.check_safety(
        DrugInteractionRequest(medications=["unknown medicine"], allergies=["penicillin"])
    )

    assert result.allergy_review_required is True
    assert result.review_required is True
    assert result.safe_to_combine is None


@pytest.mark.asyncio
async def test_ai_response_in_wrong_language_is_rejected(monkeypatch):
    request = DrugInteractionRequest(medications=["isotretinoin"], language="hi")
    baseline = MedicationService.check_safety(request)
    payload = _valid_payload(baseline, language="English")

    class FakeManager:
        async def generate(self, *args, **kwargs):
            kwargs["json_validator"](payload)
            return SimpleNamespace(data=payload, provider="gemini", model="x", fallback_used=False)

    monkeypatch.setattr("app.services.medication_ai_service.ai_provider_manager", FakeManager())
    result = await MedicationAIService.enrich(request, baseline)

    assert result.ai_enhancement_status == "fallback_english"
    assert result.response_language == "English"
