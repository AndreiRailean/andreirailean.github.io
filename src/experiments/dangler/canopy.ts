import { discPoint, hashSeed, makeRng, r2Point } from "@/experiments/dangler/random"

/**
 * The invisible object the wires hang from.
 *
 * Anchors are pinned to one uneven thing overhead, which means their heights are
 * *correlated* — neighbours hang from similar heights because a surface is not
 * noise. Scattering heights independently is wrong in a way that is invisible at
 * three wires and unmistakable at thirty: the anchors stop reading as one object
 * and start reading as a random spray.
 *
 * A two-octave value-noise height field is the cheapest thing that reads as a
 * surface. If it turns out too smooth and the object wants actual branches —
 * anchors clumping along lines, the way lights really get slung — that is a
 * replacement behind `anchorFor`, not a rework of anything downstream.
 */

export type Anchor = { x: number; y: number; z: number }

export type Canopy = {
  /** Anchor `i`. A pure function of the seed and `i`, never of how many exist. */
  anchorFor: (index: number) => Anchor
}

export type CanopyShape = {
  /** Radius of the disc the anchors are spread over, in world units. */
  extent: number
  /** Mean height above the viewer, in world units. */
  ceiling: number
  /** How far the surface departs from that mean. 0 is a flat ceiling. */
  relief: number
  /** Arms the anchors are strung along. 0 spreads them evenly instead. */
  branches: number
}

const smoothstep = (t: number) => t * t * (3 - 2 * t)

/** Value noise on an integer lattice, hashed rather than tabulated. */
function valueNoise(salt: number, x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = smoothstep(x - ix)
  const fy = smoothstep(y - iy)

  const corner = (cx: number, cy: number) => hashSeed(salt, cx, cy) / 4294967296

  const top = corner(ix, iy) * (1 - fx) + corner(ix + 1, iy) * fx
  const bottom = corner(ix, iy + 1) * (1 - fx) + corner(ix + 1, iy + 1) * fx
  return (top * (1 - fy) + bottom * fy) * 2 - 1
}

export function makeCanopy(seed: number, shape: CanopyShape): Canopy {
  // One draw decides where the whole R2 lattice sits, so the sequence stays
  // indexed by i while still differing between seeds.
  const offsets = makeRng(hashSeed(seed, 0x5a17))
  const offsetU = offsets()
  const offsetV = offsets()

  const branchSalt = hashSeed(seed, 0xb2a4c)
  const coarseSalt = hashSeed(seed, 0xc0a125)
  const fineSalt = hashSeed(seed, 0xf19e)

  // Wavelengths relative to the disc: one broad lump across the whole canopy,
  // and a finer ripple that is deliberately not a harmonic of it.
  const coarse = Math.max(shape.extent, 0.001)
  const fine = coarse / 2.3

  function heightAt(x: number, y: number): number {
    const lumps = 0.65 * valueNoise(coarseSalt, x / coarse, y / coarse)
    const ripple = 0.35 * valueNoise(fineSalt, x / fine, y / fine)
    return shape.ceiling + shape.relief * (lumps + ripple)
  }

  const branches = Math.max(0, Math.round(shape.branches))

  /**
   * Where one arm of the canopy runs.
   *
   * Arms start well away from the trunk rather than at it, which is what makes
   * them read as separate clumps rather than as spokes on a wheel — the same
   * arrangement converging on a single point looks like one object, however many
   * arms it has. Each gets its own reach, sweep and height, so the canopy has a
   * shape instead of a symmetry.
   */
  function arm(index: number) {
    const rng = makeRng(hashSeed(branchSalt, index))
    const share = (2 * Math.PI) / Math.max(1, branches)
    return {
      // Evenly spaced, then jittered — enough to avoid a rosette, not enough to
      // let two arms collapse onto each other.
      heading: index * share + (rng() - 0.5) * share * 0.65,
      inner: shape.extent * (0.16 + 0.14 * rng()),
      reach: shape.extent * (0.62 + 0.38 * rng()),
      sweep: (rng() - 0.5) * 1.2,
      lift: (rng() - 0.5) * shape.relief * 0.9,
      droop: shape.relief * 0.45 * rng(),
    }
  }

  return {
    anchorFor(index) {
      const [u, v] = r2Point(index, offsetU, offsetV)

      if (branches < 1) {
        const [x, y] = discPoint(u, v, shape.extent)
        return { x, y, z: heightAt(x, y) }
      }

      // Round-robin, so an arm's membership depends on the anchor's index and
      // never on how many anchors exist — raising the wire count still adds
      // wires rather than redealing the ones already hanging.
      const branch = arm(index % branches)
      const along = u
      const radius = branch.inner + (branch.reach - branch.inner) * along
      const heading = branch.heading + branch.sweep * along
      // A little to either side of the arm, so bulbs hang off it rather than
      // threading through its exact centre.
      const offset = shape.extent * 0.055 * (v * 2 - 1)

      const x = Math.cos(heading) * radius - Math.sin(heading) * offset
      const y = Math.sin(heading) * radius + Math.cos(heading) * offset
      // Arms bend down toward their tips, which is most of what keeps a branch
      // from reading as a rod.
      return { x, y, z: heightAt(x, y) + branch.lift - branch.droop * along * along }
    },
  }
}
