import { describe, expect, it } from "vitest"
import { MIN_OUTLINE_RADIUS, createOutline, traceOutline } from "@/experiments/starry-night/shape"

/**
 * Star outlines. A big perfect circle reads as machine-drawn rather than as
 * something in a sky, so large stars get an irregular one — traced as quadratic
 * segments midpoint-to-midpoint, because going straight through the wobbled
 * points gives a visibly faceted polygon instead of a blob.
 */

/** Records what was traced, so the geometry can be checked without a canvas. */
function recordingContext() {
  const calls: { op: string; args: number[] }[] = []
  const context = {
    moveTo: (...args: number[]) => calls.push({ op: "moveTo", args }),
    quadraticCurveTo: (...args: number[]) => calls.push({ op: "quadraticCurveTo", args }),
  }
  return { calls, context: context as unknown as CanvasRenderingContext2D }
}

describe("createOutline", () => {
  it("keeps every multiplier within the amount asked for", () => {
    for (const amount of [0, 0.1, 0.5]) {
      for (let attempt = 0; attempt < 200; attempt++) {
        for (const multiplier of createOutline(amount).multipliers) {
          expect(multiplier).toBeGreaterThanOrEqual(1 - amount)
          expect(multiplier).toBeLessThanOrEqual(1 + amount)
        }
      }
    }
  })

  it("is a perfect circle at 0, so the control means what it says", () => {
    expect(new Set(createOutline(0).multipliers)).toEqual(new Set([1]))
  })

  it("rotates, so identical wobble does not read as a repeated stamp", () => {
    const rotations = Array.from({ length: 200 }, () => createOutline(0.3).rotation)
    expect(Math.min(...rotations)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...rotations)).toBeLessThan(Math.PI * 2)
    expect(new Set(rotations).size).toBeGreaterThan(100)
  })
})

describe("traceOutline", () => {
  it("traces one closed subpath of curves, never straight lines", () => {
    const { calls, context } = recordingContext()
    const outline = createOutline(0.3)
    traceOutline(context, 100, 100, 10, outline)

    expect(calls[0]!.op).toBe("moveTo")
    expect(calls.slice(1).every((call) => call.op === "quadraticCurveTo")).toBe(true)
    // One segment per point, so the path returns to where it started.
    expect(calls.length).toBe(outline.multipliers.length + 1)
    const [startX, startY] = calls[0]!.args
    const end = calls.at(-1)!.args.slice(2)
    expect(end[0]).toBeCloseTo(startX!, 9)
    expect(end[1]).toBeCloseTo(startY!, 9)
  })

  it("stays within the radius the wobble allows", () => {
    const { calls, context } = recordingContext()
    const amount = 0.4
    const radius = 12
    traceOutline(context, 0, 0, radius, createOutline(amount))
    for (const { args } of calls) {
      for (let i = 0; i < args.length; i += 2) {
        expect(Math.hypot(args[i]!, args[i + 1]!)).toBeLessThanOrEqual(radius * (1 + amount) + 1e-9)
      }
    }
  })

  it("is centred where it was asked to be", () => {
    const { calls, context } = recordingContext()
    traceOutline(context, 50, -20, 5, createOutline(0))
    const points: number[][] = []
    for (const { args } of calls) {
      for (let i = 0; i < args.length; i += 2) points.push([args[i]!, args[i + 1]!])
    }
    const meanX = points.reduce((total, [x]) => total + x!, 0) / points.length
    const meanY = points.reduce((total, [, y]) => total + y!, 0) / points.length
    expect(meanX).toBeCloseTo(50, 0)
    expect(meanY).toBeCloseTo(-20, 0)
  })

  it("has a threshold above the point irregularity becomes visible", () => {
    // Under a couple of px across nothing else is perceptible, so the cheaper
    // `arc` is used instead and this outline code is skipped entirely.
    expect(MIN_OUTLINE_RADIUS).toBeGreaterThan(1)
  })
})
