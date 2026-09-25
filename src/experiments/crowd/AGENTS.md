# Crowd — notes for agents

A first-person walk through a crowd. White circles on black, nothing else in the
world: no ground, no bodies, no sky. Read `../AGENTS.md` and `../CONTEXT.md`
first; this file is only what is particular to this piece.

## The one thing to understand before changing anything

**There are two people in this piece and one of them is the camera.** `throng.ts`
is the crowd; `stroll.ts` is the person carrying the view. They run the same
avoidance against each other, which is the brief's own sentence — "we have to
negotiate the crowd without running into each other" — and it is the difference
between a walk and a vehicle driving through a crowd that parts for it.

The consequence worth holding on to: **`course` is derived and `yaw` is not the
same thing.** The body goes where the negotiation puts it. The head points where
it is looking. Anything that sets `course` directly has removed the negotiation.

## The camera is bolted to the body, so the body's facing is a camera problem

Two reports, one line of code, and the same mistake twice: **the facing tracked
the velocity.**

- **"Strange jitter… in video games that usually indicates collisions."** It was
  not the collisions. `course` chased `atan2(vy, vx)` through a hard rate limit,
  and the instantaneous velocity is being shoved about by up to 7 m/s² of
  avoidance — more than two degrees of direction per 1/120 s step. A rate
  limiter has no inertia; it clips a jittering target instead of filtering it.
  Measured: the turn direction reversed on 14% of steps, a 15 Hz shake, with the
  rate pinned at its 115°/s cap in all three scenes.
- **"I'm trying to work out if there's strafing."** There was none, by
  construction: if the facing _is_ the direction of travel then the two can
  never differ. Median offset 1.4°, 90th percentile under 8° — in a seven-metre
  corridor, where stepping sideways is the only way past anybody.

Both fixed by the same change of subject. The body faces **the line it means to
walk**, sprung rather than rate limited, and the crowd displaces it off that
line — which is what a sidestep is. `STRAFE_LIMIT` is where it stops being one
and the shoulders come round.

| scene      | facing rms    | reversals    | strafe p90   |
| ---------- | ------------- | ------------ | ------------ |
| market     | 26.8 → 3.3°/s | 8.6% → 0.9%  | 4.9° → 10.8° |
| concourse  | 23.9 → 2.9°/s | 12.8% → 1.2% | 3.8° → 7.8°  |
| the street | 35.8 → 9.8°/s | 14.1% → 1.4% | 7.6° → 11.0° |

**The general lesson is the one the neck already taught**: a rate limit and a
spring are not two settings of the same thing. A limit clips and leaves the
clipped shape; a spring filters. Anywhere this piece points a camera at
something that moves, it wants the spring.

## A mechanism nobody has seen fire is a claim, not a mechanism

The section says this about checks. It is just as true of the code, and this
piece has now done it: the body was supposed to turn when the neck ran out of
range, written as `if (Math.abs(yawOffset) > NECK_LIMIT)`. But `yawOffset`
springs toward a glance target that is **already clamped to `NECK_LIMIT`**, and
the spring is critically damped, so it never overshoots and the branch was
unreachable.

The result was a walk in a straight line. Measured over five minutes of the
market: thirty-two stops, and the median change of heading across one of them
was **1.1°**, the largest 2.9°. Everything else was a slow aimless drift of about
±30° that wandered back to where it started. Both the note and this file claimed
the behaviour, and nothing anywhere contradicted them — it took Andrei asking
"am i always moving in the same direction or do i ever turn" to find it.

**What is worth copying is not the fix but the shape of the bug**: a conditional
whose guard is bounded by the same constant that bounds its subject. Anywhere
this piece clamps a value and then tests it against that clamp, the test is
dead. Grep for `NECK_LIMIT`, `STRAFE_LIMIT`, `PITCH_UP` and `MAX_ACCEL` before
adding another.

