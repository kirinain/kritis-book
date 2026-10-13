'use client';
/**
 * ShelfBooks · the four books on the lower shelf, now with real titles
 * printed on their spines. Click one and it tilts out, like before.
 *
 * Spines read top to bottom (the normal English way). Text is drawn on a
 * canvas with the same fonts as Kiti's Book (Fraunces + DM Sans), and
 * re-drawn once the fonts finish loading so it never shows a fallback font.
 *
 * Units are meters. `position` is the spot on the shelf under the
 * front-left corner of the first book's spine. Books line up to the right.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';

export type SpineStyle = 'classic' | 'stars' | 'modern' | 'twoLine';

export type ShelfBook = {
  /** Main title. For 'twoLine', this is the first (bigger) line. */
  title: string;
  /** Second, smaller title line ('twoLine' only). */
  subtitle?: string;
  author?: string;
  /** Spine thickness, height, depth in meters. */
  w: number;
  h: number;
  d?: number;
  /** Cloth color and text color. */
  color: string;
  ink: string;
  /** Small accent (rules, stars, band). */
  accent?: string;
  style?: SpineStyle;
  /** Gap before this book, meters (default 0.004). */
  gap?: number;
};

/** The titles Kiti asked for, in the nook's own colors. */
export const KITI_SHELF: ShelfBook[] = [
  { title: 'The Book Thief', author: 'Markus Zusak', w: 0.028, h: 0.235, color: '#F5F2EC', ink: '#3E1719', accent: '#B3201E', style: 'classic' },
  { title: 'The Fault in Our Stars', author: 'John Green', w: 0.03, h: 0.25, color: '#E7B7B3', ink: '#2B3350', accent: '#FFFDF8', style: 'stars' },
  { title: 'The Brain That Changes Itself', author: 'Norman Doidge', w: 0.03, h: 0.24, color: '#DAD7D3', ink: '#2A2620', accent: '#9DB39A', style: 'modern' },
  { title: 'Harry Potter', subtitle: 'and the Cursed Child', author: 'Rowling · Tiffany · Thorne', w: 0.026, h: 0.22, color: '#F3EFE8', ink: '#6B1F24', accent: '#C9A46A', style: 'twoLine' },
];

export type ShelfBooksProps = {
  position?: [number, number, number];
  books?: ShelfBook[];
  onHoverChange?: (label: string | null) => void;
};

const PX = 5600;                       // canvas pixels per meter of spine
const FONTS = ['600 40px "Fraunces"', 'italic 500 40px "Fraunces"', '500 40px "Fraunces"', '500 20px "DM Sans"', '700 20px "DM Sans"'];

function setSRGB(t: THREE.Texture) { const a = t as any; if ('colorSpace' in a) a.colorSpace = 'srgb'; else a.encoding = 3001; return t; }

/** Largest font size (<= max) at which `text` fits inside `room` pixels. */
function fit(g: CanvasRenderingContext2D, text: string, font: (s: number) => string, max: number, room: number, spacing = 0) {
  let s = max;
  for (; s > 6; s -= 0.5) {
    g.font = font(s);
    const w = g.measureText(text).width + spacing * s * Math.max(0, text.length - 1);
    if (w <= room) break;
  }
  g.font = font(s);
  return s;
}

/** Draws text with letter spacing (canvas letterSpacing isn't everywhere yet). */
function spaced(g: CanvasRenderingContext2D, text: string, cx: number, cy: number, em: number) {
  if (!em) { g.textAlign = 'center'; g.fillText(text, cx, cy); return; }
  const size = parseFloat(g.font.match(/(\d+(\.\d+)?)px/)?.[1] ?? '20');
  const gap = em * size;
  const total = [...text].reduce((a, ch) => a + g.measureText(ch).width, 0) + gap * (text.length - 1);
  let x = cx - total / 2; g.textAlign = 'left';
  for (const ch of text) { g.fillText(ch, x, cy); x += g.measureText(ch).width + gap; }
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}

