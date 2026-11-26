import { useEffect, useState } from "react";

const STORAGE_KEY = "dermasathi_reduce_motion";
const QUERY = "(prefers-reduced-motion: reduce)";

function readPreference(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "true") return true;
    if (saved === "false") return false;
  } catch {
    // Fall through to the operating-system preference.
  }

  return Boolean(window.matchMedia?.(QUERY).matches);
}

/** Combines the in-app accessibility preference with the OS reduced-motion setting. */
export function useReducedMotionPreference(): boolean {
  const [reducedMotion, setReducedMotion] = useState<boolean>(readPreference);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const media = window.matchMedia(QUERY);

    const syncFromPreference = () => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);

        if (saved === "true" || saved === "false") {
          setReducedMotion(saved === "true");
          return;
        }
      } catch {
        // Use the OS setting below.
      }

      setReducedMotion(media.matches);
    };

    media.addEventListener("change", syncFromPreference);
    window.addEventListener("storage", syncFromPreference);
    syncFromPreference();

    return () => {
      media.removeEventListener("change", syncFromPreference);
      window.removeEventListener("storage", syncFromPreference);
    };
  }, []);

  return reducedMotion;
}

export default useReducedMotionPreference;
