import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useClinical } from "../context/ClinicalContext";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../services/api";
import type { ConsultationHistoryItem } from "../types/api";
import { useToast } from "../context/ToastContext";
import HealthHistoryExperience, { type HistoryEntry } from "../components/health-history/HealthHistoryExperience";

/* Session-only: ClinicalContext keeps the latest assessment and the latest symptom record in
   sessionStorage. There is no longitudinal store, so this page never invents older records. */

const SAMPLE_DEMO_ITEMS: HistoryEntry[] = [
  {
    id: "sample-1",
    date: "2026-10-24",
    category: "scan",
    title: "Forearm Plaque Longitudinal Inspection",
    summary: "Curated reference benchmark showing erythematous flexural pattern with boundary stability tracking.",
    tag: "Benchmark Scan (Demo)",
    isDemo: true,
  },
  {
    id: "sample-2",
    date: "2026-10-22",
    category: "symptoms",
    title: "Patient Symptom Anamnesis",
    summary: "Reported onset 4 days ago, nocturnal pruritus severity moderate, triggered after wool sweater contact.",
    tag: "Symptom Intake (Demo)",
    isDemo: true,
  },
  {
    id: "sample-3",
    date: "2026-10-20",
    category: "report",
    title: "OCR Laboratory Prescription Record",
    summary: "3 demo topical/oral regimens verified for reminder schedule integration.",
    tag: "OCR Verification (Demo)",
    isDemo: true,
  },
];

export const HealthHistoryPage: React.FC = () => {
  const { latestAssessment, imagePreview, symptomsRecord } = useClinical();
  const { isAuthenticated } = useAuth();
  const { info, error: toastError } = useToast();
  const [savedEntries, setSavedEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { setSavedEntries([]); return; }
    let active = true;
    setHistoryLoading(true);
    apiClient.get<ConsultationHistoryItem[]>("/api/v1/history?limit=75", { requireAuth: true })
      .then((records) => {
        if (!active) return;
        const mapped: HistoryEntry[] = records.map((record) => {
          const type = record.session_type;
          const category: HistoryEntry["category"] = type.includes("skin") ? "scan" : type.includes("symptom") ? "symptoms" : "report";
          return {
            id: `db-${record.id}`,
            date: record.created_at ? new Date(record.created_at).toLocaleString() : "Date unavailable",
            category,
            title: record.title,
            summary: record.summary,
            tag: record.triage_urgency ? `Saved · ${record.triage_urgency}` : "Saved record",
            isDemo: false,
          };
        });
        setSavedEntries(mapped);
      })
      .catch((error) => { if (active) toastError(error instanceof Error ? error.message : "Could not load health history."); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [isAuthenticated, toastError]);
  const navigate = useNavigate();
  const [showSampleTimeline, setShowSampleTimeline] = useState(false);

  // Genuine session records only; nothing is read from a persistent history store.
  const realEntries: HistoryEntry[] = [];

  if (latestAssessment) {
    const abstained = latestAssessment.status === "abstention";
    const prediction = latestAssessment.predicted_class?.trim();
    realEntries.push({
      id: "session-assessment",
      // SkinAnalysisResponse carries no assessment timestamp, so the real date is unknown.
      date: "Current session",
      category: "scan",
      title: abstained
        ? "Skin Photo Assessment (Abstention)"
        : prediction
          ? `Skin Photo Assessment (${prediction})`
          : "Skin Photo Assessment (No prediction reported)",
      summary: abstained
        ? "No prediction was produced for this image. The recorded abstention reason is shown in the visit dossier."
        : "Calibrated pattern-similarity result recorded for the current session. Not a confirmed diagnosis.",
      tag: "Active Session Scan",
      // Respect the actual response flag instead of assuming the result is genuine.
      isDemo: latestAssessment.is_demo === true,
      imageUrl: imagePreview,
    });
  }

  if (symptomsRecord) {
    realEntries.push({
      id: "session-symptoms",
      date: symptomsRecord.timestamp ? symptomsRecord.timestamp.split("T")[0] : "Current session",
      category: "symptoms",
      title: `Guided Symptom Intake (${symptomsRecord.location})`,
      summary: `Duration: ${symptomsRecord.duration} • Sensation: ${symptomsRecord.sensation}`,
      tag: symptomsRecord.isDemo === true ? "Sample Symptom Intake (Demo)" : "Active Session Symptoms",
      isDemo: symptomsRecord.isDemo === true,
    });
  }

  const combinedRealEntries = [...savedEntries, ...realEntries].filter((entry, index, all) => all.findIndex((candidate) => candidate.id === entry.id) === index);
  const displayedEntries = combinedRealEntries.length > 0 ? combinedRealEntries : showSampleTimeline ? SAMPLE_DEMO_ITEMS : [];

  const handleViewSummary = (entry?: HistoryEntry) => {
    if (entry?.isDemo) {
      info(
        "This is a synthetic sample record. It has no stored dossier — open a genuine session record to view its visit dossier.",
      );
      return;
    }
    if (entry && entry.id.startsWith("db-")) {
      const recordKey = entry.id.slice(3);
      navigate(`/visit-summary?recordId=${encodeURIComponent(recordKey)}`);
      return;
    }
    navigate("/visit-summary");
  };

  return (
    <>
    {historyLoading && <div role="status" aria-live="polite" style={{ position: "absolute", left: "-10000px" }}>Loading saved history…</div>}
    <HealthHistoryExperience
      backgroundSrc="/assets/health-history-background.jpg"
      entries={displayedEntries}
      isSampleTimeline={showSampleTimeline && combinedRealEntries.length === 0}
      hasSessionAssessment={latestAssessment !== null || savedEntries.some((entry) => entry.category === "scan")}
      hasSessionSymptoms={symptomsRecord !== null || savedEntries.some((entry) => entry.category === "symptoms")}
      documentsConnected={savedEntries.some((entry) => /report|prescription/i.test(entry.title))}
      onStartAssessment={() => navigate("/skin-assessment")}
      onRecordSymptoms={() => navigate("/symptoms")}
      onLoadSampleTimeline={() => setShowSampleTimeline(true)}
      onHideSampleTimeline={() => setShowSampleTimeline(false)}
      onViewSummary={handleViewSummary}
    />
    </>
  );
};

export default HealthHistoryPage;