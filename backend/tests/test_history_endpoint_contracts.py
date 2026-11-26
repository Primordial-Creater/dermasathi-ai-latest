from types import SimpleNamespace
from app.api.v1.endpoints.history import _title_and_summary


def test_history_summary_for_report_is_safe_and_bounded():
    record = SimpleNamespace(session_type="medical_report", result_payload={"report_title": "CBC", "patient_summary": "A" * 500})
    title, summary = _title_and_summary(record)
    assert title == "CBC"
    assert len(summary) <= 360


def test_history_summary_for_skin_does_not_call_a_prediction_a_diagnosis():
    record = SimpleNamespace(session_type="skin_photo", result_payload={"assessment": {"prediction": {"display_label": "Possible eczema"}}})
    title, summary = _title_and_summary(record)
    assert title == "Skin image assessment"
    assert "Possible finding" in summary
