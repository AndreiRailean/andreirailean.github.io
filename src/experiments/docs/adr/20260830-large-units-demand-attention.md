# Large units demand attention, and every piece pays for it

**Status:** Accepted — 2026-08-30

## Context

Three pieces have now independently discovered the same thing about populations
of mixed-size elements, and each solved it locally without anyone noticing it was
the same problem.

- **Starry Night** grew `size mix`, which "decides how rare the big stars are —
  at 1 every size is equally likely, and turning it down makes each larger size
  scarcer than the one below it".
- **Flotsam** found that sizes have to follow a power law rather than being
  log-uniform: log-uniform "puts a sixth of the population in the top octave — at
  nine thousand pieces that is fifteen hundred fat discs, the picture comes out
  as white confetti, and the fine haze the gathering is legible in is buried
  under it". It then grew `sizeMix` as well, because every other lever on
  brightness also changed what was afloat.
- **Psyxels** hit it twice in one session. Its coarse units outlasted the grain
  around them — 3.6 seconds against 1.6 — because of how the subdivision ends a
  unit's life; and a large unit's mark sits in a _hole_, because a mark's ink is
  a fixed share of its own square, so the same drawing reads as tone at seven
  screen pixels and as a thin sign surrounded by ground at a hundred.

The piece's author named the through-line, having watched all three:

> bigger units — stars, psyxels — demand more attention and break the illusion of
> natural flow. **"Organic change" will be the common theme of all experiments.**

That is worth having written down, because each piece has so far rediscovered it
by eye, late, after the machinery was already built around the assumption that
size is neutral.

## Decision

**Treat the large end of any size distribution as a thing that needs its own
control, and expect to spend effort making it quieter.** Not a shared
implementation — the three fixes have nothing in common mechanically — but a
known requirement, the way "assert on numbers" is.

Three specific claims, each earned:

1. **Attention scales faster than area.** A unit four times the width is sixteen
   times the area and rather more than sixteen times the notice. A distribution
   that is uniform in _count_ is dominated in _effect_ by its largest members.
2. **The ground around a large unit reads as part of it.** Whatever a piece
   leaves empty near its biggest elements is attributed to them. Flotsam's
   confetti and Psyxels' black holes are the same observation from opposite
   directions — one put too much ink in the top octave, the other too little.
3. **A large unit that persists is worse than a large unit that changes.** If the
   biggest thing on screen is also the stillest, the eye fixes on it and the
   piece stops reading as a field. Psyxels had to invert the relationship
   deliberately.

**"Organic change" is the section's aim**, and it is now a term in `CONTEXT.md`.
It is not a rule that can be checked. It is what these pieces are for, and it is
the thing a large, static, isolated element costs.

## Consequences

- A new piece with a size range should expect to grow a control on the rarity,
  the prominence or the lifetime of its large end, and should not treat needing
  one as a sign that something else is wrong.
- Nothing is hoisted. The three implementations — a rarity exponent, a power law,
  a bloom and a depth-scaled lifetime — are answers to different questions and
  travel no better than a placement strategy does
  (`20260829-a-low-discrepancy-scatter-does-not-scale.md`).
- The measurements stay with their pieces. What generalises is the expectation,
  not the number.

## Revisit when

A piece finds that its large elements are _not_ the problem, or finds a fix that
a second piece can use unchanged. The second of those would be the first
candidate for hoisting under the section's usual rule.
