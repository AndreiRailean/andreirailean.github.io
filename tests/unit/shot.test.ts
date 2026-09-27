import { describe, expect, it } from "vitest"
import { parseShotArgs, shotPath } from "../../scripts/shot.ts"

/**
 * `pnpm run shot`'s arguments — #240. The script itself drives a browser and is
 * run by hand; what can go quietly wrong without one is reading the command
 * line, where a preset name, a number and a JSON patch share positions.
 */
describe("pnpm run shot", () => {
  it("takes a slug alone, at the suite's viewport", () => {
    expect(parseShotArgs(["crowd"])).toEqual({
      slug: "crowd",
      preset: undefined,
      patch: {},
      settle: undefined,
      zoom: undefined,
      size: { width: 1280, height: 900 },
    })
  })

  it("reads a preset by name or by number, and a patch in either order", () => {
    expect(parseShotArgs(["crowd", "catch me", '{"density":60}']).preset).toBe("catch me")
    expect(parseShotArgs(["crowd", "3"]).preset).toBe(3)
    const reversed = parseShotArgs(["crowd", '{"density":60}', "market"])
    expect(reversed.preset).toBe("market")
    expect(reversed.patch).toEqual({ density: 60 })
  })

  it("reads settle, zoom and size", () => {
    const args = parseShotArgs(["walkers", "--settle", "5", "--zoom", "0,300,1280,300", "--size", "800x600"])
    expect(args.settle).toBe(5)
    expect(args.zoom).toEqual({ x: 0, y: 300, width: 1280, height: 300 })
    expect(args.size).toEqual({ width: 800, height: 600 })
  })

  it("refuses what it cannot read rather than guessing", () => {
    expect(() => parseShotArgs([])).toThrow(/usage/)
    expect(() => parseShotArgs(["crowd", "--zoom", "0,0,10"])).toThrow(/--zoom wants 4 numbers/)
    expect(() => parseShotArgs(["crowd", "--settle"])).toThrow(/needs a value/)
    expect(() => parseShotArgs(["crowd", "--frames", "2"])).toThrow(/unknown flag/)
    expect(() => parseShotArgs(["crowd", "a", "b"])).toThrow(/unexpected argument/)
    expect(() => parseShotArgs(["crowd", "[1,2]"])).toThrow()
  })

  it("names the file for what it shows, under private scratch", () => {
    const path = shotPath(parseShotArgs(["crowd", "catch me", '{"density":60}']))
    expect(path).toMatch(/^\.scratch\/shots\/crowd-catch-me-patched-\d{4}-/)
    expect(shotPath(parseShotArgs(["walkers"]))).toMatch(/^\.scratch\/shots\/walkers-primary-/)
  })
})
