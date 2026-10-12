'use client';
/**
 * NoteBoard · sticky notes pinned on the pink pegboard, shared by everyone.
 *
 * - Your own notes (`pinnedNotes`) are always there.
 * - Visitors click the little pad of blank notes, write something, pick a paper
 *   color and pin it. It flies onto the board and every other visitor sees it.
 * - Click any note to read it up close.
 * - New notes from other people show up on their own (checks every 15 s).
 *
 * Needs the API route in app/api/notes/route.ts (see NOTES-AND-POLAROIDS.md).
 * Units are meters. `position` is the centre of the pegboard's front face.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { createPortal } from 'react-dom';
import { NOTE_COLORS } from '../../lib/noteColors';

export type Note = { id: string; seq: number; text: string; color: string; name?: string; createdAt: number };
export type PinnedNote = { text: string; color?: string; name?: string };
export type NoteBoardProps = {
  position?: [number, number, number];
  /** Free spots on the board, [x, y] from the board centre. Notes fill these. */
  slots?: [number, number][];
  /** Where the pad of blank notes sits, [x, y] from the board centre. */
  padSlot?: [number, number];
  /** Your own notes. Always shown, in the first slots. */
  pinnedNotes?: PinnedNote[];
  endpoint?: string;
  pollMs?: number;
  /** Handwriting font (must be loaded on the page). */
  fontFamily?: string;
  onHoverChange?: (label: string | null) => void;
};

// Spots that miss the pen cup, mini shelf and "you got this" card in the prototype layout.
export const DEFAULT_SLOTS: [number, number][] = [
  [-0.21, 0.04], [0.11, 0.04], [-0.45, 0.04], [0.41, 0.04],
  [-0.45, 0.16], [-0.33, 0.16], [-0.21, 0.16], [-0.09, 0.16], [0.04, 0.16], [0.16, 0.16], [0.29, 0.16], [0.41, 0.16],
  [-0.45, -0.1], [-0.21, -0.1], [-0.08, -0.1], [0.16, -0.1], [0.41, -0.1],
];
const S = 0.075;                       // note size in meters
const TEX = 256;

function setSRGB(t: THREE.Texture) { const a = t as any; if ('colorSpace' in a) a.colorSpace = 'srgb'; else a.encoding = 3001; return t; }
function wrapLines(g: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = [];
  text.split('\n').forEach((para) => {
    let line = '';
    para.split(' ').forEach((w) => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
    out.push(line);
  });
  return out;
}
function paintNote(text: string, color: string, name: string | undefined, font: string, blank = false) {
  const c = document.createElement('canvas'); c.width = c.height = TEX; const g = c.getContext('2d')!;
  g.fillStyle = color; g.fillRect(0, 0, TEX, TEX);
  const glue = g.createLinearGradient(0, 0, 0, 40); glue.addColorStop(0, 'rgba(0,0,0,0.07)'); glue.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = glue; g.fillRect(0, 0, TEX, 40);
  for (let i = 0; i < 900; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.25)'; g.fillRect(Math.random() * TEX, Math.random() * TEX, 1.5, 1.5); }
  g.fillStyle = '#3A2E2B'; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (blank) { g.font = `600 40px ${font}`; g.fillText('leave a', TEX / 2, TEX / 2 - 22); g.fillText('note ♡', TEX / 2, TEX / 2 + 22); return c; }
  let size = 36, lines: string[] = [];
  for (; size >= 22; size -= 2) { g.font = `500 ${size}px ${font}`; lines = wrapLines(g, text, TEX - 44); if (lines.length * size * 1.05 <= TEX - (name ? 92 : 60)) break; }
  const lh = size * 1.05, top = (TEX - (name ? 34 : 0)) / 2 - ((lines.length - 1) * lh) / 2 + 6;
  lines.slice(0, 7).forEach((l, i) => g.fillText(l, TEX / 2, top + i * lh));
  if (name) { g.font = `500 26px ${font}`; g.textAlign = 'right'; g.fillStyle = '#6B5A55'; g.fillText('— ' + name, TEX - 22, TEX - 26); }
  return c;
}

let paperGeo: THREE.BufferGeometry | null = null;
function notePaper() {
  if (paperGeo) return paperGeo;
  const g = new THREE.PlaneGeometry(S, S, 8, 8), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), t = (S / 2 - y) / S, corner = Math.max(0, x / S + 0.5 - 0.55);
    p.setZ(i, t * t * 0.005 + corner * t * 0.012);   // bottom curls away from the board a little
  }
  g.computeVertexNormals(); return (paperGeo = g);
}
const rand = (seed: number) => { const r = Math.sin(seed * 12.9898) * 43758.5453; return r - Math.floor(r); };

