import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useAppMode } from "../context/AppModeContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  FileText,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Upload,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { apiFetch } from "../services/apiClient";
import type { MedicalReportAnalysisResponse, PrescriptionAnalysisResponse } from "../types/api";
import styles from "./ReportsPage.module.css";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(" ");

interface DocumentFile {
  id: number;
  file: File;
  objectUrl: string;
  category: string;
  status: "pending" | "analyzed" | "error";
  result?: MedicalReportAnalysisResponse;
  prescriptionResult?: PrescriptionAnalysisResponse;
  error?: string;
}

const ACCEPTED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp"];
const MAX_SIZE_MB = 10;

const CATEGORIES: Array<{ label: string; icon: string; color: string }> = [
  { label: "Laboratory Reports", icon: "📋", color: "#dcecfb" },
  { label: "Prescriptions", icon: "💊", color: "#d9f2e6" },
  { label: "Consultation Notes", icon: "📄", color: "#e8e1fa" },
  { label: "Imaging Reports", icon: "🩻", color: "#fde8d6" },
  { label: "Other Documents", icon: "📎", color: "#e6ecef" },
];

const formatSize = (bytes: number): string => {
  if (bytes < 1048576) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
};

const extensionOf = (name: string): string => name.split(".").pop()?.toLowerCase() ?? "";

