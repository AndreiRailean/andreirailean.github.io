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

## Traps

- **`flare` is the performance control, and `count` is not.** Compositing a
  scaled sprite costs its _destination area_, so a frame costs the sum of the
  squares of the halo radii. Three thousand embers at `flare` 1.2 is 27 ms of
  drawing; the same three thousand at 0.8 is half that. This is the opposite of
  what anybody guesses, which is why the dense presets carry a lower flare rather
  than fewer embers. `experiment.debug(true)` prints `drawMs` separately from
  `fps` precisely so the two can be told apart.
- **The picture accumulates.** Every preset has `trail` above zero, so what is on
  the glass is built from the last couple of dozen frames rather than being a
  function of the current state. **A fast-forward that draws only its final frame
  lands on a fire with no trails at all**, which is why `settle` draws the last
  two seconds of what it steps. The three surfaces that fall into this together
  are the poster, the note's backdrop and the reduced-motion still — all three
  ask the piece to arrive somewhere without watching it get there.
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
