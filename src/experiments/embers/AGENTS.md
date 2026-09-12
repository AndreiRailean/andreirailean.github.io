# Embers — notes

A fire below the bottom edge of the frame, seen from the side, and the embers
that come off it. Read `about.md` first for what the piece _is_; this file is
what will cost you time if you do not know it.

`src/experiments/AGENTS.md` is the section's contract and outranks everything
here.

## The shape of it

```
view.ts      the frame in metres. The bed is at y = 0 and the picture starts above it
noise.ts     3D gradient noise, and the curl of it
air.ts       the flow: a plume, a field of vortices, a wind. No DOM
ember.ts     what one ember is and what happens to it. No DOM
bed.ts       how embers leave the fire: sputter, splinter, burst. No DOM
palette.ts   Planck's law → sRGB, and the ramp. No DOM
draw.ts      what reaches the glass
embers.ts    the canvas, the clock, the pool, the loop
```

**The first six touch no DOM on purpose**, and it is the single most useful thing
about the layout: `tests/unit/embers/fire.test.ts` runs the whole simulation
headless in milliseconds, and it is what found both of the real faults below.
Keep it that way — if something arithmetic needs a canvas, the canvas is in the
wrong place.

## Everything that is a real relationship, so you know what not to tune

Nothing in this piece is a curve somebody drew. If a change wants a new constant,
look for the relationship first — there almost always is one, and it is almost
always already half-written in a docblock.

| Behaviour                                      | Where it comes from                                                         |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| How high an ember gets                         | Its terminal speed against `W ∝ y^(-1/3)`. Nothing states a height.         |
| The column widening and slowing                | One conservation law. `b ∝ y` and `W ∝ y^(-1/3)` are the same fact.         |
| How often the fire pulses                      | `f ≈ 1.5/√D` Hz, the measured puffing frequency of a pool fire.             |
| Which way an eddy turns                        | The sign of the shear: left edge counter-clockwise, right edge clockwise.   |
| A puff rising as a unit                        | A counter-rotating pair inducing an upward velocity on itself.              |
| Big slow structure high up                     | Like-signed vortices pairing. `pairUp` in `air.ts`.                         |
| Filaments between the eddies                   | Preferential concentration — inertia flinging heavy embers out of cores.    |
| Fall speed against size                        | `√(4ρ_c d g / 3ρ_a C_d)`, so **√d**. Four times bigger falls twice as fast. |
| Embers sinking faster inside the column        | Drag scales with air density and hot air is thin.                           |
| The zig-zag of a descending flake              | Lift reversing each half turn, at a fraction of the drag.                   |
| An ember twinkling                             | Projected area of a tumbling flake. Same `phase` as the flutter.            |
| Colour, and how fast it dies                   | Planck's law. Visible emission over 1000–1600 K spans 10⁴.                  |
| A gust brightening the field, then thinning it | Airflow is oxygen: brighter _and_ shorter-lived, one term.                  |
| Embers leaning over as they climb              | Logarithmic wind profile — still at the coals, stronger with height.        |
| The whole column bending                       | `xc(y) = U·t(y)`, the analytic bent-plume trajectory.                       |
| A white-hot ember                              | Highlight clipping at overexposure, not temperature. `TEMP_MAX` is 2600 K.  |
| A bright ember looking bigger                  | Veiling glare. Halo radius grows with brightness.                           |

## Two faults that were invisible on screen, and how they were caught

Both were found by running the simulation headless and printing percentiles.
Neither was visible in a screenshot, and one of them looked _better_ than the
correct behaviour.

- **Embers at 3600 K.** Hotter than an oxy-acetylene flame. A burst was
  multiplying the _gas temperature_ by vigour, so the air over a surging fire
  reached 4600 K and everything in it heated to match. The mistake was
  conceptual: a surge is more fuel burning, not hotter fuel — it raises the
  buoyancy flux, and the gas temperature is fixed by the chemistry. So the flux
  now scales as `vigour^(1/3)` (a plume's speed goes as the cube root of its
  flux) and the temperature saturates at `FLAME_EXCESS`. On screen the fault was
  "the bursts look nice".
- **A population of forty against a ceiling of sixteen hundred.** `SPUTTER_RATE`
  had been guessed at 26 a second per metre of bed. It has to be derived from the
  other end: an ember lives three or four seconds of burning but crosses a close
  frame in under one, so most of them _leave_ rather than going out, and the rate
  that fills a frame is the rate that replaces what leaves. It is 520.

