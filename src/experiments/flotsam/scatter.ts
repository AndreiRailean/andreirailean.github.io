/**
 * The flotsam itself: what is floating, how big each piece is, and where each
 * one's patch of water is.
 *
 * Flat arrays for the whole population, as Dangler's particles are, and for the
 * same reason — the scene is expected to hold thousands and a per-speck object
 * would spend the frame chasing pointers.
 *
 * ## Speck `i` is a pure function of (seed, i)
 *
 * Its home, its size and its colour all come from generators salted with its own
 * index, never from successive draws off one stream. So raising the count adds
 * specks *beside* the ones already on screen instead of reshuffling the water,
 * and widening the colour spread cannot quietly resize anything. This is the
 * same invariant Dangler's anchors have, it broke there once, and it would break
 * here in exactly the same way.
 *
 * The live positions are the one thing that is not a function of the seed —
 * they are where the current has taken each speck since — so they are carried
 * across a rebuild rather than recomputed. Dropping them would teleport the
 * whole sea back to its starting arrangement every time a colour changed.
 */

import { gaussian, hashSeed, homeFor, makeRng } from "@/experiments/flotsam/random"
import { sizeResponse, stokesDrift, type Sea } from "@/experiments/flotsam/waves"

/** Salts, so a speck's size, colour and home cannot correlate with each other. */
const SALT_HOME = 0x40e
const SALT_SIZE = 0x512
const SALT_COLOUR = 0xc01

/** Dimmest a speck may be drawn, as a fraction of nominal. */
const MIN_BRIGHTNESS = 0.15

/** How far `variance` can push brightness and colour purity. */
const BRIGHTNESS_SWING = 0.4
const SATURATION_SWING = 0.45

export type ScatterSpec = {
  seed: number
  dots: number
  /** Radius of the smallest and largest piece, in metres. */
  smallest: number
  largest: number
  hue: number
  hueSpread: number
  variance: number
}

export type Scatter = {
  count: number
  /** Where the current has taken each speck, as a fraction of the patch. */
  u: Float32Array
  v: Float32Array
  /** Radius in metres. */
  radius: Float32Array
  hue: Float32Array
  saturation: Float32Array
  brightness: Float32Array
  /**
   * How much of each train speck `i` feels: `response[i * trains + j]`.
   *
   * Depends only on a radius and a wavelength, neither of which changes between
   * frames, so it is a table rather than an inner loop. Filled by `tune`.
   */
  response: Float32Array
  /** Wave transport per speck, in m/s. Also constant between frames. */
  stokesX: Float32Array
  stokesY: Float32Array
  /** Trains the response table was built for. */
  trains: number
}

/**
 * Sizes follow a **power law**, n(r) ∝ r⁻², drawn by inverting its own CDF.
 *
 * Log-uniform was tried first, on the reasonable-sounding ground that a range
 * spanning six octaves should be even in octaves. It is not what a sea looks
 * like and not what the piece needs. Equal numbers per octave puts a sixth of
 * the population in the top octave, which at nine thousand pieces is fifteen
 * hundred fat discs; the picture comes out as white confetti and the fine haze
 * the gathering is legible in is buried under it.
 *
 * A power law is what broken-up things actually follow — the same distribution
 * as gravel, ice floes and every other population made by something larger
 * coming apart — and at an exponent of 2 it puts ninety-three per cent of the
 * pieces in the bottom tenth of the range with a per cent or so of large ones
 * scattered through them. That is a sea with debris in it rather than a sea of
 * debris, and it is the only draw that keeps both ends of the size control
 * meaningful at once: the range has to be wide for the size-dependent wave
 * response to be visible, and the large end has to be *rare* for the picture to
 * survive it.
 *
 * The exponent is folded into the algebra rather than being a constant — for
 * n(r) ∝ r⁻², F(r) = (1/a − 1/r)/(1/a − 1/b) inverts to one division. Changing
 * it means redoing that, on purpose: it is a distribution, not a knob.
 */
function drawRadius(rng: () => number, smallest: number, largest: number): number {
  const a = Math.max(1e-4, Math.min(smallest, largest))
  const b = Math.max(a, largest)
  if (b === a) return a
  const u = rng()
  return 1 / (1 / a - u * (1 / a - 1 / b))
}

/**
 * Builds the population.
 *
 * `previous` carries live positions over, so a change that is not a reroll
 * leaves the sea where it is. Specks beyond the previous count start at their
 * home; since the patch is uniform and wrapped, dropping one in anywhere is
 * indistinguishable from dropping it in anywhere else.
 */
export function createScatter(spec: ScatterSpec, previous?: Scatter): Scatter {
  const count = Math.max(0, Math.round(spec.dots))

  const scatter: Scatter = {
    count,
    u: new Float32Array(count),
    v: new Float32Array(count),
    radius: new Float32Array(count),
    hue: new Float32Array(count),
    saturation: new Float32Array(count),
    brightness: new Float32Array(count),
    response: new Float32Array(0),
    stokesX: new Float32Array(count),
    stokesY: new Float32Array(count),
    trains: 0,
  }

  const carried = previous ? Math.min(previous.count, count) : 0

  for (let i = 0; i < count; i++) {
    const [homeU, homeV] = homeFor(hashSeed(spec.seed, SALT_HOME), i)
    scatter.u[i] = i < carried ? previous!.u[i]! : homeU
    scatter.v[i] = i < carried ? previous!.v[i]! : homeV

    scatter.radius[i] = drawRadius(makeRng(hashSeed(spec.seed, SALT_SIZE, i)), spec.smallest, spec.largest)

    const colour = makeRng(hashSeed(spec.seed, SALT_COLOUR, i))
    scatter.hue[i] = spec.hue + spec.hueSpread * gaussian(colour)
    scatter.saturation[i] = Math.max(
      0.12,
      Math.min(1, 1 - spec.variance * SATURATION_SWING * Math.abs(gaussian(colour))),
    )
    scatter.brightness[i] = Math.max(MIN_BRIGHTNESS, 1 + spec.variance * BRIGHTNESS_SWING * gaussian(colour))
  }

  return scatter
}

/**
 * Fills in everything that depends on the sea as well as on the flotsam.
 *
 * Split from `createScatter` because the two change on different occasions:
 * turning the wind up rebuilds the sea and leaves every speck exactly as it was,
 * and rebuilding the population then would throw away the positions the current
 * has spent a minute establishing.
 */
export function tune(scatter: Scatter, sea: Sea): void {
  const trains = sea.trains.length
  if (scatter.response.length !== scatter.count * trains) {
    scatter.response = new Float32Array(scatter.count * trains)
  }
  scatter.trains = trains

  const drift = { x: 0, y: 0 }

  for (let i = 0; i < scatter.count; i++) {
    const radius = scatter.radius[i]!
    const base = i * trains
    for (let j = 0; j < trains; j++) {
      scatter.response[base + j] = sizeResponse(sea.trains[j]!.k, radius)
    }
    stokesDrift(sea, scatter.response, base, drift)
    scatter.stokesX[i] = drift.x
    scatter.stokesY[i] = drift.y
  }
}
