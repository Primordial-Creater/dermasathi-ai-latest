from __future__ import annotations

import pytest

from app.schemas.health_assistant import HealthAssistantRequest
from app.schemas.wellness import WellnessGuidanceRequest
from app.services.ai_provider_manager import AIProvidersUnavailable, AIResult
from app.services.health_assistant_service import HealthAssistantService
from app.services.wellness_ai_service import WellnessAIService
from app.services.wellness_service import WellnessService


def _wellness_payload():
    return {
        "response_language": "Hindi",
        "direct_answer": (
            "शुष्क और परतदार त्वचा के लिए सबसे पहले हल्का, सुगंध-रहित मॉइस्चराइज़र और कोमल सफाई अपनाएँ। "
            "बहुत गर्म पानी और सुगंधित उत्पाद रूखापन बढ़ा सकते हैं।\n\n"
            "आयुर्वेद में त्वचा के रूखेपन को पारंपरिक रूप से वात से जोड़ा जा सकता है, लेकिन यह निदान नहीं है "
            "और केवल संदेश से किसी व्यक्ति का दोष निर्धारित नहीं किया जा सकता।"
        ),
        "ayurvedic_perspective": (
            "रूखापन वात से जोड़ना एक पारंपरिक अवधारणा है; इसे चिकित्सकीय निदान या प्रमाणित कारण न समझें।"
        ),
        "relevant_wellness_guidance": [
            "नहाने के तुरंत बाद त्वचा पर हल्का, बिना सुगंध वाला मॉइस्चराइज़र लगाएँ।",
            "यदि कोई उत्पाद जलन करे तो उसका उपयोग रोककर चिकित्सक से सलाह लें।",
        ],
        "dietary_recommendations": [],
        "lifestyle_practices": [
            "बहुत गर्म पानी से न नहाएँ और त्वचा को रगड़ने के बजाय हल्के से सुखाएँ।"
        ],
        "traditional_topical_care": [
            {
                "herb_name": "Aloe vera",
                "sanskrit_name": "Not supplied",
                "skin_benefits": "त्वचा पर इसके पारंपरिक उपयोग बताए जाते हैं; प्रभाव के प्रमाण सीमित हैं।",
                "usage_guidance": "इसे उपचार न मानें; किसी भी उत्पाद से पहले छोटे क्षेत्र पर सहनशीलता और चिकित्सकीय सलाह पर विचार करें।",
                "safety_precautions": "एलर्जी, जलन, खुले घाव या संक्रमण की स्थिति में उपयोग न करें; चिकित्सक से पूछें।",
            }
        ],
        "safety_precautions": [
            "खुजली, दर्द, सूजन या तेजी से बिगड़ते लक्षण हों तो त्वचा विशेषज्ञ से मिलें।"
        ],
        "follow_up_questions": ["क्या त्वचा में खुजली, दरार या खून भी आता है?"],
        "evidence_note": (
            "दोष संबंधी व्याख्या पारंपरिक ज्ञान है; शुष्क त्वचा के उपचार में किसी विशिष्ट जड़ी-बूटी की प्रभावशीलता स्थापित नहीं मानी जानी चाहिए।"
        ),
        "medical_safety_note": (
            "लक्षण बने रहें या बिगड़ें तो योग्य चिकित्सक से जाँच कराएँ; यह सलाह निर्धारित उपचार का विकल्प नहीं है।"
        ),
    }


@pytest.mark.asyncio
async def test_wellness_ai_preserves_relevant_herb_identity_and_localizes(monkeypatch):
    request = WellnessGuidanceRequest(skin_concern="dry flaky skin", language="hi")
    payload = _wellness_payload()

    async def fake_generate(*args, **kwargs):
        kwargs["json_validator"](payload)
        return AIResult("{}", payload, "gemini", "gemini-4-hydrogen", False, None, 10)

    monkeypatch.setattr("app.services.wellness_ai_service.ai_provider_manager.generate", fake_generate)
    result = await WellnessAIService.enrich(request)
    assert result.ai_enhancement_status == "completed"
    assert result.response_language == "Hindi"
    assert result.direct_answer.startswith("शुष्क")
    assert result.traditional_topical_care[0].herb_name == "Aloe vera"
    assert result.analysis_provider == "gemini"


@pytest.mark.asyncio
async def test_wellness_provider_failure_returns_explicit_unavailable_response(monkeypatch):
    request = WellnessGuidanceRequest(skin_concern="red itchy skin", language="mr")

    async def fail(*args, **kwargs):
        raise AIProvidersUnavailable(["gemini:http_503", "groq:http_429"])

    monkeypatch.setattr("app.services.wellness_ai_service.ai_provider_manager.generate", fail)
    result = await WellnessAIService.enrich(request)
    assert result.ai_enhancement_status == "fallback_english"
    assert result.response_language == "English"
    assert "temporarily unavailable" in result.direct_answer


@pytest.mark.asyncio
async def test_general_assistant_emergency_fast_path_skips_provider(monkeypatch):
    async def forbidden(*args, **kwargs):
        raise AssertionError("Provider must not run for emergency fast path")

    monkeypatch.setattr("app.services.health_assistant_service.ai_provider_manager.generate", forbidden)
    request = HealthAssistantRequest(message="I have severe chest pain and difficulty breathing", language="en")
    result = await HealthAssistantService.answer(request)
    assert result.emergency_fast_path is True
    assert result.ai_enhancement_status == "emergency_fast_path"
    assert "emergency" in result.answer.lower()


@pytest.mark.asyncio
async def test_general_assistant_returns_selected_language(monkeypatch):
    payload = {
        "response_language": "Hindi",
        "answer": "पर्याप्त जानकारी के बिना कारण बताना संभव नहीं है।",
        "key_points": ["लक्षणों की अवधि लिखें।"],
        "follow_up_questions": ["लक्षण कब शुरू हुए?"],
        "safety_note": "लक्षण गंभीर हों तो चिकित्सक से संपर्क करें।",
    }

    async def fake_generate(*args, **kwargs):
        kwargs["json_validator"](payload)
        return AIResult("{}", payload, "groq", "openai/gpt-oss-120b", True, "gemini:http_503", 30)

    monkeypatch.setattr("app.services.health_assistant_service.ai_provider_manager.generate", fake_generate)
    request = HealthAssistantRequest(message="मुझे सिरदर्द क्यों होता है?", language="hi")
    result = await HealthAssistantService.answer(request)
    assert result.ai_enhancement_status == "completed"
    assert result.response_language == "Hindi"
    assert result.analysis_provider == "groq"
    assert result.fallback_used is True


def test_wellness_baseline_does_not_claim_cure_or_scientific_proof():
    request = WellnessGuidanceRequest(skin_concern="acne and oiliness")
    result = WellnessService.get_guidance(request)
    assert "diagnosis" in result.ayurvedic_perspective.lower()
    assert "replace prescribed care" in result.cautionary_note.lower() or "not diagnosis" in result.cautionary_note.lower()
    for herb in result.traditional_topical_care:
        assert "evidence" in herb.skin_benefits.lower() or "traditional" in herb.skin_benefits.lower()


def test_all_23_scheduled_languages_resolve_for_wellness_and_assistant():
    for code in ["en", "as", "bn", "brx", "doi", "gu", "hi", "kn", "ks", "kok", "mai", "ml", "mni", "mr", "ne", "or", "pa", "sa", "sat", "sd", "ta", "te", "ur"]:
        assert WellnessGuidanceRequest(skin_concern="skin concern", language=code).language == code
        assert HealthAssistantRequest(message="health question", language=code).language == code
