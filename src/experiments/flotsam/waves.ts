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

import { hashSeed, makeRng } from "@/experiments/flotsam/random"

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
  /** Direction of travel, a unit vector in world metres (y up). */
  dx: number
  dy: number
  /** Wavenumber, 2π/λ, in rad/m. */
  k: number
  /** Angular frequency, √(gk), in rad/s. */
  omega: number
  /** Amplitude in metres. Half the crest-to-trough height. */
  amplitude: number
  /** Phase offset in radians. */
  phase: number
  /** Wavelength in metres. Carried for the debug overlay and for tests. */
  wavelength: number
}

export type Sea = {
  trains: Train[]
  /** Σ Aₙkₙ. At 1 the sea folds; see `SUM_STEEPNESS_MAX`. */
  steepness: number
  /** Σ Aₙ: the furthest a float can be displaced, in metres. Sets the wrap margin. */
  reach: number
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
 * Builds the sea.
 *
 * Wavelengths are spaced geometrically between `shortest` and `longest`, because
 * that is how a spectrum is read — the interesting axis of a sea is octaves, not
 * metres, and a linear spacing at a 60:1 range puts every train but one at the
 * long end.
 *
 * Steepness is shared **equally** between the trains rather than tilted toward
 * the long ones. Equal steepness means every train contributes the same amount
 * of gathering, while amplitude A = Q/k still falls with wavelength — so the
 * swell moves a float by a third of a metre and the ripples by a centimetre,
 * which is the right ordering and comes out of the physics rather than out of a
 * weighting anyone had to choose.
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
  const share = total / count

  const rng = makeRng(hashSeed(spec.seed, 0x5ea))
  const trains: Train[] = []
  let reach = 0

  for (let j = 0; j < count; j++) {
    // Geometric in wavelength. A single train sits at the geometric mean of the
    // two ends rather than at either, so collapsing the count does not silently
    // pick a side of the range the reader set.
    const t = count === 1 ? 0.5 : j / (count - 1)
    const wavelength = shortest * (longest / shortest) ** t

    const stratum = count === 1 ? 0 : (2 * (j + 0.5)) / count - 1
    const jitter = (rng() * 2 - 1) / count
    const angle = spec.heading + spec.spread * Math.max(-1, Math.min(1, stratum + jitter))
    const [dx, dy] = heading(angle)

    const k = (2 * Math.PI) / wavelength
    const amplitude = share / k
    reach += amplitude

    trains.push({
      dx,
      dy,
      k,
      omega: Math.sqrt(G * k),
      amplitude,
      phase: rng() * Math.PI * 2,
      wavelength,
    })
  }

  return { trains, steepness: total, reach }
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
    const a = weight * train.amplitude
    const speed = train.omega * train.k * a * a
    x += speed * train.dx
    y += speed * train.dy
  }

  out.x = x
  out.y = y
}