type Placed = { key: string; note?: Note; pinned?: PinnedNote; slot: [number, number] };

export default function NoteBoard({
  position = [0.02, 1.17, 0.016],
  slots = DEFAULT_SLOTS,
  padSlot = [0.05, -0.17],
  pinnedNotes = [{ text: 'welcome in! leave me a little note', name: 'Kriti', color: NOTE_COLORS[1] }],
  endpoint = '/api/notes',
  pollMs = 15000,
  fontFamily = '"Caveat", "Segoe Print", cursive',
  onHoverChange,
}: NoteBoardProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [fontV, setFontV] = useState(0);
  const [overlay, setOverlay] = useState<null | { mode: 'write' } | { mode: 'read'; text: string; name?: string; color: string; when?: number }>(null);
  const fresh = useRef<string | null>(null);

  // load notes, then keep checking for new ones while the tab is visible
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try { const r = await fetch(endpoint, { cache: 'no-store' }); if (!r.ok) return; const j = await r.json(); if (alive && Array.isArray(j.notes)) setNotes(j.notes); } catch { /* offline: keep what we have */ }
    };
    load(); const id = setInterval(load, pollMs);
    (document as any).fonts?.load?.(`36px ${fontFamily}`).then(() => alive && setFontV((v) => v + 1)).catch(() => {});
    return () => { alive = false; clearInterval(id); };
  }, [endpoint, pollMs, fontFamily]);

  // pinned notes take the first slots; visitor notes keep a stable slot each
  const placed: Placed[] = useMemo(() => {
    const out: Placed[] = pinnedNotes.slice(0, slots.length).map((p, i) => ({ key: 'pin' + i, pinned: p, slot: slots[i] }));
    const free = slots.slice(out.length); if (!free.length) return out;
    const visible = [...notes].sort((a, b) => a.seq - b.seq).slice(-free.length);
    const used = new Set<number>();
    visible.forEach((n) => { let k = n.seq % free.length; while (used.has(k)) k = (k + 1) % free.length; used.add(k); out.push({ key: n.id, note: n, slot: free[k] }); });
    return out;
  }, [notes, pinnedNotes, slots]);

  const hover = (l: string | null) => { if (typeof document !== 'undefined') document.body.style.cursor = l ? 'pointer' : 'auto'; onHoverChange?.(l); };

  return (
    <group position={position}>
      {placed.map((p) => (
        <StickyNote
          key={p.key}
          id={p.key}
          text={p.note?.text ?? p.pinned!.text}
          name={p.note?.name ?? p.pinned?.name}
          color={p.note?.color ?? p.pinned?.color ?? NOTE_COLORS[0]}
          slot={p.slot}
          from={fresh.current === p.key ? padSlot : null}
          font={fontFamily}
          fontV={fontV}
          onHover={(on) => hover(on ? `Note${(p.note?.name ?? p.pinned?.name) ? ' from ' + (p.note?.name ?? p.pinned?.name) : ''} · click to read` : null)}
          onOpen={() => setOverlay({ mode: 'read', text: p.note?.text ?? p.pinned!.text, name: p.note?.name ?? p.pinned?.name, color: p.note?.color ?? p.pinned?.color ?? NOTE_COLORS[0], when: p.note?.createdAt })}
        />
      ))}
      <NotePad slot={padSlot} font={fontFamily} fontV={fontV} onHover={(on) => hover(on ? 'Leave a note on the board' : null)} onOpen={() => setOverlay({ mode: 'write' })} />
      {overlay && (
        <Html>
          <ToBody>
          {overlay.mode === 'write' ? (
            <WriteNote
              endpoint={endpoint}
              font={fontFamily}
              onClose={() => setOverlay(null)}
              onPinned={(n) => { fresh.current = n.id; setNotes((list) => [...list.filter((x) => x.id !== n.id), n]); setOverlay(null); }}
            />
          ) : (
            <ReadNote {...overlay} font={fontFamily} onClose={() => setOverlay(null)} />
          )}
          </ToBody>
        </Html>
      )}
    </group>
  );
}

