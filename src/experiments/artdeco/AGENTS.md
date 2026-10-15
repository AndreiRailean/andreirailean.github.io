# Art Deco — notes for whoever changes this next

Read `seed.md` first: it is Andrei's brief verbatim, and the open questions at
its foot are the ones this build could not answer by itself.

## The model, in four sentences

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

## Checking a mechanism fired

`experiment.stats()` counts every decision by kind, every meeting by kind
(`line`, `mirror`, `axis`, `edge`, `depth`, `cap`), rebounds, offshoots, and
segments dropped at the caps (`MAX_SEGS`, `MAX_HEADS`). A setting whose
counter stays at zero is not doing anything, however the picture looks.
