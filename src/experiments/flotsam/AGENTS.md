# Flotsam — notes for agents

Read `about.md` for what this is and why it looks the way it does, and
`../AGENTS.md` for conventions shared by every experiment. This file is only the
things about _this_ piece that will get broken by accident.

## The one thing to understand first

There are two motions and they are opposite, and every decision here comes from
keeping them apart.

- **The waves are a closed form, recomputed from scratch every frame.** A piece
  of flotsam has a _rest position_ — the parcel of water it sits on — and where
  it is drawn is that position plus `sample()`. Nothing accumulates, so a sea of
  any violence leaves it exactly where it found it. This is the piece's thesis
  and `tests/flotsam.spec.ts` asserts it as `transport === 0`.
- **The current is integrated.** It moves the rest positions, and it is the only
  thing in the piece that takes flotsam anywhere.

If you find yourself adding wave displacement to a stored position, stop: you
have just made the waves transport, which is the one thing the piece says they
do not do.

**The water is never drawn.** No surface, no crests, no shading — the only thing
composited that is not a piece of flotsam is the vignette. Everything a viewer
reads as water is read off the specks: how they swing, where they gather, and
when they catch the light. Drawing the surface has not been tried and should
not be without a reason, because the moment it exists the flotsam is decoration
on top of it rather than the only evidence there is.

## Traps that have already been hit

Every item below was a real bug here, and almost none was visible on screen — a
sea that gathers correctly and one that does not both look like a scatter of
dots.

- **The wrapped patch is a torus, and a flow that is not periodic on it tears at
  the seam.** The eddy field is built as a stream function, which makes it
  divergence-free to machine precision, and that was believed to be enough. It is
  not: a uniform density is only carried around a torus by a flow that is
  periodic _on that torus_, or the fundamental domain is stretched by the flow
  and folded back onto itself unevenly. Measured with the waves off and eddies
  alone, one minute took the index of dispersion **from 1 to 134** — it emptied
  most of the frame and swept everything into a few clots, and it looked exactly
  like a spectacular emergent result rather than a bug. Every wave vector in
  `current.ts` is now quantised to a whole number of cycles across the patch.
  Anything new that moves rest positions and varies over space needs the same
  treatment; anything spatially uniform (the set and drift, wave drift) is a
  translation and is safe. Recorded in full, because the next piece that wraps a
  patch will meet it, in
  `../docs/adr/20260829-a-wrapped-patch-needs-a-periodic-field.md`.
- **The integrator has to be at least second order, for the same property.**
  Even periodic and incompressible, forward Euler lands outside the true arc on
  a turning flow and the error compounds into an expansion away from each gyre.
  One minute at `eddies` 0.9 over three-metre gyres: Euler 1.08, midpoint 0.96.
  Small next to the 134 above, and worth the one extra evaluation of three
  cosines, because a piece whose whole subject is _what gathers flotsam_ cannot
  afford an integrator that gathers it.
- **Sharing the steepness equally between the trains forces a trade the piece
  cannot afford, and it shipped that way once.** The gathering a train produces
  goes with its _own_ steepness, so a flat spectrum split N ways gives either
  hard clean lines from two trains — arriving on a metronome, which is exactly
  what a viewer notices first — or a nicely irregular sea from nine that gathers
  nothing. There is no setting that is both. `peak` narrows a Gaussian over the
  train indices instead, which is the shape a real spectrum has: the dominant
  train draws the lines and its neighbours, a wavelength or two either side, beat
  against it and make the crest spacing uneven. Do not flatten it back for
  tidiness; the flat case is still reachable at `peak` 0 and it is the confused
  sea, not the default.
- **A sea running along a screen axis rules the frame.** Crests are square to
  the heading, so a sea travelling horizontally lays vertical lines, and on a
  wide window that is six or seven parallel rules across the picture — which
  reads as a mechanism whatever the spacing between them is doing. Diagonally
  there are three or four and they leave at the corners. Every preset's
  `heading` is off both axes on purpose, and a change that lands one back on one
  will look like the spectrum has broken when nothing has.
