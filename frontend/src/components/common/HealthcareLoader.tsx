import React from "react";
import styles from "./HealthcareLoader.module.css";

export interface HealthcareLoaderProps {
  /** Optional label shown under the visual. */
  label?: string;
  /** Optional sub-label for extra context. */
  sublabel?: string;
  /** Optional genuine progress value (0–100). Omit if unknown. */
  progress?: number;
  /** Size in pixels of the square visual. */
  size?: number;
  className?: string;
}

/**
 * HealthcareLoader — Reusable layered epidermal / skin-scanning loader.
 *
 * A lightweight, CSS-3D "epidermal strata" visual: several softly layered
 * curved surfaces in sky-blue and mint with a moving light sweep that
 * represents a diagnostic scan. No WebGL, no extra dependencies.
 *
 * A progress indicator is only rendered when a *genuine* progress value is
 * supplied (no fabricated percentages). Honours prefers-reduced-motion.
 */
export const HealthcareLoader: React.FC<HealthcareLoaderProps> = ({
  label = "Scanning skin layers",
  sublabel,
  progress,
  size = 120,
  className = "",
}) => {
  const hasProgress =
    typeof progress === "number" && Number.isFinite(progress);

  return (
    <div
      className={`${styles.loader} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div
        className={styles.stage}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <div className={styles.scene}>
          <div className={`${styles.layer} ${styles.layerBack}`} />
          <div className={`${styles.layer} ${styles.layerMid}`} />
          <div className={`${styles.layer} ${styles.layerFront}`} />
          <div className={styles.sweep} />
          <div className={styles.glow} />
        </div>
      </div>

      <div className={styles.text}>
        <span className={styles.label}>{label}</span>
        {sublabel && <span className={styles.sublabel}>{sublabel}</span>}
        {hasProgress && (
          <span className={styles.progressWrap}>
            <span className={styles.progressTrack}>
              <span
                className={styles.progressFill}
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              />
            </span>
            <span className={styles.progressVal}>
              {Math.round(progress)}%
            </span>
          </span>
        )}
      </div>
    </div>
  );
};

export default HealthcareLoader;