/**
 * /api/notes · the shared note board.
 *   GET     → { notes: Note[] }  newest 40, oldest first
 *   POST    { text, color, name? } → { note }
 *   DELETE  /api/notes?id=…  with header  x-admin-token: <NOTES_ADMIN_TOKEN>  (for you, to remove a note)
 *
 * Optional env:
 *   NOTES_ADMIN_TOKEN     secret for DELETE
 *   NOTES_BLOCKED_WORDS   comma separated words to refuse (e.g. "word1,word2")
 */
import { addNote, deleteNote, hit, listNotes } from '../../../lib/notesStore';
import { NOTE_COLORS } from '../../../lib/noteColors';

export const dynamic = 'force-dynamic';

const MAX_TEXT = 120, MAX_LINES = 5, MAX_NAME = 24;
const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|in|co|xyz|me|ly)\b)/i;

function clean(s: unknown, max: number) {
  if (typeof s !== 'string') return '';
  return s.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
}
function blocked(s: string) {
  const words = (process.env.NOTES_BLOCKED_WORDS || '').split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
  const low = s.toLowerCase();
  return words.some((w) => low.includes(w));
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function GET() {
  try { return json({ notes: await listNotes(40) }); }
  catch { return json({ notes: [], error: 'The note board is resting. Try again soon.' }, 503); }
}

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'That note looks empty.' }, 400); }
  const text = clean(body?.text, MAX_TEXT);
  const name = clean(body?.name, MAX_NAME).replace(/\n/g, ' ');
  const color: string = (NOTE_COLORS as readonly string[]).includes(body?.color) ? body.color : NOTE_COLORS[0];

  if (!text) return json({ error: 'Write something first.' }, 400);
  if (text.split('\n').length > MAX_LINES) return json({ error: 'Keep it to five short lines.' }, 400);
  if (LINK.test(text) || LINK.test(name)) return json({ error: 'Links can’t go on the board. Just words, please.' }, 400);
  if (blocked(text) || blocked(name)) return json({ error: 'That note can’t be pinned here.' }, 400);

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'anon';
  try {
    if ((await hit(`m:${ip}`, 30)) > 1) return json({ error: 'You just pinned one. Give it 30 seconds.' }, 429);
    if ((await hit(`d:${ip}`, 86400)) > 10) return json({ error: 'That’s ten notes today. Come back tomorrow.' }, 429);
    const note = await addNote({ text, color, name: name || undefined });
    return json({ note }, 201);
  } catch {
    return json({ error: 'Couldn’t pin your note. Try again in a moment.' }, 503);
  }
}

export async function DELETE(req: Request) {
  const token = process.env.NOTES_ADMIN_TOKEN;
  if (!token || req.headers.get('x-admin-token') !== token) return json({ error: 'Not allowed.' }, 401);
  const id = new URL(req.url).searchParams.get('id') || '';
  return json({ removed: await deleteNote(id) });
}