- **The wrap margin comes from a bound, not from the present wind.** `sea.reach`
  is Σ Aₙ at the gust state that _maximises_ it, found by vertex enumeration in
  `worstReach`, because the margin cannot change from frame to frame — the
  specks' homes are fractions of the patch, so a patch that resized itself as
  the wind shifted would drag every speck across the frame at once. Bounding it
  crudely instead inflates the patch and thins the flotsam on screen for nothing;
  the exact bound costs nine iterations at build time.
- **Gusts move energy between the trains and must never add any.** Σ Aₙkₙ is
  renormalised to the steepness setting on every call to `gustSea`, which is what
  keeps the control meaning what it says and stops a gust taking the sea past the
  folding limit. Anything that lets the total breathe needs the fold check
  reconsidered from scratch.
- **Wave drift reads the steady wind, not the gust of the moment.** Drift is a
  residue of many orbits, so `stokesDrift` uses `baseAmplitude` — and doing it
  live would mean recomputing every speck's drift vector on every frame, which is
  the one thing that vector exists to avoid. Its _direction_ does follow the
  wind, because the trains turn.
- **A low-discrepancy scatter is visible as a lattice at these counts.** Homes
  came from an R2 sequence at first, copying Dangler's anchors, and for Dangler's
  reason — eighty uniform draws clump into accidental pairs. At nine thousand
  specks a pixel or two across, R2's evenness is not invisible order, it is faint
  diagonal ruling across the whole frame. Every structure on this water has to
  be the waves' doing, and a lattice is structure the scatter brought with it.
  `homeFor` draws uniformly, indexed by `i`, which also gives `dispersion` its
  canonical baseline of exactly 1. It stays in this piece's own `random.ts`
  rather than in the kit for that reason: a placement is a choice about a scale
  and must not be one import away from the next piece — see
  `../docs/adr/20260829-a-low-discrepancy-scatter-does-not-scale.md`.
- **Sizes must follow a power law, not be log-uniform.** Log-uniform sounds right
  for a range spanning six octaves and puts a sixth of the population in the top
  one — at nine thousand pieces that is fifteen hundred fat discs, the picture
  comes out as white confetti, and the fine haze the gathering is legible in is
  buried under it. `n(r) ∝ r⁻²` puts ninety-three per cent in the bottom tenth of
  the range. Both ends of the size control have to stay meaningful at once: the
  range must be _wide_ for the size-dependent wave response to show, and the
  large end must be _rare_ for the picture to survive it.
- **Wave drift is not small in general.** The comments first said "a few
  centimetres a second", which is true of a real sea and false of this one.
  uₛ = ωkA² is exactly **Q²·c** — the train's steepness squared times its phase
  speed — so a realistic swell at Q = 0.05 drifts at a four-hundredth of its own
  speed and a near-breaking one at a quarter of it. The piece runs at steepnesses
  a real sea reaches only just before it breaks, so the drift is genuinely large
  there, and that is honest rather than a bug. Do not "fix" it by scaling it
  down; the `stokes` control is what says how much of it you want.
- **The size response must decay, not ring.** The exact kernel for a disc
  averaging a sinusoid is 2J₁(kr)/(kr), which goes negative past kr ≈ 3.83 —
  that would have a large float heaving in _antiphase_ with ripples it cannot
  resolve, which no float does. A Gaussian fitted to the main lobe is used
  instead, on purpose, and `waves.test.ts` asserts monotonicity so nobody
  "improves" it back to the Bessel function.
- **The steepness cap is a sum, and the worst case is `spread: 0`.** The bound
  Σ Aₙkₙ < 1 assumes every train aligned and at crest phase together, which is
  exactly what a zero fan gives. Test folding there, never at a wide fan, where
  it will pass on a sea that folds.
