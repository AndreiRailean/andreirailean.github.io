# Psyxels — notes for agents

Read `about.md` for what this is and why it looks the way it does, and
`../AGENTS.md` for conventions shared by every experiment. This file is only the
things about _this_ piece that will get broken by accident.

## The one thing to understand first

**There are two halves and only one of them may move a pixel.**

- **The packing** — `mask.ts` and `field.ts` — is a still question asked of a
  still picture. It decides where each pixel is and how big. It runs when the
  subject, the frame, or one of the seven settings in `needsPacking` changes, and
  at no other time.
- **The life** — `glyphs.ts`, `pulse.ts`, `palette.ts` — is read live, every
  frame, from settings that are never copied into the field. It decides what a
  pixel is showing, what colour it is and how bright. It can move nothing.

That separation is the piece. A scene can be wound from sober to hallucinating
with the letter underneath standing exactly still, and
`tests/psyxels.spec.ts` asserts it by driving every life control to an extreme
and comparing the pixel count and the depth histogram before and after.

If you find yourself repacking on a colour change, stop: you have just made a
piece that reshuffles itself under the reader's hand every time they touch a
slider.

## The packing is a subdivision, not a bin-pack

A square is one pixel or four, recursively. Two consequences worth stating
because both look like luck rather than design:

- **The cover is exact by construction.** No gaps, no overlaps, no arithmetic to
  get wrong at any mixture of sizes. Bin-packing squares of mixed sizes leaves
  slivers nothing fits, and every fix for that is a fix you would have to
  maintain.
- **A size change is local.** One square splits or four merge, and nothing
  outside that square is touched. Repacking "everything around" a resized pixel
  would be the whole field on every churn event.

**Two separate things decide a split and they are not interchangeable.** Detail
splits where the picture is uneven, which is what keeps the subject legible.
Variety splits where nothing asked, which is what stops the field reading as a
compression artefact — orderly, fine at the edges, coarse in the middle. Turning
one up does not cover for the other being off.

## Traps that have already been hit

- **A field packed at the current instant is invisible.** Every pixel eases in
  from nothing over `BIRTH_S`, so a pixel born at `t` has an alpha of zero at
  `t`. Harmless while the clock runs and fatal when it does not: under
  `prefers-reduced-motion` the clock is frozen and the piece was simply **gone** —
  a blank canvas, no error, nothing to see in a stack trace. `packField`
  backdates the whole initial build by `BIRTH_S` so that only a _change_
  animates. The browser suite pins this by asserting there is light on the canvas
  under reduced motion.
- **Brightness must be carried once.** A pixel's alpha comes from coverage; its
  colour comes from the subject with the _brightness normalised out_ of it. The
  first version multiplied an unnormalised subject colour by that alpha, so a
  shadowed cheek was dim twice over and the portrait came out as a brown smear on
  black. `paintColour` divides by the peak channel, which keeps the hue and drops
  the darkness.
- **A photograph's white point is not white.** The brightest thing in the avatar
  is a lit forehead well short of it, so the controls calibrated against a white
  letter left the whole picture in the bottom third of the scale. `buildMask`
  measures the subject's own white point — ignoring the top half per cent,
  because one specular highlight would otherwise undo the stretch — and scales to
  it. A letter is unaffected: its white point _is_ white.
- **The tone map has to be a curve, not a lift.** It was `ink + (1 - ink) ×
flatten` at first, which looks right on a letter — ink is 1 almost everywhere —
  and gives a photograph a hard cut with no shading above it. Every surviving
  tone came out at nearly the same brightness and the face read as a splotch.
  It is a black point and an exponent now: `((ink - threshold) / (1 - threshold))
** (1 - 0.92 × flatten)`. Costs one `**` and serves both subjects, because a
  letter's interior is at 1 whatever exponent it is raised to.
- **`wave` has to take the rate as well as the phase.** Pixels running at their
  own speeds drift apart within a few cycles however they were aligned, so a
  travelling pulse built from phase alone smears back into a simmer while you
  watch it. `breathOf` mixes `rate` toward 1 by the same control.
