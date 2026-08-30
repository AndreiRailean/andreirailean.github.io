---
slug: psyxels
title: Psyxels
summary: A still picture packed out of psyxels of every size, each one a small animation with a mind of its own.
started: 2026-08-29
updated: 2026-08-30
poster: ./poster.webp
tags:
  - canvas
  - generative
  - typography
---

A letter A, white on black. Look closer and it is not drawn — it is packed, out
of squares of wildly different sizes, and every square is showing a sign: a
minus, a plus, a plus in a circle. Keep watching. The signs change. The colours
change. Every so often a square decides it would rather be four squares, or four
decide they would rather be one, and the letter is rebuilt out of different
parts while you are looking at it.

Those parts want a name, and _pixel_ is taken — everything here is measured in
screen pixels and a psyx is anywhere between three and two hundred of them
across. So: a **psyx**. It owns a square of the picture, it shows one frame of
a small vocabulary at a time, and it has opinions about colour.

## The idea

An ordinary pixellated image is a grid: same size everywhere, one colour each,
still. Take away all three of those and see what is left.

**Same size everywhere** goes first. A psyx can be three screen pixels
across or two hundred, and the sizes are mixed through the picture — a fat one in
the middle of a stroke with a shoal of fine ones packed around it.

**One colour each** goes next. A psyx is not a colour, it is a small animation:
a frame from a finite vocabulary of signs, held for a while, then swapped for
another. Which one comes next is the psyx's own business.

**Still** goes last, and takes the packing with it. Psyxels do not have to occupy
their space forever. Sizes are reconsidered, squares split and merge, and the
picture is repacked out of a different set of psyxels than the one it started
with.

What survives all that is the subject. It has to: a field that no longer reads as
an A is just a field.

## Packing is a subdivision, not a puzzle

The obvious reading of "squares of different sizes, packed with no gaps" is a
bin-packing problem — place a big one, place a smaller one, fill in around them.
It is the wrong reading twice over. It leaves slivers no square fits, and it has
no cheap answer to "this psyx should be smaller now" except repacking
everything around it.

So the field is a **quadtree**. A square is either one psyx or four, and each
of those four is either one psyx or four, recursively. The cover is exact by
construction — no gaps and no overlaps to get wrong — and a size change is one
local event that disturbs nothing outside its own square.

Whether a square divides is decided by two separate things, and keeping them
separate is what makes the piece legible.

**Detail forces a split.** A square straddling the edge of the letter has a high
variance of coverage, so it quarters, and its children quarter again if they are
still straddling. Contours therefore get small psyxels and flat interiors keep
large ones — the letterform survives at any coarseness, without anything in the
packing knowing what a letter is.

**Variety splits for no reason at all.** Detail on its own gives the tidy,
fine-at-the-edges look of a compression artefact. A square that had no need to
divide and does anyway is what makes the field read as populated rather than
computed. It stops short of dividing everything, deliberately: read as a raw
probability it reached certainty, and the control called _variety_ then produced
a field of one size with no variety in it at all. A picture of nothing but fine
psyxels is still reachable — that is what `coarse` and `levels` are for, because
it is a statement about which sizes exist rather than about how mixed they are.

Both questions are asked of every square on its own clock, which is what the
churn control sets — and each level down is asked less often than the one above
it. That correction is not cosmetic. **A psyx is ended by the first of its
ancestors to change its mind**, so a coarse one has the fewest ways to go and was
outlasting the grain around it more than twofold; the coarse marks are the ones
the eye goes to, and they were the only stable thing on screen. A coarse square
coming and going no longer restirs what is under it either — the fine psyxels it
covers are kept and resume, rather than being built again. A square that is genuinely undecided changes its mind
sometimes; a square with no reason to divide and no whim about it is stable
however often it is asked. Turn the variety off and the churn does nothing, which
is correct and worth knowing.

## A psyx is a small animation

The vocabulary is nine frames, and the first four are the ones the piece was
described from: minus, plus, circled minus, circled plus. After those come a bare
ring, a dot, a cross, a circled cross, and a single upright bar.