/** Paints one spine. The canvas is the spine seen from the front (narrow and tall). */
export function drawSpine(c: HTMLCanvasElement, b: ShelfBook) {
  const W = Math.round(b.w * PX), H = Math.round(b.h * PX);
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = b.color; g.fillRect(0, 0, W, H);

  // soft cloth grain so it doesn't look flat
  for (let i = 0; i < 900; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.035)';
    g.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 1);
  }
  // rounded edge shading on both sides
  const sh = g.createLinearGradient(0, 0, W, 0);
  sh.addColorStop(0, 'rgba(0,0,0,.10)'); sh.addColorStop(0.18, 'rgba(0,0,0,0)'); sh.addColorStop(0.82, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.10)');
  g.fillStyle = sh; g.fillRect(0, 0, W, H);

  // work in "spine space": x runs top to bottom along the spine, y across it
  g.save(); g.translate(W, 0); g.rotate(Math.PI / 2);
  const L = H, T = W, mid = T / 2;            // length along spine, thickness across
  const acc = b.accent ?? b.ink;
  g.fillStyle = b.ink; g.strokeStyle = b.ink; g.textBaseline = 'middle';

  const style = b.style ?? 'classic';
  let titleFrom = 0.1 * L, titleTo = 0.7 * L, authorFrom = 0.74 * L;
  const authorTo = 0.93 * L;
  if (style === 'twoLine') { titleFrom = 0.09 * L; titleTo = 0.6 * L; authorFrom = 0.67 * L; }

  if (style === 'classic') {
    // thin double rules near both ends
    g.strokeStyle = acc; g.lineWidth = 2;
    for (const x of [0.05 * L, 0.06 * L, 0.94 * L, 0.95 * L]) { g.beginPath(); g.moveTo(x, T * 0.2); g.lineTo(x, T * 0.8); g.stroke(); }
    g.fillStyle = acc; g.beginPath(); g.arc(0.715 * L, mid, T * 0.05, 0, Math.PI * 2); g.fill();
  } else if (style === 'stars') {
    g.fillStyle = acc;
    star(g, 0.055 * L, mid, T * 0.14); star(g, 0.04 * L, mid - T * 0.22, T * 0.07); star(g, 0.075 * L, mid + T * 0.24, T * 0.06);
    star(g, 0.715 * L, mid, T * 0.07);
  } else if (style === 'modern') {
    // a sage band at the top
    g.fillStyle = acc; g.fillRect(0, 0, 0.075 * L, T);
    g.fillStyle = b.ink; g.fillRect(0.075 * L, 0, 3, T);
    titleFrom = 0.11 * L;
  } else if (style === 'twoLine') {
    g.strokeStyle = acc; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0.045 * L, T * 0.2); g.lineTo(0.045 * L, T * 0.8); g.stroke();
    g.beginPath(); g.moveTo(0.955 * L, T * 0.2); g.lineTo(0.955 * L, T * 0.8); g.stroke();
    g.fillStyle = acc; g.save(); g.translate(0.635 * L, mid); g.rotate(Math.PI / 4); g.fillRect(-T * 0.045, -T * 0.045, T * 0.09, T * 0.09); g.restore();
  }

  // title
  g.fillStyle = b.ink;
  const room = titleTo - titleFrom, cx = (titleFrom + titleTo) / 2;
  if (style === 'twoLine' && b.subtitle) {
    fit(g, b.title, s => `600 ${s}px "Fraunces", Georgia, serif`, T * 0.36, room);
    g.textAlign = 'center'; g.fillText(b.title, cx, mid - T * 0.17);
    fit(g, b.subtitle, s => `italic 500 ${s}px "Fraunces", Georgia, serif`, T * 0.25, room);
    g.fillText(b.subtitle, cx, mid + T * 0.2);
  } else if (style === 'modern') {
    const t = b.title.toUpperCase();
    fit(g, t, s => `700 ${s}px "DM Sans", system-ui, sans-serif`, T * 0.34, room, 0.08);
    spaced(g, t, cx, mid + 1, 0.08);
  } else if (style === 'stars') {
    fit(g, b.title, s => `500 ${s}px "Fraunces", Georgia, serif`, T * 0.42, room);
    g.textAlign = 'center'; g.fillText(b.title, cx, mid + 1);
  } else {
    fit(g, b.title, s => `italic 500 ${s}px "Fraunces", Georgia, serif`, T * 0.46, room);
    g.textAlign = 'center'; g.fillText(b.title, cx, mid + 1);
  }

  // author
  if (b.author) {
    const a = b.author.toUpperCase();
    g.fillStyle = b.ink; g.globalAlpha = 0.85;
    fit(g, a, s => `500 ${s}px "DM Sans", system-ui, sans-serif`, T * 0.2, authorTo - authorFrom, 0.12);
    spaced(g, a, (authorFrom + authorTo) / 2, mid + 1, 0.12);
    g.globalAlpha = 1;
  }
  g.restore();
}

