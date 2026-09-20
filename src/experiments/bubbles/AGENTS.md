# Bubbles — notes for agents

Read `seed.md` first. It has Andrei's own words for what this is, which is the
only thing that says what the piece is _for_; everything below is what it cost
to build.

## The premise is a constraint, and it is load-bearing

White circles, black water, nothing else. A viewer can see the foam and cannot
see the water, so **every reading of the flow is inferred from how the dots
move**.

That is demanding in a specific way: a picture made only of moving dots is one
where the field has to be worth inferring. Anything lazy in the flow shows up
immediately as dots behaving like dots. Two rules follow, and both have already
been paid for once:

- **The background flow must be divergence-free.** It is the curl of a noise
  potential, not a vector of noise. `water.ts` has the full reasoning; the short
  version is that a raw noise velocity has fixed sinks, foam drains into them
  permanently, and the piling-up reads as a texture rather than as water.
- **Nothing may have a path or a lifetime curve.** There is a velocity field, a
  rule for two bubbles touching, and a rule for one letting go. That is all
  there is, and adding a curve anywhere would be the easiest way to lose the
  piece.

## The trap that cost the most: the frame was three metres wide

The first build put `span` at 1–6m with a default of 3. It typechecked, it
rendered, it passed everything, and it was **wrong in a way a screenshot would
have shown and the numbers showed first**:

- a 6mm bubble at 3m across a 1280px window is 1.3px of radius;
- 0.5% of the screen was lit;
- `biggest` plateaued at 14mm against a `popSize` of 50mm, so **nothing ever
  burst** — one of the three mechanisms the piece is made of never ran, and the
  picture gave no sign of it.

The framing is not a taste question here, it is a scale question: a jacuzzi
bubble really is 3–10mm, so the frame has to be **tens of centimetres** for one
to read as a circle at all. `span` now runs 0.3–4m and the primary sits at 0.9m.

**The general lesson, which is the section's already:** assert on numbers. Check
`stats()` for `biggest` actually exceeding `popSize` after settling — if it does
not, the coalescence and popping mechanisms are both dead and the tub is a
scatter of specks that looks superficially fine.

## `spread` is a length, and was briefly a fraction of `span`

For about an hour `placeJets` computed `spread * span`, so dragging `frame`
moved the jets apart instead of stepping the camera back — no two framings of
one scene were the same scene. `placeJets`' own docblock claimed the opposite at
the time, which is the shape worth noticing: **a docblock asserting the
behaviour you meant rather than the behaviour you wrote.**

Everything in this piece is in metres of real water. `span` is the only camera.

## Every preset value has to sit on its control's grid

Eighteen of them did not, on the first pass — `0.45` against a `0.02` step,
`0.035` against `0.002`, `0.0006` against `0.0005`. Round numbers, all of them,
and all off a grid whose step is not a power of ten. It surfaced as
`experiments-urls` failing on `DEFAULT_SETTINGS` rather than as anything about
presets: the scene did not survive its own address.

**Snap them; do not widen the grid.** `FINER_GRID` exists for a scene recorded
before its control was cut as it is now, not for a value somebody typed. The
mechanical fix, which takes a minute:

```
# with a preview running
experiment.preset(n)   // returns the value AFTER normalizeSettings
```

Drive the piece once, take `get()` for each preset, write it back into
`settings.ts`. No judgement is involved and nothing about the scene moves further
than one grid step. Section-wide, this is #201.

## `settle` is not optional, and three surfaces depend on it

The surface is **empty at t=0** and the size range the settings describe is
_earned_: a bubble can only grow by meeting another, so it takes twenty to
thirty seconds of jets before the tub holds what the numbers say. All three
surfaces that read the primary hit this together, and all three would otherwise
show a black rectangle or a field of identical specks:

- the captured poster — `poster.ts` settles through the recipe's dwell;
- the note's backdrop — `about.astro` calls `settle(24)`;
- the reduced-motion still — `bubbles.ts` runs `STILL_SECONDS` before drawing.

**The picture does not accumulate**, so no frames have to be _drawn_ into it:
`trail` is 0 in the primary and every circle is drawn whole each frame. If a
scene with a wake is ever promoted to first, that changes and the recipe has to
say how many frames — see the posters section of `../AGENTS.md`.

## The contact grid's cell must hold the largest pair

`rebuildGrid` sizes its cells from the **current** largest radius, not from
`birthMax` or from `popSize`. Both of those are wrong: coalescence has no hard
ceiling, so a bubble can be several times `popSize` before its hazard catches up
with it, and a cell smaller than a pair's reach makes the 3×3 sweep silently
miss contacts. The symptom would be big bubbles that stop merging — which reads
as a tuning problem and is not one.

`MAX_CELLS` caps the allocation for a scene with tiny bubbles in a wide frame.
Hitting that cap coarsens the grid, which costs time and never correctness.

