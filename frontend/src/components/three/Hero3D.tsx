import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Float, Sphere, MeshDistortMaterial } from "@react-three/drei";

function ClinicalOrb() {
  return (
    <Float speed={1.0} rotationIntensity={0.15} floatIntensity={0.3}>
      <group>
        {/* Outer atmospheric glow */}
        <Sphere args={[2.0, 48, 48]}>
          <meshBasicMaterial
            color="#14b8a6"
            transparent
            opacity={0.05}
            side={THREE.BackSide}
          />
        </Sphere>
        
        {/* Main distorted sphere */}
        <Sphere args={[1.5, 64, 64]}>
          <MeshDistortMaterial
            color="#0d9488"
            distort={0.18}
            speed={1.2}
            roughness={0.1}
            metalness={0.05}
            transparent
            opacity={0.75}
            clearcoat={1}
            clearcoatRoughness={0.1}
          />
        </Sphere>
        
        {/* Inner core glow */}
        <Sphere args={[0.9, 32, 32]}>
          <meshBasicMaterial
            color="#5eead4"
            transparent
            opacity={0.3}
          />
        </Sphere>
        
        {/* Central nucleus */}
        <Sphere args={[0.4, 32, 32]}>
          <meshBasicMaterial
            color="#a5f3fc"
            transparent
            opacity={0.5}
          />
        </Sphere>
      </group>
    </Float>
  );
}

// Need to import THREE for the group
import * as THREE from "three";

export const Hero3D: React.FC = () => {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return (
      <div style={{ 
        width: "100%", 
        height: "100%", 
        minHeight: 280,
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center" 
      }}>
        <div style={{ 
          width: "100%", 
          maxWidth: 280,
          aspectRatio: "1 / 1",
          borderRadius: "50%", 
          background: "radial-gradient(circle at 30% 30%, var(--teal-100) 0%, var(--blue-100) 40%, var(--lavender-100) 70%, transparent 100%)",
          boxShadow: "var(--shadow-glow-mint), var(--shadow-neu-raised-lg)"
        }} />
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 320 }}>
      <Suspense fallback={<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 100, height: 100, borderRadius: "50%", background: "var(--teal-100)", opacity: 0.5 }} />
      </div>}>
        <Canvas 
          camera={{ position: [0, 0, 5.0], fov: 40 }} 
          dpr={[1, 1.5]}
          style={{ background: "transparent" }}
        >
          <ambientLight intensity={2.2} color="#fafafa" />
          <directionalLight position={[6, 10, 6]} intensity={3.0} color="#f0fdfa" />
          <directionalLight position={[-5, 4, 5]} intensity={1.8} color="#cffafe" />
          <pointLight position={[-4, -3, 4]} intensity={2.5} color="#0284c7" decay={2} />
          <pointLight position={[4, -3, 3]} intensity={2.8} color="#14b8a6" decay={2} />
          <pointLight position={[0, 4, 3]} intensity={1.2} color="#5eead4" decay={2} />
          <hemisphereLight args={["#f0fdfa", "#0d9488", 1.0]} />
          <ClinicalOrb />
        </Canvas>
      </Suspense>
    </div>
  );
};

export default Hero3D;