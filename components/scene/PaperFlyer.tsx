'use client';
/**
 * PaperFlyer · the origami crane (or a paper plane) that sits on the desk.
 * Click it and it takes off, loops around the nook for ~3 seconds and lands
 * back on its spot. Every flight takes a slightly different path.
 *
 * Units are meters. `position` is where it perches.
 * `bounds` keeps the flight inside the nook (in the same space as `position`).
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';

type Vec3 = [number, number, number];
export type PaperFlyerProps = {
  position?: Vec3;
  /** Which way it faces while perched, in radians. */
  facing?: number;
  variant?: 'crane' | 'plane';
  color?: string;
  /** Seconds in the air. */
  duration?: number;
  /** Box the flight stays inside: [min, max]. */
  bounds?: [Vec3, Vec3];
  label?: string;
  onHoverChange?: (label: string | null) => void;
  onFlightChange?: (flying: boolean) => void;
};

/* ---------- paper geometry (built from triangles, forward = +x) ---------- */
function tris(points: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  g.computeVertexNormals();
  return g;
}
function craneGeometry() {
  const N = [0.03, 0.022, 0], T = [-0.03, 0.022, 0], B = [0, 0, 0], R = [0, 0.034, 0];
  const Sp = [0, 0.018, 0.013], Sm = [0, 0.018, -0.013];
  const H = [0.072, 0.074, 0], Tt = [-0.072, 0.064, 0];
  const body = [
    ...T, ...B, ...Sp, ...B, ...N, ...Sp, ...N, ...R, ...Sp, ...R, ...T, ...Sp,
    ...T, ...Sm, ...B, ...B, ...Sm, ...N, ...N, ...Sm, ...R, ...R, ...Sm, ...T,
    // neck + head (beak bends down)
    ...N, [N[0] + 0.007, N[1] - 0.004, 0], ...H,
    ...H, [H[0] - 0.006, H[1] + 0.004, 0], [H[0] + 0.014, H[1] - 0.012, 0],
    // tail
    ...T, [T[0] - 0.007, T[1] - 0.004, 0], ...Tt,
  ].flat() as number[];
  const wing = (s: number) => tris([-0.026, 0, 0, 0.026, 0, 0, 0.004, 0.014, s * 0.078]);
  return { body: tris(body), wingL: wing(-1), wingR: wing(1) };
}
function planeGeometry() {
  const nose = [0.07, 0.012, 0], tc = [-0.06, 0.012, 0], kb = [-0.055, -0.006, 0];
  const body = tris([...nose, ...tc, ...kb]);
  const wing = (s: number) => tris([...nose, ...tc, -0.062, 0.02, s * 0.052]);
  return { body, wingL: wing(-1), wingR: wing(1) };
}

const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

