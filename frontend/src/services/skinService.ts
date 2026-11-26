import type { SkinAnalysisResponse } from "../types/api";
import { getMockSkinAbstention, getCuratedSampleCase } from "./mockAdapter";
import { apiFetch } from "./apiClient";

export { getCuratedSampleCase };

export interface SkinAssessmentContext {
  symptoms?: string;
  duration?: string;
  affectedArea?: string;
}

export const analyzeSkinImage = async (
  file: File,
  isDemoMode: boolean,
  language = "en",
  context: SkinAssessmentContext = {},
): Promise<SkinAnalysisResponse> => {
  if (isDemoMode) return { ...(await getMockSkinAbstention(file.name)), is_demo: true };

  const formData = new FormData();
  formData.append("file", file);
  formData.append("language", language);
  if (context.symptoms) formData.append("symptoms", context.symptoms.slice(0, 1500));
  if (context.duration) formData.append("duration", context.duration.slice(0, 150));
  if (context.affectedArea) formData.append("affected_area", context.affectedArea.slice(0, 250));

  const result = await apiFetch<SkinAnalysisResponse>("/api/v1/skin/analyze", {
    method: "POST",
    body: formData,
  });
  return { ...result, is_demo: false };
};
