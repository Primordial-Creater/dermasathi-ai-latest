import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useClinical, type SymptomRecord } from "../context/ClinicalContext";
import { useAuth } from "../context/AuthContext";
import { useAppMode } from "../context/AppModeContext";
import { useToast } from "../context/ToastContext";
import { apiClient } from "../services/api";
import type { SymptomCheckRequest, SymptomCheckResponse } from "../types/api";
import SymptomsExperience, {
  type SymptomFormValue,
  type SymptomSection,
} from "../components/symptoms/SymptomsExperience";
import BodyMap from "../components/symptoms/BodyMap";
import styles from "../components/symptoms/SymptomsExperience.module.css";

/* Decorative dermatology artwork for the hero: layered skin strata with a
   magnifier. Not clinical content and carries no data. */
const HERO_ART = (
  <img
    src="/assets/symptoms-hero-art.png"
    alt=""
    aria-hidden="true"
    className={styles.heroArtwork}
  />
);

/* ------------------------------------------------------------------
   Presentation now lives in <SymptomsExperience />. Everything below is
   clinical wiring only: the exact option lists from the original page,
   the session-level ClinicalContext contract, the combined-notes format
   and the existing toast/save/sample/clear behaviour.
   ------------------------------------------------------------------ */

const REQUIRED_ERROR =
  "Please complete the Duration, Location, and Primary Sensation fields before saving.";

const DURATION_OPTIONS = [
  "< 24 hours (Sudden onset)",
  "1 – 3 days",
  "4 – 7 days",
  "1 – 2 weeks",
  "More than 1 month (Chronic)",
];

const LOCATION_OPTIONS = [
  "Inner Forearms / Arms",
  "Hands & Fingers",
  "Face & Neck",
  "Torso / Chest / Back",
  "Lower Limbs & Feet",
  "Multiple / Generalized distribution",
];

const SENSATION_OPTIONS = [
  "Severe nocturnal itching (pruritus)",
  "Burning or warm sensation",
  "Tenderness or touch sensitivity",
  "Dry, scaly tightness",
  "Stinging with perspiration",
  "Mild / No itching",
];

const TRIGGER_OPTIONS = [
  "New cosmetic, lotion, or skincare product",
  "New laundry detergent or chemical soap",
  "Outdoor exposure or plant contact",
  "High heat or excessive sweating",
  "Emotional stress or fatigue",
  "No specific trigger observed",
];

const RED_FLAGS = [
  "High fever, chills, or systemic illness",
  "Rapidly expanding erythema (within hours)",
  "Extensive blistering, sloughing, or open oozing",
  "Severe sharp pain or facial swelling",
];

const NO_RED_FLAG = "None of the above red-flag symptoms apply";

const NOTES_PREFIX = "Patient Notes: ";
const TRIGGERS_PREFIX = "Reported Triggers: ";
const FLAGS_PREFIX = "Safety Screening: ";

const toOptions = (labels: string[]) => labels.map((label) => ({ id: label, label }));

/* Six sections, in the original order, with the exact original option labels.
   Sections 1-3 are required; triggers, red flags and notes are optional. */
const SECTIONS: SymptomSection[] = [
  {
    id: "onset",
    title: "Onset & Duration",
    prompt: "How long has this skin patch or lesion been present?",
    kind: "single",
    required: true,
    requiredMessage: "Select how long the symptom has been present.",
    options: toOptions(DURATION_OPTIONS),
  },
  {
    id: "location",
    title: "Primary Anatomical Location",
    prompt: "Where is the main affected area situated?",
    kind: "single",
    required: true,
    requiredMessage: "Select the primary affected area.",
    options: toOptions(LOCATION_OPTIONS),
  },
  {
    id: "sensations",
    title: "Primary Sensation & Severity",
    prompt: "What physical sensation is most prominent?",
    kind: "single",
    required: true,
    requiredMessage: "Select the primary sensation.",
    options: toOptions(SENSATION_OPTIONS),
  },
  {
    id: "triggers",
    title: "Associated Triggers & Exposures",
    prompt: "Select any factors that preceded or worsened the condition (select all that apply).",
    kind: "multi",
    options: toOptions(TRIGGER_OPTIONS),
  },
  {
    id: "redFlags",
    title: "Clinical Red-Flag Safety Screen",
    prompt: "Check if you are experiencing any of the following emergency signs:",
    kind: "multi",
    isRedFlag: true,
    options: toOptions(RED_FLAGS),
    exclusive: { id: NO_RED_FLAG, label: NO_RED_FLAG },
  },
  {
    id: "additional",
    title: "Additional Patient Observations",
    prompt: "Any specific progression, remedies attempted, or personal notes for your clinician?",
    kind: "text",
    textPlaceholder:
      "E.g., Itchy rash began around Monday. Tried petroleum jelly with minor relief. It feels aggravated after hot showers.",
  },
];

