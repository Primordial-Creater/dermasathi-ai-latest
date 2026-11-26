import React, { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotionPreference } from "../../hooks/useReducedMotionPreference";

interface HumanBustFigureProps {
  videoSrc: string;
  ariaLabel: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Circular, decorative human-bust video.
 * Normal motion: muted autoplay + continuous loop, with no manual Play button.
 * Reduced motion: hold the opening frame as a static visual.
 */
export const HumanBustFigure: React.FC<HumanBustFigureProps> = ({
  videoSrc,
  ariaLabel,
  className = "",
  style = {},
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasError, setHasError] = useState(false);
  const reduceMotion = useReducedMotionPreference();

  const attachVideo = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video;
    if (!video) return;

    // Set autoplay-critical properties and attributes before the first play().
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || hasError) return;

    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;

    const holdStillFrame = () => {
      video.pause();
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        try {
          video.currentTime = 0.01;
        } catch {
          // Some browsers do not allow seeking until metadata is fully ready.
        }
      }
    };

    const tryPlay = () => {
      if (reduceMotion || hasError || !video.paused) return;
      const playback = video.play();
      if (playback && typeof playback.catch === "function") {
        playback.catch((error: unknown) => {
          console.warn("DermaSathiAI human-bust autoplay was blocked by the browser:", error);
        });
      }
    };

    const onReady = () => (reduceMotion ? holdStillFrame() : tryPlay());
    const onError = () => {
      console.error("DermaSathiAI human-bust video failed to load:", video.error);
      setHasError(true);
    };

    if (reduceMotion) holdStillFrame();
    else if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) tryPlay();

    video.addEventListener("loadedmetadata", onReady);
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("canplay", onReady);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onReady);
      video.removeEventListener("error", onError);
    };
  }, [videoSrc, reduceMotion, hasError]);

  return (
    <div
      className={className}
      style={{
        ...style,
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        overflow: "hidden",
        position: "relative",
        isolation: "isolate",
        background:
          "radial-gradient(circle at 50% 40%, #F4FBFF 0%, var(--hero-mint) 55%, var(--hero-blue) 100%)",
        boxShadow:
          "inset 0 0 60px rgba(19,138,132,0.10), 0 12px 40px -12px rgba(19,138,132,0.35)",
      }}
      aria-label={ariaLabel}
    >
      {hasError ? (
        <div className="human-bust-fallback" role="img" aria-label="Human figure visual unavailable">
          <span>Figure unavailable</span>
        </div>
      ) : (
        <>
          <video
            ref={attachVideo}
            className="human-bust-video"
            src={videoSrc}
            autoPlay={!reduceMotion}
            muted
            loop
            playsInline
            preload="auto"
            controls={false}
            aria-hidden="true"
            onError={() => setHasError(true)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 30%",
              display: "block",
              background: "transparent",
              mixBlendMode: "multiply",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              pointerEvents: "none",
              zIndex: 2,
              boxShadow:
                "inset 0 0 46px rgba(19,138,132,0.18), inset 0 0 0 1px rgba(255,255,255,0.55)",
            }}
          />
        </>
      )}
    </div>
  );
};

export default HumanBustFigure;
