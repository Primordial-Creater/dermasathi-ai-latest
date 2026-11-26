import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppMode } from "../context/AppModeContext";
import { useClinical } from "../context/ClinicalContext";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { analyzeSkinImage, getCuratedSampleCase } from "../services/skinService";
import { SkinAnalysisResponse } from "../types/api";
import { SkinAssessmentExperience } from "../components/skin-assessment/SkinAssessmentExperience";
import { HealthcareLoader } from "../components/common/HealthcareLoader";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const SkinAssessmentPage: React.FC = () => {
  const { language, setDemoMode } = useAppMode();
  const { isAuthenticated, isInitializing } = useAuth();
  const { setAssessment, symptomsRecord } = useClinical();
  const toast = useToast();
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<SkinAnalysisResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [validationNote, setValidationNote] = useState<string | null>(null);
  const [showCoach, setShowCoach] = useState(false);
  const [isSampleMode, setIsSampleMode] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Safely cleanup object URLs to avoid memory leaks
  const cleanupPreviewUrl = useCallback(() => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      cleanupPreviewUrl();
    };
  }, [cleanupPreviewUrl]);

  // Shared validation for file input and drag/drop
  const validateAndSelectFile = (file: File) => {
    setErrorMsg(null);
    setValidationNote(null);
    setIsSampleMode(false);

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      const err = `Unsupported file format (${file.type || "unknown"}). Please upload a clinical JPEG, PNG, or WebP photograph.`;
      setErrorMsg(err);
      toast.error(err);
      return false;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      const err = `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 10MB safety threshold.`;
      setErrorMsg(err);
      toast.error(err);
      return false;
    }

    cleanupPreviewUrl();
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setValidationNote("Format & size validated. Note: Format validation verifies file integrity but does NOT identify skin content.");
    return true;
  };

  const runAssessment = async () => {
    if (!selectedFile) return;
    if (isInitializing) {
      toast.info("Checking your secure session. Please try again in a moment.");
      return;
    }
    if (!isAuthenticated) {
      toast.warning("Sign in before sending a skin photograph for secure AI assessment.");
      navigate("/login", { state: { from: "/skin-assessment" } });
      return;
    }

    // A user-requested clinical assessment always uses the authenticated live API.
    setDemoMode(false);
    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      const res = await analyzeSkinImage(selectedFile, false, language, {
        symptoms: symptomsRecord ? [symptomsRecord.sensation, symptomsRecord.notes].filter(Boolean).join(". ") : "",
        duration: symptomsRecord?.duration || "",
        affectedArea: symptomsRecord?.location || "",
      });
      setResult(res);
      setAssessment(res, previewUrl || undefined);
      if (res.is_demo) {
        toast.info("Demo Mode: this is an illustrative abstention, not a live analysis.");
      } else if (res.abstained || res.assessment?.status === "abstain") {
        toast.warning("The image did not support a reliable assessment. Follow the image guidance and seek clinical review.");
      } else {
        toast.success(`Assessment recorded: ${res.assessment?.prediction.display_label || res.predicted_class || "Review the findings below"}`);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
        toast.error(err.message);
      } else {
        const msg = "An unexpected failure occurred while analyzing the image.";
        setErrorMsg(msg);
        toast.error(msg);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadIllustrativeSample = async () => {
    cleanupPreviewUrl();
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setErrorMsg(null);
    setValidationNote(null);
    setIsSampleMode(true);
    setIsAnalyzing(true);

    try {
      const sampleRes = await getCuratedSampleCase();
      setResult(sampleRes);
      setAssessment(sampleRes, undefined);
      toast.info("Curated illustrative reference sample loaded for UI inspection.");
    } catch {
      toast.error("Failed to load sample reference.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAll = () => {
    cleanupPreviewUrl();
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setErrorMsg(null);
    setValidationNote(null);
    setIsSampleMode(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.info("Assessment session cleared");
  };

  return (
    <SkinAssessmentExperience
      previewUrl={previewUrl}
      fileName={selectedFile?.name ?? null}
      isAnalyzing={isAnalyzing}
      result={result}
      errorMsg={errorMsg}
      validationNote={validationNote}
      isSampleMode={isSampleMode}
      isDemoMode={false}
      onFileSelected={validateAndSelectFile}
      onAnalyze={runAssessment}
      onReset={resetAll}
      onLoadSample={loadIllustrativeSample}
      onToggleCoach={() => setShowCoach(!showCoach)}
      showCoach={showCoach}
      onViewVisitSummary={() => navigate(result?.record_id ? `/visit-summary?recordId=${result.record_id}` : "/visit-summary")}
      onNewAssessment={resetAll}
      onViewReports={() => navigate("/reports")}
      onSetReminder={() => navigate("/reminders")}
      onFindCare={() => navigate("/nearby-care")}
      loaderSlot={
        <HealthcareLoader
          label="Executing neural inference"
          sublabel="Sending the image to the authenticated FastAPI assessment service"
        />
      }
    />
  );
};

export default SkinAssessmentPage;
