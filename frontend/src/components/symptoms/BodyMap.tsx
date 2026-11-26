import { useId } from "react";
import styles from "./BodyMap.module.css";

/* Anatomical location selector built on the project's own
   public/assets/human-anatomy.jpg illustration.

   The source JPEG has a flat grey studio background rather than an
   alpha channel, so it is composited with `mix-blend-mode: multiply`
   over a white scanning stage and feathered with a radial mask. The
   hotspots are HTML buttons layered on top, so they stay keyboard
   reachable and keep a 44px touch target. */

export interface BodyRegion {
  /** Must be one of the existing location values. */
  id: string;
  /** Short caption shown when the hotspot is active. */
  short: string;
  /** Hotspot centre, as a percentage of the illustration box. */
  left: string;
  top: string;
}

const REGIONS: BodyRegion[] = [
  { id: "Face & Neck", short: "Face / Neck", left: "48%", top: "13%" },
  { id: "Inner Forearms / Arms", short: "Arms", left: "23%", top: "41%" },
  { id: "Hands & Fingers", short: "Hands", left: "24%", top: "56%" },
  { id: "Torso / Chest / Back", short: "Torso", left: "53%", top: "34%" },
  { id: "Lower Limbs & Feet", short: "Legs / Feet", left: "47%", top: "77%" },
];

export const GENERALIZED = "Multiple / Generalized distribution";

interface BodyMapProps {
  /** Currently selected location value, or "" when nothing is selected. */
  value: string;
  onChange: (id: string) => void;
}

export default function BodyMap({ value, onChange }: BodyMapProps) {
  const uid = useId();
  const selected = REGIONS.find((r) => r.id === value);
  const generalized = value === GENERALIZED;

  return (
    <div className={styles.wrap}>
      <div className={styles.stage} role="group" aria-label="Anatomical location map">
        <div className={styles.stageGlow} aria-hidden="true" />

        <button
          type="button"
          className={styles.zoneGeneral}
          aria-pressed={generalized}
          aria-label={GENERALIZED}
          title={GENERALIZED}
          onClick={() => onChange(GENERALIZED)}
        >
          <span className={styles.zoneGeneralLabel}>Generalized</span>
        </button>

        <img
          className={styles.figure}
          src="/assets/human-anatomy.jpg"
          alt=""
          aria-hidden="true"
          draggable={false}
          decoding="async"
          key={`${uid}-fig`}
        />

        {REGIONS.map((r) => {
          const on = r.id === value;
          return (
            <button
              key={r.id}
              type="button"
              className={styles.zone}
              style={{ left: r.left, top: r.top }}
              aria-pressed={on}
              aria-label={r.id}
              title={r.id}
              onClick={() => onChange(r.id)}
            >
              <span className={styles.zoneLabel}>{r.short}</span>
            </button>
          );
        })}
      </div>

      <p className={styles.readout} aria-live="polite">
        {selected ? (
          <>
            Selected area: <strong>{selected.id}</strong>
          </>
        ) : generalized ? (
          <>
            Selected area: <strong>{GENERALIZED}</strong>
          </>
        ) : (
          "Tap a region, or choose from the list beside the figure."
        )}
      </p>
    </div>
  );
}