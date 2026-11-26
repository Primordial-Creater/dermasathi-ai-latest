import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Sparkles, CheckCircle2 } from "lucide-react";
import styles from "./VideoPreview.module.css";

export interface VideoPreviewProps {
  videoSrc?: string;
  posterSrc?: string;
  title: string;
  subtitle: string;
  badge?: string;
  duration?: string;
  aspectRatio?: "16/9" | "4/3" | "1/1";
  features?: string[];
  className?: string;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  videoSrc,
  posterSrc,
  title,
  subtitle,
  badge = "Clinical Demo Preview",
  duration = "0:18",
  aspectRatio = "16/9",
  features = ["Polarized Dermatoscope (30x)", "Sub-surface Pigment Mapping", "Boundary Regularity Scoring"],
  className = "",
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressFillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let t = 0;
    let active = true;
    let localProgress = 0;

    const renderDermatoscope = () => {
      if (!canvasRef.current || videoSrc) return;
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      const width = canvasRef.current.width;
      const height = canvasRef.current.height;

      // Clean bright clinical backdrop
      ctx.fillStyle = "#faf9f6";
      ctx.fillRect(0, 0, width, height);

      // Soft circular dermatoscope optic field
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.38;

      const gradient = ctx.createRadialGradient(
        centerX, centerY, radius * 0.2,
        centerX, centerY, radius
      );
      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(0.7, "#f0fdf9");
      gradient.addColorStop(1, "#e5e7eb");

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = gradient;
      ctx.fill();

      // Simulated epidermal pattern (subtle cellular papillae)
      const pulseSpeed = isPlaying || isHovered ? 0.04 : 0.015;
      t += pulseSpeed;

      // Simulated erythematous lesion plaque
      const lesionRadius = radius * 0.55;
      const lesionGrad = ctx.createRadialGradient(
        centerX + Math.sin(t) * 4,
        centerY + Math.cos(t) * 4,
        lesionRadius * 0.1,
        centerX,
        centerY,
        lesionRadius
      );
      lesionGrad.addColorStop(0, "rgba(239, 68, 68, 0.45)");
      lesionGrad.addColorStop(0.6, "rgba(249, 115, 22, 0.25)");
      lesionGrad.addColorStop(1, "rgba(15, 118, 110, 0.0)");

      ctx.fillStyle = lesionGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, lesionRadius, 0, Math.PI * 2);
      ctx.fill();

      // Dynamic scanning contour lines (triage boundary detection)
      ctx.strokeStyle = "rgba(15, 118, 110, 0.75)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -t * 15;
      ctx.beginPath();
      for (let angle = 0; angle < Math.PI * 2; angle += 0.1) {
        const dist = lesionRadius * (0.85 + Math.sin(angle * 5 + t * 2) * 0.08);
        const px = centerX + Math.cos(angle) * dist;
        const py = centerY + Math.sin(angle) * dist;
        if (angle === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      // Scanning reticle crosshair
      ctx.strokeStyle = "rgba(2, 132, 199, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(centerX - radius * 0.7, centerY);
      ctx.lineTo(centerX + radius * 0.7, centerY);
      ctx.moveTo(centerX, centerY - radius * 0.7);
      ctx.lineTo(centerX, centerY + radius * 0.7);
      ctx.stroke();

      ctx.restore();

      // Optic Ring Bezel
      ctx.strokeStyle = "rgba(15, 23, 42, 0.15)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Update progress bar DOM directly to avoid 60fps React re-render overhead
      if (isPlaying || isHovered) {
        localProgress = localProgress >= 100 ? 0 : localProgress + 0.35;
        if (progressFillRef.current) {
          progressFillRef.current.style.width = `${localProgress}%`;
        }
      }

      if (active) {
        animFrameRef.current = requestAnimationFrame(renderDermatoscope);
      }
    };

    renderDermatoscope();

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, isHovered, videoSrc]);

  const handleTogglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div
      className={`${styles.previewCard} ${className}`.trim()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleTogglePlay}
      role="region"
      aria-label={`Interactive video preview: ${title}`}
    >
      {/* Top Header HUD */}
      <div className={styles.topHud}>
        <div className={styles.badgeWrap}>
          <span className={styles.clinicalBadge}>
            <Sparkles size={13} className={styles.badgeIcon} />
            <span>{badge}</span>
          </span>
          <span className={styles.liveIndicator}>
            <span className={styles.liveDot} />
            <span>Multi-Band 30x</span>
          </span>
        </div>
        <span className={styles.durationPill}>{duration}</span>
      </div>

      {/* Main Viewport Container */}
      <div className={styles.viewport} style={{ aspectRatio }}>
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            poster={posterSrc}
            className={styles.videoElement}
            muted
            playsInline
            loop
          />
        ) : (
          <canvas
            ref={canvasRef}
            width={640}
            height={360}
            className={styles.canvasElement}
          />
        )}

        {/* Center Play Button Overlay */}
        <AnimatePresence>
          {(!isPlaying && !isHovered) && (
            <motion.div
              className={styles.playOverlay}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18 }}
            >
              <div className={styles.playCircle}>
                <Play size={24} fill="#ffffff" color="#ffffff" className={styles.playIcon} />
              </div>
              <span className={styles.tapPrompt}>Hover or Tap to Inspect Optics</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reticle Corner Brackets */}
        <div className={styles.reticleTL} />
        <div className={styles.reticleTR} />
        <div className={styles.reticleBL} />
        <div className={styles.reticleBR} />

        {/* Progress Bar */}
        <div className={styles.progressBarTrack}>
          <div ref={progressFillRef} className={styles.progressBarFill} style={{ width: "0%" }} />
        </div>
      </div>

      {/* Bottom Description & Feature Checklist */}
      <div className={styles.cardInfo}>
        <div className={styles.titleRow}>
          <div className={styles.titleWrap}>
            <h4 className={styles.previewTitle}>{title}</h4>
            <p className={styles.previewSubtitle}>{subtitle}</p>
          </div>
          <button
            type="button"
            className={styles.actionBtn}
            aria-label={isPlaying ? "Pause preview" : "Play preview"}
            onClick={(e) => {
              e.stopPropagation();
              handleTogglePlay();
            }}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
          </button>
        </div>

        <div className={styles.featureChips}>
          {features.map((feat) => (
            <span key={feat} className={styles.chip}>
              <CheckCircle2 size={12} className={styles.chipIcon} />
              <span>{feat}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VideoPreview;
