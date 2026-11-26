import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Info,
  ListChecks,
  MapPin,
  Pill,
  Printer,
  ScanLine,
  Stethoscope,
  Zap,
} from "lucide-react";
import styles from "./VisitDossierExperience.module.css";

/* ------------------------------------------------------------------ *
 * View model
 *
 * This is a presentation-only shape. VisitSummaryPage maps its existing
 * ClinicalContext / types/api.ts data into it (see INTEGRATION.md).
 * Every field is optional: anything missing renders an honest empty
 * state. The component never fabricates values.
 * ------------------------------------------------------------------ */

export interface DossierSkinAssessment {
  /** Human-readable status, e.g. the page's own label for the assessment state. */
  statusLabel?: string | null;
  /** Prediction status label exactly as the page wants it shown. */
  predictionStatus?: string | null;
  /** Confidence as a percentage from 0 to 100. Omit if unavailable. */
  confidencePercent?: number | null;
  imageQuality?: string | null;
  /** True when the model abstained from giving a prediction. */
  abstained?: boolean | null;
  abstentionReason?: string | null;
  /** Professional-review label/recommendation text from the existing data. */
  professionalReview?: string | null;
  /** Message returned with the assessment, if any. */
  message?: string | null;
  imageUrl?: string | null;
  imageAlt?: string;
}

export interface DossierSymptoms {
  onsetDuration?: string | null;
  primaryLocation?: string | null;
  primarySensation?: string | null;
  additionalObservations?: string | null;
}

export interface DossierDocuments {
  count: number;
  ocrStatus?: string | null;
  /** Optional note shown beside OCR status (e.g. awaiting document-processing service). */
  ocrMessage?: string | null;
}

export interface DossierMedication {
  /** Number of active reminders, or null if unknown. */
  activeReminderCount?: number | null;
}

export interface DossierHistoricalRecordSection {
  title: string;
  items: string[];
}

export interface DossierHistoricalRecord {
  title: string;
  createdAt: string;
  sessionType: string;
  language: string;
  summary: string;
  sections: DossierHistoricalRecordSection[];
  loading?: boolean;
  error?: string | null;
}

export interface VisitDossierViewModel {
  hasVisitRecord: boolean;
  skin?: DossierSkinAssessment | null;
  symptoms?: DossierSymptoms | null;
  documents?: DossierDocuments | null;
  medication?: DossierMedication | null;
  historicalRecord?: DossierHistoricalRecord | null;
}

export interface VisitDossierExperienceProps {
  data: VisitDossierViewModel;
  /** Existing page navigation. Each action renders only if its handler is supplied. */
  onReturnToAssessment?: () => void;
  onReviewSymptoms?: () => void;
  onOpenReports?: () => void;
  onViewMedication?: () => void;
  /** Render only if the existing page already supports these. */
  onPrint?: () => void;
  /** Public URL of the page background. Defaults to /assets/visit-dossier-background.jpg */
  backgroundSrc?: string;
}

/* ------------------------------ helpers ----------------------------- */

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");
const has = (v?: string | null): v is string => typeof v === "string" && v.trim().length > 0;

type Tone = "ok" | "blue" | "violet" | "peach" | "muted";
const TONE: Record<Tone, string> = {
  ok: styles.badgeOk,
  blue: styles.badgeBlue,
  violet: styles.badgeViolet,
  peach: styles.badgePeach,
  muted: styles.badgeMuted,
};

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={cx(styles.badge, TONE[tone])}>{children}</span>;
}

function Section({ id, title, icon, aside, children, className }: {
  id: string;
  title: string;
  icon: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx(styles.card, className)} aria-labelledby={id}>
      <div className={styles.sectionHead}>
        <h2 id={id} className={styles.heading}>
          <span className={styles.headingIcon}>{icon}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      {children}
    </div>
  );
}

function OverviewItem({ icon, tone, title, available }: {
  icon: ReactNode;
  tone: "blue" | "peach" | "green" | "violet";
  title: string;
  available: boolean;
}) {
  return (
    <div className={cx(styles.overviewItem, !available && styles.unavailable)}>
      <span className={cx(styles.circle, available ? styles[`circle_${tone}`] : styles.circleMuted)}>{icon}</span>
      <b>{title}</b>
      <span>{available ? "Available" : "Not available"}</span>
    </div>
  );
}

