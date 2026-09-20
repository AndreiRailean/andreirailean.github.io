---
slug: bubbles
title: Bubbles
summary: A body of water seen from above, with jets working on the bottom of it. The surface is black and only the foam is visible, so every reading of the flow comes from how the white circles move.
started: 2026-09-20
updated: 2026-09-20
poster: ./poster.webp
tags:
  - canvas
  - generative
  - physics
---

Water from directly above, with jets working somewhere under it. You cannot see
the water. You can see the bubbles they push up, which are white circles on
black, and that is the whole of what there is to look at.

Everything you can read about the flow — where it is fast, where it turns, where
two currents meet and stop each other — you are reading off the foam.

## The idea

The constraint came first: white circles on black, nothing else. That turns out
to be a demanding thing to build for, because a picture made only of moving dots
is a picture in which **the field has to be worth inferring**. Anything sloppy in
the flow shows up immediately as dots behaving like dots.

So there is no path anywhere in this piece, and nothing has a lifetime with a
curve on it. There is a velocity field, a rule for what happens when two bubbles
touch, and a rule for when one lets go.

### The jets are on the bottom, which is two separate things

This is the idea the whole piece turns on, and it is easy to get wrong — the
first version of this did.

A jet is at the bottom of the water. Its gas rises, fanning out as it climbs,
and **arrives** at the surface across a circle. It arrives with no sideways
momentum of its own: a bubble leaving a nozzle quickly does not then skid across
the surface, it floats up to it. What moves it once it is there is the surface
current, and that is a much gentler thing, because the jet's push has spread
itself over the whole depth on the way up.

So the jet decides _where_ a bubble appears and the water decides _where it then
goes_, and those are different mechanisms with different strengths. Conflating
them is what makes a tub look like a hot tub in a hotel rather than a body of
water.

**`depth` is therefore the control that matters most**, and it works in two
directions at once. Deeper water means the gas fans out further before it
surfaces, so bubbles appear over a wider circle. And it means the jet's push is
diluted before it gets there — a round jet conserves its momentum while
spreading over a cone, so its speed falls in exactly the proportion its width
grows. The attenuation is the ratio of the nozzle's width to the boil's, which
is not a curve anyone drew; it falls out of the momentum being conserved.

Put the jets two metres down and the foam takes about eleven seconds to cross
the frame. Bring them to fifteen centimetres and nothing else changes, and the
surface stops being calm. The first two presets are that pair, and they differ
by that one setting.

### The water itself

**The churn** is the swirling background the jets sit in, and it is the _curl_
of a noise field rather than a noise field. That distinction is load-bearing.
Sampling noise directly as a velocity gives you a field full of sources and
sinks, and anything drifting in it drains into the sinks and never comes out —
permanently, because the sinks do not move. The result reads instantly as
particles obeying a texture. A curl has zero divergence everywhere by
construction: it can move water around and can never make or lose any. Foam then
gathers only where something is actually pushing it.

**The ebb** is the return flow. A tub is closed, so everything the jets push out
has to come back, and where the return balances a jet there is a ring the foam
cannot cross.

And each bubble **wavers** across its own direction of travel, on its own clock
at its own frequency — the wave riding under the surface rather than anything
the bubble is doing. The frequencies are spread per bubble deliberately: one
shared frequency makes the whole surface breathe together, which is the clearest
possible tell that a field and not a fluid is in charge.

A bubble also answers the water sluggishly in proportion to its size, so a big
one takes longer to turn than a small one. That is what separates the sizes as
they travel, and why filaments appear that nobody drew.

### Growth has exactly one mechanism

A bubble is born small and can only get bigger by swallowing another one. Area
is conserved when two merge, so radius grows as the square root: it takes four
bubbles to double one. Nothing grows on its own and nothing grows with age.

That is worth saying because growing a bubble with its age is much easier and
gives a picture where **size means time**. Here size means history — how much
traffic that bubble has been through — so the big circles are a map of where the
crowding has been.

**Which is why the gas is a quantity and not a count.** `gas` is how much surface
a second's worth of bubbles covers, not how many arrive. It was a count at first,
and that quietly broke the only growth path there is: halving the born size
quartered the foam's coverage, encounters became rare, and small bubbles could
never coarsen into big ones — so narrowing the born band made the big ones
disappear rather than making them earned. Measuring gas instead means smaller
bubbles simply means more of them, and the size a scene settles at is decided by
the foam rather than by the emitter.

### Two ways to die, and they are not the same way

Past `pop at`, a bubble's chance of bursting climbs with the square of how far
over it is. So one that keeps feeding goes quickly and one that stops just over
the line can last a while. A hard size limit would make every large bubble the
same size, which is the tell that a number rather than a process is in charge. A
burst throws out a ring of droplets, because a film letting go is what a film
actually does; the flow takes them straight back into whatever is nearby.

But below that line the chance of bursting is exactly zero, so bursting alone
leaves a bubble born large with nothing to do but sit there. **`fragile` is the
other way.** A wide film held up against gravity drains faster than a narrow
one, so the rate a bubble thins at scales with its radius. The consequence is
the useful part: growth now costs something, and the foam settles at a size
where coalescence and drainage balance instead of running away.

## What you can do with it

The panel is in four parts. **jets** is what is happening on the bottom — how
many, where, how deep, how hard, and how far their gas fans out on the way up.
**water** is the surface they feed and how it carries things. **foam** is what
happens when bubbles meet each other, and how long they last. **picture** is
where you are standing, how fast you are watching, and how much the piece is
allowed to spend.

A few places worth going:

- **`depth`, first.** It is the difference between a hotel spa and a lake, and
  presets 1 and 2 are the same scene at two metres and at fifteen centimetres so
  you can see what it does without hunting for it.
- **`speed`** slows the whole thing down without changing anything about the
  water. Depth is the honest way to calm the surface; this is the camera. Both
  are worth having and they do not do the same thing.
- **`pop rate` to zero.** Nothing bursts, and if `fragile` is also down
  coalescence runs away — within half a minute the tub is a handful of enormous
  circles. It is the quickest way to see that growth really is nothing but
  merging.
- **`coalesce` to zero** is the other end: nothing ever grows, and the piece
  becomes a pure read-out of the flow with a few thousand tracers in it.
- **`fragile` up with a wide `born size`.** Big bubbles stop lingering, and the
  picture becomes a population turning over rather than an accumulation.
- **`churn` up and `jet power` down.** The jets stop mattering and the background
  is the whole picture — the clearest look you can get at a divergence-free
  field, because the foam wanders without ever collecting anywhere.
- **`eddies` changes the character more than `churn` does.** Small eddies give a
  fine crawl the bubbles shiver in; large ones give slow gyres that carry whole
  rafts across the tub together.
- **`unsettled` to zero** freezes the background. The swirls stop rearranging and
  become a fixed pattern the foam runs through, which is the only way to see the
  field's shape.
- **`frame` down to about 30cm.** Close enough that a bubble is a large circle
  and you can watch individual merges happen, which is invisible at any normal
  framing.
- **`drawn as` rings, with `wall` down at 0.03.** A hairline outline is much
  closer to what foam on real water looks like from above — a bright meniscus
  with the water showing through. `mixed` draws a ring only once it is big
  enough to read and a dot while it is not, which is what an eye does.
- **`wake`** leaves the last frame behind, so what you see is where the foam has
  been rather than where it is. The flow becomes legible as streaks, which is
  cheating, and is instructive for exactly that reason.
- **`x`** sweeps the surface clean so you can watch it fill. **`r`** rerolls the
  jets and the eddies.

The address bar always describes what is on screen, so water worth keeping is a
link worth copying.
