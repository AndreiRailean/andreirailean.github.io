---
slug: dangler
title: Dangler
summary: Strings of lights hanging from something unseen overhead, looked at from directly below.
started: 2026-08-24
updated: 2026-08-24
tags:
  - canvas
  - generative
  - simulation
---

Lie on your back under a tree somebody has strung with lights. You cannot see
the tree, or the branch, or the wire — only the bulbs, hanging above you at
different distances, each string curving in its own way.

## The idea

Everything follows from where you are standing, which is underneath. A bulb at
`(x, y, z)` with the camera at the origin lands on screen at `(f·x/z, f·y/z)`,
so as a bulb descends toward you it grows **and** slides outward from the point
directly overhead. One number does both, which is what makes the arrangement
read as depth rather than as things being scaled.

The corollary took a moment to notice and then decided most of the piece: a wire
hanging **dead overhead collapses to a point**. Its bulbs stack on top of one
another and it disappears. So the scatter of the anchors is not decoration, and
neither is the bend in the wire — without both, there is nothing to see.

A wire fixed at one end with a free end is **not** a catenary; a catenary needs
both ends fixed. What hangs here is an elastic rod, and its shape is bending
stiffness fighting gravity. Each one is simulated as a chain of particles with a
constraint holding the curve it remembers being coiled with. How much of that
memory survives being hung up is the **stiffness** control, and it is the first
thing worth reaching for.

The anchors are pinned to an invisible uneven surface — the **canopy**. That
matters more than it sounds. Scattering their heights independently is wrong in
a way you cannot see at three wires and cannot miss at thirty: they stop reading
as one object and start reading as a random spray. Pinned to a surface,
neighbouring wires hang from similar heights, because that is what being
attached to the same thing means.

Bulbs sit on the sides of the wire rather than on its centreline, alternating as
they descend, and each one is dimmed by **how squarely it faces you**. An LED
throws its light along its own axis. That single dot product is why a real
string of lights shimmers as you walk under it, and it is most of what stops a
wire reading as a row of identical dots.

## Playing with it

Move the mouse and a small bar appears; the pointer and the controls disappear
together after a couple of seconds of stillness, like video chrome. Keys `1`,
`2` and `3` load presets, `r` rolls a fresh arrangement, `c` opens the panel,
`Escape` closes it, and `f` goes fullscreen. Every control has a tooltip, and
the whole scene — the seed included — lives in the address bar, so anything
worth keeping can be copied or shared.

The controls worth reaching for first: **height** and **length** together decide
the composition, and it is the ratio of the two that matters rather than either
alone — a short wire under a high ceiling barely fans out at all. **stiffness**
decides whether a wire holds its curl or hangs plumb, and a plumb wire is
invisible from below. **colour spread** runs from a string of nominally
identical bulbs that measurably are not, up to a proper festive scatter.

It opens dead still, and there are three different ways to disturb it.
**breeze** is a steady wind. **gust** is bursts arriving on top of it — set the
breeze to nothing, the gust high and the rate low, and you get long calms broken
by a single shove that throws the whole canopy at once and then lets it settle.
**tremble** is not wind at all: it shakes the wires by their anchors, as though
the branch above were shivering.

All three exist because of an accident. Nudging the canopy's **spread** while
watching turned out to be more interesting than the setting is — it shifts every
anchor a few millimetres, and since the wires below do not move with them, all of
them are tugged at the same instant.

Reproducing that as wind failed, and the failure was the useful half. A force
_integrates_: a wire under one keeps accelerating, so a gust of any strength
eventually sweeps a crowd apart. Moving an anchor instead drags its wire by
roughly the anchor's own travel and no further, because the anchor still holds
it. Measured on a short wire, seven millimetres of anchor step settles at
twenty-six millimetres of tip travel, where a steady gust was still climbing
through nine hundred. That bound is not a limitation, it is the whole effect: a
crowd stays a crowd and comes alive, rather than blowing outward.

Which is why there are two controls rather than one. The tremble also has to run
well clear of a hanging wire's own swing period, or the anchor stops shaking the
wire and starts _pumping_ it — the first rates tried turned twenty-five
millimetres of anchor travel into nearly half a metre of swing, which is the one
thing it was meant not to do.

While it is on screen it holds the display awake, the way a video does, since
the point is to leave it running. Browsers only allow that on a secure
connection, so opening the page over plain http from another machine gets the
lights but not the wake lock.

## What went wrong, and what it taught

Almost none of this was visible on screen. A wrong wire and a right one both
look like a scatter of dots, so nearly every problem below was found by
measuring something rather than by looking at it.

- **A rigid wire hung as limp as a chain.** Bending was measured as the distance
  across two links, which at any usable resolution departs from straight by
  about a hundredth of a percent — a second-order quantity, smaller than the
  solver's own error, so the constraint was pure noise. The perpendicular
  standoff from the chord is first-order in the same angle, some hundreds of
  times larger.
- **Then it hung plumb anyway.** Constraining how far a joint bends leaves it
  free to choose a side, and gravity duly picks alternating ones: the wire
  zigzags imperceptibly and comes out dead vertical, which lowers its centre of
  mass far more than an arc would. Holding a shape means holding _which way_ it
  bends, not only how much.
- **Shorter steps beat more iterations, about four to one.** A positional solver
  is only as stiff as the passes it gets, so a hanging chain reaches a steady
  state where gravity's pull each step balances what the passes remove — letting
  it settle for longer never helps. At the same total cost, 480 steps a second
  with 5 passes left a quarter the stretch of 120 steps with 18.
- **Stiffness as a slider was unusable before it was a physical quantity.** Made
  to scale how _hard_ the bend was enforced, its entire useful range fell
  between 0.85 and 1.0 and everything below hung plumb — and settings strong
  enough to hold more crumpled the wire into 90°-per-joint folds, because a
  constraint far from its target pumps energy in on every pass. It scales the
  curvature the wire is asked to hold instead, which keeps the constraint near
  its target and lets the projection stay exact.
- **The coil had a fold in it.** Building the wire's rest shape meant picking two
  directions perpendicular to it, and any way of choosing those flips somewhere
  on the sphere — so as a wire curled past that point, its bending plane jumped.
  It showed only on finely-segmented, strongly-curled wires, which are exactly
  the ones most likely to cross the boundary. The frame is carried along the wire
  now rather than recomputed at each joint.
- **The piece vanished whenever the window changed size.** With nothing moving,
  the animation loop parks itself — but resizing a canvas clears it, and a parked
  loop never drew again. Anything that changes the picture without moving a
  particle now asks for one more frame.
- **A screenshot could not tell a settled wire from a falling one.** Stills taken
  while the scene was still relaxing showed shapes it never actually holds, and
  nothing in the image said so. The scene reports how far its links are from
  their rest length, which is the only way to know from outside.

## How it is built

Plain canvas 2D, no libraries. Every particle in the scene lives in one set of
flat arrays; at three wires that is a wash, and at a hundred it is the difference
between a number changing and a rewrite. Bulbs are pre-rendered sprites cached by
colour and composited additively — which is not only how light behaves but is
order-independent, so no part of this ever sorts anything by depth.

Anchors are drawn from a sequence indexed by position rather than by draw order,
so wire seven is the same wire whether the scene holds eight or eighty. Raising
the count adds wires beside the ones already there instead of rearranging what
you were looking at.

Reduced-motion preferences get a still frame and no animation loop — which needs
no special path, since with the breeze and the flicker at zero the loop parks
itself anyway.
