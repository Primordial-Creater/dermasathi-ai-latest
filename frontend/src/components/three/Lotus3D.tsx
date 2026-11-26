import React, { useRef, Suspense, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

interface Lotus3DProps {
  width?: number;
  height?: number;
  autoBloom?: boolean;
  bloomSpeed?: number;
  className?: string;
}

/* A single lotus petal with bloom animation */
const LotusPetal: React.FC<{
  index: number;
  bloom: number;
  color: string;
  glowColor: string;
}> = ({ index, bloom, color, glowColor }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();

    // Bloom: petals open from closed (0) to open (1)
    const bloomFactor = Math.min(bloom, 1);

    // Petal opens by rotating around X axis and moving outward
    const openAngle = 1.4 * bloomFactor; // max ~80 degrees
    const rise = 0.35 * bloomFactor;
    const spread = 0.9 * bloomFactor;

    meshRef.current.rotation.x = -openAngle + Math.sin(t * 0.5 + index) * 0.03;
    meshRef.current.position.y = rise;
    meshRef.current.position.z = spread;

    // Gentle floating motion
    meshRef.current.position.y += Math.sin(t * 1.2 + index * 0.7) * 0.015;
    meshRef.current.rotation.z = Math.cos(t * 0.8 + index) * 0.02;
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[0.5, 1.4, 4, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={glowColor}
        emissiveIntensity={0.4}
        transparent
        opacity={0.92}
        side={THREE.DoubleSide}
        roughness={0.3}
        metalness={0.05}
      />
    </mesh>
  );
}

/* Lotus stamen center */
const LotusCenter: React.FC<{ bloom: number; color: string; glowColor: string }> = ({ bloom, color, glowColor }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    const bloomFactor = Math.min(bloom, 1);
    meshRef.current.scale.setScalar(0.4 + 0.6 * bloomFactor);
    meshRef.current.position.y = 0.15 * bloomFactor;
    meshRef.current.rotation.y = t * 0.3;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <sphereGeometry args={[0.35, 24, 24]} />
      <meshStandardMaterial
        color={color}
        emissive={glowColor}
        emissiveIntensity={0.8}
        roughness={0.2}
        metalness={0.1}
      />
    </mesh>
  );
}

/* Atmospheric glow volume behind the lotus */
const LotusGlow: React.FC<{ color: string; intensity: number }> = ({ color, intensity }) => (
  <mesh position={[0, 0, 0]}>
    <sphereGeometry args={[2.4, 64, 64]} />
    <meshBasicMaterial
      color={color}
      transparent
      opacity={intensity}
      side={THREE.BackSide}
    />
  </mesh>
);

/* Decorative water ripples around the lotus base */
const WaterRipple: React.FC<{ timeOffset: number }> = ({ timeOffset }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = (state.clock.getElapsedTime() + timeOffset) * 0.6;
    const scale = 0.5 + (Math.sin(t) * 0.3 + 0.7) * 0.8;
    const opacity = 0.3 * (1 - Math.abs(Math.sin(t)));
    meshRef.current.scale.setScalar(scale);
    (meshRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
  });

  return (
    <mesh ref={meshRef} position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.8, 1.6, 64]} />
      <meshBasicMaterial
        color="#14b8a6"
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export const Lotus3D: React.FC<Lotus3DProps> = ({
  width = 420,
  height = 420,
  autoBloom = true,
  bloomSpeed = 1.0,
  className,
}) => {
  const bloomRef = useRef(0);

  // Auto-bloom animation: pulse the bloom value between 0 and 1
  useEffect(() => {
    if (!autoBloom) return;
    let frame: number;
    const animate = () => {
      const t = Date.now() * 0.001 * bloomSpeed;
      bloomRef.current = 0.5 + 0.5 * Math.sin(t * 0.7);
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(frame);
  }, [autoBloom, bloomSpeed]);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const petalColors = [
    "#E3F2E8", // botanical green
    "#DFF0FB", // sky blue
    "#E8F4FC", // pale blue
    "#FFF8EB", // soft cream
    "#E2F6F0", // mint
  ];

  const petalGlowColors = [
    "#4F906B",
    "#438FBD",
    "#138A84",
    "#73A96A",
    "#B8D49C",
  ];

  if (prefersReducedMotion) {
    return (
      <div
        className={className}
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 30% 30%, #E3F2E8 0%, #DFF0FB 40%, #F1F7F8 100%)",
          borderRadius: "var(--radius-card-lg)",
          boxShadow: "var(--shadow-glow-mint)",
        }}
      >
        <div style={{
          width: Math.min(width, height) * 0.6,
          height: Math.min(width, height) * 0.6,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #E3F2E8 0%, #DFF0FB 100%)",
          boxShadow: "0 0 40px rgba(7, 139, 145, 0.25)",
        }} />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        width,
        height,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        borderRadius: "var(--radius-card-lg)",
      }}
    >
      <Suspense fallback={
        <div style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #E3F2E8 0%, #DFF0FB 100%)",
          borderRadius: "var(--radius-card-lg)",
        }}>
          <div style={{
            width: Math.min(width, height) * 0.5,
            height: Math.min(width, height) * 0.5,
            borderRadius: "50%",
            background: "#ffffff",
            opacity: 0.6,
          }} />
        </div>
      }>
        <Canvas
          camera={{ position: [0, 0, 5], fov: 45 }}
          dpr={[1, 1.5]}
          style={{
            width: "100%",
            height: "100%",
            background: "transparent",
          }}
        >
          <ambientLight intensity={1.2} color="#ffffff" />
          <directionalLight position={[5, 8, 5]} intensity={2.0} color="#E3F2E8" />
          <directionalLight position={[-5, 4, 5]} intensity={1.2} color="#DFF0FB" />
          <pointLight position={[0, 4, 3]} intensity={1.5} color="#438FBD" decay={2} />
          <pointLight position={[3, -2, 3]} intensity={1.2} color="#73A96A" decay={2} />
          <hemisphereLight args={["#F1F7F8", "#138A84", 0.6]} />

          {/* Outer atmospheric glow - botanical green + sky blue */}
          <LotusGlow color="#E3F2E8" intensity={0.12} />
          <LotusGlow color="#DFF0FB" intensity={0.08} />

          {/* Water ripples at base */}
          <WaterRipple timeOffset={0} />
          <WaterRipple timeOffset={1.5} />
          <WaterRipple timeOffset={3.0} />

          <Float speed={1.0} rotationIntensity={0.08} floatIntensity={0.15}>
            {/* Outer petals - larger, more open */}
            {[12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((i) => (
              <LotusPetal
                key={i}
                index={i}
                bloom={bloomRef.current}
                color={petalColors[i % petalColors.length]}
                glowColor={petalGlowColors[i % petalGlowColors.length]}
              />
            ))}

            {/* Inner petals - smaller, tighter */}
            {[6, 5, 4, 3, 2, 1].map((i) => (
              <LotusPetal
                key={`inner-${i}`}
                index={i}
                bloom={bloomRef.current * 0.85}
                color={petalColors[(i + 2) % petalColors.length]}
                glowColor={petalGlowColors[(i + 2) % petalGlowColors.length]}
              />
            ))}

            {/* Center stamen */}
            <LotusCenter
              bloom={bloomRef.current}
              color="#FFF8EB"
              glowColor="#FBEAF1"
            />
          </Float>
        </Canvas>
      </Suspense>
    </div>
  );
};

export default Lotus3D;
