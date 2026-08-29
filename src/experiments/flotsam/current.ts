/**
 * The current: where the water itself is going.
 *
 * The other half of the piece, and the opposite of the waves in every way that
 * matters. A wave moves a float and gives it back; a current takes it. Turn the
 * waves up and the specks churn violently in place. Turn the current up and they
 * leave, however calm it looks.
 *
 * Two parts, because "currents coming from different directions" is two
 * different claims:
 *
 * - **A set and a drift.** The sailor's pair: which way the water is going, and
 *   how fast. One vector over the whole frame.
 * - **Eddies.** A slowly turning field of gyres, so that different parts of the
 *   frame genuinely disagree about which way is downstream. This is what puts
 *   shear lines and slack water in the same picture.
 *
 * ## Why the eddies are a stream function
 *
 * The eddy field is built as ψ and read as its perpendicular gradient, which
 * makes it **divergence-free by construction**: ∇·u = ∂²ψ/∂x∂y − ∂²ψ/∂y∂x = 0,
 * exactly, at every point and for any number of terms.
 *
 * That is not tidiness. A field of sines used directly as a velocity has sources
 * and sinks in it — places the water flows out of and places it flows into — and
 * floating things pile up at the sinks and never leave. Within a minute the
 * piece is a handful of permanent clots on an empty sea, and it looks exactly
 * like a bug in the wave code. Incompressible water cannot do that, so the
 * eddies stir the specks around without ever concentrating them, and every clump
 * you see is the waves' doing. Keeping those two apart is what makes the
 * gathering readable at all.
 *
 * ## Why it is also periodic on the patch, which is the harder half
 *
 * Being divergence-free on the plane is not enough, and finding that out cost
 * an afternoon. The specks live on a wrapped patch (`view.ts`), and a flow only
 * carries a uniform density around a torus if it is *periodic on that torus* —
 * otherwise the fundamental domain is stretched by the flow and then folded back
 * onto itself unevenly, and the density piles up however incompressible the
 * field was on the plane. Measured with the waves switched off entirely and
 * eddies alone: a minute of a non-periodic field took the index of dispersion
 * from 1 to **134**, which is to say it emptied most of the frame and swept
 * everything into a few clots. It looked like a spectacular emergent result.
 *
 * So each term's wave vector is quantised to a whole number of cycles across the
 * patch. The cost is that `gyre` is quantised too, and that a gyre asked to be
 * larger than the patch comes back at the patch — which is the right answer
 * anyway, since a turn larger than the frame is a uniform current and that is
 * what `drift` is for. The field therefore depends on the patch, so it is
 * rebuilt when the span changes or the window is resized.
 */

import { hashSeed, makeRng } from "@/experiments/flotsam/random"
import { heading } from "@/experiments/flotsam/waves"

/**
 * Terms in the stream function.
 *
 * Three is the fewest that stops the gyres reading as a grid: two crossed sines
 * make a checkerboard of counter-rotating cells of identical size, which is
 * unmistakably a pattern rather than water.
 */
const TERMS = 3

/**
 * How fast the gyres themselves wander, as a fraction of a turn per second per
 * unit of scale.
 *
 * A frozen eddy field is a fixed picture: the specks settle onto its streamlines
 * within half a minute and then trace the same loops for ever. Letting each
 * term's phase creep keeps the field a stream function at every instant — so it
 * stays exactly divergence-free — while never repeating.
 */
const WANDER = 0.035

type Term = {
  /** Wave vector, rad/m. Quantised to whole cycles across the patch. */
  kx: number
  ky: number
  /** Its magnitude, carried so the amplitude does not have to recompute it. */
  k: number
  /** Amplitude of ψ, in m²/s. */
  amplitude: number
  phase: number
  /** Radians per second the phase creeps. */
  wander: number
}

export type Current = {
  /** The uniform part, in m/s. */
  setX: number
  setY: number
  terms: Term[]
  /** Largest speed the eddy part can reach anywhere, in m/s. */
  eddyPeak: number
}

export type CurrentSpec = {
  seed: number
  /** Speed of the uniform part, in m/s. */
  drift: number
  /** Direction it flows toward, in degrees counter-clockwise from screen-right. */
  bearing: number
  /** Peak speed of the swirling part, in m/s. */
  eddies: number
  /** Rough diameter of a gyre, in metres. */
  gyre: number
}

