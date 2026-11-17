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
- **What happens after a drawing.** It holds, undraws in the order it grew,
  and a new one grows from the centre. The new one could instead start while
  the old one is still undrawing, or grow into what the last one left.
- **Other art in the segment.** Only artdeco-like line growth is built. The
  segment-then-copies drawing works for anything stored as strokes; a raster
  piece would need the segment rendered to its own small canvas and stamped
  round the centre.
