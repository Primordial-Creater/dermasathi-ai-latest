from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, Field


class PrescriptionMedicineItem(BaseModel):
    id: Optional[int] = None
    medicine_name: str = Field(..., description="Trade or generic name exactly as transcribed")
    strength: Optional[str] = None
    dosage: Optional[str] = None
    dosage_unit: Optional[str] = None
    frequency: Optional[str] = None
    route: Optional[str] = None
    timing: List[str] = Field(default_factory=list)
    duration: Optional[str] = None
    quantity: Optional[str] = None
    special_instructions: Optional[str] = None
    is_verified: bool = False
    is_unclear: bool = False
    unclear_reason: Optional[str] = None


class PrescriptionAnalysisResponse(BaseModel):
    status: str = "verification_required"
    prescription_id: int
    filename: str
    requires_user_confirmation: bool = True
    doctor_name: Optional[str] = None
    clinic_or_hospital: Optional[str] = None
    prescription_date: Optional[str] = None
    patient_name: Optional[str] = None
    diagnosis_or_symptoms: Optional[str] = None
    medicines: List[PrescriptionMedicineItem] = Field(default_factory=list)
    general_advice: Optional[str] = None
    confidence_notes: Optional[str] = None
    clinical_safety_notice: str = (
        "Extracted details are unverified. Compare every medicine and instruction with the original prescription "
        "and confirm with the prescriber or pharmacist before acting."
    )
    analysis_provider: Optional[str] = None
    analysis_model: Optional[str] = None
    fallback_used: bool = False
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PrescriptionVerificationRequest(BaseModel):
    medicines: List[PrescriptionMedicineItem]
    doctor_name: Optional[str] = None
    prescription_date: Optional[str] = None
    general_advice: Optional[str] = None


class PrescriptionVerificationResponse(BaseModel):
    success: bool = True
    prescription_id: int
    status: str
    message: str
    verified_medicines: List[PrescriptionMedicineItem]


class ScheduleCreateItem(BaseModel):
    medicine_id: Optional[int] = None
    medicine_name: str
    dosage: str
    frequency: str
    times_of_day: List[str] = Field(...)
    start_date: str
    duration_days: Optional[int] = None
    special_instructions: Optional[str] = None


class CreateSchedulesRequest(BaseModel):
    schedules: List[ScheduleCreateItem]


class MedicationScheduleResponse(BaseModel):
    id: int
    prescription_id: Optional[int]
    medicine_name: str
    dosage: str
    frequency: str
    times_of_day: List[str]
    start_date: str
    end_date: Optional[str]
    duration_days: Optional[int]
    special_instructions: Optional[str]
    is_active: bool
    created_at: str


class MedicationReminderItem(BaseModel):
    id: int
    schedule_id: Optional[int] = None
    prescription_id: Optional[int] = None
    medicine_name: str
    dosage: str
    scheduled_time: str
    scheduled_date: str
    status: str
    action_timestamp: Optional[str] = None
    special_instructions: Optional[str] = None


class CreateCustomReminderRequest(BaseModel):
    medicine_name: str = Field(..., min_length=1)
    dosage: str = "1 dose"
    scheduled_time: str = "08:00 AM"
    scheduled_date: Optional[str] = None
    notes: Optional[str] = None


class ReminderActionRequest(BaseModel):
    action: str = Field(...)
    snooze_minutes: Optional[int] = 15
    notes: Optional[str] = None


class ReminderActionResponse(BaseModel):
    success: bool = True
    reminder_id: int
    status: str
    safety_message: str
    action_timestamp: str
