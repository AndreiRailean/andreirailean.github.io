# Walkers — notes for agents

A crowd from directly above. A person is a head and a shadow; everything you can
tell about them, you tell from how they move.

`about.md` beside this file is the human-facing note. This is what you need
before changing anything.

## What this piece is, and what it is not

**A walker is a dot. All of the humanity is in how it moves.**

This is the rule that was learned the expensive way, and everything drawn here
has to answer to it. The piece went a long way in the other direction first —
heads as ovals a quarter longer front to back, a face that came into view as the
chin lifted, and a shadow of the whole _person_, three tapered strokes for legs,
torso and head. Every one of those is true of a crowd seen from above. Every one
of them was wrong for this.

The brief was dots, circles and points of light, with the _reason_ for their
behaviour being that they are people. Figurative detail spends the piece's
budget in the wrong place: it puts back the body that had explicitly been agreed
to be invisible, it does not survive the sizes the piece is usually looked at,
and at small sizes a field of little oriented ovals reads as something swimming
rather than as anybody walking.

So:

- **Dots are circles**, lit as spheres, with the highlight the same way for
  everybody so the frame has a light in it rather than a field of arrows.
- **A shadow is the shadow of a circle** — a soft ellipse stretched along the
  light. It survives only because it is the sole cue for **height**: a jumper's
  shadow slides out from under them, and that needs no figure.
- **Head orientation is simulated and not drawn.** `updateGaze` is real and the
  debug overlay draws its rays, because gaze is what makes a group read as a
  group in the _numbers_. It reaches the picture through nothing.

Before adding anything representational, ask whether it is describing a person
or a person's _behaviour_. The second is the piece; the first has been removed
once already.

## The one design rule

**`body.ts` has no settings in it, and must not get any.**

A number in `body.ts` is a number somebody measured — stature, head breadth, how
far a head rises on a step, how fast a given pair of legs prefers to walk. The
panel cannot reach any of it. What the panel gets is the _population_ those
measurements are drawn from: how many children, what band the adults draw their
pace from, how much the gait is exaggerated for looking at.

The reason is that every tempting slider in that file is a way to be wrong, and
they will be reached for, because fixing the _look_ by turning the mechanism
wrong is always the quickest fix available. Cadence is the clearest case: it
falls out of leg length and speed, and the entire reason children read as
children from above is that theirs comes out higher without anything saying so.
A cadence control would let a crowd walk at a stride frequency their legs cannot
produce, and it would be dragged there within a day.

`tests/unit/walkers/body.test.ts` checks the measurements against the figures
they claim to come from, not against themselves. If a constant there is retuned
by eye, that is what says so.

## What each file is for

```
body.ts       anatomy and gait. Measured, not chosen. No settings.
steering.ts   why nobody walks through anybody. Pure functions.
grid.ts       a uniform grid, so avoidance is not n².
crowd.ts      who is out there, what they are doing, where they go next.
view.ts       the camera (a real pinhole) and the sun.
palette.ts    the ground, the light, and what everybody is wearing.
draw.ts       ground, shadows, heads. In that order, for stated reasons.
walkers.ts    the scene: canvas, clock, resize, stats.
settings.ts   Settings, CONTROLS, PRESETS, the one validator.
```

`crowd.ts` needs no browser at all — it is arithmetic on numbers — which is why
almost everything worth asserting about this piece is in the **unit** suite and
runs a whole afternoon of park in a second. Reach for
`pnpm exec vitest run tests/unit/walkers` while working; the browser spec is for
the things a real page adds, and it says which at the top.

**Those unit tests are not cheap**, and they are most of the section's unit run
— about two minutes of it. `tests/AGENTS.md` says so next to its advice about
filters, because otherwise the next session reads "milliseconds", runs the full
suite and concludes something is wrong.

Two things already hold the cost down, and both are worth knowing before adding
a third case:

- They run at a **1/60 s step** where the piece runs at 1/120. A longer step is
  the harder case for everything they assert, so passing here implies passing at
  the rate the scene uses, at half the price.
