---
slug: dangler
title: Dangler
summary: Strings of lights hanging from something unseen overhead, looked at from directly below.
started: 2026-08-24
updated: 2026-08-25
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

They need not be spread evenly across it. **branches** strings them along a few
arms instead, the way lights actually get slung over a tree rather than
distributed by a machine. Each arm starts away from the trunk and has its own
reach, sweep and droop, so a handful of them reads as several separate danglers
rather than one mass — the arms converging on a single point is exactly what
makes an arrangement look like one object, however many arms it has.

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
**sway** and **tremble** are not wind at all — they move the wires by their
anchors rather than blowing on them.

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

Which is why moving the anchors is a control of its own. But _how_ they move
turned out to matter far more than how far.

**tremble** shakes each anchor independently, and it does not work. It reads as
the observer being jostled rather than the scene moving — lights bolted to the
ceiling of a lorry on a bad road, with nothing steady to hold on to. It is
faintly nauseating, and no amount of making it gentler helps, because the
problem is not the amount of movement. It is that the canopy stops being an
object: once every anchor wanders on its own, there is no stable frame left to
read the scene against.

**sway** moves the whole canopy as one body — leaning about the trunk, turning a
little, rising and falling — all of it driven by the wind and all of it
returning to exactly where it started when the air goes still. A tree in wind
moves a great deal while every branch keeps its relationship to every other, and
that is the property being preserved: the lean and the turn are rigid rotations,
so the distance between any two anchors does not change at all. It is
underdamped, so a gust leaves it rocking back past upright a couple of times
before it settles, which is most of what makes it read as something heavy.

The difference is measurable, not only felt. Set forty wires going and ask how
much their tips agree about which way to move: under sway they run at 0.64,
where 1 would be every wire moving as one. Under tremble it is 0.22, and pure
chance for forty wires would be 0.16.

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
- **A wire that span at two hundred metres a second, for ever.** Moving the
  anchors is how several of the nicest effects here work, but an anchor
  _teleports_, and a simulation that infers velocity from the change in position
  cannot tell that from a cannon. Changing the number of branches moves anchors
  by metres, and the wires below did not merely lurch — past about one segment
  length per step there is no resolution left to solve against, so they spun
  indefinitely instead of damping out. Capping how far a particle may travel in
  a single step fixed it, and sits far enough above any wind in the piece that
  nothing else noticed.
- **The bulbs turned on their strings.** Each bulb hangs off a frame carried
  along its wire, and that frame is built to rotate as little as possible _along
  the curve_ — which says nothing whatever about how much it rotates from one
  moment to the next. Rebuilding it every frame let any change of shape
  accumulate down the wire, so the frame at the free end swung even where
  nothing was bent oddly, and the bulbs riding it went round and round. The
  frame is now carried through time as well as along the wire. Every test of it
  had passed throughout: it was perpendicular, it was a unit vector, it never
  flipped between neighbours. None of them asked whether it was the same frame
  as a moment ago.
- **The cure for the spinning froze the whole page.** Wires thrown by a
  relocated anchor were fixed by settling the scene whenever the anchors moved
  far — which meant three seconds of frozen browser on every notch of a slider,
  because a wire thrown that far never converges and the settle ran to its
  limit each time. The sliders are the instrument here; one that stalls under
  the hand is useless however good the scene behind it is. Wires are now simply
  _carried_ to where their anchors went, which costs about a millisecond and
  disturbs nothing, because a hanging wire's shape never depended on where it
  hung from in the first place.
- **A control that did nothing at all, for months.** `flicker` drew each bulb a
  rate and then used it as radians per second where it had been written as
  cycles per second. Every bulb was therefore wavering with a period of between
  eleven and fifty seconds — technically working, utterly invisible, and lost
  under any other movement. Nothing in the code looked wrong and no screenshot
  could show it; it took someone turning the control to maximum, staring at a
  single bulb, and reporting that nothing happened.
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
