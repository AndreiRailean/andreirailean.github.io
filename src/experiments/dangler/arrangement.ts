/**
 * Turns a seed and the settings into strands and bulbs.
 *
 * Pure: the same settings always produce the same arrangement, which is what
 * lets a scene survive a URL and what makes `reroll` the only source of a new
 * one.
 *
 * Every strand draws from its own generator, keyed on `(seed, index, purpose)`
 * rather than pulling from one shared stream. Two reasons, both learned the hard
 * way elsewhere: strand 7 must be the same strand whether the scene holds eight
 * strands or eighty, and widening the colour spread must not quietly move a strand's
 * shape.
 */

import { makeCanopy } from "@/experiments/dangler/canopy"
import { gaussian, hashSeed, makeRng } from "@/experiments/dangler/random"
import type { StrandSpec } from "@/experiments/dangler/rope"
import type { Settings } from "@/experiments/dangler/settings"

const SALT_SHAPE = 0x5ba9e
const SALT_COLOUR = 0xc010c
const SALT_BEADS = 0xbead

/** Beads start a little below the anchor; a bulb never sits on the knot. */
const BEAD_INSET = 0.08

/**
 * A bulb's brightness multiplier at `clock`, from its own rate and phase.
 *
 * Three incommensurate terms, so a bulb never settles into an obvious pulse.
 * `rate` is in **hertz** — it was once written as hertz and then used as radians
 * per second, which stretched a bulb's cycle to between eleven and fifty
 * seconds. The control appeared to do nothing for its entire first life, which
 * is why the timescale is asserted in `checks.ts` rather than eyeballed.
 */
export function flickerAt(rate: number, phase: number, clock: number, amount: number): number {
  if (amount <= 0) return 1
  const turn = clock * rate * Math.PI * 2
  const wander =
    0.55 * Math.sin(turn + phase) +
    0.3 * Math.sin(turn * 2.37 + phase * 1.7) +
    0.15 * Math.sin(turn * 4.13 + phase * 2.9)
  return 1 + amount * 0.55 * wander
}

export type Arrangement = {
  specs: StrandSpec[]
  beadCount: number
  /** Which strand each bulb belongs to. */
  strandOf: Int32Array
  /** Position along its strand, 0 at the anchor and 1 at the free end. */
  along: Float32Array
  /** Angle around the strand's axis, measured from the carried frame's normal. */
  angle: Float32Array
  hue: Float32Array
  saturation: Float32Array
  brightness: Float32Array
  flickerPhase: Float32Array
  flickerRate: Float32Array
}

/**
 * Splits a standard deviation between a per-strand and a per-bead draw.
 *
 * A string of lights is one batch, so its bulbs are alike in a way they are not
 * alike to the next string's. Halving the deviation at each level and combining
 * in quadrature (0.5² + 0.866² = 1) keeps the *total* spread equal to what was
 * asked for, while making a strand read as a strand.
 */
const STRAND_SHARE = 0.5
const BEAD_SHARE = 0.866

export function buildArrangement(settings: Settings): Arrangement {
  const canopy = makeCanopy(settings.seed, {
    extent: settings.extent,
    ceiling: settings.ceiling,
    relief: settings.relief,
    branches: settings.branches,
  })

  const specs: StrandSpec[] = []
  const beadCount = settings.strands * settings.beads

  const strandOf = new Int32Array(beadCount)
  const along = new Float32Array(beadCount)
  const angle = new Float32Array(beadCount)
  const hue = new Float32Array(beadCount)
  const saturation = new Float32Array(beadCount)
  const brightness = new Float32Array(beadCount)
  const flickerPhase = new Float32Array(beadCount)
  const flickerRate = new Float32Array(beadCount)

  let b = 0

  for (let w = 0; w < settings.strands; w++) {
    const shape = makeRng(hashSeed(settings.seed, w, SALT_SHAPE))
    const colour = makeRng(hashSeed(settings.seed, w, SALT_COLOUR))
    const beads = makeRng(hashSeed(settings.seed, w, SALT_BEADS))

    const vary = (rng: () => number, amount: number) => 1 + settings.irregularity * gaussian(rng) * amount

    specs.push({
      anchor: canopy.anchorFor(w),
      segments: settings.segments,
      length: Math.max(0.05, settings.length * vary(shape, 0.3)),
      stiffness: Math.min(1, Math.max(0, settings.stiffness * vary(shape, 0.35))),
      set: Math.max(0, settings.set * vary(shape, 0.45)),
      coilAzimuth: shape() * 2 * Math.PI,
      coilTwist: settings.twist * vary(shape, 0.4),
    })

    // The batch this string came out of: one offset shared by all its bulbs.
    const strandHue = gaussian(colour) * settings.hueSpread * STRAND_SHARE
    const strandBright = gaussian(colour) * settings.variance * STRAND_SHARE
    const strandSat = gaussian(colour) * settings.variance * STRAND_SHARE
    const beadPhase = beads() * 2 * Math.PI

    for (let i = 0; i < settings.beads; i++) {
      const t = settings.beads === 1 ? 0.5 : BEAD_INSET + (1 - BEAD_INSET) * (i / (settings.beads - 1))

      strandOf[b] = w
      along[b] = t
      // Bulbs alternate sides down the string, with enough slop that the
      // alternation is never a visible zip.
      angle[b] = beadPhase + Math.PI * i + gaussian(beads) * 0.35

      hue[b] = settings.hue + strandHue + gaussian(colour) * settings.hueSpread * BEAD_SHARE
      brightness[b] = Math.max(0.15, 1 + (strandBright + gaussian(colour) * settings.variance * BEAD_SHARE) * 0.4)
      saturation[b] = Math.min(
        1.4,
        Math.max(0, 1 + (strandSat + gaussian(colour) * settings.variance * BEAD_SHARE) * 0.5),
      )

      flickerPhase[b] = beads() * 2 * Math.PI
      // In hertz. It was written as though it were, and then used as radians
      // per second, which put a bulb's cycle somewhere between eleven and fifty
      // seconds — a slow tide rather than a flicker, and invisible under any
      // other motion in the piece.
      flickerRate[b] = 0.35 + beads() * 1.25

      b++
    }
  }

  return { specs, beadCount, strandOf, along, angle, hue, saturation, brightness, flickerPhase, flickerRate }
}
