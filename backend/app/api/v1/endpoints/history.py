"""Authenticated, read-only history view over existing consultation and prescription records."""
from datetime import timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.consultation import ConsultationRecord
from app.models.prescription import Prescription
from app.models.user import User

router = APIRouter()


def _payload_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _iso(value: Any) -> str:
    if not value:
        return ""
    if getattr(value, "tzinfo", None) is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat()


def _title_and_summary(record: ConsultationRecord) -> tuple[str, str]:
    payload = _payload_dict(record.result_payload)
    session_type = (record.session_type or "").lower()
    if session_type in {"skin_photo", "skin_assessment"}:
        title = "Skin image assessment"
        assessment = _payload_dict(payload.get("assessment"))
        prediction = _payload_dict(assessment.get("prediction"))
        label = prediction.get("display_label") or prediction.get("label") or payload.get("predicted_class") or payload.get("prediction")
        summary = f"Possible finding: {label}." if label else (payload.get("message") or "Skin assessment saved. Review the full result with a clinician.")
    elif session_type in {"symptom_assessment", "symptom_triage"}:
        title = "Symptom assessment"
        summary = payload.get("plain_language_summary") or payload.get("triage_explanation") or f"Triage level: {record.triage_urgency}."
    elif session_type == "medical_report":
        title = payload.get("report_title") or "Medical report analysis"
        summary = payload.get("patient_summary") or "Medical report interpretation saved."
    elif session_type == "medication_safety":
        title = "Medication safety review"
        summary = payload.get("plain_language_summary") or payload.get("database_coverage_note") or "Medication safety review saved."
    elif session_type == "wellness":
        title = "Ayurvedic wellness guidance"
        summary = payload.get("concern_analysis") or payload.get("ayurvedic_perspective") or "Wellness guidance saved."
    elif session_type == "health_assistant":
        title = "Health assistant conversation"
        summary = payload.get("answer") or "Health assistant response saved."
    else:
        title = session_type.replace("_", " ").title() or "Healthcare record"
        summary = "Healthcare record saved."
    summary = str(summary).strip()
    if len(summary) > 360:
        summary = summary[:357].rstrip() + "..."
    return str(title)[:160], summary


