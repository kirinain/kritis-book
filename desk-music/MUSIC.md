# Desk speaker · music

Tap the speaker on the desk: the music fades in. Tap again: it fades out and pauses. Tap again: it carries on from the exact same spot.

| File | What it is |
|---|---|
| `components/scene/DeskSpeaker.tsx` | Replaces the old speaker. Same look, now with real music |
| `public/music/secret-of-us-piano.mp3` | The track, re-encoded to 96 kbps (30 MB → 22 MB, 32 min, sounds the same for soft piano). Short fades at the ends so the loop is smooth |

## What it does

- **Tap to play / pause / resume.** Pause keeps the spot, so the next tap continues from there.
- **Soft fades:** 0.8 s fade in, 0.45 s fade out. No sudden blasts of sound.
- **Remembers the spot** even after a page reload or a later visit (saved in the visitor's browser).
- **Loops** the whole track.
- **The woofer moves with the real music,** the light on top glows, and notes float up. While the track is still loading, the light blinks softly.
- **Hover label** changes: "tap to play music" → "tap to pause" → "tap to resume". If the file can't load: "music couldn't load, tap to retry".
- **Phones:** the lock screen and headphone buttons show the track and can play or pause it, and the speaker stays in sync.
- **Only one copy of the song ever plays,** even if the scene re-renders.

## Hook it up

1. Copy `components/scene/DeskSpeaker.tsx` over the old one.
2. Copy `public/music/secret-of-us-piano.mp3` into `public/music/`.
3. The existing `<DeskSpeaker ... />` line needs no changes. The track is the default `src`. Optional props:

```tsx
<DeskSpeaker
  position={[0.33, 0.76, 0.42]}
  onHoverChange={setTooltip}
  volume={0.6}                                   // 0 to 1
  title="The Secret of Us · calm piano"          // shown on the phone lock screen
  onToggle={(on) => setNowPlaying(on)}           // optional: show a "now playing" chip
/>
```

To swap the song later, drop a new mp3 in `public/music/` and pass `src="/music/your-file.mp3"`.

## Prompt for Cursor

> Replace `components/scene/DeskSpeaker.tsx` with the one from MUSIC.md and add `public/music/secret-of-us-piano.mp3`. Don't change the component code. Then check: tapping the speaker fades the music in; tapping again fades out and pauses; tapping again continues from the same spot; reloading the page and tapping continues where it left off; dragging the camera across the speaker doesn't start the music.

## Tested

In Chrome:

- Tap 1 played.
- Tap 2 paused and held at 3.4 s.
- Tap 3 continued from 3.4 s.
- After a reload, it continued from the saved spot (6.3 s).
- No errors.
