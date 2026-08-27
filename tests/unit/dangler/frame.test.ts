import { describe, expect, it } from "vitest"
import { buildArrangement } from "@/experiments/dangler/arrangement"
import { createFrames, updateFrames } from "@/experiments/dangler/frame"
import { createRopes } from "@/experiments/dangler/rope"
import { DEFAULT_SETTINGS, normalizeSettings } from "@/experiments/dangler/settings"
import { createWind } from "@/experiments/dangler/wind"

/**
 * Rotation-minimising frames, so bulbs can sit off the centreline.
 *
 * Never derive a frame from a direction inside a loop that walks a curve:
 * picking two perpendiculars requires choosing a reference axis, and every
 * choice flips somewhere on the sphere, folding the rest shape where the wire
 * curls past it. Both `restDirections` and `frame.ts` transport a frame instead.
 */

type Frames = ReturnType<typeof createFrames>
type Vector = { x: number; y: number; z: number }

const framed = (settings: typeof DEFAULT_SETTINGS) => {
  const arrangement = buildArrangement(settings)
  const ropes = createRopes(arrangement.specs)
  ropes.settle()
  const frames = createFrames(ropes.particleCount)
  updateFrames(ropes, frames)
  return { arrangement, ropes, frames }
}

const normalAt = (frames: Frames, i: number): Vector => ({ x: frames.nx[i]!, y: frames.ny[i]!, z: frames.nz[i]! })

/** Angle between two unit vectors, guarded against a domain error at ±1. */
const angleBetween = (a: Vector, b: Vector) => Math.acos(Math.min(1, Math.max(-1, a.x * b.x + a.y * b.y + a.z * b.z)))

const degrees = (radians: number) => (radians * 180) / Math.PI

describe("along the wire", () => {
  // Finely segmented and strongly curled: the case where a frame derived from a
  // reference axis would flip.
  const { ropes, frames } = framed({ ...DEFAULT_SETTINGS, set: 2.2, twist: 1.5, segments: 60 })

  const worstOverParticles = (measure: (i: number) => number) => {
    let worst = 0
    for (let wire = 0; wire < ropes.wireCount; wire++) {
      for (let i = ropes.offset[wire]!; i < ropes.offset[wire + 1]!; i++) worst = Math.max(worst, measure(i))
    }
    return worst
  }

  it("keeps the normal perpendicular to the tangent", () => {
    const worst = worstOverParticles((i) =>
      Math.abs(frames.tx[i]! * frames.nx[i]! + frames.ty[i]! * frames.ny[i]! + frames.tz[i]! * frames.nz[i]!),
    )
    expect(worst).toBeLessThan(1e-5)
  })

  it("keeps the normal a unit vector", () => {
    const worst = worstOverParticles((i) => Math.abs(Math.hypot(frames.nx[i]!, frames.ny[i]!, frames.nz[i]!) - 1))
    expect(worst).toBeLessThan(1e-5)
  })

  it("never flips the normal between neighbours", () => {
    let worst = 0
    for (let wire = 0; wire < ropes.wireCount; wire++) {
      for (let i = ropes.offset[wire]! + 1; i < ropes.offset[wire + 1]!; i++) {
        worst = Math.max(worst, angleBetween(normalAt(frames, i), normalAt(frames, i - 1)))
      }
    }
    expect(worst, `max turn ${degrees(worst).toFixed(2)}°`).toBeLessThan(0.35)
  })
})

/**
 * A frame must be carried through time, not only along the wire.
 *
 * A rotation-minimising frame is minimal along the *curve*; nothing about that
 * makes it steady between rendered frames, and re-propagating it from the wire's
 * start each frame lets any change of shape accumulate into a large roll at the
 * free end. Bulbs ride that frame, so they visibly turn on their strings — and
 * the tip bulbs are the near, large ones.
 *
 * Every check in the block above passes throughout on a frame that is quietly
 * rotating. This is the only one that catches it.
 */
describe("through time", () => {
  const SETTINGS = normalizeSettings({
    wires: 24,
    beads: 9,
    segments: 26,
    extent: 3.5,
    ceiling: 4,
    relief: 1.35,
    branches: 7,
    length: 4.45,
    stiffness: 1,
    set: 2.5,
    twist: -0.13,
    irregularity: 0.39,
    breeze: 0.33,
    gust: 0.1,
    gustRate: 17,
    seed: 398902,
  })

  const SECONDS = 12
  const FRAMES = 60 * SECONDS
  const SUBSTEPS = 8

  /** Total turning of each particle's normal, and the worst single-frame jump. */
  const measureUnderWind = () => {
    const { arrangement, ropes, frames } = framed(SETTINGS)
    const wind = createWind()
    const air = { x: 0, y: 0, z: 0 }

    const previous = new Float32Array(ropes.particleCount * 3)
    const remember = () => {
      for (let i = 0; i < ropes.particleCount; i++) {
        previous[i * 3] = frames.nx[i]!
        previous[i * 3 + 1] = frames.ny[i]!
        previous[i * 3 + 2] = frames.nz[i]!
      }
    }
    remember()

    const turned = new Float64Array(ropes.particleCount)
    let clock = 0
    let worstJump = 0

    for (let frame = 0; frame < FRAMES; frame++) {
      clock += 1 / 60
      wind.update(SETTINGS, clock)
      for (let step = 0; step < SUBSTEPS; step++) {
        ropes.step((wire) => {
          const anchor = arrangement.specs[wire]!.anchor
          wind.at(anchor.x, anchor.y, air)
          return air
        })
      }
      updateFrames(ropes, frames)
      for (let i = 0; i < ropes.particleCount; i++) {
        const step = angleBetween(normalAt(frames, i), {
          x: previous[i * 3]!,
          y: previous[i * 3 + 1]!,
          z: previous[i * 3 + 2]!,
        })
        turned[i]! += step
        worstJump = Math.max(worstJump, step)
      }
      remember()
    }

    let spinning = 0
    for (let wire = 0; wire < ropes.wireCount; wire++) {
      let worst = 0
      for (let i = ropes.offset[wire]!; i < ropes.offset[wire + 1]!; i++) worst = Math.max(worst, turned[i]!)
      if (worst > Math.PI) spinning++
    }
    return { spinning, worstJump, wireCount: ropes.wireCount }
  }

  // 12 simulated seconds of a 24-wire scene at 8 substeps a frame — seconds of
  // real work, and the only way to see a frame drift. Run once and read twice,
  // rather than paying for it per assertion.
  const measured = measureUnderWind()

  it("does not let frames turn on their own under wind", () => {
    const { spinning, wireCount } = measured
    expect(spinning, `${spinning}/${wireCount} wires turned past half a revolution in ${SECONDS}s`).toBe(0)
  })

  it("never lurches a frame between one rendered frame and the next", () => {
    expect(measured.worstJump, `worst ${degrees(measured.worstJump).toFixed(0)}°`).toBeLessThan(Math.PI / 3)
  })
})
