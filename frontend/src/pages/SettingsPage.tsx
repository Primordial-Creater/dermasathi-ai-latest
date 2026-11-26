import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAppMode } from "../context/AppModeContext";
import { useToast } from "../context/ToastContext";
import { useClinical } from "../context/ClinicalContext";
import { useAuth } from "../context/AuthContext";
import { 
  Globe, 
  Cpu, 
  ShieldCheck, 
  Database, 
  Trash2, 
  CheckCircle2, 
  Sliders, 
  Info,
  Server,
  User,
  Monitor,
  Bell,
  Lock,
  Cloud,
  Mail
} from "lucide-react";
import styles from "./SettingsPage.module.css";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: [0.23, 1, 0.32, 1] },
  }),
};


type NotificationPreferences = {
  medicationReminders: boolean;
  clinicalSafetyAlerts: boolean;
};

const readNotificationPreferences = (): NotificationPreferences => {
  try {
    const raw = localStorage.getItem("dermasathi_notification_preferences");
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const value = parsed as Partial<NotificationPreferences>;
        return {
          medicationReminders: typeof value.medicationReminders === "boolean" ? value.medicationReminders : true,
          clinicalSafetyAlerts: typeof value.clinicalSafetyAlerts === "boolean" ? value.clinicalSafetyAlerts : true,
        };
      }
    }
  } catch (error) {
    console.warn("Could not read notification preferences:", error);
  }
  return { medicationReminders: true, clinicalSafetyAlerts: true };
};

const readBooleanPreference = (key: string, fallback: boolean): boolean => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === "true";
  } catch {
    return fallback;
  }
};

