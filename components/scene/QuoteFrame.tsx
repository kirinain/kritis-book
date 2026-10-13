'use client';
/**
 * QuoteFrame · a pink framed print that leans on a shelf, with a quote on it.
 * Click it and it swings a little, like the other frames.
 *
 * Default quote: "what's meant for you will find its way back to you".
 * It replaces the old "Dream Plan Do" frame on the top shelf.
 *
 * Text is drawn on a canvas with Fraunces, DM Sans and Caveat (already loaded
 * for Kiti's Book) and redrawn once those fonts finish loading.
 * Units are meters. `position` is the spot on the shelf under the frame.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';

export type QuoteLine = {
  text: string;
  /** serif = Fraunces italic, caps = small spaced DM Sans, hand = Caveat. */
  look: 'serif' | 'caps' | 'hand';
  /** Gap above this line, as a share of the print height. */
  gap?: number;
};

export const MEANT_FOR_YOU: QuoteLine[] = [
  { text: 'what’s meant', look: 'serif' },
  { text: 'for you', look: 'serif', gap: 0.005 },
  { text: 'will find its way', look: 'caps', gap: 0.075 },
  { text: 'back to you', look: 'hand', gap: 0.025 },
];

export type QuoteFrameProps = {
  position?: [number, number, number];
  /** Frame width and height, meters. */
  size?: [number, number];
  /** How far it leans back against the wall, radians. */
  lean?: number;
  lines?: QuoteLine[];
  /** Shown on hover. */
  label?: string;
  frameColor?: string;
  onHoverChange?: (label: string | null) => void;
};

const FONTS = ['italic 500 60px "Fraunces"', '600 30px "DM Sans"', '600 60px "Caveat"'];
const INK = '#2E2523', ACCENT = '#8A4A50', ROSE = '#D9A39B';

function setSRGB(t: THREE.Texture) { const a = t as any; if ('colorSpace' in a) a.colorSpace = 'srgb'; else a.encoding = 3001; return t; }

function heart(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.beginPath(); g.moveTo(x, y + s);
  g.bezierCurveTo(x - s * 2, y - s * 0.4, x - s * 0.6, y - s * 1.8, x, y - s * 0.6);
  g.bezierCurveTo(x + s * 0.6, y - s * 1.8, x + s * 2, y - s * 0.4, x, y + s); g.fill();
}
function sparkle(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.beginPath(); g.moveTo(x, y - s); g.quadraticCurveTo(x, y, x + s, y); g.quadraticCurveTo(x, y, x, y + s);
  g.quadraticCurveTo(x, y, x - s, y); g.quadraticCurveTo(x, y, x, y - s); g.fill();
}
function spaced(g: CanvasRenderingContext2D, text: string, cx: number, y: number, gap: number) {
  const total = [...text].reduce((a, ch) => a + g.measureText(ch).width, 0) + gap * (text.length - 1);
  let x = cx - total / 2; g.textAlign = 'left';
  for (const ch of text) { g.fillText(ch, x, y); x += g.measureText(ch).width + gap; }
  g.textAlign = 'center';
}

