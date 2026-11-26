export interface CandidateFinding {
  class_name?: string;
  class_index?: number;
  category_name?: string;
  raw_probability?: number | null;
  calibrated_probability?: number | null;
  confidence_level?: "low" | "moderate" | "high" | "insufficient";
  similarity_label?: "High" | "Moderate" | "Low";
  description?: string;
  general_information?: string;
  typical_clinical_features?: string[];
}

export interface ImageQualityReport {
  status?: string;
  score?: number | null;
  issues?: string[];
  user_action?: string | null;
  is_acceptable?: boolean;
  feedback_messages?: string[];
}

export interface SkinAICandidate {
  condition_name: string;
  confidence_level: "low" | "moderate" | "high" | "insufficient";
  rationale: string;
  supporting_observations: string[];
  limitations: string[];
  distinguishing_questions?: string[];
}

export interface SkinAIAnalysisPayload {
  response_language?: string;
  status: "supported" | "needs_better_image" | "abstain";
  message: string;
  image_quality: { suitable: boolean; lighting: string; focus: string; framing: string; comments: string[] };
  appearance_assessment: { classification: string; body_area: string; visible_features: string[]; description: string };
  prediction: { label: string; display_label: string; scope: string; confidence_level: string; rationale: string };
  alternatives: SkinAICandidate[];
  differential_comparison?: string[];
  what_image_cannot_establish?: string[];
  clinical_questions_to_distinguish?: string[];
  visible_observations: string[];
  affected_area: string;
  possible_triggers_to_discuss: string[];
  reported_symptoms_summary: string;
  follow_up_questions: string[];
  red_flags: string[];
  risk_level: string;
  referral_required: boolean;
  recommended_specialist: string;
  referral_timeframe: string;
  next_action: string[];
  doctor_summary: string;
  care: SkinCareGuidance;
  disclaimer: string;
}

export interface SkinCareGuidance {
  medical_next_steps: string[];
  medicine_information: Array<{ medicine_or_category: string; purpose: string; common_safety_considerations: string[]; interaction_cautions: string[]; verification_required: boolean }>;
  lifestyle_plan: Array<{ area: string; recommendation: string; frequency: string; cautions: string[] }>;
  dietary_guidance: Array<{ recommendation: string; rationale: string; cautions: string[] }>;
  monitoring_timeline: string[];
  ayurveda_information: Array<{ topic: string; traditional_context: string; supportive_wellness_information: string; evidence_level: string; safety_notes: string[] }>;
  ayurveda_routine: Array<{ step: string; timing: string; purpose: string; safety_boundary: string }>;
  ayurveda_safety_notes: string[];
  medicine_disclaimer?: string;
  care_disclaimer?: string;
}

export interface ReferralRecommendation {
  urgency: string;
  recommended_timeframe: string;
  recommended_specialist: string;
  actionable_instructions: string[];
  red_flags_present: string[];
}

export interface SkinAnalysisResponse {
  record_id?: number | null;
  analysis_provider?: string | null;
  analysis_model?: string | null;
  fallback_used?: boolean;
  provider_latency_ms?: number | null;
  status: string;
  model_name?: string | null;
  model_version?: string | null;
  prediction?: string | null;
  predicted_class?: string | null;
  top_predictions: CandidateFinding[];
  findings?: CandidateFinding[];
  raw_probability?: number | null;
  calibrated_confidence?: number | null;
  uncertainty?: number | null;
  uncertainty_score?: number | null;
  abstained?: boolean;
  abstention_reason?: string | null;
  is_high_risk?: boolean;
  quality?: ImageQualityReport | null;
  quality_gate?: ImageQualityReport;
  assessment?: SkinAIAnalysisPayload | null;
  care?: SkinCareGuidance | null;
  referral?: ReferralRecommendation;
  processing_time_ms?: number | null;
  requires_professional_review: boolean;
  clinical_disclaimer?: string;
  disclaimer?: string;
  reason?: string | null;
  message?: string | null;
  is_demo?: boolean;
}

export interface SystemStatusResponse {
  status: string;
  version?: string;
  model_loaded: boolean;
  timestamp: string;
}


/** Backend reminder record returned by the authenticated prescriptions API. */
export interface MedicationReminderItem {
  id: number;
  schedule_id?: number | null;
  prescription_id?: number | null;
  medicine_name: string;
  dosage: string;
  scheduled_time: string;
  scheduled_date: string;
  status: "scheduled" | "taken" | "skipped" | "snoozed" | "missed" | string;
  action_timestamp?: string | null;
  special_instructions?: string | null;
}

export interface MedicalReportAbnormalValue {
  parameter: string;
  value: string;
  reference_range?: string | null;
  status: "high" | "low" | "abnormal" | "critical" | "normal" | string;
  clinical_significance?: string | null;
}

/** Response shape from app.schemas.medical_report.MedicalReportAnalysisResponse. */
export interface MedicalReportAnalysisResponse {
  record_id?: number | null;
  success: boolean;
  report_title: string;
  report_type: string;
  test_date?: string | null;
  patient_summary: string;
  what_this_report_measures?: string | null;
  interpretation_by_section?: Array<{ section_name: string; summary: string; observations: string[] }>;
  key_findings: string[];
  abnormal_values: MedicalReportAbnormalValue[];
  normal_values?: string[];
  follow_up_recommendations?: string[];
  doctor_questions?: string[];
  questions_to_confirm?: string[];
  when_to_seek_urgent_care?: string[];
  urgency_level: "routine" | "monitor" | "consult_doctor" | "emergency" | string;
  conclusion?: string | null;
  clinical_notes?: string | null;
  limitations?: string[];
  data_quality_notes?: string[];
  clinical_disclaimer?: string;
  timestamp: string;
  analysis_provider?: string;
  analysis_model?: string;
}

