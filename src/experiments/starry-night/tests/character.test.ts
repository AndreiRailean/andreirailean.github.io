import { describe, expect, it } from "vitest"
import {
  DEPTH_POLICIES,
  SOLO_MIN_RADIUS,
  biasedRadius,
  characterAt,
  dotCountFor,
  envelope,
  exitPhase,
  initialLifetimesMs,
  initialPhases,
  isMode,
  randomLifetimeMs,
} from "@/experiments/starry-night/character"
import { DEFAULT_SETTINGS } from "@/experiments/starry-night/settings"

/**
 * A layer's look and lifespan, all derived from one `depth` value.
 *
 * None of this is visible as itself. A layer with the wrong lifespan, a size
 * floor that moved with the ceiling, phases that were never shuffled — the sky
 * still looks like a sky in a screenshot, just a worse one, and only after
 * minutes of watching.
 */

describe("characterAt", () => {
  it("interpolates far to near", () => {
    const far = characterAt(0)
    const near = characterAt(1)
    // Many, tiny, dim → few, large, bright.
    expect(near.density).toBeLessThan(far.density)
    expect(near.maxRadius).toBeGreaterThan(far.maxRadius)
    expect(near.peakAlpha).toBeGreaterThan(far.peakAlpha)

    const middle = characterAt(0.5)
    expect(middle.density).toBeCloseTo((far.density + near.density) / 2, 6)
  })

  it("clamps depth outside 0..1", () => {
    expect(characterAt(-3)).toEqual(characterAt(0))
    expect(characterAt(7)).toEqual(characterAt(1))
  })

  // Below ~0.7 css px a dot is sub-pixel at DPR 1: antialiasing spreads its area
  // and it can never reach its nominal alpha, so the whole tier silently
  // contributes nothing.
  it("never puts the size floor below the sub-pixel limit", () => {
    for (const depth of [0, 0.25, 0.5, 0.75, 1]) {
      expect(characterAt(depth).minRadius).toBeGreaterThanOrEqual(0.7)
    }
  })

  // Raising the ceiling used to raise the floor with it, so a large "max size"
  // left no small stars anywhere and the size mix had nothing to bias toward.
  it("does not move the floor when the ceiling is raised", () => {
    const modest = characterAt(1, 2.6)
    const huge = characterAt(1, 12)
    expect(huge.maxRadius).toBeGreaterThan(modest.maxRadius)
    expect(huge.minRadius).toBe(modest.minRadius)
  })
})

describe("depth policies", () => {
  it("spreads tiers across the full range", () => {
    expect([0, 1, 2].map((index) => DEPTH_POLICIES.depth(index, 3))).toEqual([0, 0.5, 1])
  })

  it("parks a lone layer mid-range rather than dividing by zero", () => {
    expect(DEPTH_POLICIES.depth(0, 1)).toBe(0.5)
  })

  it("gives identical mode no depth cue at all", () => {
    const depths = [0, 1, 2, 3].map((index) => DEPTH_POLICIES.identical(index, 4))
    expect(new Set(depths)).toEqual(new Set([0.5]))
  })

  it("gives random mode a fresh roll inside the range", () => {
    const rolls = Array.from({ length: 200 }, () => DEPTH_POLICIES.random(0, 14))
    expect(Math.min(...rolls)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...rolls)).toBeLessThan(1)
    expect(new Set(rolls).size).toBeGreaterThan(100)
  })

  it("recognises exactly the three modes", () => {
    expect(["depth", "random", "identical"].every(isMode)).toBe(true)
    expect(isMode("deep")).toBe(false)
    expect(isMode(undefined)).toBe(false)
  })
})

