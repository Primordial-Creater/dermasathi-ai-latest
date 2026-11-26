import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useToast } from "../../context/ToastContext";
import { 
  Mail, 
  ArrowLeft, 
  ShieldCheck 
} from "lucide-react";
import styles from "./ForgotPasswordPage.module.css";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] },
  },
};

export const ForgotPasswordPage: React.FC = () => {
  const toast = useToast();
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    toast.warning("Password recovery is not yet enabled by the backend. Please contact your DermaSathiAI administrator; no email has been sent.");
  };

  return (
    <div className={styles.authWrapper}>
      <motion.div
        className={styles.authCard}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
      >
        <div className={styles.authHeader}>
          <div className={styles.brandIconCircle}>
            <img src="/assets/dermasathi-brand-mark.png" alt="DermaSathiAI lotus" />
          </div>
          <span className={styles.brandWordmark}>DermaSathiAI</span>
          <h1 className={styles.authTitle}>Reset Password</h1>
          <p className={styles.authSubtitle}>
            Password recovery is not available yet. No recovery email will be sent.
          </p>
        </div>

        <div className={styles.demoDisclaimer}>
          <ShieldCheck size={18} className={styles.disclaimerIcon} />
          <div>
            <strong>Password recovery is not yet available</strong>
            <p>This backend does not currently expose a password-reset workflow. No recovery email or token will be generated.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.fieldGroup}>
              <label htmlFor="reset-email" className={styles.label}>
                Registered Clinical Email
              </label>
              <div className={styles.inputWrap}>
                <Mail size={17} className={styles.inputIcon} />
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={styles.input}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className={styles.submitBtn}
            >
              <span>View Recovery Status</span>
            </button>

            <div className={styles.authFooter}>
              <Link to="/login" className={styles.backLink}>
                <ArrowLeft size={15} />
                <span>Back to Sign In</span>
              </Link>
            </div>
        </form>
      </motion.div>
    </div>
  );
};