A stop changes direction now, and the trigger is the one a market actually uses:
you look at something and then go to it. The corridor is the control — in a
seven-metre street the pull toward its line beats the glance and the heading
stays inside a few degrees, which is what walls are.

## The gaze has two axes and a subject

- **`pitch` is a bias, not a lock**, and holding the vertical fixed while the
  horizontal wandered was half a head movement. The glance target is computed as
  an _absolute_ angle and then taken back to an offset from the bias, so a face
  at eye level cancels the bias instead of adding to it. Glancing at a person
  aims at **their head**, which means looking at a child is looking down by
  exactly as much as a child is shorter — free, and the kind of thing this piece
  should get for free.

- **A hold shorter than the neck's settling time is a movement the head never
  completes.** The ground glance reused the 0.15–0.5 s walking hold against a
  neck that settles in about half a second, so a look aimed 22° down measured 8°
  and the vertical wander barely existed. Each kind of look now has its own
  hold. If a glance ever looks like it is not arriving, check the hold against
  `NECK_OMEGA` before touching the amplitude.

- **A companion is placed to be at the edge of vision, not squarely beside.**
  Two people walking and talking are abreast, and abreast is 90° off your line of
  travel — past what a neck holds and outside the frame at any sane field of
  view, so a companion there is somebody you can only see by turning your whole
  body. About 40° and a metre away is inside the frame's corner: there without
  being looked at, and centred by a glance.

- **The gaze invents its subjects, and that is the mechanism rather than a
  workaround.** "We're only drawing heads. if we only followed things that are
  there, we'd only be following heads. we want to follow birds, rocks, etc. So
  sometimes we need to invent a thing to look at (and not show it)."

  About two glances in five go to a point in the world with nothing rendered at
  it — 9% overhead and moving, 30% on or near the ground. **Do not "fix" this by
  restricting the gaze to drawn objects.** In a piece whose only object is a
  head, that produces a gaze that tracks heads and nothing else, which is the
  renderer's gaze rather than a person's. If something ever _is_ drawn up there,
  the invented subjects stay: a person looks at more than a piece renders.

- **A companion is for perspective, and that bounds how much to build.** "Just
  having some companions provides perspective. because i see what i 'see',
  having a companion makes it look somewhat like a third person view." A head at
  a known size, a known distance and a steady place is a reference the rest of
  the picture can be read against, and a first-person view has nothing else
  playing that part.

  **A shuffle was built and deleted**: six stations including two behind, traded
  every 7-22 seconds, so people drifted ahead, fell back and overtook. It worked.
  It earned nothing — "we don't need to overdo the constellation modeling… i
  don't think they add any value" — and a companion behind you is no reference at
  all, because you cannot see them. Three fixed stations, all in shot.

  **Fixed does not mean static, which is the thing that made it safe to delete.**
  Measured against their own stations, companions sit 0.18 m off at the median
  and swing to 0.87 m: the crowd jostles them, the formation is a spring rather
  than a clamp, and they bob with their own gait. At a metre away half a metre is
  ±27° of movement in frame. The shuffle was adding motion to something that was
  already moving.

- **Companions are taken from the crowd rather than made specially**, so they
  are ordinary people with ordinary heights and gaits — which is what stops them
  reading as a different kind of object from everyone around them, and is why
  you can end up walking with a child. What makes them companions is that they
  keep station in the observer's frame and are never re-entered at the boundary.

## Traps, each of which happened

- **`height` is a stature, not an eye height, and it cost the whole framing.**
  The setting was eye height for an afternoon, so `1.70` meant a person 1.82 m
  tall — taller than nine adults in ten — and every preset built on it put the
  entire crowd below the horizon. **Nothing about the picture said so.** It read
  as a crowd of short people, which is a thing crowds can be. Eye height is
  `EYE_RATIO` of stature, in `body.ts`, and the gap is 11 cm.

