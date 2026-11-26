import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { EpidermalScannerFallback } from "./EpidermalScannerFallback";
import { Scan, RefreshCw } from "lucide-react";

interface StrataMeshProps {
  isScanning: boolean;
}

const ClinicalStrataModel: React.FC<StrataMeshProps> = ({ isScanning }) => {
  const groupRef = useRef<THREE.Group>(null);
  const laserRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const particleRefs = useRef<THREE.Mesh[]>([]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.rotation.y = t * 0.12;
      groupRef.current.rotation.x = 0.3 + Math.sin(t * 0.25) * 0.04;
    }
    if (laserRef.current && isScanning) {
      laserRef.current.position.y = Math.sin(t * 1.5) * 0.9;
      const mat = laserRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.6 + Math.sin(t * 3) * 0.2;
    }
    if (ringRef.current && isScanning) {
      ringRef.current.position.y = Math.sin(t * 1.5) * 0.9;
      ringRef.current.rotation.z = t * 0.8;
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.5 + Math.sin(t * 3) * 0.2;
    }
    
    // Animate ambient particles
    particleRefs.current.forEach((mesh, idx) => {
      if (mesh) {
        const phase = idx * 0.8;
        mesh.position.y += Math.sin(t * 0.6 + phase) * 0.002;
        mesh.rotation.x += 0.003;
        mesh.rotation.y += 0.002;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {/* Atmospheric glow volumes */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[2.0, 2.0, 1.8, 32]} />
        <meshBasicMaterial
          color="#0d9488"
          transparent
          opacity={0.03}
          side={THREE.BackSide}
        />
      </mesh>

      {/* 1. Stratum Corneum (Top Layer: Translucent Porcelain Prism) */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[1.85, 1.85, 0.2, 8]} />
        <meshPhysicalMaterial
          color="#0284c7"
          transmission={0.8}
          opacity={0.9}
          transparent
          roughness={0.08}
          metalness={0.02}
          ior={1.4}
          clearcoat={1}
          clearcoatRoughness={0.05}
        />
      </mesh>

      {/* Inner membrane of stratum corneum */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[1.78, 1.78, 0.22, 8]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          transmission={0.7}
          opacity={0.4}
          transparent
          roughness={0.15}
          metalness={0.0}
          ior={1.35}
          side={THREE.BackSide}
        />
      </mesh>

      {/* 2. Viable Epidermis (Mid Layer: Cellular Honeycomb Lattice) */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[1.78, 1.78, 0.3, 8]} />
        <meshPhysicalMaterial
          color="#0d9488"
          transmission={0.6}
          opacity={0.85}
          transparent
          roughness={0.2}
          metalness={0.05}
          ior={1.35}
        />
      </mesh>

      {/* Hexagonal wireframe overlay on mid layer for cellular lattice effect */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[1.8, 1.8, 0.31, 8]} />
        <meshBasicMaterial
          color="#5eead4"
          wireframe
          transparent
          opacity={0.35}
        />
      </mesh>

      {/* 3. Dermal Matrix (Deep Layer: Warm Vascular Tissue Depth) */}
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[1.68, 1.68, 0.28, 8]} />
        <meshPhysicalMaterial
          color="#f43f5e"
          transmission={0.5}
          opacity={0.75}
          transparent
          roughness={0.2}
          metalness={0.05}
          ior={1.28}
        />
      </mesh>

      {/* Inner dermal glow */}
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[1.55, 1.55, 0.3, 8]} />
        <meshBasicMaterial
          color="#fb7185"
          transparent
          opacity={0.15}
          side={THREE.BackSide}
        />
      </mesh>

      {/* 4. Subcutaneous base */}
      <mesh position={[0, -0.7, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 0.2, 8]} />
        <meshPhysicalMaterial
          color="#d7ccc8"
          transmission={0.3}
          opacity={0.6}
          transparent
          roughness={0.35}
          metalness={0.0}
        />
      </mesh>

      {/* 5. Diagnostic Scanning Laser Plane */}
      <mesh ref={laserRef} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.5, 0.06]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.85} />
      </mesh>

      {/* Laser glow effect */}
      <mesh ref={laserRef} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.0, 0.3]} />
        <meshBasicMaterial color="#0d9488" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>

      {/* 6. Focal Inspection Ring */}
      <mesh ref={ringRef} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.92, 2.05, 32]} />
        <meshBasicMaterial color="#0d9488" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>

      {/* Outer ring */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.1, 2.15, 32]} />
        <meshBasicMaterial color="#14b8a6" transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>

      {/* 7. Floating cellular particles */}
      {[
        [-1.3, 0.4, 0.5],
        [1.4, 0.2, -0.4],
        [-1.0, -0.3, 0.7],
        [1.1, -0.1, 0.6],
        [-0.6, 0.7, -0.4],
        [0.7, 0.8, 0.3],
        [-0.8, -0.5, -0.5],
        [0.9, -0.4, -0.6],
      ].map((pos, idx) => (
        <mesh key={idx} position={pos as [number, number, number]} ref={(el) => { if (el) particleRefs.current[idx] = el; }}>
          <icosahedronGeometry args={[0.06, 0]} />
          <meshStandardMaterial
            color={idx % 3 === 0 ? "#0d9488" : idx % 3 === 1 ? "#0284c7" : "#14b8a6"}
            emissive={idx % 3 === 0 ? "#14b8a6" : idx % 3 === 1 ? "#38bdf8" : "#5eead4"}
            emissiveIntensity={0.8}
            roughness={0.3}
            metalness={0.4}
          />
        </mesh>
      ))}
    </group>
  );
};

