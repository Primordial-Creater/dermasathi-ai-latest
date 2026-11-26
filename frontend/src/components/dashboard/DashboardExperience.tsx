import React, { type CSSProperties, type ReactNode, useRef, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { HumanBustFigure } from "../three/HumanBustFigure";
import { AyurvedaLotusScene } from "../three/ayurveda/AyurvedaLotusScene";
import { useClinical } from "../../context/ClinicalContext";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../services/apiClient";
import { useReducedMotionPreference } from "../../hooks/useReducedMotionPreference";
import {
  Leaf,
  Heart,
  ArrowRight,
  Calendar,
  Pill,
  FileText,
  Scan,
  Stethoscope,
  Upload,
  Bot,
  CheckCircle2,
} from "lucide-react";
import styles from "./DashboardExperience.module.css";

/* ============================================================
   DashboardExperience — Claude design fidelity.

   Structure, composition, palette and glass treatment follow the
   supplied `DermaSathiAI Dashboard.html` / DashboardExperience
   reference. All numbers and copy come from real app state only:
   no health scores, risk levels, confidence values or patient
   activity are hard-coded (see ClinicalContext).

   The shared AppLayout still owns the sidebar and header; this
   component renders the page content area only.
   ============================================================ */

const cx = (...n: (string | undefined | false)[]): string =>
  n.filter(Boolean).join(" ");

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: [0.23, 1, 0.32, 1] },
  }),
};

interface FeatureCardDef {
  id: string;
  path: string;
  tone: string;
  title: string;
  text: string;
  icon: ReactNode;
}

/* Four multicolour healthcare cards, in the reference order:
   skin (blue), symptoms (mint), medicine safety (lavender), reports (peach). */
const CARDS: FeatureCardDef[] = [
  {
    id: "skin-assessment",
    path: "/skin-assessment",
    tone: "f1",
    title: "Skin Assessment",
    text: "Analyze your skin with AI",
    icon: (
      <>
        <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
        <circle cx="12" cy="12" r="3.5" />
      </>
    ),
  },
  {
    id: "symptoms",
    path: "/symptoms",
    tone: "f2",
    title: "Symptoms",
    text: "Check symptoms and get guidance",
    icon: (
      <>
        <path d="M6 3v6a4 4 0 0 0 8 0V3M10 13v2a4 4 0 0 0 8 0v-1" />
        <circle cx="18" cy="12" r="2" />
      </>
    ),
  },
  {
    id: "medicine-safety",
    path: "/reminders",
    tone: "f3",
    title: "Medicine Safety",
    text: "Check drug safety and interactions",
    icon: (
      <>
        <rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-45 12 12)" />
        <path d="M8.7 15.3l6.6-6.6" />
      </>
    ),
  },
  {
    id: "reports",
    path: "/reports",
    tone: "f4",
    title: "Medical Reports",
    text: "Upload & view reports",
    icon: (
      <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </>
    ),
  },
];

const JOURNEY: { label: string; Icon: typeof Scan }[] = [
  { label: "Assess", Icon: Scan },
  { label: "Understand", Icon: Stethoscope },
  { label: "Care", Icon: Pill },
  { label: "Thrive", Icon: Leaf },
];


interface DashboardHistoryRecord {
  id: number | string;
  session_type: string;
}

interface DashboardReminderRecord {
  status?: string;
}

/* Shared botanical leaf symbol (green) and journey lotus (pink). Ids are
   page-global: render only one dashboard per page. */
const Defs = () => (
  <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
    <defs>
      <linearGradient id="lg" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#17a05a" />
        <stop offset=".6" stopColor="#5fd38a" />
        <stop offset="1" stopColor="#b4f0a0" />
      </linearGradient>
      <linearGradient id="pg" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#e66fb0" />
        <stop offset="1" stopColor="#ffd0ec" />
      </linearGradient>
      <symbol id="lf" viewBox="0 0 100 100">
        <path d="M8 92C6 42 46 8 94 8c2 48-34 86-86 84z" fill="url(#lg)" />
        <path
          d="M10 90L78 24M40 60l2-22M56 46l1-18M30 72l-16-6"
          stroke="rgba(255,255,255,.55)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      </symbol>
      <symbol id="lt" viewBox="0 0 100 64">
        <g fill="url(#pg)" stroke="#fff" strokeWidth="1.2">
          <path d="M50 4C64 18 64 42 50 58 36 42 36 18 50 4z" />
          <path d="M50 58C34 52 18 38 14 18 32 22 46 36 50 58z" />
          <path d="M50 58C66 52 82 38 86 18 68 22 54 36 50 58z" />
          <path d="M50 58C30 56 10 48 2 34 22 34 40 42 50 58z" opacity=".9" />
          <path d="M50 58C70 56 90 48 98 34 78 34 60 42 50 58z" opacity=".9" />
        </g>
      </symbol>
    </defs>
  </svg>
);