- **There is no contact term, and the reasoning that would put one back is
  written out in `steering.ts` so nobody has to re-derive it.** An overlapping
  pair is handled by the anticipation: `timeToCollision` returns 0 rather than
  something unusable, the closest-approach direction collapses to the line
  between them, and `TAU_FLOOR` makes the shove firm. A contact term was added,
  measured against a control across all five scenes, and found to leave the
  **worst overlap identical to three decimal places** in every one. Do not put it
  back without a measurement that says it does something.

- **`entryAngle`'s obvious justification is false and its real one is a
  measurement.** The first version of this file said a uniform re-entry angle
  drains the crowd from the side you are walking into. It does not: the uniform
  version is self-correcting, because anybody put back on the wrong side is
  already leaving and is simply re-entered again. The density is identical. What
  the derivation buys is **2.35x fewer re-entries** — 99 a second against 232 —
  and that is what `tests/unit/crowd/throng.test.ts` guards it on.

  **The cost of getting this wrong was a check that could not see its subject.**
  "Does not thin out on the side it is walking into" was written to guard
  `entryAngle` and passes against a broken one. It is still a good check of
  everything else about the disc; it simply never covered the thing it was named
  for, which is the shape the root `AGENTS.md` lists first.

- **The spatial hash holds indices, so anything that shrinks the crowd has to
  rebuild it — and getting that wrong is a crash, not a stale neighbour.**
  `stroll.step` runs _before_ `throng.step` and reads the hash from the previous
  step, so a `restock` that pops anybody leaves the observer dereferencing people
  who no longer exist on the very next frame. It reaches the page from an
  ordinary drag of the density slider, in the shrinking direction only.

  **No unit test here shrinks a crowd**, which is why the whole unit suite was
  green through it; the browser spec's settings round trip caught it. That is the
  division of labour working, and worth keeping in mind when adding a check: the
  unit tests build a crowd and walk it, and almost never change it underneath
  itself.

- **A statistic over the crowd has to say what it does with people who are
  standing still.** The counterflow test measures how often neighbours agree on a
  direction, and its control failed at 0.38 against an expected 0.5 — which sent
  this session after the random number generator. The primary has 22% of the
  crowd standing, `Math.sign(0)` matches no walker, and `0.22² + 0.78²/2` is
  0.353. **The control was working and the expectation was wrong.**

- **The pitch is a rotation of the camera frame, not an offset of the screen** —
  and **two points at eye height cannot tell the two apart.** For them the
  rotation reduces exactly to `focal · tan(pitch)`, the same number at every
  distance, so a test built on those passes either way. What discriminates is two
  points at different heights and the same distance.

- **Everything behind the eye must be refused, after the pitch rather than
  before.** A negative depth divides to a _mirrored_ position in front of the
  camera, so the crowd behind you is drawn across the crowd ahead of you, at
  plausible sizes in plausible places.

## The two budgets, which are the piece's real shape

Both are ceilings on the frame, both are stated, and both are reported.

- **`reach` sizes the world and `MAX_PEOPLE` caps what it can afford.** The
  world is a disc of radius `reach`, intersected with a corridor of width
  `width`, travelling with the observer. `stats().budgeted` says whether the
  budget cut it short of what `reach` asked for.

  **`fade` used to size it, and that was the mistake.** Tying how far you can
  see to how many people exist made a long view and a dense crowd mutually
  exclusive, and the piece paid for depth by washing out the near layers —
  reported as "distance appears to introduce linear fog; more clarity needs to
  be preserved in the closer layers". They are two questions. `reach` is how far
  people are, `fade` is how far you can see, and neither constrains the other.

  **The affordable radius is bisected, not solved.** It used to be
  `sqrt(MAX / (perM2 · π))`, the answer for a full disc, which is wildly wrong
  once there is a corridor: a 7 m street holds a fiftieth of the people a disc of
  the same radius does, so the disc formula clamped a street to a tenth of the
  reach it could easily afford.

