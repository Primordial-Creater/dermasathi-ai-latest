import React, { createContext, useContext, useEffect, useState } from "react";
import type { SkinAnalysisResponse } from "../types/api";

export interface SymptomRecord {
  duration: string;
  sensation: string;
  location: string;
  notes: string;
  timestamp: string;
  isDemo?: boolean;
}

interface ClinicalContextType {
  latestAssessment: SkinAnalysisResponse | null;
  imagePreview: string | null;
  symptomsRecord: SymptomRecord | null;
  setAssessment: (result: SkinAnalysisResponse, previewUrl?: string) => void;
  setSymptoms: (record: SymptomRecord) => void;
  clearSession: () => void;
}

const ClinicalContext = createContext<ClinicalContextType | undefined>(undefined);

export const ClinicalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [latestAssessment, setLatestAssessmentState] = useState<SkinAnalysisResponse | null>(null);
  const [imagePreview, setImagePreviewState] = useState<string | null>(null);
  const [symptomsRecord, setSymptomsRecordState] = useState<SymptomRecord | null>(null);

  useEffect(() => {
    // Clear sensitive clinical data left by the former sessionStorage prototype.
    sessionStorage.removeItem("dermasathi_latest_assessment");
    sessionStorage.removeItem("dermasathi_latest_image");
    sessionStorage.removeItem("dermasathi_latest_symptoms");
  }, []);

  const setAssessment = (result: SkinAnalysisResponse, previewUrl?: string) => {
    setLatestAssessmentState(result);
    // Blob URLs are valid only for the current page lifetime; never persist them.
    setImagePreviewState(previewUrl?.startsWith("blob:") ? previewUrl : previewUrl ?? null);
  };

  const setSymptoms = (record: SymptomRecord) => setSymptomsRecordState(record);

  const clearSession = () => {
    setLatestAssessmentState(null);
    setImagePreviewState(null);
    setSymptomsRecordState(null);
    // Remove records written by the earlier prototype implementation.
    sessionStorage.removeItem("dermasathi_latest_assessment");
    sessionStorage.removeItem("dermasathi_latest_image");
    sessionStorage.removeItem("dermasathi_latest_symptoms");
  };

  return (
    <ClinicalContext.Provider value={{
      latestAssessment, imagePreview, symptomsRecord, setAssessment, setSymptoms, clearSession,
    }}>
      {children}
    </ClinicalContext.Provider>
  );
};

export const useClinical = (): ClinicalContextType => {
  const context = useContext(ClinicalContext);
  if (!context) throw new Error("useClinical must be used within a ClinicalProvider");
  return context;
};