/* ---------------- one sticky note in 3D ---------------- */
function StickyNote({ id, text, name, color, slot, from, font, fontV, onHover, onOpen }: {
  id: string; text: string; name?: string; color: string; slot: [number, number]; from: [number, number] | null;
  font: string; fontV: number; onHover: (on: boolean) => void; onOpen: () => void;
}) {
  const g = useRef<THREE.Group>(null!);
  const tex = useMemo(() => setSRGB(new THREE.CanvasTexture(paintNote(text, color, name, font))), [text, color, name, font, fontV]);
  useEffect(() => () => tex.dispose(), [tex]);
  const seed = useMemo(() => [...id].reduce((a, c) => a + c.charCodeAt(0), 0), [id]);
  const rot = (rand(seed) - 0.5) * 0.18;
  const born = useRef(performance.now() + (from ? 0 : rand(seed + 1) * 400));
  const wob = useRef(0);

  useFrame(() => {
    const t = Math.min(1, Math.max(0, (performance.now() - born.current) / (from ? 700 : 450)));
    const e = 1 - Math.pow(1 - t, 3);
    const x = from ? THREE.MathUtils.lerp(from[0], slot[0], e) : slot[0];
    const y = from ? THREE.MathUtils.lerp(from[1], slot[1], e) : slot[1];
    const lift = from ? Math.sin(Math.PI * t) * 0.06 : 0;
    wob.current *= 0.9;
    g.current.position.set(x, y, 0.002 + lift);
    g.current.rotation.z = rot + Math.sin(performance.now() / 60) * 0.04 * wob.current;
    g.current.scale.setScalar(from ? 1 + Math.sin(Math.PI * t) * 0.25 : 0.6 + 0.4 * e);
  });

  return (
    <group
      ref={g}
      position={[slot[0], slot[1], 0.002]}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.delta > 6) return; wob.current = 1; onOpen(); }}
      onPointerOver={(e) => { e.stopPropagation(); onHover(true); }}
      onPointerOut={() => onHover(false)}
    >
      <mesh geometry={notePaper()} castShadow receiveShadow>
        <meshStandardMaterial map={tex} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, S / 2 - 0.009, 0.005]} castShadow>
        <sphereGeometry args={[0.0055, 16, 12]} />
        <meshStandardMaterial color="#E58FA0" roughness={0.35} />
      </mesh>
    </group>
  );
}

/* ---------------- the pad of blank notes ---------------- */
function NotePad({ slot, font, fontV, onHover, onOpen }: { slot: [number, number]; font: string; fontV: number; onHover: (on: boolean) => void; onOpen: () => void }) {
  const top = useMemo(() => setSRGB(new THREE.CanvasTexture(paintNote('', NOTE_COLORS[0], undefined, font, true))), [font, fontV]);
  const g = useRef<THREE.Group>(null!), bump = useRef(0);
  useFrame((s) => { bump.current *= 0.9; g.current.scale.setScalar(1 + Math.sin(s.clock.elapsedTime * 2) * 0.012 + bump.current * 0.08); });
  return (
    <group
      ref={g}
      position={[slot[0], slot[1], 0.004]}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.delta > 6) return; bump.current = 1; onOpen(); }}
      onPointerOver={(e) => { e.stopPropagation(); onHover(true); }}
      onPointerOut={() => onHover(false)}
    >
      {[NOTE_COLORS[2], NOTE_COLORS[1]].map((c, i) => (
        <mesh key={c} position={[0.003 * (i + 1), -0.003 * (i + 1), -0.001 * (i + 1)]} rotation-z={0.06 * (i + 1)}>
          <planeGeometry args={[S, S]} />
          <meshStandardMaterial color={c} roughness={0.85} />
        </mesh>
      ))}
      <mesh geometry={notePaper()} castShadow>
        <meshStandardMaterial map={top} roughness={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, S / 2 - 0.009, 0.005]}>
        <sphereGeometry args={[0.0055, 16, 12]} />
        <meshStandardMaterial color="#C9A46A" metalness={0.6} roughness={0.35} />
      </mesh>
    </group>
  );
}

/* ---------------- overlays (plain DOM on top of the canvas) ---------------- */
/** Renders its children straight into <body>, so the overlay covers the whole screen. */
function ToBody({ children }: { children: ReactNode }) {
  return typeof document === 'undefined' ? null : createPortal(children, document.body);
}
const ink = '#3A2E2B';
const backdrop: CSSProperties = { position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(58,46,43,0.28)', fontFamily: 'system-ui, sans-serif', color: ink };
const btn: CSSProperties = { minHeight: 44, padding: '0 18px', borderRadius: 6, border: '1px solid rgba(58,46,43,0.2)', background: 'transparent', color: ink, font: '500 15px system-ui, sans-serif', cursor: 'pointer' };

function useEsc(onClose: () => void) {
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f); }, [onClose]);
}

