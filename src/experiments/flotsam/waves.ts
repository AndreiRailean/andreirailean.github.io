/**
 * The sea: a spectrum of Gerstner wave trains, and what one does to a float.
 *
 * Pure functions of position, time and a seed. Nothing here touches a canvas or
 * remembers anything between frames, which is what lets the whole of it be
 * measured outside a browser — and this is a piece where almost nothing that
 * matters can be seen.
 *
 * ## Why Gerstner rather than a heightfield
 *
 * A sine heightfield says how high the water is. It says nothing about where a
 * floating thing goes, which is the entire subject here. A Gerstner (trochoidal)
 * wave is written the other way round — as the *motion of the water itself*:
 *
 *     p(t) = p₀ − d·A·sin(ψ)          horizontal
 *     h(t) =      A·cos(ψ)            vertical
 *     ψ    = k(d·p₀) − ωt + φ
 *
 * so a parcel of water traces a circle of radius A and comes back to where it
 * started. That is the fact the piece exists to show: **a wave passing under a
 * float moves it, and does not take it anywhere.** Chase a leaf on the sea and
 * it bobs in place while the wave leaves without it.
 *
 * Two things fall out of the same formula for free, and both of them are the
 * reason this piece looks like water rather than like dots on a sine wave:
 *
 * - **Specks gather into lines.** The map p₀ → p is compressive: its Jacobian
 *   along the wave's own direction is 1 − Ak·cos(ψ), smallest at the crest. So
 *   floating things crowd toward the crests and thin in the troughs, all on
 *   their own, and with several trains crossing they collect into the drifting
 *   bands a sea actually shows. Nothing seeds them and nothing draws them.
 * - **Steepness has a hard limit.** At Ak = 1 the crest comes to a point; past
 *   it the map folds over itself and the water turns inside out. `SUM_STEEPNESS_MAX`
 *   is that limit, and `jacobian()` is how a test checks the sea has not
 *   crossed it.
 *
 * ## Why the speed of a wave is not a setting
 *
 * Deep water is dispersive: ω = √(gk), so a long wave travels faster than a
 * short one and there is nothing to choose. That is not a shortcut, it is the
 * control the piece actually has — `span` decides whether the frame holds a
 * pond or an ocean, and dispersion then decides how fast what is in it moves.
 * A metre of ripple crosses a 4m frame in three seconds; a forty-metre swell
 * crosses a 200m frame in twenty-five. The same piece is frantic at one end of
 * the span slider and glacial at the other, without a tempo control anywhere.
 */

import { hashSeed, makeRng } from "@/experiments/random"

/** Standard gravity, in m/s². Taken literally, like every other unit here. */
export const G = 9.80665

/**
 * Largest total steepness the sea is allowed to reach, as Σ Aₙkₙ.
 *
 * Below 1 the displacement map is injective — every point of water comes from
 * exactly one rest position. At 1 it is singular at the crests and above it the
 * map folds, which shows as specks passing through one another and a crest that
 * turns inside out. The margin is deliberate: the bound Σ Aₙkₙ < 1 is the worst
 * case over all phases and all directions, so a sea at 0.92 is comfortably inside
 * it however the trains happen to line up.
 */
export const SUM_STEEPNESS_MAX = 0.92

export type Train = {
  /** Direction of travel, a unit vector in world metres (y up). Gusts turn it. */
  dx: number
  dy: number
  /** Where it points with no wind variation, in degrees. */
  baseAngle: number
  /** Wavenumber, 2π/λ, in rad/m. Fixed: gusts move energy, never wavelength. */
  k: number
  /** Angular frequency, √(gk), in rad/s. */
  omega: number
  /** Amplitude in metres, as the wind is now. Half the crest-to-trough height. */
  amplitude: number
  /** Amplitude averaged over the wind, which is what wave drift is computed from. */
  baseAmplitude: number
  /** Share of the sea's steepness this train holds when the wind is steady. */
  weight: number
  /** Phase offset in radians. */
  phase: number
  /** Wavelength in metres. Carried for the debug overlay and for tests. */
  wavelength: number
  /** Two incommensurate rates, so the gust envelope never repeats. rad/s. */
  gustRate: number
  gustRate2: number
  gustPhase: number
  gustPhase2: number
  /** This train's own veering, on top of the wind's. */
  swingRate: number
  swingPhase: number
}

