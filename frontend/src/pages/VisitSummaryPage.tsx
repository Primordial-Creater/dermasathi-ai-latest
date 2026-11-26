import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useClinical } from "../context/ClinicalContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { apiClient } from "../services/api";
import type { ConsultationHistoryDetail } from "../types/api";
import VisitDossierExperience, { type VisitDossierViewModel } from "../components/visit-dossier/VisitDossierExperience";

type JsonObject = Record<string, unknown>;

const asObject = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
const asText = (value: unknown): string => typeof value === "string" || typeof value === "number" ? String(value) : "";
const asStrings = (value: unknown): string[] => Array.isArray(value) ? value.map((item) => {
  if (typeof item === "string" || typeof item === "number") return String(item);
  const object = asObject(item);
  const name = asText(object.condition_name || object.parameter || object.title || object.step || object.topic);
  const detail = asText(object.explanation || object.summary || object.rationale || object.clinical_significance || object.recommendation);
  return [name, detail].filter(Boolean).join(": ") || JSON.stringify(item);
}).filter(Boolean) : [];
const makeSection = (title: string, values: unknown[]): { title: string; items: string[] } => ({
  title,
  items: values.flatMap(asStrings).filter(Boolean),
});

function historicalSections(record: ConsultationHistoryDetail) {
  const result = asObject(record.result_payload);
  const input = asObject(record.input_payload);
  const type = record.session_type.toLowerCase();
  const sections: Array<{ title: string; items: string[] }> = [];

  if (type.includes("skin")) {
    const assessment = asObject(result.assessment || result);
    const prediction = asObject(assessment.prediction);
    const appearance = asObject(assessment.appearance_assessment);
    const care = asObject(assessment.care || result.care);
    sections.push(makeSection("Primary possible finding", [
      asText(prediction.display_label || prediction.label || result.predicted_class || result.prediction),
      asText(prediction.rationale),
      asText(assessment.message || result.message),
      `Qualitative confidence: ${asText(prediction.confidence_level) || "not reported"}`,
    ]));
    sections.push(makeSection("Observed image features", [asText(appearance.description), appearance.visible_features, assessment.visible_observations, asText(assessment.affected_area)]));
    sections.push(makeSection("Possible alternatives and comparison", [assessment.alternatives, assessment.differential_comparison]));
    sections.push(makeSection("What the photograph cannot establish", [assessment.what_image_cannot_establish]));
    sections.push(makeSection("Questions that may distinguish possibilities", [assessment.clinical_questions_to_distinguish, assessment.follow_up_questions]));
    sections.push(makeSection("Safety, referral and next steps", [assessment.red_flags, assessment.next_action, asText(assessment.recommended_specialist), asText(assessment.referral_timeframe), care.medical_next_steps]));
    sections.push(makeSection("Supportive care, diet and monitoring", [care.lifestyle_plan, care.dietary_guidance, care.monitoring_timeline, care.ayurveda_information, care.ayurveda_routine]));
    sections.push(makeSection("Assessment limitations", [asText(assessment.disclaimer || result.clinical_disclaimer), asText(assessment.doctor_summary)]));
  } else if (type.includes("symptom")) {
    sections.push(makeSection("AI enhancement and response language", [
      `AI status: ${asText(result.ai_enhancement_status) || "not reported"}`,
      `Response language: ${asText(result.response_language) || record.language}`,
      `Triage level: ${asText(result.triage_label || result.triage_level)}`,
    ]));
    sections.push(makeSection("Patient-friendly assessment", [asText(result.plain_language_summary), asText(result.triage_explanation)]));
    sections.push(makeSection("Reported symptoms", [input.symptoms, input.affected_body_locations, asText(input.duration_days ? `${input.duration_days} day(s)` : "Duration not recorded"), asText(input.severity)]));
    sections.push(makeSection("Possible explanations", [result.differentials, result.ai_suggested_differentials, result.differential_explanations]));
    sections.push(makeSection("Red flags and referral guidance", [result.red_flags, asText(result.referral_guidance)]));
    sections.push(makeSection("Follow-up and supportive guidance", [result.follow_up_questions, result.additional_self_care, result.self_care_precautions, result.lifestyle_guidance]));
    sections.push(makeSection("Uncertainty and limitations", [asText(result.uncertainty_note), asText(result.disclaimer)]));
  } else if (type === "medical_report") {
    sections.push(makeSection("Report overview", [asText(result.report_title), asText(result.report_type), asText(result.test_date), asText(result.patient_summary), asText(result.what_this_report_measures)]));
    sections.push(makeSection("Section-by-section interpretation", [result.interpretation_by_section]));
    sections.push(makeSection("Key and abnormal findings", [result.key_findings, result.abnormal_values]));
    sections.push(makeSection("Normal values", [result.normal_values]));
    sections.push(makeSection("Follow-up and doctor questions", [result.follow_up_recommendations, result.doctor_questions, result.questions_to_confirm]));
    sections.push(makeSection("Urgency, limitations and document quality", [asText(result.urgency_level), result.when_to_seek_urgent_care, result.limitations, result.data_quality_notes]));
    sections.push(makeSection("Conclusion and clinical notes", [asText(result.conclusion), asText(result.clinical_notes), asText(result.clinical_disclaimer)]));
  } else if (type === "medication_safety") {
    sections.push(makeSection("Safety summary", [asText(result.safety_status), asText(result.safe_to_combine === null ? "Safety not established by the limited rules" : result.safe_to_combine ? "No known interaction in the limited rules" : "Do not assume safe"), asText(result.plain_language_summary), asText(result.database_coverage_note)]));
    sections.push(makeSection("Interaction and allergy alerts", [result.interaction_alerts, result.allergy_warnings, result.condition_precautions]));
    sections.push(makeSection("Unrecognized medicines and next steps", [result.unrecognized_medicine_explanations, result.additional_precautions, result.follow_up_questions, asText(result.uncertainty_note)]));
  } else if (type === "wellness") {
    sections.push(makeSection("Direct answer", [asText(result.direct_answer || result.concern_analysis)]));
    sections.push(makeSection("Traditional perspective and relevant guidance", [asText(result.ayurvedic_perspective), result.additional_wellness_guidance, result.dietary_recommendations, result.lifestyle_practices]));
    sections.push(makeSection("Herbal safety and evidence", [result.traditional_topical_care, asText(result.evidence_note), asText(result.medical_safety_note)]));
  } else if (type === "health_assistant") {
    sections.push(makeSection("Assistant response", [asText(result.answer || result.response || result.message)]));
  } else if (type === "prescription") {
    sections.push(makeSection("Prescription details", [asText(result.doctor_name), asText(result.clinic_or_hospital), asText(result.prescription_date), asText(result.diagnosis_or_symptoms), result.medicines]));
    sections.push(makeSection("Verification and schedules", [asText(record.verification_status), result.schedules, asText(result.general_advice), asText(result.confidence_notes)]));
  } else {
    sections.push(makeSection("Saved result", [JSON.stringify(result)]));
  }
  return sections.filter((section) => section.items.length > 0);
}

