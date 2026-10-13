'use client';
/**
 * DeskSpeaker · a small cream-and-pink speaker that sits next to the book.
 * Tap it to play, tap again to pause. Tap again later and it carries on from
 * exactly where it stopped. While playing, the woofer moves with the music,
 * the light on top glows and little music notes float up.
 *
 * Music: the track lives in /public/music (default: secret-of-us-piano.mp3).
 * - It only starts after a tap (browsers block sound before that).
 * - It fades in on play and fades out on pause.
 * - It loops, and remembers where you were, even after a page reload.
 * - On phones, the lock screen shows the track with play/pause.
 * Pass `onToggle` to know when it starts or stops (e.g. to show a "now playing" chip).
 *
 * Units are meters. `position` is the spot on the desk under the speaker.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';

export type DeskSpeakerProps = {
  position?: [number, number, number];
  /** Which way the front faces, in radians (0 = toward +z, the viewer). */
  facing?: number;
  /** Audio file to play. Default: /music/secret-of-us-piano.mp3 */
  src?: string;
  /** Shown on the phone lock screen while it plays. */
  title?: string;
  volume?: number;
  /** Control it from outside. Leave undefined to let the speaker manage itself. */
  playing?: boolean;
  onToggle?: (playing: boolean) => void;
  bodyColor?: string;
  fabricColor?: string;
  onHoverChange?: (label: string | null) => void;
};

const W = 0.105, H = 0.13, D = 0.085;

function srgb<T extends THREE.Texture>(t: T): T {
  const anyT = t as any;
  if ('colorSpace' in anyT) anyT.colorSpace = 'srgb'; else anyT.encoding = 3001; // sRGB on old and new three
  return t;
}
function knitTexture(color: string) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
  g.fillStyle = color; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < 256; x += 4) {
    g.fillStyle = 'rgba(90,50,45,0.16)'; g.beginPath(); g.arc(x, y, 1.05, 0, Math.PI * 2); g.fill();
  }
  const t = srgb(new THREE.CanvasTexture(c)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
}
function noteTexture(glyph: string) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  g.fillStyle = '#C96F80'; g.font = '700 96px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(255,255,255,0.9)'; g.shadowBlur = 8; g.fillText(glyph, 64, 70);
  return srgb(new THREE.CanvasTexture(c));
}
function playIcon(playing: boolean) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  g.fillStyle = '#FBF8F4'; g.beginPath(); g.arc(64, 64, 64, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#C98C93';
  if (playing) { g.fillRect(44, 38, 14, 52); g.fillRect(70, 38, 14, 52); }
  else { g.beginPath(); g.moveTo(50, 36); g.lineTo(92, 64); g.lineTo(50, 92); g.closePath(); g.fill(); }
  return srgb(new THREE.CanvasTexture(c));
}

/* ------------------------------------------------------------------ */
/* one shared music player for the whole page                           */
/* (a remount of the speaker never starts a second copy of the song)    */
/* ------------------------------------------------------------------ */
type Music = {
  el: HTMLAudioElement; ctx?: AudioContext; gain?: GainNode; analyser?: AnalyserNode; buf?: Uint8Array;
  vol: number; play: () => Promise<void>; pause: () => void; setVolume: (v: number) => void;
};
let MUSIC: Music | null = null;
const listeners = new Set<(on: boolean) => void>();
const POS_KEY = 'kiti-music-pos';
const FADE_IN = 0.8, FADE_OUT = 0.45;

export function onMusicChange(fn: (on: boolean) => void) { listeners.add(fn); return () => listeners.delete(fn); }
/** The shared <audio> element, if music has been started (handy for a "now playing" UI). */
export function deskMusicElement() { return MUSIC?.el ?? null; }