export type Sea = {
  trains: Train[]
  /** Σ Aₙkₙ. At 1 the sea folds; see `SUM_STEEPNESS_MAX`. */
  steepness: number
  /**
   * The furthest a float can be displaced, in metres — Σ Aₙ at the gust state
   * that maximises it, not at the current one. Sets the wrap margin, which
   * cannot change from frame to frame: the specks' homes are fractions of the
   * patch, so resizing it would move every one of them at once.
   */
  reach: number
  /** The wind's own veering, shared by every train. rad/s and radians. */
  veerRate: number
  veerPhase: number
}

export type SeaSpec = {
  seed: number
  /** How many trains the spectrum is sampled at. */
  trains: number
  /** Shortest and longest wavelength, in metres. */
  shortest: number
  longest: number
  /** Total steepness, Σ Aₙkₙ. Clamped to `SUM_STEEPNESS_MAX`. */
  steepness: number
  /**
   * How concentrated the spectrum is, 0 to 1. At 0 every train carries the same
   * steepness; at 1 nearly all of it is in the middle one.
   */
  peak: number
  /** How much the wind varies, 0 to 1. Drives `gustSea`. */
  gusts: number
  /** Mean direction of travel, in degrees counter-clockwise from screen-right. */
  heading: number
  /** Half-width of the angular fan about `heading`, in degrees. */
  spread: number
}

/**
 * Degrees to a unit vector, counter-clockwise from screen-right.
 *
 * The one place the section's angle convention lives, used by the waves, the
 * current and the light alike. Zero points right, ninety points up the screen —
 * a maths plot, not a compass. World +Y is up and the canvas flips it at draw
 * time, exactly as Dangler's camera does, so nothing below has to think about
 * which way a pixel row runs.
 */
export function heading(degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180
  return [Math.cos(radians), Math.sin(radians)]
}

/**
 * The narrowest and broadest the spectrum's peak gets, in train indices.
 *
 * `peak` interpolates between them geometrically. At 0 the width is many times
 * the train count, so every train carries the same steepness and the sea is as
 * flat a spectrum as it can be; at 1 it is under half a train and the sea is one
 * component with the others at a thousandth of it.
 */
const PEAK_NARROW = 0.35
const PEAK_BROAD_PER_TRAIN = 1.5

/** How deeply a gust can cut or boost one train's share, at `gusts` 1. */
const GUST_DEPTH = 0.7

/** How far the wind veers at `gusts` 1, in degrees. */
const VEER_DEGREES = 11

/** A train's own veering, as a fraction of the wind's. */
const OWN_SWING = 0.6

