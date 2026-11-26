import React from "react";
import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import styles from "./AuthLayout.module.css";

export const AuthLayout: React.FC = () => {
  return (
    <div className={styles.authShell}>
      <motion.div
        className={styles.authBackground}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className={styles.gradientOrb1} />
        <div className={styles.gradientOrb2} />
        <div className={styles.gradientOrb3} />
      </motion.div>

      <main className={styles.authMain}>
        <Outlet />
      </main>
    </div>
  );
};

export default AuthLayout;