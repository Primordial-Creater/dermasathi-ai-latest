import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { useAppMode } from "../../context/AppModeContext";
import { 
  ShieldCheck, 
  User, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle2
} from "lucide-react";
import styles from "./SignUpPage.module.css";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] },
  },
};

export const SignUpPage: React.FC = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const { register } = useAuth();
  const { language, setDemoMode } = useAppMode();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (!email.includes("@") || !email.includes(".")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      toast.error("Password is too long. Use no more than 72 UTF-8 bytes.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match. Please re-enter.");
      return;
    }
    if (!acceptedTerms) {
      toast.error("Please review and accept the clinical terms of triage.");
      return;
    }
    setLoading(true);
    try {
      const user = await register(name.trim(), email.trim(), password, language);
      setDemoMode(false);
      toast.success(`Welcome to DermaSathiAI, ${user.full_name}.`);
      navigate("/skin-assessment");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Account creation failed. Please try again.");
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
        <div className={styles.authHeader}>
          <div className={styles.brandIconCircle}>
            <img src="/assets/dermasathi-brand-mark.png" alt="DermaSathiAI lotus" />
          </div>
          <span className={styles.brandWordmark}>DermaSathiAI</span>
          <h1 className={styles.authTitle}>Create Your Account</h1>
          <p className={styles.authSubtitle}>
            Join DermaSathi for structured skin symptom monitoring and clinical photo triage.
          </p>
        </div>

        {/* Demo Mode Notice */}
        <div className={styles.demoDisclaimer}>
          <ShieldCheck size={18} className={styles.disclaimerIcon} />
          <div>
            <strong>Secure patient registration</strong>
            <p>Accounts are created in the DermaSathiAI backend. Provider accounts require a separate verified onboarding process.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label htmlFor="signup-name" className={styles.label}>
              Full Name
            </label>
            <div className={styles.inputWrap}>
              <User size={17} className={styles.inputIcon} />
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                placeholder="Your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={styles.input}
                required
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="signup-email" className={styles.label}>
              Email Address
            </label>
            <div className={styles.inputWrap}>
              <Mail size={17} className={styles.inputIcon} />
              <input
                id="signup-email"
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

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label htmlFor="signup-password" className={styles.label}>
                Password
              </label>
              <div className={styles.inputWrap}>
                <Lock size={17} className={styles.inputIcon} />
                <input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Min 8 chars"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={styles.input}
                  required
                />
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="signup-confirm-password" className={styles.label}>
                Confirm
              </label>
              <div className={styles.inputWrap}>
                <Lock size={17} className={styles.inputIcon} />
                <input
                  id="signup-confirm-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repeat password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={styles.input}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={styles.eyeBtn}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          <div className={styles.termsRow}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className={styles.checkbox}
                required
              />
              <span>
                I agree to the <Link to="/" className={styles.termsLink}>Clinical Terms of Use</Link> and understand that DermaSathiAI is an assistive decision aid, not a clinical diagnostic replacement.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={styles.submitBtn}
          >
            {loading ? (
              <span>Creating Account...</span>
            ) : (
              <>
                <CheckCircle2 size={17} />
                <span>Create DermaSathi Account</span>
              </>
            )}
          </button>
        </form>

        <div className={styles.authFooter}>
          <span>Already have an account? </span>
          <Link to="/login" className={styles.signinLink}>
            Sign In
          </Link>
        </div>
      </motion.div>
    </div>
  );
};