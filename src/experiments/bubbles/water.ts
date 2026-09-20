/**
 * The background flow: the curl of a noise field, which is what makes it water.
 *
 * ## Why a curl and not the noise itself
 *
 * Sampling a vector of noise directly and calling it a velocity is the obvious
 * thing and it does not look like a fluid. Such a field has sources and sinks
 * scattered through it, so anything drifting in it collects in the sinks and
 * thins out of the sources — permanently, because the sinks do not move. A
 * viewer reads that instantly as particles obeying a texture.
 *
 * Taking the curl of a scalar potential gives a field whose divergence is
 * exactly zero everywhere, by construction rather than by tuning: it can move
 * water around and can never make or lose any. Foam then gathers only where the
 * jets and the ebb actually put it, which is the part of the picture that is
 * supposed to mean something.
 *
 * ## Sampled per bubble, not on a grid
 *
 * The usual arrangement is a velocity grid rebuilt each frame and sampled
 * bilinearly. That was rejected here on the arithmetic: at a 5cm eddy across a
 * three-metre tub the grid needs about 240 cells a side to resolve its own
 * features, which is 58,000 samples a frame *whatever the bubble count*.
 * Sampling per bubble costs eight lookups each — under a quarter of that at two
 * and a half thousand bubbles, exact at any eddy size, and it scales with the
 * thing the piece is actually spending its budget on.
 *
 * ## Two octaves, and why the second is not half the first
 *
 * A velocity from a potential is its derivative, so an octave's contribution to
 * speed is `amplitude / size`. Giving both octaves the same amplitude would make
 * the small one dominate the motion entirely. Amplitude scales with size here,
 * which is what puts most of the energy in the large eddies — as it is in real
 * water — and leaves the small one as texture on top.
 */

import { hashSeed } from "@/experiments/random"

/** Quintic fade: zero first *and* second derivative at the ends, so cells do not crease. */
const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10)

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * The twelve edge gradients of a cube, chosen by the corner's hash.
 *
 * Edge midpoints rather than random directions: they are uniform enough and
 * every one is a pair of ±1 with a zero, so the dot product below is two adds
 * and no multiplies.
 */
function gradient(seed: number, ix: number, iy: number, iz: number, x: number, y: number, z: number): number {
  const h = hashSeed(seed, ix, iy, iz) & 15
  const u = h < 8 ? x : y
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
}

/** Gradient noise in three dimensions, roughly in [-1, 1]. Time is the third. */
export function noise3(seed: number, x: number, y: number, z: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = x - ix
  const fy = y - iy
  const fz = z - iz
  const u = fade(fx)
  const v = fade(fy)
  const w = fade(fz)

  const x0y0z0 = gradient(seed, ix, iy, iz, fx, fy, fz)
  const x1y0z0 = gradient(seed, ix + 1, iy, iz, fx - 1, fy, fz)
  const x0y1z0 = gradient(seed, ix, iy + 1, iz, fx, fy - 1, fz)
  const x1y1z0 = gradient(seed, ix + 1, iy + 1, iz, fx - 1, fy - 1, fz)
  const x0y0z1 = gradient(seed, ix, iy, iz + 1, fx, fy, fz - 1)
  const x1y0z1 = gradient(seed, ix + 1, iy, iz + 1, fx - 1, fy, fz - 1)
  const x0y1z1 = gradient(seed, ix, iy + 1, iz + 1, fx, fy - 1, fz - 1)
  const x1y1z1 = gradient(seed, ix + 1, iy + 1, iz + 1, fx - 1, fy - 1, fz - 1)

  return lerp(
    lerp(lerp(x0y0z0, x1y0z0, u), lerp(x0y1z0, x1y1z0, u), v),
    lerp(lerp(x0y0z1, x1y0z1, u), lerp(x0y1z1, x1y1z1, u), v),
    w,
  )
}

/** How much of the flow the second octave carries, relative to the first. */
const FINE_SHARE = 0.45

/** How much smaller the second octave's eddies are. */
const FINE_SIZE = 0.38

/** How much faster the small eddies rearrange themselves. Small water turns over quicker. */
const FINE_HASTE = 2.4

/** Finite-difference step for the curl, as a fraction of the eddy size. */
const NUDGE = 0.12

/** The scalar potential the flow is the curl of. Two octaves, energy in the large one. */
function potential(seed: number, x: number, y: number, t: number, size: number, drift: number): number {
  const coarse = noise3(seed, x / size, y / size, t * drift * 0.55)
  const fine = noise3(seed ^ 0x5bf03635, x / (size * FINE_SIZE), y / (size * FINE_SIZE), t * drift * 0.55 * FINE_HASTE)
  // Amplitude scaled by eddy size, because velocity is the derivative: equal
  // amplitudes would hand all of the motion to the smallest octave.
  return size * (coarse + FINE_SIZE * FINE_SHARE * fine)
}

/**
 * The background velocity at a point, written into `out`, in m/s.
 *
 * `strength` is roughly the peak speed the flow reaches, because the potential
 * carries a factor of `size` and the curl divides it straight back out.
 */
export function curlAt(
  seed: number,
  x: number,
  y: number,
  t: number,
  size: number,
  strength: number,
  drift: number,
  out: { x: number; y: number },
): void {
  const e = Math.max(1e-4, size * NUDGE)
  const dy = potential(seed, x, y + e, t, size, drift) - potential(seed, x, y - e, t, size, drift)
  const dx = potential(seed, x + e, y, t, size, drift) - potential(seed, x - e, y, t, size, drift)
  const k = strength / (2 * e)
  out.x = dy * k
  out.y = -dx * k
}
