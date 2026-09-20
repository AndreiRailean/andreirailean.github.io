---
slug: bubbles
title: Bubbles
summary: A body of water seen from above, with jets working under it. The surface is black and only the foam is visible, so every reading of the flow comes from how the white circles move.
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

### The field, which is three different kinds of thing

**The jets** are softened point sources at the surface. A source in shallow water
sends the surface outward at a speed that falls away as 1 over the distance,
which is infinite directly over the jet — so it is softened with a mouth radius:
the outflow climbs to a peak exactly at the mouth and falls away like 1/r outside
it. Each jet also twists the water under it, which is what turns the spokes
leaving it into spirals, and neighbouring jets can be set turning against each
other so the water between them shears.

**The churn** is the swirling background the jets sit in, and it is the _curl_ of
a noise field rather than a noise field. That distinction is the single most
load-bearing decision in the piece. Sampling noise directly as a velocity gives
you a field full of sources and sinks, and anything drifting in it drains into
the sinks and never comes out — permanently, because the sinks do not move. The
result reads instantly as particles obeying a texture. A curl has zero divergence
everywhere by construction: it can move water around and can never make or lose
any. Foam then gathers only where something is actually pushing it, which is the
part of the picture that means something.

**The ebb** is the return flow. A tub is closed, so everything the jets push out
has to come back, and where the return balances a jet's push there is a ring the
foam cannot cross. That standing ring is the thing a real jacuzzi always has and
nobody draws.

### Growth has exactly one mechanism

A bubble is born small at a jet and can only get bigger by swallowing another
one. Area is conserved when two merge, so radius grows as the square root: it
takes four bubbles to double one. Nothing grows on its own and nothing grows with
age.

That is worth saying because growing a bubble with its age is much easier and
gives a picture where **size means time**. Here size means history — how much
traffic that bubble has been through — so the big circles are a map of where the
crowding has been, which is not a thing anybody put there.

### Popping is a hazard, not a ceiling

Past a certain radius a bubble's chance of bursting climbs with the square of how
far over it is. So one that keeps feeding goes quickly and one that stops just
over the line can last a while. A hard size limit would make every large bubble
the same size, which is the tell that a number rather than a process is in
charge.

A burst throws out a ring of droplets, because a film letting go is what a film
actually does. They are gas the surface has not finished with: the flow takes
them straight back into whatever is nearby, and some of them are swallowed again
within a second.

### Why the paths are wavy

Each bubble also sidesteps across its own direction of travel, on its own clock
at its own frequency. This is the wave riding under the surface rather than
anything the bubble is doing, and it is why a track radiating from a jet bends
instead of running straight. The frequencies are spread per bubble deliberately —
one shared frequency makes the whole surface breathe together, which is the
clearest possible tell that a field and not a fluid is in charge.

And a bubble answers the water sluggishly in proportion to its size, so a big one
takes longer to turn than a small one. That is what separates the sizes as they
travel: a crowd stops moving as one, and filaments appear in it that nobody drew.

## What you can do with it

The panel is in four parts. **jets** is what is happening under the surface —
how many, where, how hard, and which way each one turns. **water** is the
background they sit in and how it carries things. **foam** is what happens when
bubbles meet each other. **picture** is where you are standing and how much the
piece is allowed to spend.

A few places worth going:

- **`pop rate` to zero, first.** Nothing bursts, coalescence runs away, and
  within half a minute the tub is a handful of enormous circles. It is the
  quickest way to see that growth really is nothing but merging.
- **`coalesce` to zero** is the other end: nothing ever grows, and the piece
  becomes a pure read-out of the flow with a few thousand tracers in it.
- **`churn` up and `push` down.** The jets stop dominating and the background is
  the whole picture — which is the clearest look you can get at a
  divergence-free field, because the foam wanders without ever collecting
  anywhere.
- **`eddies` changes the character more than `churn` does.** Small eddies give a
  fine crawl the bubbles shiver in; large ones give slow gyres that carry whole
  rafts across the tub together.
- **`unsettled` to zero** freezes the background. The swirls stop rearranging and
  become a fixed pattern the foam runs through, which is the only way to actually
  see the field's shape.
- **`return` up, with two or three jets.** The standing ring where the push and
  the return cancel becomes a hard edge, and the foam piles against it.
- **`frame` down to about 30cm.** Close enough that a bubble is a large circle
  and you can watch individual merges happen, which is invisible at any normal
  framing.
- **`spin` to opposed with `twist` up**, and the water between two jets tears
  along a line.
- **`wake`** leaves the last frame behind, so what you see is where the foam has
  been rather than where it is. The flow becomes legible as streaks, which is
  cheating, and is instructive for exactly that reason.
- **`x`** sweeps the surface clean so you can watch it fill. **`r`** rerolls the
  arrangement of jets.

The address bar always describes what is on screen, so water worth keeping is a
link worth copying.