/**
 * Builds the sea.
 *
 * Wavelengths are spaced geometrically between `shortest` and `longest`, because
 * that is how a spectrum is read — the interesting axis of a sea is octaves, not
 * metres, and a linear spacing at a 60:1 range puts every train but one at the
 * long end.
 *
 * ## Why the steepness is shared out unevenly
 *
 * It was shared equally at first, and equal shares force a trade the piece
 * cannot afford. The gathering a train produces goes with *its own* steepness,
 * so with the budget split N ways, two trains give hard clean lines and a
 * mechanically regular sea, and nine give a nicely irregular one that barely
 * gathers anything. There was no setting that was both, and the first version of
 * this piece shipped at two trains and looked like it.
 *
 * A real sea is not flat across its components; it is **peaked**. Almost all the
 * energy sits near one wavelength, with a skirt of weaker components either side
 * of it, and the irregularity everyone recognises — the uneven crest spacing,
 * the sets of larger waves — is the beating between those neighbours. So
 * `peak` narrows a Gaussian over the train indices, and at a high peak with many
 * trains you get both at once: the dominant train draws the lines, and its
 * neighbours, a wavelength or two either side, keep them from arriving on a
 * metronome.
 *
 * The same weighting quietly makes the **directional** spectrum peaked too, and
 * that is not a coincidence worth undoing. Train `j`'s place in the fan and its
 * share of the energy both come from `j`, so the dominant train sits at the mean
 * heading and the weak ones fan out to the edges — which is the shape a real
 * directional spectrum has, and it is what keeps `heading` meaning "where the
 * sea is running" rather than "the middle of a spray of equals".
 *
 * **Directions are stratified, and therefore not stable under a change of
 * count.** Train `j` fans to (2(j+½)/N − 1)·spread about the heading, plus a
 * seeded jitter of less than one stratum, so N trains always cover the fan
 * evenly. The cost is that adding a train re-lays every direction: the sea
 * changes rather than gaining a wave. That is the opposite of the rule the
 * specks follow, and it is a deliberate trade — with directions drawn from an
 * indexed sequence instead, two trains at N = 2 can land within a few degrees of
 * each other and `spread` looks broken at exactly the setting where it should be
 * clearest. Evenness is the property `spread` promises; stability is not.
 */
export function createSea(spec: SeaSpec): Sea {
  const count = Math.max(1, Math.round(spec.trains))
  const shortest = Math.max(0.02, Math.min(spec.shortest, spec.longest))
  const longest = Math.max(shortest, spec.longest)
  const total = Math.min(SUM_STEEPNESS_MAX, Math.max(0, spec.steepness))
  const peak = Math.min(1, Math.max(0, spec.peak))
  const gusts = Math.min(1, Math.max(0, spec.gusts))

  const rng = makeRng(hashSeed(spec.seed, 0x5ea))
  const trains: Train[] = []

  // Geometric in the width, so the control behaves the same at every train
  // count: at 0 the Gaussian is far wider than the spectrum and reads as flat.
  const broad = PEAK_BROAD_PER_TRAIN * count
  const width = PEAK_NARROW * (broad / PEAK_NARROW) ** (1 - peak)
  const centre = (count - 1) / 2

  for (let j = 0; j < count; j++) {
    // Geometric in wavelength. A single train sits at the geometric mean of the
    // two ends rather than at either, so collapsing the count does not silently
    // pick a side of the range the reader set.
    const t = count === 1 ? 0.5 : j / (count - 1)
    const wavelength = shortest * (longest / shortest) ** t

    const stratum = count === 1 ? 0 : (2 * (j + 0.5)) / count - 1
    const jitter = (rng() * 2 - 1) / count
    const baseAngle = spec.heading + spec.spread * Math.max(-1, Math.min(1, stratum + jitter))
    const [dx, dy] = heading(baseAngle)

    const k = (2 * Math.PI) / wavelength
    // A gust cycle of twelve to forty-five seconds, and a veer of one to three
    // minutes. The second rate is deliberately not a multiple of the first, so
    // the envelope never comes back round to where it was.
    const gustRate = (2 * Math.PI) / (12 + rng() * 33)
    trains.push({
      dx,
      dy,
      baseAngle,
      k,
      omega: Math.sqrt(G * k),
      amplitude: 0,
      baseAmplitude: 0,
      weight: Math.exp(-(((j - centre) / width) ** 2)),
      phase: rng() * Math.PI * 2,
      wavelength,
      gustRate,
      gustRate2: gustRate * (1.7 + rng() * 0.9),
      gustPhase: rng() * Math.PI * 2,
      gustPhase2: rng() * Math.PI * 2,
      swingRate: (2 * Math.PI) / (55 + rng() * 105),
      swingPhase: rng() * Math.PI * 2,
    })
  }

  const sea: Sea = {
    trains,
    steepness: total,
    reach: 0,
    veerRate: (2 * Math.PI) / (70 + rng() * 110),
    veerPhase: rng() * Math.PI * 2,
  }

  // Steady wind first: this is what `baseAmplitude` means, and it is what wave
  // drift is computed from.
  gustSea(sea, 0, 0)
  for (const train of trains) train.baseAmplitude = train.amplitude
  sea.reach = worstReach(sea, gusts)

  return sea
}