export default function PaperFlyer({
  position = [0.5, 0.76, 0.42],
  facing = 2.6,
  variant = 'crane',
  color = '#F7D6DD',
  duration = 2.8,
  bounds = [[-0.6, 0.9, 0.25], [0.6, 1.45, 0.95]],
  label = variant === 'crane' ? 'Paper crane · click to let it fly' : 'Paper plane · click to throw it',
  onHoverChange,
  onFlightChange,
}: PaperFlyerProps) {
  const root = useRef<THREE.Group>(null!);
  const wingL = useRef<THREE.Group>(null!);
  const wingR = useRef<THREE.Group>(null!);
  const geo = useMemo(() => (variant === 'crane' ? craneGeometry() : planeGeometry()), [variant]);
  const reduce = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);

  const home = useMemo(() => new THREE.Vector3(...position), [position[0], position[1], position[2]]);
  const st = useRef({
    flying: false, t0: 0, dur: duration, curve: null as THREE.CatmullRomCurve3 | null,
    roll: 0, land: 0, quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, facing, 0, 'YZX')),
  });
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), tan: new THREE.Vector3(), tan2: new THREE.Vector3(), e: new THREE.Euler(0, 0, 0, 'YZX'), q: new THREE.Quaternion() }), []);

  /** A fresh, random loop that starts and ends at home and stays inside `bounds`. */
  function makePath() {
    const [mn, mx] = bounds;
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const clampV = (v: THREE.Vector3) => v.set(THREE.MathUtils.clamp(v.x, mn[0], mx[0]), THREE.MathUtils.clamp(v.y, mn[1], mx[1]), THREE.MathUtils.clamp(v.z, mn[2], mx[2]));
    const side = home.x > (mn[0] + mx[0]) / 2 ? -1 : 1; // head toward the open side first
    if (reduce) {
      return new THREE.CatmullRomCurve3([home.clone(), home.clone().add(new THREE.Vector3(0.04 * side, 0.1, 0.03)), home.clone().add(new THREE.Vector3(0.01, 0.02, 0)), home.clone()], false, 'centripetal');
    }
    const span = mx[0] - mn[0];
    const pts = [
      home.clone(),
      home.clone().add(new THREE.Vector3(0.02 * side, 0.09, 0.04)),
      clampV(new THREE.Vector3(home.x + side * span * rand(0.3, 0.45), rand(mn[1] + 0.15, mx[1]), rand(mn[2], mx[2]))),
      clampV(new THREE.Vector3(home.x + side * span * rand(0.6, 0.85), rand(mn[1], mx[1] - 0.1), rand(mn[2] + 0.2, mx[2]))),
      clampV(new THREE.Vector3(home.x + side * span * rand(0.2, 0.4), rand(mn[1] + 0.1, mx[1]), rand(mx[2] - 0.25, mx[2]))),
      home.clone().add(new THREE.Vector3(-side * 0.1, 0.11, 0.08)),
      home.clone().add(new THREE.Vector3(-side * 0.02, 0.02, 0.01)),
      home.clone(),
    ];
    return new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  }

  const takeOff = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return;              // that was a drag, not a click
    const s = st.current; if (s.flying) return;
    s.curve = makePath(); s.t0 = performance.now(); s.dur = (reduce ? 0.8 : duration) * 1000; s.flying = true;
    onFlightChange?.(true);
  };

  useFrame((state, delta) => {
    const s = st.current, g = root.current, t = state.clock.elapsedTime;
    const flapTo = (amp: number, hz: number) => {
      const a = Math.sin(t * hz * Math.PI * 2) * amp;
      if (variant === 'crane') { wingL.current.rotation.x = 0.25 + a; wingR.current.rotation.x = -0.25 - a; }
      else { wingL.current.rotation.x = a * 0.3; wingR.current.rotation.x = -a * 0.3; }
    };

    if (s.flying && s.curve) {
      const u = Math.min(1, (performance.now() - s.t0) / s.dur);
      const k = easeInOutSine(u);
      s.curve.getPointAt(k, tmp.p);
      s.curve.getTangentAt(Math.min(0.999, k), tmp.tan);
      s.curve.getTangentAt(Math.min(0.999, k + 0.02), tmp.tan2);
      // heading, climb and a bank into turns
      const yaw = Math.atan2(-tmp.tan.z, tmp.tan.x);
      const pitch = Math.asin(THREE.MathUtils.clamp(tmp.tan.y, -1, 1)) * 0.8;
      const turn = Math.atan2(-tmp.tan2.z, tmp.tan2.x) - yaw;
      const turnW = Math.atan2(Math.sin(turn), Math.cos(turn));
      s.roll += (THREE.MathUtils.clamp(-turnW * 6, -0.8, 0.8) - s.roll) * Math.min(1, delta * 6);
      tmp.e.set(s.roll, yaw, pitch, 'YZX');
      tmp.q.setFromEuler(tmp.e);
      s.quat.slerp(tmp.q, Math.min(1, delta * 10));
      g.position.copy(tmp.p);
      g.quaternion.copy(s.quat);
      // flap hard on take-off, glide in the middle, flutter on landing
      const amp = u < 0.25 ? 0.9 : u > 0.82 ? 0.7 : 0.35 + 0.2 * Math.sin(u * 20);
      flapTo(amp, u > 0.82 ? 8 : 6);
      if (u >= 1) { s.flying = false; s.land = 1; s.quat.copy(g.quaternion); onFlightChange?.(false); }
      return;
    }

    // perched: settle back to its resting pose with a tiny bounce, then breathe
    s.land *= Math.exp(-delta * 5);
    tmp.e.set(0, facing, 0, 'YZX'); tmp.q.setFromEuler(tmp.e);
    s.quat.slerp(tmp.q, Math.min(1, delta * 6));
    g.quaternion.copy(s.quat);
    g.position.set(home.x, home.y + Math.abs(Math.sin(s.land * 9)) * 0.012 * s.land + Math.sin(t * 1.4) * 0.0008, home.z);
    flapTo(0.06 + 0.5 * s.land, 1.2 + 6 * s.land);
  });

  return (
    <group
      ref={root}
      position={position}
      rotation={[0, facing, 0]}
      onClick={takeOff}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; onHoverChange?.(label); }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; onHoverChange?.(null); }}
    >
      <mesh geometry={geo.body} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.75} side={THREE.DoubleSide} flatShading />
      </mesh>
      <group ref={wingL} position={[0, variant === 'crane' ? 0.03 : 0, 0]}>
        <mesh geometry={geo.wingL} castShadow>
          <meshStandardMaterial color={color} roughness={0.75} side={THREE.DoubleSide} flatShading />
        </mesh>
      </group>
      <group ref={wingR} position={[0, variant === 'crane' ? 0.03 : 0, 0]}>
        <mesh geometry={geo.wingR} castShadow>
          <meshStandardMaterial color={color} roughness={0.75} side={THREE.DoubleSide} flatShading />
        </mesh>
      </group>
      {/* bigger invisible click target */}
      <mesh position={[0, 0.035, 0]}>
        <boxGeometry args={[0.16, 0.08, 0.12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
