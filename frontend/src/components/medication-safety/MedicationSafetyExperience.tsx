import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  HeartPulse,
  Info,
  Moon,
  Pill,
  Plus,
  Scale,
  ShieldCheck,
  Sun,
  Trash2,
} from "lucide-react";
import type { DrugSafetyResponse } from "../../types/api";
import styles from "./MedicationSafetyExperience.module.css";

/** Mirrors the existing localStorage["dermasathi_reminders"] record. Do not change. */
export interface MedicationReminder {
  id: string | number;
  medicine: string;
  dosage: string;
  /** Existing "time" value. "HH:MM" (24h) is formatted to 12h; any other string is shown as-is. */
  time: string;
  active: boolean;
  isDemo?: boolean;
}

export interface MedicationDraft {
  medicine: string;
  dosage: string;
  time: string;
  active: boolean;
}

export interface MedicationSafetyExperienceProps {
  /** Reminders exactly as held by RemindersPage. */
  reminders: MedicationReminder[];
  /**
   * Called with the raw form values. Validation, trimming, id creation and
   * persistence stay in RemindersPage. Return `false` to keep the form
   * contents (e.g. validation failed); anything else clears the form.
   */
  onAdd: (draft: MedicationDraft) => boolean | void | Promise<boolean | void>;
  onToggle: (id: MedicationReminder["id"]) => void;
  onDelete: (id: MedicationReminder["id"]) => void;
  /** Field messages produced by the page's own validation. */
  errors?: { medicine?: string; time?: string };
  /** Page-controlled success text. If omitted, a short local confirmation is shown after a successful add. */
  successMessage?: string | null;
  /** Page-level sample / clear actions. */
  onLoadSamples?: () => void;
  onClearAll?: () => void;
  onCheckSafety?: (medications: string[], allergies: string[]) => Promise<DrugSafetyResponse>;
  /** Override the bundled lotus background. Defaults to the project's reminders asset. */
  backgroundSrc?: string;
}

const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");

