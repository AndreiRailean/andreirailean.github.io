# seed — dotfield

What Andrei asked for, in his words, and each round of feedback as it arrives.
Verbatim. This file faces inward and records him; `about.md` faces outward and
describes the work.

## 2026-10-10 — the seed

> we're looking at a grid arrangement of columns from above. it's a geometric
> grid: square, hex, triangle, offset or other familiar patterns. columns, when
> motionless, appear to us as dots (we see the top part). they're all the same
> size (diameter). height of the columns is also the same (we start here, may
> allow for variability later). we can think of these columns as flowers in a
> field. light breeze and gusts make the columns bend, like tall grass would,
> and spring back. it's a hybrid of flotsam and danglers in that we have
> anchored "strings" with waves going through them. the field is in constant
> motion. stalks have this proximal alignment to them where nearby ones point in
> almost the same direction but over the larger distance we see wave patterns
> and swirls. colour probably belongs to the stalks (column sides) and it also
> follows natural distribution gradient so nearby columns looks more alike but
> we can go from purple in one side of the screen to red, blue or any other
> colour elsewhere and could have islands of colour

## Questions I could not answer, and what I assumed

- **Which lattice is "hex" and which is "triangle"?** A field of dots on a
  triangular lattice is also what most people call hex packing. I made
  `triangle` the triangular lattice (six equidistant neighbours) and `hex` the
  honeycomb (dots on the corners of hexagons, three neighbours, an empty
  centre in each cell). `offset` is square rows with every other row shifted
  half a step; `diamond` is the square turned 45°. Swap the labels if they read
  the wrong way round.
- **What colour is the top of a column?** The seed puts colour on the sides, so
  an upright field would be nothing but tops. I gave the tops the stalk's
  colour lifted toward white by a `cap` setting — 0 is the stalk colour, 1 is
  white — so either reading can be dragged to.
- **How the view is projected.** Straight down and orthographic to begin with:
  an upright column is exactly a dot, and a bent one shows its side as a curve
  from its root to its top. The sides darken toward the ground, which is the
  only depth cue so far.
- **Height variation was in the seed as "later".** It is a `heights` control at
  0 on every preset except `wildflowers`, so it costs nothing until it is
  dragged. A taller column sways slower, as a real stem does — a quarter the
  rate at twice the height — so `heights` changes the motion as well as the
  look. If that confounds what you want to judge, `sway` and `variety` are
  separate.
- **Do neighbours touch?** Columns pass through each other. Nothing pushes one
  off another, and at a large height against spacing they overlap. A collision
  between neighbours is the obvious next mechanism if the field should read as
  crowded rather than as layered.
