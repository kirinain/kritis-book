# Room updates · wall quote, pegboard prints, real polaroids

| File | What changed |
|---|---|
| `components/scene/QuoteFrame.tsx` | **New.** The pink frame on the top shelf now says "what's meant for you will find its way back to you". Replaces the old "Dream Plan Do" frame. Click it and it swings, same as before |
| `components/scene/NoteBoard.tsx` | **Updated.** The two quote prints are now on the pegboard: "What if I fall? Oh, but my darling, what if you fly?" (taped) and "museum of failure or gallery of trying?" (pinned). Click either to see it big. Visitor notes never land on top of them |
| `components/scene/PolaroidStack.tsx` | **Updated.** Shows Kiti's 5 instax photos instead of placeholders, in real instax mini shape. Two of them are sideways, like the real prints |
| `public/polaroids/*.jpg` | The 5 photos, cropped out of their instax frames and straightened (the component draws the white frame) |
| `public/pegboard/*.jpg` | The two quote prints |

"focus & grow" on the lower shelf stays as it is.

## 1. Copy the files

Copy everything into the project with the same folders (`src/` too if the project uses it). Overwrite the old `NoteBoard.tsx` and `PolaroidStack.tsx`. `lib/noteColors.ts` is the same as before; only copy it if it's missing.

## 2. Swap the frame

Find the "Dream Plan Do" frame on the top shelf (prototype: `framed('dream', 0.21, 0.27, -0.15, 0, 0.05, 0.08, T2)`). Delete it and put this in its place:

```tsx
import QuoteFrame from '@/components/scene/QuoteFrame';

<QuoteFrame position={[-0.15, 1.967, 0.05]} onHoverChange={setTooltip} />
```

Same size, same lean, same spot.

## 3. Nothing else to do for the pegboard and polaroids

`<NoteBoard />` and `<PolaroidStack />` already in the scene pick up the new prints and photos by default. No prop changes.

- The welcome note moved to the top middle of the board, so the prints have room.
- If a print overlaps something in your pegboard layout, move it with the `prints` prop. Each print has `at: [x, y]` from the board centre:

```tsx
import NoteBoard, { KITI_PRINTS } from '@/components/scene/NoteBoard';

<NoteBoard prints={[{ ...KITI_PRINTS[0], at: [-0.22, -0.02] }, KITI_PRINTS[1]]} />
```

## 4. Captions on the polaroids (optional)

The thick strip of each instax is blank right now. To write something on it:

```tsx
import PolaroidStack, { KITI_POLAROIDS } from '@/components/scene/PolaroidStack';

<PolaroidStack photos={KITI_POLAROIDS.map((p, i) => ({ ...p, caption: ['sleepy', 'dance break', 'garden day', 'big day', 'city view'][i] }))} />
```

The last photo in the list sits on top of the pile (right now: the window one).

## Prompt for Cursor

> Apply ROOM-UPDATES.md. Copy `components/scene/QuoteFrame.tsx`, `components/scene/NoteBoard.tsx`, `components/scene/PolaroidStack.tsx`, `public/polaroids/` and `public/pegboard/` into the project (inside `src/` if we use it), overwriting the old NoteBoard and PolaroidStack. Replace the "Dream Plan Do" frame on the top shelf with `<QuoteFrame position={[-0.15, 1.967, 0.05]} onHoverChange={setTooltip} />`. Don't change the component code. Then check: (1) the top-shelf frame reads "what's meant for you will find its way back to you" and swings on click, (2) the two quote prints show on the pegboard, open big on click and close with Esc, and no sticky note covers them, (3) clicking the polaroid pile fans out the 5 real photos and they stack back after 3 seconds. If a print overlaps our pen cup, mini shelf or card, pass adjusted `prints` instead of editing the component.

## Tested

In a real React Three Fiber build in Chrome:

- The quote frame renders with the right fonts, and hovering shows the quote.
- Both prints show on the board, open big on click and close with Esc.
- The welcome note and the "leave a note" pad stay clear of the prints.
- The 5 photos fan out in their instax shapes and stack back.
- No errors.
