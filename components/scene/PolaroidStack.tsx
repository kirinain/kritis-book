'use client';
/**
 * PolaroidStack · a small pile of polaroids on the desk.
 * Click the pile: the photos lift up and fan out into a half circle facing
 * you, stay there for a few seconds, then drop back into a pile.
 * Click while they're fanned out to put them back right away.
 *
 * Photos: by default it shows Kiti's five instax shots from /public/polaroids.
 * Pass your own with `photos={[{ src: '/polaroids/1.jpg', caption: 'hi!' }, ...]}`.
 * Each photo can be a classic square polaroid (default) or an instax mini
 * (`frame: 'instax'`), standing or sideways (`landscape: true`).
 * Without `src`, a soft placeholder is drawn.
 *
 * Units are meters. `position` is the spot on the desk under the pile.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';

export type Polaroid = {
  src?: string;
  caption?: string;
  /** 'polaroid' = classic square photo (default). 'instax' = instax mini card. */
  frame?: 'polaroid' | 'instax';
  /** Instax only: card turned sideways, thick strip on the right. */
  landscape?: boolean;
};
export type PolaroidStackProps = {
  position?: [number, number, number];
  photos?: Polaroid[];
  /** How long the fan stays open, in ms. */
  holdMs?: number;
  /** Radius of the half circle, in meters. */
  radius?: number;
  /** Where the fan opens, relative to the pile: [right, up, toward the viewer]. */
  fanOffset?: [number, number, number];
  /** Handwriting font for captions (must be loaded on the page). */
  fontFamily?: string;
  onHoverChange?: (label: string | null) => void;
};

export const PLACEHOLDER_POLAROIDS: Polaroid[] = [
  { caption: '[first robot!]' }, { caption: '[competition day]' }, { caption: '[the team]' },
  { caption: '[late night build]' }, { caption: '[first PRD]' }, { caption: '[this one is my fave]' },
];

/** Kiti's own instax shots (files in /public/polaroids). The last one sits on top of the pile. */
export const KITI_POLAROIDS: Polaroid[] = [
  { src: '/polaroids/kiti-cozy.jpg', frame: 'instax' },
  { src: '/polaroids/kiti-dance.jpg', frame: 'instax', landscape: true },
  { src: '/polaroids/kiti-garden.jpg', frame: 'instax' },
  { src: '/polaroids/kiti-blazer.jpg', frame: 'instax', landscape: true },
  { src: '/polaroids/kiti-window.jpg', frame: 'instax' },
];

const CT = 0.0012;                                     // card thickness, meters
const PX = 5800;                                       // texture pixels per meter

/** Card size and where the photo sits on it, in meters (x, y from the top-left corner). */
function cardSpec(p: Polaroid) {
  if (p.frame === 'instax') {
    // instax mini: card 54 x 86 mm, photo 46 x 62 mm, the thick strip at the bottom
    return p.landscape
      ? { w: 0.086, h: 0.054, px: 0.007, py: 0.004, pw: 0.062, ph: 0.046, strip: 'right' as const }
      : { w: 0.054, h: 0.086, px: 0.004, py: 0.007, pw: 0.046, ph: 0.062, strip: 'bottom' as const };
  }
  // classic polaroid: 88 x 107 mm, square photo
  return { w: 0.088, h: 0.107, px: 0.0053, py: 0.0053, pw: 0.0774, ph: 0.0774, strip: 'bottom' as const };
}
const SCENES = [
  ['#F6D5C2', '#F9E9D0', '#B9A3C9'], ['#CFDDEE', '#F2C6CE', '#9FB8A0'], ['#F2E2B0', '#FBEFD9', '#E3A9A2'],
  ['#D9E5E8', '#EEF3F2', '#8FAE95'], ['#EADFF5', '#FBEFF3', '#C3A5C9'], ['#FCE4D6', '#FFF4EA', '#E6B2A8'],
];

