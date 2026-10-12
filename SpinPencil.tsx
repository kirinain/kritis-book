'use client';
/**
 * SpinPencil · a pencil lying on the desk that spins freely around its middle.
 *
 * - Click it: it gets a quick flick and spins.
 * - Drag around it: it follows your pointer; let go while moving and it keeps
 *   spinning with that speed, then slows down with friction.
 * - Grab it while it spins: it stops in your fingers.
 *
 * Units are meters. `position` is the point on the desk under the pencil's middle.
 * Needs `<OrbitControls makeDefault />` so the camera stays still while you drag.
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';

export type SpinPencilProps = {
  position?: [number, number, number];
  /** Pencil length in meters. */
  length?: number;
  /** Paint color of the pencil body. */
  color?: string;
  /** Starting angle on the desk, in radians. */
  initialAngle?: number;
  /** How fast a spin dies out. Lower = spins longer. */
  friction?: number;
  /** Text for your hover label / tooltip. */
  label?: string;
  onHoverChange?: (label: string | null) => void;
  onDragChange?: (dragging: boolean) => void;
};

const TAU = Math.PI * 2;
const wrapPi = (a: number) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

export default function SpinPencil({
  position = [-0.42, 0.76, 0.45],
  length = 0.17,
  color = '#E8BAB5',
  initialAngle = 0.5,
  friction = 0.42,
  label = 'Pencil · flick it to spin',
  onHoverChange,
  onDragChange,
}: SpinPencilProps) {
  const outer = useRef<THREE.Group>(null!);
  const spinner = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null;

  const r = 0.0045; // pencil radius
  const st = useRef({
    angle: initialAngle, omega: 0, dir: 1,
    dragging: false, lastA: 0, lastT: 0, vel: 0,
    downX: 0, downY: 0, downT: 0, hovered: false,
  });

  // world-space helpers (reused, no allocations per frame)
  const tmp = useMemo(() => ({ plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit: new THREE.Vector3(), c: new THREE.Vector3() }), []);

  // layout of the pencil along its own axis (tip points to +x before spinning)
  const L = length;
  const parts = useMemo(() => {
    const eraser = L * 0.06, ferrule = L * 0.05, cone = L * 0.11, bodyLen = L - eraser - ferrule - cone;
    const x0 = -L / 2;
    return {
      eraser: { len: eraser, x: x0 + eraser / 2 },
      ferrule: { len: ferrule, x: x0 + eraser + ferrule / 2 },
      body: { len: bodyLen, x: x0 + eraser + ferrule + bodyLen / 2 },
      cone: { len: cone, x: x0 + eraser + ferrule + bodyLen + cone / 2 },
    };
  }, [L]);

  /** Angle of the pointer around the pencil's middle, measured on the desk plane. */
  function pointerAngle(ray: THREE.Ray): number | null {
    outer.current.getWorldPosition(tmp.c);
    tmp.plane.constant = -(tmp.c.y + r);
    if (!ray.intersectPlane(tmp.plane, tmp.hit)) return null;
    const local = outer.current.worldToLocal(tmp.hit.clone());
    return Math.atan2(-local.z, local.x); // matches rotation.y around +y
  }

  const setCursor = (c: string) => { if (typeof document !== 'undefined') document.body.style.cursor = c; };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as unknown as Element).setPointerCapture?.(e.pointerId);
    const s = st.current, a = pointerAngle(e.ray);
    s.dragging = true; s.omega = 0; s.vel = 0;
    s.downX = e.clientX; s.downY = e.clientY; s.downT = s.lastT = performance.now();
    s.lastA = a ?? 0;
    if (controls) controls.enabled = false;
    onDragChange?.(true); setCursor('grabbing');
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const s = st.current; if (!s.dragging) return;
    e.stopPropagation();
    const a = pointerAngle(e.ray); if (a === null) return;
    const now = performance.now(), dt = Math.max(0.008, (now - s.lastT) / 1000);
    const d = wrapPi(a - s.lastA);
    s.angle += d; s.vel = s.vel * 0.55 + (d / dt) * 0.45;
    s.lastA = a; s.lastT = now;
  };

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    const s = st.current; if (!s.dragging) return;
    e.stopPropagation();
    (e.target as unknown as Element).releasePointerCapture?.(e.pointerId);
    s.dragging = false;
    if (controls) controls.enabled = true;
    onDragChange?.(false); setCursor(s.hovered ? 'grab' : 'auto');
    const moved = Math.hypot(e.clientX - s.downX, e.clientY - s.downY);
    const now = performance.now();
    if (moved < 6 && now - s.downT < 350) {
      // a simple click: flick it, keeping the last direction most of the time
      if (Math.random() < 0.2) s.dir *= -1;
      s.omega = s.dir * (10 + Math.random() * 8);
    } else {
      // a drag: keep the release speed (zero if you held still before letting go)
      s.omega = now - s.lastT > 120 ? 0 : THREE.MathUtils.clamp(s.vel, -45, 45);
      if (s.omega) s.dir = Math.sign(s.omega);
    }
  };

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05), s = st.current;
    if (!s.dragging) {
      s.angle += s.omega * dt;
      s.omega *= Math.exp(-friction * dt);                     // air + desk drag
      const kinetic = 1.6 * dt;                                // dry friction near the end
      s.omega = Math.abs(s.omega) <= kinetic ? 0 : s.omega - Math.sign(s.omega) * kinetic;
    }
    spinner.current.rotation.y = s.angle;
    // a little rattle on the desk while it spins fast
    const speed = Math.min(1, Math.abs(s.omega) / 25);
    body.current.position.y = r + Math.abs(Math.sin(s.angle * 3)) * 0.0006 * speed;
    body.current.rotation.x = Math.sin(s.angle * 2) * 0.03 * speed;
  });

  return (
    <group ref={outer} position={position}>
      <group
        ref={spinner}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerOver={(e) => { e.stopPropagation(); st.current.hovered = true; if (!st.current.dragging) setCursor('grab'); onHoverChange?.(label); }}
        onPointerOut={() => { st.current.hovered = false; if (!st.current.dragging) setCursor('auto'); onHoverChange?.(null); }}
      >
        <group ref={body} position-y={r}>
          {/* lie the pencil along +x and roll it so a flat hex face sits on the desk */}
          <group rotation={[Math.PI / 6, 0, -Math.PI / 2]}>
            <mesh castShadow receiveShadow position-y={parts.body.x}>
              <cylinderGeometry args={[r, r, parts.body.len, 6]} />
              <meshStandardMaterial color={color} roughness={0.42} />
            </mesh>
            <mesh castShadow position-y={parts.cone.x}>
              <cylinderGeometry args={[r * 0.18, r, parts.cone.len, 6]} />
              <meshStandardMaterial color="#E9D2B0" roughness={0.85} />
            </mesh>
            <mesh castShadow position-y={parts.cone.x + parts.cone.len * 0.42}>
              <cylinderGeometry args={[0.0002, r * 0.3, parts.cone.len * 0.2, 8]} />
              <meshStandardMaterial color="#2B2624" roughness={0.4} />
            </mesh>
            <mesh castShadow position-y={parts.ferrule.x}>
              <cylinderGeometry args={[r * 1.04, r * 1.04, parts.ferrule.len, 16]} />
              <meshStandardMaterial color="#D9C08E" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh castShadow position-y={parts.eraser.x}>
              <cylinderGeometry args={[r * 1.02, r * 1.02, parts.eraser.len, 16]} />
              <meshStandardMaterial color="#F2A7B2" roughness={0.9} />
            </mesh>
          </group>
        </group>
        {/* invisible, wider grab area so the thin pencil is easy to hit */}
        <mesh position-y={0.006}>
          <boxGeometry args={[L, 0.014, 0.03]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}
