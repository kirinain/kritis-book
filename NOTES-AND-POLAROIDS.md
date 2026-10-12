# Polaroid stack + shared note board

Two more things for the nook.

| File | What it is |
|---|---|
| `components/scene/PolaroidStack.tsx` | A messy little pile of polaroids on the desk. Click it: they lift up and fan out into a half circle facing the viewer, stay for 3 seconds, then drop back into the pile. Click them while they're open to stack them back early. Hovering a fanned photo shows its caption. |
| `components/scene/NoteBoard.tsx` | Sticky notes pinned on the pink pegboard. Kriti's own note is always there. Visitors click the "leave a note" pad, write up to 120 characters, add a name if they want, pick a paper color and pin it. Everyone who visits sees all the notes. Clicking a note opens it big so it's easy to read. New notes from other people appear on their own. |
| `app/api/notes/route.ts` | The small API that saves and lists notes. |
| `lib/notesStore.ts` | Where notes are stored (Upstash Redis / Vercel KV, or memory while developing). |
| `lib/noteColors.ts` | The five note paper colors, shared by the board and the API. |

No new npm packages. Uses `three`, `@react-three/fiber`, `@react-three/drei` and `react-dom`, which the project already has.

---

## 1. Drop the files in

Keep the same folders: `components/scene/`, `app/api/notes/`, `lib/`. If the project uses a `src/` folder, put all three inside `src/` (the imports are relative, so they still work).

## 2. Place them in the nook

```tsx
import PolaroidStack from '@/components/scene/PolaroidStack';
import NoteBoard from '@/components/scene/NoteBoard';

<PolaroidStack position={[-0.19, 0.76, 0.075]} onHoverChange={setTooltip} />
<NoteBoard position={[0.02, 1.17, 0.016]} onHoverChange={setTooltip} />
```

- **Polaroids:** the back-left of the desk, between the mug and the book, clear of everything when the book is open. When they fan out, they open above the desk toward the viewer, so they don't hit the pegboard.
- **Note board:** `position` is the centre of the pegboard's front face. Notes go into 17 free spots that avoid the pen cup, the mini shelf and the "you got this" card. If Cursor moved any of those, pass your own `slots` (each is `[x, y]` from the board centre).

## 3. Swapping in your real polaroids later

Put the images in `public/polaroids/`. Any size works (they're cropped to a square from the centre). Then:

```tsx
<PolaroidStack
  photos={[
    { src: '/polaroids/robot.jpg', caption: 'first robot!' },
    { src: '/polaroids/team.jpg', caption: 'the team' },
    { src: '/polaroids/prd.jpg', caption: 'my first PRD' },
    // as many as you like, 5 to 8 looks best
  ]}
/>
```

Right now it shows 6 soft placeholder photos with captions in [brackets].

Other props: `holdMs` (how long they stay open, default 3000), `radius` (size of the half circle), `fanOffset` (where it opens, relative to the pile).

## 4. Your own notes on the board

```tsx
<NoteBoard
  pinnedNotes={[
    { text: 'welcome in! leave me a little note', name: 'Kriti', color: '#F8D3DA' },
    { text: 'currently: learning SQL window functions', color: '#FFF1B5' },
  ]}
/>
```

These are always shown first and never get pushed off. Paper colors: `#FFF1B5` yellow, `#F8D3DA` pink, `#D6EBD6` mint, `#DCE6F6` blue, `#EADFF5` lilac.

---

## 5. Making notes shared for real (5 minutes on Vercel)

Without a database, notes live in server memory: fine for testing, but they disappear on every deploy. For real shared notes:

1. In the Vercel project, open **Storage**, create an **Upstash Redis** database (free tier is plenty), and connect it to the project. Vercel adds the env vars for you (`KV_REST_API_URL` and `KV_REST_API_TOKEN`, or the `UPSTASH_REDIS_REST_*` pair). Both naming styles work.
2. Add two more env vars:
   - `NOTES_ADMIN_TOKEN`: any long random string. This lets you delete a note.
   - `NOTES_BLOCKED_WORDS` (optional): comma separated words to refuse.
3. Redeploy.

Not on Vercel? Make a free database at upstash.com and add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` yourself.

## 6. Keeping the board nice

The board is public, so there are guardrails built in:

- 120 characters max, 5 lines max, name up to 24 characters.
- No links allowed (blocks most spam).
- One note per 30 seconds and 10 per day from the same person.
- Your blocked-words list.
- Notes are drawn as text on paper, never as HTML, so nobody can inject anything.
- Only the latest 200 notes are kept. The board shows as many as it has spots (17 minus your pinned ones), newest replacing oldest.

To remove a note, use its `id` (from `GET /api/notes`):

```bash
curl -X DELETE "https://your-site.com/api/notes?id=NOTE_ID" -H "x-admin-token: YOUR_NOTES_ADMIN_TOKEN"
```

---

## 7. Prompt for Cursor

> Add the polaroid stack and the shared note board from NOTES-AND-POLAROIDS.md. Copy `components/scene/PolaroidStack.tsx`, `components/scene/NoteBoard.tsx`, `app/api/notes/route.ts`, `lib/notesStore.ts` and `lib/noteColors.ts` into the project with the same folder structure (inside `src/` if we use it). Place `<PolaroidStack>` and `<NoteBoard>` in the nook scene with the positions from section 2 and connect `onHoverChange` to our hover label. Don't change the component or API code. Then check: (1) clicking the polaroid pile fans the photos into a half circle that faces the camera and they stack back after 3 seconds, (2) clicking the "leave a note" pad opens the form, typing doesn't move the camera, Esc closes it, and pinning adds a note to the pegboard, (3) `GET /api/notes` returns the note, and a second browser window shows it within 15 seconds. If any note spot overlaps something in our pegboard layout, pass adjusted `slots` instead of editing the component.

---

## Tested

- The API in Node: saving, listing, the 30-second limit, rejecting links and empty notes, and blocking delete without the token.
- The full flow in a real React Three Fiber build in Chrome:
  - The polaroids fan out and restack.
  - A note gets written and pinned.
  - A second visitor's note shows up on its own.
  - A note opens to read.