- They use a **small frame at the real density**. Nearly every claim here is
  about people per square metre rather than about how many people there are, so
  a third of the frame is the same physics at a third of the cost. Two cases
  were spending 79 seconds between them simulating four hundred walkers to
  measure properties four dozen show. The preset loop uses a small _window_ for
  the same reason — the viewport is not part of a preset.
- Where an effect is small and the seed-to-seed scatter is comparable, read the
  **same run twice** rather than comparing two runs. The lane-sorting case did
  the latter and was comparing its seeds as much as its subject.

The exception is worth knowing because it is the one that caught the rule out:
**lane sorting needs the frame as well as the density.** Files form along a
walker's path, and at span 10 a crossing takes ten seconds, which is not long
enough for one to — the test fails there, correctly. Do not shrink that one
below 13.

Before adding another case, ask whether an existing one can be widened.

## Traps, every one of which cost something

Nearly all of these were invisible on screen. That is not a coincidence; it is
the whole reason the numbers in `stats()` exist.

- **`settle()` was capped at sixteen steps.** It reused the frame loop's
  catch-up ceiling — `MAX_STEPS`, which exists so a backgrounded tab does not
  try to make up a minute of park — so every call advanced an eighth of a
  second. The poster recipe's `settle(120)` did nothing, every still in the
  session was of a crowd that had barely started arriving, and several settings
  were retuned to compensate before anybody noticed. Nothing errored. A `settle`
  is somebody deliberately asking for a minute of park; the loop's ceiling is
  about a tab coming back from the background. They are different numbers.
- **The crowd was populated before the canvas was measured.** `createWalkers`
  builds a placeholder view for a canvas that has no size yet, and `fill()` ran
  against it — so the whole opening crowd landed inside a few square metres at
  the middle of the frame and spent the next minute dispersing. It looked exactly
  like a bug in the spawner. `start()` measures first and fills after, and
  `tests/unit/walkers/crowd.test.ts` counts quadrants because of it.
- **Population control is a loop with a transport delay in it**, and every
  obvious controller oscillates. People spawn off screen and take ten or twenty
  seconds to walk into shot. Proportional on the in-frame count swung between 0
  and 57 against a target of 16, on a half-minute period. Integral on the same
  count swung between 6 and 70 on a four-minute period — slower is not safer, it
  is the same instability at a lower frequency. What works is counting the
  **pipeline**: `committed()` weights everybody heading toward the frame by how
  soon they will arrive, which takes the delay out of the loop, after which the
  simplest possible controller is enough. Do not replace it with something that
  reads only what is in shot.
- **A crossing group's exit has to be outside the cull line, not on it.** Put it
  on the edge and the group walks to it, arrives, and stops — the goal is
  reached. They pile into a stationary ring just off screen, the cull never
  fires, the population target is met entirely by people standing outside the
  frame, and the picture is empty at a mean speed of two centimetres a second.
- **And it has to be a _direction_, not a destination.** Aiming at the same
  lateral position on the far edge makes the streams parallel and pins every
  walker to the line they came in on, so nobody can drift into a file. Sorting
  measured _worse_ the longer it ran. The goal is two hundred metres away for
  exactly this reason.
- **The side preference has to be a fraction of the avoidance, not a force.**
  Written as a constant nudge per oncoming neighbour it was summed over everybody
  within four metres — a dozen people at half a person per square metre, and ten
  metres per second squared of sideways shove. Every scene read as a jam at
  densities that should have been free-flowing, and the runners were all demoted
  to walkers on their first frame.
- **Running is something somebody is out doing, not a speed they have reached.**
  `activity` was promoted and demoted from the current speed, and since everybody
  spawns at rest, every runner was demoted on their first frame and never given
  the run speed that would have promoted them back. `stats().runners` read zero
  at every setting of the slider. `Walker.runs` is the intent; `activity` is the
  state.
- **A gradient must not fade to `transparent`.** It is _black_ at zero alpha, so
  the interpolation goes through black and rings every blotch with a dark halo.
  The ground came out looking like a sheet of faint pressed coins. `Ground` has a
  `mottleOut` for this.
- **The crowd's lightness is pitched against the ground's**, not at an absolute
  value. Pastel heads at 70% on a ground at 70% are invisible at eight pixels
  across whatever their hue, and the frame came out as a field of shadows with
  nobody casting them.
