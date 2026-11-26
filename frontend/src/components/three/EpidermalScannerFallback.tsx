import React from "react";
import styles from "./EpidermalScannerFallback.module.css";
import { Scan, ShieldCheck, Activity } from "lucide-react";

export const EpidermalScannerFallback: React.FC = () => {
  return (
    <div className={styles.scannerContainer} aria-hidden="true">
      <div className={styles.reticleFrame}>
        <div className={styles.cornerTL}></div>
        <div className={styles.cornerTR}></div>
        <div className={styles.cornerBL}></div>
        <div className={styles.cornerBR}></div>

        <div className={styles.scannerBeam}></div>

        <div className={styles.layerDiagram}>
          <div className={styles.layerRow}>
            <span className={styles.layerTag}>Stratum Corneum</span>
            <div className={styles.cellNodes}>
              <span className={styles.node} style={{ background: "#0066ff" }}></span>
              <span className={styles.node} style={{ background: "#00b4d8" }}></span>
              <span className={styles.node} style={{ background: "#06b6d4" }}></span>
            </div>
          </div>

          <div className={styles.layerRow}>
            <span className={styles.layerTag}>Epidermal Tissue Matrix</span>
            <div className={styles.cellNodes}>
              <span className={styles.node} style={{ background: "#0d9488" }}></span>
              <span className={styles.node} style={{ background: "#10b981" }}></span>
              <span className={styles.node} style={{ background: "#34d399" }}></span>
            </div>
          </div>

          <div className={styles.layerRow}>
            <span className={styles.layerTag}>Dermal Vascular Bed</span>
            <div className={styles.cellNodes}>
              <span className={styles.node} style={{ background: "#f59e0b" }}></span>
              <span className={styles.node} style={{ background: "#fbbf24" }}></span>
              <span className={styles.node} style={{ background: "#f87171" }}></span>
            </div>
          </div>
        </div>

        <div className={styles.calibrationBar}>
          <div className={styles.indicator}>
            <Scan size={14} color="#0066ff" />
            <span>Optics: Multi-Band</span>
          </div>
          <div className={styles.indicator}>
            <Activity size={14} color="#0d9488" />
            <span>Lattice: Active</span>
          </div>
          <div className={styles.indicator}>
            <ShieldCheck size={14} color="#10b981" />
            <span>Triage Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
};
