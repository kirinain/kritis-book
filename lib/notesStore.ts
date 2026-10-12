/**
 * notesStore · where visitor notes live.
 *
 * Production: Upstash Redis or Vercel KV (same thing underneath). Set either
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or
 *   KV_REST_API_URL + KV_REST_API_TOKEN
 * No extra package needed, it talks to the REST API with fetch.
 *
 * Local dev without those env vars: notes are kept in memory and vanish on restart.
 */
export type Note = { id: string; seq: number; text: string; color: string; name?: string; createdAt: number };

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const LIST = 'kb:notes', SEQ = 'kb:notes:seq', KEEP = 200;
export const usingRedis = !!(URL_ && TOKEN);

async function redis<T = unknown>(cmd: (string | number)[]): Promise<T> {
  const r = await fetch(URL_ as string, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
    cache: 'no-store',
  });
  const j = (await r.json()) as { result?: T; error?: string };
  if (!r.ok || j.error) throw new Error(j.error || `Redis error ${r.status}`);
  return j.result as T;
}

/* ---------- in-memory fallback (dev only) ---------- */
type Mem = { seq: number; list: Note[]; hits: Map<string, { n: number; exp: number }> };
const mem: Mem = ((globalThis as any).__kbNotes ||= { seq: 0, list: [], hits: new Map() });
if (!usingRedis && process.env.NODE_ENV === 'production') {
  console.warn('[notes] No Redis/KV env vars found. Notes are stored in memory and will be lost on restart.');
}

/** Newest `limit` notes, returned oldest → newest. */
export async function listNotes(limit = 40): Promise<Note[]> {
  if (!usingRedis) return mem.list.slice(-limit);
  const raw = await redis<string[]>(['LRANGE', LIST, 0, limit - 1]);
  return raw.map((s) => JSON.parse(s) as Note).reverse();
}

export async function addNote(input: { text: string; color: string; name?: string }): Promise<Note> {
  const base = { text: input.text, color: input.color, ...(input.name ? { name: input.name } : {}), createdAt: Date.now() };
  const id = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 12);
  if (!usingRedis) {
    const note: Note = { id, seq: ++mem.seq, ...base };
    mem.list.push(note); if (mem.list.length > KEEP) mem.list.shift();
    return note;
  }
  const seq = await redis<number>(['INCR', SEQ]);
  const note: Note = { id, seq, ...base };
  await redis(['LPUSH', LIST, JSON.stringify(note)]);
  await redis(['LTRIM', LIST, 0, KEEP - 1]);
  return note;
}

export async function deleteNote(id: string): Promise<boolean> {
  if (!usingRedis) { const before = mem.list.length; mem.list = mem.list.filter((n) => n.id !== id); return mem.list.length < before; }
  const raw = await redis<string[]>(['LRANGE', LIST, 0, KEEP - 1]);
  const hit = raw.find((s) => (JSON.parse(s) as Note).id === id);
  if (!hit) return false;
  await redis(['LREM', LIST, 1, hit]);
  return true;
}

/** Counts a hit for `key` inside a time window. Returns the count so far. */
export async function hit(key: string, windowSec: number): Promise<number> {
  const k = `kb:rl:${key}`;
  if (!usingRedis) {
    const now = Date.now(), cur = mem.hits.get(k);
    if (!cur || cur.exp < now) { mem.hits.set(k, { n: 1, exp: now + windowSec * 1000 }); return 1; }
    cur.n += 1; return cur.n;
  }
  const n = await redis<number>(['INCR', k]);
  if (n === 1) await redis(['EXPIRE', k, windowSec]);
  return n;
}