- **Two dwelling groups given nearby spots do not sort it out.** Each holds a
  formation around its own centre, so they push into each other and keep pushing
  — a permanent ten-centimetre interpenetration, which is worse than a
  collision. `freeSpot` looks for somewhere free.
- **Nobody may materialise inside anybody**, and one placement attempt is not
  enough. At half a person per square metre a random point is more likely than
  not to be within arm's reach of somebody, and a pair needs both places free, so
  a single try succeeds about a tenth of the time and the frame stops filling
  long before the ground is full.
- **Density counts who is _in frame_.** The world is wider than the picture and
  at a small span the margin is most of it, so counting every walker met the
  target with people nobody could see. `stats()` reports both.
- **The group's fan-out is across the direction of travel.** Fanning along x
  regardless of heading put every group entering from the side into a single file
  pointing at its own destination, and they sorted themselves out sideways in
  full view.
- **The highlight must not encode a heading.** Pushed to where a sphere's really
  would be, and offset along each walker's own facing, it turns every dot into a
  little arrow and the crowd into a field of them. It is small, and toward the
  sun, the same way for everybody.
- **A walker who holds one speed for ever reads as a microbe, not a person.**
  Constant-velocity gliding is the single strongest tell at small sizes, and it
  is not fixed by any amount of avoidance quality. Three timescales answer it —
  a drifting personal pace, a group `Urge`, and yielding — and all three are in
  `crowd.ts` rather than in the renderer, because the problem is the motion.
- **The same is true of holding one heading.** `MEANDER` and the change of mind
  in `updateGroup` are scaled by `flow`, and `through` deliberately gets almost
  none of either: a crowd crossing a concourse _is_ on a mission, and blurring
  that costs the setting its point.
- **The side preference must be a fraction of the avoidance** — see the entry
  above, and note that everything added since has _weakened_ lane sorting.
  Sorting now rises by a few hundredths over three minutes rather than by a
  fifth. That is the model rather than a regression: files form out of people
  agreeing about which side to pass on, and a drifting pace, a group deciding it
  is late and somebody stopping dead are all disagreements. Do not tune the
  variability down to make the number look better.
- **`settling` is a fraction of the _crowd_, not of the arrivals.** The two
  differ by a factor of six, because somebody who stops stays about six times as
  long as somebody crossing. Applied to arrivals, a setting of 0.3 left three
  quarters of everybody in shot stationary and the park looked asleep.
  `stoppingChance` converts it; the conversion is Little's law run backwards.
- **The fill rate is a rate, and it is Little's law forwards.** Holding N people
  in shot needs N arrivals per however long each one stays. Both a cap below
  that figure and a cap far above it have been shipped here, and both were
  visible: below it, the frame settled at three people against a target of
  fourteen with the loop running flat out; far above it, the crossing scene sat
  58 per cent over and swung.
- **`walkers.includes(someone)` is a linear scan, and two places wanted it every
  frame.** Who somebody is chasing and who they are looking at both need to know
  whether that person is still here. At fourteen hundred walkers that was two
  million comparisons a frame for a boolean. `Walker.present` is the flag.
- **An exponential fade in eight bits does not reach zero.** `destination-out`
  at alpha `a` leaves `round(dst * (1 - a))`, so a pixel stops moving as soon as
  `dst * a` is under half a level: the decay has a **floor at `127.5 / a`**, and
  fading a six-second trail one frame at a time asks for an `a` of 0.7/255,
  which puts that floor at 127. The bright mark faded to a mid grey and then
  stayed there for ever, every path anybody had ever taken silted up, and the
  frame came out as the flat wash the fade exists to prevent — at a slowed
  clock the per-frame alpha rounded to zero outright and nothing faded at all.
  Nothing errored and the trail still looked like a trail for the first few
  seconds. Mean luminance of the frame between 45 s and 150 s is what says it:
  58 → 107 for the naive fade, 32 → 31 for the one in the file. The fix is to
  erase **one phase at a time** — one pixel in every tile, taking off everything
  that phase has owed since its last turn — so each erase is big enough to land.
  The residue that leaves is a couple of levels; it cannot be zero, and
  `ERASE_FLOOR` is where the trade between that residue and the grain is made.
