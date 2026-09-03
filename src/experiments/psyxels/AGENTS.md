# Psyxels — notes for agents

**A psyx** is the unit: one square of the picture, the mark drawn for it, and
the small mind that picks that mark. _Pixel_ means a screen pixel here and
nothing else — the two differ by two orders of magnitude and the code measures in
both, so the distinction is load-bearing rather than cute. `Psyx` is the type
in `field.ts`; a _square_ is the region, a _mark_ is what is drawn in it, a
_frame_ is one entry of the vocabulary.

Read `about.md` for what this is and why it looks the way it does, and
`../AGENTS.md` for conventions shared by every experiment. This file is only the
things about _this_ piece that will get broken by accident.

## The one thing to understand first

**There are two halves and only one of them may move a psyx.**

- **The packing** — `mask.ts` and `field.ts` — is a still question asked of a
  still picture. It decides where each psyx is and how big. It runs when the
  subject, the frame, or one of the seven settings in `needsPacking` changes, and
  at no other time.
- **The life** — `glyphs.ts`, `pulse.ts`, `palette.ts` — is read live, every
  frame, from settings that are never copied into the field. It decides what a
  psyx is showing, what colour it is and how bright. It can move nothing.

That separation is the piece. A scene can be wound from sober to hallucinating
with the letter underneath standing exactly still, and
`tests/psyxels.spec.ts` asserts it by driving every life control to an extreme
and comparing the psyx count and the depth histogram before and after.

If you find yourself repacking on a colour change, stop: you have just made a
piece that reshuffles itself under the reader's hand every time they touch a
slider.

## The packing is a subdivision, not a bin-pack

A square is one psyx or four, recursively. Two consequences worth stating
because both look like luck rather than design:

- **The cover is exact by construction.** No gaps, no overlaps, no arithmetic to
  get wrong at any mixture of sizes. Bin-packing squares of mixed sizes leaves
  slivers nothing fits, and every fix for that is a fix you would have to
  maintain.
- **A size change is local.** One square splits or four merge, and nothing
  outside that square is touched. Repacking "everything around" a resized psyx
  would be the whole field on every churn event.

**Two separate things decide a split and they are not interchangeable.** Detail
splits where the picture is uneven, which is what keeps the subject legible.
Variety splits where nothing asked, which is what stops the field reading as a
compression artefact — orderly, fine at the edges, coarse in the middle. Turning
one up does not cover for the other being off.

## Traps that have already been hit

- **A field packed at the current instant is invisible.** Every psyx eases in
  from nothing over `BIRTH_S`, so a psyx born at `t` has an alpha of zero at
  `t`. Harmless while the clock runs and fatal when it does not: under
  `prefers-reduced-motion` the clock is frozen and the piece was simply **gone** —
  a blank canvas, no error, nothing to see in a stack trace. `packField`
  backdates the whole initial build by `BIRTH_S` so that only a _change_
  animates. The browser suite pins this by asserting there is light on the canvas
  under reduced motion.
- **Brightness must be carried once.** A psyx's alpha comes from coverage; its
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
- **`wave` has to take the rate as well as the phase.** Psyxels running at their
  own speeds drift apart within a few cycles however they were aligned, so a
  travelling pulse built from phase alone smears back into a simmer while you
  watch it. `breathOf` mixes `rate` toward 1 by the same control.
- **A frame must not be shown in fractions.** Interpolating the features was the
  first way of playing a transition — strokes growing out of the middle, a ring
  drawing itself round — and both are wrong at size, which is where the piece's
  author saw it: a large plus spends its transition as a pair of stubs and stops
  being a sign, and a ring has no legible fraction of itself at all. Two _whole_
  marks are cross-faded instead, in `paintPsyxel`, which owns alpha: the outgoing
  one shrinks a little and the incoming one grows into place, so what is on
  screen is always in the vocabulary — briefly twice over. It costs a second draw
  call for the span of a transition, and that is the price.
- **A fixed transition duration cannot work here.** `flicker` spans two orders of
  magnitude: a quarter-second ease is languid at one change every two seconds and
  never completes at five a second, which leaves the field permanently between
  frames. `morphOf` takes a share of the hold the psyx is currently in — which
  is why a psyx stores the `gap` it entered — capped at `MORPH_MAX` so a psyx
  changing twice a minute does not spend twenty seconds mid-morph.
- **A vocabulary that shrinks leaves psyxels showing frames that no longer
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
  Read `live` — psyxels the threshold lets through — when asserting about a change
  that has just been applied, or the number still describes the settings before
  it.
- **The chrome fades over `--ui-fade`, and `run()` blocks the main thread for
  about as long.** A poster shutter firing the instant `run()` returns catches the
  preset bar half gone; the recipe dwells 500ms for that reason and not for the
  field's.