function setSRGB(t: THREE.Texture) { const a = t as any; if ('colorSpace' in a) a.colorSpace = 'srgb'; else a.encoding = 3001; return t; }
const easeOutBack = (x: number) => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** Draws one card (frame, photo or placeholder, handwritten caption). */
function paintCard(canvas: HTMLCanvasElement, i: number, p: Polaroid, img: HTMLImageElement | null, font: string) {
  const c = cardSpec(p), W = Math.round(c.w * PX), H = Math.round(c.h * PX);
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const g = canvas.getContext('2d')!;
  const x = c.px * PX, y = c.py * PX, pw = c.pw * PX, ph = c.ph * PX;
  g.fillStyle = '#FFFDF8'; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 1500; k++) { g.fillStyle = k % 2 ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.4)'; g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5); }
  if (img && img.naturalWidth) {
    // fill the photo area, cropping from the centre if the shapes differ
    const s = Math.max(pw / img.naturalWidth, ph / img.naturalHeight);
    const sw = pw / s, sh = ph / s;
    g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, pw, ph);
  } else {
    const [a, b, hill] = SCENES[i % SCENES.length];
    const lg = g.createLinearGradient(0, y, 0, y + ph); lg.addColorStop(0, a); lg.addColorStop(1, b); g.fillStyle = lg; g.fillRect(x, y, pw, ph);
    g.fillStyle = 'rgba(255,250,235,0.9)'; g.beginPath(); g.arc(x + pw * (0.25 + 0.5 * ((i * 37) % 10) / 10), y + ph * 0.3, Math.min(pw, ph) * 0.09, 0, Math.PI * 2); g.fill();
    g.fillStyle = hill; g.beginPath(); g.moveTo(x, y + ph * 0.78); g.quadraticCurveTo(x + pw * 0.4, y + ph * (0.55 + 0.05 * (i % 3)), x + pw, y + ph * 0.72); g.lineTo(x + pw, y + ph); g.lineTo(x, y + ph); g.fill();
    g.fillStyle = 'rgba(60,50,40,0.5)'; g.font = '500 22px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('[your photo]', x + pw / 2, y + ph * 0.55);
  }
  g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(x, y, pw, 2); // tiny inner shadow at the top of the photo
  if (p.caption) {
    g.fillStyle = '#3D372F'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (c.strip === 'bottom') {
      const room = H - y - ph; g.font = `500 ${Math.round(room * 0.45)}px ${font}`;
      g.fillText(p.caption, W / 2, y + ph + room * 0.52, W - 2 * x);
    } else {
      const room = W - x - pw; g.save(); g.translate(x + pw + room * 0.5, H / 2); g.rotate(-Math.PI / 2);
      g.font = `500 ${Math.round(room * 0.45)}px ${font}`; g.fillText(p.caption, 0, 0, H - 2 * y); g.restore();
    }
  }
}

