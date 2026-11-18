# Kaleidoscope — notes for whoever changes this next

Read `seed.md` first: it is Andrei's brief verbatim, and the open questions at
its foot are the ones this build could not answer by itself.

## The model

Lines grow in one segment, in scene units where the frame's half-diagonal is 1,
and every frame strokes them once per element of a symmetry group: the N
rotations, plus under `mirror` the N reflections about the lines at `j·π/N`
(segment middles for even `j`, edges for odd). A line takes a decision every
`step` of length — split, turn or straight on — and its direction is always a
whole number `k` of `angle` off its family's `base` — the segment's middle
for a root from the centre, square to the edge (plus `lean`) for one from the
sides. A growing tip ends at the first thing `stops` lets it meet: another
line or any copy of one, including its own copies, or (under `wedge`) a
segment edge. A root and its offshoots are a **family** with a life — wait,
grow, hold, undraw, born again — on its own clock under `cycle: each`, or all
at once under `together`. All of it is in `kaleidoscope.ts`, one module while
the piece is still being found.

## Traps

- **A line on a mirror is its own reflection.** `axisOf` finds it (a root at
  the centre pointing along the middle is one). It splits into one offshoot,
  because the other is that one's reflection; a turn on it is a fork; and it
  **always carries on**. Before that last rule, the spine ended at its first
  split two drawings in three under `rose`, leaving two lines in an empty
  frame — measured over seeds 1–3 before, 1–6 after (42 to 80 lines each).
  If you add a decision, decide what it means on a mirror first.
- **Under mirror, `wedge` and `free` look alike with `stops: any`.** A line
  reaching a segment edge meets its own reflection exactly there, so it stops
  at the edge either way. The difference only shows under `turn`, or with
  `stops: own` or `none`. This is the geometry, not a bug; the `confine` hint
  says so.
- **Under turn, a line rarely meets its own copy.** Outward-heading lines
  diverge from their rotations; a meeting needs a line turned sideways or
  back. Measured: 0 of 40 straight lines, 2 of 40 turning chains. The test is
  not blind (the same probe gives 26 under mirror), it is just rare.
- **The joint is skipped by distance along the step, not along the line.** A
  meeting within `JOINT` of the start of a tip's step is the joint it grew
  from: a child on its parent, siblings at their split, a parent carrying on
  past its offshoots, a root's copies at the centre. Skipping by distance from
  the line's start instead would leave a carrying-on parent to meet its own
  children at the split (reasoned when written, not measured).
- **A root at the centre aimed wider than its segment starts on both walls**,
  so the meeting test cannot see it leave. `tick` checks the tip's polar angle
  under `wedge` and ends it (`wall`).
- **A family's clock is its own.** `line.born` is the family's clock, not a
  global one, so undrawing replays that family only. What a family has undrawn
  is gone for meetings as well as for drawing (`visibleFrom`), so new growth
  passes where an old family was. Without it a reborn root would stop
  against lines no longer on screen (reasoned, not measured).
- **A reborn family is a new `id`**, and `stops: own` compares ids, so a root
  never meets its previous life as its own.
- **Undrawn lines stay in `lines` until `compact`**, flagged `gone`, because
  the grid holds line indices. `compact` renumbers and refiles everything; it
  runs when undrawn lines pile past `COMPACT_AT` or half of all lines.
- **Roots from the sides start on a wall**, so the wall meeting at their first
  step is a joint and skipped. Under mirror they start on the outer edge only:
  the other side of the half-segment is the middle, where the reflection does
  the rest, and bands meet their reflections there as chevrons.
- **Growth runs in fixed `TICK`s and tips move in a fixed order**, so a tip
  meets a neighbour as it stood at the end of that neighbour's move this tick
  or the last. Live, `settle` and the poster grow one drawing. Changing `TICK`
  moves every drawing.
- **Every family birth has its own rng**, salted by seed, slot and birth count.
  A new random draw belongs on a new salted stream, not on these, or every
  seed moves.
- **A line is a filled outline, not a stroke**, so its ends can be cut:
  flush with the near edge of a line it ran into, along the mirror where it
  met its own reflection tip to tip, along the wall it started on or reached,
  mitred where it turned or split, square where it is free. A stroke's caps
  can only be round (a bulb on a bold line) or square (a corner hanging past
  the line it met at any angle but 90°). Width is in the outline, so lines
  are grouped by colour alone, one `Path2D` each: a frame is colours × copies
  fills, which `stats().strokes` counts.
- **A slanted start puts a corner behind the start point**, at a negative
  length along the line. Clamping it to 0 squared that corner off and left a
  notch at every wall start and every bend — seen at 4×, gone once removed.
- **Meeting at another line's very end is not closed.** The cut follows the
  other line, which is not there past its end, so a corner hangs over by up
  to the half-width. Seen on `septa line`, where roots under `turn` start on
  walls their rotated copies run into; how often is not measured.
- **A line's width is drawn from `family.widths`**, a stream of its own, so
  moving the width handles moves no line: measured on `septa line`, seed 3,
  the same 14 lines and 67 births at one width and at 1.85–8px. Cutting the
  ends moved none either: all eight presets, seed 7, 40 s, the same lines,
  births, length, decisions and endings before and after.
