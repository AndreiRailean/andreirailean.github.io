import { describe, expect, it } from "vitest"
import { createGrowth, pointAt } from "@/experiments/kaleidoscope/kaleidoscope"
import { PRESETS } from "@/experiments/kaleidoscope/presets"
import type { Settings } from "@/experiments/kaleidoscope/settings"

describe("a line stopped by a wall", () => {
  it("is cut along it, on either side of the segment", () => {
    // Under turn the segment's two walls are its own; under mirror a line meets
    // its reflection there first, so turn is where both walls are met.
    const settings = { ...PRESETS[0]!.settings, seed: 4242, symmetry: "turn", confine: "wedge" } as Settings
    const growth = createGrowth(settings)
    const half = Math.PI / settings.segments
    const ends = { cut: 0, square: 0 }
    const sides = new Set<number>()
    const seen = new Set<unknown>()
    for (let f = 0; f < 60 * 30; f++) {
      growth.advance(1 / 60)
      for (const line of growth.lines()) {
        if (line.alive || seen.has(line)) continue
        seen.add(line)
        const [x, y] = pointAt(line, line.len)
        if (Math.hypot(x, y) < 1e-3 || Math.abs(Math.abs(Math.atan2(y, x)) - half) > 1e-6) continue
        sides.add(Math.sign(y))
        ends[line.head ? "cut" : "square"]++
      }
    }
    expect(sides.size).toBe(2)
    expect(ends.cut).toBeGreaterThan(10)
    expect(ends.square).toBe(0)
  })
})