- **The dispersion statistic is blind to gathering finer than its grid.** It
  counts specks in 40 × 24 screen cells, so a wave with fewer than about four
  crests to the frame compresses the water just as hard and barely moves the
  number. A test measured a 40cm wave through 30cm cells and read a real
  four-to-one compression as 1.4. Choose the wavelength against the grid, not
  against the thing under test.
- **A bound pair's painted bar must decline pointer events.** The filled
  interval between the two handles is a pseudo-element, so it is the row's last
  child in paint order and covers both inputs; its left edge lands exactly on the
  lower thumb, which then cannot be grabbed at all, while the upper thumb sits a
  pixel outside its right edge and works. Half a working control looks like a
  knack rather than a bug. Shipped in Starry Night for as long as it had a range
  control and inherited here with the CSS; `tests/kit.spec.ts` now presses a real
  mouse on both handles of every piece that has one, because no assertion about
  layout can see it.
- **Anything that changes the picture without the sea moving must set `dirty`.**
  The loop parks itself when nothing is moving, and setting `canvas.width` on a
  resize clears the canvas — so a parked loop leaves the piece simply gone after
  a window resize or a screenshot. Inherited verbatim from Dangler, where it was
  a real bug; the same loop is here and it would be the same bug.

## Nothing here is settled

**Do not treat a preset, a default or an already-shared URL as a thing to be
preserved.** Stated plainly by the piece's author, recorded for the whole section
in `../docs/adr/20260829-a-piece-under-exploration-owes-its-urls-nothing.md`, and
worth repeating here because the opposite reads as good manners and quietly costs
you the fix: several of the
changes above were shaped to be exact no-ops on existing scenes, and that was a
constraint nobody had asked for. A better rendering, a better control or a better
scene beats a link that still resolves.

What that does _not_ license: changing what a control means while leaving its
name and range alone, or moving a scene without saying so. Rename it, retune the
presets around it, and put the change in the commit message.

The invariants below are a different thing. They are properties the piece needs
in order to work at all, and every one of them was learned by breaking it.

## Invariants worth preserving

- **Speck `i` is a pure function of `(seed, i)`.** Its home, size and colour come
  from generators salted with its own index. Break this and raising the count
  restirs the water instead of adding to it — the same class of bug as Dangler's
  anchors and Starry Night's layer phases.
- **Live positions are carried across a rebuild, but a re-roll does not carry
  them.** A colour change must not teleport the sea back to where it started; a
  new seed redraws every speck, so nothing can be carried.
- **The eddies stir and never gather.** Both halves — incompressible _and_
  periodic on the patch — exist so that every clump on screen is attributable to
  the waves. This is the one property that makes the piece legible, and it is the
  first thing to check when a change makes the flotsam do something surprising.
- **`gusts` at 0 must reproduce a steady sea exactly.** `gustSea` skips the
  trigonometry entirely there, which is what keeps the closed-form return
  property in `waves.test.ts` exactly true rather than nearly true. A gusting sea
  still transports nothing — the displacement is still a pure function of rest
  position and time — but a float no longer retraces the same circle, which is
  more honest and is why the return test pins `gusts: 0`.
