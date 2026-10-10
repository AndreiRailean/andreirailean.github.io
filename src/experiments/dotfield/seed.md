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

## 2026-10-10 — first round

> I realised that "offset" is the same as "triangle". or at least the look
> exactly the same. offset falls out of the control container box. [Image #1]
> all the wind appears to be comeing from the same direction. in dangler, the
> direction was coming from different directions and it appeared more varied.
> i can see the wave dynamic from flotsam with wave patterns coming through. i
> expect it to be less cyclical here. wind doesn't come from the same direction
> all the time and gusts also not "more wind" from the same direction.
> i'm looking at this. thin dots and rigid stalks in white at this spacing looks
> good to me.
> http://100.117.55.104:4624/experiments/dotfield/?s=____cCsABRVkwYpQyeAghoCIAKhNokkKAZAAAUAA
> increasing height appears to make the springing action appear random. with
> this setting it's hard to tell that the stalks are together at all - some
> bend a lot, others appear to not bend at all.
> http://100.117.55.104:4624/experiments/dotfield/?s=____cCsABFVkwYpQyeAghoCIAKhNokkKAZAAAVKA

## 2026-10-10 — second round

> i see that at certain height, stalks become segmented and sway like in
> dangler. i like that but I'm also interested in seeing tall stalks that don't
> curl but just bend at the springy base, like ski markers in slalom

## 2026-10-10 — third round

> meadow:
> http://100.117.55.104:4624/experiments/dotfield/?s=vov___9wLjQmSXxGDcXKlh4qgUjIwAAEAAKsiEZNcDwhNVCRGAAG
> white:
> http://100.117.55.104:4624/experiments/dotfield/?s=vov___9wOgBcqyaCCIAKhNokkKAZAAAUAAJQOYZPANBaFGRRaApi
>
> add all presets to showcase. open PR and merge when green

## Questions I could not answer, and what I assumed

- **Which lattice is "hex" and which is "triangle"?** A field of dots on a
  triangular lattice is also what most people call hex packing. I made
  `triangle` the triangular lattice (six equidistant neighbours) and `hex` the
  honeycomb (dots on the corners of hexagons, three neighbours, an empty
  centre in each cell). `diamond` is the square turned 45°. Swap the labels if
  they read the wrong way round. ~~`offset`~~ Answered 2026-10-10: it looked
  the same as triangle, so it became `rows`, a crop at twice the spacing.
- **What colour is the top of a column?** The seed puts colour on the sides, so
  an upright field would be nothing but tops. I gave the tops the stalk's
  colour lifted toward white by a `cap` setting — 0 is the stalk colour, 1 is
  white — so either reading can be dragged to.
- **How the view is projected.** Straight down and orthographic to begin with:
  an upright column is exactly a dot, and a bent one shows its side as a curve
  from its root to its top. The sides darken toward the ground. `perspective`
  brings a camera down over the middle; it is 0 on every preset except
  `wildflowers`.
- **Height variation was in the seed as "later".** It is a `heights` control at
  0 on every preset except `wildflowers`, so it costs nothing until it is
  dragged. A taller column sways slower, as a real stem does — a quarter the
  rate at twice the height — so `heights` changes the motion as well as the
  look. ~~Kept as physics~~ Answered 2026-10-10 by "springing action appear
  random": it is now `height sway`, at 0 everywhere except wildflowers
  (0.5), with 2 as the real stem.
- **How much should the wind wander?** `veer` (how far), `veer rate`, `lulls`,
  `gust rate` and `gust spread` (how far a gust strays from the prevailing
  wind, 180 meaning any direction) are all new controls. The presets spread
  them out rather than settling on one answer. Your `white` scene keeps its
  look exactly; its wind is the new one, since the old wind settings no
  longer mean the same thing.
- **Do neighbours touch?** Columns pass through each other. Nothing pushes one
  off another, and at a large height against spacing they overlap. A collision
  between neighbours is the obvious next mechanism if the field should read as
  crowded rather than as layered.
- **The segmented look is the drawing, not the physics.** A side is drawn as
  straight bands, each a shade lighter than the one below, and at a large
  height the joints between them show. That is now the `segments` control (4
  everywhere, as you saw it, and 6 on slalom), and `hinge` chooses between a
  stem that curls and a pole that tips on a springy base. Seen straight down,
  a curl shows only as short dark bands bunched near the root. If slalom
  should read as more three-dimensional, `perspective` is the lever.
