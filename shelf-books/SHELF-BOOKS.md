# Shelf books · real titles on the spines

The four books on the lower shelf now have their titles printed on the spines:

| Book | Spine color | Look |
|---|---|---|
| The Book Thief | cream | italic serif, red double rules |
| The Fault in Our Stars | pink | serif, little white stars |
| The Brain That Changes Itself | grey | bold caps, sage band on top |
| Harry Potter and the Cursed Child | off-white | two lines, gold rules |

- Titles read top to bottom, like real English spines.
- Each one has the author's name in small caps at the bottom.
- Same fonts as Kiti's Book (Fraunces + DM Sans). The spines redraw once the fonts load, so you never see a fallback font.
- Click a book and it tilts out, same as before. The hover label shows the title, like "The Book Thief · tilt it out".

## Hook it up

1. Copy `components/scene/ShelfBooks.tsx` into the project.
2. Find the four plain book boxes on the lower shelf (in the prototype they were at x = -0.53, -0.497, -0.463, -0.43). Delete them.
3. Put this in their place:

```tsx
import ShelfBooks from '@/components/scene/ShelfBooks';

<ShelfBooks position={[-0.544, 1.567, 0.2]} onHoverChange={setTooltip} />
```

`position` is the shelf spot under the front-left corner of the first book. The books line up to the right from there.

## Changing books later

```tsx
<ShelfBooks
  books={[
    { title: 'Atomic Habits', author: 'James Clear', w: 0.03, h: 0.24, color: '#DCE6F6', ink: '#2B3350', style: 'modern' },
    // ...
  ]}
/>
```

Styles: `classic`, `stars`, `modern`, `twoLine` (use `subtitle` for the second line). Long titles shrink to fit on their own.

## Prompt for Cursor

> Add `components/scene/ShelfBooks.tsx` from SHELF-BOOKS.md. Remove the four plain book boxes on the lower shelf and put `<ShelfBooks position={[-0.544, 1.567, 0.2]} onHoverChange={setTooltip} />` where they were (adjust the position if our shelf moved, so the books stand on the shelf with spines facing out). Don't change the component code. Then check: all four titles are readable on the spines, hovering a book shows its title, and clicking tilts it out and back.

## Tested

In a real React Three Fiber build in Chrome: all four spines render with the right fonts, the text fits, hover shows the title, clicking tilts the book, no errors.