const SAMPLE_VALUE: SymptomFormValue = {
  onset: { selected: ["4 – 7 days"] },
  location: { selected: ["Inner Forearms / Arms"] },
  sensations: { selected: ["Severe nocturnal itching (pruritus)"] },
  triggers: {
    selected: ["New laundry detergent or chemical soap", "High heat or excessive sweating"],
  },
  redFlags: { selected: [NO_RED_FLAG] },
  additional: {
    selected: [],
    text: "Pruritic patches worsen after evening showers. Redness increased after wearing a synthetic wool sweater.",
  },
};

const splitList = (raw: string): string[] =>
  raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

/** Restore the combined notes format back into its three parts. If the text
 *  does not match the format it is kept verbatim as patient notes. */
const parseCombinedNotes = (raw: string): { notes: string; triggers: string[]; flags: string[] } => {
  const trimmed = (raw ?? "").trim();
  const result = { notes: "", triggers: [] as string[], flags: [] as string[] };
  if (!trimmed || trimmed === "No additional patient notes entered.") return result;

  const notes: string[] = [];
  const leftover: string[] = [];
  let matched = false;

  for (const block of trimmed.split(/\n{2,}/)) {
    const b = block.trim();
    if (!b) continue;
    if (b.startsWith(NOTES_PREFIX)) {
      notes.push(b.slice(NOTES_PREFIX.length).trim());
      matched = true;
    } else if (b.startsWith(TRIGGERS_PREFIX)) {
      result.triggers.push(...splitList(b.slice(TRIGGERS_PREFIX.length)));
      matched = true;
    } else if (b.startsWith(FLAGS_PREFIX)) {
      result.flags.push(...splitList(b.slice(FLAGS_PREFIX.length)));
      matched = true;
    } else {
      leftover.push(b);
    }
  }

  if (!matched) {
    result.notes = trimmed;
    return result;
  }
  notes.push(...leftover);
  result.notes = notes.filter(Boolean).join("\n");
  return result;
};

const buildInitialValue = (record: SymptomRecord | null): SymptomFormValue => {
  if (!record) return {};
  const parsed = parseCombinedNotes(record.notes);
  return {
    onset: record.duration ? { selected: [record.duration] } : { selected: [] },
    location: record.location ? { selected: [record.location] } : { selected: [] },
    sensations: record.sensation ? { selected: [record.sensation] } : { selected: [] },
    triggers: { selected: parsed.triggers },
    redFlags: { selected: parsed.flags },
    additional: { selected: [], text: parsed.notes },
  };
};

