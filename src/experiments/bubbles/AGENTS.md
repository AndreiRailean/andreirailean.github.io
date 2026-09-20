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
