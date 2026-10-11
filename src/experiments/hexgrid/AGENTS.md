# Hexgrid — notes for the next session

Read `seed.md` first: it holds Andrei's brief verbatim and the questions this
build could not answer. This file holds the traps.

## How it is built

- `hexgrid.ts` is the whole piece: grid, colours, loop, scene. `buildGrid` runs
  on any change to `GRID_KEYS` in `settings.ts`; per frame only the clock moves.
- Each hex owns a **ring** — its hex distance to the nearest dark centre, from a
  multi-source breadth-first search — and a **late** share of `stagger`, shared
  by its whole flower. When the colour reaches it is
  `late * stagger + ring * travel` seconds into the bloom.
- **Tiled centres** are `(q + 3r) mod 7 == 0` in axial coordinates. That form
  gives the six neighbours of a centre the six other residues, so every hex is
  a centre or a petal of exactly one. Change the 3 and that stops being true.
- **Triad** is `(q - r) mod 3`, which no two neighbours share.
- The dark middle is **one sprite** laid over every hex, not a gradient per hex.
  It is round and reaches past the flat sides into the gap, which is black
  anyway, so it needs no clip. A gap that is not black would show it.

- **A cycle is one pattern.** When it ends, `advance` bumps `cycle` and
  rebuilds: new centres, new hues. Cycle 0 is salted exactly as the seed alone,
  so an address always opens on the same first pattern; later cycles add the
  cycle number to the salt, and `wander` moves their base hue. `clear()` goes
  back to cycle 0. A cycle's period depends on its own ring depth, so the clock
  is kept as `clock - begun`, never `clock % period`.
- **The two fades share one period.** `timeline` makes `full + hold + fade` the
  period for both; a wave fade takes each hex out `hold` after it reached full,
  so every hex is lit for the same time (measured: 1.45s on every ring of the
  primary), and a together fade waits for the last hex. Outlines rise through
  `rest` and leave with their own hex's colour.

## Traps

- **Fixed lightness and fixed chroma cannot both hold in sRGB.** At L 0.56 and
  C 0.22 cyans top out near 0.1. `vivid` therefore takes `gamut`: pull chroma
  in at the asked lightness, or move lightness to where the chroma fits. Moving
  lightness without a bound sends cyan to L 0.9, which glares against the dark;
  `REACH` caps it at 0.2. `stats().chroma` and `stats().lightness` measure both.
- **Hue spread must be measured round the circle.** The first `petalHueSpread`
  reported 243° on a warm preset whose hues straddle 0°; the colours were
  fine and the stat was wrong. It is now 360 less the widest gap.
- **The poster needs a dwell even with the clock held.** At `dwellMs: 0` the
  chrome was still fading (`--ui-fade`) and the preset labels were ghosted into
  the capture.
- **A cycle starts from outlines, and a wave fade is never all lit.** Anything
  that captures a still — poster, note backdrop, a showcase host — sees a
  black grid unless it settles first, and "the middle of the hold" is not a
  full grid when colour travels as a band. `poster.ts` walks the first cycle
  and goes back to the moment with the most colour on screen.

## Measuring

`experiment.stats()` reports the loop's phase boundaries, `byRing` (how lit each
ring is now, ignoring stagger), `lit` (mean intensity over every hex),
`petalHueSpread`, and chroma and lightness as actually shown. Checking a loop:
`experiment.pause(true); experiment.clear(); experiment.settle(t)` at points
in each phase, and read `byRing`.