const LeafDeco = ({ s }: { s: CSSProperties }) => (
  <svg className={styles.leaf} style={s} aria-hidden="true">
    <use href="#lf" />
  </svg>
);

export const DashboardExperience: React.FC = () => {
  const navigate = useNavigate();
  const { latestAssessment, imagePreview, symptomsRecord } = useClinical();
  const { isAuthenticated } = useAuth();
  const [savedHistory, setSavedHistory] = useState<DashboardHistoryRecord[] | null>(null);
  const [historyLoadError, setHistoryLoadError] = useState(false);
  const [todayReminders, setTodayReminders] = useState<DashboardReminderRecord[] | null>(null);
  const [reminderLoadError, setReminderLoadError] = useState(false);

  // Read the signed-in user's persisted records; do not derive lifetime counts
  // from the current React session or from another user's global database totals.
  useEffect(() => {
    let active = true;
    if (!isAuthenticated) {
      setSavedHistory([]);
      setHistoryLoadError(false);
      setTodayReminders([]);
      setReminderLoadError(false);
      return () => { active = false; };
    }

    setSavedHistory(null);
    setHistoryLoadError(false);
    setTodayReminders(null);
    setReminderLoadError(false);

    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    void apiFetch<DashboardHistoryRecord[]>("/api/v1/history?limit=100")
      .then((records) => { if (active) setSavedHistory(Array.isArray(records) ? records : []); })
      .catch(() => { if (active) setHistoryLoadError(true); });

    void apiFetch<DashboardReminderRecord[]>(`/api/v1/prescriptions/reminders/today?date=${localDate}`)
      .then((records) => { if (active) setTodayReminders(Array.isArray(records) ? records : []); })
      .catch(() => { if (active) setReminderLoadError(true); });

    return () => { active = false; };
  }, [isAuthenticated]);

  // The page-level skin animation is decorative: autoplay when motion is
  // allowed, otherwise hold a still frame without showing a play control.
  const reduceMotion = useReducedMotionPreference();
  const heroBgRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const video = heroBgRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");

    const holdStillFrame = () => {
      video.pause();
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        try { video.currentTime = 0.01; } catch { /* metadata may not be seekable yet */ }
      }
    };
    const tryPlay = () => {
      if (reduceMotion || !video.paused) return;
      const playback = video.play();
      if (playback && typeof playback.catch === "function") {
        playback.catch((error: unknown) => console.warn("Dashboard hero background autoplay was blocked:", error));
      }
    };
    const onReady = () => reduceMotion ? holdStillFrame() : tryPlay();
    const onError = () => console.error("Dashboard hero-bg.mp4 failed to load:", video.error);

    if (reduceMotion) holdStillFrame();
    else if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) tryPlay();

    video.addEventListener("loadedmetadata", onReady);
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("canplay", onReady);
    video.addEventListener("error", onError);
    return () => {
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("error", onError);
    };
  }, [reduceMotion]);

  const countFor = (types: string[]) =>
    savedHistory?.filter((record) => types.includes((record.session_type || "").toLowerCase())).length ?? null;
  const skinCount = countFor(["skin_photo", "skin_assessment"]);
  const symptomCount = countFor(["symptom_assessment", "symptom_triage"]);
  const reportCount = countFor(["medical_report"]);
  const reminderCount = todayReminders?.filter((item) => !["taken", "skipped", "completed"].includes((item.status || "").toLowerCase())).length ?? null;
  const hasAssessment = latestAssessment !== null || (skinCount ?? 0) > 0;
  const hasSymptoms = symptomsRecord !== null || (symptomCount ?? 0) > 0;
  const countText = (value: number | null, failed: boolean) => failed ? "Unavailable" : value === null ? "…" : String(value);
  const countCaption = (value: number | null, failed: boolean, noun: string) =>
    failed ? "Could not load saved data" : value === null ? "Loading your records…" : `${value} saved ${noun}${value === 1 ? "" : "s"}`;

  const confidencePct =
    latestAssessment?.calibrated_confidence != null
      ? `${Math.round(latestAssessment.calibrated_confidence * 100)}%`
      : latestAssessment?.raw_probability != null
        ? `${Math.round(latestAssessment.raw_probability * 100)}%`
        : null;

  const assessedAt = latestAssessment?.processing_time_ms
    ? `Processed in ${latestAssessment.processing_time_ms} ms`
    : "Recorded in this session";

  const startScan = () => navigate("/skin-assessment");

  return (
    <div className={styles.root}>
      <Defs />
      <div className={styles.app}>
        {/* Page body. The shared AppLayout renders the real sidebar and
            header; this is the content column from the reference. */}
        <main className={styles.main}>
          {/* 1. Hero */}
          <motion.section
            className={cx(styles.glass, styles.hero)}
            initial="hidden"
            animate="visible"
            custom={0}
            variants={fadeUp}
          >
            {/* Ambient skin-layer video behind the hero content. Sits above the
                hero surface and below the copy / figure / leaves. */}
            <div className={styles.heroBg} aria-hidden="true">
              <video
                ref={heroBgRef}
                className={styles.heroBgVideo}
                src="/assets/hero-bg.mp4"
                autoPlay={!reduceMotion}
                muted
                loop
                playsInline
                preload="auto"
                tabIndex={-1}
              />
              <span className={styles.heroBgWash} />
            </div>

            <div className={styles.glow} aria-hidden="true" />
            <LeafDeco s={{ width: 150, right: -20, top: -30, transform: "rotate(130deg)" }} />
            <LeafDeco s={{ width: 120, right: 10, bottom: -30, transform: "rotate(-70deg)" }} />
            <i className={styles.bk} style={{ right: 240, top: 30 }} aria-hidden="true" />
            <i
              className={styles.bk}
              style={{ right: 120, top: 150, width: 22, height: 22 }}
              aria-hidden="true"
            />

            <div className={styles.heroCopy}>
              <div className={styles.heroGreeting}>
                <Heart size={15} aria-hidden="true" />
                <span>DermaSathiAI • AI-powered dermatology</span>
              </div>
              <h1 className={styles.heroTitle}>Your Skin Health Our Priority</h1>
              <p className={styles.heroSub}>
                AI-Powered Dermatology Care with Ayurveda Wisdom
              </p>
              <p className={styles.heroBody}>
                Assessment, symptom support and wellness guidance in one calm
                place — with clinical review kept in the loop.
              </p>
              <button
                type="button"
                className={cx(styles.btn, styles.heroBtn)}
                onClick={startScan}
              >
                Start Skin Assessment <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Medical visual on the right — existing bust video, preserved */}
            <div className={styles.heroVisual}>
              <div className={styles.heroBust}>
                <HumanBustFigure
                  videoSrc="/assets/human-bust.mp4"
                  ariaLabel="Rotating human figure — anatomical visualization"
                  className={styles.bustFigure}
                />
              </div>
            </div>
          </motion.section>

          {/* 2. Four multicolour healthcare cards */}
          <motion.section
            className={styles.cards4}
            initial="hidden"
            animate="visible"
            custom={1}
            variants={fadeUp}
            aria-label="Your healthcare tools"
          >
            {CARDS.map((card) => (
              <Link
                key={card.id}
                to={card.path}
                className={cx(styles.fc, styles[card.tone])}
              >
                <div className={styles.ic}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    {card.icon}
                  </svg>
                </div>
                <b>{card.title}</b>
                <small>{card.text}</small>
                <span className={styles.go} aria-hidden="true">
                  →
                </span>
              </Link>
            ))}
          </motion.section>

          {/* 3. Health overview (real state) + AI insights */}
          <motion.section
            className={cx(styles.row, styles.r1)}
            initial="hidden"
            animate="visible"
            custom={2}
            variants={fadeUp}
          >
            <div className={cx(styles.glass, styles.pad)}>
              <div className={styles.ovH}>
                <h2 className={styles.ovTitle}>Your Health Overview</h2>
                <small className={styles.ovMeta}>From your recorded activity</small>
              </div>
              <div className={styles.tiles}>
                <div className={cx(styles.tile, styles.t1)}>
                  <div className={styles.ti}>
                    <Scan size={20} aria-hidden="true" />
                  </div>
                  <small>Skin analysis</small>
                  <b>{countText(skinCount, historyLoadError)}</b>
                  <em>{countCaption(skinCount, historyLoadError, "assessment")}</em>
                </div>
                <div className={cx(styles.tile, styles.t2)}>
                  <div className={styles.ti}>
                    <Stethoscope size={20} aria-hidden="true" />
                  </div>
                  <small>Symptom check</small>
                  <b>{countText(symptomCount, historyLoadError)}</b>
                  <em>{countCaption(symptomCount, historyLoadError, "symptom check")}</em>
                </div>
                <div className={cx(styles.tile, styles.t3)}>
                  <div className={styles.ti}>
                    <FileText size={20} aria-hidden="true" />
                  </div>
                  <small>Medical reports</small>
                  <b>{countText(reportCount, historyLoadError)}</b>
                  <em>{countCaption(reportCount, historyLoadError, "report")}</em>
                </div>
                <div className={cx(styles.tile, styles.t4)}>
                  <div className={styles.ti}>
                    <Calendar size={20} aria-hidden="true" />
                  </div>
                  <small>Reminders today</small>
                  <b>{countText(reminderCount, reminderLoadError)}</b>
                  <em>{countCaption(reminderCount, reminderLoadError, "reminder due today")}</em>
                </div>
              </div>
            </div>

            <div className={cx(styles.glass, styles.pad, styles.ai)}>
              <LeafDeco s={{ width: 80, right: 6, bottom: -4, transform: "rotate(-40deg)" }} />
              <h2 className={styles.padTitle}>AI Insights</h2>
              <p className={styles.aiBody}>
                {hasAssessment
                  ? (latestAssessment?.message ??
                    "Your latest skin assessment has been recorded. Review the candidate findings and discuss them with a clinician.")
                  : "Complete a skin assessment to record your first observation. DermaSathiAI shows uncertainty and refers you to a clinician rather than issuing a diagnosis."}
              </p>
              <Link
                to={hasAssessment ? "/skin-assessment" : "/skin-assessment"}
                className={styles.link}
              >
                {hasAssessment ? "View details" : "Start an assessment"} →
              </Link>
            </div>
          </motion.section>

          {/* 4. Recent skin analysis + health status */}
          <motion.section
            className={cx(styles.row, styles.r2)}
            initial="hidden"
            animate="visible"
            custom={3}
            variants={fadeUp}
          >
            <div className={cx(styles.glass, styles.pad)}>
              <div className={styles.ovH}>
                <h2 className={styles.ovTitle}>Recent Skin Analysis</h2>
                <Link to="/skin-assessment" className={styles.link}>
                  View all →
                </Link>
              </div>

              {hasAssessment && imagePreview ? (
                <div className={styles.an}>
                  <img
                    className={styles.anImg}
                    src={imagePreview}
                    alt="Most recent skin assessment preview"
                  />
                  <div>
                    <div className={styles.ok}>
                      <CheckCircle2 size={15} aria-hidden="true" /> Assessment recorded
                    </div>
                    <p className={styles.anLine}>
                      {confidencePct ? `Reported confidence: ${confidencePct}` : "Confidence not reported"}
                    </p>
                    <p className={styles.anLine}>
                      {latestAssessment?.predicted_class ?? "Lesion characterization recorded"}
                    </p>
                    <small className={styles.anTime}>{assessedAt}</small>
                    <br />
                    <Link to="/skin-assessment" className={styles.link}>
                      View Report →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className={styles.anEmpty}>
                  <Upload size={30} aria-hidden="true" />
                  <div>
                    <b className={styles.anEmptyTitle}>No skin analysis yet</b>
                    <p className={styles.anEmptyBody}>
                      Upload a photo of a skin concern to begin your first
                      assessment.
                    </p>
                    <button type="button" className={styles.link} onClick={startScan}>
                      Start Skin Assessment →
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className={cx(styles.glass, styles.pad)}>
              <LeafDeco s={{ width: 110, right: -6, bottom: -4, transform: "rotate(-30deg) scaleX(-1)" }} />
              <h2 className={styles.padTitle}>Your Health Status</h2>
              <div className={styles.hs}>
                <div className={styles.hsRing}>
                  <span>{hasAssessment ? "—" : "?"}</span>
                </div>
                <div>
                  <b className={styles.hsValue}>{hasAssessment ? "Recorded" : "Not assessed"}</b>
                  <small className={styles.hsLabel}>
                    {hasAssessment ? "Based on your latest assessment" : "No assessment recorded"}
                  </small>
                </div>
              </div>
              <div className={styles.chk}>
                {hasAssessment ? "Your latest result is available" : "Complete an assessment to record a status"}
              </div>
              <div className={styles.chk}>No automated diagnosis is issued</div>
              <p className={styles.hsNote}>
                Clinical decisions belong to a qualified professional. DermaSathiAI
                reports uncertainty instead of certainty.
              </p>
            </div>
          </motion.section>

          {/* 5. Upcoming reminders + Ayurveda */}
          <motion.section
            className={cx(styles.row, styles.r3)}
            initial="hidden"
            animate="visible"
            custom={4}
            variants={fadeUp}
          >
            <div className={cx(styles.glass, styles.pad)}>
              <div className={styles.ovH}>
                <h2 className={styles.ovTitle}>Upcoming Reminders</h2>
                <Link to="/reminders" className={styles.link}>
                  View All →
                </Link>
              </div>
              <div className={styles.emptyRow}>
                <Calendar size={22} aria-hidden="true" />
                <div>
                  <b className={styles.emptyRowTitle}>No reminders set yet</b>
                  <p className={styles.emptyRowBody}>
                    Add medication or appointment reminders to see them here.
                  </p>
                  <Link to="/reminders" className={styles.link}>
                    Set a reminder →
                  </Link>
                </div>
              </div>
            </div>

            <div className={cx(styles.glass, styles.pad, styles.ay)}>
              <h2 className={styles.padTitle}>Ayurveda Wisdom</h2>
              <q className={styles.ayQuote}>
                Healthy skin begins from within — with balanced nutrition, peace of
                mind and natural care.
              </q>
              <div className={styles.ayVisual}>
                <AyurvedaLotusScene className={styles.lotusCanvas} />
              </div>
              <Link to="/lifestyle" className={styles.link}>
                Learn More →
              </Link>
            </div>
          </motion.section>

          {/* 6. Recent activity + wellness journey */}
          <motion.section
            className={cx(styles.row, styles.r4)}
            initial="hidden"
            animate="visible"
            custom={5}
            variants={fadeUp}
          >
            <div className={cx(styles.glass, styles.pad)}>
              <div className={styles.ovH}>
                <h2 className={styles.ovTitle}>Your Recent Activity</h2>
                <Link to="/health-history" className={styles.link}>
                  View All →
                </Link>
              </div>

              {hasAssessment ? (
                <div className={styles.act}>
                  <span className={styles.actDot} style={{ background: "#1fa971" }}>
                    ✓
                  </span>
                  <span className={styles.actLabel}>Skin assessment completed</span>
                  <small className={styles.actTime}>{assessedAt}</small>
                </div>
              ) : null}

              {hasSymptoms ? (
                <div className={styles.act}>
                  <span className={styles.actDot} style={{ background: "#8b6ee8" }}>
                    ●
                  </span>
                  <span className={styles.actLabel}>Symptoms questionnaire updated</span>
                  <small className={styles.actTime}>
                    {symptomsRecord?.timestamp ? "Recorded today" : "Today"}
                  </small>
                </div>
              ) : null}

              {!hasAssessment && !hasSymptoms ? (
                <div className={styles.emptyRow}>
                  <Bot size={22} aria-hidden="true" />
                  <div>
                    <b className={styles.emptyRowTitle}>No recent activity</b>
                    <p className={styles.emptyRowBody}>
                      Complete an assessment or symptom check to see activity here.
                    </p>
                    <button type="button" className={styles.link} onClick={startScan}>
                      Start Skin Assessment →
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className={cx(styles.glass, styles.pad, styles.jr)}>
              <svg viewBox="0 0 100 64" width="84" aria-hidden="true">
                <use href="#lt" />
              </svg>
              <b className={styles.jrTitle}>DermaSathiAI Wellness Journey</b>
              <span className={styles.jrText}>A healthier, happier you — naturally!</span>
              <ol className={styles.journey} aria-label="Care journey">
                {JOURNEY.map(({ label, Icon }) => (
                  <li key={label} className={styles.journeyItem}>
                    <span className={styles.journeyIcon}>
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    {label}
                  </li>
                ))}
              </ol>
              <div>
                <Link to="/lifestyle" className={cx(styles.btn, styles.jrBtn)}>
                  Start Journey →
                </Link>
              </div>
            </div>
          </motion.section>

          {/* Footer */}
          <footer className={cx(styles.glass, styles.footer)}>
            <span className={styles.footerLeft}>
              <Leaf size={14} color="#078B91" aria-hidden="true" />
              <b className={styles.footerBrand}>DermaSathiAI</b>
              <span className={styles.footerDot}>•</span>
              <span>Your Skin, Our Care.</span>
            </span>
            <span className={styles.footerLinks}>
              <Link to="/settings" className={styles.footerLink}>
                Settings
              </Link>
              <Link to="/lifestyle" className={styles.footerLink}>
                Ayurveda &amp; Wellness
              </Link>
              <Link to="/nearby-care" className={styles.footerLink}>
                Find Care
              </Link>
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default DashboardExperience;