const toMinutes = (t: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const formatTime = (t: string): string => {
  const mins = toMinutes(t);
  if (mins === null) return t;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

const sortByTime = (list: MedicationReminder[]) =>
  [...list].sort((a, b) => (toMinutes(a.time) ?? 1e4) - (toMinutes(b.time) ?? 1e4));

// function HeroArt() {
//   return (
//     <svg className={styles.art} viewBox="0 0 380 260" preserveAspectRatio="xMidYMid slice" data-hero-art="illustration" aria-hidden="true" focusable="false">
//       <defs>
//         <linearGradient id="msx-bottle" x1="0" y1="0" x2="1" y2="1">
//           <stop offset="0" stopColor="#7dd3fc" />
//           <stop offset="1" stopColor="#1d4ed8" />
//         </linearGradient>
//         <linearGradient id="msx-shield" x1="0" y1="0" x2="1" y2="1">
//           <stop offset="0" stopColor="#67e8f9" />
//           <stop offset="1" stopColor="#2563eb" />
//         </linearGradient>
//         <linearGradient id="msx-leaf" x1="0" y1="0" x2="1" y2="1">
//           <stop offset="0" stopColor="#86efac" />
//           <stop offset="1" stopColor="#15803d" />
//         </linearGradient>
//         <radialGradient id="msx-glow">
//           <stop offset="0" stopColor="#fff" stopOpacity=".95" />
//           <stop offset="1" stopColor="#a5f3fc" stopOpacity="0" />
//         </radialGradient>
//       </defs>
//       <circle cx="175" cy="125" r="125" fill="url(#msx-glow)" />
//       <path d="M300 255C285 190 320 150 376 125c10 55-22 105-76 130Z" fill="url(#msx-leaf)" />
//       <path d="M335 255c2-50 18-80 45-95 4 42-8 72-45 95Z" fill="#22c55e" opacity=".85" />
//       <path d="M10 255c8-42 40-62 84-62 0 32-32 56-84 62Z" fill="url(#msx-leaf)" />
//       <path d="M55 258c8-30 34-42 66-38-6 26-30 38-66 38Z" fill="#4ade80" opacity=".85" />
//       <path d="M255 34l50 18v42c0 32-22 52-50 62-28-10-50-30-50-62V52Z" fill="url(#msx-shield)" stroke="#fff" strokeWidth="5" />
//       <rect x="245" y="66" width="20" height="46" rx="4" fill="#fff" />
//       <rect x="232" y="79" width="46" height="20" rx="4" fill="#fff" />
//       <rect x="112" y="56" width="76" height="28" rx="9" fill="#e2e8f0" />
//       <rect x="118" y="82" width="64" height="14" rx="6" fill="#bae6fd" />
//       <rect x="100" y="92" width="100" height="130" rx="24" fill="url(#msx-bottle)" />
//       <rect x="110" y="104" width="11" height="102" rx="5" fill="#fff" opacity=".35" />
//       <rect x="118" y="124" width="64" height="72" rx="12" fill="#fff" opacity=".93" />
//       <rect x="143" y="134" width="14" height="52" rx="3" fill="#2563eb" />
//       <rect x="125" y="153" width="50" height="14" rx="3" fill="#2563eb" />
//       <g transform="rotate(-14 270 212)">
//         <rect x="215" y="182" width="112" height="64" rx="12" fill="#e2e8f0" stroke="#fff" strokeWidth="3" />
//         <g fill="#f8fafc">
//           <circle cx="240" cy="202" r="10" />
//           <circle cx="271" cy="202" r="10" />
//           <circle cx="302" cy="202" r="10" fill="#fbbf24" />
//           <circle cx="240" cy="228" r="10" fill="#fbbf24" />
//           <circle cx="271" cy="228" r="10" />
//           <circle cx="302" cy="228" r="10" />
//         </g>
//       </g>
//       <g transform="rotate(35 100 232)">
//         <rect x="68" y="219" width="64" height="26" rx="13" fill="#ef4444" />
//         <path d="M100 219h19a13 13 0 0 1 0 26h-19Z" fill="#2563eb" />
//       </g>
//       <ellipse cx="58" cy="240" rx="20" ry="11" fill="#fde047" transform="rotate(-20 58 240)" />
//       <g fill="#fff">
//         <circle cx="40" cy="60" r="3" />
//         <circle cx="330" cy="40" r="4" />
//         <circle cx="75" cy="110" r="2.5" />
//       </g>
//     </svg>
//   );
// }

function ReminderRow({
  reminder,
  onToggle,
  onDelete,
}: {
  reminder: MedicationReminder;
  onToggle: MedicationSafetyExperienceProps["onToggle"];
  onDelete: MedicationSafetyExperienceProps["onDelete"];
}) {
  const mins = toMinutes(reminder.time);
  const hour = mins === null ? 12 : Math.floor(mins / 60);
  const night = hour < 5 || hour >= 18;
  const morning = !night && hour < 12;
  const Icon = night ? Moon : morning ? Sun : Pill;

  return (
    <li className={styles.item}>
      <span className={cx(styles.itemIcon, night && styles.night, !night && !morning && styles.day)}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <div className={styles.itemText}>
        <strong>
          {reminder.medicine}
          {reminder.isDemo && <span className={styles.demo}>Demo data</span>}
        </strong>
        <small>{reminder.dosage || "No instructions added"}</small>
      </div>
      <span className={styles.time}>
        <Clock size={16} aria-hidden="true" />
        {formatTime(reminder.time)}
      </span>
      <button
        type="button"
        className={cx(styles.badge, reminder.active ? styles.badgeOn : styles.badgeOff)}
        aria-pressed={reminder.active}
        aria-label={`${reminder.medicine}: ${reminder.active ? "active" : "inactive"}. Toggle reminder`}
        onClick={() => onToggle(reminder.id)}
      >
        {reminder.active ? "Active" : "Inactive"}
      </button>
      <button
        type="button"
        className={styles.remove}
        aria-label={`Delete ${reminder.medicine} reminder`}
        onClick={() => onDelete(reminder.id)}
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </li>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <li className={styles.empty}>
      <span className={styles.emptyIcon}>
        <Pill size={26} aria-hidden="true" />
      </span>
      <strong>{title}</strong>
      <p>{text}</p>
    </li>
  );
}

const ESSENTIALS = [
  { Icon: ClipboardList, tone: styles.toneBlue, title: "Follow prescribed instructions", text: "Use medication according to the instructions provided by your clinician or pharmacist." },
  { Icon: Info, tone: styles.toneGreen, title: "Check medication information", text: "Review the medicine name, strength, expiry date and instructions before use." },
  { Icon: AlertTriangle, tone: styles.toneViolet, title: "Mention allergies", text: "Inform your healthcare professional about known allergies and previous reactions." },
  { Icon: HeartPulse, tone: styles.tonePeach, title: "Ask before combining medicines", text: "Consult a qualified clinician or pharmacist before combining medicines." },
];

export default function MedicationSafetyExperience({
  reminders,
  onAdd,
  onToggle,
  onDelete,
  errors,
  successMessage,
  onLoadSamples,
  onClearAll,
  onCheckSafety,
}: MedicationSafetyExperienceProps) {
  // Form inputs only. Reminder data, validation and storage live in RemindersPage.
  // The reminder time defaults to 20:00 to match the existing page behaviour.
  const [draft, setDraft] = useState<MedicationDraft>({ medicine: "", dosage: "", time: "20:00", active: true });
  const [flash, setFlash] = useState<string | null>(null);
  const [safetyMedications, setSafetyMedications] = useState("");
  const [safetyAllergies, setSafetyAllergies] = useState("");
  const [safetyLoading, setSafetyLoading] = useState(false);
  const [safetyResult, setSafetyResult] = useState<DrugSafetyResponse | null>(null);
  const [safetyError, setSafetyError] = useState<string | null>(null);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const sorted = sortByTime(reminders);
  const active = sorted.filter((r) => r.active);
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const upcomingToday = active.filter((r) => (toMinutes(r.time) ?? -1) >= nowMins).length;
  const message = successMessage === undefined ? flash : successMessage;


  async function handleSafetySubmit(e: FormEvent) {
    e.preventDefault();
    const medications = safetyMedications.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
    const allergies = safetyAllergies.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
    if (!medications.length) { setSafetyError("Enter at least one medicine name."); return; }
    if (!onCheckSafety) { setSafetyError("Medication safety service is unavailable."); return; }
    setSafetyLoading(true); setSafetyError(null); setSafetyResult(null);
    try { setSafetyResult(await onCheckSafety(medications, allergies)); }
    catch (error) { setSafetyError(error instanceof Error ? error.message : "Medication safety review failed."); }
    finally { setSafetyLoading(false); }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = await onAdd(draft);
    if (result === false) return;
    setFlash(`${draft.medicine.trim() || "Reminder"} saved.`);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFlash(null), 3500);
    setDraft({ medicine: "", dosage: "", time: "20:00", active: true });
  }

  return (
    <div className={styles.root}>
      <div className={styles.page}>
        {/* 1. Hero */}
        <section className={cx(styles.card, styles.hero)} data-feature-hero="split">
          <div data-hero-copy>
            <span className={styles.pill} data-hero-eyebrow>Medication management</span>
            <h1 className={styles.title} data-hero-title>Medication Safety &amp; Reminders</h1>
            <p className={styles.lead} data-hero-description>
              Keep your medication routine organised, stay aware of important safety considerations, and manage your reminders in one place.
            </p>
          </div>
          <img
            className={styles.art}
            src="/assets/reminders-hero-art.png"
            alt=""
            aria-hidden="true"
          />
        </section>
        <div>
          <a className={styles.link} href="#msx-int"><Scale size={16} aria-hidden="true" /> Check medication interactions and safety</a>
        </div>

        {/* 2. Overview */}
        <section className={styles.stats} aria-label="Medication overview">
          <div className={cx(styles.card, styles.stat, styles.toneBlue)}>
            <span className={cx(styles.icon, styles.iconBlue)}><Bell size={20} aria-hidden="true" /></span>
            <div><span className={styles.statLabel}>Active medication reminders</span><b className={styles.statValue}>{active.length}</b></div>
          </div>
          <div className={cx(styles.card, styles.stat, styles.toneViolet)}>
            <span className={cx(styles.icon, styles.iconViolet)}><CalendarDays size={20} aria-hidden="true" /></span>
            <div><span className={styles.statLabel}>Upcoming reminders today</span><b className={styles.statValue}>{upcomingToday}</b></div>
          </div>
          <div className={cx(styles.card, styles.stat, styles.toneGreen)}>
            <span className={cx(styles.icon, styles.iconGreen)}><Pill size={20} aria-hidden="true" /></span>
            <div><span className={styles.statLabel}>Tracked medications</span><b className={styles.statValue}>{reminders.length}</b></div>
          </div>
          <div className={cx(styles.card, styles.stat, styles.tonePeach)}>
            <span className={cx(styles.icon, styles.iconPeach)}><CheckCircle2 size={20} aria-hidden="true" /></span>
            <div><span className={styles.statLabel}>Schedule status</span><b className={cx(styles.statValue, styles.statText)}>{active.length ? "Reminders set" : "No active reminders"}</b></div>
          </div>
        </section>

        {/* 3. Add reminder */}
        <section className={styles.card} aria-labelledby="msx-add">
          <h2 id="msx-add" className={styles.heading}><span className={styles.icon}><Plus size={20} aria-hidden="true" /></span>Add a medication reminder</h2>
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <label className={styles.field}>
              <span>Medication name *</span>
              <input
                className={styles.input}
                type="text"
                value={draft.medicine}
                onChange={(e) => setDraft({ ...draft, medicine: e.target.value })}
                placeholder="e.g. Vitamin D, Calcium…"
                autoComplete="off"
                aria-invalid={Boolean(errors?.medicine)}
              />
              <span className={styles.error} role="alert">{errors?.medicine}</span>
            </label>
            <label className={styles.field}>
              <span>Reminder time *</span>
              <input
                className={styles.input}
                type="time"
                value={draft.time}
                onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                aria-invalid={Boolean(errors?.time)}
              />
              <span className={styles.error} role="alert">{errors?.time}</span>
            </label>
            <label className={styles.field}>
              <span>Dosage / instructions</span>
              <input
                className={styles.input}
                type="text"
                value={draft.dosage}
                onChange={(e) => setDraft({ ...draft, dosage: e.target.value })}
                placeholder="e.g. Once daily after food…"
              />
            </label>
            <div className={styles.formActions}>
              <span className={styles.switchRow}>
                <b>Active reminder</b>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.active}
                  aria-label="Active reminder"
                  className={styles.switch}
                  onClick={() => setDraft({ ...draft, active: !draft.active })}
                />
              </span>
              <button type="submit" className={styles.primary}><Bell size={18} aria-hidden="true" />Save reminder</button>
            </div>
          </form>
          {message && (
            <div className={styles.success} role="status"><CheckCircle2 size={18} aria-hidden="true" />{message}</div>
          )}
        </section>

        {/* 4 + 5. Schedule with active/inactive state */}
        <section className={styles.card} aria-labelledby="msx-up">
          <div className={styles.scheduleHeader}>
            <h2 id="msx-up" className={styles.heading}><span className={styles.icon}><CalendarDays size={20} aria-hidden="true" /></span>Upcoming reminders</h2>
            <div className={styles.scheduleControls}>
              {onLoadSamples && <button type="button" className={styles.btnGhost} onClick={onLoadSamples}>Load Sample</button>}
              {reminders.length > 0 && onClearAll && <button type="button" className={styles.btnGhost} onClick={onClearAll}>Clear All</button>}
            </div>
          </div>
          <ul className={styles.list}>
            {sorted.length ? (
              sorted.map((r) => <ReminderRow key={r.id} reminder={r} onToggle={onToggle} onDelete={onDelete} />)
            ) : (
              <EmptyState title="No reminders yet" text="Add your first medication reminder above." />
            )}
          </ul>
        </section>

        {/* 6. Safety essentials */}
        <section className={styles.card} aria-labelledby="msx-safe">
          <h2 id="msx-safe" className={styles.heading}><span className={styles.icon}><ShieldCheck size={20} aria-hidden="true" /></span>Medication safety essentials</h2>
          <div className={styles.essentials}>
            {ESSENTIALS.map(({ Icon, tone, title, text }) => (
              <div key={title} className={cx(styles.essential, tone)}>
                <Icon size={32} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 7. Authenticated deterministic medication safety review with AI explanations */}
        <section className={cx(styles.card, styles.notice, styles.noticeInfo)} aria-labelledby="msx-int">
          <span className={cx(styles.icon, styles.iconBlue)}><Scale size={20} aria-hidden="true" /></span>
          <div style={{ width: "100%" }}>
            <h2 id="msx-int" className={cx(styles.heading, styles.tight)}>Medication interaction and safety review</h2>
            <p>Enter the medicines exactly as printed on their packages or prescriptions. Include known allergies. This limited checker cannot establish that an unrecognized combination is safe.</p>
            <form className={styles.form} onSubmit={handleSafetySubmit}>
              <label className={styles.field}>
                <span>Medicines (separate multiple names with commas)</span>
                <textarea className={styles.input} rows={3} value={safetyMedications} onChange={(e) => setSafetyMedications(e.target.value)} placeholder="Medicine name, strength and formulation" />
              </label>
              <label className={styles.field}>
                <span>Known allergies (optional)</span>
                <input className={styles.input} value={safetyAllergies} onChange={(e) => setSafetyAllergies(e.target.value)} placeholder="e.g. penicillin, fragrance" />
              </label>
              <button type="submit" className={styles.primary} disabled={safetyLoading || !onCheckSafety}>
                {safetyLoading ? "Reviewing..." : "Check medication safety"}
              </button>
            </form>
            {safetyError && <p className={styles.error} role="alert">{safetyError}</p>}
            {safetyResult && <div className={styles.success} role="status">
              <strong>{safetyResult.safety_status.replace(/_/g, " ")}</strong>
              <p>{safetyResult.plain_language_summary || safetyResult.database_coverage_note}</p>
              {safetyResult.interaction_alerts.map((alert, index) => <p key={index}><strong>{alert.severity.toUpperCase()}: {alert.drugs_involved.join(" + ")}</strong> — {alert.clinical_effect} {alert.recommendation}</p>)}
              {safetyResult.allergy_warnings.map((warning, index) => <p key={`a-${index}`}>Allergy warning: {warning}</p>)}
              {safetyResult.condition_precautions.map((warning, index) => <p key={`c-${index}`}>{warning}</p>)}
              {safetyResult.unrecognized_medicine_explanations.map((warning, index) => <p key={`u-${index}`}>{warning}</p>)}
              <p>{safetyResult.uncertainty_note || safetyResult.clinical_disclaimer}</p>
              {safetyResult.record_id && <p>Saved clinical record #{safetyResult.record_id} in your account history.</p>}
              <small>Provider: {safetyResult.analysis_provider || "Unavailable"} · Language: {safetyResult.response_language}</small>
            </div>}
          </div>
        </section>

        {/* 8. Tracking */}
        <section className={styles.card} aria-labelledby="msx-track">
          <h2 id="msx-track" className={styles.heading}><span className={styles.icon}><Pill size={20} aria-hidden="true" /></span>Currently tracked medication reminders</h2>
          <ul className={styles.list}>
            {active.length ? (
              active.map((r) => <ReminderRow key={r.id} reminder={r} onToggle={onToggle} onDelete={onDelete} />)
            ) : (
              <EmptyState title="Nothing tracked right now" text="Activate or add a reminder to see it here." />
            )}
          </ul>
        </section>

        {/* 9. Disclaimer */}
        <section className={cx(styles.card, styles.notice, styles.noticeWarn)} aria-labelledby="msx-warn">
          <span className={cx(styles.icon, styles.iconRed)}><AlertTriangle size={20} aria-hidden="true" /></span>
          <div>
            <h2 id="msx-warn" className={cx(styles.heading, styles.tight, styles.warnTitle)}>Important safety notice</h2>
            <p>DermaSathiAI provides medication organisation and reminder support. It does not replace professional medical advice, prescribe medication or independently verify drug interactions.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
