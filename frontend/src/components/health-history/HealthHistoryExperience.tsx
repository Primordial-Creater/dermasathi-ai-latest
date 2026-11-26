import { useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  FlaskConical,
  History,
  Info,
  LayoutGrid,
  RotateCcw,
  Scan,
  Stethoscope,
  Users,
  Zap,
} from "lucide-react";
import styles from "./HealthHistoryExperience.module.css";

/* Mirrors the HistoryEntry shape built in HealthHistoryPage.tsx. `imageUrl` is optional:
   the page may pass ClinicalContext.imagePreview for the session scan entry. */
export type HistoryCategory = "scan" | "symptoms" | "report";

export interface HistoryEntry {
  id: string;
  date: string;
  category: HistoryCategory;
  title: string;
  summary: string;
  tag: string;
  isDemo?: boolean;
  imageUrl?: string | null;
}

export type HistoryFilter = "all" | HistoryCategory;

export interface HealthHistoryExperienceProps {
  /** Full-page background image URL (public/assets). Required. */
  backgroundSrc: string;
  /** The page's `displayedEntries` (real session entries, or sample entries when loaded). */
  entries: HistoryEntry[];
  /** True only while the synthetic reference timeline is what is being displayed. */
  isSampleTimeline: boolean;
  /** `latestAssessment !== null` in ClinicalContext. */
  hasSessionAssessment: boolean;
  /** `symptomsRecord !== null` in ClinicalContext. */
  hasSessionSymptoms: boolean;
  /** Set true only once a document store is connected. Defaults to false ("Not connected"). */
  documentsConnected?: boolean;
  /** Optional controlled filter. If omitted the component keeps this UI-only state itself. */
  activeFilter?: HistoryFilter;
  onFilterChange?: (filter: HistoryFilter) => void;
  onStartAssessment: () => void;
  onRecordSymptoms: () => void;
  onLoadSampleTimeline: () => void;
  /** Existing "Hide Sample Data" / "Reset to Empty State" behaviour. */
  onHideSampleTimeline: () => void;
  /** Existing "View Consultation Summary" link (/visit-summary). */
  onViewSummary: (entry?: HistoryEntry) => void;
}

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

const FILTERS: Array<{ key: HistoryFilter; label: string; Icon: typeof Scan }> = [
  { key: "all", label: "All Records", Icon: LayoutGrid },
  { key: "scan", label: "Skin Assessments", Icon: Scan },
  { key: "symptoms", label: "Symptoms", Icon: Zap },
  { key: "report", label: "Reports", Icon: FileText },
];

const CATEGORY_ICON = { scan: Scan, symptoms: Stethoscope, report: FileText } as const;
const CATEGORY_TONE = { scan: styles.toneBlue, symptoms: styles.toneGreen, report: styles.toneViolet } as const;

function OverviewCard({ icon, tone, title, ok, okLabel, noLabel }: {
  icon: ReactNode;
  tone: string;
  title: string;
  ok: boolean;
  okLabel?: string;
  noLabel: string;
}) {
  return (
    <div className={cx(styles.ovCard, !ok && styles.ovOff)}>
      <span className={cx(styles.circle, tone, !ok && styles.circleOff)}>{icon}</span>
      <b>{title}</b>
      <span className={styles.ovStatus}>
        {ok ? <CheckCircle2 size={14} aria-hidden="true" /> : <Info size={14} aria-hidden="true" />}
        {ok ? okLabel ?? "Available" : noLabel}
      </span>
    </div>
  );
}