export default function PolaroidStack({
  position = [-0.19, 0.76, 0.075],
  photos = KITI_POLAROIDS,
  holdMs = 3000,
  radius = 0.16,
  fanOffset = [0.1, 0.2, 0.17],
  fontFamily = '"Caveat", "Segoe Print", cursive',
  onHoverChange,
}: PolaroidStackProps) {
  const group = useRef<THREE.Group>(null!);
  const cards = useRef<(THREE.Group | null)[]>([]);
  const camera = useThree((s) => s.camera);
  const n = photos.length;
  const reduce = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);

  // one canvas texture per card; images and fonts repaint it when they arrive
  const faces = useMemo(() => photos.map((p, i) => {
    const c = document.createElement('canvas');
    paintCard(c, i, p, null, fontFamily);
    const tex = setSRGB(new THREE.CanvasTexture(c)); tex.anisotropy = 8;
    return { canvas: c, tex, img: null as HTMLImageElement | null };
  }), [photos, fontFamily]);
  useEffect(() => {
    let alive = true;
    const repaint = (i: number) => { const f = faces[i]; paintCard(f.canvas, i, photos[i], f.img, fontFamily); f.tex.needsUpdate = true; };
    photos.forEach((p, i) => {
      if (!p.src) return;
      const img = new Image(); img.crossOrigin = 'anonymous'; img.decoding = 'async';
      img.onload = () => { if (!alive) return; faces[i].img = img; repaint(i); };
      img.src = p.src;
    });
    (document as any).fonts?.load?.(`52px ${fontFamily}`).then(() => alive && photos.forEach((_, i) => repaint(i))).catch(() => {});
    return () => { alive = false; faces.forEach((f) => f.tex.dispose()); };
  }, [faces]);

  // resting pile: a slightly messy stack
  const stack = useMemo(() => photos.map((_, i) => {
    const r = Math.sin(i * 12.9898) * 43758.5453, j = r - Math.floor(r);
    return {
      pos: new THREE.Vector3((j - 0.5) * 0.012, CT / 2 + i * (CT + 0.0005), (((j * 7) % 1) - 0.5) * 0.012),
      quat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (j - 0.5) * 0.4),
    };
  }), [photos]);

  const st = useRef({ mode: 'stack' as 'stack' | 'open' | 'closing', openAt: 0, closeAt: 0, closeStart: 0, prog: [] as number[], fan: [] as { pos: THREE.Vector3; quat: THREE.Quaternion }[] });
  const OUT = reduce ? 250 : 700, BACK = reduce ? 250 : 600, STAGGER = reduce ? 0 : 70;

  /** Works out the half circle, turned to face wherever the camera is now. */
  function computeFan() {
    const center = new THREE.Vector3(...fanOffset);
    const camLocal = group.current.worldToLocal(camera.position.clone());
    const to = camLocal.sub(center);
    const yaw = Math.atan2(to.x, to.z);
    const pitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
    const qFace = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch * 0.6, yaw, 0, 'YXZ'));
    const qUp = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2); // lying → standing, photo facing +z
    return photos.map((_, i) => {
      const th = Math.PI * (n === 1 ? 0.5 : 0.12 + (0.76 * i) / (n - 1));
      const local = new THREE.Vector3(-Math.cos(th) * radius, Math.sin(th) * radius - radius * 0.45, i * 0.002);
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (Math.PI / 2 - th) * 0.75);
      return { pos: local.applyQuaternion(qFace).add(center), quat: qFace.clone().multiply(tilt).multiply(qUp) };
    });
  }

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return;
    const s = st.current, now = performance.now();
    if (s.mode === 'stack') {
      s.fan = computeFan(); s.mode = 'open'; s.openAt = now; s.closeAt = now + OUT + STAGGER * n + holdMs;
      onHoverChange?.('Polaroids · click to stack them back');
    } else if (s.mode === 'open') { s.mode = 'closing'; s.closeStart = now; }
  };

  const tmpP = useMemo(() => new THREE.Vector3(), []), tmpQ = useMemo(() => new THREE.Quaternion(), []);
  useFrame(() => {
    const s = st.current, now = performance.now();
    if (s.mode === 'open' && now > s.closeAt) { s.mode = 'closing'; s.closeStart = now; }
    let allHome = true;
    for (let i = 0; i < n; i++) {
      const c = cards.current[i]; if (!c) continue;
      let p = 0, e = 0;
      if (s.mode === 'open') { p = THREE.MathUtils.clamp((now - s.openAt - i * STAGGER) / OUT, 0, 1); e = reduce ? easeInOut(p) : easeOutBack(p); }
      else if (s.mode === 'closing') { const q = THREE.MathUtils.clamp((now - s.closeStart - (n - 1 - i) * STAGGER) / BACK, 0, 1); p = 1 - q; e = easeInOut(p); if (q < 1) allHome = false; }
      if (p === 0 || !s.fan[i]) { c.position.copy(stack[i].pos); c.quaternion.copy(stack[i].quat); continue; }
      tmpP.lerpVectors(stack[i].pos, s.fan[i].pos, e);
      tmpP.y += Math.sin(Math.PI * p) * 0.03;                      // a little arc through the air
      tmpQ.slerpQuaternions(stack[i].quat, s.fan[i].quat, THREE.MathUtils.clamp(e, 0, 1));
      c.position.copy(tmpP); c.quaternion.copy(tmpQ);
    }
    if (s.mode === 'closing' && allHome) s.mode = 'stack';
  });

  const hoverLabel = (i: number) => (st.current.mode === 'stack' ? 'Polaroids · click to spread them out' : photos[i]?.caption?.replace(/^\[|\]$/g, '') || 'Polaroid');

  return (
    <group ref={group} position={position}>
      {photos.map((p, i) => { const c = cardSpec(p); return (
        <group
          key={i}
          ref={(el) => { cards.current[i] = el; }}
          onClick={onClick}
          onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; onHoverChange?.(hoverLabel(i)); }}
          onPointerOut={() => { document.body.style.cursor = 'auto'; onHoverChange?.(null); }}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[c.w, CT, c.h]} />
            <meshStandardMaterial color="#FBF9F4" roughness={0.6} />
          </mesh>
          <mesh position-y={CT / 2 + 0.0002} rotation-x={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[c.w, c.h]} />
            <meshStandardMaterial map={faces[i].tex} roughness={0.45} />
          </mesh>
        </group>
      ); })}
    </group>
  );
}
