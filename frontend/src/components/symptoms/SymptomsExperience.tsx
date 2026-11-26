import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, RotateCcw } from "lucide-react";
import styles from "./SymptomsExperience.module.css";

/* ------------------------------------------------------------------ types */

export interface SymptomOption {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface SymptomSection {
  id: string;
  title: string;
  prompt?: string;
  /** single: one choice. multi: many choices. text: free text only. */
  kind: "single" | "multi" | "text";
  options?: SymptomOption[];
  /** The mutually exclusive "None of the above" option. */
  exclusive?: SymptomOption;
  /** Selecting any non-exclusive option here raises the urgent warning. */
  isRedFlag?: boolean;
  required?: boolean;
  requiredMessage?: string;
  /** Adds a free-text box (max length) under the options. */
  textMax?: number;
  textLabel?: string;
  textPlaceholder?: string;
  /** Optional slot, e.g. an anatomical illustration beside the options. */
  visual?: ReactNode;
}

export interface SectionValue {
  selected: string[];
  text?: string;
}
export type SymptomFormValue = Record<string, SectionValue>;

export interface SymptomsExperienceProps {
  /** Wording shown when any red flag is selected. Must come from the clinical source. */
  urgentWarning: ReactNode;
  /** The six configured sections, in display order. Required: there is no default. */
  sections: SymptomSection[];
  defaultValue?: SymptomFormValue;
  /** Data applied by "Load Sample". */
  sample?: SymptomFormValue;
  disclaimer?: ReactNode;
  /** Controlled by the page: idle | saving | saved | error. */
  saveStatus?: "idle" | "saving" | "saved" | "error";
  saveSuccessMessage?: ReactNode;
  saveErrorMessage?: ReactNode;
  title?: string;
  subtitle?: string;
  intro?: string;
  heroImageUrl?: string | null;
  /** Decorative artwork rendered on the right of the hero, instead of heroImageUrl. */
  heroSlot?: ReactNode;
  /** Faint blurred page backdrop. */
  backdropImageUrl?: string | null;
  theme?: "light" | "dark" | "auto";
  onChange?: (value: SymptomFormValue) => void;
  /** Fired instead of onSave when a required section is empty. */
  onValidationError?: (sectionId: string, message: string) => void;
  onSave?: (value: SymptomFormValue) => void;
  onClear?: () => void;
  onLoadSample?: () => void;
  /** Custom visual for a section, e.g. the anatomical body map. */
  renderVisual?: (
    section: SymptomSection,
    value: SectionValue,
    select: (optionId: string) => void,
  ) => ReactNode;
}

/* -------------------------------------------------------------- component */

const EMPTY: SectionValue = { selected: [] };

export default function SymptomsExperience({
  urgentWarning,
  sections,
  defaultValue,
  sample,
  disclaimer,
  saveStatus = "idle",
  saveSuccessMessage = "Saved to Clinical Dossier.",
  saveErrorMessage = "Could not save. Please try again.",
  title = "Symptom Checker",
  subtitle = "Describe your skin concerns for better guidance.",
  intro = "Tell us about your symptoms, and we’ll help you organise the information for your healthcare provider.",
  heroImageUrl,
  heroSlot,
  backdropImageUrl,
  theme = "auto",
  onChange,
  onValidationError,
  onSave,
  onClear,
  onLoadSample,
  renderVisual,
}: SymptomsExperienceProps) {
  const uid = useId();
  const [value, setValue] = useState<SymptomFormValue>(defaultValue ?? {});
  const [showErrors, setShowErrors] = useState(false);

  const get = (id: string): SectionValue => value[id] ?? EMPTY;
  const update = (next: SymptomFormValue) => {
    setValue(next);
    onChange?.(next);
  };
  const patch = (id: string, p: Partial<SectionValue>) =>
    update({ ...value, [id]: { ...get(id), ...p } });

  const toggle = (s: SymptomSection, id: string) => {
    const cur = get(s.id).selected;
    if (s.kind === "single" || id === s.exclusive?.id) {
      return patch(s.id, { selected: cur.includes(id) ? [] : [id] });
    }
    const base = cur.filter((x) => x !== s.exclusive?.id);
    patch(s.id, { selected: base.includes(id) ? base.filter((x) => x !== id) : [...base, id] });
  };

  const hasInput = (s: SymptomSection) => get(s.id).selected.length > 0 || !!get(s.id).text?.trim();
  const isValid = (s: SymptomSection) => {
    if (s.kind === "text") return !s.required || !!get(s.id).text?.trim();
    if (s.required && get(s.id).selected.length === 0) return false;
    return true;
  };

  const done = sections.filter((s) => isValid(s) && hasInput(s)).length;
  const requiredSections = sections.filter((s) => s.required);
  const requiredDone = requiredSections.filter((s) => isValid(s) && hasInput(s)).length;
  const urgent = sections.some(
    (s) => s.isRedFlag && get(s.id).selected.some((x) => x !== s.exclusive?.id),
  );

  const save = () => {
    setShowErrors(true);
    const bad = sections.find((s) => !isValid(s));
    if (bad) {
      onValidationError?.(bad.id, bad.requiredMessage ?? "Please complete this section.");
      document
        .getElementById(`${uid}-${bad.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    onSave?.(value);
  };
  const clear = () => {
    update({});
    setShowErrors(false);
    onClear?.();
  };
  const load = () => {
    if (sample) update(sample);
    setShowErrors(false);
    onLoadSample?.();
  };

  /* Rendered as a plain element, not a component declared in the render body:
     a locally-declared component type changes identity on every render and
     remounts every chip, which drops keyboard focus after each selection. */
  const chip = (key: string, s: SymptomSection, o: SymptomOption, on: boolean) => (
    <button
      key={key}
      type="button"
      className={[
        styles.chip,
        o.icon ? "" : styles.chipPlain,
        s.isRedFlag && o.id !== s.exclusive?.id ? styles.chipFlag : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-pressed={on}
      onClick={() => toggle(s, o.id)}
    >
      {o.icon && <span className={styles.chipIcon}>{o.icon}</span>}
      {o.label}
    </button>
  );

  const rootStyle = backdropImageUrl
    ? ({ ["--sx-backdrop" as string]: `url("${backdropImageUrl}")` } as CSSProperties)
    : undefined;

  return (
    <div className={styles.root} data-theme={theme === "auto" ? undefined : theme} style={rootStyle}>
      <header
        className={`${styles.card} ${styles.hero}`}
        data-feature-hero="symptoms"
        style={
          heroImageUrl
            ? ({ ["--sx-hero" as string]: `url("${heroImageUrl}")` } as CSSProperties)
            : undefined
        }
      >
        <div className={styles.heroCopy} data-hero-copy>
          <span className={styles.tag} data-hero-eyebrow>SYMPTOMS</span>
          <h1 data-hero-title>{title}</h1>
          <h2 data-hero-subtitle>{subtitle}</h2>
          <p data-hero-description>{intro}</p>
        </div>
        {(heroSlot || heroImageUrl) && (
          <div className={styles.heroArt} data-hero-art="illustration" aria-hidden={heroSlot ? undefined : true}>
            {heroSlot}
          </div>
        )}
      </header>

      <div className={`${styles.card} ${styles.progress}`}>
        <span id={`${uid}-pt`}>
          {requiredDone} of {requiredSections.length} required fields complete
        </span>
        <div
          className={styles.bar}
          role="progressbar"
          aria-labelledby={`${uid}-pt`}
          aria-valuemin={0}
          aria-valuemax={requiredSections.length}
          aria-valuenow={requiredDone}
        >
          <i style={{ width: `${(requiredDone / Math.max(1, requiredSections.length)) * 100}%` }} />
        </div>
        <span className={styles.progressNote}>{done} sections started</span>
      </div>

      {sections.map((s, n) => {
        const v = get(s.id);
        const invalid = showErrors && !isValid(s);
        const flagged = s.isRedFlag && urgent;
        const customVisual = renderVisual?.(s, v, (id) => toggle(s, id)) ?? null;
        const hasVisual = !!s.visual || !!customVisual;
        return (
          <section
            key={s.id}
            id={`${uid}-${s.id}`}
            className={styles.card}
            data-tone={n % 6}
            data-done={isValid(s) && hasInput(s)}
            data-invalid={invalid}
            data-flag={!!flagged}
            data-visual={hasVisual ? "true" : undefined}
            style={{ ["--i" as string]: n } as CSSProperties}
            aria-labelledby={`${uid}-${s.id}-h`}
          >
            <h3 id={`${uid}-${s.id}-h`}>
              <span className={styles.num}>{n + 1}</span>
              {s.title}
            </h3>
            {s.prompt && <p className={styles.sub}>{s.prompt}</p>}

            <div className={styles.body}>
              {hasVisual && <div className={styles.visual}>{s.visual ?? customVisual}</div>}
              <div>
                {s.options && (
                  <div className={styles.chips} role="group" aria-label={s.title}>
                    {s.options.map((o) => chip(o.id, s, o, v.selected.includes(o.id)))}
                    {s.exclusive &&
                      chip(s.exclusive.id, s, s.exclusive, v.selected.includes(s.exclusive.id))}
                  </div>
                )}
                {(s.textMax || s.kind === "text") && (
                  <>
                    {s.textLabel && (
                      <label className={styles.label} htmlFor={`${uid}-${s.id}-t`}>
                        {s.textLabel}
                      </label>
                    )}
                    <textarea
                      id={`${uid}-${s.id}-t`}
                      className={styles.textarea}
                      maxLength={s.textMax}
                      value={v.text ?? ""}
                      placeholder={s.textPlaceholder}
                      onChange={(e) => patch(s.id, { text: e.target.value })}
                    />
                    {s.textMax && (
                      <div className={styles.count}>
                        {(v.text ?? "").length}/{s.textMax}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {s.isRedFlag && urgent && (
              <div className={styles.warn} role="alert">
                <AlertTriangle size={22} aria-hidden="true" />
                <div>{urgentWarning}</div>
              </div>
            )}
            {invalid && (
              <p className={styles.error} role="alert">
                {s.requiredMessage ?? "Please complete this section."}
              </p>
            )}
          </section>
        );
      })}

      {saveStatus === "saved" && (
        <div className={`${styles.card} ${styles.success}`} role="status">
          <CheckCircle2 size={24} aria-hidden="true" />
          <div>{saveSuccessMessage}</div>
        </div>
      )}
      {saveStatus === "error" && (
        <div className={`${styles.card} ${styles.failure}`} role="alert">
          <AlertTriangle size={22} aria-hidden="true" />
          <div>{saveErrorMessage}</div>
        </div>
      )}

      <div className={`${styles.card} ${styles.actions}`}>
        <button type="button" className={styles.btn} onClick={load}>
          Load Sample
        </button>
        <button type="button" className={styles.btn} onClick={clear}>
          <RotateCcw size={16} aria-hidden="true" /> Clear
        </button>
        <span className={styles.spacer} />
        <button
          type="button"
          className={`${styles.btn} ${styles.primary}`}
          onClick={save}
          disabled={saveStatus === "saving"}
        >
          {saveStatus === "saving" ? "Saving…" : "Save to Clinical Dossier"}
        </button>
      </div>

      {disclaimer && <p className={styles.disclaimer}>{disclaimer}</p>}
    </div>
  );
}