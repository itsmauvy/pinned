# pinned

> pieces worth pinning.

A vintage fashion archive you **flip through like a book**. On the desktop the
site is a bound magazine: scrolling turns the pages in 3D, hinged at the spine.
On phones it collapses to a plain vertical stack. No build step — open it.

## Run

```bash
node .claude/serve.js      # http://localhost:4599
```

Or open `index.html` directly.

## The page turn

The book is **full-bleed** — each screen is a two-page spread (left | spine |
right) that fills the viewport. A tall, invisible scroll track drives a sticky
stage: as you scroll, the current leaf rotates around the spine (`rotateY`) from
0° to −180°, its back becoming the next left page. Only one leaf is ever mid-turn,
with a shadow that deepens toward 90°.

One scroll gesture turns **one** page, slowly. The turn is an eased tween
(~1s per page, set by `PER_PAGE` in `app.js`); trackpad momentum is absorbed so a
single flick never skips ahead.

- **Scroll / wheel** — one gesture = one page turn. **← → / PageUp-Down** keys do
  the same.
- **GNB** (top nav) has one item per spread — `cover · index · lookbook · archive
  · detail · colophon`. The active item follows the page you're on; clicking one
  animates through to that spread.
- **Mobile / `prefers-reduced-motion`** → the same pages render as a vertical
  scroll of paper cards (no 3D), and the GNB scrolls to each section.

The book is assembled in JS: pages are authored in `#pageSource` in reading order,
then split into leaves — leaf *i* front = page `2i+1`, back = page `2i+2`.

## Spreads

| # | Left page | Right page |
| --- | --- | --- |
| 0 | imprint | cover — *pinned* |
| 1 | manifesto + keywords | two plates |
| 2 | lookbook copy | model + tappable hotspots |
| 3 | archive intro + filters | archive grid |
| 4 | lace detail plate | care note + feature CTA |
| 5 | your pinned-board preview | colophon |

## Interactions

- **pin this piece** → saves to a `localStorage` board (`pinned.board.v1`), with a
  slide-over pinboard, running total, and per-piece unpin.
- **Product detail overlay** — house, era, condition, material, size, note.
- **Hotspots** on the look lift pieces out of the styling; **filters** sort the shelf.

## Structure

```
index.html                 masthead, book scaffold, page source, overlays
assets/css/styles.css       tokens, book + 3D flip, pages, components
assets/js/data.js           the archive (pieces + issue + keywords)
assets/js/silhouettes.js    garment SVG silhouettes → duotone plates
assets/js/app.js            book builder, flip controller, pins, overlay, board
```

## Design notes

Photography is stood in by **duotone plates** — a tonal wash (blush / fog /
graphite / ink) plus a garment silhouette, faded with a screen over-wash and a
global paper grain. Swap `.plate-fill` contents for real imagery later; the tone
classes and captions carry over. Type: Fraunces (serif), Inter (body), Space Mono
(captions, folios).