/**
 * The wind as it is at this moment: which trains are running hardest, and which
 * way they are all pointing.
 *
 * Wind is not steady. It arrives in gusts and it veers, and a sea driven by it
 * does the same — the chop gets up and lies down again, the swell comes round a
 * few degrees over a couple of minutes, and the crest spacing you were looking
 * at is not the crest spacing a minute later. Without this the piece is a fixed
 * superposition running for ever, which reads as a mechanism rather than as
 * weather however irregular the spectrum behind it is.
 *
 * **Gusts move energy between the trains; they never add any.** Σ Aₙkₙ is
 * renormalised to the steepness setting on every call, so the control keeps
 * meaning what it says and the sea cannot gust its way past the folding limit.
 * What varies is the *distribution*: the short trains come up and the long ones
 * fall back and then trade again, which is what changes the apparent period.
 *
 * Called once a frame, not once per speck — nine trains at most, and the
 * per-speck cost is unchanged. Mutates the trains in place rather than
 * allocating a sea a frame.
 *
 * At `gusts` 0 this reproduces the steady sea exactly, trigonometry and all
 * skipped, which is what makes the closed-form return property in
 * `tests/unit/flotsam/waves.test.ts` still exactly true there.
 */
export function gustSea(sea: Sea, gusts: number, time: number): void {
  const strength = Math.min(1, Math.max(0, gusts))
  const depth = GUST_DEPTH * strength
  const veer = strength > 0 ? VEER_DEGREES * strength * Math.sin(sea.veerRate * time + sea.veerPhase) : 0

  let total = 0
  for (const train of sea.trains) {
    if (depth > 0) {
      const envelope =
        0.62 * Math.sin(train.gustRate * time + train.gustPhase) +
        0.38 * Math.sin(train.gustRate2 * time + train.gustPhase2)
      train.amplitude = train.weight * (1 + depth * envelope)
    } else {
      train.amplitude = train.weight
    }
    total += train.amplitude
  }

  // `amplitude` is carrying the share until here; now it becomes a length.
  const scale = total > 0 ? sea.steepness / total : 0
  for (const train of sea.trains) {
    train.amplitude = (train.amplitude * scale) / train.k

    if (strength > 0) {
      const angle =
        train.baseAngle +
        veer +
        VEER_DEGREES * OWN_SWING * strength * Math.sin(train.swingRate * time + train.swingPhase)
      const [dx, dy] = heading(angle)
      train.dx = dx
      train.dy = dy
    }
  }
}

/**
 * The largest Σ Aₙ any gust state can produce, in metres.
 *
 * The wrap margin comes from this and has to be a constant: the specks' homes
 * are fractions of the patch, so a patch that resized itself as the wind
 * changed would drag every speck across the frame at once.
 *
 * Σ Aₙ is a ratio of two linear functions of the gust envelope, so its maximum
 * sits at a vertex — every train either fully boosted or fully cut. Boosting a
 * train helps exactly when its 1/k is above the ratio being maximised, so
 * sorting by wavelength and trying each prefix finds the vertex exactly, in
 * nine tries at most. Bounding it crudely instead would inflate the patch and
 * thin the flotsam on screen for nothing.
 */
