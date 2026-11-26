import { apiFetch } from "./apiClient";
import type { LanguageCode } from "../context/AppModeContext";

export interface SymptomAssessmentRequest {
  symptoms: string[];
  duration_days?: number | null;
  affected_body_locations?: string[];
  severity?: string;
  has_fever?: boolean;
  has_rapid_spread?: boolean;
  has_pain_or_bleeding?: boolean;
  language: LanguageCode;
}

export function submitSymptomAssessment(payload: SymptomAssessmentRequest) {
  return apiFetch<Record<string, unknown>>("/api/v1/symptoms/analyze", {
    method: "POST", body: JSON.stringify(payload),
  });
}

export function analyzeMedicalReport(file: File, language: LanguageCode) {
  const body = new FormData(); body.append("file", file); body.append("language", language);
  return apiFetch<Record<string, unknown>>("/api/v1/reports/analyze", { method: "POST", body });
}

export function analyzePrescription(file: File, language: LanguageCode) {
  const body = new FormData(); body.append("file", file); body.append("language", language);
  return apiFetch<Record<string, unknown>>("/api/v1/prescriptions/analyze", { method: "POST", body });
}

export function verifyPrescription(prescriptionId: number, payload: Record<string, unknown>) {
  return apiFetch<Record<string, unknown>>(`/api/v1/prescriptions/${prescriptionId}/verify`, {
    method: "POST", body: JSON.stringify(payload),
  });
}

export function checkMedicationSafety(payload: {
  medications: string[]; allergies?: string[]; patient_conditions?: string[]; language: LanguageCode;
}) {
  return apiFetch<Record<string, unknown>>("/api/v1/medications/check-safety", {
    method: "POST", body: JSON.stringify(payload),
  });
}

export interface CustomReminderRequest {
  medicine_name: string; dosage: string; scheduled_time: string; scheduled_date?: string; notes?: string;
}

export function getTodayReminders(date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiFetch<Array<Record<string, unknown>>>(`/api/v1/prescriptions/reminders/today${query}`);
}

export function createReminder(payload: CustomReminderRequest) {
  return apiFetch<Record<string, unknown>>("/api/v1/prescriptions/reminders", {
    method: "POST", body: JSON.stringify(payload),
  });
}

export function updateReminderAction(id: number, action: "taken" | "skipped" | "snooze", snooze_minutes = 15) {
  return apiFetch<Record<string, unknown>>(`/api/v1/prescriptions/reminders/${id}/action`, {
    method: "PATCH", body: JSON.stringify({ action, snooze_minutes }),
  });
}

export function deleteReminder(id: number) {
  return apiFetch<void>(`/api/v1/prescriptions/reminders/${id}`, { method: "DELETE" });
}

export function requestAyurvedicGuidance(payload: {
  skin_concern: string; season?: string; dosha_predominance?: string | null;
  dietary_preference?: string; language: LanguageCode; reported_symptoms?: string[];
  current_medications?: string[]; known_allergies?: string[]; relevant_conditions?: string[];
}) {
  return apiFetch<Record<string, unknown>>("/api/v1/wellness/guidance", {
    method: "POST", body: JSON.stringify(payload),
  });
}

export function askHealthAssistant(payload: {
  message: string; language: LanguageCode; context?: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  return apiFetch<Record<string, unknown>>("/api/v1/assistant/chat", {
    method: "POST", body: JSON.stringify(payload),
  });
}
