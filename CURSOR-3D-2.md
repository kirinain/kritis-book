# Kriti's Book · 3D build brief for Cursor

`kritis-book.html` is a working prototype: a pink study nook rebuilt from a reference photo, with Kriti's Book on the desk where the laptop was. Don't rebuild from scratch. Port it.

---

## 1. The look (from the reference photo)

Units are meters. The nook is 1.5 m wide, back wall at z = 0, desk top at 0.76 m.

| Token | Hex | Used for |
|---|---|---|
| wall | `#F4EFEA` | all walls (warm white) |
| trim / desk / shelves | `#FAF8F5` / `#F8F6F2` | baseboards, window, floating desk, shelves |
| pink | `#E8BAB5` | pegboard, pen cups, organizer |
| lamp pink | `#E6ADA5` | desk lamp, coaster |
| frame pink | `#E4AFA7` | picture frames |
| box pink | `#ECBDB6` | storage box |
| rug | `#E4AEB0` → `#FBDCDD` | fluffy rug (shell layers, dark to light) |
| cushion | `#EEC2C3` | chair cushion |
| chair legs | `#DDBB8E` | light oak |
| black | `#26201E` | pens, door lever, chair wire base |
| tulips | `#F1A9B5` | flower heads |
| pothos | `#6FB352` → `#3F7A2F` | leaf texture gradient |
| floor | `#E9E2D8`, grout `#D6CCBF` | 60 cm tiles |
| LED strip | `#FFD3A0` | under-shelf light |
| book cloth | `#E8BDB7`, title ink `#8A4A50` | the book |

Lighting recipe (this is what makes it look real):
- **Linear tone mapping**, not ACES. ACES turns pastels grey.
- Soft window light: a `RectAreaLight` in the window plus a weak directional sun with soft shadows.
- **Two `RectAreaLight` LED strips** under the shelves, plus a soft additive glow on the wall below each.
- Fake ambient occlusion: dark gradient decals in every corner, under the desk, and where shelves meet the wall.
- Walls receive shadows but don't cast them, except the window wall (prevents shadow noise).

---

## 2. Everything you can click

| Object | What happens |
|---|---|
| Book | Opens, pages turn with a real paper curl, Contents jumps to chapters |
| Chair | Click once to pull it out, again to sit down (camera moves to your eyes). "Stand up" button or Esc |
| Desk lamp | On / off (real spotlight + shadows) |
| Light switch (left wall) | Shelf LED strips on / off. Clicking a shelf does the same |
| Window | Switches day ↔ night |
| Blind | Raises, lowers, closes (changes how much light comes in) |
| Door | Swings open into a hallway |
| Pothos | Vines swing |
| Succulents (shelf + pegboard) | Wiggle |
| Tulips | Shake, heads bloom a little |
| Mug | Steam puffs, mug wobbles |
| Pen cups (3) | Pens rattle |
| Alarm clock | Rings. Its hands show the room's own time |
| Candle | Blow out / relight (real flicker light) |
| Storage box | Lid opens |
| Frames | Swing when nudged |
| "you got this" card | Flips to show a note on the back |
| Shelf books | Tilt out |
| Organizer | Notebooks slide out, pouch squishes |
| Rug | Fur ripples |

**Day/night timeline:** 5 minutes of day, then the sky slowly turns to night over 20 seconds. 5 minutes of night, then morning. The top-right chip shows the countdown and switches it by hand.

**Moving around:** drag to look, scroll or W/S to walk forward/back, A/D to step sideways, right-drag to pan, double-click anything to fly to it. The camera stays inside the room.

---

## 3. Prompts, in order

1. "Read CURSOR-3D.md and kritis-book.html. Port it to Next.js App Router at `/` with **React Three Fiber + drei**. Keep the exact `deform()` page-curl math, colors, light setup (Linear tone mapping, RectAreaLights, AO decals) and every interaction. Show me it running."
2. "Split it into components: `<Nook>`, `<Desk>`, `<Shelves>`, `<Pegboard>`, `<Chair>`, `<Window>`, `<Door>`, `<Book>`, one file each in `/components/scene`. Move colors to `/content/theme.ts` and page text to `/content/pages.ts`."
3. "Replace every [bracketed placeholder] in the book with real content. Put real photos in the polaroid and photo slots."
4. "Blender pass (optional, recommended): model the chair, lamp, tulips, pothos and alarm clock properly. Export Draco `.glb`, load with `useGLTF`, and keep each object's click behavior. Bake an AO map for the room shell in Blender and use it instead of the AO decals. The book stays procedural."
5. "Add a `/read` route with the plain 2D version (DESIGN.md). Link it as 'Read without the book'. Under 600 px wide, start there with a button to try the 3D room."
6. "Performance: pause when the tab is hidden, `AdaptiveDpr`, lower shadow map sizes on phones, keep 60 fps on a mid-range laptop."

## 4. Things to protect

- A drag never counts as a click.
- Pages: right turns forward, left goes back. Arrow keys and Esc work.
- Contents rows jump to chapters (recruiters need this).
- Keep the bottom control bar and the "Reset view" button.
- `prefers-reduced-motion`: no intro glide, quick turns, instant day/night.