- **Wave speed is not a setting and must not become one.** ω = √(gk) with real
  gravity, so `span` and `wavelength` decide the tempo between them. A frame of
  ripples is genuinely frantic and a frame of ocean swell genuinely slow, and
  that range is the piece's whole dynamic. A multiplier on the sea would flatten
  it and would be a lie about the water.

  **`playback` is not that, and the difference is where it is applied.** It
  scales the clock, in one place in `tick`, so the waves, the current, the gusts
  and the wind's veering all slow by the same factor and every relationship
  between them survives — the same sea, watched slowly. Keep it to that one
  place. The moment something reaches into the sea to slow it directly, it has
  become the setting this rule forbids.

  `run()` is deliberately _not_ scaled by it: it means seconds of sea, because a
  poster recipe asking for forty seconds wants forty seconds of water whatever
  rate someone is viewing at. Retuning every scene's playback therefore left the
  poster showing the same frame it did before, which is a good sign the boundary
  is in the right place — it was not recaptured.

  **Every scene is slowed, and that is editorial rather than incidental.** A
  pattern repeating slowly enough is not read as a pattern: at full rate the eye
  picks up the beat between the wave trains and the sea reads as a mechanism,
  which is the same fault `peak` was added to fix and which speed hands straight
  back. It is also the view from altitude, where wave bands crawl because what
  falls away with height is apparent speed and not size — and that look is not
  otherwise reachable here, since winding `span` out slows the crossing in the
  same way but shrinks the flotsam with it. Large pieces on slow water exists
  only through the clock.

- **The lower wavelength bound is 10cm on purpose.** Below about 2cm the water
  stops being a gravity wave and surface tension takes over — ω² = gk + σk³/ρ —
  which this piece does not model. At 10cm the correction is 3%.
- **`DEFAULT_SETTINGS` is the first preset, and both are a recorded scene.** They
  are also the base `normalizeSettings` falls back to, the thing
  `settingsToQuery` diffs against, and what the note's backdrop renders.
  Replacing them changes the length of every URL already shared. The
  `settingsForLanding` indirection stays even though the two currently agree,
  because it is what lets the featured scene change later without invalidating a
  link.
- **A piece is drawn at its real size, so every sprite has to work at a pixel
  and at a hundred.** Three faults hid in that gap until someone opened the size
  range up far enough to see a piece rather than a point, and all three were
  reported by eye because nothing in the code looked wrong:
  - The body came from a sprite built for a glint — half strength by half its
    radius — which at a hundred pixels is a ball of fog rather than an object. It
    is solid to 86% of its radius now, and `CORE_PX` went from 32 to 64 because
    an eight-fold upscale is soft whatever the profile.
  - The body was painted at 96% lightness and a quarter saturation, on the
    reasoning that anything bright enough to read as a glint whites out. True of
    a _point_ and false of a face you can see, so large pieces came out flat
    white and took nothing from the hue control. The body carries its colour now
    and the whitening is left to the additive blend, where a small piece sums its
    body and the bright heart of its own glare past full and clips. A dim piece
    of any size stays coloured, which is also right and cost nothing.
  - The glare was one centre-peaked sprite scaled to the whole piece, so on a
    large body it laid its bright heart across the middle instead of ringing the
    edge. It is now cached in six buckets of how much of it the body fills, and
    drawn scaled so the bucket's inner edge lands _on_ the body's edge — the
    quantisation costs the glare a little width, never its position.

  Measured, raising `gleam` from 0 to 24 on a scene of large pieces: centred, the
  lit area grew 7% and a piece's own level went 624 → 712; at the rim, 157% and
  624 → 632. `tests/flotsam.spec.ts` asserts all three, and each one was
  confirmed to fail with its fix backed out.

  A fourth followed from the same root and needed a control rather than a fix: a
  body has an edge and a speck is a point of light, so a wide size range put two
  families in one picture and the only way to keep a scene smooth was to keep
  every piece small. `softness` walks a body's edge back to nothing, so the range
  reads as one family at either end.

- **A sprite is blitted while it is at or below its own size, and drawn when it
  would have to be stretched.** Beyond that a 64-pixel gradient goes
  piecewise-linear between its texels and the dither that breaks eight-bit
  banding at native size is magnified into coarse mottling — reported as "jagged
  low resolution halos", and it is what a stretched sprite looks like. Above the
  threshold `paintBody` and `paintGlare` build the gradient at the size it is
  wanted. Benchmarked here at four thousand draws of a 60px radius: 497ms as
  scaled `drawImage` against 9.8ms as native fills. **That ratio is a software
  rasteriser's** — headless has no GPU, a scaled blit is a full CPU resample and
  a gradient fill is a span fill — so do not read it as a claim about real
  hardware. The rule stands either way, because it only sends the native path
  the draws a sprite renders badly, and those are rare by construction.
