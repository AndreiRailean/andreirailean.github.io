---
slug: embers
title: Embers
summary: Sparks off an unseen fire, riding a buoyant plume and the vortices it sheds, glowing at whatever colour their temperature says.
started: 2026-09-07
updated: 2026-09-07
tags:
  - canvas
  - generative
  - physics
---

A fire below the bottom edge of the picture, and the only evidence of it is what
comes off it. Embers lift out of the frame's lower edge, climb, wander, and then
either leave through the top, drift out through the side, or lose the argument
with gravity and zig-zag back down into the dark they came from.

Nothing about it repeats, and nothing about it arrives anywhere.

## The idea

The temptation with a scene like this is to write the behaviour down: an ember
rises for a while, slows, wobbles a bit, fades out. That gets you something that
looks approximately right and is impossible to change, because every property of
it is a curve somebody drew and the curves do not know about each other.

So none of it is written down. There are three mechanisms, each of them a real
relationship, and everything you can see is a consequence of them.

### The air

Above a fire is a **buoyant plume**, and a plume is not a cone of upward arrows.
It drags the still air around it inward as it rises, which makes it wider and
slower with height — the width grows in proportion to the height and the speed
falls as the cube root of it, both of which have been known since the 1950s.

That single scaling law does most of the work in this piece. An ember has a
terminal speed: the speed at which its own drag balances its weight. While the
plume is going faster than that, the ember rises. Where the plume has slowed to
less than that, it does not. **So the height an ember climbs to is not a number
anywhere in the piece** — it is where two curves cross, and it crosses somewhere
different for every ember, because they all weigh different amounts.

A fire plume also has structure in it, and the structure is not generic
turbulence. The shear layer at the plume's edge rolls up into **vortices**,
which travel up with the flow, spread, and pair off. And the whole column pulses
at a frequency that depends only on how wide the fire is — about 1.5 over the
square root of the width, in hertz, which is one of the most reliable
measurements in fire science and is the reason a campfire visibly breathes. Both
of those are the same object here: eddies are shed singly at the edges, and in
counter-rotating pairs from the bed. A pair like that induces an upward velocity
on itself and rises as a unit — it is the cross-section of a smoke ring — so a
puff is a thing that travels and carries embers with it rather than a burst of
noise.

Everything in the air is **divergence-free**, which is a technical way of saying
it has no sources or sinks. That is not fastidiousness. A field with divergence
in it accumulates light things wherever it happens to converge, and the piling-up
looks so much like something the fire is doing that you would spend a day
believing it.

### The ember

An ember is one number: how fast it falls in still air. Everything else follows,
because the drag response time is exactly that speed divided by gravity — one
number sets both how quickly it sinks and how sluggishly it answers a gust, and
the two are not separately adjustable, which is correct, since in the world they
are not two things.

The consequence is that the population sorts itself. A tiny ember has a very
short response time and traces the air faithfully, going wherever the eddies go.
A large one lags, overshoots, and gets flung out of a vortex core by its own
inertia. Heavy particles collecting in the spaces _between_ eddies rather than
inside them is a real and much-studied phenomenon, and it is why the column here
has filaments in it that nobody drew.

Being irregular matters too. A tumbling flake's lift reverses every half turn,
which is why a leaf comes down in a zig-zag, and its projected area varies
almost to nothing when it is edge-on — so it flickers as it turns. At the size
an ember actually is on screen, that flicker _is_ its irregular shape: it is
about a pixel across, and what you can see is not its outline but the fact that
it twinkles.

### The light

An ember glows because it is hot, so its colour is the colour of a blackbody at
its temperature. The piece computes that: Planck's law against the CIE colour
matching functions, which gives both the colour and — separately, and more
importantly — how much visible light it is actually emitting.

That second number is why an ember dies convincingly. Total radiated power goes
as the fourth power of temperature, which would be a factor of six or so across
the range here. But at 1000 K almost the entire emission curve is in the
infrared, and it only moves into the visible as the thing gets hotter, so the
part a person can _see_ changes by four orders of magnitude between 1000 K and
1600 K. An ember therefore does not dim smoothly. It holds, it reddens, and then
it is simply gone — and there is no fade curve anywhere in the piece.

An ember is also still burning, which is what holds it hot against radiative and
convective losses. Airflow is oxygen: more air means it burns brighter and spends
itself sooner. That is one line of arithmetic and it buys the whole behaviour of
a gust, which lights the field up and then empties it.

## What you can do with it

The panel is in four parts. **fire** is the thing you cannot see — how wide it
is, how hard it is sputtering, how often it spits a splinter or surges into a
burst. **air** is the plume and its weather. **embers** is what is being carried:
how big, how hot, how fast they consume themselves. **picture** is where you are
standing and how much light you are gathering.

A few places worth going:

- **Turn `swirl` to zero.** The eddies vanish and the embers rise in obedient
  arcs, which is a good way to see how much of the piece is the vortices and how
  much is the plume.
- **`churn` changes the character far more than `swirl` does.** Low values give
  a handful of large slow structures that an ember rides for a long time; high
  values give a crowd of small ones and a flow you cannot read.
- **`frame` down to a metre.** Close enough that an ember is several pixels
  across and you can watch it tumble, which is invisible at any normal framing.
- **`hue`** rotates the entire blackbody curve rather than tinting anything, so
  a blue fire still has white-hot sparks and deep dying cinders and needs no
  re-tuning. **`hue spread`** lets several colours ride the same air at once,
  which is a different piece using this one's physics.
- **`trails`** turns the picture from a set of points into a long exposure, and
  the flow itself becomes visible as the lines the embers leave in it.
- **`b`** makes the fire surge on demand.

The address bar always describes what is on screen, so a fire worth keeping is a
link worth copying.