describe("dotCountFor", () => {
  const character = characterAt(0)

  it("comes out as tuned at the reference viewport", () => {
    // Densities are per megapixel, tuned against 1920x1080.
    expect(dotCountFor(character, 1920, 1080)).toBeCloseTo(character.density * 2.07, 0)
  })

  it("grows with area^0.75 rather than with area", () => {
    // A phone is held far closer than a monitor, so matching dots-per-area
    // leaves small screens looking empty. Doubling the area must add clearly
    // more than nothing and clearly less than double.
    const small = dotCountFor(character, 1280, 720)
    const doubled = dotCountFor(character, 1280 * Math.SQRT2, 720 * Math.SQRT2)
    expect(doubled / small).toBeGreaterThan(1.5)
    expect(doubled / small).toBeLessThan(1.85)
  })

  it("scales with the density control, and never returns nothing", () => {
    expect(dotCountFor(character, 1920, 1080, 2)).toBeGreaterThan(dotCountFor(character, 1920, 1080, 1))
    expect(dotCountFor(character, 10, 10, 0)).toBeGreaterThanOrEqual(1)
  })
})

/**
 * Two layers whose lifespans are near-equal stay in near-lockstep for minutes:
 * their beat period is L1*L2/|L1-L2|, so 15s against 15.5s holds together for
 * about eight of them. This is why lifespan is not derived from depth, and why
 * the opening set is spread by a constant ratio rather than drawn freely.
 */
describe("initialLifetimesMs", () => {
  const MIN = 6_000
  const MAX = 26_000

  it("spans the whole range", () => {
    const sorted = [...initialLifetimesMs(14, MIN, MAX)].sort((a, b) => a - b)
    expect(sorted[0]).toBeCloseTo(MIN, 6)
    expect(sorted.at(-1)).toBeCloseTo(MAX, 6)
  })

  it("spreads geometrically, so every pair's beat period stays short", () => {
    const sorted = [...initialLifetimesMs(14, MIN, MAX)].sort((a, b) => a - b)
    const ratios = sorted.slice(1).map((lifetimeMs, i) => lifetimeMs / sorted[i]!)
    // A constant ratio: no two neighbours are nearly equal anywhere in the range,
    // which a uniform spread cannot promise at the long end.
    for (const ratio of ratios) expect(ratio).toBeCloseTo(ratios[0]!, 6)
    expect(ratios[0]).toBeGreaterThan(1.05)
  })

  it("shuffles, so lifespan bears no relation to layer order", () => {
    // Depth sets appearance; this sets tempo. Handing them out in order would
    // reintroduce the correlation the shuffle exists to break.
    const runs = Array.from({ length: 40 }, () => initialLifetimesMs(14, MIN, MAX))
    expect(new Set(runs.map((run) => run.join(","))).size).toBeGreaterThan(1)
  })

  it("still gives a lone layer a lifespan in range", () => {
    const [only] = initialLifetimesMs(1, MIN, MAX)
    expect(only).toBeGreaterThanOrEqual(MIN)
    expect(only).toBeLessThanOrEqual(MAX)
  })

  it("draws respawns from the whole range", () => {
    const drawn = Array.from({ length: 500 }, () => randomLifetimeMs(MIN, MAX))
    expect(Math.min(...drawn)).toBeGreaterThanOrEqual(MIN)
    expect(Math.max(...drawn)).toBeLessThanOrEqual(MAX)
    expect(Math.max(...drawn) - Math.min(...drawn)).toBeGreaterThan((MAX - MIN) * 0.8)
  })
})

describe("initialPhases", () => {
  it("spreads phases evenly, so the sky is populated from the first frame", () => {
    const count = 14
    const sorted = [...initialPhases(count)].sort((a, b) => a - b)
    expect(sorted).toEqual(Array.from({ length: count }, (_, index) => (index + 0.5) / count))
  })

  it("shuffles them, so the opening is not a sweep from far to near", () => {
    const runs = Array.from({ length: 40 }, () => initialPhases(14).join(","))
    expect(new Set(runs).size).toBeGreaterThan(1)
  })
})