- **A ring that opens by growing from the centre sweeps through the strokes it
  is meant to enclose.** Every circled sign then spends its transition as a
  flower, which is a shape not in the vocabulary and reads as a fault. It sweeps
  its arc instead — a circle being drawn, at its own radius the whole way —
  starting from the pixel's own phase so the field does not draw in unison.
- **A fixed transition duration cannot work here.** `flicker` spans two orders of
  magnitude: a quarter-second ease is languid at one change every two seconds and
  never completes at five a second, which leaves the field permanently between
  frames. `morphOf` takes a share of the hold the pixel is currently in — which
  is why a pixel stores the `gap` it entered — capped at `MORPH_MAX` so a pixel
  changing twice a minute does not spend twenty seconds mid-morph.
- **A vocabulary that shrinks leaves pixels showing frames that no longer
  exist.** It is read live, so nothing rebuilds when it moves; `visit` treats
  `glyph >= vocabulary` as a change due now.
- **`match` does not fall as the threshold rises, and a test that assumed it did
  failed against correct behaviour.** It peaks in the middle. Wide open, the
  letter wears a fringe of squares that are mostly empty — they add to the union
  and barely to the intersection. Nearly shut, its edge is eaten back and the ink
  goes unclaimed. Assert the shape of the curve, not a direction.
- **The subject grid was `stats()`-clamped and the test's stand-in was not.**
  Root squares overhang the frame by design, so a mask must report the mean over
  the part of a square that is _on_ the picture. A synthetic mask answering for
  the overhang too reads more ink than the picture contains, and every coverage
  assertion built on it is quietly wrong.
- **A hard edge on a round number stops subdividing, correctly.** Land a vertical
  edge exactly on a cell boundary two levels down and both children are uniform,
  so detail has nothing left to ask for. A test wanting the finest level from a
  vertical edge fails against a field doing exactly the right thing; use a
  diagonal.
- **`drawn` is the last frame's paint count, not a property of the settings.**
  Read `live` — pixels the threshold lets through — when asserting about a change
  that has just been applied, or the number still describes the settings before
  it.
- **The chrome fades over `--ui-fade`, and `run()` blocks the main thread for
  about as long.** A poster shutter firing the instant `run()` returns catches the
  preset bar half gone; the recipe dwells 500ms for that reason and not for the
  field's.

## Invariants worth preserving

- **A pixel is a pure function of `(seed, depth, column, row)`.** Its frame, its
  rate, its phase, its colour and its whims all come from a generator salted with
  where it sits, never from a running index. Break this and raising the
  subdivision restirs the whole picture instead of adding to it — the same class
  of bug as Dangler's anchors and Flotsam's specks.
- **Churn re-asks the question; variety is what makes the answer change.** A
  square with no reason to divide and no whim about it is stable however fast it
  is asked, so a scene with `variety: 0` cannot be made to boil. The obvious
  implementation — reshuffle on a timer — takes that away and there is then no
  way to hold the packing still while the pixels live.
- **Colour is redrawn with the frame, never on a clock of its own**, and it
  slides across the same transition. One event rather than two overlapping
  animations, and it is what makes `flicker: 0` genuinely held — frame, colour
  and all. The slide is on the pixel's signed offset from the field's hue, not
  around the wheel, so it never takes the long way round the spectrum.
- **The diagonals are the upright strokes turned, not a third pair.** `armsOf`
  is the whole model: `along` and `across` are the two stroke pairs and `spin`
  is how far they are turned, an eighth of a turn when the diagonals are fully
  present. It makes plus↔cross a rotation with no arm ever shortening — the best
  transition in the vocabulary, and free. Split back into separate features it
  becomes four strokes retracting into the middle while four others grow out of
  it, which is a mark visibly falling apart. `glyphs.test.ts` pins the arm
  lengths through the whole rotation.
- **Black is the absence of subject, not a dark subject.** It is what lets one
  threshold sculpt a letterform and a face, and it is why the ground is never
  painted on.
- **`playback` scales the clock in one place, in `step`.** The breathing, the
  frame changes and the repacking all slow by the same factor and every
  relationship between them survives. `run()` is deliberately not scaled by it:
  it means seconds of field, because a poster recipe asking for ninety seconds
  wants ninety seconds whatever rate someone is viewing at.
