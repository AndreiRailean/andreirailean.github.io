---
type: ADR
status: rejected
date: 2026-08-29
summary: Dangler's R2 sequence is right for eighty anchors and visibly wrong for nine thousand specks — its evenness reads as a lattice, and the next piece will copy the file that contains it.
---

# A low-discrepancy scatter does not survive a change of scale

## Context

`random.ts` exists twice in this section, in Dangler and in Flotsam, and
`ADR-0002`'s rule is why: nothing gets hoisted until a second _and_ a third piece
want it, and Starry Night wants none of it. So the next piece that needs seeded
placement will copy one of those two files, and it will copy the choices in them
along with the code.

One of those choices is a low-discrepancy sequence. Dangler scatters its anchors
with R2 and documents exactly why: eighty points drawn uniformly clump into
accidental pairs, and R2 spreads far more evenly. That reasoning is correct at
eighty points and it is the reasoning a reader will carry over.

## What was tried

Flotsam placed its flotsam with the same R2 sequence, for the same stated reason,
and with a second argument on top: a scatter that starts _more even than chance_
leaves the waves somewhere to move it to, so the index of dispersion has a low
floor and the gathering reads as a larger change.

## How it failed

At nine thousand pieces drawn a pixel or two across, R2's evenness is not
invisible order. It is a **visible lattice** — the frame comes out faintly ruled
with diagonal lines, plainly a pattern, and nobody put it there.

That is fatal in a piece whose entire subject is floating things gathering into
lines. Every structure on the water has to be the waves' doing; a lattice is
structure the scatter arrived with, and a reader cannot tell one from the other.
It is the same class of fault as an arrangement clumping, in the opposite
direction.

Uniform random placement, indexed by `i` rather than streamed, was the fix. It
keeps the property that actually mattered — piece seven is the same piece whether
there are a hundred or nine thousand, so raising the count adds to the water
instead of restirring it — which comes from the _indexing_, not from R2. And it
hands the dispersion statistic a canonical baseline of exactly 1, where against
an R2 start the reading sat between two figures that both needed explaining.

## What would make it viable

A smaller population, or larger points. R2 is not wrong; it is right at the scale
Dangler uses it and wrong at the scale Flotsam does, and there is no setting that
makes it right at both.

The transferable rule is narrower than "do not use R2": **a placement strategy is
a choice about a scale, and it does not travel with the file it is written in.**
When copying `random.ts`, copy the reasoning too, and check it against the number
of points the new piece will actually draw.
