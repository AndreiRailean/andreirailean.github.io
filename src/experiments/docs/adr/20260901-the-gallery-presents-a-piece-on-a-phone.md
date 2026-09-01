# The gallery presents a piece on a phone, through the console API

**Status:** Accepted — 2026-09-01

## Context

The pieces already fitted a phone screen — they are full-bleed graphics and a
narrow viewport is just another aspect ratio. What did not fit was everything
around them. The kit's bar puts preset buttons and a `adjust` toggle at 12px
tall in the corner, and the panel behind it is thirty rows of sliders; on a
touch screen those are targets nobody can hit and nobody wants to. The section's
author, looking at the index on a phone, reached for gestures that were not
there: sideways through a piece's scenes, up and down between pieces, the way an
Instagram feed works.

So a piece needed a second presentation. The question was whose it is, and how
it reaches the piece.

`docs/adr/20260828-the-piece-is-independent-the-gallery-is-not` already answers
the first half. A piece owns what it draws, completely. Moving between pieces,
and the way out, are the gallery's — imposed rather than offered, because a
visitor should not have to relearn the exit in the next room. A mobile
presentation is entirely in that second category: it is about crossing between
works, not about any one of them.

The second half was the real question. `gallery/` may not import a piece. But
the view has to load a piece's scenes by name, and hold its animation.

## Decision

**A touch device gets an interactive view: the piece full-bleed with no chrome,
and three gestures.** Across for the piece's scenes, up and down for the wall, a
tap to hold. Its furniture is an X out to the index and a placard naming the
scene with a dot per scene. `gallery/Reel.astro` and `gallery/reel.ts`.

**It reaches the piece through `window.experiment` and nothing else.**

The console API exists because anything reachable only by a pointer cannot be
checked from a headless browser. This is the same need from the other side: the
gallery is a second caller that has no pointer to use and no business knowing
what a setting means. `preset(n)`, `presets()` and `pause(held)` are the whole
surface it needs, and they were already most of the minimum every piece
publishes.

The consequence worth stating is what it buys: nothing in `reel.ts` can grow
per-piece knowledge, because there is no channel for it. Adding a fifth piece
needs no change to the gallery at all — the order comes from
`gallery/order.ts`, which the index reads too, and the scenes come from the
piece itself at runtime.

Two smaller things follow, and both are recorded in `AGENTS.md`:

- **The kit gains a headless mode** rather than being skipped. `createControls`
  is the settings, the validator and the URL sync as well as the bar, and the
  console API is built on the handle it returns — a piece with no
  `window.experiment` is a piece no test can reach. So a page says
  `chrome: !isReel()` and nothing else about any of this.
- **The kit publishes the matching preset** as `data-preset` on `<html>`, beside
  `data-idle`. It already knew, and nothing else can work it out without an
  opinion about what a piece's settings mean.

## Considered options

**A separate mobile route** — `/experiments/m/<slug>/`, or a single
`/experiments/reel/`. Rejected on paper. It doubles every page, splits the
addresses, and makes a link shared between two devices land in the wrong
presentation. `/experiments/<slug>/` staying the one address for a piece is
worth more than the tidiness of a separate route.

**One page holding every piece**, scroll-snapped, only the visible one running.
This is what actually makes Instagram feel like Instagram: no navigation between
items at all. Rejected on paper, and it remains the option to revisit if the
per-piece navigation ever reads as too slow. Two costs decided it. Some surface
would have to import all four pieces and know how to boot each, which is the
per-piece knowledge the console-API seam exists to prevent. And the section's
author, asked, chose a crossfade over seamlessness — the pieces are meant to be
landed on and left running, not flicked past.

**Gestures on a fine pointer too.** Not taken. The panel is better than a swipe
wherever there is a pointer that can hit it, and a trackpad's two-finger scroll
would fight the vertical axis. `?reel=1` forces the view on for a desktop check.
