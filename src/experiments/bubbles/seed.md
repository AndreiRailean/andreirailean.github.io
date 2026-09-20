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

## 2026-09-20 — second round of feedback

> one thing the real jet from the bottom in a jacuzzi does is make the water move
> in a way that small bubbles can't linger in their "birth" place. they radiate
> out and get caught in swirls. swirls are also pushed out from the center. so
> the center of the emergence has this wavy nature and everything leaves it.
> current simulation, even when shallow makes the bubbles linger in the center of
> the jet and big bubbles tend to become big in the middle. in a real jacuzzi,
> bigger bubbles form outside of emergence area it's unlikely a big bubble will
> emerge big and stay around. if it's a big pocket of air coming from below, it
> never turns into a bubble. it doesn't mean that bubbles are born the same size.
> it just means that there's a natural limit to how big they can be at birth.
> they can become much bigger as smaller ones collide, but big one has zero
> chance of emerging unless we're talking about very soapy water.
>
> also, looking at this, i see that my adjustments only apply to 1 jet. the other
> jet only spits out tiny dots like it's congested. i think it's natural for jets
> to have variability, but we're not modelling a clogged pipe here.
>
> http://10.1.11.11:4456/experiments/bubbles/?s=_7___7t4QJgwwaAAFPDwwMKzWiCUMIkAQXw2AY2ARw2y6-I

**My reading, marked as mine.** The second paragraph is a plain bug and the first
is a missing mechanism that happens to produce the same complaint from two
directions.

The bug: jets were served in order out of one pool of slots, so when demand
exceeded the pool's turnover the first jet took every freed slot and the rest
starved. Nothing about it was variability — it was a queue with no fairness in
it, and it reads as a blocked nozzle.

The mechanism: there is nothing in the piece that stops a bubble being large. The
boil is where the foam is densest, density is what drives coalescence, so the
biggest bubbles necessarily formed exactly where he says they never do. The
answer is not to move the births — it is that **a violent place breaks bubbles
up**. Above a size that depends on how hard the water is being worked, a bubble
fragments rather than surviving, which is the Kolmogorov–Hinze scale and is why a
big pocket of air rising through a jacuzzi never arrives as one bubble. That one
mechanism covers all three of his observations: nothing large survives in the
boil, large ones therefore assemble outside it in calm water, and there is a
natural ceiling on birth size without anybody declaring one.

## 2026-09-20 — third round, mid-build

> interesting. at born size 1mm-1mm, no bubbles are produced

> i think the smalle the bubble the longer it can stay. drain is scaled
> incorrectly. the only interesting values there are very close to zero. anything
> above that makes them disappear too fast.

**My reading, marked as mine.** Both were real and neither was tuning.

The first was `GONE`, the radius at which a bubble counts as drained away. It was
1.2mm, which was fine when the birth band's floor was 2mm — and when I lowered
that floor to half a millimetre in the same round, it silently became a filter on
birth. A bubble born at 1mm was already past the test and was released on its
first step.

The second was worse, because the control beside it claimed the opposite of what
the arithmetic did. `drain` was a radius loss in metres per second, so a big
bubble simply had more to lose and **outlasted** the small ones `fragile` was
written to make short-lived. Both halves of what he noticed follow from that: the
scaling is inverted, and a rate large enough to matter for a big bubble deletes a
small one instantly, so only values near zero were usable. It is a film lifetime
now — a time, not a rate — and the life shortens with width.

Looking for those turned up a third that nobody reported: `emit` forgave the gas
debt at the end of every frame, so a jet emitted exactly one bubble per step
whatever its size. Every claim about "smaller bubbles simply means more of them"
was false while that stood, including the one in `about.md`.

## 2026-09-20 — what I assumed in answering that round

- **The presets are freshly tuned against corrected physics and will need your
  eye.** Three mechanisms changed underneath them in one round — tearing, film
  life, and an emitter that was delivering a twelfth of the gas it claimed — so
  every number in every scene was chosen against numbers, not against a look.
  `bigOut` in `experiment.stats()` is mean bubble radius outside a boil over mean
  radius inside one: it runs 1.0 to 1.68 across the presets now, where it was
  under 1 before.
- **`pop at` / `pop rate` may now be redundant.** Tearing covers "too big to
  hold" and film life covers "time ran out", so size-triggered bursting is a
  third death mechanism doing similar work. I left it because removing a control
  is a commitment and you have not asked for one.
- **`gas` is scaled for the old emitter's range.** It runs to 4000 cm²/s and the
  presets now sit between 20 and 70, because the emitter finally delivers what it
  is told. The top of that range is only reachable with very fine bubbles and a
  large pool. It wants narrowing once you have decided where you actually live.
- **`rolling boil` is the only preset under 60fps**, at 44. It is the deliberately
  extreme one; every other scene holds 60.
- **Still not built:** the per-jet tilt you described — a side jet displacing and
  stretching the footprint without giving bubbles lateral motion.

## 2026-09-20 — fourth round, on an adjusted meniscus

> This is an adjusted meniscus preset. Here, big bubbles have a strange
> overlapping actoin. I can't quite understand what's going one there. most
> bubbles are file, but big ones just appear to jump around randomly. i guess
> because the bubbles are hollow here, we can see multiple circles on top of one
> another before they join or pop. in watter, bubbles tend to stick together and
> move together. here we have them apearing on top of one another.
>
> http://10.1.11.11:4456/experiments/bubbles/?s=_4_977vfeEBYUGAg0YoWCCOYoniCgEsQqdMgRgwDpfBAF6PHHda

