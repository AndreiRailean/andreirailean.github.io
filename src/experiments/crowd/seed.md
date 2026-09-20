# Crowd — the seed, and what he said after

Andrei's own words, verbatim. Written by the session, never by him. See
`docs/agents/experiment-writer.md` for why this exists: a transcript dies with
its session, and the prose below exists nowhere else — not in the code, not in
the commits, not in `about.md`.

**This file was written late**, on 2026-09-20, after the convention arrived in a
merge. Everything below is quoted from the conversation rather than recalled,
but it was transcribed in one sitting rather than appended as it came, which is
what the rule actually asks for. The next round goes in as it arrives.

---

## The seed — 2026-09-19

> I am walking through the crowd, like a market or a busy square. People
> everywhere. The heads are represented using circles. The only thing visible is
> white circles on black background. I'm walking forward and looking forward.
> I'm seeing people from my height. Some people are taller than me, others are
> shorter. There are kids, families and groups. People walk together and
> independently. A crowd is so large, it fades into the distance. The further
> people are the more faded they are. I walk around, turning my head to look
> around observing things. Sometimes I stop and look around. People in the crowd
> have their own dynamic. As I walk, I overtake some people. Some people
> overtake me. Some are walking in the same direction as me in front of me. Some
> are walking in the opposite direction - towards me. We have to negotiate the
> crowd without running into each other.

Followed immediately by:

> I am stepping away from the computer. Work independently. I will provide
> feedback in the morning once you have built something for me to interact with.

---

## 2026-09-20 — the head, the fog, the distance, and a street

> The first thing that jumps at me is the robotic turns of my head. They're very
> abrupt: appears that i'm looking forward, then I quickly turn my head and stop,
> then i turn again. Natural motion is not like that. If i'm walking, i turn my
> head only slightly and then turn it back. The motion is very smooth - need
> easing. Only when I'm stopped do I turn my head, but I don't keep it turned. If
> I want to face another direction, my whole body turns. Currently the experiment
> appears to never turn the head, but turn the whole body as it looks like the
> motion is always in the direction i am facing.
>
> distance appears to introduce linear fog. more clarity needs to be preserved in
> the closer layers.
>
> on top of viewing distance it would be good to control the distance of the
> crowd. so beyond 200m, for example there would be no people. A slider that
> pushes the density forward, i.e. everyone generate in close proximity if I want
> it.
>
> would be good to be able to simulate walking down the street or a corridor
> where people are only moving towards and away from me and I have to take them
> over or let them pass.

> Head turns are now smooth, thank you.

## 2026-09-20 — jitter

> I'm seeing strange jitter. When looking at the "street" or "concourse" i'm
> seeing occasional shaking. In video games that usually indicates collisions. Is
> that deliberate here? Are we modelling colissions?

## 2026-09-20 — strafing

> I'm trying to work out if there's strafing - the sideways motion without
> turning. That's usually how people avoid and overtake each other in corridors
> and on paths.

## 2026-09-20 — companions, and looking up and down

> this looks good now. very natural motion. i like.
>
> makes me wonder if having companions would add realism. i'm walking with
> somebody and we're talking. I'm glance at them as we're walking and talking. So
> there's someone always there with me (when I have a companion).
>
> also, and i'm not sure if this kind of realism is useful here, people, when
> they walk, don't just look to the sides. we look at the ground as well. current
> simulation does have a control for looking up or down. Perhaps that's something
> that should also form part of natural observational head movement. Due to
> peripheral vision, people can look down and keep walking forward, which is
> modelled by a control. Basically, looks like what we need is to make that
> control to be the bias and let natural gaze wonder up/down/left/right.

> great. i see it gazing down, but haven't detected an up gaze yet. like looking
> at a bird and following its flight while walking

> also gazing down while walking at a stationary object you're walking past - a
> rock, a dog, etc. that's a "follow" motion that is allowed without stopping. at
> a market specifically, that's how one walks and looks.

> add 2 companions to the market preset

## 2026-09-20 — do I ever turn

> in the simulation, am i always moving in the same direction or do i ever turn.
> hard to tell. i can see the turning, but other than collision avoidance, i
> think the motion is always in a straight line. is that correct?

## 2026-09-20 — the family, and how far to take it

> set market "with me: 3" - the whole family is walking around

> that's ok. some can be walking behind and sometimes overtaking. i can stop to
> look at them.

> We don't need to overdo the constellation modeling. Catching up with the group
> and all stopping together are possible, but i don't think they add any value.
> just having some companions provides perspective. because i see whate i "see",
> having a companion makes it look somewhat like a third person view.

> if you built the shuffle, it's ok. just no need to take it further into whole
> "family at the market and everyone is trying to keep together while being
> interested in different things" dynamic.

## 2026-09-20 — why the gaze follows what is not drawn

Answering a question this file had listed as unresolved. Kept because it is the
clearest statement of the principle anywhere, and sharper than the version the
code had:

> gaze should follow things that aren't there. we're only drawing heads. if we
> only followed things that are there, we'd only be following heads. we want to
> follow birds, rocks, etc. So sometimes we need to invent a thing to look at
> (and not show it).

---

## Questions I could not answer, and what I assumed

Written for him to read when he chooses, not to block on.

- **Is the empty space above the band right?** With heads and nothing else in the
  world, every head is within a metre of eye height, so the picture is a band
  with a lot of black above it. `my gaze` moves where the band sits but nothing
  can fill that space without drawing something that is not a head. Assumed it is
  the brief — "the only thing visible is white circles on black background" —
  rather than a gap. What would settle it: whether he wants bodies, or a ground,
  or nothing.
- **Should the gaze look at things that are not drawn?** The overhead look
  follows a point in the world with no bird rendered at it. Assumed yes: the
  crowd is all that is _drawn_, not all that is there, and a gaze that only ever
  went to things the renderer knows about would belong to the renderer. He has
  seen it and not objected, which is not the same as having chosen it.
- **Is the market's head too busy with three companions?** Half of all glances go
  to one of them, which makes the walk a conversation rather than an observation.
  He asked for three and said the motion was good at two; the lever if it is too
  much is `SHARE_COMPANION`, not the neck.
