# Dangler — the seed, and what he said after

Andrei's own words, verbatim. Written by the session, never by him. See
`docs/agents/experiment-writer.md` for why this exists: a transcript dies with
its session, and the prose below exists nowhere else — not in the code, not in
the commits, not in `about.md`.

**This file is a backfill**, written on 2026-09-22 from the session transcript
of 2026-08-24/25, long after the piece was built (#204). It was transcribed in
one sitting rather than appended as it came, which is not what the rule asks
for; a piece started today gets one from minute zero.

**Bare preset query strings are replaced with `[preset URL]`**, and
housekeeping — merge when green, push what we have — is left out as incidental.
Since #320 it holds his artistic direction only: bug reports, feedback on the
implementation, his questions and preset or control requests were removed by
whole sentences, and no surviving sentence is reworded.

---

## The seed — 2026-08-24

> we're starting a new experiment. it is similar to existing experiment that
> can be found by visiting the /experiments url. the new one is called
> "dangler". the setup is similar to the "starry night" experiment: full screen
> experience, likely with an unobtrusive control panel (please familiarise
> yourself with experiments).
>
> dangler is a string of lights dangling from hight spaced apart. kind of like
> christmas lights only we're looking at them from below and they're dangling
> above us. so when seen from below, the decrease in size. the wire they're
> attached to is flexible, but has rigidity to it, so the lights are not all in
> a perfect line. if the wire hangs down with slight bending, the lights are
> like small led protruding from the sides of the wire. let's say there's a
> dozen of lights peer wire. and let's say there are 3 wires hanging to begin
> with. the wires have their own imperfections. if we imagine that these wires
> hang off a tree branch of some other uneven object, they all have different
> origins (i.e. distance from the viewer looking from below). we can't see
> anything but the lights: no trees, no wires. that's the start. later i want
> to try adding a little bit of motion as if a light breeze is making the wires
> sway.
>
> is this something you can help me build? let's start and figure it out as we
> go.

Followed by:

> depending on how it goes, we'll end up having more danglers in a scene so the
> complexity will be animating more wires. but they will all have fixed anchors
> to the randomly shaped organic object above.

> reads right. no invert. seeded world is ok. live params and all that. is hue
> slider controlling all light sources is there some imperfection coefficient
> that causes slight variability in light colour?

---

## 2026-08-24 — a bug that turned out to be a feature

The gust control exists because he found it by accident and kept doing it
deliberately.

> whenever I tilt, i end up wanting to just drag the scene to observe it in 3d
> space or at least to be able to "move underneath" or "turn my head".

> what i do find genuenly attrative happens as an unexpected side effect of
> adjusting settings. when I change spread, the wires get redrawn and that
> gives them a jolt so they sway a lot more when they spawn and then they come
> to steady, calm swing. That initial jolt with many wires together makes them
> crossover in the center turning it into a sort of a random flashlight. So i
> ended up adjusting the spread by tiny amounts simply to force it to jolt,
> which makes the wires sway hard like there was a burst, a gust of wind. would
> be good to allow for gusts. so for some cases instead of constant breeze, we
> could have waves of bursts of displacement and let it settle.

## 2026-08-24 — gusts

> gusts are very nice. i like this kind of motion.

## 2026-08-25 — tremble, motion sickness, and animating the canopy instead

> tremble has a place as a randomiser, but mostly for unsettling effects. it
> seems to induce an effect similar to mild motion sickness, probably because
> of its random nature. the only natural explanation i could give to tremble is
> lights attached to to ceiling of a shipping container that is being moved on
> an uneven road and the observer is on the floor of that container and is also
> being jerked out of place so focusing on anchors becomes hard - hence the
> motion sickness.
>
> what could work is animating the canopy. so if we're looking up and ligts are
> dangling off a tree, the tree would sway in a way that keeps the anchors
> moving, but the relationship between anchor positions would be maintained.
> it's like a warping of the canopy plane that always goes back to it's center
> position. so in a tree analogy, the tree would have a static position with no
> wind and as branches swing in the wind they pivot around the trunk in a
> limited way. modeling a complex canopy topology that allows for natural
> motion could be it's own experiment. but a gentle warping or morphing of the
> relief parameter (which would result in up-down) sway or anchor rotation
> through a common center coordinate may do the trick for now.

## 2026-08-25 — clustering

> another idea mildly related to topology is clustering. again the tree
> analogy: branches force anchors to be clustered along them. whether it's
> random disconnected clusters or a more connected variety - i don't know what
> will look better. when looking at the "frantic" preset, i'm thinking it would
> be good to have a few of these: i tend to see the whole current "frantic"
> scene as one complex dangler and think we could have a few. when i look at
> "together" preset i think that having a bit more of a shape to the swaying
> canopy and anchor positions could give it some more refinement.

## 2026-08-25 — branches to the edges

> what appears to not be possible is having branches that are covered with
> anchors all the way to the edges of the scene. i can only simulate that if i
> play with camera zoom, but then the impressive feel of the long wires goes
> away.