A third, found by the debug overlay rather than by numbers:

- **The vortex field saturating its own cap.** Every roll-up on one side of the
  plume carries the same sign, and a cluster of same-signed vortices co-rotates
  **without dispersing** — so they accumulated to fifty, drifted off to one side
  as a single blob, and each cost a lookup per ember per frame while influencing
  nothing. Pairing fixed it and is the actual physics. The field now settles
  around a dozen.

## Two shared tests this piece broke, and what they assumed

Both were fixed rather than worked around, and both assumed something the
section's own rules do not promise. Told to the steward, since `tests/` is shared
ground.

- **`tests/kit.spec.ts` and `tests/reel.spec.ts` both nudged a numeric setting by
  `+1`** to reach a scene that is nobody's preset. Every numeric setting in the
  section lands on a grid — `../docs/adr/20260906-a-setting-lands-on-a-grid.md` —
  and where that grid is coarser than 1, `normalizeSettings` snaps the nudge
  straight back. This piece's first varying setting is a population on a log
  track with a step of ten, so `2600 + 1` came back as 2600 and both checks
  failed. Four pieces had been passing on the coincidence that their own first
  varying setting was stored in whole units. The reel's version now moves a value
  along a control's own track; the kit's uses interior points between preset
  values, because a kit-wide assertion may only lean on what every piece promises
  and `controls()` is not part of that.

- **`tests/reel.spec.ts` picks `slugs[0]`**, the first plate on the index, which
  is whichever piece was touched most recently. Adding a piece therefore moves
  which piece the whole interactive-view suite runs against — deliberately, and
  worth knowing when a reel test starts failing for no reason connected to the
  reel.

## The tail, the shutter and the clock — three rounds of getting this wrong

All three came out of one review and they are worth reading together, because
each fix exposed the next.

**The clock was a fixed step drained from an accumulator, and that is stop
motion at slow playback.** A frame added `elapsed × playback` to a carry and
stepped whenever the carry reached a sixtieth. At 0.12x a wall frame is worth two
thousandths of a second of fire, so it stepped once every eighth frame and stood
still for seven — and the slower you set it the worse it got, which is the
opposite of what the control is for. `framePlan` steps by the time that actually
elapsed, cut into substeps no longer than `STEP`; both integrators in `ember.ts`
are exponential and stable at any `dt`, which is what makes that safe.
`tests/unit/embers/clock.test.ts` holds it.

**`trail` was a badly scaled control, not a wrong mechanism.** It held the
fraction of the previous frame surviving one frame at 60 Hz, and that maps to a
time constant of 24 ms at 0.5, 158 ms at 0.9 and 410 ms at 0.96 — so nine tenths
of the slider lived inside the first six per cent of its useful range. Dragging
it did nothing until the very top, and all it could reach was piling a few frames
onto the head of each mark. It read as a glow control because that is all it was.

**And then no normalisation of an accumulation buffer works, which is why there
is not one any more.** Both ends of that were tried:

- **Uncompensated**, a slow mark adds to itself and the picture just gets
  brighter. At slow playback a shutter spans twenty-five frames and the whole
  frame saturates — measured, and it looked like a wall of yellow.
- **Compensated** so the total is conserved, one frame's contribution falls to
  about a single level of an 8-bit channel, so the moving parts of a tail
  quantise away and the mark reads as a row of dots where frames happened to
  land.

Both are the same mistake: how many times a buffer gets written depends on the
frame rate, and a tail is a property of the ember. So each ember remembers its
own path — `samplePath`, twelve points spanning one exposure in _piece_ seconds —
and the tail is drawn from it. Length is `speed × shutter` and nothing else, per
pixel brightness is the ember's own, and neither depends on the frame rate or the
playback. It also has to be the real path rather than a chord back along the
velocity: the subject of this piece is that the path curves, and a straight tail
cuts the corner off the one thing worth seeing.

The dividend is that **a frame is now a frame.** While the picture accumulated it
had no scene until enough frames had gone into it, so `settle` had to _draw_ its
last stretch and the poster, the note's backdrop and the reduced-motion still all
fell into that together. All of that machinery is gone.

## Why the fire was one colour, which was three faults wearing one coat

Reported as _"heat claims to set the colour but doesn't — hue is the only thing
that changes it, and hue makes it flat"_. All three of these were true at once.

