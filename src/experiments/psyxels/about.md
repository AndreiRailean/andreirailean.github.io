---
slug: psyxels
title: Psyxels
summary: A still picture packed out of pixels of every size, each one a small animation with a mind of its own.
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
pixels while you are looking at it.

## The idea

An ordinary pixellated image is a grid: same size everywhere, one colour each,
still. Take away all three of those and see what is left.

**Same size everywhere** goes first. A pixel here can be three screen pixels
across or two hundred, and the sizes are mixed through the picture — a fat one in
the middle of a stroke with a shoal of fine ones packed around it.

**One colour each** goes next. A pixel is not a colour, it is a small animation:
a frame from a finite vocabulary of signs, held for a while, then swapped for
another. Which one comes next is the pixel's own business.

**Still** goes last, and takes the packing with it. Pixels do not have to occupy
their space forever. Sizes are reconsidered, squares split and merge, and the
picture is repacked out of a different set of pixels than the one it started
with.

What survives all that is the subject. It has to: a field that no longer reads as
an A is just a field.

## Packing is a subdivision, not a puzzle

The obvious reading of "squares of different sizes, packed with no gaps" is a
bin-packing problem — place a big one, place a smaller one, fill in around them.
It is the wrong reading twice over. It leaves slivers no square fits, and it has
no cheap answer to "this pixel should be smaller now" except repacking
everything around it.

So the field is a **quadtree**. A square is either one pixel or four, and each of
those four is either one pixel or four, recursively. The cover is exact by
construction — no gaps and no overlaps to get wrong — and a size change is one
local event that disturbs nothing outside its own square.

Whether a square divides is decided by two separate things, and keeping them
separate is what makes the piece legible.

**Detail forces a split.** A square straddling the edge of the letter has a high
variance of coverage, so it quarters, and its children quarter again if they are
still straddling. Contours therefore get small pixels and flat interiors keep
large ones — the letterform survives at any coarseness, without anything in the
packing knowing what a letter is.

**Variety splits for no reason at all.** Detail on its own gives the tidy,
fine-at-the-edges look of a compression artefact. A square that had no need to
divide and does anyway is what makes the field read as populated rather than
computed.

Both questions are asked of every square on its own clock, which is what the
churn control sets. A square that is genuinely undecided changes its mind
sometimes; a square with no reason to divide and no whim about it is stable
however often it is asked. Turn the variety off and the churn does nothing, which
is correct and worth knowing.

## A pixel is a small animation

The vocabulary is nine frames, and the first four are the ones the piece was
described from: minus, plus, circled minus, circled plus. After those come a bare
ring, a dot, a cross, a circled cross, and a single upright bar.

They are not nine pictures. Each is a set of features — a horizontal stroke, a
vertical one, a diagonal pair, a ring, a fill — and the distance between two
frames is how many features differ. A pixel picks its next frame with a strong
preference for a near neighbour, so it grows a stroke, then acquires a ring, then
loses the stroke. That is what makes a pixel read as one thing changing its mind
rather than a slot being refilled with something unrelated. It never repeats its
current frame: a change that changes nothing is a pause, and pauses are what the
hold time is for.

Describing frames by their features pays a second time, and it is why the marks
are not a set of pictures. **A change of frame is a change of features, so it can
be played rather than cut.** A stroke grows out of the middle. A ring draws
itself round like a pen stroke, starting wherever that pixel happens to start,
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

Nothing in the field runs on a shared clock. Each pixel has its own rate, its own
phase and its own depth of breath, all drawn from its position and the seed — so
some pixels are quick and restless and others sit and think, and the field
shimmers rather than blinking.

## Colour spread, and what it is arguing with

The subject has colours of its own. A white letter is white; a photograph is a
face. **Wildness** is the argument between that and the pixels' own opinions: at
zero they wear the subject's colour and the picture is honest, at one they have
replaced it entirely and the subject survives as a shape. **Colour spread** says
how far one pixel may wander from another, from a tinted monochrome to the whole
wheel present at once in one letter.

Between them they cover the range the piece was after: the same A, sober and
white, or hallucinating, without a pixel moving.

## The two halves never touch

Everything above divides cleanly in two, and the division is enforced rather than
observed.

The **packing** — subject, coarseness, levels, detail, variety — is a still
question asked of a still picture. It decides where the pixels are and how big.

The **life** — colour, breathing, frames, rates, weight, the thresholds — is
read live, every frame, and can move nothing.

So a scene can be wound from sober to acid, from held to frantic, with the letter
underneath standing exactly still. It is the difference between a piece you can
explore and one that reshuffles itself under your hand every time you touch a
slider.

## What keeps it a letter

The frontier of the piece is how far a pixel may sit outside the subject before
the subject stops being one. Two controls run it: **threshold**, how much of a
square has to be inside the letter before it appears at all, and **detail**, how
hard an edge insists on fine pixels.

There is a number for it. The field's coverage is compared against the subject it
was read from, as intersection over union, and it is in `stats()` as `match`.
Perfect is unreachable — a square is a square and a letter is not — and the
interesting thing is that it does not simply fall as the threshold rises. Wide
open, the letter wears a fringe of squares that are mostly empty and comes out
fatter than it was drawn. Nearly shut, its edges are eaten back and thin strokes
break. The best match is in the middle, and the presets sit near it.

## The portrait

The second subject is a photograph, and it goes through the same machinery
untouched: read as coverage, subdivided by variance, packed. Nothing in the
piece knows which subject it has.

Two things had to be true for that to work. Black is _no subject_ rather than a
dark subject, so a face emerges from an unlit ground rather than a rectangle of
pixels being laid over the frame. And the subject's own white point is measured
and stretched, because a photograph's brightest tone is a lit forehead well short
of white, and the same controls that suit a letter otherwise leave a whole
picture in the bottom third of the scale.

The tonality is then a curve rather than a cut, which is the one place the two
subjects genuinely disagree. A letter wants its surviving pixels at full
strength, flat and hard-edged. A face wants them shaded, because the shading is
the picture. **Flatten** is the dial between those, and the presets sit at
opposite ends of it.

## Built from

Canvas 2D, no libraries. Summed-area tables for coverage, so a square of any size
is answered in four lookups and a hundred-pixel pixel costs no more than a
three-pixel one. A seeded generator salted with each square's own depth and
position, so a pixel's life is a pure function of where it is — raising the
subdivision adds pixels rather than restirring the ones already on screen.

Every setting is in the address bar, so any field worth keeping is a link.
`window.experiment` drives the whole thing from the console; `experiment.debug(true)`
draws the squares the packing chose, which is the only way to see what you are
actually looking at.