function WriteNote({ endpoint, font, onClose, onPinned }: { endpoint: string; font: string; onClose: () => void; onPinned: (n: Note) => void }) {
  const [text, setText] = useState(''), [name, setName] = useState(''), [color, setColor] = useState<string>(NOTE_COLORS[0]);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEsc(onClose);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (!text.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, name, color }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.note) { setError(j.error || 'Couldn’t pin your note. Try again in a moment.'); setBusy(false); return; }
      onPinned(j.note as Note);
    } catch { setError('You seem to be offline. Try again in a moment.'); setBusy(false); }
  };
  return (
    <div style={backdrop} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="nb-title" onSubmit={submit}
        style={{ width: 'min(360px, 100%)', background: color, borderRadius: 4, padding: '22px 22px 18px', boxShadow: '0 24px 60px -20px rgba(58,46,43,0.55)', transform: 'rotate(-1deg)', display: 'grid', gap: 10 }}>
        <h2 id="nb-title" style={{ margin: 0, font: `600 30px ${font}`, color: ink }}>Leave a note</h2>
        <p style={{ margin: 0, fontSize: 14, color: '#6B5A55' }}>It gets pinned on the board for everyone who visits.</p>
        <label htmlFor="nb-text" style={{ fontSize: 13, fontWeight: 500 }}>Your note</label>
        <textarea id="nb-text" autoFocus required maxLength={120} rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="say hi, share a thought, wish her luck…"
          style={{ resize: 'none', border: '1px solid rgba(58,46,43,0.18)', borderRadius: 4, background: 'rgba(255,255,255,0.55)', padding: '8px 10px', font: `500 24px/1.15 ${font}`, color: ink }} />
        <div style={{ fontSize: 12, color: '#6B5A55', textAlign: 'right', marginTop: -6 }}>{text.length}/120</div>
        <label htmlFor="nb-name" style={{ fontSize: 13, fontWeight: 500 }}>Your name (optional)</label>
        <input id="nb-name" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname"
          style={{ minHeight: 40, border: '1px solid rgba(58,46,43,0.18)', borderRadius: 4, background: 'rgba(255,255,255,0.55)', padding: '0 10px', font: '500 15px system-ui, sans-serif', color: ink }} />
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <legend style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Paper</legend>
          {NOTE_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Paper color ${c}`} aria-pressed={c === color} onClick={() => setColor(c)}
              style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: c === color ? `2px solid ${ink}` : '1px solid rgba(58,46,43,0.25)', cursor: 'pointer' }} />
          ))}
        </fieldset>
        {error && <p role="alert" style={{ margin: 0, fontSize: 14, color: '#8A3B3B' }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={btn}>Cancel</button>
          <button type="submit" disabled={!text.trim() || busy} style={{ ...btn, background: ink, color: '#FFFBF8', border: 0, opacity: !text.trim() || busy ? 0.5 : 1 }}>{busy ? 'Pinning…' : 'Pin it'}</button>
        </div>
      </form>
    </div>
  );
}

function ReadNote({ text, name, color, when, font, onClose }: { text: string; name?: string; color: string; when?: number; font: string; onClose: () => void }) {
  useEsc(onClose);
  return (
    <div style={backdrop} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }} onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Note"
        style={{ width: 'min(320px, 100%)', aspectRatio: '1 / 1', background: color, borderRadius: 3, padding: 26, boxSizing: 'border-box', boxShadow: '0 24px 60px -20px rgba(58,46,43,0.55)', transform: 'rotate(1.5deg)', display: 'flex', flexDirection: 'column' }}>
        <p style={{ margin: 'auto 0', font: `500 30px/1.15 ${font}`, color: ink, textAlign: 'center', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{text}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#6B5A55' }}>{when ? new Date(when).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''}</span>
          {name && <span style={{ font: `500 22px ${font}`, color: '#6B5A55' }}>— {name}</span>}
        </div>
        <button type="button" autoFocus onClick={onClose} style={{ ...btn, marginTop: 12, alignSelf: 'center' }}>Close</button>
      </div>
    </div>
  );
}
