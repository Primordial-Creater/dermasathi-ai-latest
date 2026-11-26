import React, { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Line } from "@react-three/drei";
import * as THREE from "three";

interface FigureProps {
  interactive?: boolean;
}

const LuminousHeadSilhouette: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef1 = useRef<THREE.Mesh>(null);
  const ringRef2 = useRef<THREE.Mesh>(null);
  const ringRef3 = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const particleRefs = useRef<THREE.Mesh[]>([]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.2;
      groupRef.current.rotation.x = Math.sin(t * 0.2) * 0.05;
    }
    if (ringRef1.current) {
      ringRef1.current.rotation.z = t * 0.25;
      ringRef1.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.4) * 0.1;
    }
    if (ringRef2.current) {
      ringRef2.current.rotation.z = -t * 0.18;
      ringRef2.current.rotation.x = Math.PI / 2 + Math.cos(t * 0.35) * 0.1;
    }
    if (ringRef3.current) {
      ringRef3.current.rotation.z = t * 0.12;
      ringRef3.current.rotation.y = Math.sin(t * 0.3) * 0.15;
    }
    if (haloRef.current) {
      haloRef.current.position.y = -1.1 + Math.sin(t * 1.0) * 0.04;
      haloRef.current.rotation.z = t * 0.08;
    }
    
    // Animate floating particles
    particleRefs.current.forEach((mesh, idx) => {
      if (mesh) {
        const phase = idx * 1.2;
        mesh.position.y += Math.sin(t * 0.8 + phase) * 0.003;
        mesh.position.x += Math.cos(t * 0.6 + phase) * 0.002;
        mesh.rotation.x += 0.005;
        mesh.rotation.y += 0.003;
      }
    });
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Atmospheric glow volumes */}
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[2.2, 32, 32]} />
        <meshBasicMaterial
          color="#14b8a6"
          transparent
          opacity={0.03}
          side={THREE.BackSide}
        />
      </mesh>
      
      <mesh position={[0, -0.5, 0]}>
        <sphereGeometry args={[1.8, 32, 32]} />
        <meshBasicMaterial
          color="#0d9488"
          transparent
          opacity={0.04}
          side={THREE.BackSide}
        />
      </mesh>

      {/* 1. Cranial Shell (Translucent Iridescent Glass Mesh) */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[1.15, 64, 64]} />
        <meshPhysicalMaterial
          color="#a5f3fc"
          transmission={0.92}
          opacity={0.9}
          transparent
          roughness={0.05}
          metalness={0.02}
          ior={1.4}
          clearcoat={1}
          clearcoatRoughness={0.05}
          reflectivity={0.5}
          envMapIntensity={1.2}
        />
      </mesh>

      {/* Subtle inner membrane */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[1.08, 48, 48]} />
        <meshPhysicalMaterial
          color="#e0f2fe"
          transmission={0.85}
          opacity={0.6}
          transparent
          roughness={0.1}
          metalness={0.0}
          ior={1.35}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Hexagonal neural wireframe lattice overlay on cranium */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[1.18, 28, 28]} />
        <meshBasicMaterial
          color="#38bdf8"
          wireframe
          transparent
          opacity={0.25}
        />
      </mesh>

      {/* Secondary finer wireframe */}
      <mesh position={[0, 0.4, 0]}>
        <sphereGeometry args={[1.22, 20, 20]} />
        <meshBasicMaterial
          color="#0d9488"
          wireframe
          transparent
          opacity={0.1}
        />
      </mesh>

      {/* 2. Facial & Jaw Profile (Harmonized Tapered Geometry) */}
      <mesh position={[0, -0.35, 0.15]} rotation={[0.1, 0, 0]}>
        <coneGeometry args={[0.95, 1.3, 32]} />
        <meshPhysicalMaterial
          color="#bae6fd"
          transmission={0.88}
          opacity={0.88}
          transparent
          roughness={0.1}
          metalness={0.0}
          ior={1.38}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </mesh>

      {/* 3. Neck & Cervical Base */}
      <mesh position={[0, -0.95, 0]}>
        <cylinderGeometry args={[0.55, 0.75, 0.65, 32]} />
        <meshPhysicalMaterial
          color="#67e8f9"
          transmission={0.82}
          opacity={0.85}
          transparent
          roughness={0.15}
          ior={1.35}
        />
      </mesh>

      {/* 4. Glowing Core Nucleus (Inner Light Source) - Layered */}
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshBasicMaterial color="#14b8a6" transparent opacity={0.15} />
      </mesh>
      
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.45, 32, 32]} />
        <meshBasicMaterial color="#5eead4" transparent opacity={0.35} />
      </mesh>
      
      <mesh position={[0, 0.25, 0]}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshBasicMaterial color="#a5f3fc" transparent opacity={0.6} />
      </mesh>

      {/* 5. Luminous Botanical Base Halo Pedestal */}
      <mesh ref={haloRef} position={[0, -1.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.5, 0.1, 32, 64]} />
        <meshStandardMaterial
          color="#14b8a6"
          emissive="#0d9488"
          emissiveIntensity={0.6}
          roughness={0.2}
          metalness={0.2}
        />
      </mesh>

      {/* Secondary halo ring */}
      <mesh position={[0, -1.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.8, 0.04, 16, 48]} />
        <meshBasicMaterial
          color="#0d9488"
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 6. Orbital Diagnostic Scanning Rings */}
      <mesh ref={ringRef1} position={[0, 0, 0]}>
        <torusGeometry args={[1.8, 0.025, 16, 64]} />
        <meshBasicMaterial color="#0284c7" transparent opacity={0.6} />
      </mesh>

      <mesh ref={ringRef2} position={[0, 0.15, 0]}>
        <torusGeometry args={[2.0, 0.02, 16, 64]} />
        <meshBasicMaterial color="#14b8a6" transparent opacity={0.5} />
      </mesh>

      <mesh ref={ringRef3} position={[0, -0.1, 0]}>
        <torusGeometry args={[2.2, 0.015, 16, 64]} />
        <meshBasicMaterial color="#5eead4" transparent opacity={0.4} />
      </mesh>

      {/* 7. Floating Molecular Data Particles - Enhanced */}
      {[
        [-1.7, 0.9, 0.6],
        [1.8, 0.7, -0.5],
        [-1.4, -0.4, 1.0],
        [1.5, -0.2, 0.9],
        [-0.9, 1.5, -0.6],
        [1.0, 1.6, 0.5],
        [-1.2, 1.2, -0.8],
        [1.3, -0.6, -0.7],
        [0.5, 1.8, 0.3],
        [-1.6, -0.8, 0.4],
      ].map((pos, idx) => (
        <mesh key={idx} position={pos as [number, number, number]} ref={(el) => { if (el) particleRefs.current[idx] = el; }}>
          <icosahedronGeometry args={[0.08, 0]} />
          <meshStandardMaterial
            color={idx % 3 === 0 ? "#0d9488" : idx % 3 === 1 ? "#0284c7" : "#14b8a6"}
            emissive={idx % 3 === 0 ? "#14b8a6" : idx % 3 === 1 ? "#38bdf8" : "#5eead4"}
            emissiveIntensity={1.0}
            roughness={0.3}
            metalness={0.4}
          />
        </mesh>
      ))}

      {/* 8. Subtle connecting filaments between particles */}
      <group>
        {[
          [-1.7, 0.9, 0.6, 1.8, 0.7, -0.5],
          [-1.4, -0.4, 1.0, 1.5, -0.2, 0.9],
          [-0.9, 1.5, -0.6, 1.0, 1.6, 0.5],
          [0.5, 1.8, 0.3, -1.2, 1.2, -0.8],
        ].map((line, idx) => {
          const points = [
            new THREE.Vector3(line[0], line[1], line[2]),
            new THREE.Vector3(line[3], line[4], line[5])
          ];
          return (
            <Line key={idx} points={points} color={idx % 2 === 0 ? "#0d9488" : "#0284c7"} transparent opacity={0.15} lineWidth={2} dashed dashSize={0.1} gapSize={0.05} />
          );
        })}
      </group>
    </group>
  );
};