@router.get("", summary="List the signed-in user's saved consultation and prescription history")
def list_consultation_history(
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    consultation_records = (
        db.query(ConsultationRecord)
        .filter(ConsultationRecord.user_id == current_user.id)
        .order_by(ConsultationRecord.created_at.desc(), ConsultationRecord.id.desc())
        .limit(limit)
        .all()
    )
    prescription_records = (
        db.query(Prescription)
        .filter(Prescription.user_id == current_user.id)
        .order_by(Prescription.created_at.desc(), Prescription.id.desc())
        .limit(limit)
        .all()
    )

    items: list[dict[str, Any]] = []
    for record in consultation_records:
        title, summary = _title_and_summary(record)
        items.append({
            "id": record.id,
            "session_type": record.session_type,
            "title": title,
            "summary": summary,
            "created_at": _iso(record.created_at),
            "language": record.language or "en",
            "triage_urgency": record.triage_urgency or "routine",
            "referral_needed": bool(record.referral_needed),
            "clinical_flags": record.clinical_flags if isinstance(record.clinical_flags, dict) else None,
        })

    for prescription in prescription_records:
        medicines = list(prescription.medicines or [])
        names = [medicine.medicine_name for medicine in medicines[:5] if medicine.medicine_name]
        summary = f"{len(medicines)} medicine item(s) extracted. "
        if names:
            summary += "Items: " + ", ".join(names) + ("…" if len(medicines) > 5 else ".")
        summary += f" Verification status: {prescription.status.replace('_', ' ')}."
        items.append({
            "id": f"prescription-{prescription.id}",
            "session_type": "prescription",
            "title": "Prescription extraction",
            "summary": summary[:360],
            "created_at": _iso(prescription.created_at),
            "language": "en",
            "triage_urgency": "routine",
            "referral_needed": False,
            "clinical_flags": {"verification_status": prescription.status, "medicine_count": len(medicines)},
        })

    items.sort(key=lambda item: item["created_at"], reverse=True)
    return items[:limit]


@router.get("/{record_key}", summary="Get one complete saved record belonging to the signed-in user")
def get_consultation_history_detail(
    record_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the full structured assessment, never raw uploaded file bytes.

    Keys use a numeric consultation id or the `prescription-{id}` form emitted
    by the history list. All queries are scoped to the authenticated user.
    """
    if record_key.startswith("prescription-"):
        raw_id = record_key.removeprefix("prescription-")
        try:
            prescription_id = int(raw_id)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail="Saved record not found.") from exc
        prescription = (
            db.query(Prescription)
            .filter(
                Prescription.id == prescription_id,
                Prescription.user_id == current_user.id,
            )
            .first()
        )
        if prescription is None:
            raise HTTPException(status_code=404, detail="Saved record not found.")
        return {
            "id": record_key,
            "session_type": "prescription",
            "title": "Prescription extraction",
            "created_at": _iso(prescription.created_at),
            "language": "en",
            "verification_status": prescription.status,
            "input_payload": {
                "filename": prescription.filename,
                "file_type": prescription.file_type,
            },
            "result_payload": {
                "doctor_name": prescription.doctor_name,
                "clinic_or_hospital": prescription.clinic_or_hospital,
                "prescription_date": prescription.prescription_date,
                "patient_name": prescription.patient_name,
                "diagnosis_or_symptoms": prescription.diagnosis_or_symptoms,
                "general_advice": prescription.general_advice,
                "confidence_notes": prescription.confidence_notes,
                "medicines": [
                    {
                        "id": medicine.id,
                        "medicine_name": medicine.medicine_name,
                        "strength": medicine.strength,
                        "dosage": medicine.dosage,
                        "dosage_unit": medicine.dosage_unit,
                        "frequency": medicine.frequency,
                        "route": medicine.route,
                        "timing": medicine.timing or [],
                        "duration": medicine.duration,
                        "quantity": medicine.quantity,
                        "special_instructions": medicine.special_instructions,
                        "is_verified": medicine.is_verified,
                        "is_unclear": medicine.is_unclear,
                        "unclear_reason": medicine.unclear_reason,
                    }
                    for medicine in (prescription.medicines or [])
                ],
                "schedules": [
                    {
                        "id": schedule.id,
                        "medicine_name": schedule.medicine_name,
                        "dosage": schedule.dosage,
                        "frequency": schedule.frequency,
                        "times_of_day": schedule.times_of_day,
                        "start_date": schedule.start_date.isoformat() if schedule.start_date else None,
                        "end_date": schedule.end_date.isoformat() if schedule.end_date else None,
                        "is_active": schedule.is_active,
                    }
                    for schedule in (prescription.schedules or [])
                ],
            },
        }

    try:
        consultation_id = int(record_key)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Saved record not found.") from exc
    record = (
        db.query(ConsultationRecord)
        .filter(
            ConsultationRecord.id == consultation_id,
            ConsultationRecord.user_id == current_user.id,
        )
        .first()
    )
    if record is None:
        raise HTTPException(status_code=404, detail="Saved record not found.")
    title, summary = _title_and_summary(record)
    return {
        "id": record.id,
        "session_type": record.session_type,
        "title": title,
        "summary": summary,
        "created_at": _iso(record.created_at),
        "language": record.language or "en",
        "triage_urgency": record.triage_urgency or "routine",
        "referral_needed": bool(record.referral_needed),
        "clinical_flags": record.clinical_flags if isinstance(record.clinical_flags, dict) else None,
        "input_payload": _payload_dict(record.input_payload),
        "result_payload": _payload_dict(record.result_payload),
    }
