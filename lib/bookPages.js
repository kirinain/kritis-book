/**
 * bookPages.js · draws every page of Kiti's Book onto a canvas.
 *
 *   drawBookPage(n, ctx, { scale, assets })  →  hotspots[]
 *
 * - n: page number 1–16 (odd = right-hand page, even = left-hand page)
 * - ctx: a 2D canvas context sized (768 × 1024) × scale
 * - assets: { p01, p09, p13, p15, ... } loaded HTMLImageElements (see SLOTS).
 *   A missing asset draws a dashed slot with its ID, so you can see where it goes.
 * - returns clickable hotspots in page units (768 × 1024): { x, y, w, h, go } jumps to page `go`,
 *   or { x, y, w, h, href } opens a link.
 *
 * The 3D book uses this to paint its page textures. Fonts must be loaded first:
 * Fraunces, DM Sans and Caveat (Google Fonts).
 */

export const PAGE_W = 768;
export const PAGE_H = 1024;

/** Every picture slot, by page. `file` lives in /public/book/. */
export const SLOTS = {
  p01: { page: 1, file: 'p01-portrait.jpg', what: 'Portrait (café)' },
  p04a: { page: 4, file: 'p04-before.png', what: 'Payment screen, before' },
  p04b: { page: 4, file: 'p04-after.png', what: 'Payment screen, after' },
  p06: { page: 6, file: 'p06-xander.png', what: 'Onboarding screen' },
  p07: { page: 7, file: 'p07-overlane.png', what: 'Overlane screen' },
  p08a: { page: 8, file: 'p08-notes-1.png', what: 'Notes, home' },
  p08b: { page: 8, file: 'p08-notes-2.png', what: 'Notes, a space' },
  p09: { page: 9, file: 'p09-robot-arm.jpg', what: 'Robot arm blueprint' },
  p10b: { page: 10, file: 'p10-isaac.png', what: 'Isaac Lab sim' },
  p11a: { page: 11, file: 'p11-mr-robot.jpg', what: 'MR Robot 2.0' },
  p11b: { page: 11, file: 'p11-aruco.jpg', what: 'ArUco robot' },
  p13: { page: 13, file: 'p13-team.jpg', what: 'Team photo' },
  p14: { page: 14, file: 'p14-paper-girl.png', what: 'Paper girl doodle' },
  p15: { page: 15, file: 'p15-me.jpg', what: 'Portrait (flowers)' },
  p16: { page: 16, file: 'p16-robo-wave.png', what: 'Robo Kiti waving' },
};

export const LINKS = {
  email: 'mailto:kitinain@gmail.com',
  linkedin: 'https://www.linkedin.com/in/kiritinain/',
  github: 'https://github.com/kirinain',
  x: 'https://x.com/NainKiriti',
  medium: 'https://medium.com/@kitinain',
  substack: 'https://substack.com/@xkiti',
  ironman: 'https://medium.com/@kitinain/the-exact-mechanics-of-the-iron-man-suit-cf3b342219d1',
  shallow: 'https://medium.com/@kitinain/are-we-becoming-shallow-because-of-ai-and-llms-abc0397db06c',
  kitisRoom: 'https://kiti-room.vercel.app/',
  overlane: '#', // TODO: Overlane link
  notes: '#', // TODO: Notes link
  resume: '/Kiriti_Nain_Resume.pdf',
};

/* ------------------------------------------------------------------ */
/* palette + type                                                       */
/* ------------------------------------------------------------------ */
const C = {
  paper: '#F7F1E3', ink: '#2A2620', body: '#3B3530', soft: '#655C53', rule: '#DCD2C0', dot: '#B4A995',
  ox: '#6B1F24',          // oxblood: big numbers, accents
  wine: '#3E1719',        // backing card behind clipped notes
  clip: '#B3201E', clipHi: '#E0473F', clipLo: '#741010',
  kraft: '#C9C3B8', kraftLo: '#B7B0A4',
  blush: '#F3DCD8', blushInk: '#7E2F38',
  navy: '#10121B', navyLine: 'rgba(170,195,240,0.10)', ice: '#E4ECFA', iceSoft: '#A9B8D6',
  card: '#FFFDF8', photo: '#E6DED0', tapeA: 'rgba(232,186,181,0.85)', tapeB: 'rgba(214,226,206,0.85)', tapeC: 'rgba(220,230,246,0.85)',
};
const SERIF = '"Fraunces", Georgia, "Times New Roman", serif';
const SANS = '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif';
const HAND = '"Caveat", "Segoe Print", "Bradley Hand", cursive';

