---
type: ADR
status: accepted
date: 2026-11-02
summary: The index draws each plate with its own piece and fades the frame in, and the poster is kept as the fallback.
---

# The index draws its plates

## Context

Andrei asked what it would take for the index to animate: on hover, by waking
plates in turn, or all at once. Each of those starts from the same step, a
plate showing a frame its piece drew rather than a picture of one, and he chose
how it should arrive: "i don't mind if the index starts blank and the poster
fades in after render." He also set the limit on cost: "i don't want to tax any
computer, no matter how powerful, into running these simulations all at the
same time."

`20260901-a-poster-held-over-a-booting-piece.md` is the rejected neighbour. It
showed the poster first and crossfaded to the live piece, and the two pictures
did not match, so the crossfade read as a jump. Starting blank means the poster
and the drawn frame are never on screen together, so they do not have to match.

## Decision

`gallery/plates.ts` draws the plates. Each plate starts empty. When it comes
near the screen, its piece is started in a canvas the size of the poster's box,
`PLATE`, brought to the moment its poster recipe photographs, drawn once and
destroyed. The frame then fades in, and CSS scales the canvas to the plate. The
piece composes in the box its poster was captured in, so a piece sized in css px
draws the same picture at every plate width.

It draws **one plate at a time, in idle time**, and leaves nothing running.

**The poster is the fallback, not the first paint.** It is shown when:

- there is no script: an inline script hides the posters before paint, and
  brings them back if the module never runs;
- a piece throws while drawing;
- a piece is in `POSTER_ONLY`;
- the device has taken longer than `BUDGET_MS` (600 ms) to draw a plate, or
  3 s across the wall (1.5 s until 2026-11-06). The first slow plate stops the rest;
- a piece's code or its recipe has taken over ten seconds, so a stalled fetch
  cannot hold the queue.

**Pieces whose recipe moment is expensive keep their posters.** At first only
five pieces draw. The other eight simulate seconds to minutes before the
shutter, measured at 0.8–39 s on a box with no GPU, or settle inside their
runners. Each leaves `POSTER_ONLY` once it can start from a state that already
looks like it has been running. That state is approximate, not replayed.

**Amended 2026-11-06.** Two of those eight were never measured and were not
slow: embers was listed for the settle in its runner's `mount`, which the index
never calls, and Starry Night because a fresh sky has no glimmers yet. They draw
in 289 ms and 30 ms, and Starry Night's plate is a quieter sky than its poster.
Bubbles was slow: its primary, `time bubbles`, needs about thirty seconds of
water at 830 ms a second. Andrei suggested `standing still` and then promoted it
to primary, so the plate still shows where its link lands. A coarse warm-up,
`warm`, at four times the step, reaches it in 220 ms, about 260 ms for the whole
plate, and its poster was recaptured the same way. The eight drawn plates now
cost about 1.1 s of the 1.5 s total on the preview box.

Then crowd and flotsam, by their first frames: a still does not show what their
recipes ran forty-odd seconds to build, as their `poster.ts` files explain. Ten
plates come to about 1.5 s, so the total became 3 s at Andrei's word.

**And a visitor who asked for less motion gets every poster.** Each piece
honours the preference inside its own `start()`, with a still of its own and a
pre-roll of up to twenty-two seconds of simulation, which the recipe's
warm-up then paid on top of.

## Consequences

- A poster recipe now has two readers, the capture and the index. A recipe
  whose `prepare` reaches for a console verb that `plates.ts` does not hand it
  throws, and that plate falls back to its poster with a console error. The
  browser suite fails on that error.
- **The posters are still downloaded** for plates that are drawn, because they
  stay in the page as the fallback. That costs bandwidth, not paint.
- `src/experiments/poster.ts` holds a value as well as types: `PLATE`, the one
  size both readers must agree on.
