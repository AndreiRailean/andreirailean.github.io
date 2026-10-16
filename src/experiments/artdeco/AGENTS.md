# Art Deco — notes for whoever changes this next

Read `seed.md` first: it is Andrei's brief verbatim, and the open questions at
its foot are the ones this build could not answer by itself.

## The model, in four sentences

(Since `fold`: "the right half" below is the bottom stems, and "drawn twice"
is drawn once per image of the dihedral group; see the docblock in
`artdeco.ts`.)

Lines grow up from the bottom of the frame at one speed and take a decision
every `step` of length. **Only the right half is grown**; every segment is
drawn twice, once reflected, so symmetry is by construction and never checked.
Directions are an **integer** count of `angle` off vertical, so lines that took
the same turns are exactly parallel. Decisions belong to **families**, not
lines: every line in a family takes its n-th decision from the same entry.

All of it is in `artdeco.ts`, deliberately one module while the piece is still
being found.

## Traps

- **A line on the centre line cannot turn or rebound alone** — its mirror image
  is itself, so turning would break the symmetry. `turn` on the axis forks
  instead, and `rebound` spawns the right-hand line of a reflected pair. If you
  add a decision, decide what it means on the axis first.
- **Meeting your own mirror image is not found by the mirrored-segment test.**
  The mirror of a tip's own segment only reaches the centre line when the tip
  does, so the stored segments never show the meeting. `firstHit` checks for
  the tip crossing `x = width / 2` explicitly (`kind: "axis"`). Remove that and
  lines pass through the centre line in `stop` mode.
- **A hit within `ORIGIN` px of the tip's own segment start is ignored.** Every
  child starts on its parent's line and every rebound starts on the line it hit;
  without the exclusion each one stops the instant it is born, and the drawing
  is a single stem. It also means a tip cannot meet anything in its first 0.75px.
- **Time is distance.** `tree.D` is how far a tip has grown, `seg.born` the `D`
  when the segment began, and the tail that undraws is `D - delay - born`. That
  is why `speed` changes live without a restart and why undrawing replays the
  drawing in order. Do not store wall-clock seconds on a segment.
- **`unison: "all"` is bimodal by construction.** Every line's n-th decision is
  the same, so a fork early kills every line at once and a branch doubles every
  line at once. Measured over forty seeds of the ziggurat preset: 4 segments in
  a third of them, 421–950 in three. A preset on "all as one" needs its seed
  chosen by measuring, not by eye.
- **Split children are one family with opposite `hand`**, which is what makes
  the two halves of every split mirror images of each other about their parent
  as well as about the frame. Give them separate families and the nested
  symmetry goes, with no error anywhere.
- **Strands do not mitre.** Each segment's strands are offset across it, so at a
  turn the outer strand leaves a small gap and the inner one a small overlap.
  It reads as inline lettering at the spacings tried; at large `spacing` with
  `angle: "15"` it will not.

- **Crossing needs `head.past`.** A tip that crosses a line is left standing
  on it, and the next search from that point finds the same line at `t ≈ 0`.
  `EPS` usually hides that and floating error sometimes does not, so the
  crossed segment is skipped by id until the tip bends. A crossed axis is
  skipped by the `ORIGIN` guard on `a`, and a crossed big circle by the 0.01px
  floor on a root.
- **The meeting choice and the circles read their own stream.** Each family has
  a second rng, `marks`, and every token draws `meet`, `corner`, `along`, `at`
  and `size` from it. Drawing them from `rng` would have moved every decision
  of every seed, including the measured ziggurat. A meeting reads the token of
  the decision the tip is heading for, so lines that decide together also stop,
  cross or rebound together, and their circles match.
- **The big circle can only be met where it has been drawn.** It draws up from
  its lowest point at the line speed, so the arc length from the bottom to a
  hit is compared with `tree.D` and the tail. Without that, a tip stops against
  thin air above an arc still drawing.
- **Rebounding off the big circle snaps to the angle.** `offCircle` reflects
  exactly, then takes the nearest multiple of `angle` that still leaves on the
  outgoing side, or stops the tip if none of the nearest three does. At 90° a
  glancing hit often has none.
- **A circle is born where the tip was, and is mirrored by its line's `axis`
  flag**, not by its centre's distance from the axis, so a corner circle on a
  mirrored line near the centre line is still drawn twice.

- **`fold` 1 keeps the old mirror test verbatim.** The general own-image test
  (a tip's path against its image's path) finds the same meetings in
  principle, but not at the same distance from the centre line: the old guard
  is `|a| > ORIGIN` horizontally, the general one a distance along the path.
  Using the general test for the plain mirror moved sunrise from 624 segments
  to 591. Image index 1 is that mirror and is special-cased for that reason.
- **Head-on images meet halfway, not at the centre.** A vertical line off the
  centre line and its top-and-bottom image are collinear, and both tips grow
  at one speed, so the meeting is the midpoint of the tip and its image. A
  flip that fixes a line pointwise (the plain mirror on the centre line) is
  the line itself and is skipped.
- **Images off the angle.** At `fold` 3 with 45° or 90°, a turned copy of a
  line is not a multiple of the angle, so a rebound off it is snapped by
  `reflectOff` and may find no direction and stop. The hint says 15°, 30° and
  60° suit threes.
- **The drawing depends a little on frame length.** Tips grow one after another
  inside a frame, so a tip meets a neighbour's line as it stood at the end of
  the last frame. Stepped at 1/60 s (`settle`, the poster) and live, triad grew
  63 and 67 segments. More folds mean more meetings between different tips, so
  this shows more at 2 and up. An address replays the rules exactly but not
  always the identical drawing; nothing has been done about it.

## Checking a mechanism fired

`experiment.stats()` counts every decision by kind, every meeting by kind
(`line`, `mirror`, `axis`, `halo`, `edge`, `depth`, `cap`), what the lines
`chose` at them, rebounds, offshoots, circles by placement (`corner`,
`along`), and segments dropped at the caps (`MAX_SEGS`, `MAX_HEADS`). A setting whose
counter stays at zero is not doing anything, however the picture looks.
