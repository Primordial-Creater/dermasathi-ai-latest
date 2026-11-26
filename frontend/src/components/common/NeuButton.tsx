import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import styles from "./NeuButton.module.css";

export type NeuButtonVariant = "primary" | "secondary" | "pressed" | "danger" | "purple" | "ghost";
export type NeuButtonSize = "sm" | "md" | "lg";

export interface NeuButtonProps extends HTMLMotionProps<"button"> {
  variant?: NeuButtonVariant;
  size?: NeuButtonSize;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  loading?: boolean;
  children: React.ReactNode;
}

export const NeuButton: React.FC<NeuButtonProps> = ({
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}) => {
  const variantClass = {
    primary: styles.variantPrimary,
    secondary: styles.variantSecondary,
    pressed: styles.variantPressed,
    danger: styles.variantDanger,
    purple: styles.variantPurple,
    ghost: styles.variantGhost,
  }[variant];

  const sizeClass = {
    sm: styles.sizeSm,
    md: styles.sizeMd,
    lg: styles.sizeLg,
  }[size];

  return (
    <motion.button
      type="button"
      className={`${styles.btn} ${variantClass} ${sizeClass} ${className}`.trim()}
      disabled={disabled || loading}
      whileHover={{ scale: disabled || loading ? 1 : 1.015 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
      {...props}
    >
      {loading ? (
        <>
          <span className={`${styles.spinner} ${variant === "secondary" || variant === "ghost" ? styles.spinnerDark : ""}`} />
          <span>Processing...</span>
        </>
      ) : (
        <>
          {icon && iconPosition === "left" && <span className={styles.iconWrap}>{icon}</span>}
          <span>{children}</span>
          {icon && iconPosition === "right" && <span className={styles.iconWrap}>{icon}</span>}
        </>
      )}
    </motion.button>
  );
};