function getDeskMusic(src: string, title: string, volume: number): Music | null {
  if (typeof window === 'undefined') return null;
  if (MUSIC && MUSIC.el.dataset.src === src) return MUSIC;
  MUSIC?.pause();
  const el = new Audio(); el.dataset.src = src; el.src = src; el.loop = true; el.preload = 'auto'; el.crossOrigin = 'anonymous';
  // pick up where the last visit left off
  let resumeAt = 0, restored = true;
  try { resumeAt = parseFloat(localStorage.getItem(POS_KEY) || '') || 0; } catch {}
  if (resumeAt > 1) {
    restored = false;
    const seek = () => { if (!restored && el.duration && resumeAt < el.duration - 5) { el.currentTime = resumeAt; } restored = true; };
    el.addEventListener('loadedmetadata', seek, { once: true });
  }
  const m: Music = { el, vol: volume, play: async () => {}, pause: () => {}, setVolume: () => {} };
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new Ctx();
    const node = ctx.createMediaElementSource(el), gain = ctx.createGain(), analyser = ctx.createAnalyser();
    gain.gain.value = 0; analyser.fftSize = 256;
    node.connect(gain); gain.connect(analyser); analyser.connect(ctx.destination);
    Object.assign(m, { ctx, gain, analyser, buf: new Uint8Array(analyser.fftSize) });
  } catch { el.volume = volume; /* no Web Audio: plain volume, no fades */ }

  let pauseTimer = 0;
  const ramp = (to: number, secs: number) => {
    if (!m.ctx || !m.gain) { el.volume = to; return; }
    const now = m.ctx.currentTime, gn = m.gain.gain;
    gn.cancelScheduledValues(now); gn.setValueAtTime(gn.value, now); gn.linearRampToValueAtTime(to, now + secs);
  };
  const savePos = () => { if (!restored) return; try { localStorage.setItem(POS_KEY, String(el.currentTime)); } catch {} };
  m.play = async () => {
    window.clearTimeout(pauseTimer);
    if (m.ctx && m.ctx.state !== 'running') await m.ctx.resume().catch(() => {});
    await el.play();
    ramp(m.vol, FADE_IN);
  };
  m.pause = () => {
    if (el.paused) return;
    ramp(0, FADE_OUT);
    window.clearTimeout(pauseTimer);
    pauseTimer = window.setTimeout(() => { el.pause(); savePos(); }, m.ctx ? FADE_OUT * 1000 + 30 : 0);
  };
  m.setVolume = (v) => { m.vol = v; if (!el.paused) ramp(v, 0.2); };

  el.addEventListener('play', () => listeners.forEach((f) => f(true)));
  el.addEventListener('pause', () => { savePos(); listeners.forEach((f) => f(false)); });
  let lastSave = 0;
  el.addEventListener('timeupdate', () => { if (Math.abs(el.currentTime - lastSave) >= 5) { lastSave = el.currentTime; savePos(); } });
  window.addEventListener('pagehide', savePos);

  // phone lock screen / headphone buttons
  const ms = (navigator as any).mediaSession;
  if (ms) {
    try {
      ms.metadata = new (window as any).MediaMetadata({ title, artist: 'Kiti’s Room', album: 'Kiti’s Book' });
      ms.setActionHandler('play', () => { m.play().catch(() => {}); });
      ms.setActionHandler('pause', () => m.pause());
    } catch {}
  }
  MUSIC = m;
  return m;
}