- **`variety` had to stop short of certain, and a control whose extreme is
  uniform is broken.** Read as a raw probability it reached 1, every square
  divided, and the setting called _variety_ produced a field of one size with no
  variety in it — reported by the piece's author, who read the description and
  then the field and found they disagreed. `splitChance` caps it; a field of
  nothing but fine psyxels is reached with `coarse` and `levels`, which is a
  statement about which sizes exist rather than about how mixed they are.
- **A soft boundary costs psyxels, and half the control cost too many.** Letting
  an edge square decline to subdivide is the only way a _coarse_ mark ends up
  outside the subject, and a square that declines is one psyx where there would
  have been four. At `fuzz × 0.5` the landing scene lost a third of its psyxels
  and the letter went patchy; at `× 0.3` it loses a tenth. The rest of the
  softness is `levelOf`'s, which only ever adds psyxels.
- **Half of `stats()` is computed on the spot and half is left over from the last
  frame drawn**, and a reading taken straight after a change describes the
  settings before it. Computed in `stats()`, so always current: `psyxels`,
  `live`, `byDepth`, `ageByDepth`, `smallest`, `largest`, `match`, `changes`,
  `flicks`, `clock`. Filled in while drawing, so one frame behind: `drawn`,
  `fill`, `colours`, `drawMs`, `fps`. `live` exists because `drawn` was the only
  measure of what the threshold lets through and it cost two rounds to notice;
  it removes the window rather than waiting it out, which is the better shape
  where it applies. For the rest, `api.run(0.2)` forces a frame — the general
  rule is in `tests/AGENTS.md` under _Reading a canvas after changing a
  setting_.

- **The coarsest square is a share of the frame, not a number of screen
  pixels.** In screen pixels the piece was a different picture in every window,
  and the small ones broke: match against the subject fell from 0.94 at 1920 to
  0.82 at 1024. As a share it is 0.925 at all three. `MIN_PX` stays absolute,
  because _that_ one is about legibility on a screen.
- **A face is a kind of shape, not a font.** `STACKS` asks for generic families,
  so two machines show different letters — headless Chromium here resolves both
  `roman` and `script` to DejaVu Serif and reports identical numbers for them,
  where a Mac gives Georgia and Snell Roundhand. That is fine for a piece whose
  subject survives only as coverage, and it is why the poster's recipe does not
  name a face. Do not "fix" it by bundling a font without deciding that the
  determinism is worth the weight.

- **A large psyx sits in a hole, and the hole is read as part of the mark.** Ink
  is a fixed share of a square, so the same drawing is tone at seven screen
  pixels and a thin sign in a void at a hundred — reported as "a huge black hole
  behind them", and it is the piece's instance of
  `../docs/adr/20260830-large-units-demand-attention.md`. `bloom` redraws the
  mark far wider and dim behind itself, weighted by size against the coarsest
  square so the grain is untouched; `inset` goes negative so marks overlap. The
  bloom follows the _outgoing_ frame for the first half of a transition and the
  incoming one after, rather than being drawn twice.
- **`fill` is bounding area, not ink.** It sums the marks' boxes, so it cannot
  see `bloom` at all. Count lit canvas pixels for that — and draw a frame first
  with `api.run()`, because `set()` only marks the scene dirty.

- **A psyx that vanishes leaves a hole until its replacement has arrived.** The
  arrival is eased and the departure was instantaneous, so a coarse psyx
  dividing showed bare ground where it had been — and the slower the piece is
  watched the worse it is, because the ease follows the clock and the eye does
  not. `field.ghosts()` keeps the departing mark, and the renderer runs the same
  ease backwards over the same span. Ghosts are plain data with no generator and
  no children; they are drawn under everything and forgotten after `MOURNING`.
- **A large psyx arrives and leaves faster than fine grain.** `spanOf` scales the
  ease by size, because a coarse mark eased over a speck's span spends its whole
  arrival as a translucent ghost of itself and reads as an event. Asked for in as
  many words: _larger units should have higher gravity_.
- **A memoryless life has a long tail, and the mean hides it.** With the same
  odds of dividing on every turn, a coarse psyx that keeps winning sits in one
  square for twenty seconds against a mean of two — reported by eye against
  numbers that looked healthy. `PATIENCE_LIMIT` is a _deadline_, not a lean:
  leaning the odds by how long a psyx had waited halved every coarse life, which
  is a different change from the one that was wanted. The test asserts the ratio
  of the longest life to the mean.
- **The knockout is capped, not simply bolder.** It is drawn wider than the mark
  so it reads as a hole rather than a scratch, and doubling the weight is fine
  until the weight is heavy: at `weight` 0.12 a doubled knockout is a quarter of
  the square wide, and a solid field came out _darker_ than the same field drawn
  as marks. Found by a test whose ratio went the wrong way, not by eye.