/* ------------------------------------------------------------------ */
/* small drawing helpers                                                */
/* ------------------------------------------------------------------ */
const font = (g, size, fam, weight = 400, italic = false) => { g.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${fam}`; };

function txt(g, s, x, y, o = {}) {
  font(g, o.size || 24, o.fam || SANS, o.weight || 400, o.italic);
  g.fillStyle = o.color || C.ink; g.textAlign = o.align || 'left'; g.textBaseline = 'alphabetic';
  g.fillText(s, x, y);
  const w = g.measureText(s).width; g.textAlign = 'left'; return w;
}
function caps(g, s, x, y, o = {}) {
  const size = o.size || 15; font(g, size, SANS, o.weight || 600);
  g.fillStyle = o.color || C.soft; g.textAlign = 'left';
  const str = s.toUpperCase(), sp = size * (o.ls ?? 0.14);
  let w = 0; for (const ch of str) w += g.measureText(ch).width + sp; w -= sp;
  let cx = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
  for (const ch of str) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + sp; }
  return w;
}
function wrapLines(g, s, maxW) {
  const out = [];
  s.split('\n').forEach((p) => {
    let line = '';
    p.split(' ').forEach((w) => { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
    out.push(line);
  });
  return out;
}
function para(g, s, x, y, maxW, o = {}) {
  font(g, o.size || 24, o.fam || SANS, o.weight || 400, o.italic);
  g.fillStyle = o.color || C.body; g.textAlign = o.align || 'left';
  const lh = o.lh || (o.size || 24) * 1.38;
  wrapLines(g, s, maxW).forEach((l, i) => g.fillText(l, x, y + i * lh));
  const n = wrapLines(g, s, maxW).length; g.textAlign = 'left'; return y + n * lh;
}
function rule(g, x0, x1, y, color = C.rule, w = 1.5) { g.fillStyle = color; g.fillRect(x0, y, x1 - x0, w); }
function dots(g, x0, x1, y, color = C.dot) { g.fillStyle = color; for (let x = x0; x < x1; x += 9) { g.beginPath(); g.arc(x, y, 1.4, 0, Math.PI * 2); g.fill(); } }
function note(g, s, x, y, o = {}) {
  g.save(); g.translate(x, y); g.rotate(o.rot ?? -0.04);
  font(g, o.size || 32, HAND, 600); g.fillStyle = o.color || C.ox; g.textAlign = o.align || 'left';
  if (o.maxW) wrapLines(g, s, o.maxW).forEach((l, i) => g.fillText(l, 0, i * (o.size || 32) * 1.02)); else g.fillText(s, 0, 0);
  g.restore();
}
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function drawCover(g, img, x, y, w, h, fx = 0.5, fy = 0.5) {
  const ir = img.naturalWidth / img.naturalHeight, r = w / h;
  let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
  if (ir > r) { sw = sh * r; sx = (img.naturalWidth - sw) * fx; } else { sh = sw / r; sy = (img.naturalHeight - sh) * fy; }
  g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
function slotBox(g, x, y, w, h, id, what, dark = false) {
  g.save();
  g.fillStyle = dark ? 'rgba(255,255,255,0.06)' : 'rgba(107,31,36,0.05)'; g.fillRect(x, y, w, h);
  g.setLineDash([10, 8]); g.lineWidth = 2; g.strokeStyle = dark ? 'rgba(228,236,250,0.55)' : 'rgba(107,31,36,0.45)'; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  g.setLineDash([]);
  const cx = x + w / 2, cy = y + h / 2;
  caps(g, id.toUpperCase(), cx, cy - 4, { size: 15, color: dark ? C.ice : C.ox, align: 'center' });
  font(g, 17, SANS, 400); g.fillStyle = dark ? C.iceSoft : C.soft; g.textAlign = 'center';
  wrapLines(g, what, w - 24).forEach((l, i) => g.fillText(l, cx, cy + 24 + i * 22)); g.textAlign = 'left';
  g.restore();
}
function tape(g, x, y, w, rot, color) { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = color; g.fillRect(-w / 2, -13, w, 26); g.restore(); }
function shadow(g, blur = 22, y = 10, a = 0.28) { g.shadowColor = `rgba(40,25,20,${a})`; g.shadowBlur = blur; g.shadowOffsetY = y; }
function noShadow(g) { g.shadowColor = 'rgba(0,0,0,0)'; g.shadowBlur = 0; g.shadowOffsetY = 0; }

/** Polaroid with tape. `ratio` = photo height / width. */
function polaroid(g, A, key, cx, cy, w, rot, caption, o = {}) {
  const pad = w * 0.06, pw = w - 2 * pad, ph = pw * (o.ratio || 1), capH = caption ? w * 0.2 : pad, h = pad + ph + capH;
  g.save(); g.translate(cx, cy); g.rotate(rot);
  shadow(g, 24, 10, 0.3); g.fillStyle = C.card; g.fillRect(-w / 2, -h / 2, w, h); noShadow(g);
  const px = -w / 2 + pad, py = -h / 2 + pad;
  if (A[key]) { drawCover(g, A[key], px, py, pw, ph, o.fx, o.fy); g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(px, py, pw, 2); }
  else if (ILL[key]) { g.save(); g.beginPath(); g.rect(px, py, pw, ph); g.clip(); g.translate(px, py); ILL[key](g, pw, ph); g.restore(); }
  else slotBox(g, px, py, pw, ph, key, SLOTS[key]?.what || '');
  if (caption) { font(g, Math.round(w * 0.085), HAND, 600); g.fillStyle = C.body; g.textAlign = 'center'; g.fillText(caption, 0, h / 2 - capH * 0.36); g.textAlign = 'left'; }
  tape(g, 0, -h / 2 + 2, w * 0.32, -0.05, o.tape || C.tapeA);
  g.restore();
}
/** Phone frame with a screenshot (or slot). */
function phone(g, A, key, cx, cy, w, rot) {
  const h = w * 2.05, r = w * 0.14, b = w * 0.045;
  g.save(); g.translate(cx, cy); g.rotate(rot);
  shadow(g, 26, 12, 0.32); rrect(g, -w / 2, -h / 2, w, h, r); g.fillStyle = '#25201F'; g.fill(); noShadow(g);
  g.save(); rrect(g, -w / 2 + b, -h / 2 + b, w - 2 * b, h - 2 * b, r - b); g.clip();
  if (A[key]) drawCover(g, A[key], -w / 2 + b, -h / 2 + b, w - 2 * b, h - 2 * b, 0.5, 0);
  else if (ILL[key]) { g.translate(-w / 2 + b, -h / 2 + b); ILL[key](g, w - 2 * b, h - 2 * b); }
  else { g.fillStyle = '#FBF7F2'; g.fillRect(-w / 2, -h / 2, w, h); slotBox(g, -w / 2 + b * 2, -h / 2 + b * 4, w - b * 4, h - b * 8, key, SLOTS[key]?.what || ''); }
  g.restore();
  g.fillStyle = '#25201F'; rrect(g, -w * 0.14, -h / 2 + b * 1.6, w * 0.28, b * 1.3, b * 0.65); g.fill();
  g.restore();
}
/** Browser window with a screenshot (or slot). */
function browser(g, A, key, x, y, w, h, rot = 0) {
  g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(rot);
  const X = -w / 2, Y = -h / 2, bar = 30;
  shadow(g, 24, 10, 0.26); rrect(g, X, Y, w, h, 10); g.fillStyle = '#FFFFFF'; g.fill(); noShadow(g);
  g.save(); rrect(g, X, Y, w, h, 10); g.clip(); g.fillStyle = '#EFE8E2'; g.fillRect(X, Y, w, bar); g.restore();
  ['#E8A39C', '#EDD08F', '#A9CDA2'].forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(X + 18 + i * 18, Y + bar / 2, 5.5, 0, Math.PI * 2); g.fill(); });
  g.save(); g.beginPath(); g.rect(X, Y + bar, w, h - bar); g.clip();
  if (A[key]) drawCover(g, A[key], X, Y + bar, w, h - bar, 0.5, 0);
  else if (ILL[key]) { g.translate(X, Y + bar); ILL[key](g, w, h - bar); }
  else slotBox(g, X + 12, Y + bar + 12, w - 24, h - bar - 24, key, SLOTS[key]?.what || '');
  g.restore(); g.restore();
}
/** Red binder clip (the one from the reference). */
function binderClip(g, x, y, s, rot) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  // wire handles
  g.strokeStyle = '#A8A39E'; g.lineWidth = 3.2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-16, 0); g.lineTo(-10, -40); g.quadraticCurveTo(0, -56, 10, -40); g.lineTo(16, 0); g.stroke();
  g.strokeStyle = '#E9E6E2'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-15, -2); g.lineTo(-9.5, -39); g.stroke();
  // body
  shadow(g, 8, 4, 0.35);
  g.beginPath(); g.moveTo(-34, -4); g.lineTo(34, -4); g.lineTo(38, 26); g.lineTo(-38, 26); g.closePath();
  const lg = g.createLinearGradient(0, -4, 0, 26); lg.addColorStop(0, C.clipHi); lg.addColorStop(0.45, C.clip); lg.addColorStop(1, C.clipLo);
  g.fillStyle = lg; g.fill(); noShadow(g);
  g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(-30, -2, 60, 3);
  g.fillStyle = C.clipLo; g.fillRect(-38, 22, 76, 4);
  g.restore();
}
/** The clipped note: oxblood backing card + kraft notebook sheet with a perforated top + red binder clip. */
function clipNote(g, x, y, w, h, rot, inner, o = {}) {
  g.save(); g.translate(x + w / 2, y + h / 2);
  // backing card, turned a bit more
  g.save(); g.rotate(rot - 0.07); shadow(g, 18, 8, 0.25); g.fillStyle = C.wine; g.fillRect(-w / 2 - 14, -h / 2 + 18, w + 10, h); noShadow(g); g.restore();
  g.rotate(rot);
  // sheet
  shadow(g, 14, 6, 0.22);
  const X = -w / 2, Y = -h / 2;
  g.fillStyle = o.paper || C.kraft; g.beginPath(); g.moveTo(X, Y + 14); g.lineTo(X + w, Y + 10); g.lineTo(X + w + 2, Y + h); g.lineTo(X + 4, Y + h + 2); g.closePath(); g.fill(); noShadow(g);
  // perforations along the torn top
  g.fillStyle = o.under || C.paper;   // punched holes show the page behind
  for (let px = X + 22; px < X + w - 28; px += 34) { g.fillRect(px, Y + 8, 14, 14); }
  for (let px = X + 22; px < X + w - 28; px += 34) { g.fillStyle = 'rgba(60,50,40,0.18)'; g.fillRect(px, Y + 21, 14, 2); }
  // paper fibres
  for (let i = 0; i < 260; i++) { g.fillStyle = i % 2 ? 'rgba(90,80,70,0.06)' : 'rgba(255,255,255,0.14)'; g.fillRect(X + (i * 97 % w), Y + 26 + (i * 53 % (h - 30)), 2, 1.5); }
  g.save(); g.translate(X, Y + 26); inner(g, w, h - 26); g.restore();
  if (!o.noClip) binderClip(g, X + w - 30, Y + 14, o.clipScale || 0.9, 0.28);
  g.restore();
}
function stat(g, big, small, x, y, o = {}) {
  const w = txt(g, big, x, y, { size: o.size || 84, fam: SERIF, weight: 700, color: o.color || C.ox });
  if (small) para(g, small, x, y + (o.gap || 36), o.maxW || 420, { size: o.smallSize || 22, color: o.smallColor || C.body, weight: 500 });
  return w;
}
function tags(g, list, x, y, maxW, o = {}) {
  font(g, 15, SANS, 600); let cx = x, cy = y;
  list.forEach((t) => {
    const s = t.toUpperCase(), w = g.measureText(s).width + 26;
    if (cx + w > x + maxW) { cx = x; cy += 38; }
    rrect(g, cx, cy - 22, w, 32, 16); g.strokeStyle = o.color || C.ox; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = o.color || C.ox; g.fillText(s, cx + 13, cy - 1); cx += w + 10;
  });
  return cy;
}
function bullets(g, items, x, y, maxW, o = {}) {
  const size = o.size || 24, lh = size * 1.36;
  items.forEach((it) => {
    g.fillStyle = o.dot || C.ox; g.beginPath(); g.arc(x + 5, y - size * 0.32, 4.5, 0, Math.PI * 2); g.fill();
    y = para(g, it, x + 24, y, maxW - 24, { size, color: o.color || C.body, lh }) + (o.gap ?? 10);
  });
  return y;
}
function leaderRow(g, x0, x1, y, title, num, o = {}) {
  let tw = txt(g, title, x0, y, { size: o.size || 34, fam: SERIF, weight: 600, color: o.color || C.ink });
  if (o.doodle) { o.doodle(x0 + tw); tw += o.doodleW || 50; }
  font(g, 20, SANS, 600); const nw = g.measureText(num).width;
  dots(g, x0 + tw + 14, x1 - nw - 12, y - 6, o.dotColor || C.dot);
  txt(g, num, x1, y, { size: 20, weight: 600, color: o.numColor || C.soft, align: 'right' });
}

/* ---------- doodles (simple ink drawings; replace with Kiriti's own later) ---------- */
function ink(g, w = 3, color = C.ink) { g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; }
const DOODLE = {
  bulb(g, x, y, s = 1, c = C.ink) { g.save(); g.translate(x, y); g.scale(s, s); ink(g, 3, c); g.beginPath(); g.arc(0, -8, 16, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(7, 14); g.lineTo(-7, 14); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(-6, 20); g.lineTo(6, 20); g.moveTo(-4, 26); g.lineTo(4, 26); g.stroke(); [[-28, -14, -22, -12], [28, -14, 22, -12], [0, -36, 0, -30], [-20, -32, -16, -27], [20, -32, 16, -27]].forEach(([a, b, c2, d]) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); }); g.restore(); },
  robot(g, x, y, s = 1, c = C.ink) { g.save(); g.translate(x, y); g.scale(s, s); ink(g, 3, c); rrect(g, -16, -14, 32, 26, 6); g.stroke(); g.beginPath(); g.moveTo(0, -14); g.lineTo(0, -24); g.stroke(); g.beginPath(); g.arc(0, -27, 3.5, 0, 7); g.stroke(); g.beginPath(); g.arc(-7, -2, 3, 0, 7); g.arc(7, -2, 3, 0, 7); g.stroke(); g.beginPath(); g.moveTo(-6, 6); g.quadraticCurveTo(0, 10, 6, 6); g.stroke(); rrect(g, -12, 14, 24, 14, 4); g.stroke(); g.restore(); },
  plane(g, x, y, s = 1, c = C.ink) { g.save(); g.translate(x, y); g.scale(s, s); ink(g, 3, c); g.beginPath(); g.moveTo(-26, 4); g.lineTo(26, -14); g.lineTo(-6, 18); g.lineTo(-4, 6); g.closePath(); g.moveTo(-4, 6); g.lineTo(26, -14); g.stroke(); g.setLineDash([3, 7]); g.beginPath(); g.moveTo(-30, 10); g.quadraticCurveTo(-50, 20, -58, 4); g.stroke(); g.setLineDash([]); g.restore(); },
  floor(g, x, y, s = 1, c = C.ink) { g.save(); g.translate(x, y); g.scale(s, s); ink(g, 3, c); g.beginPath(); g.moveTo(-34, 14); g.quadraticCurveTo(-22, 2, -12, 12); g.quadraticCurveTo(0, 22, 10, 6); g.quadraticCurveTo(22, -6, 34, 12); g.stroke(); g.beginPath(); g.arc(-4, -6, 7, 0, 7); g.arc(14, -10, 7, 0, 7); g.stroke(); g.beginPath(); g.moveTo(-14, -16); g.lineTo(24, -24); g.lineTo(26, -16); g.lineTo(-12, -8); g.closePath(); g.stroke(); g.restore(); },
  speech(g, x, y, s = 1, c = C.ink) { g.save(); g.translate(x, y); g.scale(s, s); ink(g, 3, c); rrect(g, -30, -24, 60, 38, 12); g.stroke(); g.beginPath(); g.moveTo(-10, 14); g.lineTo(-18, 28); g.lineTo(2, 14); g.stroke(); [-12, 0, 12].forEach((d) => { g.beginPath(); g.arc(d, -5, 2.5, 0, 7); g.fillStyle = c; g.fill(); }); g.restore(); },
  loop(g, x, y, s = 1, c = C.ink) { g.save(); g.translate(x, y); g.scale(s, s); ink(g, 3, c); g.beginPath(); g.arc(0, 0, 24, -0.3, Math.PI * 1.6); g.stroke(); const a = Math.PI * 1.6, ex = Math.cos(a) * 24, ey = Math.sin(a) * 24; g.beginPath(); g.moveTo(ex - 10, ey - 2); g.lineTo(ex, ey); g.lineTo(ex + 2, ey + 11); g.stroke(); g.restore(); },
  star(g, x, y, s = 1, c = C.ox) { g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = c; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 5 : 14, a = (i / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.restore(); },
  heart(g, x, y, s = 1, c = C.ox) { g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = c; g.beginPath(); g.moveTo(0, 10); g.bezierCurveTo(-20, -4, -6, -18, 0, -6); g.bezierCurveTo(6, -18, 20, -4, 0, 10); g.fill(); g.restore(); },
  arrow(g, x0, y0, x1, y1, c = C.ox, w = 2.5) { ink(g, w, c); g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2 + 20, (y0 + y1) / 2 - 20, x1, y1); g.stroke(); const a = Math.atan2(y1 - ((y0 + y1) / 2 - 20), x1 - ((x0 + x1) / 2 + 20)); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - 12 * Math.cos(a - 0.5), y1 - 12 * Math.sin(a - 0.5)); g.moveTo(x1, y1); g.lineTo(x1 - 12 * Math.cos(a + 0.5), y1 - 12 * Math.sin(a + 0.5)); g.stroke(); },
};
/** An original wireframe EV sketch (blueprint style) for the IIT Delhi entry. */
function wireCar(g, x, y, s, c = C.ice) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const body = new Path2D('M8 92 L14 70 Q24 62 66 56 L104 32 Q118 24 170 23 Q204 24 230 44 L262 52 Q284 56 290 70 L292 90 Z');
  g.save(); g.clip(body);
  g.strokeStyle = 'rgba(228,236,250,0.32)'; g.lineWidth = 0.9;
  for (let i = 0; i < 300; i += 11) { g.beginPath(); g.moveTo(i, 0); g.quadraticCurveTo(i + 6, 60, i - 2, 120); g.stroke(); }
  for (let j = 20; j < 100; j += 9) { g.beginPath(); g.moveTo(0, j); g.quadraticCurveTo(150, j - 10, 300, j + 4); g.stroke(); }
  g.restore();
  g.strokeStyle = c; g.lineWidth = 2; g.stroke(body);
  g.beginPath(); g.moveTo(112, 36); g.lineTo(168, 30); g.lineTo(168, 56); g.lineTo(84, 58); g.closePath(); g.moveTo(176, 30); g.quadraticCurveTo(206, 32, 224, 50); g.lineTo(176, 56); g.closePath(); g.stroke();
  [[68, 92], [236, 92]].forEach(([wx, wy]) => { g.fillStyle = C.navy; g.beginPath(); g.arc(wx, wy, 24, 0, 7); g.fill(); g.beginPath(); g.arc(wx, wy, 24, 0, 7); g.stroke(); g.beginPath(); g.arc(wx, wy, 11, 0, 7); g.stroke(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.beginPath(); g.moveTo(wx + Math.cos(a) * 11, wy + Math.sin(a) * 11); g.lineTo(wx + Math.cos(a) * 22, wy + Math.sin(a) * 22); g.stroke(); } });
  rrect(g, 150, 14, 22, 9, 3); g.stroke(); // LiDAR puck
  g.restore();
}


/* ------------------------------------------------------------------ */
/* illustrations: ink sketches that fill every picture slot            */
/* (a real image in public/book/ replaces the sketch automatically)    */
/* ------------------------------------------------------------------ */
function sk(g, build, color = C.ink, w = 2.4) {
  // hand-drawn feel: the same path stroked twice, a hair apart
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = color;
  g.lineWidth = w; g.beginPath(); build(g); g.stroke();
  g.globalAlpha = 0.35; g.lineWidth = w * 0.6; g.translate(0.9, 0.7); g.beginPath(); build(g); g.stroke();
  g.restore();
}
function wash(g, color, build, a = 1) { g.save(); g.globalAlpha = a; g.fillStyle = color; g.beginPath(); build(g); g.fill(); g.restore(); }
function bar(g, x, y, w, h = 8, c = 'rgba(42,38,32,0.16)') { g.fillStyle = c; rrect(g, x, y, w, h, h / 2); g.fill(); }
function label(g, s, x, y, size = 20, color = C.ox, rot = -0.03, align = 'left') { note(g, s, x, y, { size, color, rot, align }); }
function check(g, x, y, c = '#4F7A4A') { sk(g, (q) => { q.moveTo(x - 6, y); q.lineTo(x - 1, y + 5); q.lineTo(x + 7, y - 6); }, c, 2.6); }

const ILL = {
  /* phone screens (w × h is the screen area) */
  p04a(g, w, h) {
    g.fillStyle = '#FBF7F1'; g.fillRect(0, 0, w, h);
    txt(g, 'Checkout', 12, 34, { size: 15, weight: 700, color: C.ink });
    for (let i = 0; i < 5; i++) { const y = 50 + i * 30; sk(g, (q) => rrect(q, 10, y, w - 20, 22, 5), 'rgba(42,38,32,0.45)', 1.4); bar(g, 16, y + 7, (w - 40) * (0.4 + (i % 3) * 0.15), 7); }
    sk(g, (q) => { rrect(q, 10, 206, 34, 22, 4); }, 'rgba(42,38,32,0.45)', 1.4);
    bar(g, 50, 213, w - 64, 7);
    g.fillStyle = '#CFC8BE'; rrect(g, 10, h - 46, w - 20, 30, 8); g.fill();
    txt(g, 'Pay', w / 2, h - 26, { size: 14, weight: 700, color: '#8C847A', align: 'center' });
  },
  p04b(g, w, h) {
    g.fillStyle = '#FFF9F6'; g.fillRect(0, 0, w, h);
    txt(g, 'Go premium', 12, 34, { size: 15, weight: 700, color: C.ink });
    wash(g, C.blush, (q) => rrect(q, 10, 48, w - 20, 74, 10));
    DOODLE.heart(g, 30, 82, 0.9, C.ox); bar(g, 48, 70, w - 70, 8, 'rgba(126,47,56,0.35)'); bar(g, 48, 88, (w - 70) * 0.6, 8, 'rgba(126,47,56,0.25)');
    txt(g, 'Pay with', 12, 150, { size: 12, weight: 600, color: C.soft });
    [0, 1, 2].forEach((i) => { const x = 12 + i * ((w - 24) / 3); sk(g, (q) => rrect(q, x, 160, (w - 24) / 3 - 6, 40, 8), i === 0 ? C.ox : 'rgba(42,38,32,0.4)', i === 0 ? 2.2 : 1.4); g.fillStyle = i === 0 ? C.ox : 'rgba(42,38,32,0.3)'; g.beginPath(); g.arc(x + ((w - 24) / 3 - 6) / 2, 180, 7, 0, 7); g.fill(); });
    g.fillStyle = C.ox; rrect(g, 10, h - 46, w - 20, 30, 8); g.fill();
    txt(g, 'Pay ✓', w / 2, h - 26, { size: 14, weight: 700, color: '#FFFFFF', align: 'center' });
  },
  p08a(g, w, h) {
    g.fillStyle = '#FFFBF7'; g.fillRect(0, 0, w, h);
    txt(g, 'Notes', 12, 36, { size: 20, fam: SERIF, weight: 700, color: C.ink });
    [[C.blush, 'us'], ['#DCE6F6', 'K + A'], ['#D6EBD6', 'sis']].forEach(([c, t], i) => {
      const y = 54 + i * 76;
      wash(g, c, (q) => rrect(q, 10, y, w - 20, 64, 10));
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(30, y + 22, 11, 0, 7); g.arc(44, y + 22, 11, 0, 7); g.fill();
      sk(g, (q) => { q.arc(30, y + 22, 11, 0, 7); q.moveTo(55, y + 22); q.arc(44, y + 22, 11, 0, 7); }, 'rgba(42,38,32,0.5)', 1.2);
      txt(g, t, 62, y + 27, { size: 14, weight: 700, color: C.ink });
      bar(g, 18, y + 44, (w - 50) * (0.9 - i * 0.15), 7);
    });
    DOODLE.heart(g, w - 24, 34, 0.7, C.ox);
  },
  p08b(g, w, h) {
    g.fillStyle = '#FFFBF7'; g.fillRect(0, 0, w, h);
    txt(g, '← us', 12, 34, { size: 14, weight: 700, color: C.ink });
    wash(g, C.blush, (q) => rrect(q, 10, 50, w * 0.68, 40, 12)); bar(g, 20, 62, w * 0.5, 7, 'rgba(126,47,56,0.35)'); bar(g, 20, 76, w * 0.32, 7, 'rgba(126,47,56,0.25)');
    // photo note
    wash(g, '#E9EFF7', (q) => rrect(q, w * 0.3, 102, w * 0.62, 80, 12));
    wash(g, '#B9CDB1', (q) => { q.moveTo(w * 0.3, 182); q.quadraticCurveTo(w * 0.55, 140, w * 0.92, 168); q.lineTo(w * 0.92, 182); q.closePath(); });
    g.fillStyle = '#F6E7B8'; g.beginPath(); g.arc(w * 0.78, 124, 8, 0, 7); g.fill();
    // voice note
    wash(g, '#F1ECE4', (q) => rrect(q, 10, 196, w * 0.72, 36, 18));
    g.fillStyle = C.ox; g.beginPath(); g.moveTo(22, 205); g.lineTo(32, 214); g.lineTo(22, 223); g.fill();
    for (let i = 0; i < 14; i++) { const hh = 4 + Math.abs(Math.sin(i * 1.7)) * 14; g.fillStyle = 'rgba(107,31,36,0.55)'; g.fillRect(40 + i * 6, 214 - hh / 2, 3, hh); }
    sk(g, (q) => rrect(q, 10, h - 40, w - 20, 26, 13), 'rgba(42,38,32,0.4)', 1.3);
  },

  /* browser screens */
  p06(g, w, h) {
    g.fillStyle = '#FFFCF8'; g.fillRect(0, 0, w, h);
    const steps = ['Upload data', 'Pick a model', 'Go live'];
    steps.forEach((t, i) => {
      const y = 22 + i * 34;
      g.fillStyle = i < 2 ? C.ox : '#FFFFFF'; g.beginPath(); g.arc(18, y, 9, 0, 7); g.fill();
      sk(g, (q) => q.arc(18, y, 9, 0, 7), C.ox, 1.6);
      if (i < 2) check(g, 18, y, '#FFFFFF');
      txt(g, t, 34, y + 5, { size: 13, weight: i === 2 ? 700 : 500, color: C.ink });
    });
    sk(g, (q) => { q.moveTo(18, 31); q.lineTo(18, 47); q.moveTo(18, 65); q.lineTo(18, 81); }, C.ox, 1.6);
    g.save(); g.setLineDash([6, 5]); sk(g, (q) => rrect(q, w * 0.48, 10, w * 0.48, h - 40, 10), 'rgba(107,31,36,0.6)', 1.6); g.restore();
    sk(g, (q) => { const cx = w * 0.72, cy = h * 0.38; q.moveTo(cx, cy + 14); q.lineTo(cx, cy - 12); q.moveTo(cx - 9, cy - 3); q.lineTo(cx, cy - 12); q.lineTo(cx + 9, cy - 3); }, C.ox, 2.2);
    txt(g, 'drop a CSV', w * 0.72, h * 0.38 + 34, { size: 12, weight: 600, color: C.soft, align: 'center' });
    bar(g, 10, h - 18, w - 20, 7, 'rgba(42,38,32,0.12)'); bar(g, 10, h - 18, (w - 20) * 0.66, 7, C.ox);
  },
  p07(g, w, h) {
    g.fillStyle = '#FFFCF8'; g.fillRect(0, 0, w, h);
    txt(g, 'Today', 18, 36, { size: 22, fam: SERIF, weight: 700, color: C.ink });
    txt(g, 'your daily summary', 92, 35, { size: 13, color: C.soft });
    const rows = [['done', '#4F7A4A', 'Shipped the login fix'], ['wait', '#C68A2E', 'Review waiting on you'], ['fail', '#B3201E', 'CI failing on main'], ['stale', '#8C847A', 'Branch untouched for a while']];
    rows.forEach(([k, c, t], i) => {
      const y = 62 + i * 40;
      g.fillStyle = c; g.globalAlpha = 0.15; rrect(g, 14, y - 14, w * 0.58, 32, 8); g.fill(); g.globalAlpha = 1;
      if (k === 'done') check(g, 30, y + 2, c);
      else if (k === 'fail') sk(g, (q) => { q.moveTo(24, y - 5); q.lineTo(36, y + 7); q.moveTo(36, y - 5); q.lineTo(24, y + 7); }, c, 2.4);
      else { g.fillStyle = c; g.beginPath(); g.arc(30, y + 1, 6, 0, 7); g.fill(); }
      txt(g, t, 48, y + 6, { size: 13, weight: 600, color: C.ink });
    });
    // blocked card
    const bx = w * 0.64, bw = w - bx - 14;
    wash(g, C.blush, (q) => rrect(q, bx, 18, bw, h - 36, 12));
    sk(g, (q) => { q.moveTo(bx + 18, 64); q.lineTo(bx + 18, 30); q.lineTo(bx + 44, 36); q.lineTo(bx + 18, 44); }, C.clip, 2.4);
    txt(g, 'Blocked', bx + 54, 46, { size: 17, fam: SERIF, weight: 700, color: C.ox });
    bar(g, bx + 16, 80, bw - 34, 7, 'rgba(126,47,56,0.3)'); bar(g, bx + 16, 96, (bw - 34) * 0.7, 7, 'rgba(126,47,56,0.22)');
    bar(g, bx + 16, 124, bw - 34, 7, 'rgba(126,47,56,0.3)'); bar(g, bx + 16, 140, (bw - 34) * 0.5, 7, 'rgba(126,47,56,0.22)');
    txt(g, 'evidence ↗', bx + 16, h - 34, { size: 12, weight: 700, color: C.ox });
  },
  p10b(g, w, h) {
    g.fillStyle = C.navy; g.fillRect(0, 0, w, h);
    // perspective floor grid
    g.strokeStyle = 'rgba(170,195,240,0.22)'; g.lineWidth = 1;
    const hz = h * 0.5;
    for (let i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(w / 2 + i * 10, hz); g.lineTo(w / 2 + i * 60, h); g.stroke(); }
    for (let j = 0; j < 7; j++) { const y = hz + Math.pow(j / 6, 1.8) * (h - hz); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    // robot arm
    sk(g, (q) => { const bx2 = w * 0.42, by2 = h * 0.82; q.moveTo(bx2 - 18, by2); q.lineTo(bx2 + 18, by2); q.moveTo(bx2, by2); q.lineTo(bx2 + 6, by2 - 46); q.lineTo(bx2 + 44, by2 - 70); q.lineTo(bx2 + 62, by2 - 46); q.moveTo(bx2 + 56, by2 - 40); q.lineTo(bx2 + 66, by2 - 34); }, C.ice, 3);
    [[0, 0], [6, -46], [44, -70]].forEach(([dx, dy]) => { g.fillStyle = C.ice; g.beginPath(); g.arc(w * 0.42 + dx, h * 0.82 + dy, 4, 0, 7); g.fill(); });
    g.fillStyle = '#E58FA0'; g.fillRect(w * 0.42 + 58, h * 0.82 - 14, 12, 12);
    // reward curve
    const rx = w - 92, ry = 10, rw = 80, rh = 52;
    g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(rx, ry, rw, rh);
    sk(g, (q) => { q.moveTo(rx + 4, ry + rh - 6); for (let i = 0; i <= 20; i++) { const t = i / 20; q.lineTo(rx + 4 + t * (rw - 8), ry + rh - 6 - (1 - Math.exp(-t * 3.2)) * (rh - 16) - Math.sin(i * 2.1) * 2); } }, '#9FD3A8', 1.8);
    txt(g, 'reward', rx + 4, ry + 12, { size: 10, weight: 600, color: C.iceSoft });
  },

  /* polaroid photos (square) */
  p11a(g, w, h) {
    g.fillStyle = '#EEF2F6'; g.fillRect(0, 0, w, h);
    const cx = w / 2, by2 = h * 0.82;
    wash(g, 'rgba(42,38,32,0.12)', (q) => q.ellipse(cx, by2 + 6, w * 0.32, 10, 0, 0, 7));
    // lower deck
    wash(g, '#DCE6F6', (q) => q.ellipse(cx, by2 - 26, w * 0.32, 16, 0, 0, 7));
    sk(g, (q) => { q.ellipse(cx, by2 - 26, w * 0.32, 16, 0, 0, 7); q.moveTo(cx - w * 0.32, by2 - 26); q.lineTo(cx - w * 0.32, by2 - 8); q.ellipse(cx, by2 - 8, w * 0.32, 16, 0, Math.PI, 0, true); q.lineTo(cx + w * 0.32, by2 - 26); });
    // posts + upper deck
    sk(g, (q) => { [-0.2, 0.2].forEach((d) => { q.moveTo(cx + d * w, by2 - 30); q.lineTo(cx + d * w, by2 - 74); }); });
    wash(g, '#F3DCD8', (q) => q.ellipse(cx, by2 - 78, w * 0.27, 13, 0, 0, 7));
    sk(g, (q) => q.ellipse(cx, by2 - 78, w * 0.27, 13, 0, 0, 7));
    // Raspberry Pi board
    wash(g, '#B9CDB1', (q) => rrect(q, cx - 34, by2 - 58, 52, 26, 3)); sk(g, (q) => rrect(q, cx - 34, by2 - 58, 52, 26, 3), C.ink, 1.6);
    // LiDAR puck
    wash(g, C.ink, (q) => rrect(q, cx - 16, by2 - 112, 32, 26, 6)); g.fillStyle = '#E58FA0'; g.fillRect(cx - 12, by2 - 104, 24, 4);
    // wheels
    [-1, 1].forEach((d) => { wash(g, C.ink, (q) => q.ellipse(cx + d * w * 0.28, by2 - 2, 7, 14, 0, 0, 7)); });
    // scan rings
    g.save(); g.setLineDash([4, 6]); sk(g, (q) => { q.arc(cx, by2 - 100, 46, Math.PI * 1.1, Math.PI * 1.9); }, C.ox, 1.6); sk(g, (q) => { q.arc(cx, by2 - 100, 66, Math.PI * 1.15, Math.PI * 1.85); }, C.ox, 1.4); g.restore();
    label(g, 'LiDAR', cx + 40, by2 - 120, 20); label(g, 'Pi', cx - 72, by2 - 40, 20);
  },
  p11b(g, w, h) {
    g.fillStyle = '#F4F1EA'; g.fillRect(0, 0, w, h);
    // marker on a wall
    const mx = w * 0.62, my = h * 0.18, ms = w * 0.28;
    g.fillStyle = '#FFFFFF'; g.fillRect(mx - 6, my - 6, ms + 12, ms + 12);
    g.fillStyle = C.ink; g.fillRect(mx, my, ms, ms);
    const cell = ms / 6, pat = [[0, 0, 0, 0, 0, 0], [0, 1, 0, 1, 1, 0], [0, 0, 1, 1, 0, 0], [0, 1, 1, 0, 1, 0], [0, 1, 0, 0, 1, 0], [0, 0, 0, 0, 0, 0]];
    g.fillStyle = '#FFFFFF'; pat.forEach((r, i) => r.forEach((v, j) => { if (v) g.fillRect(mx + j * cell, my + i * cell, cell, cell); }));
    // robot
    const rx = w * 0.3, ry = h * 0.74;
    wash(g, '#E9EFF7', (q) => rrect(q, rx - 34, ry - 30, 68, 34, 8)); sk(g, (q) => rrect(q, rx - 34, ry - 30, 68, 34, 8));
    wash(g, C.ink, (q) => { q.arc(rx - 20, ry + 6, 9, 0, 7); }); wash(g, C.ink, (q) => { q.arc(rx + 20, ry + 6, 9, 0, 7); });
    sk(g, (q) => { q.moveTo(rx + 20, ry - 30); q.lineTo(rx + 20, ry - 48); q.rect(rx + 12, ry - 58, 18, 12); });
    // camera sight line + path
    g.save(); g.setLineDash([5, 6]); sk(g, (q) => { q.moveTo(rx + 30, ry - 52); q.lineTo(mx, my + ms * 0.7); }, C.ox, 1.6); sk(g, (q) => { q.moveTo(rx - 40, ry + 22); q.quadraticCurveTo(w * 0.5, h * 0.95, w * 0.82, h * 0.72); }, 'rgba(107,31,36,0.5)', 1.6); g.restore();
    label(g, 'id 7', mx + 4, my + ms + 30, 20);
  },

  /* doodles on the page */
  p14(g, w, h) {
    const cx = w * 0.42, cy = h * 0.5;
    // hair
    wash(g, C.ink, (q) => { q.moveTo(cx - 40, cy + 18); q.quadraticCurveTo(cx - 52, cy - 48, cx, cy - 52); q.quadraticCurveTo(cx + 52, cy - 48, cx + 40, cy + 18); q.quadraticCurveTo(cx + 26, cy + 6, cx + 24, cy - 14); q.lineTo(cx - 24, cy - 14); q.quadraticCurveTo(cx - 26, cy + 6, cx - 40, cy + 18); }, 0.9);
    // face
    wash(g, '#F6E2D6', (q) => q.ellipse(cx, cy - 6, 25, 29, 0, 0, 7));
    sk(g, (q) => { q.ellipse(cx, cy - 6, 25, 29, 0, 0, 7); });
    sk(g, (q) => { q.moveTo(cx - 12, cy - 8); q.quadraticCurveTo(cx - 8, cy - 12, cx - 4, cy - 8); q.moveTo(cx + 4, cy - 8); q.quadraticCurveTo(cx + 8, cy - 12, cx + 12, cy - 8); q.moveTo(cx - 6, cy + 9); q.quadraticCurveTo(cx, cy + 14, cx + 6, cy + 9); }, C.ink, 1.8);
    wash(g, 'rgba(229,143,160,0.5)', (q) => { q.arc(cx - 15, cy + 4, 5, 0, 7); q.arc(cx + 15, cy + 4, 5, 0, 7); });
    // shoulders as folded paper
    wash(g, C.blush, (q) => { q.moveTo(cx - 44, cy + 70); q.lineTo(cx - 30, cy + 26); q.lineTo(cx, cy + 34); q.lineTo(cx + 30, cy + 26); q.lineTo(cx + 44, cy + 70); q.closePath(); });
    sk(g, (q) => { q.moveTo(cx - 44, cy + 70); q.lineTo(cx - 30, cy + 26); q.lineTo(cx, cy + 34); q.lineTo(cx + 30, cy + 26); q.lineTo(cx + 44, cy + 70); q.moveTo(cx, cy + 34); q.lineTo(cx, cy + 70); });
    DOODLE.plane(g, cx + 74, cy - 36, 0.75, C.ox);
  },
  p16(g, w, h) {
    const cx = w * 0.46, cy = h * 0.42;
    // antenna with heart
    sk(g, (q) => { q.moveTo(cx, cy - 52); q.lineTo(cx, cy - 72); }); DOODLE.heart(g, cx, cy - 80, 0.7, C.ox);
    // bob hair behind head
    wash(g, C.ink, (q) => { q.moveTo(cx - 52, cy + 24); q.quadraticCurveTo(cx - 60, cy - 58, cx, cy - 56); q.quadraticCurveTo(cx + 60, cy - 58, cx + 52, cy + 24); q.lineTo(cx + 40, cy + 24); q.lineTo(cx - 40, cy + 24); q.closePath(); }, 0.9);
    // head (screen)
    wash(g, '#E9EFF7', (q) => rrect(q, cx - 40, cy - 40, 80, 64, 18)); sk(g, (q) => rrect(q, cx - 40, cy - 40, 80, 64, 18));
    // bangs
    wash(g, C.ink, (q) => { q.moveTo(cx - 40, cy - 22); q.quadraticCurveTo(cx - 30, cy - 48, cx, cy - 46); q.quadraticCurveTo(cx + 30, cy - 48, cx + 40, cy - 22); q.quadraticCurveTo(cx + 10, cy - 32, cx - 40, cy - 22); }, 0.9);
    // happy eyes ^ ^ and blush
    sk(g, (q) => { q.moveTo(cx - 20, cy - 2); q.lineTo(cx - 13, cy - 9); q.lineTo(cx - 6, cy - 2); q.moveTo(cx + 6, cy - 2); q.lineTo(cx + 13, cy - 9); q.lineTo(cx + 20, cy - 2); q.moveTo(cx - 6, cy + 9); q.quadraticCurveTo(cx, cy + 14, cx + 6, cy + 9); }, C.ink, 2.2);
    wash(g, 'rgba(229,143,160,0.6)', (q) => { q.arc(cx - 24, cy + 6, 5, 0, 7); q.arc(cx + 24, cy + 6, 5, 0, 7); });
    // body
    wash(g, C.blush, (q) => rrect(q, cx - 30, cy + 30, 60, 56, 12)); sk(g, (q) => rrect(q, cx - 30, cy + 30, 60, 56, 12));
    DOODLE.heart(g, cx, cy + 56, 0.6, C.ox);
    // arms: one down, one waving
    sk(g, (q) => { q.moveTo(cx - 30, cy + 44); q.quadraticCurveTo(cx - 48, cy + 60, cx - 44, cy + 80); q.moveTo(cx + 30, cy + 44); q.quadraticCurveTo(cx + 56, cy + 30, cx + 62, cy + 2); });
    g.fillStyle = C.ink; g.beginPath(); g.arc(cx + 63, cy - 2, 6, 0, 7); g.fill();
    sk(g, (q) => { q.moveTo(cx + 74, cy - 18); q.quadraticCurveTo(cx + 82, cy - 8, cx + 80, cy + 4); q.moveTo(cx + 84, cy - 26); q.quadraticCurveTo(cx + 94, cy - 10, cx + 92, cy + 6); }, C.ox, 2);
    // feet
    wash(g, C.ink, (q) => { rrect(q, cx - 24, cy + 88, 18, 10, 4); rrect(q, cx + 6, cy + 88, 18, 10, 4); });
    label(g, 'bye for now!', cx - 50, h - 6, 24, C.ox, -0.04);
  },
};

/* ------------------------------------------------------------------ */
/* page base                                                            */
/* ------------------------------------------------------------------ */
let grainCanvas = null;
function grain() {
  if (grainCanvas) return grainCanvas;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const img = g.createImageData(256, 256);
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < img.data.length; i += 4) { const v = r() < 0.5 ? 70 : 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = r() * 14; }
  g.putImageData(img, 0, 0); return (grainCanvas = c);
}
function basePage(g, n, head) {
  const side = n % 2 ? 'R' : 'L';
  g.fillStyle = C.paper; g.fillRect(0, 0, PAGE_W, PAGE_H);
  g.fillStyle = g.createPattern(grain(), 'repeat'); g.fillRect(0, 0, PAGE_W, PAGE_H);
  const gx = side === 'R' ? 0 : PAGE_W, dir = side === 'R' ? 1 : -1;
  let lg = g.createLinearGradient(gx, 0, gx + dir * 100, 0);
  lg.addColorStop(0, 'rgba(70,50,28,0.30)'); lg.addColorStop(0.3, 'rgba(70,50,28,0.08)'); lg.addColorStop(1, 'rgba(70,50,28,0)');
  g.fillStyle = lg; g.fillRect(side === 'R' ? 0 : PAGE_W - 100, 0, 100, PAGE_H);
  const L = side === 'R' ? { x0: 100, x1: PAGE_W - 68 } : { x0: 68, x1: PAGE_W - 100 }; L.cw = L.x1 - L.x0; L.mid = (L.x0 + L.x1) / 2; L.side = side;
  if (head) caps(g, head, side === 'R' ? L.x1 : L.x0, 64, { size: 13, color: C.soft, align: side === 'R' ? 'right' : 'left' });
  if (n > 1) caps(g, `· ${n} ·`, L.mid, PAGE_H - 44, { size: 15, weight: 500, color: C.soft, align: 'center', ls: 0.12 });
  return L;
}

/* ------------------------------------------------------------------ */
/* the 16 pages                                                         */
/* ------------------------------------------------------------------ */
const PAGES = {
  /* 1 · title (right) */
  1(g, L, A) {
    caps(g, 'The personal edition · Vol. 01', L.x0, 118, { size: 14, color: C.ox });
    polaroid(g, A, 'p01', 512, 330, 330, 0.045, 'hi, I’m Kiti', { tape: C.tapeA, fy: 0.35 });
    DOODLE.star(g, 330, 210, 1); DOODLE.star(g, 300, 250, 0.6);
    txt(g, 'Kiti’s', L.x0 - 4, 672, { size: 128, fam: SERIF, weight: 600 });
    txt(g, 'Book', L.x0 - 4, 786, { size: 128, fam: SERIF, weight: 500, italic: true, color: C.ox });
    para(g, 'Things I’ve built, things I’ve learned, and the questions I’m still exploring.', L.x0, 846, 470, { size: 25, color: C.body });
    rule(g, L.x0, L.x1, 930, C.ink, 1.5);
    caps(g, 'Kiriti Nain · product, previously robotics', L.x0, 962, { size: 14, color: C.ink });
    note(g, 'turn the page →', L.x1 - 200, 1000, { size: 30, rot: -0.03 });
    return [];
  },
  /* 2 · contents (left) */
  2(g, L) {
    txt(g, 'Contents', L.x0, 170, { size: 70, fam: SERIF, weight: 600 });
    rule(g, L.x0, L.x1, 196, C.ink, 2);
    const hs = [];
    clipNote(g, L.x0 - 4, 232, L.cw + 4, 230, -0.012, (c, w) => {
      caps(c, 'Chapter 02 · now writing', 28, 34, { size: 14, color: C.ox });
      leaderRow(c, 28, w - 40, 96, 'Product', '3', { size: 50 });
      para(c, 'Payments, matches, and building from zero.', 28, 142, w - 70, { size: 23, color: C.ink, weight: 500 });
    });
    hs.push({ x: L.x0 - 10, y: 228, w: L.cw + 20, h: 250, go: 3 });
    const rows = [
      ['Robotics', '9', 'Where I learned to build for the real world.', 'robot'],
      ['Wins', '13', 'Hackathons and competitions.', 'star'],
      ['The Margins', '14', 'Things I write.', 'plane'],
      ['About me', '15', 'And how to say hi.', 'heart'],
    ];
    caps(g, 'Chapter 01', L.x0, 560, { size: 13 });
    let y = 600;
    rows.forEach(([title, num, line, dd]) => {
      leaderRow(g, L.x0, L.x1, y, title, num, { size: 36, doodle: (gx) => DOODLE[dd](g, gx + 26, y - 12, dd === 'plane' ? 0.6 : 0.7, C.ox), doodleW: 56 });
      para(g, line, L.x0, y + 36, L.cw - 60, { size: 21, color: C.soft });
      hs.push({ x: L.x0, y: y - 46, w: L.cw, h: 100, go: +num }); y += 104;
    });
    note(g, 'tap a chapter to jump there', L.x1 - 270, 112, { size: 28, rot: -0.03 });
    return hs;
  },
  /* 3 · chapter 02 opener (right) */
  3(g, L) {
    g.save(); font(g, 300, SERIF, 700); g.fillStyle = C.blush; g.fillText('02', L.x0 - 14, 330); g.lineWidth = 2; g.strokeStyle = C.blushInk; g.strokeText('02', L.x0 - 14, 330); g.restore();
    DOODLE.bulb(g, L.x1 - 70, 170, 1.4, C.ox);
    caps(g, 'Chapter two · now writing', L.x0, 400, { size: 15, color: C.ox });
    txt(g, 'Product', L.x0 - 4, 500, { size: 112, fam: SERIF, weight: 600 });
    para(g, 'I used to ask “can we build it?”\nNow I ask “should we, and for whom?”', L.x0, 560, L.cw, { size: 27, fam: SERIF, weight: 400, italic: true, color: C.body, lh: 38 });
    clipNote(g, L.x0 - 6, 640, L.cw + 6, 300, 0.012, (c, w) => {
      [['3% → 8%', 'women going premium'], ['587K+', 'interests analysed'], ['20+', 'first users, before launch']].forEach(([big, small], i) => {
        const y = 66 + i * 80;
        txt(c, big, 26, y, { size: 50, fam: SERIF, weight: 700, color: C.ox });
        txt(c, small, 270, y - 6, { size: 22, color: C.ink, weight: 600 });
        if (i < 2) rule(c, 26, w - 40, y + 22, 'rgba(62,23,25,0.18)', 1.2);
      });
    });
    return [];
  },
  /* 4 · Goalwit Tech, payments (left) */
  4(g, L, A) {
    caps(g, 'Product Management Intern · Goalwit Tech', L.x0, 118, { size: 14, color: C.ox });
    caps(g, 'Apr – Aug 2026', L.x0, 142, { size: 13 });
    txt(g, 'Making it', L.x0, 222, { size: 58, fam: SERIF, weight: 600 });
    txt(g, 'easier to pay', L.x0, 286, { size: 58, fam: SERIF, weight: 600 });
    clipNote(g, L.x0 - 4, 330, 372, 330, -0.025, (c, w) => {
      txt(c, '3% → 8%', 26, 92, { size: 70, fam: SERIF, weight: 700, color: C.ox });
      txt(c, 'women on premium', 28, 128, { size: 22, weight: 600, color: C.ink });
      rule(c, 26, w - 30, 160, 'rgba(62,23,25,0.25)', 1.5);
      txt(c, '15% → 18%', 26, 226, { size: 48, fam: SERIF, weight: 700, color: C.ox });
      txt(c, 'men on premium', 28, 260, { size: 22, weight: 600, color: C.ink });
    });
    phone(g, A, 'p04a', 512, 480, 132, -0.07);
    phone(g, A, 'p04b', 628, 506, 132, 0.06);
    note(g, 'before → after', 470, 316, { size: 28, rot: -0.04 });
    let y = bullets(g, ['Rebuilt the payment journey, screen by screen.', 'Fixed where people dropped off in the funnel.', 'Added the local payment methods people already use.'], L.x0, 730, L.cw, { size: 24, gap: 8 });
    tags(g, ['Funnels', 'UX', 'Payments'], L.x0, y + 26, L.cw);
    note(g, 'small fixes, big jump for women', L.x1 - 330, 948, { size: 28, rot: -0.02 });
    return [];
  },
  /* 5 · Goalwit Tech, matches (right) */
  5(g, L) {
    caps(g, 'Goalwit Tech · match quality', L.x0, 118, { size: 14, color: C.ox });
    para(g, 'Finding where good matches come from', L.x0, 182, L.cw, { size: 48, fam: SERIF, weight: 600, color: C.ink, lh: 56 });
    stat(g, '587K+', 'interests, queried in SQL', L.x0, 340, { size: 88, smallSize: 23 });
    // chart: accept rate with vs without a message
    const cx = L.x0, cy = 440, cw = L.cw, max = 21, unit = (cw - 150) / max;
    caps(g, 'Accept rate, compared to no message', cx, cy, { size: 13 });
    const rows = [['no message', 1, 1], ['with a message', 6.8, 20.5]];
    rows.forEach(([lab, lo, hi], i) => {
      const y = cy + 30 + i * 62;
      txt(g, lab, cx, y + 24, { size: 19, weight: 500, color: C.body });
      const bx = cx + 150;
      g.fillStyle = i ? C.ox : C.dot; g.fillRect(bx, y + 4, lo * unit, 30);
      if (hi > lo) { g.fillStyle = 'rgba(107,31,36,0.28)'; g.fillRect(bx + lo * unit, y + 4, (hi - lo) * unit, 30); }
      txt(g, i ? '6.8x – 20.5x' : '1x', bx + (i ? 10 : lo * unit + 10), y + 26, { size: 20, weight: 700, color: i ? '#FFFFFF' : C.soft });
    });
    clipNote(g, L.x0 - 6, 596, L.cw + 6, 280, 0.015, (c, w) => {
      txt(c, '60.83%', 26, 84, { size: 62, fam: SERIF, weight: 700, color: C.ox });
      para(c, 'of accepted matches started on the Activity screen, so I moved the Matching Card redesign up the list.', 26, 124, w - 70, { size: 21, color: C.ink, weight: 500, lh: 28 });
      const pw = txt(c, '26.32%', 26, 226, { size: 36, fam: SERIF, weight: 700, color: C.ox });
      txt(c, 'premium message-attach rate', 26 + pw + 14, 224, { size: 20, color: C.ink, weight: 500 });
    }, { clipScale: 0.8 });
    const dw = txt(g, '6 PRDs', L.x0, 950, { size: 38, fam: SERIF, weight: 700, color: C.ox });
    txt(g, 'written, across trust & safety', L.x0 + dw + 14, 948, { size: 21, color: C.body, weight: 500 });
    note(g, 'the data rewrote', L.x1 - 190, 300, { size: 27, rot: -0.05 });
    note(g, 'my roadmap', L.x1 - 160, 330, { size: 27, rot: -0.05 });
    return [];
  },
  /* 6 · Xander-Corp (left) */
  6(g, L, A) {
    caps(g, 'Product Strategy & GTM · Xander-Corp', L.x0, 118, { size: 14, color: C.ox });
    caps(g, 'Nov 2025 – Feb 2026', L.x0, 142, { size: 13 });
    para(g, 'From an idea to its first users', L.x0, 214, 520, { size: 52, fam: SERIF, weight: 600, color: C.ink, lh: 60 });
    clipNote(g, L.x0 - 4, 320, 300, 250, -0.03, (c) => {
      txt(c, '20+', 26, 132, { size: 108, fam: SERIF, weight: 700, color: C.ox });
      para(c, 'activated users, before launch', 28, 174, 230, { size: 21, color: C.ink, weight: 600, lh: 27 });
    });
    browser(g, A, 'p06', 400, 350, 290, 200, 0.03);
    // the path
    const steps = ['concept', 'talk to users', 'ICP + pricing', 'onboarding', '20+ users'];
    const y0 = 660, x0 = L.x0 + 10, gap = (L.cw - 40) / (steps.length - 1);
    ink(g, 2.5, C.ox); g.setLineDash([6, 8]); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + gap * 4, y0); g.stroke(); g.setLineDash([]);
    steps.forEach((s, i) => { const x = x0 + gap * i; g.fillStyle = i === 4 ? C.ox : C.paper; g.beginPath(); g.arc(x, y0, 10, 0, 7); g.fill(); ink(g, 2.5, C.ox); g.stroke(); font(g, 18, SANS, 600); g.fillStyle = C.ink; g.textAlign = 'center'; g.fillText(s, x, y0 + 38); g.textAlign = 'left'; });
    let y = bullets(g, ['Ran user discovery to find who it’s for and how to price it.', 'Used early feedback to fix onboarding and sharpen positioning.'], L.x0, 770, L.cw, { size: 24, gap: 8 });
    tags(g, ['Discovery', 'ICP', 'Pricing', 'GTM'], L.x0, y + 24, L.cw);
    note(g, 'talk to users first. always.', L.x1 - 300, 622, { size: 28, rot: -0.03 });
    return [];
  },
  /* 7 · Overlane (right) */
  7(g, L, A) {
    caps(g, 'Built · Aug 2026', L.x0, 118, { size: 14, color: C.ox });
    txt(g, 'Overlane', L.x0, 196, { size: 70, fam: SERIF, weight: 600 });
    txt(g, 'status updates that write themselves', L.x0, 240, { size: 27, fam: SERIF, italic: true, color: C.ox });
    para(g, 'Turns your GitHub activity into a private daily summary, and flags what’s blocked.', L.x0, 296, L.cw, { size: 24, color: C.body });
    browser(g, A, 'p07', L.x0, 370, L.cw, 300, -0.01);
    // rules decide / AI explains
    const y = 730, half = (L.cw - 24) / 2;
    [['Rules decide', 'Review delays, CI failures, stale work, cross-team dependencies.'], ['AI explains', 'Gemini only words the findings, so it can’t invent activity.']].forEach(([h, t], i) => {
      const x = L.x0 + i * (half + 24);
      txt(g, h, x, y, { size: 30, fam: SERIF, weight: 700, color: C.ox });
      para(g, t, x, y + 36, half - 6, { size: 21, color: C.body, lh: 28 });
    });
    tags(g, ['FastAPI', 'GitHub OAuth', 'Gemini'], L.x0, 930, L.cw);
    txt(g, 'try it →', L.x1, 965, { size: 22, weight: 700, color: C.ox, align: 'right' });
    return [{ x: L.x1 - 120, y: 935, w: 120, h: 44, href: LINKS.overlane }];
  },
  /* 8 · Notes + FinToolekt (left) */
  8(g, L, A) {
    caps(g, 'Built · Aug 2026', L.x0, 118, { size: 14, color: C.ox });
    txt(g, 'Notes', L.x0, 196, { size: 70, fam: SERIF, weight: 600 });
    txt(g, 'a private place for two', L.x0, 240, { size: 27, fam: SERIF, italic: true, color: C.ox });
    phone(g, A, 'p08a', L.x0 + 380, 470, 150, -0.06);
    phone(g, A, 'p08b', L.x0 + 520, 500, 150, 0.07);
    para(g, 'Text, photos and voice notes, with a separate space for each person.', L.x0, 316, 290, { size: 23, color: C.body, lh: 31 });
    para(g, 'Every space keeps its own read states, notifications and home-screen widget.', L.x0, 470, 290, { size: 21, color: C.soft, lh: 29 });
    tags(g, ['React Native', 'NestJS', 'MongoDB', 'AWS S3', 'Firebase'], L.x0, 680, L.cw);
    clipNote(g, L.x0, 760, L.cw - 10, 200, -0.012, (c, w) => {
      txt(c, 'FinToolekt', 26, 56, { size: 34, fam: SERIF, weight: 700, color: C.ox });
      caps(c, 'Jun 2025', w - 140, 52, { size: 13, color: C.ink });
      para(c, 'Turned auditors’ needs into ML features that flag inconsistencies in financial records.', 26, 98, w - 80, { size: 21, color: C.ink, weight: 500, lh: 28 });
    }, { clipScale: 0.75 });
    return [{ x: L.x0, y: 170, w: 300, h: 100, href: LINKS.notes }];
  },
  /* 9 · chapter 01 opener: blueprint (right) */
  9(g, L, A) {
    const bx = L.x0 - 34, by = 90, bw = L.cw + 60, bh = 860;
    g.save(); shadow(g, 20, 10, 0.3); g.fillStyle = C.navy; g.fillRect(bx, by, bw, bh); noShadow(g);
    g.beginPath(); g.rect(bx, by, bw, bh); g.clip();
    if (A.p09) { const ih = bh - 40, iw = ih * (A.p09.naturalWidth / A.p09.naturalHeight); g.drawImage(A.p09, bx + bw - iw + 40, by + 20, iw, ih); }
    else slotBox(g, bx + bw - 320, by + 40, 280, 520, 'p09', SLOTS.p09.what, true);
    g.globalCompositeOperation = 'screen'; g.strokeStyle = C.navyLine; g.lineWidth = 1;
    for (let x = bx; x < bx + bw; x += 32) { g.beginPath(); g.moveTo(x, by); g.lineTo(x, by + bh); g.stroke(); }
    for (let y = by; y < by + bh; y += 32) { g.beginPath(); g.moveTo(bx, y); g.lineTo(bx + bw, y); g.stroke(); }
    g.globalCompositeOperation = 'source-over';
    const sh2 = g.createLinearGradient(bx, 0, bx + bw * 0.75, 0); sh2.addColorStop(0, 'rgba(16,18,27,0.92)'); sh2.addColorStop(0.7, 'rgba(16,18,27,0.6)'); sh2.addColorStop(1, 'rgba(16,18,27,0)');
    g.fillStyle = sh2; g.fillRect(bx, by + 500, bw, 360);
    g.strokeStyle = 'rgba(228,236,250,0.5)'; g.lineWidth = 1.5; g.strokeRect(bx + 14, by + 14, bw - 28, bh - 28);
    caps(g, 'Chapter one · a previous chapter', bx + 40, by + 70, { size: 14, color: C.iceSoft });
    g.save(); font(g, 200, SERIF, 700); g.lineWidth = 1.5; g.strokeStyle = 'rgba(228,236,250,0.55)'; g.strokeText('01', bx + 34, by + 270); g.restore();
    txt(g, 'Robotics', bx + 40, by + 600, { size: 96, fam: SERIF, weight: 600, color: '#FFFFFF' });
    para(g, 'Before products, there were robots. As a core member of ATOM Robotics Lab, I built autonomous robots, mentored juniors and ran workshops.', bx + 42, by + 658, 400, { size: 22, color: C.ice, lh: 31 });
    g.restore();
    tape(g, bx + 30, by + 4, 90, -0.4, C.tapeC); tape(g, bx + bw - 30, by + bh - 4, 90, -0.4, C.tapeC);
    note(g, 'where I learned to build for the real world', bx + 40, by + bh - 40, { size: 27, rot: -0.02, color: '#F2B8B0' });
    return [];
  },
  /* 10 · research (left) */
  10(g, L, A) {
    caps(g, 'Research internships', L.x0, 118, { size: 14, color: C.ox });
    // IIT Delhi
    const py = 150;
    g.save(); shadow(g, 16, 8, 0.25); g.fillStyle = C.navy; g.fillRect(L.x0, py, L.cw, 250); noShadow(g); g.restore();
    g.save(); g.beginPath(); g.rect(L.x0, py, L.cw, 250); g.clip(); g.strokeStyle = C.navyLine; for (let x = L.x0; x < L.x1; x += 28) { g.beginPath(); g.moveTo(x, py); g.lineTo(x, py + 250); g.stroke(); } for (let y = py; y < py + 250; y += 28) { g.beginPath(); g.moveTo(L.x0, y); g.lineTo(L.x1, y); g.stroke(); } g.restore();
    wireCar(g, L.x0 + 70, py + 60, 1.65);
    note(g, 'LiDAR', L.x0 + 290, py + 52, { size: 26, color: C.ice, rot: -0.05 });
    note(g, 'SLAM', L.x0 + 520, py + 222, { size: 26, color: C.ice, rot: 0.03 });
    txt(g, 'IIT Delhi', L.x0, 470, { size: 40, fam: SERIF, weight: 700 });
    caps(g, 'Industrial R&D Unit · Sep 2024 – Jan 2025', L.x0, 500, { size: 13 });
    para(g, 'Owned the requirements for autonomous navigation on electric vehicles, and built the navigation pipeline.', L.x0, 544, L.cw, { size: 23, color: C.body, lh: 31 });
    tags(g, ['ROS 2', 'Autoware', 'SLAM'], L.x0, 640, L.cw);
    rule(g, L.x0, L.x1, 676);
    // IIIT Hyderabad
    txt(g, 'IIIT Hyderabad', L.x0, 740, { size: 40, fam: SERIF, weight: 700 });
    caps(g, 'Research Intern · Jul – Oct 2025', L.x0, 770, { size: 13 });
    para(g, 'Built reinforcement-learning control policies for robots in Isaac Lab, toward vision-language-action models.', L.x0, 814, 380, { size: 22, color: C.body, lh: 30 });
    tags(g, ['RL', 'Isaac Lab'], L.x0, 960, 380);
    browser(g, A, 'p10b', L.x0 + 410, 720, L.cw - 410, 220, 0.04);
    return [];
  },
  /* 11 · things I built (right) */
  11(g, L, A) {
    caps(g, 'Things I built', L.x0, 118, { size: 14, color: C.ox });
    polaroid(g, A, 'p11a', L.x0 + 150, 330, 290, -0.05, 'MR Robot 2.0', { tape: C.tapeC });
    txt(g, 'MR Robot 2.0', L.x0 + 330, 230, { size: 38, fam: SERIF, weight: 700 });
    caps(g, '2024 – now · ATOM', L.x0 + 330, 260, { size: 13 });
    para(g, 'A robot that maps a room and finds its own way. Three modes: mapping, navigation, remote control.', L.x0 + 330, 304, L.cw - 330, { size: 21, color: C.body, lh: 29 });
    tags(g, ['ROS 2', 'SLAM', 'LiDAR'], L.x0 + 330, 470, L.cw - 330);
    polaroid(g, A, 'p11b', L.x1 - 150, 720, 290, 0.05, 'ArUco bot', { tape: C.tapeB });
    txt(g, 'ArUco', L.x0, 640, { size: 38, fam: SERIF, weight: 700 });
    txt(g, 'Navigation', L.x0, 682, { size: 38, fam: SERIF, weight: 700 });
    caps(g, '2024', L.x0, 712, { size: 13 });
    para(g, 'A robot that steers by reading printed markers. Simulated in Gazebo, packaged in Docker.', L.x0, 756, 300, { size: 21, color: C.body, lh: 29 });
    tags(g, ['OpenCV', 'Gazebo'], L.x0, 905, 300);
    note(g, 'it finally drove straight!', L.x0 + 10, 560, { size: 28, rot: -0.04 });
    return [{ x: L.x0, y: 600, w: 300, h: 120, href: 'https://github.com/kirinain/aruco_navigation_ros2' }];
  },
  /* 12 · lessons (left) */
  12(g, L) {
    caps(g, 'Between the chapters', L.x0, 118, { size: 14, color: C.ox });
    para(g, 'What robots taught me about products', L.x0, 190, L.cw, { size: 50, fam: SERIF, weight: 600, color: C.ink, lh: 58 });
    const lessons = [
      ['floor', 'Floors are never flat.', 'Real users never match the plan, so test early.'],
      ['speech', 'Say exactly what you mean.', 'A robot can’t guess your requirements, and neither can a team.'],
      ['loop', 'Small loops win.', 'Sense, decide, act, repeat. Shipping works the same way.'],
    ];
    let y = 370;
    lessons.forEach(([d, h, t], i) => {
      g.fillStyle = C.blush; g.beginPath(); g.arc(L.x0 + 46, y - 10, 46, 0, 7); g.fill();
      DOODLE[d](g, L.x0 + 46, y - 8, 1, C.ox);
      txt(g, `${['i', 'ii', 'iii'][i]}.`, L.x0 + 116, y - 26, { size: 22, fam: SERIF, italic: true, color: C.ox });
      txt(g, h, L.x0 + 116, y + 8, { size: 32, fam: SERIF, weight: 700 });
      para(g, t, L.x0 + 116, y + 46, L.cw - 116, { size: 22, color: C.body, lh: 30 });
      y += 200;
    });
    note(g, 'same instincts, different machines', L.x0 + 120, 950, { size: 28, rot: -0.02 });
    return [];
  },
  /* 13 · wins (right) */
  13(g, L, A) {
    caps(g, 'Wins', L.x0, 118, { size: 14, color: C.ox });
    polaroid(g, A, 'p13', L.mid + 10, 300, 470, -0.03, 'the team ♡', { ratio: 0.75, tape: C.tapeA });
    const rows = [
      ['Top 600', 'of 25,000 · Eureka!, IIT Bombay E-Cell · 2024', ''],
      ['1st', 'Empowher Hackathon, IIIT Delhi · 2023', 'She-ksha: an AR/VR classroom and chatbot for rural women.'],
      ['3rd', 'ML Code Crunch, DTU · 2024', 'SereneHub: emotion detection with mood-lifting suggestions.'],
    ];
    let y = 610;
    rows.forEach(([big, line, sub]) => {
      const w = txt(g, big, L.x0, y, { size: 54, fam: SERIF, weight: 700, color: C.ox });
      para(g, line, L.x0 + Math.max(w, 120) + 20, y - 22, L.cw - Math.max(w, 120) - 20, { size: 20, color: C.ink, weight: 600, lh: 26 });
      if (sub) para(g, sub, L.x0 + Math.max(w, 120) + 20, y + 14, L.cw - Math.max(w, 120) - 20, { size: 19, color: C.soft, lh: 25 });
      y += 112;
    });
    DOODLE.star(g, L.x1 - 20, 580, 1.2);
    caps(g, 'Also · Refine Consulting Club, strategy sims & case comps', L.x0, 955, { size: 12, color: C.soft });
    return [];
  },
  /* 14 · the margins (left) */
  14(g, L, A) {
    caps(g, 'Interlude · things I write', L.x0, 118, { size: 14, color: C.ox });
    txt(g, 'The Margins', L.x0, 200, { size: 66, fam: SERIF, weight: 600 });
    const items = [
      ['Medium · Feb 2026', 'The exact mechanics of the Iron Man suit?', '“The suit doesn’t fight physics, it uses it.”', LINKS.ironman],
      ['Medium · Jan 2026', 'Are we becoming shallow because of AI?', 'AI helps when you use it on purpose, and dulls you when you lean on it blindly.', LINKS.shallow],
      ['My corner online', 'Kiti’s Room', 'Audio summaries, a song of the week, little personal notes.', LINKS.kitisRoom],
    ];
    const hs = []; let y = 290;
    items.forEach(([lab, title, line, href]) => {
      rule(g, L.x0, L.x1, y - 46);
      caps(g, lab, L.x0, y - 14, { size: 12 });
      const ny = para(g, title, L.x0, y + 24, L.cw - 150, { size: 30, fam: SERIF, weight: 700, color: C.ink, lh: 36 });
      const ey = para(g, line, L.x0, ny + 4, L.cw - 150, { size: 21, color: C.soft, italic: line.startsWith('“'), lh: 28 });
      txt(g, 'read →', L.x1, y + 24, { size: 19, weight: 700, color: C.ox, align: 'right' });
      hs.push({ x: L.x0, y: y - 46, w: L.cw, h: ey - y + 50, href }); y = ey + 64;
    });
    if (A.p14) drawCover(g, A.p14, L.x1 - 200, 800, 190, 190); else { g.save(); g.translate(L.x1 - 210, 790); ILL.p14(g, 210, 190); g.restore(); }
    para(g, 'More on Medium @kitinain and Substack @xkiti.', L.x0, 850, 330, { size: 20, color: C.soft });
    note(g, 'a paper girl in a paper world', L.x0, 948, { size: 28, rot: -0.02 });
    return hs;
  },
  /* 15 · about (right) */
  15(g, L, A) {
    caps(g, 'Back matter', L.x0, 118, { size: 14, color: C.ox });
    polaroid(g, A, 'p15', L.x1 - 150, 300, 290, 0.05, 'me, mid-thought', { tape: C.tapeB, fy: 0.3 });
    txt(g, 'About', L.x0, 210, { size: 70, fam: SERIF, weight: 600 });
    txt(g, 'me', L.x0, 280, { size: 70, fam: SERIF, weight: 500, italic: true, color: C.ox });
    para(g, 'I’m Kiriti, Kiti to friends. I like problems where data, people and a little engineering meet.', L.x0, 340, 300, { size: 23, color: C.body, lh: 32 });
    rule(g, L.x0, L.x1, 530);
    caps(g, 'Education', L.x0, 568, { size: 13 });
    txt(g, 'B.Tech, Electrical & Electronics Eng.', L.x0, 606, { size: 25, fam: SERIF, weight: 700 });
    para(g, 'Maharaja Agrasen Institute of Technology, Delhi · 2022 – 2026', L.x0, 640, 380, { size: 20, color: C.soft, lh: 27 });
    stat(g, '8.2', 'GPA', L.x1 - 110, 640, { size: 64, smallSize: 18, gap: 30, maxW: 110 });
    rule(g, L.x0, L.x1, 710);
    caps(g, 'Learning', L.x0, 748, { size: 13 });
    para(g, 'IBM Product Management Professional Certificate (2026) · BCG Strategy Consulting Virtual Experience', L.x0, 784, L.cw, { size: 21, color: C.body, lh: 29 });
    caps(g, 'Toolkit', L.x0, 880, { size: 13 });
    tags(g, ['SQL', 'Figma', 'Jira', 'Notion', 'Python', 'Excel'], L.x0, 924, L.cw);
    return [];
  },
  /* 16 · next chapter (left) */
  16(g, L, A) {
    g.fillStyle = C.blush; g.fillRect(L.x0 - 20, 100, L.cw + 40, 380);
    txt(g, 'The next chapter', L.x0, 210, { size: 54, fam: SERIF, weight: 600 });
    txt(g, 'is unwritten.', L.x0, 274, { size: 54, fam: SERIF, weight: 500, italic: true, color: C.ox });
    para(g, 'I’m looking for product roles where I can own a problem from the data to the launch. Let’s talk.', L.x0, 340, L.cw - 30, { size: 24, color: C.ink, lh: 33 });
    const rows = [['Email', 'kitinain@gmail.com', LINKS.email], ['LinkedIn', 'in/kiritinain', LINKS.linkedin], ['GitHub', 'kirinain', LINKS.github], ['X', '@NainKiriti', LINKS.x], ['Medium', '@kitinain', LINKS.medium], ['Substack', '@xkiti', LINKS.substack], ['Résumé', 'download PDF →', LINKS.resume]];
    const hs = []; let y = 550;
    rows.forEach(([lab, val, href]) => {
      caps(g, lab, L.x0, y, { size: 13, color: C.soft });
      txt(g, val, L.x0 + 130, y + 2, { size: 23, weight: 600, color: lab === 'Résumé' ? C.ox : C.ink });
      rule(g, L.x0, L.x0 + 380, y + 18, C.rule, 1);
      hs.push({ x: L.x0, y: y - 30, w: 400, h: 50, href }); y += 52;
    });
    if (A.p16) drawCover(g, A.p16, L.x1 - 190, 640, 190, 230); else { g.save(); g.translate(L.x1 - 200, 640); ILL.p16(g, 200, 250); g.restore(); }
    note(g, 'still writing this chapter', L.x0 + 140, 948, { size: 30, rot: -0.02 });
    return hs;
  },
};

const HEADS = { 3: '', 4: 'Chapter 02 · Product', 5: 'Kiti’s Book', 6: 'Chapter 02 · Product', 7: 'Kiti’s Book', 8: 'Chapter 02 · Product', 10: 'Chapter 01 · Robotics', 11: 'Kiti’s Book', 12: 'Chapter 01 · Robotics', 13: 'Kiti’s Book', 14: 'Kiti’s Book', 15: 'Kiti’s Book', 16: 'Kiti’s Book' };

export function drawBookPage(n, ctx, opts = {}) {
  const scale = opts.scale || 1, A = opts.assets || {};
  ctx.save(); ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const L = basePage(ctx, n, HEADS[n]);
  const hs = (PAGES[n] ? PAGES[n](ctx, L, A) : []) || [];
  ctx.restore();
  return hs;
}

/** Loads every slot image that exists in /public/book. Missing files are skipped. */
export function loadBookAssets(base = '/book/') {
  return Promise.all(Object.entries(SLOTS).map(([k, s]) => new Promise((res) => {
    const img = new Image(); img.decoding = 'async';
    img.onload = () => res([k, img]); img.onerror = () => res([k, null]); img.src = base + s.file;
  }))).then((pairs) => Object.fromEntries(pairs.filter(([, v]) => v)));
}

export const BOOK_FONTS = ['600 40px "Fraunces"', 'italic 500 40px "Fraunces"', '700 40px "Fraunces"', '400 20px "DM Sans"', '500 20px "DM Sans"', '600 20px "DM Sans"', '700 20px "DM Sans"', '600 30px "Caveat"'];

/* ------------------------------------------------------------------ */
/* cover + endpapers (the bookplate inside the cover)                   */
/* ------------------------------------------------------------------ */
export const COVER_W = 1000;
export const COVER_H = 1358;
export const BOOK_THEME = { cloth: '#E8BDB7', ink: '#8A4A50', end: '#F6E2DF', endInk: '#D6A09A' };
const GOLD = ['#F1DDAA', '#C39A55', '#EBD49A', '#B28A4B'];

/**
 * Front cover art. `pass` = 'color' | 'metal' | 'rough' | 'bump', so the 3D cover can use
 * matching color / metalness / roughness / bump maps (the gold foil shines, the title is pressed in).
 * ctx must be COVER_W × COVER_H.
 */
export function drawBookCover(g, pass = 'color', theme = BOOK_THEME) {
  const w = COVER_W, h = COVER_H;
  const bg = { color: theme.cloth, metal: '#000000', rough: '#e0e0e0', bump: '#9a9a9a' }[pass];
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (pass === 'color' || pass === 'bump') {
    g.save(); g.globalAlpha = pass === 'color' ? 0.03 : 0.2;
    for (let y = 0; y < h; y += 3) { g.fillStyle = (y / 3) % 2 ? '#000' : '#fff'; g.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 3) { g.fillStyle = (x / 3) % 2 ? '#000' : '#fff'; g.fillRect(x, 0, 1, h); }
    g.restore();
  }
  let gold;
  if (pass === 'color') { gold = g.createLinearGradient(0, 0, w, h); GOLD.forEach((c, i) => gold.addColorStop(i / 3, c)); }
  else gold = { metal: '#ffffff', rough: '#5a5a5a', bump: '#5c5c5c' }[pass];
  const ink = { color: theme.ink, metal: '#000000', rough: '#d0d0d0', bump: '#555555' }[pass];
  g.strokeStyle = gold; g.lineWidth = 4; g.strokeRect(46, 46, w - 92, h - 92); g.lineWidth = 1.5; g.strokeRect(62, 62, w - 124, h - 124);
  const ax0 = 170, ax1 = w - 170, top = 460, base = h - 250, r = (ax1 - ax0) / 2, cx = w / 2;
  const arch = (i) => { g.beginPath(); g.moveTo(ax0 + i, base - i); g.lineTo(ax0 + i, top); g.arc(cx, top, r - i, Math.PI, 0); g.lineTo(ax1 - i, base - i); g.closePath(); };
  g.lineWidth = 3.5; arch(0); g.stroke(); g.lineWidth = 1.2; arch(14); g.stroke();
  const sparkle = (x, y, s) => { g.beginPath(); g.moveTo(x, y - s); g.quadraticCurveTo(x, y, x + s, y); g.quadraticCurveTo(x, y, x, y + s); g.quadraticCurveTo(x, y, x - s, y); g.quadraticCurveTo(x, y, x, y - s); g.fill(); };
  g.fillStyle = gold; g.beginPath(); g.arc(cx, top - 150, 34, 0, Math.PI * 2); g.fill();
  g.fillStyle = bg; g.beginPath(); g.arc(cx + 15, top - 160, 30, 0, Math.PI * 2); g.fill();
  g.fillStyle = gold; [[cx - 150, top - 120, 16], [cx + 140, top - 90, 12], [cx - 90, top - 210, 9], [cx + 90, top - 225, 14], [cx - 230, top - 20, 10], [cx + 235, top - 30, 11]].forEach((p) => sparkle(...p));
  const spaced = (s, y, size, ls, color) => { font(g, size, SANS, 600); g.fillStyle = color; s = s.toUpperCase(); const sp = size * ls; let tw = 0; for (const ch of s) tw += g.measureText(ch).width + sp; tw -= sp; let x = (w - tw) / 2; for (const ch of s) { g.fillText(ch, x, y); x += g.measureText(ch).width + sp; } };
  spaced('The personal edition', top + 40, 20, 0.3, ink);
  g.fillStyle = ink; g.textAlign = 'center';
  font(g, 150, SERIF, 600); g.fillText('Kiti’s', cx, top + 250);
  font(g, 150, SERIF, 500, true); g.fillText('Book', cx, top + 400); g.textAlign = 'left';
  g.fillStyle = gold; g.fillRect(cx - 120, top + 470, 92, 2); g.fillRect(cx + 28, top + 470, 92, 2);
  g.save(); g.translate(cx, top + 471); g.rotate(Math.PI / 4); g.fillRect(-7, -7, 14, 14); g.restore();
  spaced('Vol. 01', top + 545, 17, 0.32, ink);
  spaced('Kiriti Nain', h - 150, 24, 0.34, pass === 'color' ? '#9C7438' : gold);
}

/** Endpaper: front = the "Ex libris · Kiriti Nain" bookplate, back = "The end, for now." ctx must be PAGE_W × PAGE_H × scale. */
export function drawEndpaper(g, front = true, opts = {}) {
  const theme = opts.theme || BOOK_THEME, scale = opts.scale || 1;
  g.save(); g.setTransform(scale, 0, 0, scale, 0, 0);
  g.fillStyle = theme.end; g.fillRect(0, 0, PAGE_W, PAGE_H);
  g.fillStyle = theme.endInk; g.globalAlpha = 0.5;
  for (let y = 30; y < PAGE_H; y += 64) for (let x = (Math.round(y / 64) % 2) ? 62 : 30; x < PAGE_W; x += 64) { DOODLE.heart(g, x, y, 0.45, theme.endInk); g.beginPath(); g.arc(x + 32, y + 32, 2, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1; g.fillStyle = g.createPattern(grain(), 'repeat'); g.fillRect(0, 0, PAGE_W, PAGE_H);
  const bw = 440, bh = 330, bx = (PAGE_W - bw) / 2, by = (PAGE_H - bh) / 2 - 20;
  shadow(g, 16, 6, 0.18); g.fillStyle = '#FBF7EE'; g.fillRect(bx, by, bw, bh); noShadow(g);
  g.strokeStyle = theme.endInk; g.lineWidth = 1.5; g.strokeRect(bx + 12, by + 12, bw - 24, bh - 24); g.strokeRect(bx + 18, by + 18, bw - 36, bh - 36);
  if (front) {
    caps(g, 'Ex libris', PAGE_W / 2, by + 68, { size: 13, color: theme.ink, align: 'center', ls: 0.24 });
    txt(g, 'This book belongs to', PAGE_W / 2, by + 128, { size: 26, fam: SERIF, italic: true, color: C.body, align: 'center' });
    txt(g, 'Kiriti Nain', PAGE_W / 2, by + 208, { size: 66, fam: HAND, weight: 600, color: theme.ink, align: 'center' });
    rule(g, PAGE_W / 2 - 130, PAGE_W / 2 + 130, by + 226, C.dot, 1.2);
    caps(g, 'Kiti’s Book · Vol. 01', PAGE_W / 2, by + 276, { size: 12, color: C.soft, align: 'center' });
  } else {
    txt(g, 'The end,', PAGE_W / 2, by + 130, { size: 48, fam: SERIF, weight: 600, color: C.ink, align: 'center' });
    txt(g, 'for now.', PAGE_W / 2, by + 184, { size: 48, fam: SERIF, weight: 500, italic: true, color: theme.ink, align: 'center' });
    txt(g, 'more chapters soon', PAGE_W / 2, by + 258, { size: 36, fam: HAND, weight: 600, color: theme.ink, align: 'center' });
  }
  g.restore();
}
