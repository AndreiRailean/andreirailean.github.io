# A mark need not be decomposable

**Status:** Accepted — 2026-09-04

## Context

Psyxels' vocabulary was built on a rule: every frame is a subset of five
features — horizontal stroke, vertical stroke, diagonal pair, ring, fill — and
the distance between two frames is how many of them differ. The rule bought two
things at once, and `glyphs.ts` said so in its opening comment.

The first is a **kinship metric**. A psyx picks its next frame with a strong
preference for a near neighbour, so it grows a stroke, then acquires a ring,
then loses the stroke, and reads as one thing changing its mind rather than a
slot being refilled. That is a property of the transition weights and nothing
else.

The second was the **transition itself**. A change of frame was a change of
features, so it could be played rather than cut: a stroke grew out of the
middle, a ring opened from the centre. A frame that could not be decomposed had
no way to arrive.

That second job is gone, and has been for some time.
`20260830-large-units-demand-attention.md`'s sibling reasoning applies here —
interpolating the features is wrong at size. A large plus spends its transition
as a pair of stubs and stops being a sign; a ring has no legible fraction of
itself at all. `paintPsyxel` cross-fades two whole marks instead, the outgoing
one shrinking as it fades and the incoming one growing into place.
`AGENTS.md` records the removal. What nobody noticed is that the _rule_ outlived
the mechanism it existed for: the vocabulary was still refusing marks in order
to protect a transition the piece had stopped performing.

It surfaced when a reviewer asked for a scene running on a different set of
marks — a star, a moon, a flower. None of them is a subset of five features, and
the honest first answer was that the piece could not have them.

## Decision

**The features are a kinship metric and nothing else. A mark may bring its own
geometry, provided it can still say who its neighbours are.**

A glyph gains an optional `paint`. When present it owns the drawing, and the
feature vector becomes a _claim about kinship_ rather than a description of the
shape. A moon is given a ring and an upright because a bare ring is what a
crescent should sit beside; a star is given a plus and the diagonals because
that is what it is, the same four points with the waist pulled in. Neither
vector describes its mark. Both place it.

Two constraints hold the design up, and both are pinned by tests:

- **Every vector must be unique.** The transition weights are
  `KINSHIP ** (distance - 1)`, which at distance zero comes out _larger_ than a
  one-feature step — so two marks sharing a vector would follow each other
  almost to the exclusion of the rest. Nothing in the geometry prevents this
  once a vector is a claim rather than a decomposition, so it is asserted.
- **Drawn marks go last.** `vocabulary` takes frames from the front of the list,
  so appending means every scene written before them names exactly the frames it
  always did.

## Consequences

The vocabulary is open in a way it was not. The bar for a new mark is no longer
"can it be built from strokes and a ring" but "is its silhouette distinct, and
where does it belong in the walk" — which is a judgement rather than a
construction, and needs a specimen sheet to answer rather than an argument.

A drawn mark must answer to `weight` on its own. The decomposed nine get this
free, since weight is stroke width. The moon does not: its bite is an offset,
and held at a fixed fraction of the radius the ink closes the gap from both
sides at once, so a heavy crescent comes out a bean. The offset has to grow with
`lineWidth`. Expect every drawn mark to need one such term, and expect the
specimen sheet at four weights to be what finds it — the failure is invisible in
a field, where a bean among thousands of marks reads as texture.

The whole family still collapses at the top of the `weight` range: at 0.28 a
circled plus is a plain disc and a ring is a dot. That is not new and not the
drawn marks' doing, but it is now a limit on how many marks a scene can
distinguish, and low-saturation scenes are where it shows — with colour off,
silhouette carries the frame.

## Considered options

### Vendor an icon pack as path data — rejected

Phosphor was the pack chosen. Eight icons were vendored (`flower`, `moon`,
`sun`, `star-four`, `plus`, `plus-circle`, `minus`, `minus-circle`), built once
as `Path2D` and painted per psyx.

It works, and it is affordable: **1,487 ms against a 1,309 ms hand-drawn
baseline** for one `run(1)` at ~3,400 marks, +11%. `save`/`restore`, the per-psyx
transform and the flower's 1.5 KB path all cost essentially nothing — every
suspect named before measuring was wrong.

It was rejected on `weight`, not on cost. **Phosphor is outlined fills at every
weight, not strokes** — `thin`, `light`, `regular` and `bold` are all single
paths with the thickness baked into the geometry, at 8, 12, 16 and 24 units of a
256 box. So the piece's `weight` slider cannot scale a stroke. Driving it from
the pack's own five weights and dithering per psyx between neighbouring steps
does produce a field that reads as the weight asked for, but bold is only ≈0.105
in the piece's units against a slider that runs to 0.34: the top two-thirds of
the control all fall through to solid, and a solid silhouette at a fine grain
stops being an icon.

Redrawing the four marks as centrelines returns all of it. Phosphor's icons are
outlines _of_ strokes — a sun is a circle and eight rays that have been
thickened and traced round — so taking the centreline back gives up nothing of
the design and restores the full continuous range.

### Fatten a vendored outline with its own stroke — rejected

The obvious way to make an outlined fill answer to `weight`: `ctx.fill(path)`
then `ctx.stroke(path)` with the difference between the asked-for thickness and
the baked one.

**6,168 ms against the 1,309 ms baseline, 4.7×** — 0.4 fps live where the
hand-drawn painter holds 14.3. Stroking a complex outline is roughly 4.5× filling
it. Removing `save`/`restore` changed nothing (6,273 ms), which is how the cost
was localised. Nothing would make this viable; it is structural in how canvas
rasterises a stroked path with many segments.

### Two vocabularies, switched by a setting — rejected on paper

An `icons` choice control selecting between the nine signs and a second
pictorial set. Dropped once the reviewer's list was read properly: four of the
eight requested marks (`plus`, `plus-circle`, `minus`, `minus-circle`) _are_ the
signs the piece was described from, in another pack's clothing. There was never
a second family — only this one, missing two marks.
