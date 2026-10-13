# Book drawings · pages 14 and 16

The two doodles in the book are now the drawings Kiti picked:

| Page | Before | Now |
|---|---|---|
| 14 · The Margins | paper girl doodle | pencil sketch of a girl with a butterfly clip |
| 16 · The next chapter | Robo Kiti waving | girl looking up at a big pink flower |

- The backgrounds are removed, so both look drawn right on the page paper.
- They show in full (no cropping) and sit in the bottom-right corner, clear of the text and links.
- The artist's signature on the flower drawing is kept.

## Files

| File | What |
|---|---|
| `lib/bookPages.js` | Updated: new file names for the p14 and p16 slots, and a `drawContain` helper so these two are never cropped |
| `public/book/p14-sketch-girl.png` | The sketch, background removed |
| `public/book/p16-flower-girl.png` | The flower drawing, background removed |

The old `p14-paper-girl.png` / `p16-robo-wave.png` files were never made (the book drew those doodles itself), so there is nothing to delete.

## Prompt for Cursor

> Replace `lib/bookPages.js` with the one in BOOK-DRAWINGS.md and add `public/book/p14-sketch-girl.png` and `public/book/p16-flower-girl.png`. Don't change anything else. Then open the book to pages 14 and 16 and check: page 14 shows the pencil sketch of the girl with the butterfly in the bottom-right corner, page 16 shows the girl and the big pink flower next to the contact list, and neither drawing covers any text or link.