- **A test that measures ratios must state its own scene.** The bloom, overlap,
  solid and layer checks compared against whatever the landing scene happened to
  be; when that became a heavily overlapping one carrying a glow, `bare` was not
  bare and every ratio sat a per cent above its bound — passing here and failing
  in CI. They state a plain scene now. Flotsam's notes say the same thing:
  _never use `DEFAULT_SETTINGS` as a neutral baseline in a test._
- **`solid` is the complete answer to the hole, and it is a different piece.** A
  filled tile with the sign knocked out of it in the ground's colour: nothing is
  empty, and the tile is opaque, so a large psyx covers the grain it overlaps —
  which is what was asked for. It costs: at 0.6 every psyx draws a tile, a
  knockout _and_ a mark. The first version ran at 49ms a frame; splitting
  `setColour` into `setStroke`/`setFill`, using `rect` below six pixels and
  skipping the knockout below three took it to 13.6ms, and 8.6ms at 1 where the
  drawn mark is skipped entirely.

- **`layers` needs every node to have a life, not only the leaves.** A square
  that divides keeps its own mark, and `breatheLife` is called on creation for
  every node because of it — a node born divided had no mark at all before, so
  raising the control lit up half the tree with whatever glyph zero happened to
  be. It also shifted every seeded stream by a few draws, which is why every
  scene changed the day it went in.
- **The divided squares are drawn _over_ the grain and without a bloom.** Over,
  because what should show through the gaps in a big mark is the finer psyxels
  that replaced it — underneath, the grain covers the coarse mark and the whole
  thing reads as haze. Without, because there are a third as many branches as
  leaves and every one of them is large: blooming them buried the letter in soft
  discs at the first attempt.

- **The glow buffer is a running average, not a sum.** Faded by `1 - kept` and
  added back at `1 - kept`, so a steady field settles at its own brightness
  whatever the frame rate. Added at full weight it is a sum whose resting value
  is the frame divided by what was faded — at a long afterglow and sixty frames
  a second that is a factor of a hundred and eighty, and the picture whites out.
  It also made the glow's strength depend on the frame rate, which looks like a
  taste problem on one machine and a bug on another.
- **The buffer is filled before the glow is composited, never after.** The next
  frame must gather the field, not the field plus its own glow, or it runs away.
- **A lit-pixel count cannot measure the afterglow, and reads plausibly while
  failing to.** The trail is dimmer than the frame that made it — a running
  average over a _moving_ field is averaging in past frames whose light was
  elsewhere — so it sends about as many pixels down through the test's
  `LIT_THRESHOLD` as up, and a total comes back within a per cent either way.
  An assertion built on that total passed for weeks on an artefact and then
  failed CI on a PR touching no psyxels code; #109 has the numbers.
  **Measure _which_ pixels instead:** read the lit mask at a settled
  `afterglow: 0.95`, collapse it to 0, step exactly one field step, and count
  the pixels lit in the first and not the second. That is 1.6–2.5% of the lit
  area against a field-motion control of under 0.05%. The test is "the
  afterglow leaves light where the psyx no longer is" in `tests/psyxels.spec.ts`
  and it carries both bounds and the deliberate break they were checked against.
- **The canvas is cleared to nothing and the page supplies the ground.** A
  `#05050a` ground gathered into the buffer frame after frame settles into a grey
  wash over everything. Anything that starts painting a ground on the canvas
  again brings that back.
- **`run()` draws its last twenty steps.** The glow is gathered _between_ frames,
  so a fast-forward that draws only its final one leaves the buffer holding a
  single frame — a poster with no glow on a scene that has plenty.

- **A memory of a picture that no longer exists is a stain, not an afterglow.**
  The glow buffer fades on the piece's clock, so loading a preset that is watched
  slowly left the previous scene's light over the new one for seconds — bright,
  long, and belonging to nothing on screen. `forget()` empties it on anything
  that replaces the picture wholesale: a repack, a new subject, a resize. A psyx
  coming and going does _not_ clear it, because that is what the buffer is for.
- **`playback` was the only way to slow anything down, and that is not the same
  control.** Every transition — a psyx arriving, one going, a frame turning into
  the next — was a fixed length in the piece's own seconds, so lengthening one
  meant slowing the clock, which slows the _events_ with it. Raising the flicker
  to compensate gives a different picture, which is what the piece's author
  reported. `ease` scales the transitions and leaves every rate alone. Two things
  follow it: `MORPH_MAX` is multiplied by it, or a long hold still cannot carry a
  long transition; and `MOURNING` is too, or a stretched departure is forgotten
  halfway through and a psyx vanishes mid-fade.

## Invariants worth preserving

