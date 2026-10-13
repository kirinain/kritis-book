# Kiti's Book · page designs

This swaps the old placeholder page text in the 3D book for the final 16 designed pages.

| File | What it is |
|---|---|
| `lib/bookPages.js` | Draws every page onto a canvas: `drawBookPage(n, ctx, { scale, assets })`. All copy, layout, colors and doodles live here |
| `public/book/*.jpg` | The photos placed so far (p01 portrait, p09 robot arm, p13 team, p15 portrait) |
| `drawBookCover`, `drawEndpaper` (same file) | The front cover art and the bookplate inside the cover, with the right name |
| `preview/kitis-book-pages.html` | A flat preview of every spread, for checking pages without the 3D scene |

Name: **Kiriti Nain**, the book is **Kiti's Book**. The internship shows as **Goalwit Tech**.

---

## 1. Fonts

Add Fraunces to the Google Fonts link (DM Sans and Caveat are already there):

```
https://fonts.googleapis.com/css2?family=Caveat:wght@500;600&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,500&display=swap
```

Or with `next/font/google`: `Fraunces({ subsets: ['latin'], weight: ['500','600','700'], style: ['normal','italic'] })`. If you use next/font, change the `SERIF`, `SANS`, `HAND` constants at the top of `bookPages.js` to the CSS variable names next/font gives you.

Wait for fonts before drawing pages (`BOOK_FONTS` is exported for this):

```ts
await Promise.all(BOOK_FONTS.map((f) => document.fonts.load(f)));
```

## 2. Hook it into the book

Wherever the book builds a page texture today (the old `drawPage(n, scale)`), use this:

```ts
import { drawBookPage, loadBookAssets, PAGE_W, PAGE_H, BOOK_FONTS } from '@/lib/bookPages';

const assets = await loadBookAssets('/book/');          // once, after fonts
function pageCanvas(n: number, scale = 2) {
  const c = document.createElement('canvas');
  c.width = PAGE_W * scale; c.height = PAGE_H * scale;
  const hotspots = drawBookPage(n, c.getContext('2d')!, { scale, assets });
  return { canvas: c, hotspots };
}
```

- Page size is unchanged (768 × 1024 units), so the sheet geometry and UVs stay the same.
- Still 16 pages, so `N = 8` sheets.
- Use `scale = 2` on laptops and `1.5` on phones. Keep the lazy loading that only paints spreads near the open page.

## 3. Fix the name everywhere (important)

The bookplate inside the cover and the cover art in the project still come from the old prototype, which said "Kriti". Replace them:

```ts
import { drawBookCover, drawEndpaper, COVER_W, COVER_H, PAGE_W, PAGE_H } from '@/lib/bookPages';

// cover: one canvas per pass, used as map / metalnessMap / roughnessMap / bumpMap
for (const pass of ['color', 'metal', 'rough', 'bump']) {
  const c = document.createElement('canvas'); c.width = COVER_W; c.height = COVER_H;
  drawBookCover(c.getContext('2d')!, pass);
}
// inside covers
drawEndpaper(frontCtx, true, { scale: 2 });   // "Ex libris · This book belongs to Kiriti Nain"
drawEndpaper(backCtx, false, { scale: 2 });   // "The end, for now."
```

Delete the old `coverArt()` and `endpaper()` functions. Then search the whole project for `Kriti` and fix every hit:

| Find | Replace with |
|---|---|
| `Kriti’s Book` / `Kriti's Book` | `Kiti’s Book` |
| `Kriti Nain` | `Kiriti Nain` |
| any other `Kriti` | `Kiriti` |

That covers the page title, the loader, the brand chip, the hover label ("Kiti's Book · click to open") and the screen-reader label. A search for `Kriti` should return nothing afterwards.

## 4. Hotspots

`drawBookPage` returns clickable areas in page units:

- `{ x, y, w, h, go: 9 }` → turn to page 9 (Contents rows)
- `{ x, y, w, h, href }` → open the link in a new tab (Medium posts, contacts, résumé, Overlane)

The existing hotspot code handles `go`. Add one branch: if a hotspot has `href`, call `window.open(href, '_blank', 'noopener')`.

## 5. Pictures

Every slot is filled. Slots without a real image show an ink sketch drawn in code: the payment screens, the onboarding flow, the Overlane summary, the Notes screens, the Isaac Lab sim, MR Robot, the ArUco bot, the paper girl and Robo Kiti. To swap in a real image, drop a file into `public/book/` with the name from `SLOTS` and it replaces the sketch automatically.

Links still marked TODO in `LINKS`: `overlane`, `notes`, and `resume`. Put the résumé PDF at `public/Kiriti_Nain_Resume.pdf`.

## 6. Speaker

The voice intro is dropped. The desk speaker plays music only.

## 7. Prompt for Cursor

> Read BOOK-PAGES.md. Copy `lib/bookPages.js` and `public/book/*` into the project. Load Fraunces as in section 1. Replace the book's current page-drawing code with `drawBookPage` as in section 2, keeping the page-curl, lazy loading and N = 8. Replace the cover and inside-cover drawing with `drawBookCover` and `drawEndpaper`, then search the project for "Kriti" and fix every hit (section 3). Add the `href` hotspot branch from section 4. Don't change `bookPages.js`. Then open the book and check the cover, the bookplate and pages 1–16 match `preview/kitis-book-pages.html`.
