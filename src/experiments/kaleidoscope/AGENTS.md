# Kaleidoscope — notes for whoever changes this next

Read `seed.md` first: it is Andrei's brief verbatim, and the open questions at
its foot are the ones this build could not answer by itself.

## The model

Lines grow in one segment, in scene units where the frame's half-diagonal is 1,
and every frame strokes them once per element of a symmetry group: the N
rotations, plus under `mirror` the N reflections about the lines at `j·π/N`
(segment middles for even `j`, edges for odd). A line takes a decision every
`step` of length — split, turn or straight on — and its direction is a
whole number `k` of `angle` off its family's `base` — the segment's middle
for a root from the centre, square to the edge (plus `lean`) for one from the
sides — plus a `bend`, which is 0 unless it curls or rounds a corner. A growing tip ends at the first thing `stops` lets it meet: another
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
  children at the split (reasoned when written, not measured). `JOINT` is
  rounding error, 1e-9: a tick's step is about 0.001 long, and at 1e-4 a
  real meeting fell in the skipped stretch one time in a dozen and was passed
  through — on `concentric` at step 20, 2–3% of bars crossed their own
  reflection, more the slower they grew, and none at 1e-9.
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
- **Square to the edge grows outward.** A straight line square to the radius
  where it starts only gets farther from the centre, and a positive `lean`
  tilts it further toward the rim on either side. Measured with
  `stats().inward`, the share of drawn length heading in, on seven turned
  segments from the sides, seeds 1–3: 0 at lean 47 and at lean 0, 0.66–0.95
  at −47. Roots from inside the segment are held to outward directions too.
  `flip` is the share that goes the other way, drawn on a stream of its own:
  at 0 all eight presets grow as before; at 1 it gives lean −47's numbers
  exactly.
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
- **On a narrow mirror segment, a root from the sides never decides.** It
  meets its own reflection at the middle after at most about `r·sin(π/N)` over
  the cosine of its lean, so with a long `step` it ends before its first
  decision, and `split`, `keep`, `turn`, `angle`, `life` and `taper` (depth
  stays 0) move nothing. Measured on `concentric` (32 segments, step 40),
  seeds 942088, 1 and 2, 60 s each: 1 decision in 1942 births; each of those
  six changed alone left the lines and the pixels identical. Decisions start
  near step 20 (52 in 1932 births) and `life` ends a line from step 6.
- **An arc is a chain of straight links**, each bending `ARC` (3°) from the
  last and mitred to it, so meetings, cuts, the grid and undrawing are all
  the straight-line code. `carryOn` ends a link and starts the next as the
  same line: its width, depth and next decision carry over, and its `born` is
  where the last one ended, so undrawing runs on along the curve. A tick's
  growth carries from link to link (`budget`), or a tight curve would grow
  slower than a straight line. With `curl` and `round` at 0 no line is ever a
  link: all eleven presets grew the same lines, births, length, decisions and
  endings before and after (seed 7, 40 s). Curls are drawn on
  `family.curls`, a stream of their own.
- **A rounded corner sets out along the line it leaves**, and bends away. Off
  the spine, that is along the mirror, and `axisOf` took it for a second
  spine: kept straight on top of the first, and every offshoot of it too —
  1664 lines on `rose` at round 0.5, against 21. A line rounding a corner
  (`aim` set) is never a spine. The spine itself stays straight under curl.
- **Links cost draw time, not growth time.** Mean draw per frame over 60 s,
  headless: `lattice` 0.79 ms straight, 13.3 ms at round 1 (6528 links);
  `neon pinwheel` 0.39 ms, 10.7 ms at curl 90 and round 1. Joining a curve's
  links into one outline would cut its polygons; not built. At 4× the joints
  between links show no seam.
