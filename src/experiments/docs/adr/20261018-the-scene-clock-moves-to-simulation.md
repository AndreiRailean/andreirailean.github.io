---
type: ADR
status: accepted
date: 2026-10-18
summary: The frame drivers eight pieces wrote out move to src/experiments/simulation/ as parkingLoop and steadyLoop, with canvas sizing; stepping and the dt clamp stay with each piece, because unifying them changes what pieces draw.
---

# The scene clock moves to `simulation/`

## Context

A deeper pass over the pieces, asked for after the settings plumbing moved
(`20261017-the-settings-plumbing-moves-to-the-section.md`), read every frame
loop side by side. Two families had grown:

- **Parking loops** — Crowd, Dangler, Embers, Flotsam, Walkers. The same
  `tick` header (clamp 0.25 s, fps smoothed at 0.1), the same dirty-or-park
  tail, a byte-identical `wake()` and `setPaused`. About sixty lines each.
- **Steady loops** — Dotfield, Hexgrid, Streakers, and Artdeco nearly. Draw
  every frame, a `held` flag, clamp 0.1 s, the same `start`/`stop`.

Around both: `require2d` in ten pieces, canvas sizing at a DPR capped at 2 in
nine, and the same `settle` clamp to 600 s in six runners.

What did **not** converge is how a frame's seconds become simulation steps.
Five schemes are in use — a dropped accumulator (Crowd, Walkers, Dangler), an
uncapped one (Artdeco), equal substeps (Embers), greedy-then-remainder
(Bubbles) and raw variable dt (the rest) — and each yields a different dt
sequence. The clamps differ by family too.

## Decision

`src/experiments/simulation/` holds the scene's clock and canvas, section level
for the usual reason — a piece takes it without taking the chrome:

- `loop.ts`: `parkingLoop({ clamp, frame, draw, onWake })`, where `frame`
  reports `"moved"`, `"waiting"` or `"idle"`; `steadyLoop({ clamp, step, draw })`;
  `settleSeconds`.
- `canvas.ts`: `context2d`, `measureCanvas`, `fitCanvas`.

**The driver owns the clock, and the piece keeps the stepping and the clamp.**
That is what lets eight pieces adopt it with no change to what they draw.
Unifying the stepping is a visual question and is filed for Andrei — Crowd and
Walkers still have the stop-motion at slow playback that Bubbles and Embers
were written to avoid.

Bubbles, Psyxels and Starry Night keep their own loops, which differ in kind;
Artdeco's differs in order (it requests the next frame last). They adopt the
canvas helpers where those are identical.

`random.ts` stays at the section's top level beside `simulation/` rather than
moving in: the showcase imports it by that path
(`20260913-the-showcase-imports-the-sections-arithmetic.md`), and the showcase is
owned by its own session.

The ten copies of a `NOT_A_PIECE` denylist in the unit suites went first, to
`tests/support/pieces.ts` — otherwise the new directory would have been a false
piece in all ten.

## Verified

`tests/unit/simulation-loop.test.ts` drives both loops with a hand-flushed
`requestAnimationFrame`, and fails when the clamp is removed or `"waiting"`
stops holding the loop open. A fake-clock, seeded fingerprint of every preset of
the eight converted pieces matched `origin/main` on every stats hash; the
screenshots that differed also differed between runs of `main`.

## Later the same day: glows and hues

A read of every piece's rendering found two more things carried by three or more
pieces with identical calls: the radial-gradient glow sprite (Dangler, Flotsam,
Embers, Hexgrid) and the alpha dither that breaks its banding (Dangler, Flotsam,
Starry Night). They are `simulation/sprite.ts`. The hue fold
`((h % 360) + 360) % 360` was in six pieces and is `simulation/colour.ts`.
Colour quantisation, colour-string formatting, trail fades and glow profiles
each differ between pieces and stayed put.

A read of vicinity and collision found nothing to hoist. The four spatial grids
visit neighbours in different orders and bound space differently, so sharing
one would re-sum forces in a different order — different floats, different
trajectories. Crowd and Walkers share `timeToCollision` and an angle wrap, which
waits for a third piece.
