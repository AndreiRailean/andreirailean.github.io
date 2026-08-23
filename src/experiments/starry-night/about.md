---
slug: starry-night
title: Starry Night
summary: Layers of dots fading in and out on their own clocks, with a few flaring, over ground that never sits quite still.
started: 2026-08-22
updated: 2026-08-23
tags:
  - canvas
  - generative
---

A dark field. Dots appear, hold, and go. Nothing about it repeats, and nothing
about it arrives anywhere. It is meant to be left running in a corner of a
screen rather than looked at directly.

## The idea

The whole thing is one mechanism repeated. A **layer** is a population of dots at
fixed positions with a lifespan and a brightness envelope: it fades in from
nothing, reaches full strength, fades back out, and is then thrown away and
replaced by a fresh one with new positions. Run a dozen of those at once, each on
its own clock, and the sky appears to breathe without any single event being
legible.

That last part turned out to be the point. Early versions used three layers,
where you could watch a layer arrive and leave — which read as three things
taking turns rather than as a sky. The fix was more layers, each thinner: at
fourteen the machinery disappears and only the result is left.

A second, independent mechanism sits on top. A **glimmer** is one star briefly
flaring — a fast attack over about eighty milliseconds, then an eased decay.
Glimmers have nothing to do with the layer cycle; they run on their own
sub-second timescale, which is what makes them read as an event rather than as
part of the rhythm.

Underneath everything is a third: soft **mottling** that keeps the ground from
being one flat colour, fading in and out on the same kind of clock the stars use,
only slower.

## Playing with it

Move the mouse and a small bar appears; the pointer and the controls disappear
together after a couple of seconds of stillness, like video chrome. Keys `1`, `2`
and `3` load presets, `c` opens the panel, `Escape` closes it. Every control has
a tooltip, and every setting lives in the address bar — so any state worth
keeping can be copied, shared, or handed back to be saved as a preset.

The controls worth reaching for first: **layers** decides whether you perceive the
mechanism or only the effect. **size mix** decides how rare the big stars are — at
1 every size is equally likely, and turning it down makes each larger size
scarcer than the one below it. **hue** is the only colour in the piece;
everything else is neutral.

## What went wrong, and what it taught

Most of the interesting decisions came from something looking wrong first.

- **It kept going blank.** With three layers and a pure fade-in-fade-out curve,
  each spends a good part of its life near invisible, and three independent
  clocks land there together more often than intuition suggests — simulating
  three hours of wall clock put the screen at _zero_ brightness several times an
  hour. Fourteen thinner layers fixed it; the dimmest moment now sits around a
  third of the average.
- **The layers were quietly synchronised.** Lifespans were originally derived
  from depth, so adjacent layers drew from overlapping ranges and often landed on
  near-identical values — and two layers whose lifespans nearly match stay locked
  for a long time, their beat period being `L₁L₂ / |L₁ − L₂|`. Fifteen seconds
  against fifteen and a half holds together for about eight minutes. Depth now
  governs appearance only; lifespan is drawn independently.
- **The faintest stars were invisible rather than faint.** A dot under half a
  pixel across cannot reach the opacity you asked for — antialiasing spreads its
  area across several pixels at fractional coverage. Radii now stay above 0.7px,
  which improved things far more than adding stars ever did.
- **Matching dots-per-area left phones looking empty.** A phone is held far
  closer than a monitor, so equal density reads as much sparser. Count now grows
  with area to the power of 0.75.
- **Big circles look machine-drawn.** Past a few pixels, perfect circles became
  obviously synthetic. Large stars now get an irregular outline while small ones
  stay circular, since at two pixels nobody can tell.
- **One conspicuous star gives away every other.** All the dots in a layer fade
  on one envelope, which nobody notices while no single dot stands out. Grow a
  few and it collapses: you watch a big star swell and fade, and having learnt
  the rhythm you can then see it in the small stars beside it. Capping their
  number or spacing them apart only thins the evidence. Past a threshold size a
  star now runs on its own clock, so there is no shared fate left to spot.
- **Soft gradients band.** Alpha climbing to about a fifth over a few hundred
  pixels quantises into concentric contour rings at 8-bit precision, and more
  colour stops cannot help. Jittering the alpha channel breaks the rings into
  grain.
- **A colour scheme is not an inversion.** The light version began as a strict
  mirror of the dark one, which forced every colour to have a counterpart and
  made the mottling read as an odd brown on near-white. Hue became a control
  instead, with the palette holding only saturation and lightness. Treating the
  two as independent themes rather than reflections is the obvious next move.

## How it is built

Plain canvas 2D, no libraries. One path per layer, since every dot in a layer
shares an opacity and a single fill is far cheaper than one per dot. The mottling
is pre-rendered once per layer into a quarter-resolution offscreen buffer,
because several full-viewport radial gradients per frame will not hold 60fps —
fading is then just `globalAlpha` on a `drawImage`. Reduced-motion preferences
get one still frame and no animation loop at all.