export const SettingsPage: React.FC = () => {
  const { isDemoMode, setDemoMode, language, setLanguage } = useAppMode();
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { latestAssessment, imagePreview, symptomsRecord, clearSession } = useClinical();
  const [clearing, setClearing] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(readNotificationPreferences);
  const [largeText, setLargeText] = useState(() => readBooleanPreference("dermasathi_large_text", false));
  const [reduceMotion, setReduceMotion] = useState(() => {
    const systemReduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    return readBooleanPreference("dermasathi_reduce_motion", Boolean(systemReduced));
  });

  useEffect(() => {
    document.documentElement.dataset.textScale = largeText ? "large" : "normal";
    localStorage.setItem("dermasathi_large_text", String(largeText));
  }, [largeText]);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = reduceMotion ? "on" : "off";
    localStorage.setItem("dermasathi_reduce_motion", String(reduceMotion));
  }, [reduceMotion]);

  useEffect(() => {
    localStorage.setItem("dermasathi_notification_preferences", JSON.stringify(notificationPrefs));
  }, [notificationPrefs]);

  const handleToggleMode = () => {
    if (user) {
      setDemoMode(false);
      toast.success("Live API mode is active for your authenticated account.");
      return;
    }
    if (isDemoMode) {
      toast.warning("Sign in with a patient account to use live clinical services.");
      navigate("/login");
      return;
    }
    setDemoMode(true);
    toast.info("Local demonstration mode enabled. Sign in to access real clinical services.");
  };

  const handleLanguageChange = (newLang: "en" | "hi" | "mr") => {
    setLanguage(newLang);
    const label = {
      en: "English (EN)",
      hi: "हिंदी (Hindi)",
      mr: "मराठी (Marathi)",
    }[newLang];
    toast.success(`Platform language set to ${label}`);
  };

  const handleClearCache = () => {
    if (clearing) return;
    const confirmed = window.confirm(
      "Clear the current session's skin assessment, symptom record and locally saved medication reminders? This cannot be undone."
    );
    if (!confirmed) return;
    setClearing(true);
    try {
      clearSession();
      localStorage.removeItem("dermasathi_reminders");
      setClearing(false);
      toast.success("Current clinical session and local reminders cleared.");
    } catch (error) {
      console.error("Failed to clear local session data:", error);
      setClearing(false);
      toast.error("Failed to clear local session cache.");
    }
  };

  const handleExport = () => {
    try {
      let reminders: unknown[] = [];
      const rawReminders = localStorage.getItem("dermasathi_reminders");
      if (rawReminders) {
        const parsed = JSON.parse(rawReminders);
        reminders = Array.isArray(parsed) ? parsed : [];
      }
      const exportData = {
        product: "DermaSathiAI",
        exportedAt: new Date().toISOString(),
        dataScope: "Current browser session and locally stored reminders only; not a complete medical history.",
        clinicalSession: {
          assessment: latestAssessment,
          symptoms: symptomsRecord,
          imagePreviewAvailable: Boolean(imagePreview),
          imageBinaryIncluded: false,
        },
        reminders,
        preferences: {
          language,
          isDemoMode,
          notificationPrefs,
          largeText,
          reduceMotion,
        },
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `dermasathiai-local-records-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Local session data export downloaded.");
    } catch (error) {
      console.error("Local data export failed:", error);
      toast.error("Could not export local records. Check browser storage permissions.");
    }
  };

  const updateNotification = (key: keyof NotificationPreferences, checked: boolean) => {
    setNotificationPrefs((current) => ({ ...current, [key]: checked }));
  };

  return (
    <div className={styles.settingsContainer}>
      <motion.div
        className={styles.header}
        data-feature-hero="text"
        initial="hidden"
        animate="visible"
        custom={0}
        variants={fadeUp}
      >
        <div className={styles.badgePill} data-hero-eyebrow>
          <Sliders size={14} />
          <span>SYSTEM & LANGUAGE CONFIGURATION</span>
        </div>
        <h1 className={styles.title} data-hero-title>Language & Platform Settings</h1>
        <p className={styles.subtitle} data-hero-description>
          Configure regional linguistic scripts, computational backend endpoints, and client-side data privacy parameters.
        </p>
      </motion.div>

      <div className={styles.settingsGrid}>
        {/* Section 1: Regional Language Preferences */}
        <motion.section
          className={styles.card}
          initial="hidden"
          animate="visible"
          custom={1}
          variants={fadeUp}
        >
          <div className={styles.cardHeader}>
            <div className={styles.cardIconCircle} style={{ background: "var(--pastel-blue-bg)", color: "var(--pastel-blue-text)" }}>
              <Globe size={20} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>Regional Clinical Language</h2>
              <p className={styles.cardDesc}>Select the primary language for medical guidance and symptom questionnaires.</p>
            </div>
          </div>

          <div className={styles.languageOptions}>
            <button
              type="button"
              onClick={() => handleLanguageChange("en")}
              className={`${styles.langSelectCard} ${language === "en" ? styles.langSelectActive : ""}`}
            >
              <div className={styles.langNameRow}>
                <strong>English</strong>
                {language === "en" && <CheckCircle2 size={16} color="#0d9488" />}
              </div>
              <span>Medical Standard (EN)</span>
            </button>

            <button
              type="button"
              onClick={() => handleLanguageChange("hi")}
              className={`${styles.langSelectCard} ${language === "hi" ? styles.langSelectActive : ""}`}
            >
              <div className={styles.langNameRow}>
                <strong>हिंदी</strong>
                {language === "hi" && <CheckCircle2 size={16} color="#0d9488" />}
              </div>
              <span>Hindi Clinical Translation (HI)</span>
            </button>

            <button
              type="button"
              onClick={() => handleLanguageChange("mr")}
              className={`${styles.langSelectCard} ${language === "mr" ? styles.langSelectActive : ""}`}
            >
              <div className={styles.langNameRow}>
                <strong>मराठी</strong>
                {language === "mr" && <CheckCircle2 size={16} color="#0d9488" />}
              </div>
              <span>Marathi Clinical Translation (MR)</span>
            </button>
          </div>
        </motion.section>

        {/* Section 2: Engine Execution Mode */}
        <motion.section
          className={styles.card}
          initial="hidden"
          animate="visible"
          custom={2}
          variants={fadeUp}
        >
          <div className={styles.cardHeader}>
            <div className={styles.cardIconCircle} style={{ background: "var(--pastel-mint-bg)", color: "var(--pastel-mint-text)" }}>
              <Cpu size={20} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>Execution & Triage Engine</h2>
              <p className={styles.cardDesc}>Toggle between synthetic interactive simulation and live backend neural inference.</p>
            </div>
          </div>

          <div className={styles.modeControlRow}>
            <div className={styles.modeInfo}>
              <span className={styles.modeStatusLabel}>Current Active Engine:</span>
              <div className={styles.modeBadgeRow}>
                <span className={isDemoMode ? styles.badgeDemo : styles.badgeReal}>
                  {isDemoMode ? "Interactive Simulation Sandbox (Demo)" : "Production FastAPI Live Inference"}
                </span>
              </div>
              <p className={styles.modeExplanation}>
                {isDemoMode
                  ? "Uses simulated local response pipelines to protect arbitrary user images from unverified automated diagnoses."
                  : "Communicates directly with the secure FastAPI endpoints configured at localhost:8000."}
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggleMode}
              className={styles.toggleModeBtn}
              disabled={Boolean(user)}
            >
              {user ? "Live API Mode Enforced" : isDemoMode ? "Sign In for Live API" : "Enable Demo Preview"}
            </button>
          </div>

          <div className={styles.endpointBox}>
            <Server size={14} className={styles.endpointIcon} />
            <span className={styles.endpointText}>
              Backend Target: <code>{import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}</code>
            </span>
          </div>
        </motion.section>

        {/* Section 3: Client-Side Data & Privacy Management */}
        <motion.section
          className={styles.card}
          initial="hidden"
          animate="visible"
          custom={3}
          variants={fadeUp}
        >
          <div className={styles.cardHeader}>
            <div className={styles.cardIconCircle} style={{ background: "var(--pastel-purple-bg)", color: "var(--pastel-purple-text)" }}>
              <Database size={20} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>Local Session Storage & Cache</h2>
              <p className={styles.cardDesc}>Manage photos, symptoms, and medication reminders saved on this browser.</p>
            </div>
          </div>

          <div className={styles.privacyNotice}>
            <ShieldCheck size={16} color="#0d9488" />
            <p>
              DermaSathiAI keeps patient photos in-memory during triage. Session records and medication adherence notes reside entirely within your browser's private local storage.
            </p>
          </div>

          <div className={styles.clearRow}>
            <div>
              <strong className={styles.clearTitle}>Reset Active Session Cache</strong>
              <p className={styles.clearDesc}>Purges all locally saved medication reminders and triage questionnaires.</p>
            </div>
            <button
              type="button"
              disabled={clearing}
              onClick={handleClearCache}
              className={styles.clearBtn}
            >
              <Trash2 size={15} />
              <span>{clearing ? "Clearing..." : "Purge Session Cache"}</span>
            </button>
          </div>
        </motion.section>

        {/* Section 4: Clinical Safety Policy */}
        <motion.section
          className={styles.card}
          initial="hidden"
          animate="visible"
          custom={4}
          variants={fadeUp}
        >
          <div className={styles.cardHeader}>
            <div className={styles.cardIconCircle} style={{ background: "var(--pastel-amber-bg)", color: "var(--pastel-amber-text)" }}>
              <Info size={20} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>Clinical Safety & Regulatory Protocol</h2>
              <p className={styles.cardDesc}>Decision-support principles and non-diagnostic boundaries.</p>
            </div>
          </div>

          <div className={styles.safetyList}>
            <div className={styles.safetyItem}>
              <CheckCircle2 size={15} color="#16a34a" />
              <span>Calibrated Confidence Thresholds: Visual correlation patterns never manufacture certainty.</span>
            </div>
            <div className={styles.safetyItem}>
              <CheckCircle2 size={15} color="#16a34a" />
              <span>Non-Diagnostic Rule: All outputs are structured anamnesis aids for medical specialists.</span>
            </div>
            <div className={styles.safetyItem}>
              <CheckCircle2 size={15} color="#16a34a" />
              <span>Emergency Triage: Acute fever, rapid lesion growth, or ulceration require emergency care (112).</span>
            </div>
          </div>
        </motion.section>

        {/* Section 5: Account & Profile */}
        <motion.section
          className={styles.card}
          initial="hidden"
          animate="visible"
          custom={5}
          variants={fadeUp}
        >
          <div className={styles.cardHeader}>
            <div className={styles.cardIconCircle} style={{ background: "var(--pastel-blue-bg)", color: "var(--pastel-blue-text)" }}>
              <User size={20} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>Account & Profile</h2>
              <p className={styles.cardDesc}>Manage your personal profile and clinical contact details.</p>
            </div>
          </div>

          <div className={styles.settingsFormGroup}>
            <label className={styles.settingsLabel}>Display Name</label>
            <input type="text" className={styles.settingsInput} placeholder="Your name" defaultValue="Demo User" readOnly />
            <span className={styles.fieldNote}>Local profile — backend synchronization pending.</span>
          </div>

          <div className={styles.settingsFormGroup}>
            <label className={styles.settingsLabel}>Registered Email</label>
            <input type="email" className={styles.settingsInput} placeholder="name@example.com" defaultValue="demo@dermasathi.org" readOnly />
            <span className={styles.fieldNote}>Email changes require backend verification.</span>
          </div>
        </motion.section>

        {/* Section 6: Appearance */}
        <motion.section
          className={styles.card}
          initial="hidden"
          animate="visible"
          custom={6}
          variants={fadeUp}
        >
          <div className={styles.cardHeader}>
            <div className={styles.cardIconCircle} style={{ background: "var(--pastel-purple-bg)", color: "var(--pastel-purple-text)" }}>
              <Monitor size={20} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>Appearance</h2>
              <p className={styles.cardDesc}>Interface theme and visual preferences.</p>
            </div>
          </div>

          <div className={styles.settingsFormGroup}>
            <label className={styles.settingsLabel}>Color Theme</label>
            <div className={styles.themeOptions}>
              <button type="button" className={styles.themeOptionActive}>
                <div className={styles.themeSwatch} style={{ background: "var(--canvas-bg)" }} />
                <span>Luminous Bio-Interface (Light)</span>
              </button>
              <button type="button" className={styles.themeOption} disabled aria-disabled="true" title="Dark theme is not implemented yet">
                <div className={styles.themeSwatch} style={{ background: "var(--slate-900)" }} />
                <span>Clinical Dark (Coming Soon)</span>
              </button>
            </div>
            <span className={styles.fieldNote}>Dark theme requires backend design tokens.</span>
          </div>
        </motion.section>

        {/* Section 7: Notifications */}
        <motion.section
          className={styles.card}
          initial="hidden"
          animate="visible"
          custom={7}
          variants={fadeUp}
        >
          <div className={styles.cardHeader}>
            <div className={styles.cardIconCircle} style={{ background: "var(--feat-medicine-bg)", color: "var(--feat-medicine-text)" }}>
              <Bell size={20} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>Notifications</h2>
              <p className={styles.cardDesc}>Medication reminders and health alert preferences.</p>
            </div>
          </div>

          <div className={styles.settingsFormGroup}>
            <label className={styles.toggleLabel}>
              <input type="checkbox" checked={notificationPrefs.medicationReminders} onChange={(event) => updateNotification("medicationReminders", event.target.checked)} />
              <span>Medication Reminder Alerts</span>
            </label>
            <span className={styles.fieldNote}>Saved as local preferences only. No background or server notification delivery is connected yet.</span>
          </div>

          <div className={styles.settingsFormGroup}>
            <label className={styles.toggleLabel}>
              <input type="checkbox" checked={notificationPrefs.clinicalSafetyAlerts} onChange={(event) => updateNotification("clinicalSafetyAlerts", event.target.checked)} />
              <span>Clinical Safety Alerts</span>
            </label>
            <span className={styles.fieldNote}>Urgent care triage notifications.</span>
          </div>
        </motion.section>

        {/* Section 8: Privacy & Security */}
        <motion.section
          className={styles.card}
          initial="hidden"
          animate="visible"
          custom={8}
          variants={fadeUp}
        >
          <div className={styles.cardHeader}>
            <div className={styles.cardIconCircle} style={{ background: "var(--feat-skin-bg)", color: "var(--feat-skin-text)" }}>
              <Lock size={20} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>Privacy & Security</h2>
              <p className={styles.cardDesc}>Data handling, local storage, and consent preferences.</p>
            </div>
          </div>

          <div className={styles.settingsPrivacyGrid}>
            <div className={styles.privacyItem}>
              <Cloud size={18} />
              <div>
                <strong>Cloud Synchronization</strong>
                <p className={styles.privacySubtext}>Disabled — all data stays local in this preview.</p>
              </div>
            </div>
            <div className={styles.privacyItem}>
              <Mail size={18} />
              <div>
                <strong>Marketing Emails</strong>
                <p className={styles.privacySubtext}>Opted out by default in demo mode.</p>
              </div>
            </div>
            <div className={styles.privacyItem}>
              <ShieldCheck size={18} />
              <div>
                <strong>Clinical Data Retention</strong>
                <p className={styles.privacySubtext}>Session data cleared on cache purge.</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Section 9: Accessibility */}
        <motion.section
          className={styles.card}
          initial="hidden"
          animate="visible"
          custom={9}
          variants={fadeUp}
        >
          <div className={styles.cardHeader}>
            <div className={styles.cardIconCircle} style={{ background: "var(--feat-wellness-bg)", color: "var(--feat-wellness-text)" }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>Accessibility</h2>
              <p className={styles.cardDesc}>Reduced motion, contrast, and text size preferences.</p>
            </div>
          </div>

          <div className={styles.settingsFormGroup}>
            <label className={styles.settingsLabel}>Reduce Motion</label>
            <div className={styles.toggleRow}>
              <label className={styles.toggleLabel}>
                <input type="checkbox" checked={reduceMotion} onChange={(event) => setReduceMotion(event.target.checked)} />
                <span>Reduce interface animations</span>
              </label>
              <span className={styles.statusBadge}>{reduceMotion ? "On" : "Off"}</span>
            </div>
            <span className={styles.fieldNote}>Defaults to your system preference and can be changed here.</span>
          </div>

          <div className={styles.settingsFormGroup}>
            <label className={styles.settingsLabel}>Text Size</label>
            <div className={styles.textSizeOptions}>
              <button type="button" aria-pressed={!largeText} onClick={() => setLargeText(false)} className={!largeText ? styles.textSizeBtnActive : styles.textSizeBtn}>Standard</button>
              <button type="button" aria-pressed={largeText} onClick={() => setLargeText(true)} className={largeText ? styles.textSizeBtnActive : styles.textSizeBtn}>Large</button>
            </div>
            <span className={styles.fieldNote}>Large text increases the root interface scale and is saved on this device.</span>
          </div>
        </motion.section>

        {/* Section 10: Data Management */}
        <motion.section
          className={styles.card}
          initial="hidden"
          animate="visible"
          custom={10}
          variants={fadeUp}
        >
          <div className={styles.cardHeader}>
            <div className={styles.cardIconCircle} style={{ background: "var(--feat-nearbycare-bg)", color: "var(--feat-nearbycare-text)" }}>
              <Database size={20} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>Data Management</h2>
              <p className={styles.cardDesc}>Export, import, and purge local clinical session data.</p>
            </div>
          </div>

          <div className={styles.settingsFormGroup}>
            <label className={styles.settingsLabel}>Export Session Data</label>
            <button type="button" onClick={handleExport} className={styles.exportBtn}>
              <Cloud size={16} />
              <span>Download Local Records</span>
            </button>
            <span className={styles.fieldNote}>Exports current assessment and symptom session data, locally stored reminders and preferences. Image files and credentials are not included.</span>
          </div>

          <div className={styles.settingsFormGroup}>
            <label className={styles.settingsLabel}>Purge All Local Data</label>
            <button type="button" onClick={handleClearCache} disabled={clearing} className={styles.purgeBtn}>
              <Trash2 size={16} />
              <span>{clearing ? "Clearing..." : "Purge All Session Data"}</span>
            </button>
          </div>
        </motion.section>

        {/* Section 11: About & Legal */}
        <motion.section
          className={styles.card}
          initial="hidden"
          animate="visible"
          custom={11}
          variants={fadeUp}
        >
          <div className={styles.cardHeader}>
            <div className={styles.cardIconCircle} style={{ background: "var(--feat-healthhistory-bg)", color: "var(--feat-healthhistory-text)" }}>
              <Info size={20} />
            </div>
            <div>
              <h2 className={styles.cardTitle}>About & Legal</h2>
              <p className={styles.cardDesc}>Product version, safety disclaimers, and legal information.</p>
            </div>
          </div>

          <div className={styles.settingsFormGroup}>
            <label className={styles.settingsLabel}>Product Version</label>
            <span className={styles.versionText}>DermaSathiAI Frontend v0.2.0 (Preview)</span>
            <span className={styles.fieldNote}>Backend API contract pending finalization.</span>
          </div>

          <div className={styles.settingsFormGroup}>
            <label className={styles.settingsLabel}>Safety Disclaimer</label>
            <p className={styles.disclaimerText}>
              DermaSathiAI is an assistive health companion. It does not provide medical diagnoses, prescribe treatments, or replace professional clinical care. Always consult a qualified healthcare provider.
            </p>
          </div>

          <div className={styles.settingsFormGroup}>
            <label className={styles.settingsLabel}>Demo Mode Status</label>
            <span className={isDemoMode ? styles.badgeDemo : styles.badgeReal}>
              {isDemoMode ? "Interactive Simulation Sandbox" : "Live API Mode"}
            </span>
            <span className={styles.fieldNote}>Execution mode can be changed here. This control is intentionally kept out of the global header.</span>
          </div>
        </motion.section>
      </div>
    </div>
  );
};

export default SettingsPage;