export default function DeskSpeaker({
  position = [0.33, 0.76, 0.42],
  facing = -0.35,
  src = '/music/secret-of-us-piano.mp3',
  title = 'The Secret of Us · calm piano',
  volume = 0.6,
  playing,
  onToggle,
  bodyColor = '#F7F2EC',
  fabricColor = '#E8BAB5',
  onHoverChange,
}: DeskSpeakerProps) {
  const [inner, setInner] = useState(false);
  const isPlaying = playing ?? inner;

  const bodyRef = useRef<THREE.Group>(null!);
  const cone = useRef<THREE.Mesh>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const led = useRef<THREE.MeshStandardMaterial>(null!);
  const notesRef = useRef<THREE.Group>(null!);
  const hovered = useRef(false);

  const fabric = useMemo(() => knitTexture(fabricColor), [fabricColor]);
  const icons = useMemo(() => ({ play: playIcon(false), pause: playIcon(true) }), []);
  const noteTex = useMemo(() => ['♪', '♫', '♪', '♬'].map(noteTexture), []);
  const coneGeo = useMemo(() => new THREE.LatheGeometry([[0.004, 0.0], [0.012, 0.002], [0.024, 0.006], [0.03, 0.009]].map(([x, y]) => new THREE.Vector2(x, y)), 40), []);
  const handleGeo = useMemo(() => new THREE.TorusGeometry(0.03, 0.0045, 10, 32, Math.PI), []);

  /* ---------- audio ---------- */
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const playNow = () => {
    const m = getDeskMusic(src, title, volume); if (!m) return;
    setStatus(m.el.readyState >= 3 ? 'idle' : 'loading');
    m.play().then(() => setStatus('idle')).catch(() => { setStatus('error'); if (playing === undefined) setInner(false); onToggle?.(false); });
  };
  const pauseNow = () => { MUSIC?.pause(); };

  // controlled mode: follow the `playing` prop
  useEffect(() => {
    if (playing === undefined) return;
    if (playing) playNow(); else pauseNow();
  }, [playing]);
  useEffect(() => { if (MUSIC) MUSIC.setVolume(volume); }, [volume]);
  // keep the button in step if the lock screen / headphones pause or play it
  useEffect(() => {
    const off = onMusicChange((on) => { if (playing === undefined) setInner(on); });
    return () => { off(); };
  }, [playing]);
  // leaving the room (unmount) pauses gently and remembers the spot
  useEffect(() => () => { MUSIC?.pause(); }, []);

  const label = status === 'error' ? 'Speaker · music couldn’t load, tap to retry'
    : status === 'loading' && isPlaying ? 'Speaker · loading…'
    : isPlaying ? 'Speaker · tap to pause' : MUSIC && MUSIC.el.currentTime > 1 ? 'Speaker · tap to resume' : 'Speaker · tap to play music';
  useEffect(() => { if (hovered.current) onHoverChange?.(label); }, [label]);

  const toggle = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return;                  // ignore drags
    const next = !isPlaying;
    // start or stop right here, inside the tap, so every browser (iOS too) allows the sound
    if (playing === undefined) { if (next) playNow(); else pauseNow(); setInner(next); }
    onToggle?.(next);
    tap.current = 1;
  };

  /* ---------- animation ---------- */
  const level = useRef(0), tap = useRef(0), spawnAt = useRef(0);
  const notes = useRef(Array.from({ length: 6 }, () => ({ t: -1, x: 0, z: 0, tex: 0, sway: 0 })));
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    // how loud right now (0..1)
    let target = 0;
    const a = MUSIC;
    if (isPlaying && a?.analyser && a.buf && !a.el.paused) {
      a.analyser.getByteTimeDomainData(a.buf as any);
      let sum = 0; for (let i = 0; i < a.buf.length; i++) { const v = (a.buf[i] - 128) / 128; sum += v * v; }
      target = Math.min(1, Math.sqrt(sum / a.buf.length) * 6);
    } else if (isPlaying && status !== 'loading') {
      target = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 1.6)), 6) * 0.8 + 0.12 + 0.06 * Math.sin(t * 13);
    }
    level.current += (target - level.current) * Math.min(1, delta * 18);
    tap.current *= Math.exp(-delta * 8);
    const l = level.current;
    cone.current.position.z = D / 2 - 0.004 + l * 0.0035;
    cone.current.scale.setScalar(1 + l * 0.04);
    ring.current.scale.setScalar(1 + l * 0.025);
    bodyRef.current.scale.set(1 + l * 0.008, 1 - tap.current * 0.06 + l * 0.012, 1 + l * 0.008);
    bodyRef.current.position.y = Math.abs(Math.sin(tap.current * 6)) * 0.004 * tap.current;
    led.current.emissiveIntensity = status === 'loading' && isPlaying ? 0.4 + 0.8 * (0.5 + 0.5 * Math.sin(t * 8)) : isPlaying ? 1.2 + l * 1.5 : 0.08;

    // music notes floating up while it plays
    if (isPlaying && status !== 'loading' && t > spawnAt.current) {
      spawnAt.current = t + 0.45 + Math.random() * 0.35;
      const free = notes.current.find((n) => n.t < 0);
      if (free) Object.assign(free, { t: 0, x: (Math.random() - 0.5) * 0.05, z: (Math.random() - 0.5) * 0.03, tex: Math.floor(Math.random() * 4), sway: Math.random() * 6 });
    }
    notes.current.forEach((n, i) => {
      const sp = notesRef.current.children[i] as THREE.Sprite;
      if (n.t < 0) { sp.visible = false; return; }
      n.t += delta / 1.8;
      if (n.t >= 1) { n.t = -1; sp.visible = false; return; }
      sp.visible = true;
      (sp.material as THREE.SpriteMaterial).map = noteTex[n.tex];
      sp.position.set(n.x + Math.sin(n.t * 6 + n.sway) * 0.012, H + 0.03 + n.t * 0.16, n.z);
      const s = 0.03 + n.t * 0.014; sp.scale.set(s, s, 1);
      (sp.material as THREE.SpriteMaterial).opacity = Math.sin(n.t * Math.PI);
    });
  });

  return (
    <group position={position} rotation-y={facing}>
      <group
        ref={bodyRef}
        onClick={toggle}
        onPointerOver={(e) => { e.stopPropagation(); hovered.current = true; document.body.style.cursor = 'pointer'; onHoverChange?.(label); }}
        onPointerOut={() => { hovered.current = false; document.body.style.cursor = 'auto'; onHoverChange?.(null); }}
      >
        {/* cabinet */}
        <RoundedBox args={[W, H, D]} radius={0.012} smoothness={4} position-y={H / 2} castShadow receiveShadow>
          <meshStandardMaterial color={bodyColor} roughness={0.4} />
        </RoundedBox>
        {/* fabric front */}
        <RoundedBox args={[W - 0.012, H - 0.03, 0.004]} radius={0.0019} smoothness={3} position={[0, H / 2 - 0.006, D / 2 - 0.0005]} receiveShadow>
          <meshStandardMaterial map={fabric} roughness={0.95} />
        </RoundedBox>
        {/* woofer: rose-gold ring + pink cone that pulses */}
        <mesh ref={ring} position={[0, H / 2 - 0.012, D / 2 + 0.0045]} castShadow>
          <torusGeometry args={[0.032, 0.0022, 12, 48]} />
          <meshStandardMaterial color="#D6A88F" metalness={0.85} roughness={0.28} />
        </mesh>
        <mesh ref={cone} geometry={coneGeo} position={[0, H / 2 - 0.012, D / 2 - 0.004]} rotation-x={Math.PI / 2}>
          <meshStandardMaterial map={fabric} color="#F0D4CF" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, H / 2 - 0.012, D / 2 - 0.003]} rotation-x={Math.PI / 2}>
          <sphereGeometry args={[0.0065, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#D9A3A6" roughness={0.6} />
        </mesh>
        {/* tweeter */}
        <mesh position={[0, H - 0.028, D / 2 + 0.002]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.007, 0.007, 0.003, 24]} />
          <meshStandardMaterial color="#D6A88F" metalness={0.85} roughness={0.3} />
        </mesh>
        {/* top: play button + status light + little strap handle */}
        <mesh position={[0.022, H + 0.002, 0.012]} castShadow>
          <cylinderGeometry args={[0.013, 0.013, 0.004, 32]} />
          <meshStandardMaterial color="#FBF8F4" roughness={0.35} />
        </mesh>
        <mesh position={[0.022, H + 0.0041, 0.012]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.0118, 32]} />
          <meshStandardMaterial map={isPlaying ? icons.pause : icons.play} roughness={0.4} />
        </mesh>
        <mesh position={[-0.026, H + 0.001, 0.02]}>
          <sphereGeometry args={[0.0032, 16, 8]} />
          <meshStandardMaterial ref={led} color="#FFE7EC" emissive="#FF9FB1" emissiveIntensity={0.08} toneMapped={false} />
        </mesh>
        <mesh geometry={handleGeo} position={[-0.006, H, -0.012]} castShadow>
          <meshStandardMaterial color="#C9A27E" roughness={0.7} />
        </mesh>
        {/* rubber feet */}
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => (
          <mesh key={i} position={[sx * (W / 2 - 0.014), 0.0015, sz * (D / 2 - 0.014)]}>
            <cylinderGeometry args={[0.006, 0.006, 0.003, 12]} />
            <meshStandardMaterial color="#3A3330" roughness={0.9} />
          </mesh>
        ))}
      </group>
      {/* music notes (not clickable) */}
      <group ref={notesRef} raycast={() => null}>
        {notes.current.map((_, i) => (
          <sprite key={i} visible={false} raycast={() => null}>
            <spriteMaterial transparent depthWrite={false} opacity={0} />
          </sprite>
        ))}
      </group>
    </group>
  );
}