**Measured first, because the numbers settle it.** Across the band embers
actually occupy — roughly 1050 K to 1800 K — the ramp delivers **14° of hue,
saturation pinned at 1.00, and lightness pinned at 0.50**. Saturation is stuck
because blue goes negative below about 1900 K and clips to zero; lightness is
stuck because red saturates at 1.0 and blue is 0, so `L = (1+0)/2` whatever the
temperature. Every yellow and every white on the Planck curve lives above 1900 K,
and nothing reached it. Print the table again before touching any of this —
`blackbodyXyz` and a HSL conversion, nine temperatures, twenty lines.

1. **`heat` was a birth temperature the dynamics forgot.** An ember relaxes to
   wherever its combustion balances its losses, and that balance was three
   constants, so the whole population converged to one equilibrium in well under
   a second. `heat` moved the brightness of the first few centimetres above the
   coals and nothing else. It now sets the knee where combustion gives out — the
   temperature an ember's burning _holds_ it at — so it moves the population
   along the Planck curve, which is what a control named for colour should do.
2. **Nothing had thermal inertia.** All three rate constants were per-second and
   size-independent, so a 0.4 mm spark and a 14 mm flake forgot their heat at the
   same rate. Thermal inertia is mass over surface area, which is diameter, so
   they differ by thirty-five times. `thermalRate` carries it, and it is why big
   embers now visibly cool through the range while small ones snap.
3. **One burning temperature for every ember is one colour.** `BURN_SPREAD`
   gives each its own, a fifth either way, which is where a fire's _simultaneous_
   range of colour comes from — deep red and yellow-white in the same frame
   rather than the whole field tracing one curve in lockstep.

And the two rendering halves, which matter more than any of the above:

- **The white wash has to reach every mark kind.** Overexposure walking a mark
  toward white is where the top of a fire's colour range actually comes from,
  since the locus itself barely moves in hue. It used to be a white dot at six
  tenths of the core — a pinprick on a two-pixel mark, and **absent entirely on a
  `mote`**, which has no core. So a `mote` scene had no route to white at any
  temperature or exposure, which is exactly the scene this was reported from.
- **The response curve is not linear, and cannot be.** Visible output spans five
  orders of magnitude across `heat`'s range, so mapped straight through, `heat`
  and `exposure` fight: 2200 K went to a solid white blob and the fix put
  exposure at the bottom of its own track. Normalising against the fire's own
  heat was tried and is worse — it references the ceiling while a low `burn`
  leaves embers far beneath it, and the picture went black. `RESPONSE` is a film
  characteristic curve at 0.4: eighty-fold across the range instead of half a
  million. Flattening the brightness range without touching the chromaticity is
  what trades a light-to-dark gradient for a red-to-yellow-to-white one.

## `count` is a drawing budget, and a budget spent first-come is spent on noise

Reported as _"I don't understand how splinters works — I slid it up and down and
it doesn't seem to change anything."_ It did not. The bed offers three kinds of
ember and the least interesting one outnumbers the others by orders of magnitude:
a four-metre fire at `sputter` 2.75 asks for **5,720 lifted flakes a second**
against a ceiling of a thousand, so every splinter and every burst arrived to
find the pool full. Measured with `splinters` at maximum: **1.4% of fragments
were ever born**, 21 out of 1,530 in twenty seconds.

Nothing about that is visible in a frame. The fragments that do get through look
exactly as they should; there are simply a fiftieth as many as asked for.

`EVENT_RESERVE` holds back a share of the pool that the steady sputter may not
take. It is a **reservation and not an eviction**, deliberately: taking a slot
back from a live ember would shorten every ember's life the moment the sputter
went past the ceiling, which is a far stranger thing for a density control to do
than simply stop adding. `tests/unit/embers/bed.test.ts` holds it, and
`fire.test.ts` now asks every preset whether its splinters actually reach the air
— which replaced an upper bound on the population that was only ever a proxy for
this, and a bad one, since a scene is allowed to sit at its ceiling.

## `churn` is the one control whose right value depends on the framing

The fire sheds eddies at its own puffing frequency, `f ≈ 1.5/√D` — so a
four-metre bed breathes once every 1.33 s. Stand a metre from it and an eddy
crosses the picture in about half of one, so eddies arrive less often than they
leave and the flow goes quiet between them. Measured on the primary: at
`churn` 0.35 the mean is 0.59 eddies with **55% of frames empty**; at 1.4 it is
1.70 and 8%. Nothing is broken at the low end — it is a duty cycle, and the debug
overlay reporting `0 vortices` is a sampled instant rather than a dead field.