- **A psyx is a pure function of `(seed, depth, column, row)`.** Its frame, its
  rate, its phase, its colour and its whims all come from a generator salted with
  where it sits, never from a running index. Break this and raising the
  subdivision restirs the whole picture instead of adding to it — the same class
  of bug as Dangler's anchors and Flotsam's specks.
- **Churn re-asks the question; variety is what makes the answer change.** A
  square with no reason to divide and no whim about it is stable however fast it
  is asked, so a scene with `variety: 0` cannot be made to boil. The obvious
  implementation — reshuffle on a timer — takes that away and there is then no
  way to hold the packing still while the psyxels live.
- **A psyx is ended by the first of its ancestors to change its mind**, which
  is why each level down is asked less often than the one above it. With every
  square asking at the same rate, the coarse marks outlasted the grain around
  them more than twofold — 3.6s against 1.6s on a flat subject — and they are the
  marks the eye goes to, so the field read as a few big things sitting still
  while everything else moved. `DEPTH_PATIENCE` carries the measurements. Two
  things hang off it: `DEPTH_SPREAD` gives back what the slowing takes, or the
  whole field drops from a thousand changes a minute to thirty; and `spare` keeps
  a merged subtree, so a coarse psyx coming and going does not restir the grain
  under it.
- **Colour is redrawn with the frame, never on a clock of its own**, and it
  slides across the same transition. One event rather than two overlapping
  animations, and it is what makes `flicker: 0` genuinely held — frame, colour
  and all. The slide is on the psyx's signed offset from the field's hue, not
  around the wheel, so it never takes the long way round the spectrum.
- **The diagonals are the upright strokes turned, not a third pair.** `armsOf`
  is the whole model: `along` and `across` are the two stroke pairs and `spin` is
  how far they are turned. It keeps a cross the same size and weight as a plus
  without anyone maintaining that by hand, and it deletes a branch. It was
  briefly an _animation_ — a plus winding round into a cross — and that went with
  the rest of the feature interpolation.
- **Black is the absence of subject, not a dark subject.** It is what lets one
  threshold sculpt a letterform and a face, and it is why the ground is never
  painted on.
- **`playback` scales the clock in one place, in `step`.** The breathing, the
  frame changes and the repacking all slow by the same factor and every
  relationship between them survives. `run()` is deliberately not scaled by it:
  it means seconds of field, because a poster recipe asking for ninety seconds
  wants ninety seconds whatever rate someone is viewing at.
- **`DEFAULT_SETTINGS` is a baseline, not a scene, and no preset inherits from
  it.** Presets were spread over it and the featured scene _was_ it, so the day
  the featured scene changed every preset that had not named a setting silently
  took the new one's value — half of them ended up watched at a quarter speed
  wearing a light trail meant for something else. Each preset states every
  setting now, and `settings.test.ts` asserts it. Position one is only position
  one: what a bare address lands on, rewritten to that scene's full query.
  The defaults are the piece's _zero_ — a plain letter with every effect at rest
  — and they are what `normalizeSettings` fills gaps from and what
  `settingsToQuery` measures a link against. The note's backdrop renders
  `PRESETS[0]`, because a backdrop should show a scene someone chose.
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
| `field.ts`    | the quadtree: splitting, merging, churn, and a psyx's own life               |
| `pulse.ts`    | how bright a psyx is, whether it is there at all, and its transition         |
| `palette.ts`  | the argument between the subject's colour, the psyx's, and the edge's        |
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

`pnpm run build` covers `astro check` and `pnpm run lint` covers eslint. Neither
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
- **`tests/psyxels.spec.ts` drives the API under `pnpm test`**, and every test in
  it is one of the traps above.

**`tests/unit/psyxels/` covers everything that is a function and a number** —
`pnpm exec vitest run psyxels`. The field is unit-testable because `packField` takes a
`Mask` interface rather than a canvas: the tests hand it a synthetic subject with
an exactly known area, which is how the cover, the pruning and the churn rate are
checked without a browser.

**The glow's cost is a software-rasteriser cost.** Gathering it takes the
landing scene from 6.7ms a frame to 25, and almost none of that is the blur —
removing the blur entirely saves 2ms. It is the full-resolution `drawImage` into
the quarter-scale buffer, which a browser with a GPU does in the compositor and
headless does with the CPU. Read it as a ratio, not a number.

Headless runs without a GPU, so trust ratios rather than absolute rates. The cost
is dominated by the number of psyxels and almost not at all by their size: about
1.4µs a psyx — plus a second draw call for each one mid-transition — so the
landing scene's 1,300 draw in 2.5ms and `swarm`'s 7,700 in 9ms. When a scene is
slow, read `psyxels` before anything else; `coarse` and `levels` are what move
it.
