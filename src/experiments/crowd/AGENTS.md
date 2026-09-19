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

- **`MAX_PEOPLE` caps the world.** The world is a disc that travels with the
  observer, sized by whichever is smaller: where the fog has taken a head below
  half a per cent (`horizonFor(fade)`), or the radius `MAX_PEOPLE` of them fill
  at the current `density`. In every scene that ships, the budget is the binding
  one.

  So **`fade` and `density` are not independent**, and the coupling is the one
  thing about this piece a reader will not guess. A scene asking for a long
  distance over a dense crowd cannot have the depth it asked for, and the crowd
  ends somewhere a visitor can see it end. `stats().edge` is how bright a head at
  the boundary still is; anything over about 0.03 is visible. The rule of thumb
  is `fade ≤ 1.5 · sqrt(MAX_PEOPLE / density)`, and every preset sits at 0.022 to
  0.026.

  **Do not disguise it by fading the last stretch out.** That was the obvious fix
  and it is the wrong one: it would make a scene that cannot afford its depth
  look exactly like one that can.

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

## The frame, in numbers

Measured headless with no GPU, at 1600x1000, which the section notes is
pessimistic in absolute terms and trustworthy in ratios.

| density | fps |
| ------- | --- |
| 40      | 60  |
| 75      | 60  |
| 95      | 53  |
| 120     | 17  |

`density`'s track stops at **100** because of the cliff between those last two
rows, not because 120 is an uninteresting crowd. The cost is the anticipation:
every person inside `DETAIL` against every neighbour, every step, and the count
of those goes as the density.

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
