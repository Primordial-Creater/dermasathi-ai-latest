"""Offline contract tests for Phase 3. No external AI calls are made."""
import asyncio
from io import BytesIO

import pymupdf
from PIL import Image
from fastapi import HTTPException

from app.schemas.medical_report import MedicalReportAnalysisResponse
from app.schemas.prescription import PrescriptionAnalysisResponse
from app.services.document_ai_service import (
    _PrescriptionExtraction,
    _prepare_document,
    _safe_language,
)


def test_report_schema_keeps_previous_fields_and_adds_detail_fields():
    response = MedicalReportAnalysisResponse(
        report_title="Complete Blood Count",
        patient_summary="Illustrative summary",
    )
    assert response.success is True
    assert response.key_findings == []
    assert response.abnormal_values == []
    assert response.what_this_report_measures is None
    assert response.timestamp


def test_prescription_schema_keeps_verification_required_contract():
    response = PrescriptionAnalysisResponse(
        prescription_id=12,
        filename="prescription.jpg",
    )
    assert response.status == "verification_required"
    assert response.requires_user_confirmation is True
    assert response.medicines == []


def test_prescription_timing_normalizes_string_to_list():
    parsed = _PrescriptionExtraction.model_validate({
        "medicines": [{"medicine_name": "Example", "timing": "after food"}]
    })
    assert parsed.medicines[0].timing == ["after food"]


def test_language_registry_resolves_scheduled_languages():
    assert _safe_language("hi") == ("hi", "Hindi")
    assert _safe_language("en-IN") == ("en", "English")


def test_unknown_language_returns_422():
    try:
        _safe_language("xx")
    except HTTPException as exc:
        assert exc.status_code == 422
    else:
        raise AssertionError("Unknown language should not silently fall back to English")


def test_pdf_text_extraction_path_does_not_need_ai_call():
    pdf = pymupdf.open()
    page = pdf.new_page()
    page.insert_textbox((45, 45, 540, 220), "Patient Report\nHemoglobin 13.5 g/dL\nReference range 12.0-16.0 g/dL\nComplete blood count summary, collected on 22 November 2026.\nThe laboratory confirms the sample was received and analyzed successfully.")
    contents = pdf.tobytes()
    pdf.close()

    prepared = asyncio.run(_prepare_document(
        file_bytes=contents,
        filename="sample.pdf",
        language_name="English",
    ))
    assert prepared["page_count"] == 1
    assert "Hemoglobin 13.5 g/dL" in prepared["text"]
    assert prepared["image_bytes"] is None


def test_image_is_normalized_to_jpeg():
    image = Image.new("RGB", (120, 80), "white")
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    prepared = asyncio.run(_prepare_document(
        file_bytes=buffer.getvalue(),
        filename="sample.png",
        language_name="English",
    ))
    assert prepared["image_mime_type"] == "image/jpeg"
    assert prepared["image_bytes"].startswith(b"\xff\xd8")
    assert prepared["page_count"] == 1


def test_scanned_pdf_page_uses_the_shared_vision_provider(monkeypatch):
    from app.services import document_ai_service as service_module
    from app.services.ai_provider_manager import AIResult

    async def fake_generate(prompt, **kwargs):
        assert kwargs["image_mime_type"] == "image/png"
        assert kwargs["feature"] == "medical_document_ocr"
        return AIResult(
            text='{"page_text":"Hemoglobin 13.4 g/dL", "unreadable_regions":[]}',
            data={"page_text": "Hemoglobin 13.4 g/dL", "unreadable_regions": []},
            provider="gemini",
            model="gemini-test",
            fallback_used=False,
            fallback_reason=None,
            latency_ms=10,
        )

    monkeypatch.setattr(service_module.ai_provider_manager, "generate", fake_generate)
    pdf = pymupdf.open()
    pdf.new_page()  # image-only/blank page -> OCR is invoked
    contents = pdf.tobytes()
    pdf.close()

    prepared = asyncio.run(service_module._prepare_document(
        file_bytes=contents,
        filename="scan.pdf",
        language_name="English",
    ))
    assert "Hemoglobin 13.4 g/dL" in prepared["text"]


def test_report_service_attaches_provider_metadata(monkeypatch):
    from app.services import document_ai_service as service_module
    from app.services.ai_provider_manager import AIResult

    async def fake_generate(prompt, **kwargs):
        assert kwargs["feature"] == "medical_report_analysis"
        assert kwargs["image_mime_type"] == "image/jpeg"
        return AIResult(
            text="{}",
            data={"report_title": "Lab report", "patient_summary": "Example summary"},
            provider="gemini",
            model="gemini-test",
            fallback_used=False,
            fallback_reason=None,
            latency_ms=12,
        )

    monkeypatch.setattr(service_module.ai_provider_manager, "generate", fake_generate)
    image = Image.new("RGB", (100, 70), "white")
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    result = asyncio.run(service_module.document_ai_service.analyze_report(
        file_bytes=buffer.getvalue(),
        filename="report.png",
        language="en",
    ))
    assert result.report_title == "Lab report"
    assert result.analysis_provider == "gemini"
    assert result.analysis_model == "gemini-test"


def test_prescription_service_returns_unverified_extraction(monkeypatch):
    from app.services import document_ai_service as service_module
    from app.services.ai_provider_manager import AIResult

    async def fake_generate(prompt, **kwargs):
        assert kwargs["feature"] == "prescription_extraction"
        return AIResult(
            text="{}",
            data={
                "medicines": [{
                    "medicine_name": "Example medicine",
                    "dosage": None,
                    "frequency": None,
                    "timing": "after food",
                }],
                "clinical_safety_notice": "Localized safety notice",
            },
            provider="groq",
            model="vision-test",
            fallback_used=True,
            fallback_reason="gemini:http_503",
            latency_ms=25,
        )

    monkeypatch.setattr(service_module.ai_provider_manager, "generate", fake_generate)
    image = Image.new("RGB", (100, 70), "white")
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    result = asyncio.run(service_module.document_ai_service.analyze_prescription(
        file_bytes=buffer.getvalue(),
        filename="rx.png",
        language="hi",
    ))
    medicine = result.data["medicines"][0]
    assert medicine["timing"] == ["after food"]
    assert medicine["is_unclear"] is True
    assert result.provider == "groq"
    assert result.fallback_used is True
