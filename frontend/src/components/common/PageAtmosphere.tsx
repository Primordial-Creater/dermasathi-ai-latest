import styles from "./PageAtmosphere.module.css";

export interface PageAtmosphereProps {
  /** Public asset path, e.g. "/assets/dashboard-background.png". */
  src: string;
  /** Opaque colour behind the blurred image so the blur fade never turns
   *  transparent at the canvas edge (prevents a canvas-colour strip). */
  fallbackColor?: string;
  /** Optional extra class, e.g. to tune stacking per page. */
  className?: string;
}

/**
 * Full-canvas atmospheric backdrop for a page.
 *
 * Render as the FIRST child of a page root that establishes its own stacking
 * context (`isolation: isolate`) and is not clipped. The negative gutter inset
 * bleeds the layer through AppLayout's `.contentCanvas` padding so the image
 * reaches the edge of the shared canvas with no side gap. The blur is applied
 * to this layer only, never to text or cards.
 */
export function PageAtmosphere({
  src,
  fallbackColor = "#e8f3f6",
  className,
}: PageAtmosphereProps) {
  return (
    <div
      aria-hidden="true"
      className={className ? `${styles.atmosphere} ${className}` : styles.atmosphere}
      style={{
        backgroundImage: `url("${src}")`,
        backgroundColor: fallbackColor,
      }}
    />
  );
}

export default PageAtmosphere;