- **The phase count must not chase the frame rate.** Changing it starts every
  phase's clock again, so a count that flips between two values with the frame
  time resets the clocks faster than they can run and the decay stops dead —
  the same bug wearing the fix's clothes. Hence the smoothed frame time and the
  factor-of-four band in `eraseTile`.
- **Drawing is the whole cost; the simulation is nearly free.** Measured at 330
  walkers: everything off, 60 fps; shadows only, 37; heads only, 34; both, 27.
  So the heads are about 11 ms and the shadows about 10, and the crowd itself
  does not show up. Optimise the renderer, not the model. A `Path2D` batch of
  the shadow strokes was tried and was _slower_ — measure before keeping.

## Invariants

Things that are true and must stay true. Each is checked.

- **Nobody walks through anybody.** Not a tendency: a promise, and the reason the
  contact resolution in `crowd.ts` is positional rather than a force. Forces can
  be outrun — two runners closing at 4 m/s cover 13 cm between frames.
  `stats().overlap` is the measurement, and the bound is a tenth of a shoulder
  width. It is not zero and should not be; at festival density people press.
- **Nobody exceeds what their legs can do**, whatever the forces say.
- **A child stays near the adult they came with.** The leash applies in every
  play state. It did not apply to _fleeing_, and one was measured twenty-one
  metres from its parent — which is not a game of tag.
- **The population holds near the density asked for**, and does not arrive in
  waves. See the transport-delay note above.
- **Reduced motion gets one still of a populated park**, not an empty field, and
  the loop is parked. No screenshot can tell a still park from a running one.
- **`playback` is applied in exactly one place**: the step handed to
  `crowd.step`. Everything time-dependent is integrated through it or reads the
  clock it advances.

## Which stats are computed when

`tests/AGENTS.md` explains why this matters — a field accumulated while _drawing_
goes stale in the window after a `set()`, and comes back as an ordinary
plausible number.

- Filled in **while drawing**: `heads`, `fps`.
- `clock` is the seconds of park simulated, and it is the only exact read of
  whether time is passing. It exists because `settle` was once capped at an
  eighth of a second and nothing else in `stats()` could tell: every other
  number is a property of a crowd, and a crowd that has not moved looks exactly
  like one that has.
- Computed in **`stats()`**: `walkers`, `inFrame`, `groups`, `children`,
  `sitting`, `runners`, `yielding`, `unsteady`, `playing`, `meanSpeed`,
  `sorting`, `area`, `running`.
- Written during **integration**: `overlap` and `contacts`, which are the
  previous step's. Prefer `settle()` to a frame wait for those, per the third
  case in `tests/AGENTS.md`.

## Obstacles, and what is not built

There is nothing to walk around yet, and the ground is open. **The steering
already handles it**: an obstacle is a disc that is not moving, `timeToCollision`
against one is exactly the τ it already computes, and the contact term already
refuses to let anybody inside it. `Crowd.obstacles` is the empty list they go in.

What is missing is everything else — what a tree or a pond looks like from
above, how they are placed, and how a goal on the far side of one is reached
when the straight line is blocked (the steering will slide people around a
convex obstacle and will get them stuck in a concave one; a real pathfinder is
the honest answer and is not written).

Hide and seek waits on the same thing, since it needs somewhere to hide.

## Where the numbers came from

Stated in `body.ts`'s own header, with the derivations. The short version:
stature from the usual anthropometric means, head breadth scaled by stature to
the power 0.23 (derived from head circumference at age three against an adult's,
not picked), cephalic index 0.78, bideltoid breadth 0.259 of stature, leg length
0.53, step length 0.41 at preferred speed, preferred speed through a fixed Froude
number of about 0.2, head oscillation 4.5 cm vertical and 4 cm lateral.

The anticipatory avoidance is the observed 1/τ² interaction law with an
exponential cutoff; its gradient is worked out in `steering.ts` rather than
approximated, because the direction is the part that matters and "push away from
them" is exactly the model this is not.
