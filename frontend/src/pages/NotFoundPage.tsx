import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Search, ArrowRight } from "lucide-react";
import styles from "./NotFoundPage.module.css";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.23, 1, 0.32, 1] },
  },
};

export const NotFoundPage: React.FC = () => {
  return (
    <div className={styles.wrap}>
      <motion.div
        className={styles.card}
        initial="hidden"
        animate="visible"
        variants={fadeUp}
      >
        <div className={styles.visual} aria-hidden="true">
          <svg width="120" height="120" viewBox="0 0 32 32" fill="none">
            <path
              d="M16 4C16 4 11 12 11 18C11 21.3137 13.2386 24 16 24C18.7614 24 21 21.3137 21 18C21 12 16 4 16 4Z"
              fill="#0d9488"
            />
            <path
              d="M7 13C7 13 4 19 6 23C7.5 26 12 25 12 25C12 25 9.5 20 9.5 16C9.5 14 7 13 7 13Z"
              fill="#14b8a6"
              opacity="0.85"
            />
            <path
              d="M25 13C25 13 28 19 26 23C24.5 26 20 25 20 25C20 25 22.5 20 22.5 16C22.5 14 25 13 25 13Z"
              fill="#14b8a6"
              opacity="0.85"
            />
          </svg>
        </div>

        <span className={styles.eyebrow}>404 — Page not found</span>
        <h1 className={styles.title}>We couldn&apos;t find that page</h1>
        <p className={styles.desc}>
          The page you were looking for may have moved, or the link may be
          incorrect. Let&apos;s get you back to your health tools.
        </p>

        <div className={styles.actions}>
          <Link to="/" className={styles.primaryBtn}>
            <Home size={16} />
            <span>Back to home</span>
          </Link>
          <Link to="/skin-assessment" className={styles.secondaryBtn}>
            <Search size={16} />
            <span>Go to skin assessment</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFoundPage;