# Hexgrid — notes for the next session

Read `seed.md` first: it holds Andrei's brief verbatim, each round of his
feedback, and the questions this build could not answer. This file holds the
traps.

## How it is built

- `hexgrid.ts` is the whole piece: patterns, colours, timing, scene.
  `buildPattern` runs once per cycle and on any change to `GRID_KEYS` in
  `settings.ts`; per frame only the clock moves.
- **Growth is first-passage, not rings.** `grow` is Dijkstra from every centre
  at once, where entering a hex costs `1 ± 0.9 ragged` at random. A hex's
  `steps` is its cheapest distance, and the colour reaches it
  `late * stagger + steps * travel` seconds into the bloom. At `ragged` 0 this
  is exactly the old breadth-first rings. Ownership goes to whichever centre's
  colour arrives first. `ring` is still the plain hex count, kept for the six
  round a centre (`ring === 1`) and for `stats().rings`.
- **Tiled centres** are `(q + 3r) mod 7 == 0` in axial coordinates. That form
  gives the six neighbours of a centre the six other residues, so every hex is
  a centre or a petal of exactly one. Change the 3 and that stops being true.
- **Triad** is `(q - r) mod 3`, which no two neighbours share.
- The dark middle is **one sprite** laid over every hex, not a gradient per hex,
  sampled at 48 stops from `darkness`: `core` at the middle, half dark at
  `hole`, falling over `soft` in the shape `curve` names — a logistic by
  default, at Andrei's third round ("not a linear gradient, but an s-curve").
  Each curve is renormalised to exactly `core` at 0 and 0 at the corner, so the
  S-curve's 10–90% fall comes out a little under `soft` (0.237 for 0.25);
  `stats().hole` measures it. It is clipped
  to the hex — see the trap below.
- **Fading by the hole.** `intensity` returns a third value, `open`: 0 at the
  resting hole, 1 when the hole has swallowed the hex. `opened` maps it to a
  bigger `hole` and a `core` deepening to black, and `buildVignette` draws
  `OPENINGS` sprites from rest to swallowed. On exit the colour holds while the
  hole grows and fades only in the last `SWALLOW_LEAD`; on entry the reverse.
  Where patterns overlap, the strongest pattern's hole is drawn.
- **Patterns overlap.** A new one starts `next = period * (1 - overlap)` after
  the newest began, so several can be live, and a pattern is dropped when its
  own period is over. Every pattern is built on the same hexes in the same
  order, which is what lets `draw` add pattern `k`'s hex `i` to pattern `j`'s:
  colours add (a cross-fade where two meet), outlines take the stronger.
  Change the grid's build order for one pattern and that pairing breaks.
- **Cycle 0 is the seed's own.** It is salted with the seed alone, so an address
  always opens on the same first pattern; later cycles add their number to the
  salt, and `wander` moves their base hue. `clear()` goes back to cycle 0. A
  pattern's period depends on its own depth, so each keeps its own `begun` and
  the clock is never taken modulo anything.
- **The two fades share one period**, `full + hold + fade`. A wave fade takes
  each hex out `hold` after it reached full, so every hex is lit for the same
  time (measured: 1.45s on every ring of the first round's primary); together
  waits for the last hex. **Outlines come last**: `trail` after a hex's own
  colour is full, leaving with it — Andrei's second round, where outlines
  arriving first "get in the way".

## Traps

- **A hole sprite must be clipped to its hex.** The resting hole fades to clear
  well inside the hex, so a square sprite with no clip looked fine for four
  rounds. A growing hole (`exit: "hole"`) is dark out to the square's corners,
  and those landed on the neighbours as dark rectangles. Seen in a close-up,
  not in any number; `buildVignette` now cuts each sprite to the hex path.

- **Fixed lightness and fixed chroma cannot both hold in sRGB.** At L 0.56 and
  C 0.22 cyans top out near 0.1. `vivid` therefore takes `gamut`: pull chroma
  in at the asked lightness, or move lightness to where the chroma fits. Moving
  lightness without a bound sends cyan to L 0.9, which glares against the dark;
  `REACH` caps it at 0.2. `stats().chroma` and `stats().lightness` measure both.
- **Hue spread must be measured round the circle.** The first `petalHueSpread`
  reported 243° on a warm preset whose hues straddle 0°; the colours were
  fine and the stat was wrong. It is now 360 less the widest gap.
- **Ragged shortens the pattern.** The cheapest path picks the cheap hexes, so
  `maxSteps` falls as `ragged` rises (18 → 14.5 → 12.2 on the primary at 0, 0.6,
  1. and the period with it. A comparison across `ragged` is not at equal
     timing unless `travel` is adjusted.
- **The poster needs a dwell even with the clock held.** At `dwellMs: 0` the
  chrome was still fading (`--ui-fade`) and the preset labels were ghosted into
  the capture.
- **A pattern starts dark, and a wave fade is never all lit.** Anything that
  captures a still — poster, note backdrop, a showcase host — sees a black
  grid unless it settles first. `poster.ts` walks the first cycle and goes back
  to the moment with the most colour on screen.

## Measuring

`experiment.stats()` reports, for the oldest live pattern: its phase
boundaries, `byStep` (mean colour by whole steps out), `petalArrivalSpread`
(how far apart, in steps, the colour reaches the six round a centre — 0 means
they light at once), `petalHueSpread`; and across everything, `patterns` (how
many are live), `lit` (mean colour over every hex) and chroma and lightness as
shown. Checking timing: `experiment.pause(true); experiment.clear();
experiment.settle(t)`. Dark time: settle in 0.1s steps and count frames with
`lit` under 0.05 — overlap 0 measured 38% dark, 0.4 measured 3%.
