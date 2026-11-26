import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Droplet,
  Flame,
  FlaskConical,
  Info,
  Leaf,
  Lightbulb,
  Loader2,
  Mic,
  Moon,
  Send,
  ShieldCheck,
  Sparkles,
  Sprout,
  Sun,
  TreePine,
  User,
} from "lucide-react";
import { SUPPORTED_LANGUAGES, type LanguageCode } from "../../context/AppModeContext";
import styles from "./AyurvedaExperience.module.css";

/* ------------------------------------------------------------------ *
 * Types. Content types mirror the constants in LifestylePage.tsx so the
 * page can pass its existing data unchanged (single source of truth).
 * ------------------------------------------------------------------ */

export type GuideLanguage = LanguageCode;
export type VoiceStatus = "unavailable" | "idle" | "listening" | "processing" | "error";
/** "integration-pending": no chat backend connected. "ready": page has a real responder. */
export type GuideStatus = "integration-pending" | "ready" | "error";
export type EvidenceType = "traditional" | "scientific" | "both";
export type ResponseBadge = "traditional" | "limited" | "scientific";

export interface AyurvedicResponse {
  directAnswer?: string;
  understanding?: string;
  traditionalPerspective?: string;
  generalWellness?: string[];
  herbalKnowledge?: string[];
  safetyPrecautions?: string[];
  /** Only real, supplied references. Never fabricated. */
  references?: Array<{ label: string; note?: string }>;
  badges?: ResponseBadge[];
}

export interface GuideMessage {
  id: string;
  role: "user" | "assistant";
  text?: string;
  response?: AyurvedicResponse;
  /** Marks illustrative content so it is labelled as an example. */
  isExample?: boolean;
}

export interface FoundationItem {
  id: string;
  title: string;
  description: string;
  tag: string; // e.g. "Traditional Knowledge"
  icon?: "pitta" | "constitution";
}

export interface HerbItem {
  name: string;
  use: string;
  caution: string; // e.g. "Patch test before use"
}

export interface RoutineItem {
  time: string;
  title: string;
  description: string;
  icon?: "sun" | "droplet" | "moon";
}

/** Same shape as AyurvedaTip in LifestylePage.tsx. */
export interface EvidenceCard {
  id: string;
  category: string;
  title: string;
  summary: string;
  actionableStep: string;
  evidenceType: EvidenceType;
  evidenceSource: string;
  caution?: string;
}

/** No formulation content exists in the app yet. Pass entries only when real, reviewed content exists. */
export interface AyurvedicFormulation {
  id: string;
  name: string;
  ingredients?: string[];
  traditionalPurpose?: string;
  evidenceType?: EvidenceType;
  precautions?: string[];
  practitionerReview?: "reviewed" | "pending" | "not-reviewed";
}

export interface AyurvedaExperienceProps {
  /** Page background image URL (public/assets). Required. */
  backgroundSrc: string;
  /** Pass the existing <AyurvedaLotusScene /> here. Not recreated by this component. */
  lotusScene?: ReactNode;

  messages: GuideMessage[];
  onSubmitQuestion: (question: string, language: GuideLanguage) => void | Promise<void>;
  isResponding: boolean;
  guideStatus?: GuideStatus;
  selectedLanguage: GuideLanguage;
  onLanguageChange: (language: GuideLanguage) => void;
  onVoiceInput?: () => void;
  voiceStatus?: VoiceStatus;
  suggestedQuestions?: string[];
  /** Show the clearly labelled illustrative conversation while `messages` is empty. Default true. */
  showExampleConversation?: boolean;

  foundations: FoundationItem[];
  herbs: HerbItem[];
  routines: RoutineItem[];
  evidenceCards: EvidenceCard[];
  formulations?: AyurvedicFormulation[];

  /** Navigates to the existing /skin-assessment route. */
  onStartSkinAssessment: () => void;
}

/* ------------------------------ constants ---------------------------- */

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