- **A crowd that visibly ends is now a choice, and this reverses a decision
  recorded here yesterday.** That entry said the far edge must be hidden by the
  fog and that fading the last stretch out to disguise it was the wrong fix. The
  second half still holds. The first no longer does, because the reason has
  changed: the edge used to sit at an arbitrary distance nobody chose, imposed by
  the budget, and now it sits where `reach` puts it. A crowd that runs out at
  80 m with empty ground behind it is a thing Andrei asked to be able to build.

  `stats().edge` is still how bright a head at the boundary is, and it is still
  the number to read — but the threshold is no longer 0.03. Checked by eye at
  0.076 and 0.108, neither shows a wall, because the far heads are sub-pixel and
  merge into the band before the boundary reaches them. **The test's ceiling is a
  backstop, not a claim that everything under it looks right**; that question is
  visual and the check cannot see it.

- **`DETAIL` caps the avoidance**, and is derived rather than guessed: nobody
  outside it avoids anybody. The force is cut off at `CUTOFF` seconds in
  `steering.ts`, and the fastest pair this piece can produce closes at the top of
  the pace band plus the top of the observer's. Four seconds of 5.2 m/s is 21 m,
  so 24 m skips no encounter that had begun. **Raising `BOUNDS.paceHigh.max` or
  `BOUNDS.walk.max` without raising `DETAIL` breaks that**, and the test says so
  in arithmetic rather than in prose.

  Its visible consequence: past `DETAIL` the crowd interpenetrates freely and
  carries those overlaps in as the observer walks. That is why `stats()` reports
  **`overlapsSeen`** as well as `overlaps` — the far ones are invisible and the
  near ones are not, and a check on the total would pass a piece that was
  visibly broken. Measured at 0.02–0.19 pairs a step within eight metres.

  **Its other consequence is a density step at the radius, and it is left
  alone.** Anticipation reaches four seconds ahead, which is a long-range
  repulsion, so the crowd inside `DETAIL` relaxes outward and the surplus sits
  just beyond it: 214 people against 286 over equal areas either side. A circle
  at a fixed distance projects to a fixed height in the band, so in principle
  that is a horizontal seam that never moves however far you walk.

  It was chased. Fading the force out over the last nine metres — the standard
  treatment for a truncated potential — made it very slightly **worse**, 0.714
  against 0.747, so the step is not the truncation and that change was reverted
  rather than kept for its story. Then a render was looked at: there is no seam,
  because at 24 m a head is two pixels and the band is already a continuum. It is
  recorded here rather than fixed because the fix would be to run the
  anticipation everywhere, which is the whole frame budget, for something nobody
  can see.

## The corridor

`width` confines the crowd laterally, and three things had to change together
for a street to read as a street rather than as a square with a stripe in it:

- **Sample within the corridor; do not clamp into it.** Clamping does not discard
  the points outside, it stacks every one of them on the two boundary lines. A
  4 m corridor in a 113 m world rejects 96% of disc samples, so 96% of the crowd
  was placed on two lines with nothing between them — 33 heads reached the screen
  out of 632. `corridorPoint` in `random.ts` samples the chord properly.
- **The walls are soft and one-sided**, so the ground reads as running out rather
  than as a barrier being hit — and the observer gets the same wall, or they walk
  out through the side of the street and watch it go past from the verge.
- **The observer walks _along_ the street.** Free wandering is right on open
  ground and wrong the moment there are walls: in a seven-metre corridor it had
  the observer walking diagonally into the side, so the channel receded off the
  edge of the frame instead of down the middle of it. The pull toward the
  corridor's line grows as it narrows and is nothing at all on open ground.

**Laterally the corridor is fixed in the world, not carried with the observer.**
One that followed them sideways would keep them permanently down its middle,
which is not what walking along a street is like.

## The frame, in numbers

