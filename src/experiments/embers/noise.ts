/**
 * 3D gradient noise, and the curl of it.
 *
 * ## Why the field is a curl and not a noise vector
 *
 * Advecting light things on a noise field made of two independent noise
 * channels gives a field with sources and sinks in it: embers pile up in the
 * places the field happens to converge and thin out where it diverges, and both
 * read as clumping the fire is doing rather than as air. Air does not do that at
 * these speeds.
 *
 * The fix is the one the section has already recorded once, in
 * `../docs/adr/20260829-a-wrapped-patch-needs-a-periodic-field.md`: take a
 * scalar field and use its **curl**, which is divergence-free by construction.
 * In two dimensions that scalar is the streamfunction ψ, and the flow is
 * `(∂ψ/∂y, −∂ψ/∂x)`. Nothing gathers, nothing thins, and what is left is
 * stirring — which is the part of turbulence this is standing in for.
 *
 * The plume and the vortices in `air.ts` are incompressible for the same reason
 * and by the same route, so the total field is too: a sum of divergence-free
 * fields is divergence-free.
 *
 * ## Why its own lattice hash rather than `hashSeed`
 *
 * `@/experiments/random`'s `hashSeed` is variadic and loops over its salts,
 * which is right for the thing it is for — deriving a private generator per
 * strand or per speck, once. Gradient noise wants eight lattice hashes per
 * sample and this piece takes eight samples per ember per frame, so at two
 * thousand embers that is half a million hashes a second and the loop shows up.
 * `lattice` below is the same avalanche idea with the arguments fixed at three
 * and no loop. It is not a second copy of `hashSeed`; it is the inner loop of
 * something `hashSeed` is not for.
 */

/**
 * The twelve edge-midpoint directions of a cube, flat.
 *
 * Perlin's set. Every component is 0 or ±1 so the dot product is three adds, and
 * the directions are evenly enough spread that no axis is favoured — which a
 * random unit vector per lattice point does not give you cheaply.
 *
 * **Flat, and indexed arithmetically**, because this is the innermost line of
 * the piece: a nested `number[][]` is a second dereference and a second bounds
 * check per component, eight times per noise sample, eight samples per ember,
 * three thousand embers, twice a frame. As an array of arrays it was a
 * measurable share of a heavy frame.
 */
const GRADIENTS = /* @__PURE__ */ Int8Array.of(
  1,
  1,
  0,
  -1,
  1,
  0,
  1,
  -1,
  0,
  -1,
  -1,
  0,
  1,
  0,
  1,
  -1,
  0,
  1,
  1,
  0,
  -1,
  -1,
  0,
  -1,
  0,
  1,
  1,
  0,
  -1,
  1,
  0,
  1,
  -1,
  0,
  -1,
  -1,
)

/** One integer lattice point to one of the twelve gradients. */
function lattice(seed: number, i: number, j: number, k: number): number {
  let h = seed ^ Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(k, 0x9e3779b1)
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b)
  h ^= h >>> 13
  return (h >>> 0) % 12
}

/** Quintic ease. Perlin's improved fade: zero first *and* second derivative at the ends. */
const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10)

/** Gradient noise on the unit lattice, roughly in [-1, 1]. */
export function noise3(seed: number, x: number, y: number, z: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const xf = x - xi
  const yf = y - yi
  const zf = z - zi

  const u = fade(xf)
  const v = fade(yf)
  const w = fade(zf)

  let value = 0
  // Accumulating rather than building a temporary: this is the hottest function
  // in the piece.
  for (let dx = 0; dx <= 1; dx++) {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dz = 0; dz <= 1; dz++) {
        const g = lattice(seed, xi + dx, yi + dy, zi + dz) * 3
        const dot = GRADIENTS[g]! * (xf - dx) + GRADIENTS[g + 1]! * (yf - dy) + GRADIENTS[g + 2]! * (zf - dz)
        const weight = (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w)
        value += dot * weight
      }
    }
  }
  return value
}

/**
 * One octave of streamfunction, in world metres and seconds.
 *
 * `scale` is the eddy size in metres and `rate` how fast that eddy size turns
 * over, which is a real relationship rather than two free numbers:
 * Kolmogorov's cascade has a structure of size ℓ turning over in a time
 * proportional to ℓ^(2/3), so small eddies churn faster than large ones. `air.ts`
 * derives the octave rates from that rather than picking them.
 */
export type Octave = { scale: number; rate: number; amplitude: number; seed: number }

/**
 * The curl of a summed noise streamfunction, written into `out`.
 *
 * Central differences rather than analytic gradients. Analytic gradients of
 * gradient noise are perfectly derivable and cost about as much as the four
 * extra samples once the chain rule through `fade` is written out, and they are
 * far easier to get subtly wrong — a sign slip in one of them produces a field
 * that still looks like swirling air and quietly has divergence in it, which is
 * exactly the failure this whole approach exists to rule out. The difference
 * step is a fixed fraction of the octave, so it scales with the eddy.
 */
export function curlNoise(octaves: readonly Octave[], x: number, y: number, time: number, out: Float64Array): void {
  let ux = 0
  let uy = 0

  for (const octave of octaves) {
    if (octave.amplitude === 0) continue
    const k = 1 / octave.scale
    const z = time * octave.rate
    // A twentieth of an eddy: fine enough that the difference is the derivative
    // and coarse enough that it is not measuring floating-point noise.
    const h = octave.scale * 0.05
    const a = octave.amplitude

    const dpsiDy = (noise3(octave.seed, x * k, (y + h) * k, z) - noise3(octave.seed, x * k, (y - h) * k, z)) / (2 * h)
    const dpsiDx = (noise3(octave.seed, (x + h) * k, y * k, z) - noise3(octave.seed, (x - h) * k, y * k, z)) / (2 * h)

    ux += a * dpsiDy
    uy -= a * dpsiDx
  }

  out[0] = ux
  out[1] = uy
}
