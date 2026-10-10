# dotfield — notes for whoever changes this next

Columns on a lattice seen from above, each a damped spring for its top, all
driven by one smooth wind. `seed.md` has the brief in Andrei's words; read it
first. The mechanism is in the header of `dotfield.ts`.

## Traps this build already paid for

- **Never sample the wind inside the spring's substeps.** The wind is twelve
  cosines per column; the spring is four multiply-adds. With the wind inside
  the substep loop, physics was 12 ms a frame at 3.7k columns and 34 ms at 10k,
  and a slow frame takes more substeps, so it gets slower still. Sampled once a
  frame, it is 1.4 ms and 3.5 ms. The wind changes over seconds, so once a
  frame loses nothing. `stats().ms` splits `step` from `draw` — read it before
  and after any change to the loop.
- **Headless fps on this box is not the piece's fps.** Chromium here
  rasterises in software: `stats().fps` reads 11–15 while `ms.step + ms.draw`
  is under 10. Judge cost by `ms`, not by `fps`.
- **Perspective is placed against the frame, not the column.** The first cut
  put the camera at `height / perspective`, about 150 px up at 0.3, so columns
  near the edges blew out into a starburst. How much a standing column shows
  its side depends on how far it is from the middle compared with the camera's
  height, so the camera is placed against the half-diagonal.
- **A gust only adds to the breeze.** The gust envelope is rectified
  (`max(0, …)`) so a trough never pushes upwind. Take that out and the field
  flickers against the wind.
- **Wave phases are integrated, not computed from the clock.** Dragging
  `drift` or `churn` changes how fast the pattern moves and never jumps it.
  Changing `direction` or a size rebuilds the waves and carries their phases
  across.

## What `stats()` is for

`align.nearLessMean` against `align.farLessMean` is the seed's "proximal
alignment" as a number: the cosine between neighbours' leans, and between
columns half a frame apart, each after taking off the field's mean lean. A
strong breeze makes everything agree, so the version without the mean
subtracted cannot tell you whether the variation is local. On the presets at
1440×900, near is 0.73–0.99 and far is −0.2 to 0.17. `hue.nearStep` against
`hue.farStep` is the same check for colour.

## Known approximations

- Bands are layered by fraction of height, not absolute height. With
  `heights` above 0, a short column's top can draw over a tall neighbour's
  side.
- With perspective, one band's stroke width is set from the nominal height,
  not each column's.
- A drawn lean saturates at the column's height through `tanh`, so a laid-flat
  column reaches no further than it is tall. The spring itself is not
  clamped; `lean.max` in `stats()` above 1 is the spring overshooting, not a
  drawing fault.