Measured headless with no GPU at 1600x1000, which the section notes is
pessimistic in absolute terms and trustworthy in ratios. The cost is the
**anticipation**, not the draw and not the population: `avoiding` barely moves
as `reach` grows, because the far crowd only advects.

| scene                                         | people | avoiding | ms per second of walk | fps |
| --------------------------------------------- | ------ | -------- | --------------------- | --- |
| density 48, reach 40                          | 2,413  | 914      | 314                   | 60  |
| density 48, reach 70                          | 7,389  | 822      | 387                   | 60  |
| density 48, reach 110 (budget-capped at 96 m) | 14,000 | 879      | 556                   | 38  |
| density 12, reach 200                         | 10,691 | 209      | 193                   | 60  |
| density 35, reach 120, width 8                | 632    | 141      | 35                    | 60  |

`MAX_PEOPLE` is **9,000**, between the last two rows that still hold 60 fps and
the one that does not. **A corridor is nearly free** — its ground area is a
fiftieth of a disc's — which is why a street can have a reach a square cannot.

`density`'s track stops at 100: 60 fps holds to 95 and falls to 17 by 120.

Two things bought the headroom, and a third is in the code that did not:

- **`Math.sqrt` of the sum, never `Math.hypot`**, in anything inside the step
  loop. `hypot` guards against an intermediate overflow on numbers this piece
  cannot produce.
- **The gait is only advanced inside `DETAIL`.** `cadence` costs a `Math.pow`,
  and a head's rise at 24 m is six tenths of a pixel. A frozen phase resumes
  where it was left and phase is arbitrary, so the boundary is invisible.
- **One `fill()` per brightness, not one per head — and this is the one that
  did not.** `draw.ts` batches by a logarithmic alpha bucket, 108 fills for 1,200
  heads. Its docblock claimed one fill per head would be "several frames' worth
  of work"; measured with `stats().drawMs` it is **1.50 ms against 1.09**, a 27%
  saving on a draw that is a fifteenth of a frame. Keep it — four lines, and it
  scales with the head count rather than against it — but **do not come here
  looking for headroom.** The frame is the anticipation, by an order of
  magnitude.

  The general lesson is worth more than the number: **`fps` cannot answer any
  question about the draw**, because a loop capped by the display reports 60
  whether a frame paints in 1 ms or 10. Every "this made it faster" in this
  section wants a stat that is not `fps`.

**The step stays at 1/120.** 1/60 is exactly half the cost and was measured: it
opens overlaps of up to 13 cm in the densest counterflow where 1/120 keeps
`closest` at zero. The saving is real and it is not worth that.

## The settles, which are wall-clock somebody waits

`settle()` is synchronous, and costs roughly a third of a second per second of
walk at a market's density. Three surfaces want it and only one can afford it:

| surface              | seconds of walk | why                                           |
| -------------------- | --------------- | --------------------------------------------- |
| `poster.ts`          | 45              | offline, in the capture script                |
| reduced-motion still | 2               | a page load, for the audience asking for less |
| the note's backdrop  | 4               | a page load, behind a sheet of text           |

The still and the backdrop were 25 and 45 and were an eight- and nine-second
freeze on a page load. What made the short ones acceptable is that **`restock`
now places nobody inside anybody** — rejection sampling against a grid built as
it goes — which is most of what the long settle was buying. What a settle still
buys is structure, and **a still cannot show structure that is defined by
motion.**

## Stats: which are computed and which are filled while drawing

The distinction `tests/AGENTS.md` asks every piece to state, because a stat
filled during the draw is stale until a frame has run and comes back as an
ordinary plausible number.

- **Filled while drawing**, so wait a frame after a `set()`: `drawn`, `fills`,
  `largest`, `drawMs`, `fps`.
- **Computed in `stats()`**, so good immediately: everything from the crowd —
  `people`, `avoiding`, `world`, `edge`, `children`, `grouped`, `closest`,
  `overlaps`, `overlapsSeen`, `nearest`, `clock`, `reentries` — plus `me`,
  `budget` and `running`.

