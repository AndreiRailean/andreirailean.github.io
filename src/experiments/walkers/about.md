---
slug: walkers
title: Walkers
summary: A crowd from directly above, where a person is a head and a shadow, and everything you can tell about them you tell from how they move.
started: 2026-09-03
updated: 2026-09-03
poster: ./poster.webp
tags:
  - canvas
  - generative
  - simulation
---

Looking straight down at a piece of ground. People come in from the sides, cross
it or stop on it, and go. You never see a body — only the top of a head, and the
shadow it belongs to.

## The idea

A dot moving across a screen is a dot. A dot that slows down slightly before it
reaches another dot, steps a foot to one side and then resumes its line is a
person. Almost everything in this piece is an attempt to find which of those
small movements are the load-bearing ones.

It turns out there are about five.

**People avoid each other early.** The obvious way to keep dots apart is a force
that grows as they get close, and it looks wrong immediately: everybody walks
straight at everybody else and then flinches. Real pedestrians resolve nearly
every encounter before it is close, by reading where the other person is going
to be. So the interaction here is on _time to collision_ rather than distance —
two people on courses that never meet ignore each other completely however
narrowly they pass, and two people on converging courses start easing apart
while they are still several metres away.

That one change brings a great deal with it that nobody wrote. Set two streams
of people against each other and they sort themselves into files within a few
metres. A fast walker opens a gap ahead of themselves. A dense crowd slows down
before it jams. None of those are in the code; they are what happens when
avoidance is anticipatory.

**Heads bob, and the bob is not decoration.** A walking head rises and falls
about four and a half centimetres, once per step, and sways about four from side
to side, once per stride — which is two steps, because the weight goes over one
foot and then the other. From directly above the rise reads as the head very
slightly growing, and the sway reads as a weave. Both are far too small to
notice and completely obvious when they are not there.

The step rate is not a setting. It comes out of leg length and speed, which is
why children step faster than the adults they are with without anything in the
piece saying so.

**A head is an oval, not a circle.** Seen from above a head is about a quarter
longer front to back than it is wide, so which way somebody is pointing is
legible at eight pixels across. Add a face that comes into view as the chin
lifts and you can tell, at that size, whether a person is looking down at the
path, level at whoever is talking, or up at something. Nothing else in the piece
gives so much for so little.

**Groups have a shape.** Pairs and threes walk abreast. Four and more bend into
a shallow arc with the middle lagging, which is the arrangement in which
everyone can see everyone else's face. Both flatten out when it gets crowded,
because a wide group cannot get through a gap. And within a group the turn to
talk passes around, and the listeners' heads follow it — which is most of what
says that these particular people are together rather than merely adjacent.

**Children are not small adults.** They are attached to somebody, on a leash of
about three metres, and they spend that leash: darting off and being called
back, chasing each other until somebody is caught and the roles swap, stopping
dead to crouch over something on the ground, jumping, and occasionally falling
over and taking a second to get up. The adult they belong to turns to look at
them when they get too far away.

## The camera is real, and it matters

Head size barely changes with age. A four-year-old's head is about seven-eighths
of an adult's across, where their height is barely more than half — which fights
"adults are bigger, children are smaller" harder than you would expect. Looked
at from infinitely far away, an adult's head is only about an eighth wider than
a child's and the crowd is nearly uniform.

So the camera is a real pinhole at a stated height. A head is closer to the lens
than the ground is, so it is magnified, and displaced outward from the centre of
the frame, by exactly the same factor. Twenty-four metres up that takes the
adult to about a seventh larger, and the heads near the edges lean out over
their own feet; at twelve metres it is nearly a fifth. Bring the camera down and
both effects grow together, because they are the same effect. It also means a
child leaving the ground gets visibly larger, which is one of the two things
that make a jump read.

The other is the shadow — and the shadow is also where most of the size
difference actually lives. Only heads are drawn, but the shadow is of the whole
person, which is what a bright day from above actually looks like: a scattering
of heads each with a body lying next to it on the grass. Shadow length and width
both go straight with height, so an adult's is more than half again a small
child's in both directions, where their heads differ by a seventh. If a crowd
here ever reads as uniform, the light is the thing to reach for. When a child
jumps, their shadow detaches and slides away from them.

## What the sliders are for

Roughly: the ones under **crowd** decide who turns up, the ones under **people**
decide what they are like, and the rest is the camera, the light and the paint.

The two worth reaching for first are **density** and **going**. Density is
people per hundred square metres of ground actually in frame, so widening the
window brings more of them rather than spreading these ones thinner; a quiet
park is around 3, a busy lawn 15, a pavement at rush hour 60. Pedestrians walk
at nearly their free speed up to about 40 and are visibly slowed by 100 — and
nothing here tells them to. **Going** decides whether they are crossing,
wandering, or heading for a spot to sit on, and _across_ is the one to watch,
because it is the setting under which the files form.

After that, **height** is the most underrated control in the piece and **bob**
is the most illustrative: turn it past two and you can see the mechanism you
were not supposed to notice.

## What it does not do yet

There is nothing to walk around. The steering already handles obstacles — an
obstacle is a disc that is not moving, and the same law that keeps two people
apart keeps a person out of a tree — but nothing is drawn or placed, so the
ground is open. Hide and seek is waiting on that, since it needs somewhere to
hide.