/** Paints the print. 840 x 1040 px, the same shape as the old frame art. */
export function drawQuoteArt(c: HTMLCanvasElement, lines: QuoteLine[]) {
  const W = 840, H = 1040; c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#FBF5F1'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 6000; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.3)'; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }

  // measure the block first so it sits in the middle
  const size = (l: QuoteLine) => (l.look === 'serif' ? 104 : l.look === 'caps' ? 34 : 124);
  const font = (l: QuoteLine, s: number) =>
    l.look === 'serif' ? `italic 500 ${s}px "Fraunces", Georgia, serif`
      : l.look === 'caps' ? `600 ${s}px "DM Sans", system-ui, sans-serif`
        : `600 ${s}px "Caveat", "Segoe Print", cursive`;
  const fitted = lines.map((l) => {
    let s = size(l); const t = l.look === 'caps' ? l.text.toUpperCase() : l.text;
    for (; s > 20; s -= 2) { g.font = font(l, s); const gap = l.look === 'caps' ? s * 0.22 : 0; if (g.measureText(t).width + gap * (t.length - 1) <= W * 0.78) break; }
    return { l, t, s };
  });
  const blockH = fitted.reduce((a, f) => a + f.s * 1.05 + (f.l.gap ?? 0) * H, 0);
  let y = (H - blockH) / 2 + 20;

  g.fillStyle = ROSE; sparkle(g, W / 2, y - 70, 20); sparkle(g, W / 2 - 52, y - 46, 9); sparkle(g, W / 2 + 50, y - 50, 11);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  fitted.forEach((f, i) => {
    y += (f.l.gap ?? 0) * H;
    // a thin rule with a diamond between the serif part and the rest
    if (f.l.look === 'caps' && i > 0 && fitted[i - 1].l.look === 'serif') {
      const ry = y - (f.l.gap ?? 0) * H * 0.45;
      g.fillStyle = ROSE; g.fillRect(W / 2 - 120, ry, 92, 3); g.fillRect(W / 2 + 28, ry, 92, 3);
      g.save(); g.translate(W / 2, ry + 1.5); g.rotate(Math.PI / 4); g.fillRect(-8, -8, 16, 16); g.restore();
    }
    y += f.s * (f.l.look === 'caps' ? 1 : 0.92);
    g.font = font(f.l, f.s);
    g.fillStyle = f.l.look === 'hand' ? ACCENT : INK;
    if (f.l.look === 'caps') spaced(g, f.t, W / 2, y, f.s * 0.22); else g.fillText(f.t, W / 2, y);
    y += f.s * 0.13;
  });
  g.fillStyle = ROSE; heart(g, W / 2, y + 70, 15);
}

function useFontsReady() {
  const [v, setV] = useState(0);
  useEffect(() => {
    let alive = true;
    if (typeof document === 'undefined' || !document.fonts) return;
    Promise.all(FONTS.map((f) => document.fonts.load(f).catch(() => null))).then(() => alive && setV(1));
    return () => { alive = false; };
  }, []);
  return v;
}

export default function QuoteFrame({
  position = [-0.15, 1.967, 0.05],
  size = [0.21, 0.27],
  lean = 0.08,
  lines = MEANT_FOR_YOU,
  label = '“what’s meant for you will find its way back to you” · give it a nudge',
  frameColor = '#E4AFA7',
  onHoverChange,
}: QuoteFrameProps) {
  const [w, h] = size;
  const inner = useRef<THREE.Group>(null!);
  const swing = useRef(0);
  const fontsV = useFontsReady();

  const tex = useMemo(() => { const t = setSRGB(new THREE.CanvasTexture(document.createElement('canvas'))); t.anisotropy = 8; return t; }, []);
  useEffect(() => { drawQuoteArt(tex.image as HTMLCanvasElement, lines); tex.needsUpdate = true; }, [tex, lines, fontsV]);
  useEffect(() => () => tex.dispose(), [tex]);

  useFrame((s) => { swing.current *= 0.96; inner.current.rotation.z = Math.sin(s.clock.elapsedTime * 11) * 0.06 * swing.current; });

  return (
    <group
      position={position}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.delta > 6) return; swing.current = 1; }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; onHoverChange?.(label); }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; onHoverChange?.(null); }}
    >
      <group rotation-x={-lean}>
        <group ref={inner}>
          <RoundedBox args={[w, h, 0.02]} radius={0.004} smoothness={3} position={[0, h / 2, 0]} castShadow receiveShadow>
            <meshStandardMaterial color={frameColor} roughness={0.55} />
          </RoundedBox>
          <mesh position={[0, h / 2, 0.0105]} receiveShadow>
            <planeGeometry args={[w - 0.03, h - 0.03]} />
            <meshStandardMaterial map={tex} roughness={0.7} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