## Popping is a hazard rate and must stay one

Past `popSize` the chance of bursting climbs with the _square_ of the excess. A
hard ceiling is the obvious alternative and it makes every large bubble the same
size, which is the tell that a number rather than a process is in charge. With
`popRate` at 0 coalescence runs away on purpose — within half a minute the tub is
a handful of enormous circles — and that is a legitimate scene, not a bug.

## `hue` reaches nothing a visitor sees in the picture

The water is black and the bubbles are white, exactly. `hue` tints the chrome and
the note and that is all, which is stated in its own hint so nobody drags it
looking for an effect. It is still a real setting, so `experiments-presets` is
satisfied without the `kit-opt-out(hue):` escape.

**`about.astro` reads `bg: "#000"` rather than turning it from the hue**, unlike
every other piece's note. That is the piece, not an oversight: a tinted ground
behind the sheet would be a second opinion about a colour this piece has decided
it does not have.

## The registry has already been retired once, and it is the worked example

`rate` topped out at 400 bubbles a second in the first build, and measuring said
that was the binding constraint: at 8 jets and 400 the population reached 1,491
against a cap of 6,000 and the frame rate never left 58. So the ceiling was
raised to 1,500 — which **9 bits cannot hold**.

The slot was not widened. It is marked `retired: true` and left exactly where it
is, and a new slot with the same key and 11 bits is appended at the end. Later
slots win, so an address carrying both ends up with the new value, and every
address written before the change still decodes through the old slot.

**Expect `tests/unit/experiments-address.test.ts` to fail on this, and read the
diff before updating it.** A retirement is the one in-place edit the rules allow,
and the snapshot cannot tell it from an illegal one — the whole line changes,
from `rate num grid=1 origin=2 bits=9` to the same with `RETIRED` on the end.
What makes it legal is that `grid`, `origin`, `bits` and the slot's _position_
are all untouched. If any of those moved, the check is telling you something.
Section-wide, that gap is #208.

## The correction that reshaped the piece: a jet is at the bottom

**The first build had one field doing two jobs**, and it was wrong in a way that
typechecked, passed everything and looked plausible. A jet's outflow decided both
where a bubble was born _and_ how fast it then skidded across the surface. Andrei
named it in his first round of feedback and `seed.md` has his words; the short
version is that those are different mechanisms and only the second one is water.

A bubble leaving a nozzle quickly does not skid across the surface. It floats up
to it. The jet decides **where** it appears; the surface current decides **where
it then goes**, and that current is much gentler because the push has spread over
the whole depth on the way up.

So:

- `emit` scatters births across the **plume's footprint** with a Gaussian spread,
  and gives each bubble the velocity of the water it arrives into — nothing of
  the jet's own.
- `flow` uses the **boil's** width, not the nozzle's, and attenuates the jet.

**Do not reintroduce a birth velocity from the jet.** It is the single change
that would undo the piece.

## `surfaceFade` is derived, and its first version was not

The attenuation is `core / boilRadius()` — the ratio of the nozzle's width to
the boil's. A round turbulent jet conserves momentum flux while spreading over a
cone, so `u² × area` is constant, area goes as width squared, and the speed falls
exactly as the width grows.

**The first version was `1 / (1 + depth / 0.5)`, invented to look like a falloff,
and measuring caught it.** Across the entire range of `depth` it moved the foam's
mean speed from 318 mm/s to 164 — a factor of two — while the docblock beside it
claimed "the whole of deep water does not move violently at the surface". The
derived form gives about nine times at the same settings and ties the falloff to
`core` and `plume`, which is correct: a wider nozzle carries further, and a jet
that fans out harder gives up its speed sooner.

**`stats().speed` exists because of this.** "The surface moves too fast" is a
claim about a number and the piece could not report that number, so the only way
to check it was to look — which is the thing this section says not to rely on.
The useful derived figure is _seconds to cross the frame_, `span / speed`: the
primary is about eleven, and the presets Andrei called too fast were under two.

## Gas is a quantity, not a count, and that is a growth-path fix

`gas` is square centimetres of bubble surface per second. It was bubbles per
second, and that silently broke the only way anything grows: halving the born
size quartered the foam's coverage, encounters became rare, and small bubbles
could never coarsen. The symptom Andrei reported was "if I bring down the top
bracket I never see big bubbles even if the little ones collide" — which reads
as a tuning complaint and was a mechanism that could not run.

**The emitter has a birth ceiling per jet per step** (`made < 400`). Without it a
large flux with a tiny born size spins tens of thousands of iterations inside one
frame, which is a freeze rather than a busy tub.

## Below `pop at` the hazard is exactly zero, so `fragile` is the other death