They are not nine pictures. Each is a set of features — a horizontal stroke, a
vertical one, a diagonal pair, a ring, a fill — and the distance between two
frames is how many features differ. A psyx picks its next frame with a strong
preference for a near neighbour, so it grows a stroke, then acquires a ring, then
loses the stroke. That is what makes a psyx read as one thing changing its mind
rather than a slot being refilled with something unrelated. It never repeats its
current frame: a change that changes nothing is a pause, and pauses are what the
hold time is for.

Describing frames by their features pays a second time, and it is why the marks
are not a set of pictures. **A change of frame is a change of features, so it can
be played rather than cut.** A stroke grows out of the middle. A ring draws
itself round like a pen stroke, starting wherever that psyx happens to start,
so the field never sweeps in unison. A disc closes. And the diagonals are not a
third pair of strokes at all — a cross is a plus rotated by an eighth of a turn,
and saying so in the geometry makes that transition a _rotation_: the mark winds
round without either arm ever losing length. A minus becoming a cross is the same
movement seen from further off, one stroke turning while another grows across it.

The transition is a share of the hold it starts rather than a fixed duration.
The flicker control spans two orders of magnitude, and a quarter-second ease is
languid at one change every two seconds and never finishes at five a second —
the field would sit permanently between frames and the vocabulary would stop
being legible. **morph** is that share, and at 0 the frames snap, which is what
the piece did first and is worth seeing once.

Its colour is drawn again at the same instant and slides across the same
transition, which is the other half of it. Frame and colour moving together make
a change one event; drifting the hue on a clock of its own gives two overlapping
animations and the field loses its beat.

Nothing in the field runs on a shared clock. Each psyx has its own rate, its own
phase and its own depth of breath, all drawn from its position and the seed — so
some psyxels are quick and restless and others sit and think, and the field
shimmers rather than blinking.

Where a psyx's mark sits is its own business too. The packing is a
subdivision, so the squares are a lattice, and a coarse psyx can only ever
appear in a handful of places — which the eye learns within seconds. **wander**
lets the mark sit off the centre of its own square, far enough to cross into its
neighbours. The cover is untouched: every square still answers for its own patch
of the picture, and what is drawn for it is simply not centred.

## The ground around a big one

A mark's ink is a fixed share of its own square — the stroke width follows the
size — so the _same drawing_ reads as tone at seven screen pixels and as a thin
sign surrounded by ground at a hundred. The eye reads that ground as part of the
mark, which is why a large psyx demands attention out of all proportion to the
patch of picture it stands for. Round marks in square boxes make it worse: the
corners are never reached, and a mark that has wandered off its centre leaves the
hole behind it exactly where it was.

Two controls put ink back. **bloom** lays down the same mark again, far wider and
dim, behind itself — filling the hole in the shape of what is in it rather than
as a patch, and weighted by size, so the fine grain is left alone. **spacing**
goes negative: marks spill past their own squares into their neighbours', which
is the only thing that dissolves the lattice the subdivision leaves behind.

This is a piece-shaped instance of something the section keeps finding. Starry
Night grew a control for how rare its big stars are; Flotsam found its sizes had
to follow a power law or the picture came out as white confetti; this piece had
to invert the relationship between a psyx's size and how long it lives. Written
down, with the numbers, in
`docs/adr/20260830-large-units-demand-attention.md`.

## Colour spread, and what it is arguing with

The subject has colours of its own. A white letter is white; a photograph is a
face. **Wildness** is the argument between that and the psyxels' own opinions: at
zero they wear the subject's colour and the picture is honest, at one they have
replaced it entirely and the subject survives as a shape. **Colour spread** says
how far one psyx may wander from another, from a tinted monochrome to the whole
wheel present at once in one letter.

Between them they cover the range the piece was after: the same A, sober and
white, or hallucinating, without a psyx moving.

## The two halves never touch

Everything above divides cleanly in two, and the division is enforced rather than
observed.

The **packing** — subject, coarseness, levels, detail, variety — is a still
question asked of a still picture. It decides where the psyxels are and how big.

The **life** — colour, breathing, frames, rates, weight, the thresholds — is
read live, every frame, and can move nothing.

