/**
 * Turns a seed and the settings into wires and bulbs.
 *
 * Pure: the same settings always produce the same arrangement, which is what
 * lets a scene survive a URL and what makes `reroll` the only source of a new
 * one.
 *
 * Every wire draws from its own generator, keyed on `(seed, index, purpose)`
 * rather than pulling from one shared stream. Two reasons, both learned the hard
 * way elsewhere: wire 7 must be the same wire whether the scene holds eight
 * wires or eighty, and widening the colour spread must not quietly move a wire's
 * shape.
 */

import { makeCanopy } from "@/experiments/dangler/canopy"
import { gaussian, hashSeed, makeRng } from "@/experiments/dangler/random"
import type { WireSpec } from "@/experiments/dangler/rope"
import type { Settings } from "@/experiments/dangler/settings"

const SALT_SHAPE = 0x5ba9e
const SALT_COLOUR = 0xc010c
const SALT_BEADS = 0xbead

/** Beads start a little below the anchor; a bulb never sits on the knot. */
const BEAD_INSET = 0.08

export type Arrangement = {
  specs: WireSpec[]
  beadCount: number
  /** Which wire each bulb belongs to. */
  wireOf: Int32Array
  /** Position along its wire, 0 at the anchor and 1 at the free end. */
  along: Float32Array
  /** Angle around the wire's axis, measured from the carried frame's normal. */
  angle: Float32Array
  hue: Float32Array
  saturation: Float32Array
  brightness: Float32Array
  flickerPhase: Float32Array
  flickerRate: Float32Array
}

/**
 * Splits a standard deviation between a per-wire and a per-bead draw.
 *
 * A string of lights is one batch, so its bulbs are alike in a way they are not
 * alike to the next string's. Halving the deviation at each level and combining
 * in quadrature (0.5² + 0.866² = 1) keeps the *total* spread equal to what was
 * asked for, while making a wire read as a wire.
 */
const WIRE_SHARE = 0.5
const BEAD_SHARE = 0.866

export function buildArrangement(settings: Settings): Arrangement {
  const canopy = makeCanopy(settings.seed, {
    extent: settings.extent,
    ceiling: settings.ceiling,
    relief: settings.relief,
  })

  const specs: WireSpec[] = []
  const beadCount = settings.wires * settings.beads

  const wireOf = new Int32Array(beadCount)
  const along = new Float32Array(beadCount)
  const angle = new Float32Array(beadCount)
  const hue = new Float32Array(beadCount)
  const saturation = new Float32Array(beadCount)
  const brightness = new Float32Array(beadCount)
  const flickerPhase = new Float32Array(beadCount)
  const flickerRate = new Float32Array(beadCount)

  let b = 0

  for (let w = 0; w < settings.wires; w++) {
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
    const wireHue = gaussian(colour) * settings.hueSpread * WIRE_SHARE
    const wireBright = gaussian(colour) * settings.variance * WIRE_SHARE
    const wireSat = gaussian(colour) * settings.variance * WIRE_SHARE
    const beadPhase = beads() * 2 * Math.PI

    for (let i = 0; i < settings.beads; i++) {
      const t = settings.beads === 1 ? 0.5 : BEAD_INSET + (1 - BEAD_INSET) * (i / (settings.beads - 1))

      wireOf[b] = w
      along[b] = t
      // Bulbs alternate sides down the string, with enough slop that the
      // alternation is never a visible zip.
      angle[b] = beadPhase + Math.PI * i + gaussian(beads) * 0.35

      hue[b] = settings.hue + wireHue + gaussian(colour) * settings.hueSpread * BEAD_SHARE
      brightness[b] = Math.max(0.15, 1 + (wireBright + gaussian(colour) * settings.variance * BEAD_SHARE) * 0.4)
      saturation[b] = Math.min(
        1.4,
        Math.max(0, 1 + (wireSat + gaussian(colour) * settings.variance * BEAD_SHARE) * 0.5),
      )

      flickerPhase[b] = beads() * 2 * Math.PI
      flickerRate[b] = 0.12 + beads() * 0.45

      b++
    }
  }

  return { specs, beadCount, wireOf, along, angle, hue, saturation, brightness, flickerPhase, flickerRate }
}
