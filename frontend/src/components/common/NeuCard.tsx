import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import styles from "./NeuCard.module.css";

export type NeuCardVariant = "raised" | "raised-sm" | "raised-lg" | "pressed" | "pressed-sm" | "glow" | "glass";
export type NeuCardRadius = "sm" | "md" | "lg" | "pill";
export type NeuCardPadding = "none" | "sm" | "md" | "lg";

export interface NeuCardProps extends HTMLMotionProps<"div"> {
  variant?: NeuCardVariant;
  radius?: NeuCardRadius;
  padding?: NeuCardPadding;
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const NeuCard: React.FC<NeuCardProps> = ({
  variant = "raised",
  radius = "md",
  padding = "md",
  interactive = false,
  className = "",
  children,
  ...props
}) => {
  const variantClass = {
    raised: styles.variantRaised,
    "raised-sm": styles.variantRaisedSm,
    "raised-lg": styles.variantRaisedLg,
    pressed: styles.variantPressed,
    "pressed-sm": styles.variantPressedSm,
    glow: styles.variantGlow,
    glass: styles.variantGlass,
  }[variant];

  const radiusClass = {
    sm: styles.radiusSm,
    md: styles.radiusMd,
    lg: styles.radiusLg,
    pill: styles.radiusPill,
  }[radius];

  const paddingClass = {
    none: "",
    sm: styles.paddingSm,
    md: styles.paddingMd,
    lg: styles.paddingLg,
  }[padding];

  const interactiveClass = interactive ? styles.interactive : "";

  return (
    <motion.div
      className={`${styles.card} ${variantClass} ${radiusClass} ${paddingClass} ${interactiveClass} ${className}`.trim()}
      whileHover={interactive ? { y: -2, transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] } } : undefined}
      {...props}
    >
      {children}
    </motion.div>
  );
};