- **`DEFAULT_SETTINGS` is the first preset, and both are a recorded scene.** They
  are the base `normalizeSettings` falls back to, what `settingsToQuery` diffs
  against, and what the note's backdrop renders.
- **Anything that changes the picture without the clock moving must set
  `dirty`.** The loop parks itself when the clock is frozen, and setting
  `canvas.width` on a resize clears the canvas — so a parked loop leaves the piece
  gone after a window resize. Inherited from Dangler and Flotsam, where it was a
  real bug both times.

## Nothing here is settled

**Do not treat a preset, a default or an already-shared URL as a thing to be
preserved** — `../docs/adr/20260829-a-piece-under-exploration-owes-its-urls-nothing.md`.
A better rendering, a better control or a better scene beats a link that still
resolves. What that does not license: changing what a control means while leaving
its name and range alone.

## Shape of the code

| File          | Holds                                                                        |
| ------------- | ---------------------------------------------------------------------------- |
| `settings.ts` | `Settings`, the `CONTROLS` spec, presets, query parsing, what a change costs |
| `subject.ts`  | the only place that knows what the picture is: a letter, or the portrait     |
| `mask.ts`     | the subject as coverage: summed-area tables, variance, the white point       |
| `glyphs.ts`   | the vocabulary, the walk between frames, the blend between them, the drawing |
| `field.ts`    | the quadtree: splitting, merging, churn, and a pixel's own life              |
| `pulse.ts`    | the three factors that decide how bright a pixel is                          |
| `palette.ts`  | the argument between the subject's colour and the pixel's                    |
| `psyxels.ts`  | the engine: canvas, the clock, drawing, stats                                |
| `api.ts`      | `window.experiment`                                                          |
| `avatar.jpg`  | the second subject, copied rather than imported — see below                  |

The chrome, its stylesheet, fullscreen, the clipboard, the wake lock and the
seeded generators all come from `../kit/`. Nothing here is duplicated with
another piece.

**The portrait is a copy of `src/assets/avatar.jpg`, on purpose.** An experiment
imports nothing from the site, and a picture is no more exempt from that than a
stylesheet would be. It reaches the client script as a `data-avatar` attribute
rather than by import, because only the page's frontmatter gets Astro's resolved
asset URL.

## Verifying a change

`npm run build` covers `astro check` and `npm run lint` covers eslint. Neither
sees anything visual, and for this piece neither sees anything structural either.

**A still of frame one is a still of a field that has never repacked.** Use
`?run=90`, or `experiment.run(90)`, or the poster recipe — all of which step the
field forward without waiting for it. Repacking is the slow motion here: a square
reconsiders its size a handful of times a minute.

- `?debug=1` draws the squares the packing chose. With only glyphs visible, a
  field that is packing correctly and one that is quartering everything to the
  floor look much the same.
- `?panel=1` and `?idle=0` as elsewhere in the section.
- **`experiment.stats()` is the instrument.** `match` says whether the subject
  survives (intersection over union against the coverage it was read from);
  `byDepth`, `smallest` and `largest` say whether the sizes are actually mixed;
  `changes` and `flicks` say whether anything is alive; `drawMs` and `fill` say
  what it costs.
- **`tests/psyxels.spec.ts` drives the API under `npm test`**, and every test in
  it is one of the traps above.

**`tests/unit/psyxels/` covers everything that is a function and a number** —
`npx vitest run psyxels`. The field is unit-testable because `packField` takes a
`Mask` interface rather than a canvas: the tests hand it a synthetic subject with
an exactly known area, which is how the cover, the pruning and the churn rate are
checked without a browser.

Headless runs without a GPU, so trust ratios rather than absolute rates. The cost
is dominated by the number of pixels and almost not at all by their size: about
1.4µs a pixel, so the default scene's 1,800 draw in 2.5ms and `swarm`'s 7,700 in
9ms. When a scene is slow, read `pixels` before anything else — `coarse` and
`levels` are what move it.
