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
has to come back — and somewhere between the jets and the edge those two cancel
exactly. **That radius is a standing ring**: foam carried outward arrives there
and can go no further, foam beyond it is brought back to it. It is the thing a
real jacuzzi always has and nobody draws.

Nothing places it. It falls out of the arithmetic — far enough out the jets read
as one source, and the balance is where their push equals the return — so
turning `return` up pulls the ring in and turning it down pushes it out. Checked
against where the foam actually collects, over a range of `return`, and the two
agree inside one per cent. With churn and waver at zero it comes out as a drawn
circle; with a little of either it grows lobes and wanders.

The catch is that a ring is easy to have and easy to miss: at a close framing it
sits outside the picture entirely. `experiment.stats().ring` gives its radius in
millimetres, which is how you know what to set `frame` to.

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

### Nothing large survives over a jet

A boil is the most violently worked water in the tub, and violently worked water
takes bubbles apart. Past a size that depends on how hard the water is being
worked, a film cannot hold its own shape and tears in two — which is not the
same as bursting, since the gas stays and is simply carried by more bubbles.
That is the Kolmogorov–Hinze scale, and it is why a big pocket of air rising
through a jacuzzi never arrives as one bubble.

**One mechanism, and it settles three separate things.** Nothing large survives
in a boil. Large bubbles therefore assemble out in the calm instead, which is
where a real tub has them. And there is a natural ceiling on birth size without
anybody writing one down. Worked water also refuses to let bubbles _join_ — two
films need a moment of quiet to drain and rupture between them, and a boil does
not give them one — so the place bubbles are torn apart fastest is not also the
place they are joined fastest.

Without it, the biggest bubbles necessarily formed where the foam was densest,
which is directly over a jet: density is what drives coalescence, so no amount
of moving the births could have fixed it. Something had to take them apart
again.

### Why foam exists at all

A bubble that touches another and immediately becomes one with it cannot make
foam. There would be nothing to accumulate — just a size that keeps climbing.
Foam exists because **the film between two neighbours holds**, often for a very
long time, and they sit as separate bubbles packed against each other.

So `coalesce` is a rate: film failures per second of contact. Near the top a
pair joins the instant it touches. Down at one event every few seconds a raft
forms and the surface packs. It is the single control that decides whether you
are looking at foam or at a few large circles, and for a long time this piece
only had the second one — a touching pair was becoming one bubble inside a
frame, three thousand times a second.

And a film giving way does not always join two bubbles. It can take the outer
wall with it, and then one of them is simply gone. `rupture` is the share of
failures that go that way, weighted toward the larger of the pair since it is
holding up more film. It is why a crowd of neighbours does not inevitably
coarsen into one enormous bubble.

### Foam sticks together

Bubbles here could originally do two things to each other: become one, or push
apart. **Nothing made them stick**, and that is not a small omission — real foam
is bound by shared walls, so a raft of it travels as a unit and neighbours keep
their places in it. Without that, a crowd is a set of independent tracers that
happen to be near each other, sliding freely through the overlap.

`cling` is the binding. It pulls a touching pair toward a common velocity, and
it draws two bubbles together when they are close but not yet touching — the
same surface effect that makes cereal clump in a bowl, and a real one: two
bubbles on a water surface deform the meniscus between them and are drawn in.

`bounce` is the other half, and the two work together rather than against each
other: `cling` keeps neighbours together, `bounce` keeps them out of each other.
Near 1 they rest against each other the way bubbles on a surface do. Turn it
down and they pass through one another — which a solid disc hides, since the
union of two white discs is one white blob, and an outline does not. That is why
this was invisible until the piece could be drawn as rings.

### Two ways to die, and they are not the same way

Past `pop at`, a bubble's chance of bursting climbs with the square of how far
over it is. So one that keeps feeding goes quickly and one that stops just over
the line can last a while. A hard size limit would make every large bubble the
same size, which is the tell that a number rather than a process is in charge. A
burst throws out a ring of droplets, because a film letting go is what a film
actually does; the flow takes them straight back into whatever is nearby.