- **A piece's glare does not bloom with its brightness, and must not start
  again.** It did, on the reasoning that an over-bright piece has nowhere to go
  but outward. The cost was that the glare's inner edge wandered as the waves lit
  a piece and let it go, so the sprite bucket it fell in flipped back and forth
  and large pieces visibly **pulsed**. Over-brightness reads through the palette
  now — a piece sums past full in the strong channels and clips toward white —
  which is cheaper and is what glare actually looks like.
- **The glare stays outside the body, at every softness.** Letting it inward was
  tried, twice, and is wrong both times: the glare's peak landing on a body that
  is still lit _outshines that body's own middle_, so a piece comes out as a flat
  disc inside a brighter ring. It is also what makes widening the gleam brighten
  a piece rather than enlarge it, which is the fault the whole rendering was
  reworked to remove. `softness` turns the glare's peak down instead of moving
  it, which is enough to stop a hard 0.7 reading as an outline drawn round a
  blob that has no edge left.
- **The glare cache is six times what it was.** Hue × saturation × how much of
  the glare the body fills, so a scene with a wide colour spread and a wide size
  range can build a few hundred sprites, each dithered on creation. It is a
  one-off of tens of milliseconds spread over the first frames, and it is why
  `GLARE_STEPS` is 6 rather than 16.
- **Brightness is a control, and it was not one for too long.** Until `exposure`
  and `sizeMix` existed, every lever on how much light a scene made also changed
  what was afloat: the count empties the water, the size range narrows it, the
  gleam softens it. Someone trying to dim a scene had no move that did not also
  spoil it. `exposure` scales what a piece contributes and nothing else;
  `sizeMix` keeps the range wide and thins its large end, which is the thing that
  was actually wanted and could not be asked for. Reach for `light` in `stats()`
  before either — it is alpha-weighted area over canvas area, and it is the only
  way to compare two scenes without comparing two monitors.
- **`exposure` scales the bloom as well as the alpha, on purpose.** A dimmer
  scene should have less glare, not the same glare around dimmer pieces, so the
  halo radius follows it. Two consequences worth knowing: the light falls off
  faster than linearly with the control, and the cull bound moves with the halo,
  so `drawnDots` shifts by a per cent or so when you change it. Both are correct.
- **The small pieces fade first.** They are already alpha-traded down for being
  sub-pixel, so a low exposure loses the haze before it loses the large pieces —
  which is the opposite of what someone dimming a scene usually wants. Pair a low
  exposure with a _higher_ size mix, not a lower one.
- **The glare and the body are dimmed by different amounts, and must stay that
  way.** The sub-pixel floor widens a body to `MIN_CORE_DEVICE_PX / dpr` and
  scales its alpha by the area given up, which is exactly energy-preserving — so
  what the floor costs is never light, only peak brightness. **The peak is the
  shine.** The glare is not widened by the floor and has no business being dimmed
  by it, and giving both one alpha tripled the haze on every 2× screen the moment
  the floor moved to device pixels. The glare keeps a css-px reference, read as
  an area ratio — a smaller speck reflects less light — rather than as a
  pixel-grid correction. `tests/flotsam.spec.ts` pins both halves and each was
  watched to fail. See #94.
- **`stats().dimmedDots` says how much of the population is only haze.** `light`
  will not: it is dominated by a thirty-pixel halo, so it barely moves when every
  core in the scene goes under the floor. That is what "the specks lost their
  shine" turned out to mean on a phone, and there was no number for it before.