describe("envelope", () => {
  it("is dark at birth and death, and full on the plateau", () => {
    expect(envelope(0, 0.2)).toBe(0)
    expect(envelope(1, 0.2)).toBe(0)
    expect(envelope(0.5, 0.2)).toBe(1)
  })

  it("is symmetric", () => {
    for (const phase of [0.05, 0.17, 0.3, 0.44]) {
      expect(envelope(phase, 0.2)).toBeCloseTo(envelope(1 - phase, 0.2), 12)
    }
  })

  it("rises monotonically through the ramp", () => {
    const samples = Array.from({ length: 21 }, (_, i) => envelope((i / 20) * 0.2, 0.2))
    for (let i = 1; i < samples.length; i++) expect(samples[i]!).toBeGreaterThanOrEqual(samples[i - 1]!)
  })

  it("holds full brightness throughout when there is no ramp", () => {
    expect(envelope(0, 0)).toBe(1)
    expect(envelope(0.5, 0)).toBe(1)
    expect(envelope(1, 0)).toBe(1)
  })

  it("leaves no plateau at all at 0.5, giving a pure bell", () => {
    expect(envelope(0.5, 0.5)).toBe(1)
    expect(envelope(0.25, 0.5)).toBeLessThan(1)
    expect(envelope(0.75, 0.5)).toBeLessThan(1)
  })

  it("bends the whole shape with curve, without moving its ends", () => {
    // Above 1 a star lingers faint and then comes up quickly.
    expect(envelope(0.1, 0.2, 2)).toBeLessThan(envelope(0.1, 0.2, 1))
    expect(envelope(0.1, 0.2, 0.5)).toBeGreaterThan(envelope(0.1, 0.2, 1))
    expect(envelope(0.5, 0.2, 3)).toBe(1)
  })

  it("clamps a phase outside its life", () => {
    expect(envelope(-1, 0.2)).toBe(0)
    expect(envelope(2, 0.2)).toBe(0)
  })
})

/**
 * The envelope is symmetric, so anything asked to leave has an exact twin on the
 * way down: same alpha, opposite direction. That is what lets a layer be
 * dismissed without its brightness jumping.
 */
describe("exitPhase", () => {
  const FADE = 0.2

  it("sends something still fading in to its twin on the way out", () => {
    const phase = 0.05
    const moved = exitPhase(phase, FADE)
    expect(moved).toBeCloseTo(1 - phase, 12)
    expect(envelope(moved, FADE)).toBeCloseTo(envelope(phase, FADE), 12)
  })

  it("sends something at full brightness to the start of its fade-out", () => {
    const moved = exitPhase(0.5, FADE)
    expect(moved).toBeCloseTo(1 - FADE, 12)
    expect(envelope(moved, FADE)).toBe(1)
  })

  it("leaves something already leaving alone", () => {
    expect(exitPhase(0.95, FADE)).toBe(0.95)
  })
})

describe("biasedRadius", () => {
  const draw = (mix: number) => Array.from({ length: 4_000 }, () => biasedRadius(1, 3, mix))

  it("stays inside the range", () => {
    for (const mix of [0, 0.5, 1]) {
      const drawn = draw(mix)
      expect(Math.min(...drawn)).toBeGreaterThanOrEqual(1)
      expect(Math.max(...drawn)).toBeLessThanOrEqual(3)
    }
  })

  it("is uniform at 1", () => {
    const drawn = draw(1)
    expect(drawn.reduce((a, b) => a + b, 0) / drawn.length).toBeCloseTo(2, 1)
  })

  it("puts a few large stars among many small ones as the mix drops", () => {
    const mean = (mix: number) => draw(mix).reduce((a, b) => a + b, 0) / 4_000
    expect(mean(0)).toBeLessThan(mean(0.5))
    expect(mean(0.5)).toBeLessThan(mean(1))
    // Still reaches the top of the range sometimes, or there are no large stars.
    expect(Math.max(...draw(0))).toBeGreaterThan(2.5)
  })
})

// Above this radius a star runs on its own clock, so a conspicuous star does not
// betray the layer's shared fade to the small stars beside it. At the default
// `nearRadius` nothing qualifies and nothing changes — which is the documented
// behaviour, and only holds while these two numbers agree.
it("leaves solo stars switched off at the default near radius", () => {
  expect(DEFAULT_SETTINGS.nearRadius).toBeLessThanOrEqual(SOLO_MIN_RADIUS)
})