function worstReach(sea: Sea, gusts: number): number {
  const depth = GUST_DEPTH * Math.min(1, Math.max(0, gusts))
  const order = [...sea.trains].sort((a, b) => b.wavelength - a.wavelength)

  let best = 0
  for (let boosted = 0; boosted <= order.length; boosted++) {
    let numerator = 0
    let denominator = 0
    for (let i = 0; i < order.length; i++) {
      const weight = order[i]!.weight * (1 + (i < boosted ? depth : -depth))
      numerator += weight / order[i]!.k
      denominator += weight
    }
    if (denominator > 0) best = Math.max(best, (sea.steepness * numerator) / denominator)
  }
  return best
}

/**
 * How much of a wave a float of radius `r` actually feels.
 *
 * A speck far smaller than the wavelength rides the surface exactly. A raft
 * spanning several wavelengths sits across crests and troughs at once and barely
 * moves — it averages the surface over its own footprint, and the average of a
 * sinusoid over a disc of radius r is 2J₁(kr)/(kr).
 *
 * A Gaussian in kr is used instead of that Bessel kernel, and the difference is
 * the point rather than a shortcut: 2J₁(x)/x rings, going negative past x ≈ 3.83,
 * which would have a large float heaving in *antiphase* with short ripples. A
 * float does no such thing — the physical response of a rigid body to waves it
 * cannot resolve decays, it does not invert. The exponent is fitted to the main
 * lobe (they agree to within 3% out to kr = 2, where the interesting range is)
 * and the sidelobes are dropped on purpose.
 *
 * This is why the size range is a control worth having and not just a look:
 * turn it up and the big flotsam stops noticing the chop while the specks
 * beside it still trace every ripple, and the two populations visibly come
 * apart.
 */
export function sizeResponse(k: number, radius: number): number {
  const kr = k * radius
  return Math.exp(-(kr * kr) / 8)
}

/** Indices into the array `sample()` fills. */
export const OFFSET_X = 0
export const OFFSET_Y = 1
export const HEIGHT = 2
export const SLOPE_X = 3
export const SLOPE_Y = 4
export const SAMPLE_SIZE = 5

/**
 * Where the water at rest position (x, y) has been carried to, how high it is,
 * and which way it is tilted — for a float with the given per-train response.
 *
 * `response` is indexed by train and is the float's own; it is precomputed
 * because it depends only on the float's radius and the sea, neither of which
 * changes between frames. Passing `null` samples the water itself.
 *
 * Writes into `out` rather than returning an object: this runs once per speck
 * per frame, and a scene of six thousand allocating a vector each would spend
 * more time in the collector than in the water.
 */
export function sample(
  sea: Sea,
  x: number,
  y: number,
  time: number,
  response: Float32Array | null,
  responseOffset: number,
  out: Float64Array,
): void {
  let offsetX = 0
  let offsetY = 0
  let height = 0
  let slopeX = 0
  let slopeY = 0

  for (let j = 0; j < sea.trains.length; j++) {
    const train = sea.trains[j]!
    const weight = response ? response[responseOffset + j]! : 1
    if (weight <= 0) continue

    const psi = train.k * (train.dx * x + train.dy * y) - train.omega * time + train.phase
    const s = Math.sin(psi)
    const c = Math.cos(psi)
    const a = weight * train.amplitude

    // Horizontal displacement is *against* the direction of travel at the phase
    // where sin is positive, which is what puts the forward part of the orbit at
    // the crest. Get this sign wrong and the water still looks like waves while
    // every float circles backwards.
    offsetX -= a * s * train.dx
    offsetY -= a * s * train.dy
    height += a * c

    // ∂h/∂x for h = A·cos(ψ). The slope a float feels is weighted by the same
    // response as its motion: a raft that cannot resolve a ripple does not tilt
    // to it either, so the big flotsam stays flat while the specks flash.
    const g = a * train.k * s
    slopeX -= g * train.dx
    slopeY -= g * train.dy
  }

  out[OFFSET_X] = offsetX
  out[OFFSET_Y] = offsetY
  out[HEIGHT] = height
  out[SLOPE_X] = slopeX
  out[SLOPE_Y] = slopeY
}