**My reading, marked as mine.** The last sentence is the mechanism and the rest
is what it looks like. Bubbles in this piece can only do two things to each
other: become one, or push apart. **Nothing makes them stick.** Real foam is
bound by shared walls — a raft translates as a unit and neighbours keep their
places in it — and none of that exists here, so a crowd is a set of independent
tracers that happen to be near each other and slide freely through the overlap.

Rings did not cause it; they revealed it. A disc hides interpenetration because
the union of two white discs is one white blob, and an outline cannot hide it.

"Jump around randomly" is likely a second, separate fault rather than the same
one, and tearing is the suspect: a tear places the remainder a full diameter away
in one step and cuts the parent's radius instantly, which for a big bubble is a
visible teleport rather than a break-up.

## 2026-09-20 — what I assumed answering the fourth round

- **`cling` is new and every preset carries a value for it**, 0.4 to 0.82. It
  damps a touching pair toward a common velocity and draws bubbles together
  within reach. Set it to 0 on a ringed scene to see what the foam did before.
- **`bounce` changed meaning in practice**, from a soft shove to how rigidly two
  bubbles refuse to share water. Every preset's value went up, most to about
  0.8. Overlap between grown bubbles now measures 0 in eight of the ten.
- **`jostle` is now called `bounce` in my head and `bounce` on the panel**; the
  label reads as the old soft-collision idea and may want renaming once you have
  decided whether rigid contact is right.
- **I did not add bubble flattening.** Real foam bubbles press into polygons
  against each other and we draw circles, so the closest honest thing was to
  make them refuse to interpenetrate at all. If the raft ought to look packed
  rather than merely touching, that is a rendering change — drawing the
  Voronoi-ish cell rather than the circle — and it is a much bigger piece of
  work than anything here.
- **`one jet` still measures 54% overlap** where every other scene is at or near 0. It has very few grown bubbles so the sample is small, and I did not chase
  it.

## 2026-09-20 — fifth round

> i'm not seeing any clinging here.
>
> http://10.1.11.11:4456/experiments/bubbles/?s=_4_977vffEBYUGAg0YoWCCOYoniCgEsQqdMgRgwDpfBAFlCHHdZk
>
> a few more observations:
>
> - real bubbles don't always join to make a bigger bubble. i guess turbulence
>   sometimes causes them to press together and form a bigger bubble. but they
>   could also pop (or one of them could) instead of joining.
> - all bubbles should have the same stroke width. i think real bubbles are that
>   way. this makes smaller bubbles look like they have thicker walls. current
>   experiment lets the s wall grow with size and it shouldn't
> - still seeing jerky circle action. reloaded a few times. maybe something
>   didn't tak
>
> what's the control to make it more foamy? i.e. let bubbles accumulate

## 2026-09-20 — answering the fifth round

**The foam control is `coalesce`**, and it did not exist as one until now. It is
film failures per second of contact: bring it under about one a second and
touching bubbles stay neighbours instead of joining, so the surface packs. Preset
3, `foam`, is the packed end. Everything else that looked wrong in that round was
the same number — a contact was not surviving a single frame, so there was never
a raft to cling to and nothing could accumulate.

- **Why no clinging was visible.** Not a bug in `cling`. Measured on his scene:
  3,242 merges a second against 1,203 bubbles alive. Slip between touching pairs
  was 92% of the foam's own speed; it is 10–15% now.
- **His address also carried `bounce: 0.34`**, the value from before the last
  round — an address states every setting, so a saved link does not pick up new
  defaults. Worth knowing when a scene seems not to have changed.
- **The jerkiness.** `shove` now reports it: mean positional correction per
  bubble per second, against the foam's speed. It is 1–10% in every scene except
  `foam`, which runs at 86% because a jammed raft is the solver pushing harder
  than the water does. That is the honest limit of drawing foam as circles that
  may not overlap — real bubbles deform into polygons, which is a rendering
  change rather than a physics one and is not built.
- **The trade I could not settle for you.** Slow coalescence gives thick foam and
  _fewer_ big bubbles — they are opposite ends of one control. `slick`,
  `meniscus` and `foam` get some of both by being soapy: long `lasts`, high
  `holds at`, low `torn by`.
- **Still not built:** the per-jet tilt, and bubble flattening.

## 2026-09-20 — sixth round

> this is an interesting one. i'm not sure how "frame" preset can turn into a
> ring, but I like it.
>
> http://10.1.11.11:4456/experiments/bubbles/?s=_4_177vX_0BiMTEhQBGtRgESTRIAZ0zEKnQA0aI-eCQDLZxg-4gfiAQA

## 2026-09-20 — answering the sixth round

**`frame` did not make the ring.** It is where the jets' push and the return
cancel: foam carried outward arrives there and can go no further. Widening
`frame` only brought it inside the picture — at the primary's framing it sits
outside entirely, which is why it had never appeared before.

Confirmed rather than asserted. Where the foam actually collects, against where
the arithmetic says the two flows cancel, over a range of `return`: 1.005 against
1.009, 0.890 against 0.885, 0.774 against 0.769, 0.656 against 0.650 metres.

- **`return` moves it in, `jet power` moves it out**, and
  `experiment.stats().ring` now gives its radius in millimetres so you can set
  `frame` to meet it instead of finding it by luck.
- **Two presets, 4 and 5**, are that scene with and without a little churn: one
  is a drawn circle, the other has lobes and wanders. They are one drag apart,
  which is why both are there rather than my picking.
- **The preset bar is at thirteen and the keyboard only reaches nine.** That is
  worth pruning and the pruning is yours — I do not know which of them you are
  actually using. `standing still`, `slow water` and `shallow` are the ones I
  would drop first, and `shallow` only because it exists to demonstrate `depth`
  rather than to be looked at.