Nothing made a large film shorter-lived than a small one, so a bubble born big
just sat there. `fragile` scales the drain rate with radius, which is what
gravity does to a wide film. The useful consequence is that growth costs
something and the foam settles where coalescence and drainage balance, instead of
running away.

## The noise cost is in the corner hashing, not in sampling per bubble

`rolling boil` fell to **12.8 fps**, and the obvious suspect — the contact sweep
— was the wrong one. Isolating inside one run said so: churn off gave 53 fps,
contacts off gave 17.4.

`hashSeed(seed, ix, iy, iz)` is four rounds of an avalanche mixer and `noise3`
needs it **eight times**, once per cube corner. `water.ts` now builds a
permutation table once per seed, which makes the same decision in three array
reads: 12.8 → 36 fps with nothing else changed, and 50 after the scene was
trimmed.

**Sampling per bubble was still the right shape** — it is exact at any eddy size
where a grid has to be sized for the smallest one the control offers. The first
version got the constant wrong, not the choice. If this ever needs to go faster
again, the next cheap thing is analytic gradients instead of four finite
differences, not a grid.

## The contact grid sizes cells from the typical bubble, not the largest

One 52mm bubble used to force a 12cm cell on everybody. Each bubble is now
entered into every cell its own reach covers, so the big ones pay for themselves;
`seen` is the stamp that stops a pair sharing several cells being jostled twice.
This was not what made `rolling boil` slow — see above — but it was a real flaw
found while looking for it.

## Tearing, and why one mechanism answers three complaints

Andrei's second round said big bubbles formed in the middle of each boil, that a
big bubble born big lingers, and that a big pocket of air never arrives as one
bubble. Those are the same finding: **there was nothing in the piece that stopped
a bubble being large**, and the boil is where the foam is densest, so the biggest
bubbles necessarily formed in the one place a real tub never has them. No amount
of moving the births could have fixed it.

`stableAt` is the answer — the harder the water is worked, the smaller the bubble
that survives it, which is the Kolmogorov–Hinze scale. It caps birth size without
anybody declaring one, keeps the boil to fine foam, and pushes the big ones out
into the calm.

**Two things it needed before it worked:**

- **Hysteresis.** Tearing cut a bubble to exactly the limit, so a merge that
  landed just over it was torn straight back apart: measured at **200,000
  tearings among 5,000 bubbles in ninety seconds**. It tears only past
  `limit * 1.2` now.
- **Worked water must refuse coalescence too.** Films need a moment of quiet to
  drain and rupture between two bubbles, and a boil does not give them one. Until
  that was in, the place bubbles were torn apart fastest was also the place they
  were joined fastest — a treadmill in the arithmetic and a waste of a frame on
  screen. `worked[]` carries the agitation from the step loop into the contact
  sweep so neither samples the field twice.

`stats().bigOut` is mean radius outside a boil over mean radius inside one. Above
1 is the property the piece is supposed to have. Its first version compared
above-mean with below-mean bubbles by distance and was too blunt to steer by —
with a skewed distribution nearly everything sits below the mean.

## Three measurement faults, all of which produced confident wrong numbers

These cost more than any of the code did, and the pattern is worth recognising.

1. **`merges` and `pops` were per-second windows flushed from the animation
   frame**, so under `settle` — the only way anything measures this piece — they
   read as a stale number or zero. They are cumulative since the last sweep now,
   along with `made` and `torn`. A rate is a subtraction away; a number nobody
   wrote down is not.
2. **A lifetime test that loops until a population halves measures refill, not
   lifetime.** Two attempts died this way. What works is the steady state: alive
   = births per second × mean life, and `made` gives births exactly, so one
   settle answers it with no loop.
3. **Deriving births per second from the gas arithmetic instead of measuring
   it.** That is what hid the emitter bug below for an hour — the arithmetic said
   38 a second and the truth was 180.

## The gas debt must never be forgiven

`emit` subtracted a bubble's area from the jet's debt whether or not the debt
covered it, and zeroed anything negative at the end of the frame. So a jet
emitted **exactly one bubble per step whatever its size** — 180 a second at three
jets, identical at 5mm, 10mm and 14mm, which is impossible if gas is a quantity.
Every claim in this piece about smaller bubbles meaning more of them was false
while that line stood, including the ones written into `about.md`.

It now draws the size first and emits only if the debt covers it. Births match
the gas exactly: measured 153/153 and 38/38 against what the flux predicts.

## A widened range walks into old constants

`GONE`, the radius at which a bubble counts as drained away, was **1.2mm** —
fine when the birth band's floor was 2mm. Lowering that floor to half a
millimetre made it a filter on birth: a bubble born at 1mm was already past the
test and was released on its first step, so `born size` at 1mm–1mm produced **no
bubbles at all**. Andrei found it within a minute of the widening.

The same shape as the section's rule about hues typed as literals. When widening
a control, grep for the constants its old range never reached.
