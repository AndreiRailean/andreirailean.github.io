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
Nothing else is altered, trimmed or tidied.

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

## 2026-08-24 — adjust in flight

The clearest statement of the working method the experiment-writer role was
later built around.

> sounds good. also starry night got an "f" shortcut for full-screen mode. if
> you sync with latest main, you'll see it. feel free to write the spec and
> start implementing before my approval. i'd rather adjust in flight as it's an
> experiment - we'll only know where to go once we take the first step

---

## 2026-08-24 — tilt is useless, and a bug that turned out to be a feature

The gust control exists because he found it by accident and kept doing it
deliberately.

> what i haven't found useful yet is camera tilt. because we're looking up,
> tilt is like looking backwards, which is unnatural and doesn't give me
> anything - it's like it's trying to flip the sceene so the danglers grow from
> the ground. anyway, that's just a comment. whenever I tilt, i end up wanting
> to just drag the scene to observe it in 3d space or at least to be able to
> "move underneath" or "turn my head". tilt gives me only one dimension of
> turning. but I don't think we need to focus on that just yet.
>
> what i do find genuenly attrative happens as an unexpected side effect of
> adjusting settings. when I change spread, the wires get redrawn and that
> gives them a jolt so they sway a lot more when they spawn and then they come
> to steady, calm swing. That initial jolt with many wires together makes them
> crossover in the center turning it into a sort of a random flashlight. So i
> ended up adjusting the spread by tiny amounts simply to force it to jolt,
> which makes the wires sway hard like there was a burst, a gust of wind. would
> be good to allow for gusts. so for some cases instead of constant breeze, we
> could have waves of bursts of displacement and let it settle.
>
> because settings are so numerous, they have to be scrolled. i think we could
> let the panel be taller so everything fits.

## 2026-08-24 — gusts against yanks

> 3 is "frantic" with this preset [preset URL]
>
> gusts are very nice. i like this kind of motion. however i'm still not
> getting the effect of the "yank" you diagnosed. with gusts the bottom of the
> wires spread and then stabilise. with yanks they appear to stay in the center
> more. i guess it's because the yank makes the wire move (or stretch and
> contract) in the vertical (height) plane so it gives a denser presence in the
> middle without much sway.

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

## 2026-08-25 — flicker that cannot be seen, and clustering

> please add 0.7 sway to together preset.
>
> one setting i haven't been able to observe in action is "flicker". no matter
> how high it is, i don't get the flickering feeling. perhaps i'm expecting too
> much while it simply fades in and out gently and that gets lost in with the
> rest of the motion. when focusing on a single light i can't see any visible
> flicker.
>
> another idea mildly related to topology is clustering. again the tree
> analogy: branches force anchors to be clustered along them. whether it's
> random disconnected clusters or a more connected variety - i don't know what
> will look better. when looking at the "frantic" preset, i'm thinking it would
> be good to have a few of these: i tend to see the whole current "frantic"
> scene as one complex dangler and think we could have a few. when i look at
> "together" preset i think that having a bit more of a shape to the swaying
> canopy and anchor positions could give it some more refinement.

## 2026-08-25 — commit locally, push when ready

Still the standing rule for a piece, now in
`docs/agents/experiment-writer.md`.

> let's commit locally and only push a PR when we're ready. there's a lot of
> experimentation and manual testing for each change, there's no need to push
> it right away. you can keep this PR open and add to it when we're ready to
> release. removes the need to keep updating the PR description and doesn't
> expose half-built experiments to the world.
>
> branches appear to work, but a are a little hard to test. every time i move
> the lider control, anchors jump around and often get into an interessting
> broken state where they swing violently (fast rotation around the anchor) and
> never settle. It's a cool looking thing, but makes me search for a way to
> "pacify" the scene by moving other sliders.
>
> branches has an interesting relationship with spread. when increasing spread,
> it appears to increase "trunk" thickness until all lights are off screen
> completely. I don't know what i'm expecting to be honest, but given that
> branches introduce a constraint on where the anchors could land, increasing
> the spread reduces the probability that anything will land on a branch. what
> appears to not be possible is having branches that are covered with anchors
> all the way to the edges of the scene. i can only simulate that if i play
> with camera zoom, but then the impressive feel of the long wires goes away.
> with spread 2m and branches off, we get a good number of lights on screen.
> with spread 2m and 2 branches most of the lights are off screen.

## 2026-08-25 — the panel must not block on the render

> one glitch that's happening now that wasn't before is when i try to move the
> slider, branches in particular, the whole thing freezes like it's trying hard
> to re-render everything. we need to decouple the UI from updates in a way
> that doesn't block user interactions. so snapping to the next branch value
> should happen immediately even if animation render loop is struggling to
> catch up to re-rendering everything at once.

## 2026-08-25 — the spinning bulb

> that is all smooth now. another bug is when stiffness and set are high, each
> bulb starts spinning and never settles so it spins while it is dangling on a
> wire. this config has the bug for me. [preset URL]