export interface SymptomCheckRequest {
  symptoms: string[];
  duration_days?: number | null;
  affected_body_locations?: string[];
  severity?: string;
  has_fever?: boolean;
  has_rapid_spread?: boolean;
  has_pain_or_bleeding?: boolean;
  language: string;
}

export interface SymptomDifferential {
  condition_name: string;
  educational_summary: string;
  relevance_level: string;
  relevance_label?: string | null;
  common_triggers: string[];
}

export interface SymptomDifferentialExplanation {
  condition_name: string;
  explanation: string;
  why_it_may_fit: string[];
  what_is_not_established: string[];
}

/** Response shape from the authenticated Phase 4 symptoms endpoint. */
export interface SymptomCheckResponse {
  record_id?: number | null;
  triage_level: "emergency" | "prompt_consult" | "routine";
  differentials: SymptomDifferential[];
  red_flags: string[];
  self_care_precautions: string[];
  referral_guidance: string;
  disclaimer: string;
  requested_language?: string;
  response_language?: string;
  ai_enhancement_status?: "completed" | "unavailable" | "fallback_english" | "emergency_fast_path";
  analysis_provider?: string | null;
  analysis_model?: string | null;
  fallback_used?: boolean;
  triage_label?: string | null;
  triage_explanation?: string | null;
  plain_language_summary?: string | null;
  differential_explanations?: SymptomDifferentialExplanation[];
  follow_up_questions?: string[];
  additional_self_care?: string[];
  lifestyle_guidance?: string[];
  uncertainty_note?: string | null;
  ai_suggested_differentials?: Array<{ condition_name: string; why_it_may_fit: string[]; what_is_not_established: string[]; questions_to_distinguish: string[] }> ;
}

export interface PrescriptionAnalysisMedicine {
  id?: number | null;
  medicine_name: string;
  strength?: string | null;
  dosage?: string | null;
  dosage_unit?: string | null;
  frequency?: string | null;
  route?: string | null;
  timing?: string[];
  duration?: string | null;
  quantity?: string | null;
  special_instructions?: string | null;
  is_verified?: boolean;
  is_unclear?: boolean;
  unclear_reason?: string | null;
}

export interface PrescriptionAnalysisResponse {
  status: string;
  prescription_id: number;
  filename: string;
  requires_user_confirmation: boolean;
  doctor_name?: string | null;
  clinic_or_hospital?: string | null;
  prescription_date?: string | null;
  patient_name?: string | null;
  diagnosis_or_symptoms?: string | null;
  medicines: PrescriptionAnalysisMedicine[];
  general_advice?: string | null;
  confidence_notes?: string | null;
  clinical_safety_notice: string;
  analysis_provider?: string | null;
  analysis_model?: string | null;
  fallback_used: boolean;
  timestamp: string;
}

export interface DrugSafetyResponse {
  record_id?: number | null;
  safe_to_combine: boolean | null;
  safety_status: "known_interaction_alert" | "warning_detected" | "not_established_by_limited_rules";
  review_required: boolean;
  database_coverage_note: string;
  matched_medications: string[];
  unrecognized_medications: string[];
  allergy_review_required: boolean;
  interaction_alerts: Array<{ drugs_involved: string[]; severity: "high" | "moderate" | "low"; clinical_effect: string; recommendation: string }>;
  allergy_warnings: string[];
  condition_precautions: string[];
  identified_drugs: Array<{ name: string; category: string; common_skin_uses: string; general_safety_precautions: string[]; potential_side_effects: string[] }>;
  clinical_disclaimer: string;
  requested_language: string;
  response_language: string;
  ai_enhancement_status: "completed" | "unavailable" | "fallback_english";
  plain_language_summary?: string | null;
  unrecognized_medicine_explanations: string[];
  additional_precautions: string[];
  follow_up_questions: string[];
  uncertainty_note?: string | null;
  analysis_provider?: string | null;
  analysis_model?: string | null;
  fallback_used: boolean;
}

export interface WellnessGuidanceResponse {
  record_id?: number | null;
  direct_answer?: string | null;
  concern_analysis: string;
  ayurvedic_perspective: string;
  dietary_recommendations: string[];
  lifestyle_practices: string[];
  traditional_topical_care: Array<{ herb_name: string; sanskrit_name: string; skin_benefits: string; usage_guidance: string; safety_precautions: string }>;
  evidence_based_prevention: string[];
  cautionary_note: string;
  requested_language: string;
  response_language: string;
  ai_enhancement_status: string;
  additional_wellness_guidance: string[];
  follow_up_questions: string[];
  evidence_note?: string | null;
  medical_safety_note?: string | null;
  analysis_provider?: string | null;
  analysis_model?: string | null;
  fallback_used: boolean;
}

export interface ConsultationHistoryItem {
  id: number | string;
  session_type: string;
  title: string;
  summary: string;
  created_at: string;
  language: string;
  triage_urgency: string;
  referral_needed: boolean;
  clinical_flags?: Record<string, unknown> | null;
}



/** Full owner-scoped record returned by GET /api/v1/history/{record_key}. */
export interface ConsultationHistoryDetail extends ConsultationHistoryItem {
  input_payload?: Record<string, unknown> | null;
  result_payload?: Record<string, unknown> | null;
  verification_status?: string | null;
}
