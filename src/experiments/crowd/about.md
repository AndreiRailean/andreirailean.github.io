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

**The head and the body are not the same thing, and a glance comes back.**
Straight ahead is where the head lives; everything else is a departure from it.
Walking, that departure is a few degrees and it returns — you are watching where
you are going. Stopped, it is a real look around, and it still returns. Turning
to _face_ something is a different movement altogether: the body does it, which
is why a stop is where the walk can change direction.

The neck is a spring rather than a motor. It accelerates out of rest and
decelerates into wherever it is going, and never arrives at a dead stop — which
is the whole difference between a head turning and a turret slewing. What gets
looked at is mostly whoever is about to pass closest, who is also the person the
body is already negotiating with, and that is why the looking never feels random.

**I do not look at the horizon.** The resting line of sight when you are walking
is several degrees below level, because the ground you are about to walk on and
the faces of anybody close enough to matter are both below eye height. **my
gaze** is that, and it is also the only control over where the crowd sits in the
frame — with heads and no bodies, every head is within a metre of eye height, so
the picture is a band and this decides where the band is.

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

**How far the crowd extends is its own control.** **reach** decides where people
stop being, and it is deliberately separate from **distance**, which decides how
far you can see. Tying the two together — which is how this piece worked at
first — makes a long view and a dense crowd mutually exclusive, and pays for
depth by washing out everything close to you. Pull reach in and the same density
arrives as a press of people right around you with empty ground behind them; push
it out and the crowd runs past where it can be seen.

There is a ceiling on how many people can exist at once, so a very deep, very
dense crowd is not affordable and the world quietly stops short of what reach
asked for. `experiment.stats().budgeted` says when that has happened, and
`edge` says how bright a head at the boundary still is.

## There can be walls

**corridor** takes the room away. At the top it is open ground and does nothing;
narrow it and everyone is in a street or a passage, nobody can step around
anybody, and the only way past a person is to overtake them or to wait. Pair it
with **stream** at the top and **oncoming** near a half and the two files have
nowhere else to form.

It is worth doing once at about seven metres. A crowd with somewhere to go is a
crowd that mostly ignores you; a crowd with nowhere to go has to deal with you,
and that is a different walk.

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

After that, **my height** is the most underrated control here, and it is a
stature rather than an eye height — 1.75 m is a tall-ish adult, not a giant. At
1.95 m I am looking over the crowd and every head is below the middle of the
frame; at 1.60 m the horizon runs straight through the tall ones' heads; and
somewhere around 1.15 m the picture changes completely, because I have become a
child in it. My eye height, my stride and how far the frame bobs all follow from
that one number.

**Room** is the one that changes what the crowd _is_ rather than how it looks. It
scales how much space everybody insists on and how early they start insisting
together, because those are the same preference. Low is a crowd that tolerates
being close and resolves everything late. High is a crowd that jams at a density
a tighter one walks straight through.

All twenty of them are worth a drag, but those are the four that change what you
are looking at rather than how it looks.

There are six scenes and all of them were found with the sliders. **Market** is
the piece as it was asked for. **Concourse** is one axis with half of it coming at
me — this is where the files form, and it is worth standing in for a minute.
**Standing still** stops the walk and lets the square come past. **The street** is
seven metres wide with two streams in it and no way round anybody. **The far end**
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
