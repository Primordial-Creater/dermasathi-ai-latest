import React, {
  useId,
  useRef,
  useState,
  useEffect,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  FileText,
  Flower2,
  Focus,
  FlaskConical,
  Heart,
  ImagePlus,
  Info,
  Leaf,
  MapPin,
  RotateCcw,
  Ruler,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  Sun,
  UploadCloud,
  Bell,
} from "lucide-react";
import { SkinAnalysisResponse } from "../../types/api";
import styles from "./SkinAssessmentExperience.module.css";
import { useReducedMotionPreference } from "../../hooks/useReducedMotionPreference";

/* ============================================================
   SkinAssessmentExperience — Claude design fidelity.

   Structure, section order, glass surfaces and palette follow the
   supplied Skin Assessment reference. Behaviour stays in the page
   (SkinAssessmentPage): API call, JPEG/PNG/WebP validation, 10 MB
   limit, drag-and-drop, preview/replacement, abstention, quality
   and confidence mapping.

   Preserved existing components (unchanged):
    - <HealthcareLoader />   (loader slot)
   ============================================================ */

export interface SkinAssessmentExperienceProps {
  previewUrl: string | null;
  fileName?: string | null;
  isAnalyzing: boolean;
  result: SkinAnalysisResponse | null;
  errorMsg: string | null;
  validationNote: string | null;
  isSampleMode: boolean;
  isDemoMode: boolean;
  onFileSelected: (file: File) => void;
  onAnalyze: () => void;
  onReset: () => void;
  onLoadSample: () => void;
  onToggleCoach: () => void;
  showCoach: boolean;
  onViewVisitSummary: () => void;
  onNewAssessment?: () => void;
  onViewReports?: () => void;
  onSetReminder?: () => void;
  onFindCare?: () => void;
  /** Existing <HealthcareLoader /> element, rendered while analyzing. */
  loaderSlot?: ReactNode;
}

interface AssessmentResultView {
  abstained: boolean;
  abstentionMessage: string | undefined;
  confidence: number | null;
  confidenceLabel: string | undefined;
  imageQuality:
    | { label: string; acceptable: boolean; notes: string[] }
    | null;
  candidates: {
    id: string;
    label: string;
    confidence: number | null;
    confidenceLabel?: string;
    note: string | undefined;
  }[];
  summary: string | undefined;
}

const toAssessmentView = (response: SkinAnalysisResponse): AssessmentResultView => {
  const quality = response.quality_gate ?? response.quality ?? null;
  const sourceCandidates = (response.findings?.length ? response.findings : response.top_predictions) ?? [];
  return {
    abstained: Boolean(response.abstained) || response.assessment?.status === "abstain" || response.status.toLowerCase().startsWith("abstain"),
    abstentionMessage: response.abstention_reason ?? response.assessment?.message ?? response.reason ?? response.message ?? undefined,
    // Do not display an LLM's self-reported score or raw classifier score as calibrated confidence.
    confidence: response.calibrated_confidence ?? null,
    confidenceLabel: response.assessment?.prediction.confidence_level ?? undefined,
    imageQuality: quality ? {
      label: quality.status ?? (quality.is_acceptable ? "acceptable" : "needs review"),
      acceptable: quality.is_acceptable ?? quality.status !== "poor",
      notes: [...(quality.issues ?? []), ...(quality.feedback_messages ?? []), ...(quality.user_action ? [quality.user_action] : [])],
    } : null,
    candidates: sourceCandidates.map((item, index) => {
      const candidate = item as typeof item & { category_name?: string; general_information?: string; confidence_level?: string; class_name?: string; class_index?: number; calibrated_probability?: number | null; raw_probability?: number | null; description?: string };
      return {
        id: String(candidate.class_index ?? `${candidate.category_name ?? candidate.class_name ?? "candidate"}-${index}`),
        label: candidate.category_name ?? candidate.class_name ?? "Possible finding",
        confidence: candidate.calibrated_probability ?? null,
        confidenceLabel: candidate.confidence_level,
        note: candidate.general_information ?? candidate.description ?? candidate.typical_clinical_features?.join("; ") ?? undefined,
      };
    }),
    summary: response.assessment?.message ?? response.reason ?? response.message ?? undefined,
  };
};

