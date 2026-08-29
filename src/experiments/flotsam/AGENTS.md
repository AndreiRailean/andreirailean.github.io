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
  translation and is safe.
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
  canonical baseline of exactly 1.
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
- **Anything that changes the picture without the sea moving must set `dirty`.**
  The loop parks itself when nothing is moving, and setting `canvas.width` on a
  resize clears the canvas — so a parked loop leaves the piece simply gone after
  a window resize or a screenshot. Inherited verbatim from Dangler, where it was
  a real bug; the same loop is here and it would be the same bug.

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
  that range is the piece's whole dynamic. A tempo multiplier would flatten it
  and would be a lie about the water.
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
| `random.ts`   | seeded PRNG, clamped gaussian, indexed homes                                 |
| `waves.ts`    | the Gerstner spectrum: displacement, height, slope, folding, wave drift      |
| `current.ts`  | the set and drift, and the patch-periodic incompressible eddy field          |
| `scatter.ts`  | seed → the flotsam: homes, sizes, colours, per-train response, wave drift    |
| `view.ts`     | metres to pixels, and the wrapped patch                                      |
| `specks.ts`   | sprite cache and additive drawing                                            |
| `palette.ts`  | the water, and what a speck is made of                                       |
| `flotsam.ts`  | the engine: canvas, the clock, integration, drawing, stats                   |
| `api.ts`      | `window.experiment`                                                          |

`random.ts` is the section's second copy of Dangler's, trimmed rather than
copied whole — `discPoint` and `r2Point` are gone, the second of those after
being tried and removed. Starry Night wants none of it, so this is two data
points and not the three ADR-0002 asks for; it stays duplicated on purpose.
**Fix a bug in either copy and fix it in both.** The chrome, fullscreen, the
clipboard and the wake lock all come from `../kit/`; the last of those moved
there when this piece arrived, in
`../docs/adr/20260829-the-third-copy-moves-to-the-kit.md`.

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
