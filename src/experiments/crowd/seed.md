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

## 2026-09-20 — the empty sky, and what would be lost by filling it

Answering the last two open questions, and naming the piece better than any of
the prose written for it:

> i'm looking at market and it all appears fluid. i like the interaction with
> companions - hard to tell if i'm looking at them or past them, so not a worry.
>
> don't quite understand what "black above the band" is. if we're talking about
> the "sky", then yes - it's a "brief" because nothing was specified to be there,
> so it's empty as expected. adding landmarks would probably add more character
> to the scene, but it would also break up the "moving infinity" that is
> presented.

**"Moving infinity" is his phrase and it is the thing.** The crowd has no edge
and no landmark, so there is no fixed point to measure progress against and the
walk cannot arrive anywhere — which is why the emptiness is load-bearing rather
than unfinished. A landmark would give the eye something to hold, and holding is
the one thing this picture does not do.

---

## Questions I could not answer, and what I assumed

Written for him to read when he chooses, not to block on.

- ~~**Is the empty space above the band right?**~~ **Answered on 2026-09-20,
  above.** It is the brief, and filling it would cost something specific: the
  "moving infinity". Landmarks were considered in the same breath and declined
  for that reason, which is recorded in `AGENTS.md` so nobody adds them as an
  obvious improvement.
- **Should the gaze look at things that are not drawn?** The overhead look
  follows a point in the world with no bird rendered at it. Assumed yes: the
  crowd is all that is _drawn_, not all that is there, and a gaze that only ever
  went to things the renderer knows about would belong to the renderer. He has
  seen it and not objected, which is not the same as having chosen it.
- ~~**Is the market's head too busy with three companions?**~~ **Answered on
  2026-09-20, above: no.** "Hard to tell if i'm looking at them or past them, so
  not a worry" — which is a more interesting answer than yes or no, because it
  says the companion glance is not legible _as_ a glance at them. It does not
  need to be. Whatever it reads as, it reads as fluid.

---

## 2026-09-25 — a structured crowd: the parade, the teams, the trail

A new brief, given to a fresh session with the question of where it belongs
left open:

> we have a crowd experiment. it looks great. it's main feel is of a person
> walking through different kinds of crowd and looking around.
> i want to try experiment with a structured crowd and cannot decide whether it
> is a new experiment or if we should keep going with the existing one and pile
> on more.
> i would like to see a walker being part of a parade where there are stationary
> observers on both sides and a stream of walkers going in the same direction
> past the stationary crowd on both sides.
> another variation is of similar kind but where the number of walkers is
> smaller, i.e. they're like sports teams in small groups going in the same
> direction spaced out
> next version would see a crowd going through structured space that is not all
> straight. so we are all walking as a river meandering without sharp turns, but
> the path we follow is relatively narrow, like a mountain trail or a firetrail
> through a forest. the trail is seen by the shape of the crowd following it.
> again, like in crowd experiment, we're only seeing people and here we're
> seeing the shape of the world by the space people occupy or not.

### What I did with it, and what I could not decide

**Built into `crowd` rather than as a new piece**, as presets — _parade_,
_teams_, _the trail_, _fire trail_ — behind new settings under **route**
(`lining`, `watchers`, `bend`, `meander`, `climb`, `hills`, `effort`) and a
`team` size under **crowd**. The reason is reversibility, not a view on which is
right: every one of the three is the existing corridor generalised, so this was
the fastest way to something he could drive, and splitting the presets out into
a piece of their own later is a copy, whereas merging two pieces is not. **Which
it should be is his question and is still open.**

Questions I could not answer, and what I assumed:

- **A trail on level ground does not show its shape from eye height.** Every
  head sits on the horizon, so the bends are only a left-right spread. I added
  relief (`climb`) so the far bends lift off the horizon, and Tobler's hiking
  function (`effort`) so the crowd bunches on climbs. Both are sliders and the
  trail presets use them; set `climb` to 0 to see the level version. Is the
  ground allowed to rise, given the brief said "we're only seeing people"?
  Nothing but people is drawn — the hill is only where the heads are.
- **Is the parade's walking stream too sparse?** At 30/100m² on a 10 m road it
  is a procession rather than a march. `density` moves it.
- **Teams are spaced at random, not evenly.** A parade of delegations has
  regular gaps; these have the gaps random placement gives, and teams at
  slightly different speeds close up over a long walk. An even spacing would be
  a new mechanism — say if it matters.
- **Do the watchers want to face or follow the parade?** A head gives away
  nothing about which way it is turned (see `AGENTS.md`), so they do not; that
  is the piece's existing constraint rather than a new one.
- **The showcase is unaffected.** Published crowd scenes are pinned to frozen
  runners; nothing here asks them to move.

## 2026-09-25 — a two-way trail that keeps left

> great, thanks. how about a meander along a two way path where I and everyone
> going in my direction walks on the left, and those moving in the opposite
> direction (towards me) are on the right.

Built as a `keep to` slider under **route** (left, right, or either side, with a
strength) and a **keep left** preset: the trail made two-way, everybody keeping
left of their own direction of travel. Open question: the preset uses the full
strength, which is a strict procession in both directions — nobody on the wrong
side at all. Below about 0.3 the rule is loose enough that people step across to
overtake and come back. Which of those he meant is his to say.