export default function HealthHistoryExperience({
  entries,
  isSampleTimeline,
  hasSessionAssessment,
  hasSessionSymptoms,
  documentsConnected = false,
  activeFilter,
  onFilterChange,
  onStartAssessment,
  onRecordSymptoms,
  onLoadSampleTimeline,
  onHideSampleTimeline,
  onViewSummary,
}: HealthHistoryExperienceProps) {
  const [localFilter, setLocalFilter] = useState<HistoryFilter>("all");
  const filter = activeFilter ?? localFilter;
  const setFilter = (f: HistoryFilter) => {
    if (activeFilter === undefined) setLocalFilter(f);
    onFilterChange?.(f);
  };

  const visible = filter === "all" ? entries : entries.filter((e) => e.category === filter);
  const countFor = (f: HistoryFilter) => (f === "all" ? entries.length : entries.filter((e) => e.category === f).length);
  const hasSession = hasSessionAssessment || hasSessionSymptoms;

  return (
    <div className={styles.root}>
      <div className={styles.page}>
        {/* 1. Hero */}
        <section className={cx(styles.card, styles.hero)} data-feature-hero="split">
          <div data-hero-copy>
            <span className={styles.eyebrow} data-hero-eyebrow>
              <History size={14} aria-hidden="true" />
              Longitudinal dermatology timeline
            </span>
            <h1 className={styles.title} data-hero-title>Health &amp; Consultation History</h1>
            <p className={styles.lead} data-hero-description>
              Review your recorded dermatological assessments, symptom observations and consultation information in one organised timeline.
            </p>
          </div>
          <img
            className={styles.art}
            src="/assets/health-history-hero-art.png"
            alt=""
            aria-hidden="true"
          />
        </section>

        {/* 2. Overview: availability reflects the current session only */}
        <section className={styles.overviewWrap} aria-label="Record overview">
          <span className={cx(styles.badge, styles.badgeOk, styles.sessionBadge)}>
            <span className={styles.dot} aria-hidden="true" />
            Saved and current records
          </span>
          <div className={styles.overview}>
            <OverviewCard icon={<Scan size={24} aria-hidden="true" />} tone={styles.toneAmber} title="Skin Assessment Records" ok={hasSessionAssessment} noLabel="Not recorded" />
            <OverviewCard icon={<Stethoscope size={24} aria-hidden="true" />} tone={styles.toneBlue} title="Symptom Intake Records" ok={hasSessionSymptoms} noLabel="Not recorded" />
            <OverviewCard icon={<Users size={24} aria-hidden="true" />} tone={styles.toneViolet} title="Consultation Summaries" ok={hasSession} okLabel="Session summary available" noLabel="Not recorded" />
            <OverviewCard icon={<FileText size={24} aria-hidden="true" />} tone={styles.toneGreen} title="Medical Documents" ok={documentsConnected} noLabel="Not connected" />
          </div>
        </section>

        {/* 3. Filters */}
        <div className={styles.filters} role="group" aria-label="Filter records">
          {FILTERS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              className={cx(styles.chip, filter === key && styles.chipActive)}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
              <span className={styles.count}>{countFor(key)}</span>
            </button>
          ))}
        </div>

        {/* 4–6. Timeline, synthetic labelling, empty state */}
        {entries.length === 0 ? (
          <section className={cx(styles.card, styles.emptyCard)} aria-labelledby="hh-empty">
            <span className={styles.emptyIcon}><Clock size={34} aria-hidden="true" /></span>
            <div>
              <h2 id="hh-empty" className={styles.emptyTitle}>No Consultation History Recorded Yet</h2>
              <p className={styles.lead}>
                As you complete skin assessments and symptom questionnaires, your available session records will appear here.
              </p>
              <div className={styles.row}>
                <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={onStartAssessment}>
                  <Scan size={18} aria-hidden="true" />Start Skin Assessment
                </button>
                <button type="button" className={cx(styles.btn, styles.btnGreen)} onClick={onRecordSymptoms}>
                  <Zap size={18} aria-hidden="true" />Record New Symptoms
                </button>
              </div>
              <div className={styles.row}>
                <button type="button" className={cx(styles.btn, styles.btnSoftViolet)} onClick={onLoadSampleTimeline}>
                  <FlaskConical size={18} aria-hidden="true" />Load Reference Timeline (Sample Demonstration)
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className={styles.card} aria-labelledby="hh-timeline">
            <div className={styles.sectionHead}>
              <h2 id="hh-timeline" className={styles.heading}>
                <span className={styles.headingIcon}><Clock size={22} aria-hidden="true" /></span>
                Clinical Timeline
              </h2>
            </div>

            {isSampleTimeline && (
              <div className={styles.synthetic} role="note">
                <FlaskConical size={18} aria-hidden="true" />
                <span>
                  <b>Synthetic reference timeline — demonstration data.</b> Displaying pre-configured synthetic demonstration records. No actual patient data is stored.
                </span>
                <button type="button" className={styles.link} onClick={onHideSampleTimeline}>Hide sample data</button>
              </div>
            )}

            {visible.length === 0 ? (
              <p className={styles.empty}>No records in this category yet.</p>
            ) : (
              <ol className={styles.timeline}>
                {visible.map((item) => {
                  const Icon = CATEGORY_ICON[item.category];
                  return (
                    <li key={item.id} className={styles.entry}>
                      <span className={styles.rail} aria-hidden="true"><i /></span>
                      <article className={styles.entryCard}>
                        {item.imageUrl ? (
                          <img className={styles.thumb} src={item.imageUrl} alt="Submitted skin assessment" />
                        ) : (
                          <span className={cx(styles.circle, CATEGORY_TONE[item.category])}><Icon size={24} aria-hidden="true" /></span>
                        )}
                        <div className={styles.entryBody}>
                          <div className={styles.entryTop}>
                            <span className={cx(styles.badge, styles.badgeBlue)}>{item.tag}</span>
                            {item.isDemo && <span className={cx(styles.badge, styles.badgeGold)}>Synthetic · Demo data</span>}
                            <span className={styles.date}><Calendar size={13} aria-hidden="true" />{item.date}</span>
                          </div>
                          <h3 className={styles.entryTitle}>{item.title}</h3>
                          <p className={styles.entrySummary}>{item.summary}</p>
                        </div>
                        <button type="button" className={cx(styles.btn, styles.viewBtn)} onClick={() => onViewSummary(item)}>
                          <Eye size={16} aria-hidden="true" />View Summary<ArrowRight size={14} aria-hidden="true" />
                        </button>
                      </article>
                    </li>
                  );
                })}
              </ol>
            )}

            {isSampleTimeline && (
              <button type="button" className={cx(styles.btn, styles.resetBtn)} onClick={onHideSampleTimeline}>
                <RotateCcw size={16} aria-hidden="true" />Reset to Empty State
              </button>
            )}
          </section>
        )}

        {/* 7. Quick actions */}
        <section className={styles.card} aria-labelledby="hh-quick">
          <div className={styles.sectionHead}>
            <h2 id="hh-quick" className={styles.heading}>
              <span className={styles.headingIcon}><Zap size={22} aria-hidden="true" /></span>
              Quick Actions
            </h2>
          </div>
          <div className={styles.actions}>
            <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={onStartAssessment}>
              <Scan size={18} aria-hidden="true" />Add New Skin Scan
            </button>
            <button type="button" className={cx(styles.btn, styles.btnSoftGreen)} onClick={onRecordSymptoms}>
              <Zap size={18} aria-hidden="true" />Record New Symptoms
            </button>
            <button type="button" className={cx(styles.btn, styles.btnSoftViolet)} onClick={() => onViewSummary()}>
              <Users size={18} aria-hidden="true" />View Consultation Summary
            </button>
          </div>
        </section>

        {/* 8. Clinical disclaimer */}
        <section className={cx(styles.card, styles.notice, styles.noticeWarn)} role="note" aria-label="Clinical disclaimer">
          <AlertTriangle size={26} aria-hidden="true" />
          <p>
            This dossier organises information supplied through DermaSathiAI. AI-generated findings are not a confirmed diagnosis and should be reviewed by a qualified healthcare professional.
          </p>
        </section>
      </div>
    </div>
  );
}
