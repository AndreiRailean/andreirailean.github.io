import { describe, expect, it } from "vitest"
import { createGlimmer, glimmerEnvelope, isGlimmerAlive } from "@/experiments/starry-night/glimmer"

/**
 * Single-star flares. Glimmers default to one every two seconds, so a still
 * frame catches one about a fifth of the time — which is exactly why the shape
 * of one is worth asserting rather than eyeballing.
 */

describe("glimmerEnvelope", () => {
  it("starts dark and ends dark", () => {
    expect(glimmerEnvelope(0)).toBe(0)
    expect(glimmerEnvelope(1)).toBe(0)
  })

  it("peaks at the end of a near-instant attack", () => {
    expect(glimmerEnvelope(0.18)).toBeCloseTo(1, 9)
  })

  it("is asymmetric — fast attack, eased decay — or it reads as a slow pulse", () => {
    // Brightness a fifth of the way in must exceed brightness a fifth from the
    // end by a wide margin; a symmetric curve would make them equal.
    expect(glimmerEnvelope(0.2)).toBeGreaterThan(glimmerEnvelope(0.8) * 5)
    // Still descending all the way out, rather than cutting off.
    const decay = [0.3, 0.5, 0.7, 0.9].map(glimmerEnvelope)
    for (let i = 1; i < decay.length; i++) expect(decay[i]!).toBeLessThan(decay[i - 1]!)
  })

  it("rises monotonically through the attack", () => {
    const attack = [0, 0.05, 0.1, 0.15, 0.18].map(glimmerEnvelope)
    for (let i = 1; i < attack.length; i++) expect(attack[i]!).toBeGreaterThan(attack[i - 1]!)
  })

  it("clamps a progress outside the flare", () => {
    expect(glimmerEnvelope(-1)).toBe(0)
    expect(glimmerEnvelope(4)).toBe(0)
  })
})

describe("createGlimmer", () => {
  it("carries the star it sits on, so a flare keeps that star's shape", () => {
    const outline = { multipliers: [1, 1.2, 0.9], rotation: 0.5 }
    const glimmer = createGlimmer(12, 34, 2.5, outline)
    expect(glimmer).toMatchObject({ x: 12, y: 34, radius: 2.5, outline, elapsedMs: 0 })
  })

  it("draws a duration inside the flare range", () => {
    const durations = Array.from({ length: 500 }, () => createGlimmer(0, 0, 1, null).durationMs)
    expect(Math.min(...durations)).toBeGreaterThanOrEqual(250)
    expect(Math.max(...durations)).toBeLessThanOrEqual(700)
    expect(new Set(durations).size).toBeGreaterThan(100)
  })

  it("is alive until its duration is spent, and then not", () => {
    const glimmer = createGlimmer(0, 0, 1, null)
    expect(isGlimmerAlive(glimmer)).toBe(true)
    glimmer.elapsedMs = glimmer.durationMs - 1
    expect(isGlimmerAlive(glimmer)).toBe(true)
    glimmer.elapsedMs = glimmer.durationMs
    expect(isGlimmerAlive(glimmer)).toBe(false)
  })
})
