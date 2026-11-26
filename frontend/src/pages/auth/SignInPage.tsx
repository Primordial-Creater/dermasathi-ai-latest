import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { useAppMode } from "../../context/AppModeContext";
import { 
  ShieldCheck, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight
} from "lucide-react";
import styles from "./SignInPage.module.css";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] },
  },
};

export const SignInPage: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { setDemoMode, setLanguage } = useAppMode();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Please enter both email address and password.");
      return;
    }
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      if (user.preferred_language) {
        const supported = ["en", "hi", "mr"];
        if (supported.includes(user.preferred_language)) setLanguage(user.preferred_language as Parameters<typeof setLanguage>[0]);
      }
      setDemoMode(false);
      toast.success(`Welcome back, ${user.full_name}.`);
      navigate("/skin-assessment");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authWrapper}>
      <motion.div
        className={styles.authCard}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
      >
        {/* Brand Header */}
        <div className={styles.authHeader}>
          <div className={styles.brandIconCircle}>
            <img src="/assets/dermasathi-brand-mark.png" alt="DermaSathiAI lotus" />
          </div>
          <span className={styles.brandWordmark}>DermaSathiAI</span>
          <h1 className={styles.authTitle}>Sign In to DermaSathi</h1>
          <p className={styles.authSubtitle}>
            Access your secure longitudinal dermatology records and clinical triage dossier.
          </p>
        </div>

        {/* Demo Integration Disclaimer */}
        <div className={styles.demoDisclaimer}>
          <ShieldCheck size={18} className={styles.disclaimerIcon} />
          <div>
            <strong>Secure patient sign-in</strong>
            <p>Your account is authenticated by the DermaSathiAI backend. Session refresh uses a secure HttpOnly cookie.</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label htmlFor="signin-email" className={styles.label}>
              Clinical Email Address
            </label>
            <div className={styles.inputWrap}>
              <Mail size={17} className={styles.inputIcon} />
              <input
                id="signin-email"
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

          <div className={styles.fieldGroup}>
            <div className={styles.passwordLabelRow}>
              <label htmlFor="signin-password" className={styles.label}>
                Password
              </label>
              <Link to="/forgot-password" className={styles.forgotLink}>
                Forgot Password?
              </Link>
            </div>
            <div className={styles.inputWrap}>
              <Lock size={17} className={styles.inputIcon} />
              <input
                id="signin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={styles.eyeBtn}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={styles.submitBtn}
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Footer Link to Sign Up */}
        <div className={styles.authFooter}>
          <span>Don't have a patient account? </span>
          <Link to="/signup" className={styles.signupLink}>
            Create an Account
          </Link>
        </div>
      </motion.div>
    </div>
  );
};
