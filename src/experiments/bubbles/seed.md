# seed — bubbles

What Andrei asked for, in his words, and each round of feedback as it arrives.
Verbatim. This file faces inward and records him; `about.md` faces outward and
describes the work.

## 2026-09-20 — the seed

> we're observing a body of water from above. jacusi jets push bubbles from the
> bottom. jets can be multiple. bubbles emerge naturally small and readiate
> outward from the jet center in wavy motion. As they radiate, they combine and
> become bigger. Bigger bubbles eventually pop. Bubbles are white circles. Water
> is black background. An observer can only see the white dots/circles. All the
> dynamics of water motion is shown by the motion of the circles. When multiple
> jets are present, bubbles collide and interact. Water makes waves and swirling
> patterns that move in unpredictable ways. The whole screen is a body of water.

## 2026-09-20 — questions I could not answer, and what I assumed

Not sent to him; they are here because he reads this when he chooses, and every
one of them is answerable by dragging something rather than by replying. Where a
question had two answers I built both and made them reachable, which is what the
role asks for instead of picking.

- **"Bubbles are white circles" — solid discs, or rings?** A bubble on a real
  surface seen from above is a bright meniscus with water showing through the
  middle, which is a ring. The seed says circles and says an observer can see
  only the white dots and circles, so **the primary draws solid discs** and
  `drawn as` under picture offers `rings` and `mixed` — mixed being a ring once
  a bubble is big enough for the wall to read, and a dot while it is not, which
  is what an eye actually does. Preset 7, `meniscus`, is the ring case built out
  as a whole scene rather than as a toggle.
- **"The whole screen is a body of water" — does the foam have to reach every
  edge?** I read it as yes, and the primary is set so it does: five jets spread
  wide enough that there is no quiet black margin. The alternative reading — a
  boil in the middle of a dark surface — is one drag of `return` or `spacing`
  away, and `one jet` is that scene.
- **How close are we standing?** The frame is 90cm of real water. That is the
  single biggest lever on what the piece looks like and I had to pick one. Down
  at 30cm a bubble is a large circle and individual merges are watchable; out at
  4m it is a texture. Nothing else in the piece is tuned to it, so it is safe to
  drag a long way.
- **Should bubbles be able to leave the picture?** In the primary they mostly do
  not: `return` pulls them back, which is what a closed tub does, and it makes a
  standing ring of foam. At `return` 0 they radiate out and are gone, which is
  truer to a tub much bigger than the frame. Both are one slider apart.
- **Is the waver the right size?** `waver` and `waver rate` are the sidestep
  each bubble takes across its own path, which is what makes the radiating look
  wavy rather than straight. I have no way to judge how pronounced he wants it;
  the range goes from nothing to enough that a path is mostly waver.
- **Wake.** `wake` leaves the last frame behind so the flow reads as streaks. It
  is off in every preset because the seed asks for the dynamics to be shown by
  the motion of the circles, and a wake shows it by not moving them. It is there
  because it is the clearest possible look at the field, and because it may be a
  better piece.

## 2026-09-20 — first round of feedback, after driving it

> i'm looking at slick and trying to understand what I like about it. i made
> others use rings and that doesn't seem to be it. I like that you added ring as
> an option. They're a little too thick to work as bubbles, but it's a good
> start. I'm trying to make the water move slower. All your presets, except for
> slick move very fast, which is probably indicative of shallow water. When water
> is deper and jets are not industrial grade, the surface of the water does not
> violently move. Bubbles gently show up on the surface and the rest of the work
> is done by the swirling and waving motion.
>
> born at: is a strange name. I thought that's the size bubbles appear when
> they're born. if I bring down the top bracket i never see big bubbles even if
> the little ones collide. when I let big bubbles be born, they appear to linger.
> I haven't found the control that makes bigger bubbles live less.
>
> I'm looking at this and am trying to get the "birth" place to slow down without
> killing all motion. there's power in water moving that is not reflected by
> bubbles appearing at a fast speed. Keep in mind we can't see into the water,
> we're only seeing the surface. If bubbles come out of the jet under water fast,
> doesn't mean they will skid accross the surface - they will just float to the
> surface from the jet. So the jet being at the bottom would make all bubbles
> appear in a circular pattern. A jet on the side would push the bubbles
> linearly, but that only determines the origin of their birth, doesn't give them
> lateral motion. The jets release bubbles AND move water. Water motion on the
> surface is what makes bubbles on the surface move. Jets are not on the surface
>
> - that's not what we're experimenting with here.

**My reading, marked as mine.** The last paragraph is a structural correction and
the rest follows from it. The first build had **one** field doing two jobs: the
jet's outflow decided both where a bubble was born and how fast it then skidded
away. Those are different things and only the second is water.

A jet is at the bottom. Its gas rises and **arrives** at the surface across a
footprint — circular for a jet pointing up, displaced for one pointing sideways —
and it arrives with no lateral momentum of its own. What moves it afterwards is
the surface current, which is a much gentler thing: the upwelling spreads out
over the whole depth before it gets there. So depth is the variable that was
missing, and "the presets move too fast" and "shallow water" are the same
observation.

The other three are each a mechanism that is absent rather than mistuned:

- small bubbles never coarsened because `gas` was _bubbles per second_, so
  halving the birth size halved the foam's coverage and coalescence stopped;
- big bubbles lingered because nothing made a large film drain faster than a
  small one, and below `pop at` the hazard is exactly zero;
- the water could not be slowed at all, because there was no clock.

## 2026-09-20 — what I assumed in answering that round

- **Ring thickness.** "A little too thick" — `wall` now goes down to 0.02 of the
  radius where it used to stop at 0.08, and `meniscus` sits at 0.03, which is a
  hairline. I did not make the wall a fixed width in millimetres instead, though
  that is the other reading: a real meniscus catches light in a band that is
  roughly proportional to the bubble, so a fraction is the more physical of the
  two. If he wants every ring the same weight regardless of size, that is a
  different control and worth saying so.
- **The primary is still discs.** He said the rings are a good option and that
  making everything use them "doesn't seem to be it", so `deep water` draws
  discs and `meniscus` is the ring scene. `slick` draws `mixed`.
- **Which scene leads.** He was looking at `slick` and trying to work out what he
  liked about it. I did not promote it: `deep water` is the widest reading of the
  seed, and `slick` is what it looks like with the gas right down and `fragile`
  up. Promoting `slick` is a one-line move if the answer turns out to be that it
  was the sparseness he liked rather than the calm.
- **How slow is slow.** The primary takes about eleven seconds for a bubble to
  cross the frame, against under two for the presets he called fast. That was
  chosen by measuring rather than by eye, and it may still be the wrong number —
  `slow water` is the same tub at a third of that again, and `speed` moves it
  continuously.
- **What I did not add.** He mentioned a jet on the side pushing bubbles
  linearly, "but that only determines the origin of their birth". That implies a
  per-jet tilt, which would displace and stretch the footprint without giving
  bubbles any lateral motion. It is the natural next widening and it is not
  built; the footprint is circular for every jet.
