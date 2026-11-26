import React, { useRef, useState, useEffect } from "react";
import * as THREE from "three";

/* ============================================================
   AyurvedaLotusScene — Faithful port of Ayurvedic_Lotus_Bloom.html
   Imperative Three.js (exact visual match to original).
   5 petal layers, vein textures, stem, seed pod, stamens,
   water ripples, lily pads, pollen particles, 26s bloom cycle,
   360° camera orbit, drag/zoom interaction, reduced-motion support.
   ============================================================ */

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (x: number) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const col = (h: number | string) => new THREE.Color(h).convertSRGBToLinear();

const softDot = (inner: string, outer: string): THREE.Texture => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
};

const veinTexture = (rgb: string = "40,110,150"): THREE.Texture => {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const x = c.getContext("2d")!;
  x.fillStyle = "#fff";
  x.fillRect(0, 0, 256, 512);
  x.lineCap = "round";
  for (let i = 0; i <= 34; i++) {
    const t = i / 34;
    const tx = 20 + t * 216;
    x.strokeStyle = `rgba(${rgb},${0.10 + Math.random() * 0.10})`;
    x.lineWidth = 1 + Math.random() * 1.2;
    x.beginPath();
    x.moveTo(128 + (t - 0.5) * 30, 512);
    x.quadraticCurveTo(128 + (t - 0.5) * 120, 300, tx, 40 + Math.abs(t - 0.5) * 80);
    x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
};

interface LotusLayer {
  n: number;
  len: number;
  hw: number;
  r0: number;
  cup: number;
  delay: number;
  c: { t0: number; k: number };
  o: { t0: number; k: number };
  b: number;
  m: number;
  t: number;
  cb: THREE.Color;
  cm: THREE.Color;
  ct: THREE.Color;
  e: number;
}

const LAYERS: LotusLayer[] = [
  { n: 8, len: 2.3, hw: 0.66, r0: 0.32, cup: 0.38, delay: 0.00, c: { t0: 0.35, k: -0.35 }, o: { t0: 0.62, k: 0.85 }, b: 0xdcefdc, m: 0x9fd3ea, t: 0x2f7fc4, cb: new THREE.Color(), cm: new THREE.Color(), ct: new THREE.Color(), e: 0 },
  { n: 8, len: 2.15, hw: 0.60, r0: 0.28, cup: 0.42, delay: 0.07, c: { t0: 0.27, k: -0.36 }, o: { t0: 0.46, k: 0.72 }, b: 0xe8f4e2, m: 0xb0dcee, t: 0x4a95d2, cb: new THREE.Color(), cm: new THREE.Color(), ct: new THREE.Color(), e: 0 },
  { n: 7, len: 1.95, hw: 0.55, r0: 0.24, cup: 0.46, delay: 0.14, c: { t0: 0.20, k: -0.40 }, o: { t0: 0.32, k: 0.52 }, b: 0xf2f8ea, m: 0xc2e4f1, t: 0x6aaee0, cb: new THREE.Color(), cm: new THREE.Color(), ct: new THREE.Color(), e: 0 },
  { n: 6, len: 1.70, hw: 0.50, r0: 0.20, cup: 0.50, delay: 0.21, c: { t0: 0.12, k: -0.45 }, o: { t0: 0.18, k: 0.32 }, b: 0xf7fbf0, m: 0xd6edf6, t: 0x8cc4ea, cb: new THREE.Color(), cm: new THREE.Color(), ct: new THREE.Color(), e: 0 },
  { n: 5, len: 1.35, hw: 0.42, r0: 0.16, cup: 0.55, delay: 0.28, c: { t0: 0.08, k: -0.55 }, o: { t0: 0.10, k: 0.14 }, b: 0xfbfdf4, m: 0xe6f4f9, t: 0xb2d9f0, cb: new THREE.Color(), cm: new THREE.Color(), ct: new THREE.Color(), e: 0 },
];

LAYERS.forEach((L) => {
  L.cb = col(L.b);
  L.cm = col(L.m);
  L.ct = col(L.t);
});

const WS = 8;
const LS = 14;

function petalColor(L: LotusLayer, s: number, x: number) {
  const tmpC = new THREE.Color();
  if (s < 0.45) tmpC.copy(L.cb).lerp(L.cm, s / 0.45);
  else tmpC.copy(L.cm).lerp(L.ct, Math.pow((s - 0.45) / 0.55, 1.3));
  tmpC.lerp(new THREE.Color(1, 1, 1), x * x * 0.12 * (1 - s));
  return tmpC;
}

function createPetalGeometry(L: LotusLayer, index: number, layerIndex: number) {
  const step = (Math.PI * 2) / L.n;
  const g = new THREE.PlaneGeometry(1, 1, WS, LS);
  const uv = g.attributes.uv;
  const cnt = uv.count;
  const rowOf = new Uint8Array(cnt);
  const xn = new Float32Array(cnt);
  const colors = new Float32Array(cnt * 3);

  for (let v = 0; v < cnt; v++) {
    const s = uv.getY(v);
    rowOf[v] = Math.round(s * LS);
    xn[v] = uv.getX(v) * 2 - 1;
    petalColor(L, s, xn[v]).toArray(colors, v * 3);
  }

  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: veinTexture(),
    side: THREE.DoubleSide,
    roughness: 0.55,
    metalness: 0,
    emissive: col(0x0f2a4a),
    emissiveIntensity: 0.22,
  }));
  mesh.frustumCulled = false;

  const pivot = new THREE.Group();
  // Stagger each layer by half a petal step so the whorls interleave instead
  // of stacking directly on top of each other (matches the source scene).
  pivot.rotation.y = layerIndex * step * 0.5 + index * step + (Math.random() - 0.5) * 0.12;
  pivot.add(mesh);

  const jitter = {
    dt: (Math.random() - 0.5) * 0.14,
    dk: (Math.random() - 0.5) * 0.2,
    ls: 0.94 + Math.random() * 0.12,
    ws: 0.92 + Math.random() * 0.16,
    ph: Math.random() * 6.28,
  };

  return { pivot, mesh, g, rowOf, xn, L, jitter, e: 0 };
}

