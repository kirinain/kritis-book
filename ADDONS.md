# Desk add-ons · pencil, paper crane, speaker

Three new things for the desk in the nook. Each one is a single React Three Fiber component with no new packages (only `three`, `@react-three/fiber`, `@react-three/drei`, which the project already uses).

| File | What it does |
|---|---|
| `components/scene/SpinPencil.tsx` | A pencil lying on the desk. Click to flick it, or drag around it to spin it 360°. Let go while moving and it keeps spinning, then slows down. Grab it to stop it. |
| `components/scene/PaperFlyer.tsx` | The origami crane. Click it and it flies a loop around the nook for about 3 seconds, flapping, banking into turns, then lands back on its spot. Every flight takes a different path. Set `variant="plane"` for a paper plane instead. |
| `components/scene/DeskSpeaker.tsx` | A small cream and pink speaker next to the book. Tap to play, tap to pause. The woofer pulses, the top light glows, music notes float up. Ready for a music file later. |

All units are meters, matching the nook (desk top at `y = 0.76`, back wall at `z = 0`).

---

## 1. Drop the files in

Copy the three `.tsx` files into `components/scene/` (same folder as the other scene parts).

## 2. Make sure OrbitControls is the default controls

The pencil turns the camera controls off while you drag it, so the room doesn't spin at the same time. It finds them through `makeDefault`:

```tsx
<OrbitControls makeDefault /* ...existing props */ />
```

If the project uses custom camera controls instead, pass `onDragChange={(d) => setControlsEnabled(!d)}` to `SpinPencil`.

## 3. Place them on the desk

Inside the nook scene (the same parent group as the desk and the book):

```tsx
import SpinPencil from '@/components/scene/SpinPencil';
import PaperFlyer from '@/components/scene/PaperFlyer';
import DeskSpeaker from '@/components/scene/DeskSpeaker';

<SpinPencil position={[-0.42, 0.76, 0.45]} onHoverChange={setTooltip} />
<PaperFlyer position={[0.5, 0.76, 0.42]} onHoverChange={setTooltip} />
<DeskSpeaker position={[0.33, 0.76, 0.42]} onHoverChange={setTooltip} />
```

These spots fit the prototype layout: pencil front-left (clear of the mug and lamp), speaker on the right side of the book, crane at the front-right corner. Nudge them if your layout moved anything.

`onHoverChange` gives you the label text ("Speaker · tap to play music", etc.) or `null`, so it plugs into the existing hover label.

---

## 4. Props worth knowing

**SpinPencil**: `length` (0.17), `color` (`#E8BAB5`), `initialAngle`, `friction` (lower spins longer), `label`, `onHoverChange`, `onDragChange`.

**PaperFlyer**: `variant` (`'crane'` or `'plane'`), `color` (`#F7D6DD`), `facing` (radians), `duration` (seconds in the air, default 2.8), `bounds` (box the flight stays inside, default `[[-0.6, 0.9, 0.25], [0.6, 1.45, 0.95]]`, which keeps it in front of the pegboard and under the top shelf), `onFlightChange`.

**DeskSpeaker**: `src`, `volume` (0.7), `playing` + `onToggle` (to control it from outside), `facing`, `bodyColor`, `fabricColor`.

---

## 5. Adding the music later

Easiest: put a file in `public/music/` and pass it in.

```tsx
<DeskSpeaker position={[0.33, 0.76, 0.42]} src="/music/lofi.mp3" volume={0.6} />
```

- It only starts after a tap, so browsers allow the sound.
- It loops.
- The woofer moves with the real music (it reads the volume of the track live).

If the music comes from somewhere else (a playlist player, an embed), skip `src` and control it yourself:

```tsx
const [on, setOn] = useState(false);
<DeskSpeaker playing={on} onToggle={(next) => { setOn(next); next ? player.play() : player.pause(); }} />
```

In that case the woofer uses a soft built-in beat, since it can't hear an external player.

---

## 6. Prompt for Cursor

> Add the three components from ADDONS.md to the nook scene. Copy `SpinPencil.tsx`, `PaperFlyer.tsx` and `DeskSpeaker.tsx` into `components/scene/`. Make sure `<OrbitControls>` has `makeDefault`. Place them with the positions in section 3, inside the same parent as the desk and book, and connect `onHoverChange` to our existing hover label. Don't change the component code. Then check: (1) clicking the pencil spins it and dragging around it spins it without moving the camera, (2) clicking the crane makes it fly for about 3 seconds and land back, (3) tapping the speaker toggles play/pause with notes and a glowing light. If any of them overlaps another object in our layout, only adjust its `position`.

---

## Notes

- All three respect "drag never counts as a click": a camera drag that ends on them won't trigger them.
- `prefers-reduced-motion`: the crane does a small hop instead of a full flight.
- Shadows: everything casts and receives shadows, so it sits in the room's light like the other props.
