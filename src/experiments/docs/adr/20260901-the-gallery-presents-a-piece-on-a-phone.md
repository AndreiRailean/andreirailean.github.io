---
type: ADR
status: accepted
date: 2026-09-01
summary: A touch device gets the piece full-bleed with no chrome and three gestures, reached only through the console API so the gallery holds no per-piece knowledge.
---

# The gallery presents a piece on a phone, through the console API

## Context

The pieces already fitted a phone screen — they are full-bleed graphics and a
narrow viewport is just another aspect ratio. What did not fit was everything
around them.

> **That first sentence is true of the case this record decides and false as a
> general claim, and it has now misled a reader.** `20260906-a-frame-is-not-a-viewport.md`
> measured it: Starry Night's dot count grows with `area^0.75` because a smaller
> _viewport_ implies a closer viewer, so the same scene comes out roughly twice
> as dense at 320×200 as at 1280×800 — **which are the same aspect ratio.** What
> moves the picture is size, not shape.
>
> The decision below is unaffected, and that ADR says so outright: a phone
> viewport _is_ a viewport, held close, so the interactive view "is already
> relying on the tuned-for-a-viewport case and is fine". Read the sentence above
> as being about the chrome not fitting, which is what the paragraph below it
> goes on to describe.
>
> **What it must not be read as** is a licence for anything else that renders a
> piece into a box. A page-sized region is the other clause of that ADR —
> "whatever renders a piece at a size it was not tuned for owns choosing settings
> for it" — and a session designing one asked whether full-bleed here had been a
> deliberate choice it would be contradicting. It had not; the two are different
> cases. Noted here so the next one does not have to ask.

The kit's bar puts preset buttons and a `adjust` toggle at 12px tall in the
corner, and the panel behind it is thirty rows of sliders; on a touch screen
those are targets nobody can hit and nobody wants to. The section's author,
looking at the index on a phone, reached for gestures that were not there:
sideways through a piece's scenes, up and down between pieces, the way an
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