export const EpidermalScannerScene: React.FC = () => {
  const [hasWebGL, setHasWebGL] = useState(true);
  const [isScanning, setIsScanning] = useState(true);
  const [activeLayer, setActiveLayer] = useState<"corneum" | "epidermis" | "dermis">("corneum");

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) setHasWebGL(false);
    } catch {
      setHasWebGL(false);
    }
  }, []);

  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return <EpidermalScannerFallback />;
  }

  if (!hasWebGL) {
    return <EpidermalScannerFallback />;
  }

  return (
    <div style={{
      width: "100%",
      maxWidth: "540px",
      background: "var(--white)",
      border: "1px solid var(--border-hairline)",
      borderRadius: "var(--radius-card-lg)",
      boxShadow: "var(--shadow-neu-raised-lg)",
      padding: "var(--space-5)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-4)",
      boxSizing: "border-box"
    }}>
      {/* Clinical 3D Header HUD */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--border-hairline)",
        paddingBottom: "var(--space-3)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "var(--radius-card-sm)",
            background: "var(--teal-100)",
            color: "var(--color-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Scan size={16} />
          </div>
          <div>
            <span style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--color-text-primary)", display: "block" }}>
              Multi-Spectral Epidermal Strata
            </span>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-tertiary)", display: "block" }}>
              Interactive 3D Dermatoscopy Cross-Section
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsScanning(!isScanning)}
          style={{
            background: isScanning ? "var(--teal-100)" : "var(--color-bg-subtle)",
            color: isScanning ? "var(--color-primary)" : "var(--color-text-secondary)",
            border: "1px solid var(--border-hairline)",
            borderRadius: "var(--radius-pill)",
            padding: "var(--space-2) var(--space-3)",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-2)",
            transition: "var(--transition-tactile)"
          }}
          aria-label="Toggle scan simulation"
        >
          <RefreshCw size={12} className={isScanning ? "animate-spin" : ""} />
          <span>{isScanning ? "Scanning Active" : "Paused"}</span>
        </button>
      </div>

      {/* 3D WebGL Canvas Viewport */}
      <div style={{
        width: "100%",
        height: "320px",
        background: "linear-gradient(180deg, var(--slate-50) 0%, var(--teal-50) 100%)",
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--border-subtle)",
        position: "relative",
        overflow: "hidden"
      }}>
        <Suspense fallback={<EpidermalScannerFallback />}>
          <Canvas
            camera={{ position: [0, 1.2, 4.4], fov: 40 }}
            dpr={[1, 1.5]}
            style={{ background: "transparent" }}
          >
            <ambientLight intensity={1.8} color="#fafafa" />
            <directionalLight position={[5, 7, 5]} intensity={2.5} color="#f0fdfa" />
            <directionalLight position={[-5, 3, -3]} intensity={1.2} color="#0284c7" />
            <pointLight position={[0, -3, 4]} intensity={1.5} color="#0d9488" decay={2} />
            <pointLight position={[0, 4, 3]} intensity={1.0} color="#f43f5e" decay={2} />
            <hemisphereLight args={["#f0fdfa", "#0d9488", 0.8]} />
            
            <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.3}>
              <ClinicalStrataModel isScanning={isScanning} />
            </Float>

            <OrbitControls
              enableZoom={false}
              enablePan={false}
              maxPolarAngle={Math.PI / 1.8}
              minPolarAngle={Math.PI / 3.5}
            />
          </Canvas>
        </Suspense>

        {/* Ambient Overlay Layer Pills */}
        <div style={{
          position: "absolute",
          bottom: "var(--space-3)",
          left: "var(--space-3)",
          right: "var(--space-3)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pointerEvents: "none",
          flexWrap: "wrap",
          gap: "var(--space-2)"
        }}>
          <span style={{
            background: "var(--glass-bg-strong)",
            backdropFilter: "var(--blur-md)",
            border: "1px solid var(--glass-border)",
            padding: "var(--space-1) var(--space-3)",
            borderRadius: "var(--radius-pill)",
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            color: "#0369a1",
          }}>
            ● Stratum Corneum (Barrier)
          </span>

          <span style={{
            background: "var(--glass-bg-strong)",
            backdropFilter: "var(--blur-md)",
            border: "1px solid var(--glass-border)",
            padding: "var(--space-1) var(--space-3)",
            borderRadius: "var(--radius-pill)",
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            color: "#0f766e",
          }}>
            ● Viable Epidermis
          </span>

          <span style={{
            background: "var(--glass-bg-strong)",
            backdropFilter: "var(--blur-md)",
            border: "1px solid var(--glass-border)",
            padding: "var(--space-1) var(--space-3)",
            borderRadius: "var(--radius-pill)",
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            color: "#be123c",
          }}>
            ● Dermal Matrix
          </span>
        </div>
      </div>

      {/* Layer Depth Selector & Details */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "var(--space-2)"
      }}>
        <button
          type="button"
          onClick={() => setActiveLayer("corneum")}
          style={{
            background: activeLayer === "corneum" ? "var(--blue-50)" : "var(--color-bg-subtle)",
            border: `1px solid ${activeLayer === "corneum" ? "var(--blue-400)" : "var(--border-hairline)"}`,
            color: activeLayer === "corneum" ? "#0369a1" : "var(--color-text-secondary)",
            borderRadius: "var(--radius-card-sm)",
            padding: "var(--space-2) var(--space-3)",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "center",
            transition: "var(--transition-tactile)"
          }}
        >
          Stratum Corneum
        </button>

        <button
          type="button"
          onClick={() => setActiveLayer("epidermis")}
          style={{
            background: activeLayer === "epidermis" ? "var(--teal-50)" : "var(--color-bg-subtle)",
            border: `1px solid ${activeLayer === "epidermis" ? "var(--teal-400)" : "var(--border-hairline)"}`,
            color: activeLayer === "epidermis" ? "#0f766e" : "var(--color-text-secondary)",
            borderRadius: "var(--radius-card-sm)",
            padding: "var(--space-2) var(--space-3)",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "center",
            transition: "var(--transition-tactile)"
          }}
        >
          Viable Epidermis
        </button>

        <button
          type="button"
          onClick={() => setActiveLayer("dermis")}
          style={{
            background: activeLayer === "dermis" ? "var(--coral-50)" : "var(--color-bg-subtle)",
            border: `1px solid ${activeLayer === "dermis" ? "var(--coral-400)" : "var(--border-hairline)"}`,
            color: activeLayer === "dermis" ? "#be123c" : "var(--color-text-secondary)",
            borderRadius: "var(--radius-card-sm)",
            padding: "var(--space-2) var(--space-3)",
            fontSize: "var(--text-sm)",
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "center",
            transition: "var(--transition-tactile)"
          }}
        >
          Dermal Matrix
        </button>
      </div>

      <div style={{
        fontSize: "var(--text-sm)",
        color: "var(--color-text-tertiary)",
        lineHeight: "var(--leading-relaxed)",
        background: "var(--color-bg-glass)",
        backdropFilter: "var(--blur-sm)",
        border: "1px solid var(--glass-border)",
        borderRadius: "var(--radius-card-sm)",
        padding: "var(--space-3)",
        boxSizing: "border-box"
      }}>
        {activeLayer === "corneum" && (
          <span><strong>Stratum Corneum:</strong> Outermost anucleated lipid-protein matrix providing primary moisture barrier defense against topical allergens and environmental pathogens.</span>
        )}
        {activeLayer === "epidermis" && (
          <span><strong>Viable Epidermis:</strong> Keratinocyte strata where inflammatory cytokines and microvesiculation manifest in atopic dermatitis and contact eczema.</span>
        )}
        {activeLayer === "dermis" && (
          <span><strong>Dermal Matrix:</strong> Collagen-elastin vascular bed nourishing follicles and mediating inflammatory erythema and thermal flare-ups.</span>
        )}
      </div>
    </div>
  );
};

export default EpidermalScannerScene;