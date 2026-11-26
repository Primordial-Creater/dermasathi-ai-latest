from __future__ import annotations

import pytest

from app.schemas.symptoms import SymptomCheckRequest
from app.services.ai_provider_manager import AIProvidersUnavailable, AIResult
from app.services.symptom_ai_service import SymptomAIService
from app.services.symptom_service import SymptomService


def _valid_payload(baseline):
    localized_differentials = []
    differential_explanations = []
    for item in baseline.differentials:
        localized_differentials.append(
            {
                "condition_name": item.condition_name,
                "educational_summary": item.educational_summary,
                "relevance_level": item.relevance_level,
                "relevance_label": "सामान्य प्रासंगिकता",
                "common_triggers": list(item.common_triggers),
            }
        )
        differential_explanations.append(
            {
                "condition_name": item.condition_name,
                "explanation": "This is one educational possibility, not a confirmed diagnosis.",
                "why_it_may_fit": ["Some reported features may be compatible."],
                "what_is_not_established": ["An examination is needed to confirm the cause."],
            }
        )

    return {
        "triage_label": "Routine review",
        "triage_explanation": "The current deterministic assessment indicates routine follow-up.",
        "localized_differentials": localized_differentials,
        "localized_red_flags": list(baseline.red_flags),
        "localized_self_care_precautions": list(baseline.self_care_precautions),
        "localized_referral_guidance": baseline.referral_guidance,
        "localized_disclaimer": baseline.disclaimer,
        "plain_language_summary": "The reported symptoms can have several explanations.",
        "differential_explanations": differential_explanations,
        "follow_up_questions": ["When did the symptoms first appear?"],
        "additional_self_care": ["Avoid suspected irritants."],
        "lifestyle_guidance": ["Keep the affected area gently clean and dry."],
        "uncertainty_note": "A clinician may need a history and physical examination.",
    }


@pytest.mark.asyncio
async def test_successful_ai_enrichment_uses_selected_language_and_preserves_triage(monkeypatch):
    request = SymptomCheckRequest(
        symptoms=["itching", "redness"],
        duration_days=4,
        affected_body_locations=["arms"],
        severity="moderate",
        language="hi",
    )
    baseline = SymptomService.evaluate(request)
    payload = _valid_payload(baseline)
    payload["triage_label"] = "नियमित परामर्श"
    payload["triage_explanation"] = "मौजूदा मूल्यांकन के अनुसार नियमित चिकित्सकीय परामर्श उचित है।"
    payload["plain_language_summary"] = "दर्ज लक्षणों के कई संभावित कारण हो सकते हैं।"
    payload["localized_referral_guidance"] = "नियमित परामर्श के लिए डॉक्टर से मिलें।"
    payload["localized_disclaimer"] = "यह जानकारी निदान का विकल्प नहीं है।"
    payload["uncertainty_note"] = "कारण की पुष्टि के लिए चिकित्सकीय जांच आवश्यक हो सकती है।"

    async def fake_generate(prompt, **kwargs):
        assert kwargs["feature"] == "symptom_assessment"
        assert kwargs["json_mode"] is True
        kwargs["json_validator"](payload)
        return AIResult("{}", payload, "gemini", "gemini-4-hydrogen", False, None, 10)

    monkeypatch.setattr(
        "app.services.symptom_ai_service.ai_provider_manager.generate",
        fake_generate,
    )

    result = await SymptomAIService.enrich(request, baseline)

    assert result.ai_enhancement_status == "completed"
    assert result.requested_language == "Hindi"
    assert result.response_language == "Hindi"
    assert result.triage_level == baseline.triage_level
    assert result.red_flags == baseline.red_flags
    assert result.plain_language_summary == "दर्ज लक्षणों के कई संभावित कारण हो सकते हैं।"
    assert result.follow_up_questions


@pytest.mark.asyncio
async def test_emergency_fast_path_does_not_wait_for_ai(monkeypatch):
    request = SymptomCheckRequest(
        symptoms=["pain", "rapid spread"],
        has_fever=True,
        has_rapid_spread=True,
        severity="severe",
        language="en",
    )
    baseline = SymptomService.evaluate(request)
    assert baseline.triage_level == "emergency"

    async def must_not_run(*args, **kwargs):
        raise AssertionError("AI must not delay deterministic emergency response")

    monkeypatch.setattr(
        "app.services.symptom_ai_service.ai_provider_manager.generate",
        must_not_run,
    )
    result = await SymptomAIService.enrich(request, baseline)

    assert result.triage_level == "emergency"
    assert result.ai_enhancement_status == "emergency_fast_path"
    assert result.red_flags == baseline.red_flags


@pytest.mark.asyncio
async def test_provider_unavailable_keeps_deterministic_assessment(monkeypatch):
    request = SymptomCheckRequest(symptoms=["itching"], language="en")
    baseline = SymptomService.evaluate(request)

    async def unavailable(*args, **kwargs):
        raise AIProvidersUnavailable(["gemini:http_503", "groq:timeout"])

    monkeypatch.setattr(
        "app.services.symptom_ai_service.ai_provider_manager.generate",
        unavailable,
    )
    result = await SymptomAIService.enrich(request, baseline)

    assert result.ai_enhancement_status == "unavailable"
    assert result.triage_level == baseline.triage_level
    assert result.differentials == baseline.differentials
    assert result.referral_guidance == baseline.referral_guidance


@pytest.mark.asyncio
async def test_non_english_provider_failure_is_explicitly_marked_as_english_fallback(monkeypatch):
    request = SymptomCheckRequest(symptoms=["itching"], language="ta")
    baseline = SymptomService.evaluate(request)

    async def unavailable(*args, **kwargs):
        raise AIProvidersUnavailable(["gemini:http_503", "groq:timeout"])

    monkeypatch.setattr(
        "app.services.symptom_ai_service.ai_provider_manager.generate",
        unavailable,
    )
    result = await SymptomAIService.enrich(request, baseline)

    assert result.requested_language == "Tamil"
    assert result.response_language == "English"
    assert result.ai_enhancement_status == "fallback_english"


def test_ai_payload_cannot_change_deterministic_relevance_or_red_flag_count():
    request = SymptomCheckRequest(symptoms=["itching", "redness"])
    baseline = SymptomService.evaluate(request)
    payload = _valid_payload(baseline)

    if payload["localized_differentials"]:
        payload["localized_differentials"][0]["relevance_level"] = "highly_certain"
        with pytest.raises(ValueError):
            SymptomAIService._validate_payload(payload, baseline)

    payload = _valid_payload(baseline)
    payload["localized_red_flags"].append("invented warning")
    with pytest.raises(ValueError):
        SymptomAIService._validate_payload(payload, baseline)

@pytest.mark.parametrize(
    ("language", "expected_code"),
    [
        ("Hindi", "hi"),
        ("hi-IN", "hi"),
        ("Bengali", "bn"),
        ("Manipuri (Meitei)", "mni"),
        ("Oriya", "or"),
        ("Tamil", "ta"),
    ],
)
def test_language_registry_accepts_codes_and_display_names(language, expected_code):
    from app.services.language_service import resolve_language

    code, _label = resolve_language(language)
    assert code == expected_code
