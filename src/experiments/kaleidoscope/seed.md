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

## 2026-11-20 — a ground that is only painted over

> this is a great experiment. i like it how it is, but am also wondering if it
> is possible to have colour fill the piece completely. currently we have
> coloured lines on black and those lines disappear. i feel we need a
> background layer that has a life of its own and uses thicker chunks of colour
> that are never removed but are only painted over.

## 2026-11-21 — black back in the ground

> ground does add colour. eventually it leaves no black, so the contrast is
> different.
>
> the one i'm looking at has good contrast, but i wish i could add black to
> it.

## 2026-11-21 — depth from a swept tone, a ground of its own

Said after sweeping ground tone by hand while the ground grew, which left each
chunk a ramp of lightness along its length.

> that gradient appearance gives a lot of depth.
> i think the background layer may need some of its own rules, complications
> and simplifications
> perhaps background doesn't need the decision/splitting logic and it could be
> constructed out of straight lines that just grow and overlap and never
> ungrow, so we don't need to treat each line as an entity, but instead can
> think of the whole layer as one coloured bitmap. we don't have to do it that
> way, i just thought that could simplify things. so the starting kite
> situation would be resolved by starting and ending the line outside of the
> visible segment so it never overhangs.
>
> yes, the sweep would be a good idea, but i wouldn't want to apply it to both
> foreground and background together and at the same rate. Also, i would want
> to make it probabilistic - i.e. whether the sweep kicks in on a particular
> rendered line is not certain and whether it applies to the whole duration of
> the render is not certain. it's an oscillator. and that oscillator can be
> turned on an off in flight by another oscillation.

## 2026-11-21 — lines that move, not only grow

> one think i've been wondering about is a new kind of growth. perhaps done as
> another, middle layer between base and lines. current appearance of lines is
> that they appear. they grow into final star shapes and then stay before they
> draw themselves off. coupled with spin we have a good amount of change but
> it's hard to call it motion. what i'm thinking about is to have lines not
> only grow in lengh but also move. so a root that sits on the side of the
> segment moves along that side and drags its whole tree along.
> centrally-planted root can't really do that. it could sweep the angle across.
> side root could also sweep the angle. while it doesn't have to be another
> layer, i feel that a mixture of "static" current patterns and more dynamic
> (growing, changing) ones could ammp this up. not sure if that pushes the
> boundary too far

## 2026-11-22 — an organic join, on purpose

Said of the older paint that showed through, dithered, where a ground chunk
met its reflection at a mirror; that was fixed as a fault.

> it has a mildly organic feel to it so i didn't mention it before, but i
> think you would want to know and we can add the organic part deliberately
> rather than rely on an unexpected side effect.

## 2026-11-22 — old mirrors

Said once the join was sealed.

> the organic seam looked best when it broke up bigger solid chunks.
> background ends up filling large solid areas and the seam was giving it
> depth. perhaps we can layer something like that on the seams. the fact
> that we're painting over previous pixels gives us something to play with
> here and it is what unlocked the "organic seam". perhaps that 2px outset
> that you built can be turned off sometimes (on an oscillator) to bring back
> the depth. seams looked best in the middle section - central star - it ends
> up being a solid chunk most of the time. with a seam it looks like sea
> star. if we're rebuilding the seam, I wouldn't want it to be universally
> applied to all base paint. it would be a per-root thing. maybe a "old
> mirror" is where the paint goes to the end of the segment but can't quite
> fill it.

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
- **What a moving family meets.** The moving layer's families meet only
  their own lines, because a meeting with anything else would be made where
  that family no longer stands; they pass over each other and over the fixed
  lines. Stopping against what moves, or fixed lines stopping against moving
  ones, would need meetings recomputed every frame; not built.
- **A slide past the centre.** A root on a side slides by up to `slide`
  either way; one planted nearer the centre than that slides through it and
  out of its wedge, and the mirrors cut it away until it comes back. A slide
  that turned back at the centre, or scaled to where the root was planted,
  would keep every tree in view; not built.
- **A moving layer of its own kind.** It grows by the lines' rules on its own
  seed, so it looks like more of the same lines. `movingTone` mutes its
  colours, as the ground's tone does, which is the one difference Andrei
  named; rules of its own (its own angle, width, life) are not built.
- **Old mirrors: which roots, and where.** Built as a share of roots drawn
  by chance, a gap and a wear oscillator. Andrei saw the seam at its best in
  the central star; a share that favoured roots planted at the centre, or a
  thread that frayed by distance from it, would aim it there; not built.
