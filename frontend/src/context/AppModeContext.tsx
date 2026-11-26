import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import en from "../locales/en.json";
import hi from "../locales/hi.json";
import mr from "../locales/mr.json";

export type LanguageCode =
  | "en" | "as" | "bn" | "brx" | "doi" | "gu" | "hi" | "kn" | "ks"
  | "kok" | "mai" | "ml" | "mni" | "mr" | "ne" | "or" | "pa" | "sa"
  | "sat" | "sd" | "ta" | "te" | "ur";

export const SUPPORTED_LANGUAGES: Array<{ code: LanguageCode; name: string }> = [
  { code: "en", name: "English" }, { code: "as", name: "Assamese" },
  { code: "bn", name: "Bengali" }, { code: "brx", name: "Bodo" },
  { code: "doi", name: "Dogri" }, { code: "gu", name: "Gujarati" },
  { code: "hi", name: "Hindi" }, { code: "kn", name: "Kannada" },
  { code: "ks", name: "Kashmiri" }, { code: "kok", name: "Konkani" },
  { code: "mai", name: "Maithili" }, { code: "ml", name: "Malayalam" },
  { code: "mni", name: "Manipuri (Meitei)" }, { code: "mr", name: "Marathi" },
  { code: "ne", name: "Nepali" }, { code: "or", name: "Odia" },
  { code: "pa", name: "Punjabi" }, { code: "sa", name: "Sanskrit" },
  { code: "sat", name: "Santali" }, { code: "sd", name: "Sindhi" },
  { code: "ta", name: "Tamil" }, { code: "te", name: "Telugu" },
  { code: "ur", name: "Urdu" },
];

// The application interface currently has complete dictionaries for these languages.
// SUPPORTED_LANGUAGES remains available to AI-response features independently.
export const APP_INTERFACE_LANGUAGES = SUPPORTED_LANGUAGES.filter(
  ({ code }) => code === "en" || code === "hi" || code === "mr",
);

interface AppModeContextType {
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  setDemoMode: (value: boolean) => void;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
}

const translations: Record<string, Record<string, string>> = { en, hi, mr };
const isLanguageCode = (value: string | null): value is LanguageCode =>
  Boolean(value && APP_INTERFACE_LANGUAGES.some((language) => language.code === value));

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

export const AppModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    // One-time migration from the previous default-Demo behaviour. Real API
    // mode is now the default; Demo Mode must be an explicit user choice.
    const version = localStorage.getItem("dermasathi_mode_version");
    if (version !== "2") {
      localStorage.setItem("dermasathi_mode_version", "2");
      localStorage.setItem("dermasathi_mode", "real");
      return false;
    }
    return localStorage.getItem("dermasathi_mode") === "demo";
  });

  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem("dermasathi_lang");
    return isLanguageCode(saved) ? saved : "en";
  });

  const setDemoMode = useCallback((value: boolean) => {
    setIsDemoMode(value);
    localStorage.setItem("dermasathi_mode_version", "2");
    localStorage.setItem("dermasathi_mode", value ? "demo" : "real");
  }, []);

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode((current) => {
      const next = !current;
      localStorage.setItem("dermasathi_mode_version", "2");
      localStorage.setItem("dermasathi_mode", next ? "demo" : "real");
      return next;
    });
  }, []);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem("dermasathi_lang", lang);
  };

  const t = (key: string): string => {
    // Static interface translations currently exist for English, Hindi and Marathi.
    // AI-generated clinical responses may use all 23 backend-supported languages.
    const currentDict = translations[language] || translations.en;
    return currentDict[key] || translations.en[key] || key;
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <AppModeContext.Provider value={{ isDemoMode, toggleDemoMode, setDemoMode, language, setLanguage, t }}>
      {children}
    </AppModeContext.Provider>
  );
};

export const useAppMode = () => {
  const context = useContext(AppModeContext);
  if (!context) throw new Error("useAppMode must be used within an AppModeProvider");
  return context;
};
