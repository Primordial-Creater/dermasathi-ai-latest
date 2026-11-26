import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import styles from "./Toast.module.css";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastProps extends HTMLMotionProps<"div"> {
  type?: ToastType;
  message: string;
  onClose?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  type = "info",
  message,
  onClose,
  className = "",
  ...props
}) => {
  const icon = {
    success: <CheckCircle2 size={16} aria-hidden="true" />,
    error: <AlertCircle size={16} aria-hidden="true" />,
    info: <Info size={16} aria-hidden="true" />,
    warning: <AlertTriangle size={16} aria-hidden="true" />,
  }[type];

  const iconClass = {
    success: styles.iconSuccess,
    error: styles.iconError,
    info: styles.iconInfo,
    warning: styles.iconWarning,
  }[type];

  const pillClass = {
    success: styles.toastPillSuccess,
    error: styles.toastPillError,
    info: styles.toastPillInfo,
    warning: styles.toastPillWarning,
  }[type];

  return (
    <motion.div
      role="status"
      className={`${styles.toastPill} ${pillClass} ${className}`.trim()}
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, y: 10 }}
      transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
      layout
      {...props}
    >
      <div className={`${styles.iconCircle} ${iconClass}`}>{icon}</div>
      <span className={styles.message}>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className={styles.closeBtn}
          aria-label="Dismiss notification"
          type="button"
        >
          <X size={14} />
        </button>
      )}
    </motion.div>
  );
};

