import { describe, expect, it } from "vitest"
import { coreFloor, floorCore, MIN_CORE_DEVICE_PX } from "@/experiments/flotsam/specks"

/**
 * The sub-pixel floor, as the two functions that decide it. This replaced a
 * browser test that ran `simmer` for 60 s in two browser contexts, at 1× and
 * 2×, and compared their totals.
 *
 * Its two bugs, each seen red here on 2026-10-16:
 * - **a css-px floor**, which spread on a phone the cores the screen could
 *   resolve: `coreFloor` ignoring `dpr` fails "halves on a 2× screen";
 * - **one alpha shared with the glare**, which tripled the haze on every 2×
 *   screen while reading as a units fix: dimming `glareAlpha` by the floor fails
 *   "leaves the glare alone".
 */
describe("the core floor", () => {
  it("is the device-pixel floor at 1×, and halves on a 2× screen", () => {
    expect(coreFloor(1)).toBe(MIN_CORE_DEVICE_PX)
    expect(coreFloor(2)).toBe(MIN_CORE_DEVICE_PX / 2)
    // Never above the 1× floor, whatever a browser reports.
    expect(coreFloor(0.5)).toBe(MIN_CORE_DEVICE_PX)
  })

  it("resolves more cores as points on a denser screen", () => {
    const radii = Array.from({ length: 200 }, (_, i) => 0.05 + i * 0.005)
    const dimmed = (dpr: number) => radii.filter((r) => floorCore(r, 1, coreFloor(dpr)).dimmed).length
    expect(dimmed(2)).toBeLessThan(dimmed(1))
    expect(dimmed(2)).toBeGreaterThan(0)
  })

  it("leaves a core at or over the floor exactly as it was", () => {
    expect(floorCore(1.5, 0.6, coreFloor(1))).toEqual({ r: 1.5, a: 0.6, glareAlpha: 0.6, dimmed: false })
  })

  it("trades size for alpha under the floor, keeping a·r²", () => {
    for (const dpr of [1, 2, 3]) {
      const floor = coreFloor(dpr)
      for (const radius of [0.05, 0.12, 0.3]) {
        if (radius >= floor) continue
        const { r, a, dimmed } = floorCore(radius, 0.8, floor)
        expect(dimmed).toBe(true)
        expect(r).toBe(floor)
        expect(a * r * r).toBeCloseTo(0.8 * radius * radius, 12)
      }
    }
  })

  it("leaves the glare alone: it depends on the speck, never on the screen", () => {
    for (const radius of [0.05, 0.2, 0.5, 1]) {
      const at1 = floorCore(radius, 0.8, coreFloor(1)).glareAlpha
      expect(floorCore(radius, 0.8, coreFloor(2)).glareAlpha).toBe(at1)
      expect(floorCore(radius, 0.8, coreFloor(3)).glareAlpha).toBe(at1)
    }
  })
})