export const ReportsPage: React.FC = () => {
  const { language } = useAppMode();
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef<HTMLDivElement>(null);
  const extractionRef = useRef<HTMLDivElement>(null);

  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [erMsg, setErMsg] = useState<string | null>(null);
  const [analysisMsg, setAnalysisMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocumentFile | null>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  // Revoke every remaining object URL exactly once when the page unmounts.
  useEffect(() => {
    const registry = objectUrlsRef.current;
    return () => {
      registry.forEach((url) => URL.revokeObjectURL(url));
      registry.clear();
    };
  }, []);

  // Attach the Escape handler only while the preview dialog is open.
  useEffect(() => {
    if (!preview) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [preview]);

  const clearMessages = useCallback(() => {
    setOkMsg(null);
    setErMsg(null);
    setAnalysisMsg(null);
  }, []);

  const addFiles = (list: FileList | File[]) => {
    clearMessages();
    const files = Array.from(list);
    const valid: File[] = [];
    const invalid: File[] = [];

    for (const file of files) {
      const ext = extensionOf(file.name);
      const typeOk = ACCEPTED_EXTENSIONS.includes(ext);
      const sizeOk = file.size <= MAX_SIZE_MB * 1024 * 1024;
      if (typeOk && sizeOk) valid.push(file);
      else invalid.push(file);
    }

    const additions: DocumentFile[] = valid.map((file) => {
      const objectUrl = URL.createObjectURL(file);
      objectUrlsRef.current.add(objectUrl);
      return {
        id: Date.now() + Math.random(),
        file,
        objectUrl,
        category: "",
        status: "pending",
      };
    });

    if (additions.length > 0) {
      setDocuments((prev) => [...prev, ...additions]);
    }

    if (valid.length) {
      setOkMsg(`${valid.length} document${valid.length > 1 ? "s" : ""} selected locally.`);
      toast.success(`${valid.length} document(s) queued locally.`);
    }
    if (invalid.length) {
      const names = invalid.map((f) => f.name).join(", ");
      setErMsg(`Unsupported format or too large: ${names}. Supported: PDF, JPG, JPEG, PNG, WEBP (max ${MAX_SIZE_MB} MB each).`);
      toast.error(`Could not queue ${invalid.length} file(s).`);
    }
  };

  const handleRemove = (id: number) => {
    const target = documents.find((document) => document.id === id);

    if (target) {
      URL.revokeObjectURL(target.objectUrl);
      objectUrlsRef.current.delete(target.objectUrl);
    }

    if (preview?.id === id) setPreview(null);
    setDocuments((prev) => prev.filter((document) => document.id !== id));
  };

  const handleClearAll = () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
    setPreview(null);
    setDocuments([]);
    setOkMsg(null);
    setErMsg(null);
    setAnalysisMsg(null);
    toast.info("Cleared all selected documents.");
  };

  const handleReviewFiles = () => {
    queueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setOkMsg("Reviewing your selected documents below.");
    toast.info("Review your selected documents below.");
  };

  const handleAnalyzeDocuments = async () => {
    if (!documents.length) return;
    if (!isAuthenticated || !user) {
      setAnalysisMsg("Please sign in before uploading medical documents for secure analysis.");
      toast.warning("Sign in to analyze and save medical documents securely.");
      return;
    }

    setAnalysisMsg("Analyzing documents securely...");
    toast.info("Starting document analysis...");
    let succeeded = 0;
    let failed = 0;

    for (const doc of documents) {
      try {
        const formData = new FormData();
        formData.append("file", doc.file);
        formData.append("language", language);

        if (doc.category === "Prescriptions") {
          const result = await apiFetch<PrescriptionAnalysisResponse>(
            "/api/v1/prescriptions/analyze",
            { method: "POST", body: formData }
          );
          setDocuments((prev) => prev.map((d) => d.id === doc.id
            ? { ...d, status: "analyzed", prescriptionResult: result, result: undefined, error: undefined }
            : d));
        } else {
          const result = await apiFetch<MedicalReportAnalysisResponse>(
            "/api/v1/reports/analyze",
            { method: "POST", body: formData }
          );
          setDocuments((prev) => prev.map((d) => d.id === doc.id
            ? { ...d, status: "analyzed", result, prescriptionResult: undefined, error: undefined }
            : d));
        }
        succeeded += 1;
      } catch (err: unknown) {
        failed += 1;
        const msg = err instanceof Error ? err.message : "Analysis failed.";
        setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, status: "error", error: msg } : d));
      }
    }

    const completionMessage = `${succeeded} document(s) analyzed; ${failed} failed. Review all extracted values against the original. Prescription details remain unverified until confirmed.`;
    setAnalysisMsg(completionMessage);
    if (failed > 0) toast.warning(completionMessage);
    else toast.success(completionMessage);
    extractionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleCategoryChange = (id: number, value: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, category: value } : d))
    );
  };

  const openPreview = (doc: DocumentFile) => {
    setPreview(doc);
  };

  const categoryCount = (label: string) =>
    documents.filter((d) => d.category === label).length;

  const pendingCount = documents.filter((d) => d.status === "pending").length;
  const analyzedCount = documents.filter((d) => d.status === "analyzed").length;
  const errorCount = documents.filter((d) => d.status === "error").length;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.pageWrap}>
        <motion.section
          className={styles.pageHeader}
          data-feature-hero="split"
          initial="hidden"
          animate="visible"
          custom={0}
          variants={fadeUp}
          aria-labelledby="reports-page-title"
        >
          <div data-hero-copy>
            <span data-hero-eyebrow>DOCUMENT INTELLIGENCE</span>
            <h1 id="reports-page-title" data-hero-title>Medical Reports &amp; OCR</h1>
            <p data-hero-subtitle>Your healthcare documents, organised in one place.</p>
            <p data-hero-description>Upload medical reports, prescriptions and supporting documents. Keep your health information organised and prepare for a clearer healthcare consultation.</p>
          </div>
          <div data-hero-art="reports" aria-hidden="true">
            <img
              src="/assets/reports-ocr-hero-art.png"
              alt=""
              loading="eager"
              decoding="async"
            />
          </div>
        </motion.section>

        <div className={styles.workflow} role="navigation" aria-label="Document processing workflow">
          <div className={cx(styles.step, styles.stepActive)} id="wf-1" aria-current="step">
            <span className={styles.stepNum}>1</span>
            <span>Upload Documents</span>
          </div>
          <span className={styles.arrow} aria-hidden="true">›</span>
          <div
            className={cx(styles.step, documents.length ? styles.stepActive : styles.stepPending)}
            id="wf-2"
            aria-current={documents.length ? "step" : undefined}
          >
            <span className={styles.stepNum}>2</span>
            <span>Review Files</span>
          </div>
          <span className={styles.arrow} aria-hidden="true">›</span>
          <div
            className={cx(styles.step, analyzedCount > 0 ? styles.stepActive : styles.stepPending)}
            id="wf-3"
            aria-current={analyzedCount > 0 ? "step" : undefined}
          >
            <span className={styles.stepNum}>3</span>
            <div>
              Extract Information
              <span className={styles.stepBadge}>
                {isAuthenticated && user ? "Server AI Analysis" : "Sign in to analyze"}
              </span>
            </div>
          </div>
        </div>

        {okMsg && (
          <div className={cx(styles.msg, styles.msgOk)} role="status" aria-live="polite">
            <CheckCircle2 size={16} /> {okMsg}
          </div>
        )}
        {erMsg && (
          <div className={cx(styles.msg, styles.msgErr)} role="alert" aria-live="assertive">
            <ShieldAlert size={16} /> {erMsg}
          </div>
        )}

        <section className={styles.sec} aria-labelledby="up-h">
          <h3 id="up-h" className={styles.secHead}>
            <Upload size={18} className={styles.secIcon} aria-hidden="true" />
            Upload Your Medical Documents
          </h3>
          <div
            className={cx(styles.drop, dragActive && styles.dropActive)}
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
          >
            <div className={styles.dropIcon}>📎</div>
            <div className={styles.dropBody}>
              <div className={styles.dropTitle}>Drag and drop your documents here</div>
              <button
                type="button"
                className={styles.dropBtn}
                onClick={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
              >
                📁 Browse Files
              </button>
              <small className={styles.dropHint}>
                Select multiple files • Supported formats: PDF, JPG, JPEG, PNG, WEBP (max {MAX_SIZE_MB} MB each)
              </small>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            hidden
            onChange={(e) => {
              const selectedFiles = e.currentTarget.files;
              if (selectedFiles?.length) addFiles(selectedFiles);
              e.currentTarget.value = "";
            }}
            aria-label="Select medical documents"
          />
          <p className={styles.dropNote}>
            Documents are uploaded to the DermaSathiAI backend for secure OCR analysis.
          </p>
          {documents.length > 0 && (
            <section className={styles.nextActions} aria-label="Next actions">
              <button
                type="button"
                className={styles.nextBtn}
                onClick={handleReviewFiles}
              >
                <FileText size={16} /> Review Selected Files
              </button>
              <button
                type="button"
                className={styles.nextBtnPrimary}
                onClick={handleAnalyzeDocuments}
                disabled={!isAuthenticated || !user}
              >
                <Sparkles size={16} /> Analyze Documents
              </button>
              {(!isAuthenticated || !user) && (
                <span className={styles.hintBadge}>Sign in to securely analyze documents</span>
              )}
            </section>
          )}
          {analysisMsg && (
            <div className={cx(styles.msg, styles.msgInfo)} role="status" aria-live="polite">
              <AlertCircle size={16} /> {analysisMsg}
            </div>
          )}
        </section>

        <section className={styles.sec} aria-labelledby="q-h">
          <h3 id="q-h" className={styles.secHead}>
            📄 Selected Documents
            <span className={styles.qCount}>({documents.length})</span>
            {documents.length && (
              <button type="button" className={styles.clearBtn} onClick={handleClearAll}>
                Clear All 🗑️
              </button>
            )}
          </h3>
          <div className={styles.queue} ref={queueRef}>
            {documents.length ? (
              documents.map((doc) => {
                const ext = extensionOf(doc.file.name);
                const isImage = ext !== "pdf";
                return (
                  <div key={doc.id} className={styles.qItem}>
                    <div className={cx(styles.qThumb, isImage ? styles.qThumbImage : styles.qThumbPdf)}>
                      {isImage ? (
                        <img src={doc.objectUrl} alt="" className={styles.qThumbImg} />
                      ) : (
                        <span className={styles.qPdfLabel}>PDF</span>
                      )}
                    </div>
                    <div className={styles.qMeta}>
                      <b title={doc.file.name}>{doc.file.name}</b>
                      <small>{ext.toUpperCase()} • {formatSize(doc.file.size)}</small>
                      {doc.status === "analyzed" && (
                        <span className={styles.qStatusAnalyzed}>✓ Analyzed</span>
                      )}
                      {doc.status === "error" && (
                        <span className={styles.qStatusError}>✗ Error</span>
                      )}
                    </div>
                    <div className={styles.qActions}>
                      <select
                        value={doc.category}
                        onChange={(e) => handleCategoryChange(doc.id, e.target.value)}
                        aria-label={`Category for ${doc.file.name}`}
                      >
                        <option value="">Unassigned</option>
                        {CATEGORIES.map((c) => (
                          <option key={c.label} value={c.label}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={styles.previewBtn}
                        aria-label={`Preview ${doc.file.name}`}
                        onClick={() => openPreview(doc)}
                      >
                        👁️ Preview
                      </button>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        aria-label={`Remove ${doc.file.name}`}
                        onClick={() => handleRemove(doc.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>📂</span>
                No documents selected yet. Drag files here or choose Browse Files.
              </div>
            )}
          </div>
        </section>

        {analyzedCount > 0 && (
          <section className={styles.sec} aria-labelledby="ex-h" ref={extractionRef}>
            <h3 id="ex-h" className={styles.secHead}>
              <Sparkles size={18} className={styles.secIcon} aria-hidden="true" />
              OCR Analysis Results
            </h3>
            <div className={styles.exFlow}>
              <span className={styles.exStepBadge}>{analyzedCount} analyzed</span>
              {pendingCount > 0 && <span className={styles.exStepBadge}>{pendingCount} pending</span>}
              {errorCount > 0 && <span className={styles.exStepBadge}>{errorCount} errors</span>}
            </div>
            <div className={styles.resultsGrid}>
              {documents
                .filter((d) => d.status === "analyzed" && (d.result || d.prescriptionResult))
                .map((doc) => {
                  if (doc.prescriptionResult) {
                    const p = doc.prescriptionResult;
                    return (
                      <div key={doc.id} className={styles.resultCard}>
                        <div className={styles.resultHeader}>
                          <h4>Prescription extracted: {p.filename}</h4>
                          <span className={styles.resultType}>User verification required</span>
                        </div>
                        <p className={styles.resultSummary}>{p.doctor_name || "Prescriber not identified"} {p.clinic_or_hospital ? `— ${p.clinic_or_hospital}` : ""}</p>
                        {p.diagnosis_or_symptoms && <p>{p.diagnosis_or_symptoms}</p>}
                        <ul>{p.medicines.map((m) => <li key={m.id ?? `${m.medicine_name}-${m.strength}`}><strong>{m.medicine_name}</strong>{m.strength ? ` (${m.strength})` : ""} — {m.dosage || "Dosage unclear"}; {m.frequency || "Frequency unclear"}; {m.duration || "Duration unclear"}{m.is_unclear ? ` — Review: ${m.unclear_reason || "unclear extraction"}` : ""}</li>)}</ul>
                        {p.general_advice && <p>{p.general_advice}</p>}
                        <p className={styles.resultDisclaimer}>{p.clinical_safety_notice}</p>
                        <p className={styles.resultTimestamp}>{p.timestamp}</p>
                      </div>
                    );
                  }
                  const r = doc.result!;
                  return (
                    <div key={doc.id} className={styles.resultCard}>
                      <div className={styles.resultHeader}>
                        <h4>{r.report_title}</h4>
                        <span className={styles.resultType}>{r.report_type}</span>
                      </div>
                      <p className={styles.resultSummary}>{r.patient_summary}</p>
                      {r.what_this_report_measures && <div><strong>What this report measures</strong><p>{r.what_this_report_measures}</p></div>}
                      {r.interpretation_by_section?.length ? <div><strong>Section-by-section interpretation</strong>{r.interpretation_by_section.map((section, i) => <div key={`section-${i}`}><h5>{section.section_name}</h5><p>{section.summary}</p>{section.observations?.length ? <ul>{section.observations.map((item, j) => <li key={j}>{item}</li>)}</ul> : null}</div>)}</div> : null}
                      {r.key_findings.length > 0 && (
                        <div>
                          <strong>Key Findings:</strong>
                          <ul>
                            {r.key_findings.map((f, i) => (
                              <li key={i}>{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {r.abnormal_values.length > 0 && (
                        <div>
                          <strong>Abnormal Values:</strong>
                          <ul>
                            {r.abnormal_values.map((v, i) => (
                              <li key={i}>
                                <strong>{v.parameter}</strong>: {v.value} ({v.reference_range || "N/A"})
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {r.normal_values?.length ? <div><strong>Values within the report's printed reference ranges</strong><ul>{r.normal_values.map((item, i) => <li key={i}>{item}</li>)}</ul></div> : null}
                      {r.follow_up_recommendations?.length ? <div><strong>Suggested follow-up to discuss</strong><ul>{r.follow_up_recommendations.map((item, i) => <li key={i}>{item}</li>)}</ul></div> : null}
                      {r.doctor_questions?.length ? <div><strong>Questions for your doctor</strong><ul>{r.doctor_questions.map((item, i) => <li key={i}>{item}</li>)}</ul></div> : null}
                      {r.questions_to_confirm?.length ? <div><strong>Additional context to confirm</strong><ul>{r.questions_to_confirm.map((item, i) => <li key={i}>{item}</li>)}</ul></div> : null}
                      {r.when_to_seek_urgent_care?.length ? <div><strong>When to seek urgent care</strong><ul>{r.when_to_seek_urgent_care.map((item, i) => <li key={i}>{item}</li>)}</ul></div> : null}
                      {r.clinical_notes && <div><strong>Clinical context</strong><p>{r.clinical_notes}</p></div>}
                      {r.limitations?.length ? <div><strong>Limitations</strong><ul>{r.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul></div> : null}
                      {r.data_quality_notes?.length ? <div><strong>Document readability and extraction notes</strong><ul>{r.data_quality_notes.map((item, i) => <li key={i}>{item}</li>)}</ul></div> : null}
                      <p className={styles.resultConclusion}>{r.conclusion}</p>
                      {r.record_id && <p className={styles.resultTimestamp}>Saved record #{r.record_id} · {r.analysis_provider || "AI provider"} / {r.analysis_model || "model unavailable"}</p>}
                      <p className={styles.resultTimestamp}>{r.timestamp}</p>
                      <p className={styles.resultDisclaimer}>
                        OCR output is unverified. Please consult your doctor for clinical interpretation.
                      </p>
                    </div>
                  );
                })}
            </div>
          </section>
        )}

        <section className={styles.sec} aria-labelledby="si-h">
          <h3 id="si-h" className={styles.secHead}>
            <Shield size={18} className={styles.secIcon} aria-hidden="true" />
            Document Organisation
          </h3>
          <div className={styles.cats}>
            {CATEGORIES.map((cat) => (
              <div
                key={cat.label}
                className={styles.cat}
                style={{ borderColor: cat.color }}
              >
                <span className={styles.catIcon} style={{ color: cat.color }}>{cat.icon}</span>
                <span className={styles.catLabel}>{cat.label}</span>
                <span className={styles.catCount}>{categoryCount(cat.label) ? categoryCount(cat.label) + " file" + (categoryCount(cat.label) > 1 ? "s" : "") : ""}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.notice} aria-label="Clinical verification notice">
          <ShieldAlert size={24} className={styles.noticeIcon} aria-hidden="true" />
          <div>
            <strong>Please review your uploaded documents.</strong>{" "}
            OCR output, when available, may require clinical verification.
          </div>
        </section>
      </div>
    </div>
  );
};

export default ReportsPage;