function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    if (typeof document === 'undefined' || !document.fonts) { setReady(true); return; }
    Promise.all(FONTS.map(f => document.fonts.load(f).catch(() => null)))
      .then(() => document.fonts.ready)
      .finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);
  return ready;
}

function Book({ b, x, fontsReady, onHoverChange }: { b: ShelfBook; x: number; fontsReady: boolean; onHoverChange?: (l: string | null) => void }) {
  const pivot = useRef<THREE.Group>(null);
  const tilt = useRef(0);
  const d = b.d ?? 0.16;
  const label = `${b.subtitle ? `${b.title} ${b.subtitle}` : b.title} · tilt it out`;

  const tex = useMemo(() => {
    const t = setSRGB(new THREE.CanvasTexture(document.createElement('canvas')));
    t.anisotropy = 8;
    return t;
  }, []);
  useEffect(() => { drawSpine(tex.image as HTMLCanvasElement, b); tex.needsUpdate = true; }, [tex, b, fontsReady]);
  useEffect(() => () => tex.dispose(), [tex]);

  useFrame(() => {
    if (!pivot.current) return;
    tilt.current *= 0.95;
    pivot.current.rotation.x = Math.sin(tilt.current * Math.PI) * 0.35;
  });

  const click = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.delta > 6) return; tilt.current = 1; };

  return (
    <group ref={pivot} position={[x + b.w / 2, 0, 0]}>
      <group
        onClick={click}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; onHoverChange?.(label); }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; onHoverChange?.(null); }}
      >
        <RoundedBox args={[b.w, b.h, d]} radius={0.003} smoothness={3} position={[0, b.h / 2, -d / 2]} castShadow receiveShadow>
          <meshStandardMaterial color={b.color} roughness={0.75} />
        </RoundedBox>
        {/* the printed spine, a hair in front of the cloth */}
        <mesh position={[0, b.h / 2, 0.0004]}>
          <planeGeometry args={[b.w - 0.0024, b.h - 0.0024]} />
          <meshStandardMaterial map={tex} roughness={0.78} polygonOffset polygonOffsetFactor={-1} />
        </mesh>
      </group>
    </group>
  );
}

export default function ShelfBooks({ position = [-0.544, 1.567, 0.2], books = KITI_SHELF, onHoverChange }: ShelfBooksProps) {
  const fontsReady = useFontsReady();
  let x = 0;
  const xs = books.map((b, i) => { if (i) x += b.gap ?? 0.004; const at = x; x += b.w; return at; });
  return (
    <group position={position}>
      {books.map((b, i) => <Book key={b.title + i} b={b} x={xs[i]} fontsReady={fontsReady} onHoverChange={onHoverChange} />)}
    </group>
  );
}