function SymptomItem({ icon, label, value }: { icon: ReactNode; label: string; value?: string | null }) {
  const present = has(value);
  return (
    <div className={styles.symptom}>
      <span className={styles.symptomIcon}>{icon}</span>
      <div>
        <b>{label}</b>
        <span className={cx(styles.symptomValue, present && styles.symptomPresent)}>
          {present ? value : "Not provided"}
        </span>
      </div>
    </div>
  );
}


/* ----------------------------- component ---------------------------- */

export default function VisitDossierExperience({
  data,
  onReturnToAssessment,
  onReviewSymptoms,
  onOpenReports,
  onViewMedication,
  onPrint,
}: VisitDossierExperienceProps) {
  const { skin, symptoms, documents, medication } = data;
  const hasSymptoms = Boolean(
    symptoms &&
      (has(symptoms.onsetDuration) || has(symptoms.primaryLocation) || has(symptoms.primarySensation) || has(symptoms.additionalObservations)),
  );
  const confidence =
    typeof skin?.confidencePercent === "number" && Number.isFinite(skin.confidencePercent)
      ? Math.min(100, Math.max(0, skin.confidencePercent))
      : null;
  const reminders = medication?.activeReminderCount;
  const hasActions = onReturnToAssessment || onReviewSymptoms || onOpenReports || onPrint;

  return (
    <div className={styles.root}>
      <div className={styles.page}>
        {/* Hero */}
        <section className={cx(styles.card, styles.hero)} data-feature-hero="split">
          <div data-hero-copy>
            <span className={styles.eyebrow} data-hero-eyebrow>Clinical documentation</span>
            <h1 className={styles.title} data-hero-title>Your Visit Dossier</h1>
            <p className={styles.subtitle} data-hero-subtitle>Your healthcare information, brought together.</p>
            <p className={styles.lead} data-hero-description>
              A structured overview of your recorded skin assessment, reported symptoms and supporting healthcare information, ready to help organise your clinical consultation.
            </p>
          </div>
          <img
            className={styles.art}
            src="/assets/visit-dossier-hero-art.png"
            alt=""
            aria-hidden="true"
          />
        </section>

        {/* 1. Visit overview */}
        <Section
          id="vd-overview"
          title="Visit overview"
          icon={<FileText size={22} aria-hidden="true" />}
          aside={
            <Badge tone={data.hasVisitRecord ? "ok" : "muted"}>
              {data.hasVisitRecord && <CheckCircle2 size={14} aria-hidden="true" />}
              {data.hasVisitRecord ? "Record available" : "No record yet"}
            </Badge>
          }
        >
          <div className={styles.overview}>
            <OverviewItem icon={<CalendarDays size={22} aria-hidden="true" />} tone="blue" title="Visit record" available={data.hasVisitRecord} />
            <OverviewItem icon={<Zap size={22} aria-hidden="true" />} tone="peach" title="Assessment info" available={Boolean(skin)} />
            <OverviewItem icon={<ListChecks size={22} aria-hidden="true" />} tone="green" title="Symptom info" available={hasSymptoms} />
            <OverviewItem icon={<FileText size={22} aria-hidden="true" />} tone="violet" title="Documents" available={Boolean(documents && documents.count > 0)} />
          </div>
        </Section>

        {data.historicalRecord && (
          <Section id="vd-saved-detail" title="Saved clinical record details" icon={<FileText size={22} aria-hidden="true" />}>
            <div className={styles.rows}>
              <Row label="Record">{data.historicalRecord.title}</Row>
              <Row label="Record type">{data.historicalRecord.sessionType.replace(/_/g, " ")}</Row>
              <Row label="Saved on">{data.historicalRecord.createdAt || "Date unavailable"}</Row>
              <Row label="Response language">{data.historicalRecord.language || "Not recorded"}</Row>
            </div>
            <div className={cx(styles.inner, styles.note)}><b>Saved summary</b><p>{data.historicalRecord.summary}</p></div>
            {data.historicalRecord.sections.map((section, index) => (
              <div key={`${section.title}-${index}`} className={cx(styles.inner, styles.note)}>
                <b>{section.title}</b>
                {section.items.length ? <ul>{section.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul> : <p>Not recorded.</p>}
              </div>
            ))}
            {data.historicalRecord.error && <p role="alert">{data.historicalRecord.error}</p>}
          </Section>
        )}

        {/* 2. Skin assessment */}
        <Section id="vd-skin" title="Skin assessment summary" icon={<ImageIcon size={22} aria-hidden="true" />}>
          <div className={styles.split}>
            <div className={cx(styles.inner, styles.skin)}>
              <div className={styles.photo}>
                {skin?.imageUrl ? (
                  <img src={skin.imageUrl} alt={skin.imageAlt ?? "Submitted skin assessment image"} />
                ) : (
                  <span>
                    <ImageIcon size={26} aria-hidden="true" />
                    No image available
                  </span>
                )}
              </div>
              {skin ? (
                <div className={styles.rows}>
                  <Row label="Assessment status">
                    {has(skin.statusLabel) ? <Badge tone="ok"><CheckCircle2 size={14} aria-hidden="true" />{skin.statusLabel}</Badge> : <Badge tone="muted">Not reported</Badge>}
                  </Row>
                  <Row label="Prediction status">
                    {has(skin.predictionStatus) ? <Badge tone="blue">{skin.predictionStatus}</Badge> : <Badge tone="muted">Not reported</Badge>}
                  </Row>
                  <Row label="Confidence">
                    {confidence === null ? (
                      <Badge tone="muted">Not reported</Badge>
                    ) : (
                      <span className={styles.confidence}>
                        <span
                          className={styles.meter}
                          role="meter"
                          aria-label="Confidence"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={confidence}
                        >
                          <i style={{ width: `${confidence}%` }} />
                        </span>
                        <b>{Math.round(confidence)}%</b>
                      </span>
                    )}
                  </Row>
                  <Row label="Image quality">
                    {has(skin.imageQuality) ? <Badge tone="blue">{skin.imageQuality}</Badge> : <Badge tone="muted">Not reported</Badge>}
                  </Row>
                  <Row label="Abstention" hint={skin.abstained ? skin.abstentionReason ?? undefined : undefined}>
                    {skin.abstained === true ? <Badge tone="peach">Abstained</Badge> : skin.abstained === false ? <Badge tone="muted">No</Badge> : <Badge tone="muted">Not reported</Badge>}
                  </Row>
                  <Row label="Professional review">
                    {has(skin.professionalReview) ? <Badge tone="violet">{skin.professionalReview}</Badge> : <Badge tone="muted">Not reported</Badge>}
                  </Row>
                </div>
              ) : (
                <p className={styles.empty}>No skin assessment has been recorded for this visit yet. Complete a skin assessment to see status, confidence and image quality here.</p>
              )}
            </div>
            <div className={cx(styles.inner, styles.message)}>
              <Info size={22} aria-hidden="true" />
              <div>
                <b>Assessment message</b>
                <p>{has(skin?.message) ? skin?.message : "No assessment message available."}</p>
              </div>
            </div>
          </div>
        </Section>

        {/* 3 + 4. Symptoms and additional observations */}
        <Section id="vd-symptoms" title="Patient-reported symptom summary" icon={<Activity size={22} aria-hidden="true" />}>
          <div className={styles.symptoms}>
            <SymptomItem icon={<CalendarDays size={24} aria-hidden="true" />} label="Onset & duration" value={symptoms?.onsetDuration} />
            <SymptomItem icon={<MapPin size={24} aria-hidden="true" />} label="Primary location" value={symptoms?.primaryLocation} />
            <SymptomItem icon={<Zap size={24} aria-hidden="true" />} label="Primary sensation" value={symptoms?.primarySensation} />
            <SymptomItem icon={<ListChecks size={24} aria-hidden="true" />} label="Additional observations" value={symptoms?.additionalObservations} />
          </div>
          {!hasSymptoms && <p className={cx(styles.empty, styles.emptyTop)}>No symptoms have been reported for this visit.</p>}
        </Section>

        {/* 5. Medical documents */}
        <Section id="vd-docs" title="Medical documents" icon={<FileText size={22} aria-hidden="true" />}>
          <div className={styles.docs}>
            <div className={styles.rows}>
              <Row label="Uploaded documents">
                {documents && documents.count > 0 ? (
                  <Badge tone="blue">{documents.count} {documents.count === 1 ? "document" : "documents"}</Badge>
                ) : (
                  <Badge tone="muted">None uploaded</Badge>
                )}
              </Row>
              <Row label="OCR status">
                {has(documents?.ocrStatus) ? <Badge tone="peach">{documents?.ocrStatus}</Badge> : <Badge tone="muted">Not reported</Badge>}
              </Row>
            </div>
            {has(documents?.ocrMessage) && (
              <div className={cx(styles.inner, styles.note)}>
                <Info size={22} aria-hidden="true" />
                <span>{documents?.ocrMessage}</span>
              </div>
            )}
          </div>
        </Section>

        {/* 6. Medication / reminders */}
        <Section id="vd-med" title="Medication information" icon={<Pill size={22} aria-hidden="true" />}>
          <div className={styles.med}>
            <div className={styles.medMain}>
              <span className={cx(styles.circle, styles.circle_green)}><Pill size={22} aria-hidden="true" /></span>
              <div>
                <b>Medication reminders</b>{" "}
                {typeof reminders === "number" ? (
                  <Badge tone={reminders > 0 ? "ok" : "muted"}>{reminders > 0 ? `${reminders} active` : "None active"}</Badge>
                ) : (
                  <Badge tone="muted">Not reported</Badge>
                )}
                <p className={styles.medText}>
                  {typeof reminders === "number" && reminders > 0 ? "Stay on track with your medication schedule." : "No active medication reminders to show."}
                </p>
              </div>
            </div>
            {onViewMedication && (
              <button type="button" className={styles.link} onClick={onViewMedication}>
                View details <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </Section>

        {/* 7. Information for clinical review */}
        <section className={cx(styles.card, styles.review)} aria-labelledby="vd-review">
          <Stethoscope size={30} aria-hidden="true" />
          <div>
            <h2 id="vd-review" className={cx(styles.heading, styles.tight)}>Information for clinical review</h2>
            <p>This dossier brings together your skin assessment, symptoms and supporting information to help your healthcare professional during consultation.</p>
          </div>
        </section>

        {/* 8. Existing navigation / actions */}
        {hasActions && (
          <Section id="vd-actions" title="Quick actions" icon={<Zap size={22} aria-hidden="true" />}>
            <div className={styles.actions}>
              {onReturnToAssessment && (
                <button type="button" className={cx(styles.action, styles.actionPrimary)} onClick={onReturnToAssessment}>
                  <ScanLine size={18} aria-hidden="true" />Return to Skin Assessment<ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
              {onReviewSymptoms && (
                <button type="button" className={cx(styles.action, styles.actionGreen)} onClick={onReviewSymptoms}>
                  <Activity size={18} aria-hidden="true" />Review Symptoms<ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
              {onOpenReports && (
                <button type="button" className={cx(styles.action, styles.actionViolet)} onClick={onOpenReports}>
                  <BarChart3 size={18} aria-hidden="true" />Open Reports<ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
              {onPrint && (
                <button type="button" className={cx(styles.action, styles.actionNeutral)} onClick={onPrint}>
                  <Printer size={18} aria-hidden="true" />Print
                </button>
              )}
            </div>
          </Section>
        )}

        {/* 9. Clinical disclaimer */}
        <section className={cx(styles.card, styles.disclaimer)} role="note" aria-label="Clinical disclaimer">
          <AlertTriangle size={26} aria-hidden="true" />
          <p>
            This dossier organises information supplied through DermaSathiAI. AI-generated findings are not a confirmed diagnosis and should be reviewed by a qualified healthcare professional.
          </p>
        </section>
      </div>
    </div>
  );
}