const LANGUAGES: Array<{ key: GuideLanguage; label: string; lang: string }> = SUPPORTED_LANGUAGES.map(
  ({ code, name }) => ({ key: code, label: name, lang: code }),
);

const DEFAULT_SUGGESTIONS = [
  "Traditional Ayurvedic approaches to dry skin",
  "Understanding Pitta and skin health",
  "Neem and its traditional uses",
  "Gentle daily skin-care routines",
  "Precautions before using herbal products",
  "Ayurvedic wellness alongside modern healthcare",
];

const VOICE_LABEL: Record<VoiceStatus, string> = {
  unavailable: "Voice input integration pending",
  idle: "Voice input ready",
  listening: "Listening…",
  processing: "Processing voice input…",
  error: "Voice input is unavailable right now",
};

const BADGE_LABEL: Record<ResponseBadge, string> = {
  traditional: "Traditional Knowledge",
  limited: "Limited Scientific Evidence",
  scientific: "Scientific Evidence",
};
const BADGE_CLASS: Record<ResponseBadge, string> = {
  traditional: styles.badgeGreen,
  limited: styles.badgeBlue,
  scientific: styles.badgeViolet,
};
const EVIDENCE_LABEL: Record<EvidenceType, string> = {
  traditional: "Traditional Knowledge",
  scientific: "Scientific Evidence",
  both: "Traditional + Scientific",
};
const EVIDENCE_CLASS: Record<EvidenceType, string> = {
  traditional: styles.badgeGreen,
  scientific: styles.badgeViolet,
  both: styles.badgeGold,
};
const REVIEW_LABEL = { reviewed: "Reviewed", pending: "Review pending", "not-reviewed": "Not reviewed" } as const;

/** Illustrative only. Shown with an "Example" label. It is NOT a generated or live AI response. */
const EXAMPLE_CONVERSATION: GuideMessage[] = [
  { id: "ex-user", role: "user", isExample: true, text: "Can you explain traditional Ayurvedic approaches to dry skin?" },
  {
    id: "ex-assistant",
    role: "assistant",
    isExample: true,
    response: {
      understanding: "You are asking how traditional Ayurveda describes and approaches dry skin.",
      traditionalPerspective:
        "In Ayurvedic tradition, dryness is often described in terms of Vata qualities such as dryness and roughness. This is a traditional framework, not a medical diagnosis.",
      generalWellness: [
        "Gentle oil application is a traditional practice",
        "Staying hydrated and eating a balanced diet",
        "Avoiding excessive heat and harsh soaps",
      ],
      herbalKnowledge: ["Neem and sandalwood are traditionally described as cooling and calming."],
      safetyPrecautions: ["Patch test any herbal product first, and speak to a dermatologist if skin worsens."],
      references: [],
      badges: ["traditional", "limited"],
    },
  },
];

const HERB_ICON: Record<string, typeof Leaf> = { neem: Leaf, sandalwood: TreePine, turmeric: Sprout, "aloe vera": Droplet };

/* ------------------------------ pieces ------------------------------- */

function ResponseSection({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className={styles.respSection}>
      <h4><span className={styles.respNum}>{n}</span>{title}</h4>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className={styles.respList}>
      {items.map((i) => <li key={i}>{i}</li>)}
    </ul>
  );
}

