---
slug: crowd
title: Crowd
summary: A market square at eye level, where every person is a white circle and the only thing you know about them is how high their head is and where it is going.
started: 2026-09-19
updated: 2026-09-19
poster: ./poster.webp
tags:
  - canvas
  - generative
  - simulation
---

Walking through a busy square. Everyone is a circle. The floor, the sky, the
stalls and the bodies are all missing, and what is left is a few thousand white
discs at the heights real heads would be, getting out of each other's way.

## The idea

There is a piece in this section called Walkers which is this same crowd seen
from directly above. It spends a long time on a problem it cannot solve: a
four-year-old's head is seven-eighths of an adult's across, where their height
is barely more than half, so from overhead a crowd of adults and children is
nearly uniform and only the way people move says otherwise.

Come down into the crowd and that problem evaporates. A child's head is sixty
centimetres lower than their parent's, and two circles of almost exactly the same
size at obviously different heights read as a parent and a child instantly, with
nothing drawn but the circles. **The cue the view from above cannot have is the
one this view gets for nothing**, and it is why the piece works at all.

It also brings a problem of its own that the plan view does not have, which is
that there is now somebody here. A camera on a rail through a crowd is not a
walk. Almost everything below is about that.

## Who is carrying the camera

**I am avoided, and I avoid.** The crowd steering round the observer is the
obvious half and it is not enough on its own: a camera that holds its line while
everybody gives way is a bulldozer, the crowd parts, nothing is ever negotiated,
and the walk reads as a vehicle's. So the observer runs the same avoidance
everybody else does, against the same neighbours, and the course is whatever
comes out of it rather than a heading anyone set. The small persistent sidesteps
are the point.

**The head and the body are not the same thing.** The body goes where the
negotiation puts it. The head points where it is looking, and the neck has a
speed limit — about 120° a second — which is most of what makes a glance read as
a glance rather than as a cut. What gets looked at is mostly whoever is about to
pass closest, which is also the person the body is already negotiating with, and
that is why the looking never feels random.

**The frame bobs, and the bob is not decoration.** A walking head rises and falls
about four and a half centimetres, once per step, and sways about four from side
to side, once per stride — two steps, because the weight goes over one foot and
then the other. It is far too small to notice and completely obvious when it is
missing; without it the camera is on rails. Turn **bob** past two to see the
mechanism you were not supposed to see.

The step rate is not a setting. It comes out of leg length and speed, which is
why my stride quickens when I speed up and why the children around me step faster
than the adults they are with without anything in the piece saying so.

**Stopping is a state, not an event.** The control is the share of the walk spent
stopped rather than a rate of stopping, so turning it up makes the stops longer
as well as more frequent. That is what somebody looking at things does; a rate
produces short frequent halts, which read as hesitation.

## Who else is here

**People avoid each other early.** The obvious way to keep circles apart is a
force that grows as they get close, and it looks wrong immediately: everybody
walks straight at everybody else and then flinches. Real pedestrians settle
nearly every encounter before it is close, by reading where the other person is
going to be. So the interaction here is on _time to collision_ rather than
distance. Two people on courses that never meet ignore each other completely
however narrowly they pass; two on converging courses start easing apart while
they are still several metres away.

That one change brings a great deal with it that nobody wrote. Set the **stream**
up and half of it **oncoming**, and the crowd sorts itself into files within a
few metres — nothing in the code knows what a lane is. Walk faster than the
crowd and the space in front of you opens as you reach it. Walk slower and you
spend the whole time being overtaken.

**Groups hold a shape, and give it up under pressure.** Pairs and threes walk
abreast; four and more bend into a shallow arc with the middle lagging, which is
the arrangement in which everyone can see everyone else's face. The formation is
a spring rather than a rule, so a wide group narrows to get through a gap without
anything measuring the gap. From in here a group is legible before you have
counted it: its heads keep their spacing while everything around them changes.

**A group walks at its slowest member's pace**, which is how a family with a
small child in it comes out slow with nothing saying so.

## The distance is doing most of the work

Light is scattered out of the line of sight at a rate proportional to how much of
it is left, so what survives a distance is an exponential of that distance. On a
black ground there is nothing scattered back in, so the whole of atmospheric
perspective here is one multiplication with nothing tuned. It is also why the
crowd has no edge: it thins until there is nothing, which is what makes it read
as carrying on past where it can be seen.

**How far the world extends is derived from that rather than chosen.** It runs
out where a head has faded below half a per cent, which is the point at which a
screen cannot show it — so turning **distance** up genuinely brings more crowd
into being rather than revealing an empty plain.

There is a ceiling on it, and it is honest about itself. Four and a half thousand
people is as many as the frame can carry, so a scene that asks for a long
distance over a dense crowd cannot have all the depth it asked for and the crowd
ends somewhere you can see it end. That is readable rather than hidden:
`experiment.stats().edge` is how bright a head at the boundary still is, and
anything over about two per cent is a scene whose **distance** is long for its
**density**. Fading the last stretch out to disguise it was the obvious fix and
the wrong one — it would make a scene that cannot afford its depth look exactly
like one that can.

## What the sliders are for

The ones under **crowd** decide who is here, **people** decides what they are
like, **me** decides what I am doing, and the rest is the lens and the paint.

The two worth reaching for first are **stream** and **my pace**. Stream runs from
a square, where every heading is as likely as any other and nothing has a grain,
to a corridor where everyone is on the same line as me — and **oncoming** splits
that line into the half walking toward me and the half walking away. My pace,
set against the crowd's **pace** band, decides the whole character of the walk:
below the band I am overtaken constantly, above it I am the one doing the
overtaking.

After that, **my height** is the most underrated control here. At 1.85 m I am
looking over the crowd and the far heads sit below the middle of the frame; at
1.50 m I am looking into it; and somewhere around 1.15 m the picture changes
completely, because I have become a child in it. My stature, my stride and how
far the frame bobs all follow from that one number.

**Room** is the one that changes what the crowd _is_ rather than how it looks. It
scales how much space everybody insists on and how early they start insisting
together, because those are the same preference. Low is a crowd that tolerates
being close and resolves everything late. High is a crowd that jams at a density
a tighter one walks straight through.

There are five scenes and all of them were found with the sliders. **Market** is
the piece as it was asked for. **Concourse** is one axis with half of it coming at
me — this is where the files form, and it is worth standing in for a minute.
**Standing still** stops the walk and lets the square come past. **The far end**
is a thinner crowd seen much further, which is where it stops being people and
becomes texture. **Waist high** is the same square from a child's eyes, where
every adult is a ceiling and the other children are the only faces.

## What it does not do yet

Nobody is going anywhere in particular. People have a heading rather than a
destination, so nothing walks up to a stall, waits, and leaves — the standing
people are standing where they happened to be. There is also nothing to walk
around: the avoidance would already handle it, since an obstacle is a disc that
is not moving, but nothing is placed.

And nobody has a face. A head is a circle and gives away nothing about which way
it is turned, which means the single most legible thing in a real crowd — the
moment somebody looks at you — is missing from a piece that is otherwise entirely
about being looked past.
