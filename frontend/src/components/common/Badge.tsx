import React from "react";
import styles from "./Badge.module.css";

export type BadgeTone = "blue" | "purple" | "green" | "amber" | "red" | "neutral" | "recessed";
export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps {
  tone?: BadgeTone;
  size?: BadgeSize;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  tone = "blue",
  size = "md",
  icon,
  children,
  className = "",
}) => {
  const toneClass = {
    blue: styles.toneBlue,
    purple: styles.tonePurple,
    green: styles.toneGreen,
    amber: styles.toneAmber,
    red: styles.toneRed,
    neutral: styles.toneNeutral,
    recessed: styles.toneRecessed,
  }[tone];

  const sizeClass = {
    sm: styles.sizeSm,
    md: styles.sizeMd,
    lg: styles.sizeLg,
  }[size];

  return (
    <span className={`${styles.badge} ${toneClass} ${sizeClass} ${className}`.trim()}>
      {icon && <span>{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