function AssistantResponse({ r }: { r: AyurvedicResponse }) {
  return (
    <div className={styles.respCard}>
      {r.directAnswer && <ResponseSection n={1} title="Direct answer"><p>{r.directAnswer}</p></ResponseSection>}
      {r.understanding && <ResponseSection n={2} title="How your question was understood"><p>{r.understanding}</p></ResponseSection>}
      {r.traditionalPerspective && <ResponseSection n={3} title="Traditional Ayurvedic perspective"><p>{r.traditionalPerspective}</p></ResponseSection>}
      {r.generalWellness?.length ? <ResponseSection n={4} title="Relevant guidance"><List items={r.generalWellness} /></ResponseSection> : null}
      {r.herbalKnowledge?.length ? <ResponseSection n={5} title="Relevant herbal information"><List items={r.herbalKnowledge} /></ResponseSection> : null}
      {r.safetyPrecautions?.length ? <ResponseSection n={6} title="Safety and evidence"><List items={r.safetyPrecautions} /></ResponseSection> : null}
      {r.references?.length ? (
        <ResponseSection n={7} title="References supplied with this response">
          <ul className={styles.respList}>
            {r.references.map((ref) => <li key={ref.label}>{ref.label}{ref.note ? ` — ${ref.note}` : ""}</li>)}
          </ul>
        </ResponseSection>
      ) : null}
      <div className={styles.respFoot}>
        <span className={styles.generalInfo}><Info size={14} aria-hidden="true" />This is general information and not a medical prescription.</span>
        <span className={styles.badges}>
          {r.badges?.map((b) => <span key={b} className={cx(styles.badge, BADGE_CLASS[b])}>{BADGE_LABEL[b]}</span>)}
        </span>
      </div>
    </div>
  );
}