## Traps

- **`flare` is the performance control, and `count` is not.** Compositing a
  scaled sprite costs its _destination area_, so a frame costs the sum of the
  squares of the halo radii. Three thousand embers at `flare` 1.2 is 27 ms of
  drawing; the same three thousand at 0.8 is half that. This is the opposite of
  what anybody guesses, which is why the dense presets carry a lower flare rather
  than fewer embers. `experiment.debug(true)` prints `drawMs` separately from
  `fps` precisely so the two can be told apart.

  The relationship is held by `tests/unit/embers/mark.test.ts`, on `haloRadius`,
  and **not** by a timing assertion — which was tried and was genuinely flaky.
  The section's own advice is that a headless run's absolute frame times are
  pessimistic and its _ratios_ are trustworthy, and that does not survive four
  parallel workers: contention is added to both halves of a wall-clock ratio, so
  it approaches 1 at enough load. The same comparison gives 8 ms against 1.6 ms
  run alone and 30.7 ms against 15.5 ms under load — it failed one run in three
  and passed every time it was run by itself. The magnitudes above are the
  record; the mechanism is the test.

- **The primary is a bed wider than the frame, and that is not a stylistic
  choice.** A narrow fire makes a column up the middle, which on the note is
  exactly where the sheet of text sits — so the backdrop was a piece you could
  not see. `about.astro` reads the primary's `span`, `bed` and `hearth` for that
  reason and turns down only the busyness.
- **A symmetric hue rotation runs past red into magenta.** `hueSpread` rotates
  the locus both ways, so at a spread of 14° the cool end of a fire at `hue` 20
  lands at −15° and you get pink embers, which read as a bug rather than as
  variety. The fire presets sit at 4–6°; `foxfire` uses 52 on purpose, because
  there it is the point. A real fire's colour variety is _temperature_, and the
  ramp already gives that for free.
- **The named query parameters are dead once `s` is readable.** `settingsFromQuery`
  returns on the packed form, so `?s=…&flare=2` ignores the flare. That is the
  documented precedence and it will still waste twenty minutes of comparison
  screenshots — drop `s` entirely when exploring by URL, and the named params
  layer over `DEFAULT_SETTINGS`.
- **`margin` and `flank` are different numbers on purpose.** How far above the
  frame an ember is still simulated has to be generous, because an ember thrown
  above the picture very often comes back down. Sideways does not: it is not
  coming back. They were the same number, which simulated embers nearly two
  metres outside the picture _and_ made "left through the side" — one of the four
  things the piece exists to show — almost unreachable, because an ember burns
  out crossing that much dead air.

## The one place the physics is not taken at its word

**The flutter frequency.** The Strouhal relation gives `0.2·U/d`, which for a
2 mm ember at 2 m/s is about 200 Hz — above the display's own rate, and with a
half-turn excursion of about five millimetres, which is a fraction of a pixel at
any framing this piece has. So a physically paced flutter is invisible and
aliased at the same time. The relation is kept for the **ordering** it genuinely
settles — small and fast tumbles quicker — and the result is compressed into
`FLUTTER_BAND`, 0.5 to 6 Hz. Above six it beads a streak into a dotted line at
60 Hz and reads as a dropped frame.

Everything a viewer actually reads as a zig-zag is the eddy field, not the
flutter. If somebody asks for more visible wobble, `swirl` and `churn` are the
honest answers.

## What this piece deliberately does not have

- **No seed, and no reroll.** A continuous emission has no arrangement to
  preserve — the scene rerolls itself, constantly. The one seeded thing is the
  set of outlines in `draw.ts`, so a recaptured poster gets the same silhouettes.
  A consequence worth knowing: **no capture of this piece is reproducible**, for
  the same reason Starry Night's is not.
- **No `runner.ts`.** The piece is not published as a background anywhere yet, and
  a runner is opt-in by having the file. Adding one is a small job — `read`,
  `mount`, and the piece's own scene modules — but it commits a frozen bundle, so
  do it when something wants to embed the piece rather than in advance.
- **No `playback`.** The other pieces have one; this has `pause` and nothing
  needed a slow-motion fire enough to spend a slot on it.
