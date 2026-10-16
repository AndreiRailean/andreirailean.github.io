import { describe, expect, it } from "vitest"
import { crowdCentre } from "@/experiments/walkers/palette"
import { settingsFromQuery, normalizeSettings, type Settings } from "@/experiments/walkers/settings"
import { park } from "./park"

/**
 * A person's colour is drawn once, at birth, and rebuilt from the settings
 * after that — never drawn again.
 *
 * Before this, every `set()` handed every walker new clothes and took numbers
 * out of the stream their later choices come from. The test is a park and a few
 * calls to `set`, with no stepping: colour is not a thing the simulation does.
 */

const SCENE: Partial<Settings> = { density: 12, span: 14, seed: 7 }

const skins = (p: ReturnType<typeof park>) => p.crowd.walkers.map((walker) => ({ ...walker.skin }))

/** Signed distance round the wheel, so 359 → 1 is 2 and not 358. */
const turn = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180

describe("a person's colour", () => {
  it("survives a set() that is not about colour, byte for byte", () => {
    const p = park(SCENE)
    const before = skins(p)
    expect(before.length).toBeGreaterThan(10)

    p.set({ playback: 0.5 }).set({ paceLow: 0.8 }).set({ density: 13 })
    // `density` can add people, so compare only the ones who were there.
    expect(skins(p).slice(0, before.length)).toEqual(before)
  })

  it("leaves the walker's own stream where it was, however often the settings move", () => {
    const quiet = park(SCENE)
    const busy = park(SCENE)
    for (let i = 0; i < 5; i++) busy.set({ playback: 0.4 + i / 10 })

    const next = (p: ReturnType<typeof park>) => p.crowd.walkers.map((walker) => walker.rng())
    expect(next(busy)).toEqual(next(quiet))
  })

  it("moves each hue a little when the spread moves a little, rather than reshuffling", () => {
    const p = park({ ...SCENE, spread: 42 })
    const before = skins(p)
    p.set({ spread: 43 })
    const moves = skins(p).map((skin, i) => Math.abs(turn(before[i]!.hue, skin.hue)))

    // One degree of spread moves a person by their own normal draw, which the
    // generator clamps at 2.5.
    expect(Math.max(...moves)).toBeLessThanOrEqual(2.5 + 1e-9)
    expect(moves.filter((move) => move > 0.1).length).toBeGreaterThan(before.length / 2)
  })

  it("carries less hue under quiet, about the same centre, for the same person", () => {
    const loud = park({ ...SCENE, palette: "crowd" })
    const centre = crowdCentre(loud.settings)
    const offsets = skins(loud).map((skin) => turn(centre, skin.hue))
    loud.set({ palette: "quiet" })
    const quiet = skins(loud).map((skin) => turn(centre, skin.hue))

    for (const [i, offset] of offsets.entries()) expect(quiet[i]).toBeCloseTo(offset * 0.4, 6)
    expect(offsets.some((offset) => Math.abs(offset) > 5)).toBe(true)
  })
})

/**
 * `kin` and `teams` coloured by group and were taken out on 2026-10-17. An
 * address that names either still has to open, and open in colour.
 */
describe("the retired group palettes", () => {
  it("read as crowd wherever they arrive", () => {
    expect(normalizeSettings({ palette: "kin" as never }).palette).toBe("crowd")
    expect(normalizeSettings({ palette: "teams" as never }, normalizeSettings({ palette: "quiet" })).palette).toBe(
      "crowd",
    )
    expect(settingsFromQuery(new URLSearchParams("palette=teams&density=20")).palette).toBe("crowd")
  })

  /**
   * Written by the registry as it stood on 2026-10-16, with the four-way slot
   * live — pinned as text rather than rebuilt from `REGISTRY`, which would move
   * with whatever this file is meant to catch. Density 34, dusk, seed 4242.
   */
  const OLD = { kin: "____YFyG1Q0Y066igwOAADQ-qnUCEk", quiet: "____YHyG1Q0Y066igwOAADQ-qnUCEk" }

  it("open a packed address written before they went, with the rest of its scene intact", () => {
    const opened = settingsFromQuery(new URLSearchParams({ s: OLD.kin }))
    expect(opened.palette).toBe("crowd")
    expect(opened.density).toBe(34)
    expect(opened.dusk).toBe(true)
    expect(opened.seed).toBe(4242)
  })

  it("still read the old slot, so an old quiet address stays quiet", () => {
    // `crowd` is the default, so only a palette that is not can show the
    // retired slot being read rather than skipped.
    expect(settingsFromQuery(new URLSearchParams({ s: OLD.quiet })).palette).toBe("quiet")
  })
})
