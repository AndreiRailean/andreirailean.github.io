# dotfield — notes for whoever changes this next

Columns on a lattice seen from above, each a damped spring for its top, all
driven by one smooth wind. `seed.md` has the brief in Andrei's words; read it
first. The columns are in the header of `dotfield.ts`; the air is in the
header of `wind.ts`.

## Traps this build already paid for

- **Plane waves read as flotsam's sea, not as wind.** The first wind was a
  sum of travelling plane waves, with gusts as a rectified envelope along the
  breeze. Andrei saw it at once: wind from one direction, cyclical, and gusts
  that were only "more wind" from that direction. `wind.ts` replaced it with
  a veering prevailing wind, gusts as events with directions of their own
  (dangler's model), and eddies from the curl of 3D noise. Do not reach back
  for waves to make it cheaper.
- **A column's rate must not follow its height by default.** A real stem's
  rate goes as 1/length², and with that fixed in, `heights` 0.37 and damping
  0.02 put neighbours 2.8x apart in rate. They rang out of step and Andrei
  reported the springing as random, with some columns bending a lot and
  others hardly at all. `heightSway` now holds the exponent, at 0 by default.
- **"offset" looked the same as "triangle".** Rows half a step offset at one
  spacing apart are a triangular lattice squashed by 13%, and nobody can see
  that. It is now `rows`, a crop at twice the spacing.
- **From straight above, a curl and a straight pole lie on the same line.**
  Every point of a leaning column projects onto the line from its root to its
  top, whatever `hinge` is. So a "how far from straight" measure reads 0 at
  every setting, which is how the first one turned out. What `hinge` changes
  on screen is where the joints and shades fall along that line, and
  `stats().lowerHalf` measures that from the drawn band ends: 0.31 curled,
  0.50 hinged. At `segments` 1 there are no joints, so it reads 0.5 whatever
  the hinge. Perspective is the only thing that bends the line itself.
- **`format: fixed(2)` needs `/* @__PURE__ */`.** It is a call inside
  `CONTROLS`, and without the annotation it pinned all 31 hints into the
  runner (25.7KB, against 18.3KB without them). `pnpm exec vitest run
runner-bundle` caught it; `experiments-runner-weight` did not. A new
  helper call in a control list needs the same annotation.
- **Five grid buttons need a 30rem panel.** The kit's choice row does not
  wrap, and at 23rem and 27rem `diamond` hung off the box's edge.
- **Never sample the wind inside the spring's substeps.** The wind costs
  far more per column than the spring does, which is four multiply-adds. With the wind inside
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
- **The wind's rates are integrated, not computed from the clock.** Dragging
  `veerRate`, `drift` or `churn` changes how fast things move and never jumps
  them. Gusts alone are derived from the clock and the seed, as in dangler, so
  `settle` sees the same weather a live run does.
- **The wind outlives a resize.** Only a new seed makes a new one. Rebuilding
  it on resize used to reset its clock.

## What `stats()` is for

`align.nearLessMean` against `align.farLessMean` is the seed's "proximal
alignment" as a number: the cosine between neighbours' leans, and between
columns half a frame apart, each after taking off the field's mean lean. A
strong breeze makes everything agree, so the version without the mean
subtracted cannot tell you whether the variation is local. On the presets at
1440×900, near is 0.73–0.99 and far is −0.2 to 0.17. `hue.nearStep` against
`hue.farStep` is the same check for colour. `wind.prevailing` against the angle
of `meanLean`, sampled over time, shows the direction wandering. On meadow it
went from 325° round to 60° over forty seconds, with 1–7 gusts in play.

Andrei's `white` scene measures `nearLessMean` at only 0.35–0.77. That is its
damping of 0.02: its columns ring on at their own rates (`variety` 0.1) long
after the wind that set them going. It is his scene, so it is kept as he
found it.

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