/**
 * Determinant of the Jacobian ∂p/∂p₀ of the displacement map.
 *
 * 1 where the water is neither gathering nor thinning, below 1 where floats are
 * crowding together, above 1 where they are spreading apart — and **negative
 * where the map has folded**, which is a sea that has turned inside out. There
 * is no way to see the difference between a steep sea and a folded one in a
 * still: both are a scatter of dots. This is the number that tells them apart,
 * and it is the piece's equivalent of Dangler's constraint error.
 *
 * The map is p = p₀ + Σ −dₙAₙsin(ψₙ), so ∂p/∂p₀ = I − Σ Aₙkₙcos(ψₙ)·dₙdₙᵀ.
 */
export function jacobian(sea: Sea, x: number, y: number, time: number): number {
  let xx = 1
  let xy = 0
  let yx = 0
  let yy = 1

  for (const train of sea.trains) {
    const psi = train.k * (train.dx * x + train.dy * y) - train.omega * time + train.phase
    const q = train.amplitude * train.k * Math.cos(psi)
    xx -= q * train.dx * train.dx
    xy -= q * train.dx * train.dy
    yx -= q * train.dy * train.dx
    yy -= q * train.dy * train.dy
  }

  return xx * yy - xy * yx
}

/**
 * Stokes drift: the small amount a wave *does* carry a float, in m/s.
 *
 * The orbits are not quite closed. A float is very slightly further forward at
 * the top of its circle, where it moves with the wave, than it is back at the
 * bottom, so each pass leaves it a little downwind of where it began. To second
 * order the residue is uₛ = ωkA² along the direction of travel.
 *
 * Written in the quantities this piece actually controls, that is
 *
 *     uₛ = Q²·c
 *
 * — the train's steepness *squared*, times its phase speed. Which says something
 * worth knowing and not at all obvious: **how far a wave carries things is
 * decided almost entirely by how steep it is, not by how big or how fast.** A
 * real ocean swell at a steepness of 0.05 drifts at a four-hundredth of its own
 * speed, a couple of centimetres a second under a crest doing eight metres —
 * which is why flotsam looks like it is going nowhere. Wind this piece up to a
 * near-breaking 0.5 and the same relation gives a quarter of the phase speed,
 * and the flotsam is genuinely swept along. Both are the same equation, and the
 * second is what breaking waves do.
 *
 * That is the whole reason the effect is worth a control of its own. It is what
 * separates "the water is moving violently" from "the flotsam is going
 * somewhere", and on any single frame it is invisible — you learn a sea has it
 * by leaving the piece running and noticing the specks have quietly ended up
 * downwind.
 *
 * Weighted by the *square* of the response, since drift goes as amplitude
 * squared and a float that only half-follows a wave only half-follows both
 * halves of its orbit. So the big flotsam lags the small in the same current,
 * which is a real thing about a real sea.
 *
 * Independent of position and time — deep water, at the surface — so a speck's
 * whole wave transport is one vector, computed when the sea changes and never
 * again.
 */
export function stokesDrift(
  sea: Sea,
  response: Float32Array | null,
  responseOffset: number,
  out: { x: number; y: number },
): void {
  let x = 0
  let y = 0

  for (let j = 0; j < sea.trains.length; j++) {
    const train = sea.trains[j]!
    const weight = response ? response[responseOffset + j]! : 1
    // The *steady* amplitude, not the gusting one. Drift is a residue of many
    // orbits rather than of the one happening now, so what matters is the wind
    // averaged over the minute a float spends creeping downwind — and computing
    // it live would mean redoing it for every speck on every frame, which is the
    // one thing this vector exists to avoid.
    const a = weight * train.baseAmplitude
    const speed = train.omega * train.k * a * a
    x += speed * train.dx
    y += speed * train.dy
  }

  out.x = x
  out.y = y
}
