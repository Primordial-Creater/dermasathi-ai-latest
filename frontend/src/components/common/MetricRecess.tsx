import React from "react";
import styles from "./MetricRecess.module.css";

export interface MetricRecessProps {
  label: string;
  value: string | number;
  subtext?: string;
  percentage?: number; // 0 to 100 if a progress bar is desired
  className?: string;
}

export const MetricRecess: React.FC<MetricRecessProps> = ({
  label,
  value,
  subtext,
  percentage,
  className = "",
}) => {
  return (
    <div className={`${styles.recessWell} ${className}`.trim()}>
      <span className={styles.label}>{label}</span>
      <div className={styles.valueRow}>
        <span className={styles.value}>{value}</span>
        {subtext && <span className={styles.subtext}>{subtext}</span>}
      </div>
      {typeof percentage === "number" && (
        <div className={styles.progressBarTrack}>
          <div
            className={styles.progressBarFill}
            style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
          />
        </div>
      )}
    </div>
  );
};