function createWaterGeometry() {
  const geo = new THREE.PlaneGeometry(60, 60, 90, 90);
  geo.rotateX(-Math.PI / 2);
  const wp = geo.attributes.position;
  const wR = new Float32Array(wp.count);
  for (let i = 0; i < wp.count; i++) {
    wR[i] = Math.hypot(wp.getX(i), wp.getZ(i));
  }
  return { geo, wp, wR };
}

function makePadGeometry(r: number) {
  const g = new THREE.CircleGeometry(r, 48, 0, Math.PI * 2 - 0.35);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const d = Math.hypot(p.getX(i), p.getZ(i)) / r;
    p.setY(i, d * d * 0.14);
  }
  g.computeVertexNormals();
  return g;
}

interface AyurvedaLotusSceneProps {
  className?: string;
  style?: React.CSSProperties;
}

export const AyurvedaLotusScene: React.FC<AyurvedaLotusSceneProps> = ({
  className = "",
  style = {},
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [threeInitError, setThreeInitError] = useState(false);

  // Hook 1: matchMedia listener (always runs)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // Hook 2: Three.js initialization (always runs, errors caught internally)
  useEffect(() => {
    if (reducedMotion) return;
    const container = containerRef.current;
    if (!container) return;

    try {
      // ---------- SCENE ----------
      const scene = new THREE.Scene();
      scene.background = col(0xe4f3f5);
      scene.fog = new THREE.FogExp2(col(0xe4f3f5), 0.022);

      const W = () => container.clientWidth || innerWidth;
      const H = () => container.clientHeight || innerHeight;
      const camera = new THREE.PerspectiveCamera(40, W() / H(), 0.1, 120);

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
      } catch (e) {
        console.error("WebGL not supported", e);
        setThreeInitError(true);
        return;
      }
      const dpr = Math.min(devicePixelRatio, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(W(), H());
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      container.appendChild(renderer.domElement);

      // ---------- LIGHTS ----------
      const hemi = new THREE.HemisphereLight(col(0xffffff), col(0x8cc7d6), 1.0);
      scene.add(hemi);
      const key = new THREE.DirectionalLight(col(0xfff1dc), 2.0);
      key.position.set(4, 8, 5);
      scene.add(key);
      const rim = new THREE.DirectionalLight(col(0xbfe6ff), 0.9);
      rim.position.set(-6, 4, -6);
      scene.add(rim);
      const heart = new THREE.PointLight(col(0x7fe0e6), 1, 7, 2);
      heart.position.set(0, 1.2, 0);
      scene.add(heart);

      // ---------- WATER ----------
      const water = createWaterGeometry();
      const waterMesh = new THREE.Mesh(water.geo, new THREE.MeshStandardMaterial({
        color: col(0x7fc4cf),
        roughness: 0.15,
        metalness: 0.05,
        transparent: true,
        opacity: 0.95,
      }));
      scene.add(waterMesh);

      // Glow plane
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 9),
        new THREE.MeshBasicMaterial({
          map: softDot("rgba(255,255,255,0.9)", "rgba(255,255,255,0)"),
          transparent: true,
          opacity: 0,
          depthWrite: false,
        })
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.04;
      scene.add(glow);

      // Ripples
      const ripples: THREE.Mesh[] = [];
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(
          new THREE.RingGeometry(0.97, 1, 64),
          new THREE.MeshBasicMaterial({
            color: col(0xffffff),
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
        );
        m.rotation.x = -Math.PI / 2;
        m.position.y = 0.05;
        scene.add(m);
        ripples.push(m);
      }

      // ---------- LILY PADS ----------
      const padMat = new THREE.MeshStandardMaterial({
        color: col(0x3f9a5e),
        roughness: 0.5,
        side: THREE.DoubleSide,
      });
      const padPositions = [
        [-4.8, -1.6, 1.5], [4.4, -2.7, 1.3], [-3.4, 3.5, 1.1],
        [4.0, 3.3, 1.6], [0.8, -5.4, 1.4], [-6.6, 1.6, 1.0], [6.8, 0.4, 0.9],
      ];
      const pads: { m: THREE.Mesh; ph: number }[] = [];
      padPositions.forEach(([x, z, r], i) => {
        const m = new THREE.Mesh(makePadGeometry(r), padMat);
        m.position.set(x, 0.03, z);
        m.rotation.y = Math.random() * 6.28;
        scene.add(m);
        pads.push({ m, ph: i * 1.7 });
      });

      // ---------- LOTUS ----------
      const flower = new THREE.Group();
      flower.position.y = 0.35;
      scene.add(flower);

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.13, 4, 12),
        new THREE.MeshStandardMaterial({ color: col(0x2d6b3e), roughness: 0.7 })
      );
      stem.position.y = -1.65;
      scene.add(stem);

      const petals: Array<{ pivot: THREE.Group; mesh: THREE.Mesh; g: THREE.PlaneGeometry; rowOf: Uint8Array; xn: Float32Array; L: LotusLayer; jitter: any; e: number }> = [];
      LAYERS.forEach((L, li) => {
        for (let i = 0; i < L.n; i++) {
          const petal = createPetalGeometry(L, i, li);
          petal.e = 0;
          petals.push(petal);
          flower.add(petal.pivot);
        }
      });

      // Seed pod
      const pod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.30, 0.14, 0.34, 24),
        new THREE.MeshStandardMaterial({ color: col(0xb7c94a), roughness: 0.6 })
      );
      pod.position.y = 0.17;
      flower.add(pod);
      const podTop = new THREE.Mesh(
        new THREE.CircleGeometry(0.30, 24),
        new THREE.MeshStandardMaterial({ color: col(0xc9d85a), roughness: 0.6 })
      );
      podTop.rotation.x = -Math.PI / 2;
      podTop.position.y = 0.345;
      flower.add(podTop);
      const holeMat = new THREE.MeshStandardMaterial({ color: col(0x5f7a2a), roughness: 0.8 });
      const holeGeo = new THREE.SphereGeometry(0.04, 8, 6);
      [
        [0, 0],
        ...Array.from({ length: 6 }, (_, i) => [Math.cos(i / 6 * 6.283) * 0.1, Math.sin(i / 6 * 6.283) * 0.1]),
        ...Array.from({ length: 10 }, (_, i) => [Math.cos(i / 10 * 6.283 + 0.3) * 0.2, Math.sin(i / 10 * 6.283 + 0.3) * 0.2]),
      ].forEach(([x, z]) => {
        const h = new THREE.Mesh(holeGeo, holeMat);
        h.position.set(x, 0.345, z);
        h.scale.y = 0.4;
        flower.add(h);
      });

      // Stamens
      const filMat = new THREE.MeshStandardMaterial({
        color: col(0xf3e08a),
        roughness: 0.6,
        emissive: col(0x4a3a00),
        emissiveIntensity: 0.3,
      });
      const antMat = new THREE.MeshStandardMaterial({
        color: col(0xffc928),
        roughness: 0.5,
        emissive: col(0x7a5000),
        emissiveIntensity: 0.5,
      });
      const stamens: { pv: THREE.Group; j: number }[] = [];
      for (let i = 0; i < 70; i++) {
        const a = (i / 70) * Math.PI * 2 + Math.random() * 0.1;
        const R = 0.2 + Math.random() * 0.12;
        const len = 0.55 + Math.random() * 0.4;
        const pv = new THREE.Group();
        pv.position.set(Math.sin(a) * R, 0.3, Math.cos(a) * R);
        pv.rotation.order = "YXZ";
        pv.rotation.y = a;
        const fg = new THREE.CylinderGeometry(0.007, 0.011, len, 5);
        fg.translate(0, len / 2, 0);
        const f = new THREE.Mesh(fg, filMat);
        pv.add(f);
        const an = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.12, 6), antMat);
        an.position.y = len;
        pv.add(an);
        flower.add(pv);
        stamens.push({ pv, j: (Math.random() - 0.5) * 0.12 });
      }

      // Pollen / fireflies
      const PN = 120;
      const pGeo = new THREE.BufferGeometry();
      const pPos = new Float32Array(PN * 3);
      const pSeed: { sp: number; ph: number }[] = [];
      for (let i = 0; i < PN; i++) {
        const a = Math.random() * 6.28;
        const r = 1 + Math.random() * 5;
        pPos[i * 3] = Math.cos(a) * r;
        pPos[i * 3 + 1] = 0.3 + Math.random() * 4;
        pPos[i * 3 + 2] = Math.sin(a) * r;
        pSeed.push({ sp: 0.002 + Math.random() * 0.004, ph: Math.random() * 6.28 });
      }
      pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
      const pts = new THREE.Points(
        pGeo,
        new THREE.PointsMaterial({
          map: softDot("rgba(255,196,64,1)", "rgba(255,196,64,0)"),
          size: 0.14,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
        })
      );
      scene.add(pts);

      // ---------- CAMERA ORBIT ----------
      let az = 0.5, el = 0.34, dist = 9.5;
      let tAz = az, tEl = el, tDist = dist;
      let lastInput = -10, dragging = false;

      const el0 = renderer.domElement;
      el0.addEventListener("pointerdown", (e: PointerEvent) => {
        dragging = true;
        lastInput = clock.getElapsedTime();
        el0.setPointerCapture(e.pointerId);
      }, { passive: false });
      el0.addEventListener("pointermove", (e: PointerEvent) => {
        if (!dragging) return;
        tAz -= (e.movementX) * 0.006;
        tEl = clamp(tEl + (e.movementY) * 0.004, 0.04, 1.3);
        lastInput = clock.getElapsedTime();
      }, { passive: false });
      el0.addEventListener("pointerup", () => { dragging = false; }, { passive: false });
      el0.addEventListener("pointercancel", () => { dragging = false; }, { passive: false });
      el0.addEventListener("wheel", (e: WheelEvent) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        e.preventDefault();
        tDist = clamp(tDist + e.deltaY * 0.01, 5, 16);
        lastInput = clock.getElapsedTime();
      }, { passive: false });

      // ---------- UI / BLOOM TIMELINE ----------
      const PERIOD = 12;
      function timeline(t: number) {
        const p = ((t + PERIOD * 0.06) % PERIOD) / PERIOD;
        if (p < 0.08) return 0;
        if (p < 0.50) return ease((p - 0.08) / 0.42);
        if (p < 0.78) return 1;
        return 1 - ease((p - 0.78) / 0.22);
      }

      // ---------- LOOP ----------
      const clock = new THREE.Clock();
      let slow = 0, frame = 0, raf = 0, inView = true;

      const rowY = new Float32Array(LS + 1);
      const rowZ = new Float32Array(LS + 1);
      const rowT = new Float32Array(LS + 1);
      const rowW = new Float32Array(LS + 1);

      const lastRef = { current: performance.now() };

      function animate() {
        raf = requestAnimationFrame(animate);
        const now = performance.now();
        const dt = now - lastRef.current;
        lastRef.current = now;

        slow = dt > 34 && dt < 250 ? slow + 1 : Math.max(0, slow - 1);
        if (slow > 45 && dpr > 1) {
          const newDpr = Math.max(1, dpr - 0.25);
          renderer.setPixelRatio(newDpr);
          renderer.setSize(W(), H());
          slow = 0;
        }

        const rt = clock.getElapsedTime();
        const t = reducedMotion ? 0 : rt;
        const fdt = Math.min(dt, 50) / 16.67;

        const target = timeline(t);
        // timeline() is already eased, so follow it directly. The previous
        // fixed 0.06-per-frame smoothing lagged behind the target and muted the
        // opening/closing motion, especially on slower devices.
        const b = target;

        LAYERS.forEach((L) => {
          L.e = ease((b - L.delay) / (1 - L.delay));
        });

        petals.forEach((p) => {
          const L = p.L;
          p.e = L.e;
          const j = p.jitter;
          const t0 = lerp(L.c.t0, L.o.t0, p.e) + j.dt + Math.sin(t * 0.9 + j.ph) * 0.012 * p.e;
          const k = lerp(L.c.k, L.o.k, p.e) + j.dk;
          const len = L.len * j.ls;
          const ds = len / LS;
          let y = 0;
          let z = L.r0;

          for (let jj = 0; jj <= LS; jj++) {
            const s = jj / LS;
            if (jj > 0) {
              const tm = t0 + k * (s - 0.5 / LS);
              y += Math.cos(tm) * ds;
              z += Math.sin(tm) * ds;
            }
            rowY[jj] = y;
            rowZ[jj] = z;
            rowT[jj] = t0 + k * s;
            rowW[jj] = L.hw * j.ws * Math.pow(Math.max(Math.sin(Math.PI * Math.pow(s, 0.8)), 0), 0.8) + 0.015;
          }

          const pos = p.g.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const jj = p.rowOf[i];
            const xv = p.xn[i];
            const hw = rowW[jj];
            const s = jj / LS;
            const off = L.cup * hw * xv * xv + Math.sin(s * 9 + j.ph + xv * 2) * 0.025 * xv * xv * hw;
            const th = rowT[jj];
            pos.setXYZ(i, xv * hw, rowY[jj] + off * Math.sin(th), rowZ[jj] - off * Math.cos(th));
          }
          pos.needsUpdate = true;
          p.g.computeVertexNormals();
        });

        const se = ease((b - 0.3) / 0.7);
        stamens.forEach((s) => {
          s.pv.rotation.x = lerp(0.04, 0.5, se) + s.j + Math.sin(t * 1.3 + s.pv.rotation.y * 3) * 0.02 * se;
        });
        heart.intensity = 0.4 + 1.8 * b;
        (glow.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.4 * b;

        if ((frame++ & 1) === 0) {
          const { wp, wR } = water;
          for (let i = 0; i < wp.count; i++) {
            const r = wR[i];
            const x = wp.getX(i);
            const z = wp.getZ(i);
            wp.setY(i,
              0.025 * Math.sin(r * 1.6 - t * 1.1) / (1 + r * 0.25) +
              0.012 * Math.sin(x * 0.9 + t * 0.7) * Math.cos(z * 0.8 - t * 0.5)
            );
          }
          wp.needsUpdate = true;
          water.geo.computeVertexNormals();
        }

        ripples.forEach((m, i) => {
          const ph = ((t * 0.18 + i / 3) % 1);
          m.scale.setScalar(0.8 + ph * 7);
          (m.material as THREE.MeshBasicMaterial).opacity = (1 - ph) * 0.28 * (0.4 + b * 0.6);
        });

        pads.forEach((p) => {
          p.m.position.y = 0.03 + Math.sin(t * 0.8 + p.ph) * 0.015;
          p.m.rotation.y += 0.0004;
        });

        if (!reducedMotion) {
          for (let i = 0; i < PN; i++) {
            pPos[i * 3 + 1] += pSeed[i].sp;
            if (pPos[i * 3 + 1] > 4.5) pPos[i * 3 + 1] = 0.3;
            pPos[i * 3] += Math.sin(t * 0.5 + pSeed[i].ph) * 0.0025;
            pPos[i * 3 + 2] += Math.cos(t * 0.4 + pSeed[i].ph) * 0.0025;
          }
          pGeo.attributes.position.needsUpdate = true;
        }

        if (!reducedMotion && !dragging && rt - lastInput > 1.5) {
          tAz += 0.0025 * fdt;
        }
        az += (tAz - az) * 0.08;
        el += (tEl - el) * 0.08;
        dist += (tDist - dist) * 0.08;
        const d = dist * (camera.aspect < 1 ? Math.pow(1 / camera.aspect, 0.6) : 1);
        camera.position.set(
          Math.sin(az) * Math.cos(el) * d,
          Math.sin(el) * d + 1.1,
          Math.cos(az) * Math.cos(el) * d
        );
        camera.lookAt(0, 1.1, 0);

        renderer.render(scene, camera);
      }

      function setRunning(on: boolean) {
        if (on && !raf) {
          lastRef.current = performance.now();
          raf = requestAnimationFrame(animate);
        } else if (!on) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      }

      const sync = () => setRunning(inView && !document.hidden);
      const io = new IntersectionObserver(([e]) => {
        inView = e.isIntersecting;
        sync();
      });
      io.observe(container);
      document.addEventListener("visibilitychange", sync);

      renderer.domElement.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        setRunning(false);
      });
      renderer.domElement.addEventListener("webglcontextrestored", () => {
        scene.traverse((o: any) => {
          if (o.material) [].concat(o.material).forEach((m: any) => { m.needsUpdate = true; });
        });
        sync();
      });

      const ro = new ResizeObserver(() => {
        camera.aspect = W() / H();
        camera.updateProjectionMatrix();
        renderer.setSize(W(), H());
      });
      ro.observe(container);

      return () => {
        setRunning(false);
        io.disconnect();
        ro.disconnect();
        document.removeEventListener("visibilitychange", sync);
        scene.traverse((o: any) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            const mats = [].concat(o.material);
            mats.forEach((m: any) => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          }
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    } catch (e) {
      console.error("AyurvedaLotusScene error:", e);
      setThreeInitError(true);
    }
  }, []);

  // Fallback for reduced motion or WebGL failure
  if (reducedMotion || threeInitError) {
    return (
      <div
        className={className}
        style={{
          ...style,
          width: "100%",
          height: "100%",
          minHeight: "400px",
          background: "linear-gradient(135deg, #e3f2e8 0%, #dff0fb 100%)",
          borderRadius: "var(--radius-card-lg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
        aria-label={threeInitError ? "Lotus bloom unavailable" : "Ayurvedic lotus bloom (static view for reduced motion)"}
      >
        <div style={{
          width: 200,
          height: 200,
          background: "radial-gradient(circle at 30% 30%, #FFF8E7 0%, #F5E6CC 40%, #E8D8A0 100%)",
          borderRadius: "50%",
          boxShadow: "0 0 60px rgba(255, 240, 200, 0.5), inset 0 0 40px rgba(200, 180, 120, 0.3)",
          position: "relative",
        }}>
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 60,
            height: 60,
            background: "#8B6B3A",
            borderRadius: "50%",
            boxShadow: "0 4px 20px rgba(139, 107, 58, 0.5)",
          }} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ width: "100%", height: "100%", minHeight: "400px", ...style }}
      ref={containerRef}
    />
  );
};

export default AyurvedaLotusScene;