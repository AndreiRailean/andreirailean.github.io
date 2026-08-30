# A third copy of the generators moves to the section level

**Status:** Accepted — 2026-08-29

## Context

`20260829-the-third-copy-moves-to-the-kit` set the rule and applied it to
`wakelock.ts`: a module joins `kit/` when a third piece independently wants it,
and not before. That record closed with a note on what was **not** extracted —

> `random.ts` now exists in two pieces — Dangler's and Flotsam's, the latter
> trimmed rather than copied. Starry Night wants none of it, so this is still two
> data points and the rule has not been met.

Psyxels is the fourth piece and the third that wants it. Every pixel in it is
identified by where it sits in a subdivision — depth, column, row — and its
frame, its rate, its phase and its colour are all drawn from
`makeRng(hashSeed(seed, depth, column, row, …))`, for exactly the reason the
other two do it: a pixel must draw the same numbers whatever else the field
holds, or repacking one corner restirs the whole picture.

`hashSeed`, `makeRng`, `gaussian` and `Rng` were byte-identical in Dangler's and
Flotsam's copies. The third would have been byte-identical again.

## Decision

Those four move to `src/experiments/random.ts`. All three pieces import them from
there. `tests/unit/dangler/random.test.ts` moves with them, to
`tests/unit/random.test.ts`, since what it asserts belongs to no one piece.

**Beside `poster.ts` and `window.d.ts`, not in `kit/`.** They went to `kit/`
first, on the argument that the kit is _offered_ and so are the generators. That
axis separates the kit from the gallery and says nothing about what belongs
inside the kit; it was borrowed from one question to settle another. The test
that discriminates is whether a piece can take one part without the others:
`controls.ts` pulls in `copy` and `fullscreen`, `controls.css` dresses
`controls.ts`, `wakelock` is the same browser surface — you take the chrome or
you do not. The generators travel alone, need no browser, and their test runs in
the node suite rather than the browser one. So `kit/` is the control surface and
only that, and shared code that is not the control surface sits at the section
level, where `poster.ts` and `window.d.ts` already do.

What stays behind is every placement strategy built on top of them — Dangler's
`r2Point` and `discPoint`, Flotsam's `homeFor`. Each piece keeps a `random.ts`
holding only its own.

## Why the split falls there

`20260829-a-low-discrepancy-scatter-does-not-scale` is the reason, and it is the
opposite of a technicality. A placement strategy is a choice about a scale: R2 is
right for eighty anchors and lays a visible lattice across nine thousand specks.
The ADR's finding was that the choice travelled with the file and its reasoning
did not, so copying the file copied the mistake.

Hoisting a placement strategy into the kit would make that worse, not better —
it would put the choice one import away from every future piece with no scale
attached to it. A mixer and a generator carry no such choice: they are the same
answer at every count. So the seam is _stability without policy_ below, _policy_
above, and it is the same seam the two existing copies had already found by
subtraction.

## Consequences

- A bug in the generators is fixed once. Both pieces' `AGENTS.md` lose their
  "fix it in both copies" instruction, which is now false.
- `kit/` holds a module with no DOM in it for the first time. That is fine and
  was always implied — the kit is _offered parts_, not _the chrome_.
- Lifting `kit/` out with one experiment still leaves that experiment running,
  which is the property the kit is held to. A piece now also depends on one
  module beside it, which is the price of not having three copies of it.
- Nothing about being in `kit/` makes it mandatory. A piece wanting a different
  generator writes one.