The other way is simply time. A film holds for a while and then gives out, and
**how long it holds depends on how wide it is** — a big film drains faster than
a small one, so a speck can sit in a quiet corner for minutes while a large
bubble is on its way out from the moment it becomes large. A bubble that grows
by swallowing others brings their wear along with it.

That is a _lifetime_, not a rate of thinning, and the distinction is the whole
of it: a flat rate of thinning means a big bubble simply has more to lose, so it
outlasts the small ones it is supposed to outlive. The piece had it that way
round at first and it was wrong in exactly that way.

## What you can do with it

The panel is in four parts. **jets** is what is happening on the bottom — how
many, where, how deep, how hard, and how far their gas fans out on the way up.
**water** is the surface they feed and how it carries things. **foam** is what
happens when bubbles meet each other — whether they stick, join or shove — how
big they can get, and how long they last. **picture** is
where you are standing, how fast you are watching, and how much the piece is
allowed to spend.

A few places worth going:

- **`depth`, first.** It is the difference between a hotel spa and a lake, and
  `deep water` and `shallow` are the same scene at two metres and at fifteen
  centimetres, so you can see what it does without hunting for it.
- **`speed`** slows the whole thing down without changing anything about the
  water. Depth is the honest way to calm the surface; this is the camera. Both
  are worth having and they do not do the same thing.
- **`torn by` to zero.** Nothing is broken up any more, and the big bubbles
  march straight back into the middle of every boil — which is where they were
  before the mechanism existed, and the fastest way to see what it is for.
- **`pop rate` to zero with `lasts` right up.** Nothing bursts and nothing times
  out, so coalescence runs away: within half a minute the tub is a handful of
  enormous circles. It is the quickest way to see that growth really is nothing
  but merging.
- **`coalesce` to zero** is the other end: nothing ever grows, and the piece
  becomes a pure read-out of the flow with a few thousand tracers in it.
- **`coalesce` down, for foam.** It is the answer to "how do I make it
  accumulate": bring it under about one event a second and touching bubbles stay
  neighbours instead of joining, so the surface packs. Take it up to the top and
  the same scene dissolves into a handful of large circles. `foam` is the scene at the
  packed end.
- **`rupture` to zero.** Every contact that resolves becomes a merge, so the
  foam can only ever coarsen. Up near 1 and a crowd keeps destroying itself.
- **`cling` to zero, drawn as rings.** The foam comes apart into separate
  circles that slide through each other, which is what it did before the
  binding existed. It is the fastest way to see what holding a raft together
  actually buys.
- **`fragile` up.** Big bubbles stop lingering and the picture becomes a
  population turning over rather than an accumulation. At 0 every bubble gets
  the same film life whatever its size, so the small ones still outlast the big
  ones — they just have less to lose.
- **`holds at` right up, with `torn by` down.** Soapy water: films hold a much
  bigger bubble together, so the calm fills with large circles. `slick` and `meniscus` are both that.
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
- **`drawn as` rings, with `wall` down at 1px.** A hairline outline is much
  closer to what foam on real water looks like from above — a bright meniscus
  with the water showing through. The wall is the same width for every bubble
  whatever its size, which is what a real bubble looks like; measuring it as a
  fraction of the radius made small bubbles look thick-walled. `mixed` draws a
  ring only once it is big enough to hold one and a dot while it is not, which
  is what an eye does.
- **`wake`** leaves the last frame behind, so what you see is where the foam has
  been rather than where it is. The flow becomes legible as streaks, which is
  cheating, and is instructive for exactly that reason.
- **`x`** sweeps the surface clean so you can watch it fill. **`r`** rerolls the
  jets and the eddies.

The address bar always describes what is on screen, so water worth keeping is a
link worth copying.
