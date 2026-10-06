# Streakers — notes for agents

Read `seed.md` first: it is Andrei's brief and every round of his feedback,
verbatim. This file holds the traps.

## How it works

- **A dot is a time, not a position.** A line is a queue of emission times;
  a dot's distance down the line is `(now - t) * speed`. Nothing is integrated,
  so nothing drifts and `settle` is a clock change. `streakers.ts` heads with
  this.
- **A scene is built full.** `fill()` back-fills each line with one crossing's
  worth of dots, so the poster, the note's backdrop and a showcase mount need
  no settling. `clear()` empties every line to watch them fill.
- **Intervals are gamma-distributed**, mean 1, with `evenness` mapped linearly
  onto the coefficient of variation (`gapCv`): 0 is Poisson, 1 is CV 0.03.
  `stats().intervalCv` against `expectedCv` is how you check it fired.

## Traps already paid for

- **Size spread on sub-pixel dots reads as brightness, not size.** A lognormal
  of sigma 0.6 at full looked like nothing on saturn's 0.7px dots, and Andrei
  reported line and dot sizes "don't appear to be doing much". The spreads are
  now uniform in log over `SIZE_RATIO` (16) at 1. The same-sd-at-same-value
  trap: an 8x uniform-log spread has the _same_ standard deviation as the old
  lognormal, so it would have looked no stronger — measured with
  `stats().radius`, not guessed. Read `radius.lineRatio` and `min`/`max`.
- **The off-screen pad must cover the largest dot the spreads can make.** A pad
  of `size * 6` let club's 200px discs pop in and vanish half on screen. `pad`
  in `buildLines` is now derived from `SIZE_RATIO` and both spreads.
- **A ring aims at the middle, always.** A "parallel" aim on a ring was the
  edge layout with the downstream half of the emitters pointing off screen
  (23 of 160 crossed). Retired; "all follow the same angles" in the seed is
  `twist`. `stats().missing` counts lines that never cross the screen — a ring
  with large `scatter` still makes some.
- **Hue was chrome-only** and read as broken. `tint` (0 is white) and `hues`
  (per-line spread) give it the dots; lines are sorted by hue offset at rebuild
  so one fill covers each colour run.

## Published

Six scenes are on the wall, pinned to `streakers.7286d5bcf698.js`. Changing this
piece obliges asking whether they move; the default answer is no.