function SectionCard({ id, icon, title, subtitle, children }: { id: string; icon: ReactNode; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className={styles.card} aria-labelledby={id}>
      <div className={styles.sectionHead}>
        <div>
          <h2 id={id} className={styles.heading}><span className={styles.headingIcon}>{icon}</span>{title}</h2>
          {subtitle && <p className={styles.subhead}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/* ----------------------------- component ----------------------------- */

export default function AyurvedaExperience({
  lotusScene,
  messages,
  onSubmitQuestion,
  isResponding,
  guideStatus = "integration-pending",
  selectedLanguage,
  onLanguageChange,
  onVoiceInput,
  voiceStatus = "unavailable",
  suggestedQuestions = DEFAULT_SUGGESTIONS,
  showExampleConversation = true,
  foundations,
  herbs,
  routines,
  evidenceCards,
  formulations = [],
  onStartSkinAssessment,
}: AyurvedaExperienceProps) {
  const [draft, setDraft] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const ready = guideStatus === "ready";
  const showExample = messages.length === 0 && showExampleConversation;
  const shown = showExample ? EXAMPLE_CONVERSATION : messages;
  const canSend = ready && !isResponding && draft.trim().length > 0;
  const micEnabled = Boolean(onVoiceInput) && voiceStatus !== "unavailable" && voiceStatus !== "processing";

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, isResponding]);

  async function submit() {
    const q = draft.trim();
    if (!q || !ready || isResponding) return;
    await onSubmitQuestion(q, selectedLanguage);
    setDraft("");
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const statusText =
    guideStatus === "ready"
      ? null
      : guideStatus === "error"
        ? "The wellness guide is temporarily unavailable. Please try again later."
        : "AI wellness guide integration pending. Questions cannot be answered yet. The conversation below is an illustrative example only.";

  return (
    <div className={styles.root}>
      <div className={styles.page}>
        {/* Hero (compact) with slot for the existing 3D lotus */}
        <section className={cx(styles.card, styles.hero, !lotusScene && styles.heroSolo)} data-feature-hero="split">
          <div data-hero-copy>
            <span className={styles.eyebrow} data-hero-eyebrow><Leaf size={14} aria-hidden="true" />Ayurveda &amp; Botanical Wellness</span>
            <h1 className={styles.title} data-hero-title>Traditional Wisdom, Modern Care</h1>
            <p className={styles.lead} data-hero-description>
              Explore Ayurvedic wellness knowledge and speak with your AI wellness guide to understand traditional approaches to skin health.
            </p>
          </div>
          {lotusScene && <div className={styles.lotusSlot} data-hero-art="lotus">{lotusScene}</div>}
        </section>

        {/* Educational safety notice (existing copy) */}
        <section className={cx(styles.card, styles.notice, styles.noticeGreen)} role="note">
          <ShieldCheck size={26} aria-hidden="true" />
          <div>
            <b className={styles.noticeTitle}>Educational Wellness Guidance — Not Medical Treatment</b>
            <p>
              Ayurvedic practices below are traditional wellness knowledge. They support general skin health and do not replace clinical diagnosis, prescribed medication, or dermatologist care.
            </p>
          </div>
        </section>

        {/* MAIN FEATURE: AI Ayurvedic Wellness Guide */}
        <section className={cx(styles.card, styles.guide)} aria-labelledby="ay-guide">
          <div className={styles.guideHead}>
            <span className={styles.guideIcon}><Sparkles size={22} aria-hidden="true" /></span>
            <div className={styles.guideTitles}>
              <h2 id="ay-guide" className={cx(styles.heading, styles.guideHeading)}>Ask Your Ayurvedic Wellness Guide</h2>
              <p className={styles.subhead}>Share your concerns, explore traditional wellness knowledge and ask questions in your preferred language.</p>
            </div>
            <div className={styles.langs} role="radiogroup" aria-label="Guide language">
              {LANGUAGES.map(({ key, label, lang }) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  lang={lang}
                  aria-checked={selectedLanguage === key}
                  className={cx(styles.lang, selectedLanguage === key && styles.langActive)}
                  onClick={() => onLanguageChange(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {statusText && (
            <p className={cx(styles.status, guideStatus === "error" && styles.statusError)} role="status">
              <Info size={16} aria-hidden="true" />{statusText}
            </p>
          )}

          <div className={styles.log} ref={logRef} role="log" aria-live="polite" aria-label="Conversation with your wellness guide" tabIndex={0}>
            {showExample && <span className={cx(styles.badge, styles.badgeGold, styles.exampleBadge)}><FlaskConical size={13} aria-hidden="true" />Illustrative example — not a live AI response</span>}
            {shown.length === 0 && (
              <p className={styles.empty}>No messages yet. Choose a suggested question or describe your concern below.</p>
            )}
            {shown.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className={cx(styles.msg, styles.msgUser)}>
                  <p className={styles.bubbleUser}>{m.text}</p>
                  <span className={styles.avatar}><User size={18} aria-hidden="true" /></span>
                </div>
              ) : (
                <div key={m.id} className={cx(styles.msg, styles.msgBot)}>
                  <span className={cx(styles.avatar, styles.avatarBot)}><Leaf size={18} aria-hidden="true" /></span>
                  <div className={styles.botBody}>
                    {m.text && <p className={styles.bubbleBot}>{m.text}</p>}
                    {m.response && <AssistantResponse r={m.response} />}
                    {m.isExample && <span className={styles.muted}>Example only</span>}
                  </div>
                </div>
              ),
            )}
            {isResponding && (
              <div className={cx(styles.msg, styles.msgBot)} role="status">
                <span className={cx(styles.avatar, styles.avatarBot)}><Loader2 size={18} className={styles.spin} aria-hidden="true" /></span>
                <p className={styles.bubbleBot}>Your guide is preparing a response…</p>
              </div>
            )}
          </div>

          <div className={styles.composer}>
            <Sparkles size={18} className={styles.composerIcon} aria-hidden="true" />
            <label className={styles.sr} htmlFor="ay-input">Describe your concern or ask an Ayurvedic wellness question</label>
            <textarea
              id="ay-input"
              className={styles.textarea}
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKey}
              placeholder="Describe your concern or ask an Ayurvedic wellness question…"
              lang={selectedLanguage}
            />
            <button
              type="button"
              className={cx(styles.iconBtn, styles.mic, voiceStatus === "listening" && styles.micOn)}
              onClick={onVoiceInput}
              disabled={!micEnabled}
              aria-pressed={voiceStatus === "listening"}
              aria-label="Voice input"
              title={VOICE_LABEL[voiceStatus]}
            >
              <Mic size={20} aria-hidden="true" />
            </button>
            <button type="button" className={cx(styles.iconBtn, styles.send)} onClick={() => void submit()} disabled={!canSend} aria-label="Send question">
              {isResponding ? <Loader2 size={20} className={styles.spin} aria-hidden="true" /> : <Send size={20} aria-hidden="true" />}
            </button>
          </div>
          <p className={styles.voiceStatus} role="status" aria-live="polite">{VOICE_LABEL[voiceStatus]}</p>

          <div className={styles.suggest} aria-label="Suggested questions">
            <Lightbulb size={18} className={styles.bulb} aria-hidden="true" />
            <div className={styles.suggestList}>
              {suggestedQuestions.map((q) => (
                <button key={q} type="button" className={styles.suggestChip} onClick={() => setDraft(q)}>{q}</button>
              ))}
            </div>
          </div>
        </section>

        {/* Ayurvedic Foundations */}
        <SectionCard id="ay-found" icon={<Leaf size={22} aria-hidden="true" />} title="Ayurvedic Foundations" subtitle="Traditional concepts of dosha balance, Pitta pacification and constitutional skin types.">
          <div className={styles.grid2}>
            {foundations.map((f) => (
              <div key={f.id} className={cx(styles.inner, styles.featureCard)}>
                <span className={cx(styles.featureIcon, f.icon === "pitta" ? styles.iconFire : styles.iconLotus)}>
                  {f.icon === "pitta" ? <Flame size={26} aria-hidden="true" /> : <Droplet size={26} aria-hidden="true" />}
                </span>
                <div>
                  <h3>{f.title}</h3>
                  <p className={styles.small}>{f.description}</p>
                  <span className={cx(styles.badge, styles.badgeGreen)}>{f.tag}</span>
                </div>
              </div>
            ))}
          </div>
          <p className={styles.traditionNote}><Info size={15} aria-hidden="true" />Vata, Pitta and Kapha are traditional concepts. They are not medical diagnoses.</p>
        </SectionCard>

        {/* Herbal Wisdom */}
        <SectionCard id="ay-herbs" icon={<Sprout size={22} aria-hidden="true" />} title="Herbal Wisdom" subtitle="Traditional botanical actives used for skin calming, with patch-test safety guidance.">
          <div className={styles.grid4}>
            {herbs.map((h) => {
              const Icon = HERB_ICON[h.name.toLowerCase()] ?? Leaf;
              return (
                <div key={h.name} className={cx(styles.inner, styles.herb)}>
                  <span className={styles.herbIcon}><Icon size={34} aria-hidden="true" /></span>
                  <h3>{h.name}</h3>
                  <p className={styles.small}>{h.use}</p>
                  <span className={cx(styles.badge, styles.badgePeach)}><AlertTriangle size={13} aria-hidden="true" />{h.caution}</span>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Daily Wellness Routines */}
        <SectionCard id="ay-routines" icon={<Calendar size={22} aria-hidden="true" />} title="Daily Wellness Routines" subtitle="Dinacharya-inspired habits: gentle cleansing, hydration and a calm evening.">
          <ol className={styles.routines}>
            {routines.map((r, i) => {
              const Icon = r.icon === "moon" ? Moon : r.icon === "droplet" ? Droplet : Sun;
              return (
                <li key={r.time} className={cx(styles.inner, styles.routine)}>
                  <span className={cx(styles.routineIcon, r.icon === "moon" ? styles.iconMoon : r.icon === "droplet" ? styles.iconWater : styles.iconSun)}><Icon size={26} aria-hidden="true" /></span>
                  <div>
                    <b>{r.time}</b>
                    <h3>{r.title}</h3>
                    <p className={styles.small}>{r.description}</p>
                  </div>
                  {i < routines.length - 1 && <ArrowRight className={styles.routineArrow} size={22} aria-hidden="true" />}
                </li>
              );
            })}
          </ol>
        </SectionCard>

        {/* Evidence & Safety */}
        <SectionCard id="ay-evidence" icon={<ShieldCheck size={22} aria-hidden="true" />} title="Evidence & Safety" subtitle="Understand the difference between traditional Ayurvedic knowledge and current scientific evidence.">
          <div className={styles.grid3}>
            {evidenceCards.map((c) => (
              <article key={c.id} className={cx(styles.inner, styles.evidence)}>
                <div className={styles.evidenceTop}>
                  <span className={styles.small}>{c.category}</span>
                  <span className={cx(styles.badge, EVIDENCE_CLASS[c.evidenceType])}>{EVIDENCE_LABEL[c.evidenceType]}</span>
                </div>
                <h3>{c.title}</h3>
                <p className={styles.small}>{c.summary}</p>
                <p className={styles.small}><b>Guidance:</b> {c.actionableStep}</p>
                <p className={styles.source}><b>Source (as listed in app content):</b> {c.evidenceSource}</p>
                {c.caution && <p className={styles.caution}><AlertTriangle size={14} aria-hidden="true" />{c.caution}</p>}
              </article>
            ))}
          </div>
        </SectionCard>

        {/* Ayurvedic formulations (educational) */}
        <SectionCard id="ay-form" icon={<FlaskConical size={22} aria-hidden="true" />} title="Traditional Ayurvedic Formulations" subtitle="Educational information only.">
          {formulations.length === 0 ? (
            <p className={cx(styles.inner, styles.empty)}>No traditional-formulation content is connected to this page yet. Nothing is listed here, and no formulations, doses or prescriptions are suggested.</p>
          ) : (
            <div className={styles.grid3}>
              {formulations.map((f) => (
                <article key={f.id} className={cx(styles.inner, styles.evidence)}>
                  <div className={styles.evidenceTop}>
                    <h3>{f.name}</h3>
                    {f.evidenceType && <span className={cx(styles.badge, EVIDENCE_CLASS[f.evidenceType])}>{EVIDENCE_LABEL[f.evidenceType]}</span>}
                  </div>
                  {f.ingredients?.length ? <p className={styles.small}><b>Ingredients:</b> {f.ingredients.join(", ")}</p> : null}
                  {f.traditionalPurpose && <p className={styles.small}><b>Traditional purpose:</b> {f.traditionalPurpose}</p>}
                  {f.precautions?.length ? <p className={styles.caution}><AlertTriangle size={14} aria-hidden="true" />{f.precautions.join(" ")}</p> : null}
                  <span className={cx(styles.badge, styles.badgeMuted)}>Practitioner review: {REVIEW_LABEL[f.practitionerReview ?? "not-reviewed"]}</span>
                </article>
              ))}
            </div>
          )}
          <p className={styles.traditionNote}><Info size={15} aria-hidden="true" />Traditional formulation information is educational. Specific medicines and dosages should be discussed with a qualified registered practitioner.</p>
        </SectionCard>

        {/* Skin assessment shortcut */}
        <section className={cx(styles.card, styles.shortcut)} aria-labelledby="ay-skin">
          <div>
            <h2 id="ay-skin" className={styles.heading}>Concerned about your skin?</h2>
            <p className={styles.subhead}>Skin images are assessed in the Skin Assessment experience, not here.</p>
          </div>
          <button type="button" className={cx(styles.btn, styles.btnPrimary)} onClick={onStartSkinAssessment}>
            Start Skin Assessment<ArrowRight size={16} aria-hidden="true" />
          </button>
        </section>

        {/* Clinical safety */}
        <section className={cx(styles.card, styles.notice, styles.noticeWarn)} role="note" aria-label="Clinical safety notice">
          <AlertTriangle size={26} aria-hidden="true" />
          <p>
            Consult a qualified dermatologist before changing prescribed treatments or trying unfamiliar herbal products. Some botanical ingredients can cause contact sensitivity. Ayurveda does not replace urgent care, prescribed medication or dermatological assessment.
          </p>
        </section>
      </div>
    </div>
  );
}