const buildCombinedNotes = (
  notes: string,
  triggers: string[],
  flags: string[],
): string =>
  [
    notes.trim() ? `${NOTES_PREFIX}${notes.trim()}` : "",
    triggers.length > 0 ? `${TRIGGERS_PREFIX}${triggers.join("; ")}` : "",
    flags.length > 0 ? `${FLAGS_PREFIX}${flags.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n") || "No additional patient notes entered.";

export const SymptomsPage: React.FC = () => {
  const { symptomsRecord, setSymptoms } = useClinical();
  const { user, isAuthenticated } = useAuth();
  const { language } = useAppMode();
  const toast = useToast();

  const [initialValue] = useState<SymptomFormValue>(() => buildInitialValue(symptomsRecord));
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");
  const [isSampleScenario, setIsSampleScenario] = useState(
    () => symptomsRecord?.isDemo === true,
  );
  const [backendResult, setBackendResult] = useState<SymptomCheckResponse | null>(null);
  const [backendLoading, setBackendLoading] = useState(false);

  // Any manual edit converts a loaded sample into user-provided input.
  // Loading the sample calls onChange first and onLoadSample immediately after,
  // so the latter deliberately marks the form as synthetic again.
  const handleChange = (_value: SymptomFormValue) => {
    setIsSampleScenario(false);
    if (saveStatus === "saved") setSaveStatus("idle");
  };

  const handleSave = async (value: SymptomFormValue) => {
    const duration = value.onset?.selected[0] ?? "";
    const location = value.location?.selected[0] ?? "";
    const sensation = value.sensations?.selected[0] ?? "";
    const triggers = value.triggers?.selected ?? [];
    const flags = value.redFlags?.selected ?? [];
    const notes = value.additional?.text ?? "";

    if (!duration || !location || !sensation) {
      toast.error(REQUIRED_ERROR);
      return;
    }

    setSymptoms({
      duration,
      location,
      sensation,
      notes: buildCombinedNotes(notes, triggers, flags),
      timestamp: new Date().toISOString(),
      isDemo: isSampleScenario,
    });

    // Also submit to backend for AI triage assessment
    if (isAuthenticated && user && !isSampleScenario) {
      setBackendLoading(true);
      try {
        const durationDays = duration.startsWith("< 24") ? 0
          : duration.startsWith("1 – 3") ? 2
          : duration.startsWith("4 – 7") ? 5
          : duration.startsWith("1 – 2") ? 10
          : duration.toLowerCase().includes("month") ? 31 : null;
        const request: SymptomCheckRequest = {
          symptoms: [sensation, ...triggers, ...(notes.trim() ? [notes.trim().slice(0, 300)] : [])].slice(0, 30),
          duration_days: durationDays,
          affected_body_locations: [location],
          has_fever: flags.includes("High fever, chills, or systemic illness"),
          has_rapid_spread: flags.includes("Rapidly expanding erythema (within hours)"),
          has_pain_or_bleeding: flags.includes("Severe sharp pain or facial swelling"),
          severity: sensation.includes("Severe") ? "severe" : sensation.includes("Burning") ? "moderate" : "mild",
          language,
        };

        const result: SymptomCheckResponse = await apiClient.post(
          "/api/v1/symptoms/analyze",
          request,
          { requireAuth: true }
        );
        setBackendResult(result);
        if (result.ai_enhancement_status === "completed") {
          toast.success("Symptom assessment and AI explanation saved to your clinical record.");
        } else if (result.ai_enhancement_status === "emergency_fast_path") {
          toast.warning("Emergency triage was saved immediately. AI was skipped so urgent guidance was not delayed.");
        } else {
          toast.warning("Your deterministic symptom triage was saved, but the AI explanation could not be completed. Please retry the assessment.");
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Backend triage assessment unavailable.";
        toast.warning(msg);
        setBackendResult(null);
      } finally {
        setBackendLoading(false);
      }
    } else {
      setBackendResult(null);
    }

    setSaveStatus("saved");
    if (!isAuthenticated) {
      toast.success(
        isSampleScenario
          ? "Reference symptom scenario saved to this session as demonstration data."
          : "Symptom intake dossier successfully saved to this session.",
      );
    }
  };

  const handleValidationError = (_sectionId: string, _message: string) => {
    toast.error(REQUIRED_ERROR);
  };

  const handleLoadSample = () => {
    setIsSampleScenario(true);
    toast.info("Loaded reference clinical intake scenario (Sample)");
  };

  const handleClear = () => {
    setIsSampleScenario(false);
    setSaveStatus("idle");
    toast.info("Intake form cleared.");
  };

  return (
    <SymptomsExperience
      theme="light"
      sections={SECTIONS}
      defaultValue={initialValue}
      sample={SAMPLE_VALUE}
      backdropImageUrl="/assets/symptoms-background-image.jpg"
      heroSlot={HERO_ART}
      renderVisual={(section, value, select) =>
        section.id === "location" ? (
          <BodyMap value={value.selected[0] ?? ""} onChange={select} />
        ) : null
      }
      title="Symptom Checker"
      subtitle="STRUCTURED CLINICAL ANAMNESIS"
      intro="Record objective clinical details regarding your skin concern to compile an accurate summary for your dermatologist consultation."
      urgentWarning={
        <>
          <strong>High-Priority Clinical Warning: Urgent Symptoms Indicated</strong>
          <p>
            You selected symptoms that may indicate an acute infection or severe dermatological
            emergency. We recommend seeking immediate evaluation at an urgent care or emergency
            medical facility.
          </p>
        </>
      }
      saveStatus={backendLoading ? "saving" : saveStatus}
      saveSuccessMessage={
        <>
          <div>
            <strong className={styles.successTitle}>Symptom Dossier Recorded</strong>
            <p className={styles.successDesc}>
              {backendResult?.record_id
                ? backendResult.ai_enhancement_status === "completed"
                  ? "Your symptom intake, AI explanation and triage result were saved to your secure account record."
                  : "Your symptom intake and deterministic triage were saved. The AI enhancement status is shown below; no AI-generated explanation is claimed unless it completed."
                : backendResult
                  ? "The symptom response was received, but the server did not return a saved-record identifier. Check Health History before assuming it is persistent."
                  : "This intake is saved in the current browser session only. Sign in and submit your own details for secure AI assessment and account history."}
            </p>
          </div>
          {backendResult && (
            <div className={styles.triageResults}>
              <strong className={styles.successTitle}>{backendResult.ai_enhancement_status === "completed" ? "AI-enhanced symptom assessment" : "Deterministic symptom triage"}</strong>
              <p className={styles.successDesc}>
                <strong>Triage Level:</strong> {backendResult.triage_label || backendResult.triage_level} · <strong>AI status:</strong> {backendResult.ai_enhancement_status || "not reported"} · <strong>Response language:</strong> {backendResult.response_language || "not reported"}{backendResult.analysis_provider ? ` · Provider: ${backendResult.analysis_provider}/${backendResult.analysis_model || "model unavailable"}` : ""}
              </p>
              {backendResult.record_id && <p className={styles.successDesc}>Saved clinical record #{backendResult.record_id} in your account history.</p>}
              {backendResult.plain_language_summary && <p className={styles.successDesc}>{backendResult.plain_language_summary}</p>}
              {backendResult.triage_explanation && <p className={styles.successDesc}>{backendResult.triage_explanation}</p>}
              {backendResult.red_flags.length > 0 && (
                <>
                  <strong>⚠ Red Flags:</strong>
                  <ul>
                    {backendResult.red_flags.map((flag, i) => (
                      <li key={i}>{flag}</li>
                    ))}
                  </ul>
                </>
              )}
              {backendResult.differentials.length > 0 && (
                <>
                  <strong>Baseline possible explanations (educational, not diagnoses):</strong>
                  <ul>
                    {backendResult.differentials.map((d, i) => (
                      <li key={i}>
                        <strong>{d.condition_name}</strong> ({d.relevance_label || d.relevance_level}) — {d.educational_summary}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {backendResult.ai_suggested_differentials?.length ? (
                <>
                  <strong>Additional AI-suggested possibilities for clinician discussion:</strong>
                  <ul>{backendResult.ai_suggested_differentials.map((item, i) => <li key={`ai-diff-${i}`}><strong>{item.condition_name}</strong><br />Why it may fit: {item.why_it_may_fit.join("; ")}<br />Not established: {item.what_is_not_established.join("; ")}<br />Questions: {item.questions_to_distinguish.join("; ")}</li>)}</ul>
                </>
              ) : null}
              {backendResult.differential_explanations?.length ? (
                <>
                  <strong>AI explanations of the baseline possibilities:</strong>
                  <ul>{backendResult.differential_explanations.map((item, i) => <li key={`exp-${i}`}><strong>{item.condition_name}:</strong> {item.explanation} {item.why_it_may_fit.join("; ")} {item.what_is_not_established.length ? `Not established: ${item.what_is_not_established.join("; ")}` : ""}</li>)}</ul>
                </>
              ) : null}
              {backendResult.follow_up_questions?.length ? <><strong>Questions to clarify:</strong><ul>{backendResult.follow_up_questions.map((q, i) => <li key={`fq-${i}`}>{q}</li>)}</ul></> : null}
              {backendResult.additional_self_care?.length ? <><strong>Additional self-care:</strong><ul>{backendResult.additional_self_care.map((q, i) => <li key={`sc-${i}`}>{q}</li>)}</ul></> : null}
              {backendResult.lifestyle_guidance?.length ? <><strong>Lifestyle guidance:</strong><ul>{backendResult.lifestyle_guidance.map((q, i) => <li key={`lg-${i}`}>{q}</li>)}</ul></> : null}
              {backendResult.ai_enhancement_status !== "completed" && <p className={styles.successDesc} role="status">The AI-generated explanation is unavailable for this record. The triage below is generated by deterministic safety rules, not by the AI model.</p>}
              {backendResult.uncertainty_note && <p className={styles.successDesc}>{backendResult.uncertainty_note}</p>}
              <p className={styles.successDesc}>{backendResult.referral_guidance}</p>
            </div>
          )}
          {!isAuthenticated && (
            <div className={styles.authPrompt}>
              <p>Sign in to receive AI-powered triage assessment and persistent symptom records.</p>
              <Link to="/login" className={styles.primaryLink}>
                <span>Sign In</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          )}
          <div className={styles.successLinks}>
            <Link to={backendResult?.record_id ? `/visit-summary?recordId=${backendResult.record_id}` : "/visit-summary"} className={styles.primaryLink}>
              <span>View Visit Summary</span>
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link to="/skin-assessment" className={styles.secondaryLink}>
              <span>Capture / Scan Photo</span>
            </Link>
          </div>
        </>
      }
      onChange={handleChange}
      onSave={handleSave}
      onValidationError={handleValidationError}
      onLoadSample={handleLoadSample}
      onClear={handleClear}
      disclaimer={
        <>
          <strong>Assistive Intake Workspace — Not Medical Advice.</strong> This questionnaire
          captures your observations to create a structured dossier for medical evaluation. It is
          not an AI diagnostic chatbot and does not prescribe treatments.
        </>
      }
    />
  );
};

export default SymptomsPage;