So a scene can be wound from sober to acid, from held to frantic, with the letter
underneath standing exactly still. It is the difference between a piece you can
explore and one that reshuffles itself under your hand every time you touch a
slider.

## The boundary is a tendency, not a rule

A field clipped exactly to the shape it is standing in for stops looking packed
and starts looking cut out — the artwork ends in a hairline however soft the
marks either side of it are. **fuzz** is what stops that, in two ways at once.

A psyx near the boundary is there _by its own luck_: how far its coverage sits
through a band around the threshold, against a number it drew when it was packed
and keeps for as long as it exists. So the edge becomes a scatter thinning
outward, with psyxels hanging off the artwork entirely, and it shimmers on the
repacking's clock rather than every frame.

And a square straddling an edge may decline to subdivide, which is the only way a
_large_ mark ever ends up outside the subject. That one is not free — a square
that declines is one psyx where there would have been four — so it is kept to a
third of the control, after half of it cost the landing scene a third of its
psyxels and left the letter patchy.

## What keeps it a letter

The frontier of the piece is how far a psyx may sit outside the subject before
the subject stops being one. Two controls run it: **threshold**, how much of a
square has to be inside the letter before it appears at all, and **detail**, how
hard an edge insists on fine psyxels.

There is a number for it. The field's coverage is compared against the subject it
was read from, as intersection over union, and it is in `stats()` as `match`.
Perfect is unreachable — a square is a square and a letter is not — and the
interesting thing is that it does not simply fall as the threshold rises. Wide
open, the letter wears a fringe of squares that are mostly empty and comes out
fatter than it was drawn. Nearly shut, its edges are eaten back and thin strokes
break. The best match is in the middle, and the presets sit near it.

## Which letter, and drawn how

The subject is a letterform or a photograph, and the letterform has a **face**:
grotesque, roman, script, typed. It is asked for as a _kind of shape_ rather than
a named font, so the machine supplies whatever it has of that kind — and what
survives being packed is the character rather than the face: a grotesque gives
even strokes and a hard silhouette, a roman gives thick-and-thin and serifs that
break into separate psyxels, a script gives a stroke that changes width as it
turns. Two machines therefore show different letters, which is the same bargain
the piece already makes with a viewer's monitor.

## The portrait

The second subject is a photograph, and it goes through the same machinery
untouched: read as coverage, subdivided by variance, packed. Nothing in the
piece knows which subject it has.

Two things had to be true for that to work. Black is _no subject_ rather than a
dark subject, so a face emerges from an unlit ground rather than a rectangle of
psyxels being laid over the frame. And the subject's own white point is measured
and stretched, because a photograph's brightest tone is a lit forehead well short
of white, and the same controls that suit a letter otherwise leave a whole
picture in the bottom third of the scale.

The tonality is then a curve rather than a cut, which is the one place the two
subjects genuinely disagree. A letter wants its surviving psyxels at full
strength, flat and hard-edged. A face wants them shaded, because the shading is
the picture. **Flatten** is the dial between those, and the presets sit at
opposite ends of it.

## The same picture in every window

The coarsest psyx is a share of the frame's shorter side rather than a number
of screen pixels. It was the other way round at first, and the piece was then a
different picture in every window: the subject scales with the frame and the
squares did not, so a letter fifty psyxels across on a wide monitor was twenty in
a small one and came apart — its match against the subject fell from 0.94 to 0.82
between 1920 and 1024 pixels. What the artwork is _made of_ is the artistic
quantity here. How many screen pixels that happens to be is not.

## Built from

Canvas 2D, no libraries. Summed-area tables for coverage, so a square of any size
is answered in four lookups and a two-hundred-pixel psyx costs no more than a
three-pixel one. A seeded generator salted with each square's own depth and
position, so a psyx's life is a pure function of where it is — raising the
subdivision adds psyxels rather than restirring the ones already on screen.

Every setting is in the address bar, so any field worth keeping is a link.
`window.experiment` drives the whole thing from the console; `experiment.debug(true)`
draws the squares the packing chose, which is the only way to see what you are
actually looking at.