const STEPS = [
  { title: "Upload", hint: "Add a clear photo", Icon: UploadCloud },
  { title: "Analyze", hint: "Our AI examines", Icon: ScanLine },
  { title: "Get Results", hint: "With clinical context", Icon: BarChart3 },
];

const JOURNEY = [
  { label: "Assess", Icon: Camera },
  { label: "Understand", Icon: BarChart3 },
  { label: "Care", Icon: Heart },
  { label: "Thrive", Icon: Flower2 },
];

const toPercent = (v?: number | null) =>
  v == null || Number.isNaN(v) ? null : Math.round(v <= 1 ? v * 100 : v);

export const SkinAssessmentExperience: React.FC<
  SkinAssessmentExperienceProps
> = ({
  previewUrl,
  fileName,
  isAnalyzing,
  result,
  errorMsg,
  validationNote,
  isSampleMode,
  isDemoMode,
  onFileSelected,
  onAnalyze,
  onReset,
  onLoadSample,
  onToggleCoach,
  showCoach,
  onViewVisitSummary,
  onNewAssessment,
  onViewReports,
  onSetReminder,
  onFindCare,
  loaderSlot,
}) => {
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const busy = isAnalyzing;
  const hasImage = Boolean(previewUrl) || isSampleMode;
  const view = result ? toAssessmentView(result) : null;
  // Phase 2 nests care guidance inside assessment; keep top-level compatibility for older responses.
  const care = result?.care ?? result?.assessment?.care;

  const phase = errorMsg
    ? "error"
    : isAnalyzing
      ? "analyzing"
      : result
        ? "result"
        : hasImage
          ? "ready"
          : "idle";

  const activeStep = phase === "result" ? 2 : hasImage ? 1 : 0;

  const openPicker = () => {
    if (busy) return;
    inputRef.current?.click();
  };

  const openCamera = () => {
    if (busy) return;
    setCameraError(null);
    setCameraReady(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }
    setCameraOpen(true);
  };

  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    if (e.currentTarget === cameraInputRef.current) setCameraOpen(false);
    e.target.value = ""; // allow re-selecting the same file
  };

  useEffect(() => {
    if (!cameraOpen) return;
    let cancelled = false;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraStreamRef.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error("Camera preview could not be initialized.");
        video.srcObject = stream;
        await video.play();
        if (!cancelled) setCameraReady(true);
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "CameraError";
        const message = name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "Camera permission was blocked. Allow camera access in your browser's site settings and try again."
          : name === "NotFoundError" || name === "DevicesNotFoundError"
            ? "No camera was found on this device. You can choose an image instead."
            : "The camera could not be opened. Check that it is connected and not being used by another app.";
        setCameraError(message);
      }
    };

    void startCamera();
    return () => {
      cancelled = true;
      setCameraReady(false);
      const stream = cameraStreamRef.current;
      stream?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [cameraOpen]);

  const captureCameraPhoto = () => {
    const video = videoRef.current;
    if (!video || !cameraReady || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("This browser could not prepare the captured image. Please try uploading a photo.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError("The photo could not be captured. Please try again.");
        return;
      }
      const photo = new File([blob], `dermasathi-camera-${Date.now()}.jpg`, { type: "image/jpeg" });
      onFileSelected(photo);
      setCameraOpen(false);
    }, "image/jpeg", 0.92);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelected(file);
  };

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  };

  const coachGuidelines = [
    {
      step: "1. Natural Lighting",
      text: "Position near indirect window daylight. Avoid direct camera flash to prevent specular glare on lipid membranes.",
      Icon: Sun,
    },
    {
      step: "2. Sharp Framing",
      text: "Keep lens 15–20cm away. Tap your screen to focus sharply on the skin texture and lesion borders.",
      Icon: Focus,
    },
    {
      step: "3. Healthy Margin",
      text: "Include a small margin of surrounding normal skin to allow contrast comparison.",
      Icon: Ruler,
    },
  ];

  const quick = [
    { label: "New Assessment", Icon: Camera, tone: "sky", onClick: onNewAssessment },
    { label: "View Reports", Icon: FileText, tone: "mint", onClick: onViewReports },
    { label: "Set Reminder", Icon: Bell, tone: "peach", onClick: onSetReminder },
    { label: "Find Care", Icon: MapPin, tone: "lav", onClick: onFindCare },
  ].filter((q) => q.onClick);

  /* Decorative hero background video. The clip is a full-bleed teal scene, so
     it is laid behind the copy at low opacity (plus a white wash) to read as an
     ambient texture rather than an opaque block. Motion is opt-out. */

  // Autoplay the atmospheric skin-layer video when motion is allowed. Under
  // reduced-motion preferences, hold its opening frame without a play control.
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
        playback.catch((error: unknown) => console.warn("Skin Assessment hero-bg.mp4 autoplay was blocked:", error));
      }
    };
    const onReady = () => reduceMotion ? holdStillFrame() : tryPlay();
    const onError = () => console.error("Skin Assessment hero-bg.mp4 failed to load:", video.error);

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

  return (
    <div className={styles.page}>
      <Leaf className={styles.leafDeco} aria-hidden="true" />

      {/* 1. Dermatology hero banner */}
      <section
        className={styles.hero}
        aria-labelledby={`${uid}-title`}
        data-feature-hero="video"
      >
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
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow} data-hero-eyebrow>
            <Stethoscope size={14} aria-hidden="true" /> Clinical anamnesis intake
          </p>
          <h1 id={`${uid}-title`} className={styles.title} data-hero-title>
            Skin Condition Triage &amp; Assessment
          </h1>
          <p className={styles.lead} data-hero-subtitle>Scan. Analyze. Get structured insights.</p>
          <p className={styles.sub} data-hero-description>
            Capture or upload a clear, well-lit photograph of the affected area
            for characterization and consultation preparation. DermaSathiAI
            reports uncertainty and refers you to a clinician.
          </p>
          <button
            type="button"
            className={styles.primary}
            onClick={openPicker}
            disabled={busy}
          >
            Start Assessment <ArrowRight size={18} aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* 2. Three-step assessment indicator */}
      <ol className={styles.steps} aria-label="Assessment steps">
        {STEPS.map(({ title, hint, Icon }, i) => (
          <li
            key={title}
            className={styles.step}
            data-active={i === activeStep || undefined}
            data-done={i < activeStep || undefined}
            aria-current={i === activeStep ? "step" : undefined}
          >
            <span className={styles.stepIcon}>
              <Icon size={22} aria-hidden="true" />
            </span>
            <span>
              <strong>{title}</strong>
              <small>{hint}</small>
            </span>
          </li>
        ))}
      </ol>

      <div className={styles.grid}>
        {/* 4. Upload panel */}
        <section className={`${styles.card} ${styles.upload}`} aria-labelledby={`${uid}-up`}>
          <h2 id={`${uid}-up`} className={styles.cardTitle}>
            <ImagePlus size={20} aria-hidden="true" /> Upload your skin image
          </h2>
          <div
            className={styles.dropzone}
            data-dragging={dragging || undefined}
            data-disabled={busy || undefined}
            role="button"
            tabIndex={busy ? -1 : 0}
            aria-disabled={busy}
            aria-label="Choose or drop a skin photo. JPEG, PNG or WebP, up to 10 megabytes."
            onClick={openPicker}
            onKeyDown={handleKey}
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <UploadCloud size={44} className={styles.dropIcon} aria-hidden="true" />
            <p className={styles.dropMain}>Drag and drop your image here</p>
            <p className={styles.dropOr}>or</p>
            <span className={styles.secondary}>Choose file</span>
            <p className={styles.formats}>JPG, PNG, WebP · Max size 10 MB</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className={styles.hiddenInput}
            onChange={handleInput}
            tabIndex={-1}
            aria-hidden="true"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className={styles.hiddenInput}
            onChange={handleInput}
            tabIndex={-1}
            aria-hidden="true"
          />
          <button
            type="button"
            className={styles.linkBtn}
            onClick={openCamera}
            disabled={busy}
          >
            <Camera size={16} aria-hidden="true" /> Capture with camera
          </button>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={onLoadSample}
            disabled={busy}
          >
            <FlaskConical size={16} aria-hidden="true" /> Try the illustrative
            sample case
          </button>
        </section>

        {/* 4. Image preview panel */}
        <section className={`${styles.card} ${styles.preview}`} aria-labelledby={`${uid}-pv`}>
          <h2 id={`${uid}-pv`} className={styles.cardTitle}>
            Preview
          </h2>
          <div className={styles.previewFrame}>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={
                  isSampleMode
                    ? "Synthetic illustrative sample image"
                    : `Preview of ${fileName ?? "uploaded skin photo"}`
                }
              />
            ) : (
              <p className={styles.empty}>
                {isSampleMode
                  ? "Synthetic sample loaded"
                  : "Your photo will appear here"}
              </p>
            )}
            {isSampleMode && (
              <span className={styles.synthetic}>
                Synthetic sample · not a real patient
              </span>
            )}
          </div>

          {validationNote && (
            <p className={styles.qualityOk}>
              <Info size={15} aria-hidden="true" /> {validationNote}
            </p>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              onClick={onAnalyze}
              disabled={!hasImage || busy || phase === "result"}
            >
              {isDemoMode ? "Process in Demo Simulation" : "Submit for Neural Inference"}
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={onReset}
              disabled={!hasImage || busy}
            >
              <RotateCcw size={16} aria-hidden="true" /> Replace / reset
            </button>
          </div>
        </section>

        {/* 5. Smart Photo Coach */}
        <section
          className={`${styles.card} ${styles.coach}`}
          aria-labelledby={`${uid}-co`}
        >
          <h2 id={`${uid}-co`} className={styles.cardTitle}>
            <Sun size={20} aria-hidden="true" /> Smart Photo Coach
          </h2>
          <ul className={styles.coachList}>
            {coachGuidelines.slice(0, 3).map((g) => (
              <li key={g.step}>
                <span className={styles.coachIcon}>
                  <g.Icon size={18} aria-hidden="true" />
                </span>
                <span>
                  <strong className={styles.coachStep}>{g.step}</strong>
                  <small className={styles.coachText}>{g.text}</small>
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={onToggleCoach}
            aria-expanded={showCoach}
          >
            <Info size={15} aria-hidden="true" />
            {showCoach ? "Hide photography guidance" : "Show photography guidance"}
          </button>
          {showCoach && (
            <div className={styles.coachDetail}>
              <h3 className={styles.coachDetailTitle}>
                Optimal Dermatological Photography Guidelines
              </h3>
              <p className={styles.coachDetailBody}>
                Diffuse daylight, sharp focus on lesion borders and a margin of
                surrounding skin give the clearest educational observation. Photo
                quality never determines a clinical result.
              </p>
            </div>
          )}
        </section>

        {/* 6. Analysis presentation / results */}
        <section
          className={`${styles.card} ${styles.results}`}
          aria-labelledby={`${uid}-rs`}
          aria-live="polite"
          aria-busy={busy}
        >
          <div className={styles.resultsHead}>
            <h2 id={`${uid}-rs`} className={styles.cardTitle}>
              <BarChart3 size={20} aria-hidden="true" /> Analysis results
            </h2>
            {phase === "result" && (
              <span className={styles.badge}>
                <CheckCircle2 size={14} aria-hidden="true" /> Analysis complete
              </span>
            )}
          </div>

          {(phase === "idle" || phase === "ready") && (
            <div className={styles.waiting}>
              <ShieldCheck size={40} aria-hidden="true" />
              <p>
                {phase === "ready"
                  ? "Ready when you are — select “Analyze image”."
                  : "Results will appear here after you add a photo."}
              </p>
            </div>
          )}

          {phase === "analyzing" && (
            <div className={styles.loaderWrap}>
              {loaderSlot ?? <p className={styles.waiting}>Analyzing…</p>}
            </div>
          )}

          {phase === "error" && (
            <div className={styles.error} role="alert">
              <AlertTriangle size={22} aria-hidden="true" />
              <div>
                <strong>We couldn’t complete that step</strong>
                <p>{errorMsg ?? "Something went wrong. Please try again."}</p>
                <div className={styles.actions}>
                  {hasImage && (
                    <button
                      type="button"
                      className={styles.primary}
                      onClick={onAnalyze}
                    >
                      Try again
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={openPicker}
                  >
                    Choose another photo
                  </button>
                </div>
              </div>
            </div>
          )}

          {phase === "result" && result && view && (
            <div className={styles.resultBody}>
              {isSampleMode && (
                <p className={styles.synthNote}>
                  <FlaskConical size={14} aria-hidden="true" /> Illustrative
                  synthetic case — for demonstration only.
                </p>
              )}

              {view.abstained ? (
                <div className={styles.abstain}>
                  <Info size={22} aria-hidden="true" />
                  <div>
                    <span className={styles.abstainBadge}>
                      {isDemoMode ? "DEMO ABSTENTION · NO DIAGNOSIS" : "IMAGE ASSESSMENT · REVIEW REQUIRED"}
                    </span>
                    <strong className={styles.abstainTitle}>
                      {isDemoMode ? "No Live Assessment in Demo Mode" : "A Reliable Assessment Could Not Be Completed"}
                    </strong>
                    <p>
                      {view.abstentionMessage ??
                        (isDemoMode
                          ? "Demo mode does not run a model on patient-supplied images."
                          : "The image did not support a reliable assessment. Follow the image-quality guidance and seek professional review.")}
                    </p>
                    <ul className={styles.abstainList}>
                      {isDemoMode ? (
                        <>
                          <li>No simulated diagnosis is generated for patient-supplied images in Demo Mode.</li>
                          <li>Switch to authenticated Real API Mode to request a live assessment.</li>
                          <li>Use the curated illustrative reference to preview the result layout.</li>
                        </>
                      ) : (
                        <>
                          <li>This result does not establish or exclude a medical condition.</li>
                          <li>Try a clearer, well-lit photograph only if doing so does not delay needed medical care.</li>
                          <li>Seek professional review if the skin change is new, worsening, bleeding, painful or otherwise concerning.</li>
                        </>
                      )}
                    </ul>
                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.primary}
                        onClick={onLoadSample}
                      >
                        Inspect Curated Reference Sample
                      </button>
                      <button
                        type="button"
                        className={styles.secondary}
                        onClick={onViewVisitSummary}
                      >
                        Proceed to Visit Dossier
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={styles.resultCols}>
                  <div>
                    <span className={styles.assessmentBadge}>
                      {isSampleMode ? "ILLUSTRATIVE REFERENCE SAMPLE" : "LIVE BACKEND INFERENCE"}
                    </span>
                    <h3 className={styles.primaryFinding}>{result.assessment?.prediction.display_label || result.predicted_class || result.prediction || "Assessment inconclusive"}</h3>
                    {view.confidenceLabel && <p className={styles.quality}>Assessment confidence: <strong>{view.confidenceLabel.toUpperCase()}</strong> (qualitative, not a calibrated probability)</p>}

                    {toPercent(view.confidence) !== null && (
                      <div className={styles.meterBlock}>
                        <span>Model confidence</span>
                        <div
                          className={styles.meter}
                          role="meter"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={toPercent(view.confidence)!}
                          aria-label="Model confidence"
                        >
                          <i style={{ width: `${toPercent(view.confidence)}%` }} />
                        </div>
                        <strong>{toPercent(view.confidence)}%</strong>
                      </div>
                    )}

                    {view.imageQuality && (
                      <p
                        className={styles.quality}
                        data-ok={view.imageQuality.acceptable || undefined}
                      >
                        Image quality:{" "}
                        <strong>{view.imageQuality.label.toUpperCase()}</strong>
                        {view.imageQuality.notes.length
                          ? ` — ${view.imageQuality.notes.join("; ")}`
                          : " (Valid resolution)"}
                      </p>
                    )}

                    {view.summary && <p className={styles.summary}>{view.summary}</p>}
                    {(result.analysis_provider || result.analysis_model) && (
                      <p className={styles.quality}>AI route: <strong>{result.analysis_provider || "Provider not reported"}</strong> / {result.analysis_model || "model not reported"}{result.fallback_used ? " · fallback used" : ""}</p>
                    )}
                  </div>

                  <div>
                    <h3 className={styles.subTitle}>
                      Candidate findings for clinician review
                    </h3>
                    {view.candidates.length === 0 ? (
                      <p className={styles.muted}>
                        No candidate findings were returned.
                      </p>
                    ) : (
                      <ul className={styles.candidates}>
                        {view.candidates.map((c) => (
                          <li key={c.id}>
                            <span>
                              <strong>{c.label}</strong>
                              {c.note && <small>{c.note}</small>}
                            </span>
                            {toPercent(c.confidence) !== null ? (
                              <em>{toPercent(c.confidence)}%</em>
                            ) : c.confidenceLabel ? (
                              <em>{c.confidenceLabel}</em>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {result.assessment && (
                <section className={styles.clinicalDetails} aria-label="Detailed AI skin assessment">
                  <div className={styles.detailHeader}>
                    <div>
                      <h3>Complete skin assessment</h3>
                      <p>Observed findings, user-reported information and suggested next steps are shown separately.</p>
                    </div>
                    <span className={styles.detailRisk} data-risk={result.assessment.risk_level}>{result.assessment.risk_level.replace(/_/g, " ").toUpperCase()} RISK</span>
                  </div>
                  <div className={styles.detailGrid}>
                    <article className={styles.detailCard}>
                      <h4>Visible image findings</h4>
                      <p>{result.assessment.appearance_assessment.description}</p>
                      <p><strong>Apparent area:</strong> {result.assessment.affected_area}</p>
                      <ul>{result.assessment.visible_observations.map((item, i) => <li key={`obs-${i}`}>{item}</li>)}</ul>
                    </article>
                    <article className={styles.detailCard}>
                      <h4>Reported symptoms</h4>
                      <p>{result.assessment.reported_symptoms_summary}</p>
                      <p><strong>Possible triggers to discuss:</strong></p>
                      <ul>{result.assessment.possible_triggers_to_discuss.map((item, i) => <li key={`trigger-${i}`}>{item}</li>)}</ul>
                    </article>
                    <article className={styles.detailCard}>
                      <h4>Primary possibility and alternatives</h4>
                      <p><strong>{result.assessment.prediction.display_label}</strong> ({result.assessment.prediction.confidence_level} qualitative confidence) — {result.assessment.prediction.rationale}</p>
                      <ul>{result.assessment.alternatives.map((item, i) => <li key={`alt-${i}`}><strong>{item.condition_name}</strong> ({item.confidence_level}) — {item.rationale} {item.supporting_observations.length ? `Supporting observations: ${item.supporting_observations.join("; ")}.` : ""} {item.limitations.length ? `Not established: ${item.limitations.join("; ")}.` : ""} {item.distinguishing_questions?.length ? `Questions: ${item.distinguishing_questions.join("; ")}.` : ""}</li>)}</ul>
                      {result.assessment.differential_comparison?.length ? <ul>{result.assessment.differential_comparison.map((item, i) => <li key={`compare-${i}`}>{item}</li>)}</ul> : null}
                      <p className={styles.detailDisclaimer}>These are possible explanations for discussion, not confirmed diagnoses or calibrated probabilities.</p>
                    </article>
                    <article className={styles.detailCard}>
                      <h4>Follow-up questions and what the image cannot establish</h4>
                      <ul>{result.assessment.follow_up_questions.map((item, i) => <li key={`question-${i}`}>{item}</li>)}</ul>
                      {result.assessment.clinical_questions_to_distinguish?.length ? <ul>{result.assessment.clinical_questions_to_distinguish.map((item, i) => <li key={`distinguish-${i}`}>{item}</li>)}</ul> : null}
                      {result.assessment.what_image_cannot_establish?.length ? <><strong>Cannot be established from this photo alone</strong><ul>{result.assessment.what_image_cannot_establish.map((item, i) => <li key={`cannot-${i}`}>{item}</li>)}</ul></> : null}
                    </article>
                    <article className={styles.detailCard}>
                      <h4>Referral and warning signs</h4>
                      <p><strong>Specialist:</strong> {result.assessment.recommended_specialist}</p>
                      <p><strong>Suggested timeframe:</strong> {result.assessment.referral_timeframe}</p>
                      <ul>{result.assessment.red_flags.map((item, i) => <li key={`flag-${i}`}>{item}</li>)}</ul>
                      <ul>{result.assessment.next_action.map((item, i) => <li key={`next-${i}`}>{item}</li>)}</ul>
                    </article>
                    {care && (
                      <article className={styles.detailCard}>
                        <h4>Medical next steps and medicine information</h4>
                        <ul>{care.medical_next_steps.map((item, i) => <li key={`medical-${i}`}>{item}</li>)}</ul>
                        {care.medicine_information.map((item, i) => <p key={`med-${i}`}><strong>{item.medicine_or_category}:</strong> {item.purpose} {item.common_safety_considerations.join("; ")} {item.verification_required ? "— confirm suitability with a clinician or pharmacist." : ""}</p>)}
                        <p className={styles.detailDisclaimer}>{care.medicine_disclaimer}</p>
                      </article>
                    )}
                    {care && (
                      <article className={styles.detailCard}>
                        <h4>Daily skin-care and lifestyle</h4>
                        <ul>{care.lifestyle_plan.map((item, i) => <li key={`life-${i}`}><strong>{item.area}:</strong> {item.recommendation} ({item.frequency}) {item.cautions.join("; ")}</li>)}</ul>
                      </article>
                    )}
                    {care && (
                      <article className={styles.detailCard}>
                        <h4>Dietary guidance</h4>
                        <ul>{care.dietary_guidance.map((item, i) => <li key={`diet-${i}`}>{item.recommendation} {item.rationale} {item.cautions.join("; ")}</li>)}</ul>
                      </article>
                    )}
                    {care && (
                      <article className={styles.detailCard}>
                        <h4>Ayurvedic supportive information</h4>
                        <ul>{care.ayurveda_information.map((item, i) => <li key={`ayur-${i}`}><strong>{item.topic}:</strong> {item.traditional_context} {item.supportive_wellness_information} <em>Evidence: {item.evidence_level.replace(/_/g, " ")}</em> {item.safety_notes.join("; ")}</li>)}</ul>
                        <ul>{care.ayurveda_routine.map((item, i) => <li key={`routine-${i}`}><strong>{item.timing} — {item.step}:</strong> {item.purpose} {item.safety_boundary}</li>)}</ul>
                        <p className={styles.detailDisclaimer}>{care.care_disclaimer}</p>
                      </article>
                    )}
                    {care && (
                      <article className={styles.detailCard}>
                        <h4>Monitoring and follow-up</h4>
                        <ul>{care.monitoring_timeline.map((item, i) => <li key={`monitor-${i}`}>{item}</li>)}</ul>
                        <p><strong>Doctor summary:</strong> {result.assessment.doctor_summary}</p>
                      </article>
                    )}
                  </div>
                </section>
              )}

              {/* Clinical safety information — always shown with a result */}
              <div className={styles.clinicalWarning}>
                <Info size={18} aria-hidden="true" />
                <p>
                  <strong>Clinical Notice:</strong> these AI-assisted observations are NOT a verified medical diagnosis.
                  Present them to a qualified physician or dermatologist; image-only
                  assessment may not identify every skin condition.
                </p>
              </div>

              {result.requires_professional_review && (
                <p className={styles.reviewFlag}>
                  <ShieldCheck size={16} aria-hidden="true" /> Professional
                  clinician review is recommended for this assessment.
                </p>
              )}

              {result.is_high_risk && (
                <p className={styles.riskFlag} role="alert">
                  <AlertTriangle size={16} aria-hidden="true" /> This assessment
                  is flagged for priority clinical review.
                </p>
              )}

              {result.record_id && <p className={styles.quality}>Saved to your account · Clinical record #{result.record_id}</p>}
              <button
                type="button"
                className={styles.primary}
                onClick={onViewVisitSummary}
              >
                <ShieldCheck size={16} aria-hidden="true" /> Prepare Doctor
                Consultation Dossier <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </section>
      </div>

      {/* 7. Supporting actions */}
      <div className={styles.extras}>
        {quick.length > 0 && (
          <section className={styles.card} aria-labelledby={`${uid}-qa`}>
            <h2 id={`${uid}-qa`} className={styles.cardTitle}>
              Quick actions
            </h2>
            <div className={styles.quick}>
              {quick.map(({ label, Icon, tone, onClick }) => (
                <button
                  key={label}
                  type="button"
                  className={styles.quickBtn}
                  data-tone={tone}
                  onClick={onClick}
                >
                  <Icon size={20} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </section>
        )}

        <section className={styles.card} aria-labelledby={`${uid}-wj`}>
          <h2 id={`${uid}-wj`} className={styles.cardTitle}>
            <Leaf size={20} aria-hidden="true" /> Your wellness journey
          </h2>
          <ol className={styles.journey}>
            {JOURNEY.map(({ label, Icon }) => (
              <li key={label}>
                <span>
                  <Icon size={20} aria-hidden="true" />
                </span>
                {label}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* 8. Clinical safety disclaimer */}
      <p className={styles.disclaimer}>
        <Info size={16} aria-hidden="true" />
        <span>
          This tool offers educational, AI-assisted observations and is not a
          medical diagnosis. Always consult a qualified healthcare professional.
        </span>
      </p>

      {cameraOpen && (
        <div
          className={styles.cameraBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCameraOpen(false);
          }}
        >
          <section className={styles.cameraDialog} role="dialog" aria-modal="true" aria-labelledby={`${uid}-camera-title`}>
            <div className={styles.cameraHeader}>
              <div>
                <h3 id={`${uid}-camera-title`}>Capture a skin photo</h3>
                <p>Position the affected area in clear, even lighting.</p>
              </div>
              <button type="button" className={styles.cameraClose} onClick={() => setCameraOpen(false)} aria-label="Close camera">×</button>
            </div>
            {cameraError ? (
              <div className={styles.cameraError} role="alert">
                <Camera size={20} aria-hidden="true" />
                <p>{cameraError}</p>
                <button type="button" className={styles.secondary} onClick={() => cameraInputRef.current?.click()}>Choose an image instead</button>
              </div>
            ) : (
              <div className={styles.cameraPreview}>
                <video ref={videoRef} autoPlay muted playsInline aria-label="Live camera preview" />
                {!cameraReady && <span className={styles.cameraLoading}>Opening camera…</span>}
              </div>
            )}
            <div className={styles.cameraActions}>
              <button type="button" className={styles.secondary} onClick={() => setCameraOpen(false)}>Cancel</button>
              <button type="button" className={styles.primary} onClick={captureCameraPhoto} disabled={!cameraReady || Boolean(cameraError)}>
                <Camera size={17} aria-hidden="true" /> Capture photo
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default SkinAssessmentExperience;