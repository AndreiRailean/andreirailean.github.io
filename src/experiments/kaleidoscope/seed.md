# seed — kaleidoscope

What Andrei asked for, in his words, and each later statement of artistic
direction as it arrives. Verbatim. This file faces inward and records him;
`about.md` faces outward and describes the work.

## 2026-11-17 — the seed

> a new experiment based on a kaleidoscope-like symmetry around the center. in
> its basic forms, it works like a keleidoscope where a segment repeats around
> the center. i can control the number of repeating segments. art in a segment
> is moving. it could be any kinds from other experiments, but i think starting
> with artdeco-like line growth will lead to good result. we want to
> concentrate the moving art withing a segment rather than drawing the whole
> screen, then cutting out a segment and having it repeat as that would cause
> off-screen renders that take up compute but result in no output.
>
> i also want to experiment with a pattern that isn't an obvious tiling of
> segments and evolves to look as a more elaborate repetition. say if we have
> lines growing and splitting like they do in artdeco, the line would have a
> life of its own until it intersects either with itself or its mirrored self.
>
> we can start with the usual white lines on black background and then
> progress to different line thicknesses and vibrant colours

## 2026-11-17 — constant change, a banded flower

> this is a good start, but it's too much of an artdeco clone that grows and
> becomes static in the middle (mostly). real kaleidoscope has change
> everywhere. if we were to apply this here, the lines would not just branch
> out from the first one and move in the same general outward direction. i'm
> looking for constant change. i haven't played with adjustment controls, but
> after looking at each preset i see the same growth pattern. i want to, as
> one example, see a pattern where lines grow basically in parallel from the
> sides of the segment to produce a "banded flower" type arrangement and each
> line has a life of its own and doesn't wait for the whole thing to be wiped
> before it restarts

## 2026-11-18 — a range of widths, short holds

> i'm looking at it and wishing some lines could be thicker. i think we're too
> restricted by single line width. it should be a range. also hold parameter's
> useful range to me is at the very low end. giving it a long hold just makes
> for static spinning pattern.

## 2026-11-18 — square ends, flush meetings

> i don't think lines should have rounded corners. when thick, it looks out of
> place with this lineaar style if caps are rounded
> also if a line terminates at another line it should either go under that
> line or touch in a way that leaves no gaps and no overlaps. so if 90 degree
> and 60 degree lines meet, currently they would touch at one point and the
> rest of the thickness of the second (moving) will have a hanging other
> corner rather than fusing into the first line

## 2026-11-18 — growing inward

> i'm curious why lines always grow outward. i have never seen a line start
> from the side of the segment and grow in towards the center. this tendency
> makes edges a lot busier than the center. some lines to start turning back
> if turns and splits are enabled, but with the config that I have on screen,
> everything always radiates outward

## 2026-11-19 — arcs, organic turns

> what does it take to have lines that go on ann arc rather than straight. i'd
> like to see some more organic turns rather than only angular. whether the
> line goes straight and then does a smooth turn or if it follows a curved path
> until (if) it decides to change the curve - that would be something to have a
> look at

## Open questions

Questions the build could not answer by itself. Each is left as a setting or
a preset rather than decided.

- **What one "segment" is under mirror.** Here a segment is mirror-symmetric
  about its own middle, so `segments: 8` is eight petals and sixteen mirrored
  halves, and every count works. The other reading — segments as the
  alternating mirrored wedges of a two-mirror kaleidoscope — only closes for
  even counts; odd ones leave one seam.
- **The spine always carries on.** A line lying on a mirror never ends at a
  split or a turn, because ending it emptied two drawings in three. That makes
  every mirror drawing have a visible spine down each segment's middle; a
  setting could let it end.
- **Under mirror, "free" looks like "in segment"** unless lines stop only at
  themselves or at nothing: a line at a segment's edge meets its own
  reflection there. A third meeting, rebounding off a line as artdeco does,
  would let free mirror lines carry on past the edge; not built.
- **What renews.** Each root's family now lives and dies on its own. A
  finer grain — each line undrawing on its own age, rather than its family's
  — would change more continuously but break up the bands; not built.
- **Bands across the middle under mirror.** Roots from the sides meet their
  reflections at the segment's middle, so a band is always a chevron. A band
  that crossed the middle would need `stops: own` or `none`.
- **Other art in the segment.** Only artdeco-like line growth is built. The
  segment-then-copies drawing works for anything stored as strokes; a raster
  piece would need the segment rendered to its own small canvas and stamped
  round the centre.
- **What a width belongs to.** Each line draws its own width from the range,
  so a band's chevron can be bold on one stretch and fine on the next. A
  width per root, all of its offshoots alike, would make whole bands bold and
  pair with colouring by root; not built.