- **A phone is not a smaller window on this piece, it is a wider one.** `span` is
  metres across the shorter side **in css px**, so a 390px phone shows the same
  water as an 860px laptop through 2.2× fewer pixels and every core shrinks with
  it. `simmer`'s largest core is 0.95 css px on a laptop and 0.43 on a phone. The
  floor correction moves 88 specks of 4060 above the floor and is very nearly
  invisible; the framing is the real cause, and changing what `span` means moves
  every scene on both this piece and Dangler. Not decided.
- **A preset whose numbers look wrong is not a broken preset.** `simmer` sits at
  a dispersion of 1.02 and an orbit of a third of a pixel; `migration` at a
  minimum Jacobian of 0.81; `dream` at a `light` of 6.7 where every other scene
  is under 1, because it is deliberately blown past white until the only dark
  left is the gaps between pieces. All three are deliberate: one is the piece at a span
  where the waves are too fine to move anything and a light too low for the water
  to reflect, leaving `shade` as the only thing varying, and the other is a scene
  where the current does all the work. Do not "fix" either by winding the
  steepness up. The numbers in `stats()` say whether the machinery is working,
  not whether a scene is worth looking at.
- **Most of `stats()` is one frame behind, and `transport` is behind
  differently from the rest.** `tests/AGENTS.md` asks every piece to say which
  of its stats are computed on the spot and which are filled in while drawing;
  psyxels does, and this piece did not until #107 — despite `light` being the
  original case that section was written for, and #65 being this piece's.

  | written where                                          | stats                                                                              |
  | ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
  | on the spot in `stats()`, always current               | `dots`, `trains`, `steepness`, `clock`, `running`                                  |
  | in `draw()`, so one frame behind                       | `drawnDots`, `orbit`, `dispersion`, `minJacobian`, `fillPx`, `dimmedDots`, `light` |
  | in `advance()`, so behind until the sea is **stepped** | **`transport`**                                                                    |
  | in `tick()`                                            | `fps`                                                                              |

  The last row is the trap. `tick()` has two paths: when `isAnimated()` it
  integrates and draws, but the `dirty` path **draws without integrating**. So
  `painted()` — the section's one-liner for this whole bug class — refreshes
  every stat in the `draw()` row and cannot touch `transport`. On a scene that
  is not animated it never will, however long you wait: measured at five frame
  waits leaving it byte-identical at 1.2720048, where one `api.run(1 / 60)` took
  it to 0. **Step the sea to read `transport`; a frame wait is for the others.**
  `run()` calls `advance()` directly, so it does not depend on `isAnimated()` —
  and note `RUN_STEP` is `1/60` and `run()` rounds `seconds / RUN_STEP`, so
  anything under about `0.008` rounds to no steps and silently does nothing.

  `isAnimated()` is also not what it sounds like: it is true whenever
  `steepness > 0`, so a scene with waves is animated even with the water
  entirely still. Turning `steepness` off is what parks the loop, not turning
  the current off.

- **`gleam` is the cost, not the count.** `simmer` draws four thousand pieces —
  fewer than half of `windrows` — and fills nearly six million square pixels
  against that scene's quarter million, because a thirty-pixel halo is nine
  hundred times the area of a one-pixel one. When a scene is slow, read `fillPx`
  before reaching for `dots`.
- **Never use `DEFAULT_SETTINGS` as a neutral baseline in a test.** It is
  editorial. `tests/unit/flotsam/waves.test.ts` states its own `PLAIN` sea, and
  anything measuring physics should do the same — Dangler records two checks
  that went quietly vacuous when its defaults moved.
- **`prefers-reduced-motion` freezes the clock rather than pinning settings.**
  Dangler expresses it by setting its motion controls to 0, which needs no
  special path. That cannot work here: the waves have no speed setting to pin,
  so zeroing anything that would still them also flattens the sea. Freezing the
  clock gives a still with all the shape and gathering intact.
