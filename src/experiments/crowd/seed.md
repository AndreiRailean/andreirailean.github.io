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

## 2026-09-26 — the showcase, a runner, a loop, and somebody to chase

> great. let's add keep left, parade and teams to the showcase. i like how in
> "keep left" the crowd goes into far distance. there's just enough people to
> see the train and give it the right shape into the horison.
>
> let's do a few more:
> runner - i am the only one running. everyone else is walking, like they do in
> "keep left" in both direction. i'm running in between the two streams. i can
> increase my pace with a slider on "keep left" but not enough to make it feel
> like a jog. maybe because my bobbing is still walk-like. either way, running
> between the two streams would be great.
>
> loop run - like teams, i am canvassed on both sides by a standing croud. but
> i'm not walking into the straight infinity, instead I go in a loop with a few
> companions running next to me in a similar pace. keen to see if the loop is
> detectable and whether it is sufficient to just have a curved street - like
> parade or teams but with smooth and sharp turns. the sides of the path can be
> smooth or straight, but the run needs to be smooth without abrupt turns - like
> a car turning would follow a curve.
>
> one thing i keep thinking about when looking at the crowd animations is that
> it would be nice to have a target to follow. like a child, or a friend who is
> running away and I'm trying to catch up with them. obviously it is impossible
> to tell a random dot apart from the crowd in the distance, so i'm imagining it
> being red in colour. i think 2 key actors would change the simulation dynamic:
> a red dot would at first appear to be the main actor, but the actor is the
> "me" who's looking at the world.

### What I did with it, and what I could not decide

- **Showcase:** keep left, parade and teams are on the wall, keep left first as
  the newest. Pinned to a runner built from this branch, so they can be
  re-pinned freely until it merges.
- **runner:** the keep-left trail with me running down the middle. The cause of
  "not enough to feel like a jog" was two things, both fixed: the pace track
  stopped at 2.2 m/s, and the bob stayed a walk's at any speed. `my line` and
  `hold` put me anywhere across the way.
- **loop run** and **street run:** the same run, kerbs and three companions,
  on a closed 700 m circuit and on a bending street, so the question — is a
  loop detectable, or is a curved street enough — can be answered by switching
  between the two. `loop` and `corners` make any scene a circuit.
- **catch me:** the market with somebody in red. `chase` and `their pace`.

Questions I could not answer:

- **Is the loop detectable?** Unlooked-at in motion. Across the infield the far
  kerb is 150–200 m away and faint at this `fade`; a longer `distance` shows
  more of it and costs clarity near by.
- **Should the red head resist the fog?** It fades exactly as everybody does,
  so past about 20 m it is a few red pixels. A person looking for a child sees
  red further than physics says; whether the piece should is a taste.
- **Who is the one in red?** Whoever the seed makes them — often an adult. The
  brief said "like a child, or a friend"; a setting could pick.

## 2026-09-26 — the red person, and glancing while running

> The red person could use some work. They're almost always in front, which
> makes them appear like a center marker on a camera screen. What would make it
> more realistic is if, like running through people, we couldn't just follow the
> straight path to them. We have to follow our path and correct it to point at
> them, but we're not fully locked on them at all times. They could be running
> to the left while we're behind and are still running forward. So them turning
> doesn't make us go diagonal to catch up, but keeps us going forward and we
> turn near their turning point. Perhaps we bias our glances on the red person,
> but our direction is more constrained by the invisible topology that is
> stopping us from making shortcuts (we can't go through market stalls - we have
> to walk around them).
>
> Glancing while running needs an adjustment. It is much harder to run and
> follow birds right over your head - the world is moving too fast past me and
> accidents are more likely. So glances need to become shorter and be focused
> more on the distant objects rather than looking at the rocks on the ground and
> birds immediately overhead. Current glancing model breaks the loop running
> illusion because it appears like a distracted child is about to fall over
> because they're not paying attention.

Built as: invisible **stalls** with **aisles** (route), the chase following the
red person's trail rather than the person, a runaway who ducks round corners,
and a runner's gaze that is shorter, rarer and further ahead. **catch me** now
has stalls; a **stalls** preset shows the aisles with nobody to chase.

Open: with the trail followed, the red head is inside my field of view about
half the time — lost round corners and found again by a glance. Whether that is
too often lost is a matter of `chase`, which scales both how hard I go after
them and how many glances they get.

## 2026-09-26 — focus on the chasee, the loop, and being caught

> it's looking really good. the "catch me" preset is feeling more natural,
> though it does feel like the red dot goes out of sight a little too much and
> for a chasing scene, it feels that the chaser isn't focusing on the chasee as
> much as they should.
>
> i can't tell the loop from the street. maybe i need to let it loop for much
> longer to notice, but I won't do that.
>
> please file a ticket for the steward to think about how to handle cases when
> preset number grows like we have it here. i don't want to artificially limit
> it. and i don't want you to focus on it right now.
>
> i'm looking at a seemingly abnormal "catch me" case. where the red person has
> been caught. they're not running away anymore and I appear to be looking
> around all the time with the red person going out of sight to the left and to
> the right. i can't quite tell whether we're walking together or we're
> wrestling. i think if i catch them we can stand together for a little bit,
> then they run away and I chase them again. tom and jerry style
