# Melting — notes for agents

Read `seed.md` first. It has Andrei's own words for what this is, which is the
only thing that says what the piece is _for_; everything below is what it cost
to build.

## The premise: a function of time, not a simulation

Everything drawn at scene time `t` is computed from `t` and the seed alone, and
never integrated frame by frame. That is the piece, not an implementation
choice: it is why `clock: "wall"` lets two screens opened together show the same
lamp, why `goto(t)` lands on the same lamp from anywhere, and why `settle` is
exact. `melting.spec.ts` holds the first two.

**So a change that keeps state between frames breaks the piece**, however good
it looks. Anything that seems to need memory — a lump remembering where it
split, a satellite carrying matter home — has to be re-derived from `t` and the
beat stream instead. Every mechanism here was built that way, including the
ones that look most like physics.

## The trap that cost the most: seams in a pure function

A pure function of `t` can still jump, wherever a quantity steps at an instant.
Andrei saw "the smooth lines change their curvature abruptly all at once" on
`calm`, and two seams were found only by stepping frame by frame:

- **The pool was a row of blobs spaced by its depth.** Each time the count
  stepped, every blob was re-evened at once and the whole surface jumped (0.9%
  of the screen in one frame). It is now evened over fixed points laid out from
  the middle, keyed by distance from it, and faded well off screen.
- **A satellite that crossed to a neighbour handed over its matter**, and when
  its cycle turned over the matter jumped home in one frame. It now seeps back
  while the next bud forms.

A third came later: when `cycle` was made a dial, the solid's matter crossed in
or out of the pool over a fixed share of the cycle, and a short cycle swelled
every heap of the pool by 4–8 px a frame. It now crosses over 7.5 s whatever the
cycle.

**The check that finds them is per blob, not per picture**: between frames at 30
fps, no blob on screen changes radius by more than 4 px, or appears, vanishes or
moves 25 px at size. `blobs()` exists for it. With the satellite fix switched
off it flagged 99 corner jumps in two minutes; a screenshot shows none of them.

## A blob that is not there keeps its id at radius 0

Ids are fixed by role: the solid's corners count up from 0, satellites from
100 000, the gathered solid is 150 000, lumps of wax from 200 000, the pool from
300 000 and the ceiling from 400 000. A corner of a solid that is away (`keeper`
below 1, or `wax alone`) stays in `blobs()` at `r: 0` rather than leaving it,
so ids never shift. **Anything counting what is drawn filters on `r > 0`** — a
spec that did not listed fourteen corners under `wax alone`.

## The field sums in order, so new blobs go last

The land is one field: every blob adds to it and the coast is wherever it
crosses 1, traced by marching squares and filled once as a single path. Floating
point sums depend on order, so **a new kind of blob is pushed after every
other**, and only when its setting is on. That is how the ceiling arrived
without moving a single sample of any preset that does not use it. Insert one
in the middle and every coast moves by a rounding error, which nothing visible
reveals and any exact comparison does.

## The wax is conserved, and that was measured, not assumed

What is not out in lumps lies in the pool; whatever buds, splits or is
swallowed takes its matter (`r²`) from one blob and gives it to another. Over
ten minutes at 1280×800 the lit area with every lump out stays within 3% of the
area with all the wax in the pool; when the pool did not give up what left it,
it rose 48%. A stretched blob is thinned so its tail adds no matter. `reservoir`
at 1 deliberately breaks conservation — the bottomless pool Andrei asked for.

## The wall clock reads the wall

The loop clamps a frame to 0.1 s, so a machine drawing under ten frames a second
fell behind the time it showed, and a hidden tab stopped it. On the wall clock
at 1× the scene reads `Date.now()` every frame, with an offset that `settle`, a
slowed clock and `goto` carry. At any other speed it steps.

## The poster is a fixed moment

`poster.ts` pauses and calls `goto` on one moment, so a recapture is the same
picture. Pausing brings the chrome back, so the recipe waits 800 ms for it to
fade — at 0 the panel was in the shot.

## History that is not in this branch

The piece was built on a local branch, `melting`, over 18 commits from
2026-10-24 to 2026-10-26, first as `islands`, and published squashed. That
branch keeps seven presets dropped before publishing (`lava`, `churn`, `deep`,
`multitude`, `cube`, `bare`, `crowded`) and the measurements in its commit
bodies. Its registry was compacted once while nothing was published; from
publication on it is append-only like every other.

A separate project keeps its own copy of this scene, taken at `ea2a51f` on that
branch, to read the time back out of footage. **Nothing here is owed to it**:
it checks itself against its own snapshot, so this piece may change freely.