export const LuminousFigure3D: React.FC<FigureProps> = () => {
  // Respect user reduced-motion preferences
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ 
          width: "100%", 
          height: "100%", 
          maxWidth: 360,
          maxHeight: 360,
          borderRadius: "50%", 
          background: "radial-gradient(circle at 30% 30%, var(--teal-100) 0%, var(--blue-100) 40%, var(--lavender-100) 70%, transparent 100%)",
          boxShadow: "var(--shadow-glow-mint), var(--shadow-neu-raised-lg)"
        }} />
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 360, position: "relative" }}>
      <Suspense fallback={<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 120, height: 120, borderRadius: "50%", background: "var(--teal-100)", opacity: 0.5 }} />
      </div>}>
        <Canvas 
          camera={{ position: [0, 0.1, 4.6], fov: 42 }} 
          dpr={[1, 1.5]}
          style={{ background: "transparent" }}
        >
          <ambientLight intensity={2.0} color="#fafafa" />
          <directionalLight position={[5, 8, 5]} intensity={2.5} color="#f0fdfa" />
          <directionalLight position={[-4, 3, 4]} intensity={1.5} color="#cffafe" />
          <pointLight position={[-3, -2, 3]} intensity={2.0} color="#0284c7" decay={2} />
          <pointLight position={[3, -2, 2]} intensity={2.2} color="#14b8a6" decay={2} />
          <pointLight position={[0, 3, 2]} intensity={1.0} color="#5eead4" decay={2} />
          
          {/* Subtle hemisphere light for rim lighting */}
          <hemisphereLight args={["#f0fdfa", "#0d9488", 0.8]} />
          
          <Float speed={1.0} rotationIntensity={0.1} floatIntensity={0.25}>
            <LuminousHeadSilhouette />
          </Float>
        </Canvas>
      </Suspense>
    </div>
  );
};

export default LuminousFigure3D;