/**
 * Builds the current for a patch of the given size, in metres.
 *
 * Both dimensions are needed, not just a scale: the quantisation is a whole
 * number of cycles across the patch in each direction separately, and the patch
 * is only square by accident.
 */
export function createCurrent(spec: CurrentSpec, patchWidth: number, patchHeight: number): Current {
  const [setX, setY] = heading(spec.bearing)
  const rng = makeRng(hashSeed(spec.seed, 0xed1))
  const terms: Term[] = []

  const width = Math.max(1e-3, patchWidth)
  const height = Math.max(1e-3, patchHeight)

  // Scales spread around `gyre` rather than sitting on it, so the field has
  // large slow turns with smaller ones inside them instead of one cell size
  // repeated. Kept inside a factor of two either way: wider than that and the
  // smallest term becomes visual noise while the largest leaves the frame.
  for (let i = 0; i < TERMS; i++) {
    const scale = spec.gyre * (0.55 + 1.1 * rng())
    const wanted = (2 * Math.PI) / Math.max(0.05, scale)
    const [dx, dy] = heading(rng() * 360)

    // Whole cycles across the patch, in each direction. This is the periodicity
    // the torus needs; see the note at the top of the file.
    let cyclesX = Math.round((wanted * dx * width) / (2 * Math.PI))
    let cyclesY = Math.round((wanted * dy * height) / (2 * Math.PI))
    if (cyclesX === 0 && cyclesY === 0) {
      // A turn larger than the patch rounds to nothing, which would be a term
      // with no velocity in it. One cycle across the longer axis is the largest
      // eddy the patch can hold, and anything bigger is a uniform current.
      if (Math.abs(dx) >= Math.abs(dy)) cyclesX = dx >= 0 ? 1 : -1
      else cyclesY = dy >= 0 ? 1 : -1
    }

    const kx = (2 * Math.PI * cyclesX) / width
    const ky = (2 * Math.PI * cyclesY) / height
    const k = Math.hypot(kx, ky)

    terms.push({
      kx,
      ky,
      k,
      // ψ = a·sin(k·p + φ) gives |u| ≤ a·k, so the amplitude carries the 1/k
      // that makes every term contribute the same *speed* rather than the same
      // streamfunction. Without it the large gyres would be the only ones moving
      // anything and `gyre` would read as a speed control.
      amplitude: 1 / k,
      phase: rng() * Math.PI * 2,
      wander: (rng() * 2 - 1) * WANDER * k,
    })
  }

  // Normalised so the eddy setting means metres per second at the peak, not an
  // arbitrary strength. The bound is exact and reachable only where every term
  // happens to align, which is why `eddyPeak` is a ceiling rather than a typical
  // speed — the field is mostly a good deal slower than its own maximum.
  const raw = terms.reduce((total, term) => total + term.amplitude * term.k, 0)
  const gain = raw > 0 ? spec.eddies / raw : 0
  for (const term of terms) term.amplitude *= gain

  return { setX: setX * spec.drift, setY: setY * spec.drift, terms, eddyPeak: spec.eddies }
}

/**
 * The current at a point, in m/s.
 *
 * u = ∇⊥ψ = (∂ψ/∂y, −∂ψ/∂x), which is what makes it divergence-free. Writing it
 * any other way — even an algebraically equal one — is how that property gets
 * lost, so the two lines below are load-bearing and `tests/unit/flotsam/current.test.ts`
 * measures the divergence rather than trusting them.
 */
export function currentAt(current: Current, x: number, y: number, time: number, out: { x: number; y: number }): void {
  let ux = 0
  let uy = 0

  for (const term of current.terms) {
    // ψ = a·sin(kx·x + ky·y + φ + wt), so ∂ψ/∂x = a·kx·cos(...) and likewise
    // for y. The two lines below are the perpendicular gradient and nothing
    // else; writing them any other algebraically equal way is how the
    // divergence-free property gets lost.
    const c = term.amplitude * Math.cos(term.kx * x + term.ky * y + term.phase + term.wander * time)
    ux += c * term.ky
    uy -= c * term.kx
  }

  out.x = current.setX + ux
  out.y = current.setY + uy
}