export const VisitSummaryPage: React.FC = () => {
  const { latestAssessment, imagePreview, symptomsRecord } = useClinical();
  const { isAuthenticated } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const recordId = searchParams.get("recordId");
  const [historicalRecord, setHistoricalRecord] = useState<ConsultationHistoryDetail | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!recordId) { setHistoricalRecord(null); setHistoryError(null); return; }
    if (!isAuthenticated) { setHistoryError("Sign in to view this saved clinical record."); return; }
    let active = true;
    setHistoryLoading(true);
    setHistoryError(null);
    apiClient.get<ConsultationHistoryDetail>(`/api/v1/history/${encodeURIComponent(recordId)}`, { requireAuth: true })
      .then((record) => { if (active) setHistoricalRecord(record); })
      .catch((error) => { if (active) setHistoryError(error instanceof Error ? error.message : "Could not load the saved clinical record."); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [recordId, isAuthenticated]);

  const handlePrint = useCallback(() => {
    toast.info("Preparing consultation dossier for export / print...");
    setTimeout(() => window.print(), 300);
  }, [toast]);

  const skin: VisitDossierViewModel["skin"] = latestAssessment ? {
    statusLabel: latestAssessment.status === "ABSTAINED" || latestAssessment.status?.startsWith("ABSTAINED") ? "Abstained" : "Completed",
    predictionStatus: latestAssessment.assessment?.prediction?.display_label || latestAssessment.predicted_class || null,
    confidencePercent: null,
    imageQuality: latestAssessment.quality?.status || null,
    abstained: Boolean(latestAssessment.abstained),
    abstentionReason: latestAssessment.abstention_reason || undefined,
    professionalReview: latestAssessment.requires_professional_review ? "Professional review recommended" : null,
    message: latestAssessment.assessment?.message || latestAssessment.message || null,
    imageUrl: imagePreview ?? undefined,
    imageAlt: "Submitted skin assessment image",
  } : null;

  const symptoms: VisitDossierViewModel["symptoms"] = symptomsRecord ? {
    onsetDuration: symptomsRecord.duration,
    primaryLocation: symptomsRecord.location,
    primarySensation: symptomsRecord.sensation,
    additionalObservations: symptomsRecord.notes,
  } : null;

  const historicalSkin = historicalRecord?.session_type.includes("skin") ? asObject(historicalRecord.result_payload) : {};
  const historicalAssessment = asObject(historicalSkin.assessment || historicalSkin);
  const historicalPrediction = asObject(historicalAssessment.prediction);
  const historicalSymptomsInput = asObject(historicalRecord?.input_payload);
  const historicalType = historicalRecord?.session_type || "";
  const historicalRecordView = historicalRecord ? {
    title: historicalRecord.title,
    createdAt: historicalRecord.created_at ? new Date(historicalRecord.created_at).toLocaleString() : "Date unavailable",
    sessionType: historicalRecord.session_type,
    language: historicalRecord.language || "en",
    summary: historicalRecord.summary,
    sections: historicalSections(historicalRecord),
  } : null;

  const displaySkin: VisitDossierViewModel["skin"] = historicalRecord && historicalType.includes("skin") ? {
    statusLabel: asText(historicalAssessment.status) || "Completed",
    predictionStatus: asText(historicalPrediction.display_label || historicalPrediction.label || historicalSkin.predicted_class) || null,
    confidencePercent: null,
    imageQuality: asText(asObject(historicalAssessment.image_quality).focus) || null,
    abstained: historicalAssessment.status === "abstain",
    abstentionReason: asText(historicalAssessment.message) || undefined,
    professionalReview: "Professional review recommended",
    message: asText(historicalAssessment.message || historicalSkin.message) || historicalRecord.summary,
    imageUrl: undefined,
  } : skin;

  const displaySymptoms: VisitDossierViewModel["symptoms"] = historicalRecord && historicalType.includes("symptom") ? {
    onsetDuration: historicalSymptomsInput.duration_days != null ? `${asText(historicalSymptomsInput.duration_days)} day(s)` : null,
    primaryLocation: asStrings(historicalSymptomsInput.affected_body_locations).join(", "),
    primarySensation: asStrings(historicalSymptomsInput.symptoms).join(", "),
    additionalObservations: asText(historicalSymptomsInput.severity) || null,
  } : symptoms;

  const documents: VisitDossierViewModel["documents"] = historicalRecord && (historicalType === "medical_report" || historicalType === "prescription")
    ? { count: 1, ocrStatus: "Analyzed and saved", ocrMessage: historicalRecord.summary }
    : { count: 0, ocrStatus: "No document linked to this visit", ocrMessage: "Upload and analyze a report to add it to your health history." };

  const data: VisitDossierViewModel = {
    hasVisitRecord: Boolean(historicalRecord || latestAssessment || symptomsRecord),
    skin: displaySkin,
    symptoms: displaySymptoms,
    documents,
    medication: null,
    historicalRecord: historicalRecordView ? { ...historicalRecordView, error: historyError } : null,
  };

  return (
    <>
      {historyLoading && <p role="status" aria-live="polite">Loading saved clinical record…</p>}
      {historyError && !historicalRecord && <p role="alert">{historyError}</p>}
      <VisitDossierExperience
        data={data}
        backgroundSrc="/assets/visit-dossier-background.jpg"
        onReturnToAssessment={() => navigate("/skin-assessment")}
        onReviewSymptoms={() => navigate("/symptoms")}
        onOpenReports={() => navigate("/reports")}
        onViewMedication={() => navigate("/reminders")}
        onPrint={handlePrint}
      />
    </>
  );
};

export default VisitSummaryPage;