`closest` and `overlaps` are **per step**, not cumulative, so a single read is
one instant of one step and a single unlucky pair moves it a long way. Average
over a run, the way the tests do; a one-shot read of `closest` sent this session
chasing a regression that was one pair.

## Landmarks: considered, declined, and the reason is the piece

**Nothing is above the band, and adding something would cost the thing the piece
is.** Andrei, asked whether the empty sky was a gap: "it's a 'brief' because
nothing was specified to be there, so it's empty as expected. adding landmarks
would probably add more character to the scene, but it would also break up the
'moving infinity' that is presented."

That phrase is his and it is the clearest name anything has for what this does.
The crowd has no edge and no landmark, so **there is no fixed point to measure
progress against and the walk cannot arrive anywhere.** A tower, a building
line, a horizon feature — any of them would give the eye something to hold, and
not holding is the whole effect. It would also make the observer's wandering
legible as _going somewhere_, which it is not.

So this is a rejected approach rather than an unbuilt one. If it is ever
revisited, the thing to preserve is that no landmark stays in frame long enough
to be navigated by.

## The structured crowd: a lining, a path, teams

Added 2026-09-25 for the parade, teams and trail scenes. **Everything in it is
off at the values every older preset states** — `lining: 0`, `bend: 0`,
`climb: 0`, `team: 0` — and the old placement and re-entry are kept verbatim
for that case (`structured` in `throng.ts`), because every measurement in this
file was taken on them. Do not generalise that branch away without re-measuring.

- **Watchers are a role, not a mood.** A watcher is always standing, is only
  re-entered into the lining, and is held there by walls on both sides. They
  are sorted to the end of `people`, and two things depend on it: a group is a
  contiguous run of walkers, and companions are the first few people. Anything
  that reorders `people` in a lined scene has to keep that partition.
- **A heading is held in the path's frame.** `desired()` turns it onto the path
  at the person's `x`. On a straight path that is the identity and is skipped.
- **On a narrow trail the walls steer everybody round the bends on their own**,
  so "is the crowd moving along the path" cannot tell the rotation from its
  absence — that check was watched passing with the rotation deleted. What the
  walls cannot do is spread people across the way: a crowd shoved round a bend
  rides its outside edge. `tests/unit/crowd/structure.test.ts` asserts on that,
  0.47 of the half-width from the centre with the rotation against 0.64 without.
- **On level ground a winding trail is invisible from inside it.** Every head
  is within a metre of eye height, so the whole line collapses onto the horizon
  and its bends are only a spread from left to right. That is why `climb`
  exists: relief lifts the far bends off the horizon. The ground is added to the
  eye and to every head, and nowhere else — the simulation is still 2D.
- **`effort` is Tobler's hiking function and it takes a minute to show.** The
  concertina — density on climbs over density on descents — was 1.3 at forty
  seconds and 2.1 at seventy-five, against 0.8 with it off. A shorter test would
  read the mechanism as weak.
- **Past three companions the slots are a team block with me in the back row**
  (`teamSlots`), which keeps the rule above: nobody behind me. `companions`'
  address slot was retired and re-appended when its range grew from 3 to 15.

## What is not here, and would be worth having

- **Nobody is going anywhere in particular.** People carry a heading, not a
  destination, so nothing walks up to something, waits, and leaves. The standing
  people are standing where they happened to be.
- **Nothing to walk around.** The avoidance already handles it — an obstacle is a
  disc that is not moving — but nothing is placed.
- **A head gives away nothing about which way it is turned**, so the most legible
  thing in a real crowd, the moment somebody looks at you, is missing from a
  piece that is otherwise entirely about being looked past. Whatever answers that
  is a change to what a head _is_, which is the brief's own constraint, so it is
  Andrei's to decide rather than the writer's.