- **Settings round-trip through the query string.** Anything added to `Settings`
  needs a `Control`, or the panel and shared URLs quietly disagree — asserted in
  `tests/flotsam.spec.ts`.

## Shape of the code

| File          | Holds                                                                        |
| ------------- | ---------------------------------------------------------------------------- |
| `settings.ts` | `Settings`, the `CONTROLS` spec, presets, query parsing, what a change costs |
| `random.ts`   | `homeFor`: where speck `i` starts. The generators are the kit's              |
| `waves.ts`    | the Gerstner spectrum: displacement, height, slope, folding, wave drift      |
| `current.ts`  | the set and drift, and the patch-periodic incompressible eddy field          |
| `scatter.ts`  | seed → the flotsam: homes, sizes, colours, per-train response, wave drift    |
| `view.ts`     | metres to pixels, and the wrapped patch                                      |
| `specks.ts`   | sprite cache and additive drawing                                            |
| `palette.ts`  | the water, and what a speck is made of                                       |
| `flotsam.ts`  | the engine: canvas, the clock, integration, drawing, stats                   |
| `api.ts`      | `window.experiment`                                                          |

`random.ts` holds only `homeFor` now. The generators it is built on —
`hashSeed`, `makeRng`, `gaussian` — moved to `../random.ts` when Psyxels
became the third piece to want them, and what stayed behind is what is this
piece's own choice about this piece's scale:
`../docs/adr/20260829-a-third-copy-of-the-generators-moves-to-the-section.md`.
Nothing here is duplicated with another piece any more; if you find something
that is, that is a bug rather than a policy. The chrome, its stylesheet,
fullscreen, the clipboard and the wake lock all come from `../kit/` too.

`kit/controls.ts` gained logarithmic sliders for this piece. Six of these
controls span orders of magnitude — `span` runs from a puddle to open water, a
factor of two hundred — and on a linear track the whole small end sits inside the
first per cent. Nothing in Dangler or Starry Night needs it, so the default is
linear and both are untouched.

## Verifying a change

`npm run build` covers `astro check` and `npm run lint` covers eslint. Neither
sees anything visual, and for this piece neither sees anything physical either.

**A still of frame one is a still of the piece before it has done anything.**
The flotsam starts uniformly scattered and takes a wave period or two to gather;
wave drift takes far longer. Use `?run=40`, or `experiment.run(40)`, or the
poster recipe's `prepare` — all of which step the sea forward without waiting for
it.

- `?debug=1` draws the crests and the current as arrows. With only flotsam
  visible, a sea running the wrong way, a current running the wrong way and a
  response table full of zeroes all look identical.
- `?panel=1` and `?idle=0` as elsewhere in the section.
- **`experiment.stats()` is the instrument.** `dispersion` says whether the
  flotsam has gathered (1 is a uniform scatter, 3 and up is lines), `minJacobian`
  says whether the sea has folded (0 or below), and `orbit` against `transport`
  is the piece's whole argument in two numbers — how far it swings against how
  fast it is actually going anywhere.
- **`tests/flotsam.spec.ts` drives the API under `npm test`**, and every test in
  it is one of the traps above. Add to it rather than reaching for `webcheck`,
  which cannot evaluate JS.

**`tests/unit/flotsam/` covers the physics, and you should run it after touching
any of it** — `npx vitest run flotsam` for all of it, `npx vitest waves` while
editing the sea. One file per module, and every assertion is a property no
screenshot could show: a float that comes back after exactly one period, a sea
that has not folded, an eddy field with no divergence in it, a raft that ignores
the chop.

Headless runs without a GPU, so trust ratios, not absolute frame rates. The cost
is dominated by the number of pieces, not by their size: nine thousand at a low
`gleam` runs at roughly two thirds the frame rate of two thousand, and the fill
in `stats()` barely changes between them. `specks.ts` skips the halo composite
entirely when `gleam` is small against the core, which halves the draw calls in
exactly the fine, numerous scenes the piece is best at.
