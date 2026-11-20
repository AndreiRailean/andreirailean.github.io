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
- **The joint is a point, not a stretch of every step.** A meeting within
  `JOINT` (1e-5) of where a line started or last branched — a child on its
  parent, siblings at their split, a parent carrying on past its offshoots,
  a root's copies at the centre — is the lines it branched from. It was
  first the opening 1e-4 of every tick's step, which a step of about 0.001
  makes one real meeting in a dozen: on `concentric` at step 20, 2–3% of
  bars crossed their own reflection, more the slower they grew. Measured
  from the point, none do. 1e-5 is wide for rounding: two arcs setting off
  along one tangent (a rounded offshoot on a curling parent) meet again only
  within about 1e-8 of their radius. `stats().stubs` counts lines met within
  0.001 of their start; widening `JOINT` tenfold left it unchanged on
  `vertigo`, `blinky`, `lattice` and `rose` at curl 120, so those are real
  meetings in dense drawings, not joints.
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
  meets its own reflection at the middle, or leaves the frame, before its
  first step, so `split`, `keep`, `turn`, `angle`, `life`, `round` and
  `taper` (depth stays 0) move nothing, and the panel greys them.
  `farthestBar` in `settings.ts` is the closed form for how far a straight
  bar can grow; it says 13.2% for `concentric` (32 segments, lean ±42), and
  the piece makes 11 decisions at step 13 and none at step 14 (seed 942088,
  60 s). Before the joint fix, bars that slipped through their reflection
  made decisions up to step 20 and beyond. Under curl it says nothing: a
  curling bar can bend away from the middle.
- **A line is one arc.** Every line is a piece of constant curvature
  (`curve`, 0 straight): where it is, which way it heads, where its sides
  cross a cut and where it meets another line are closed forms for line and
  line, line and circle, circle and circle, and its sides are drawn as arcs
  about its centre. A line carries on into a new piece (`carryOn`) only where
  its curve changes — the end of a rounded corner, or a new curl at a
  decision — heading on as it was, with its width, depth and next decision.
  It was first a chain of straight 3° links, each a whole line: rounding
  `lattice` stood 3563 lines against 664 straight, took 1.5 s to grow a
  minute against 0.13 s and 10.6 ms a frame against 0.6; as arcs, 728
  lines, 0.25 s and 1.1 ms. It also made `soft rose` sparse (14 splits to
  `rose`'s 31) for no reason of its own; as arcs the two split alike.
- **A curl under `FLAT` (0.01 rad per half-diagonal) runs straight.** Under
  1.2° across the frame, and it keeps every centre within 100
  half-diagonals, where meeting two circles stays exact.
- **A rounded corner sets out along the line it leaves**, and bends away. Off
  the spine, that is along the mirror, and `axisOf` took it for a second
  spine: kept straight on top of the first, and every offshoot of it too —
  1664 lines on `rose` at round 0.5, against 21. A line rounding a corner
  (`aim` set) is never a spine. The spine itself stays straight under curl.
- **An arc held past a whole turn meets itself** at its start, which no
  meeting between two pieces can see; `firstMeeting` ends it there. Only a
  capped decision or the spine holds a piece that long.
- **The ground is a second growth, painted and never wiped.** `createGrowth`
  is the whole growth (lines, families, grid, clock) and draws nothing;
  `createKaleidoscope` runs two, the lines and the ground, the ground on a
  salted seed at `speed × groundPace`. Each frame paints the ground lines
  that grew since the last onto an offscreen canvas in scene coordinates,
  which is then stretched and turned with the figure under the lines. A
  ground family undrawing frees room for new growth and takes no paint, so
  what grew later lies on top. Three consequences: a change to `groundTone`,
  the hue or the width reaches only new paint (painted over in about half a
  minute at 80px, measured: 69% of the disc at 10 s, 94% at 30 s, 99% at
  60 s on `eleven`); a change that regrows the drawing wipes the ground to
  black; and under `colourBy: age` a chunk takes the time it grew round the
  sweep, because it is coloured once while young, and taking its age, as the
  lines do, painted everything the first colour. With the ground off the
  lines grow exactly as before the split: `eleven` on four seeds, the same
  births, lines, length and decisions. Headless, the turned copy costs about
  25 ms a frame at any ground resolution, which is software filling 24 Mpx;
  what it costs on a GPU is read from the bridge's `frames` events: on
  Andrei's screen with ground 79, a steady 16.7 ms a frame, no late frames,
  1.4–1.9 ms to draw. `groundBlack` is the share of ground births that paint
  black, drawn per birth on a stream of its own, so black is paint like any
  colour and keeps coming back: on his bands scene, two seeds, the lit share wanders
  0.35–0.78 at 0.35 against 1.0 with none, and the lines grow the same at
  every value, the ground's on or off (measured at 0, 79 and 200 px).
