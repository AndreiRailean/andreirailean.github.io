import { readFileSync } from "node:fs"
import { matchesGlob } from "node:path"
import { describe, expect, it } from "vitest"
import unit from "../../vitest.config.mts"
import probe from "../../vitest.probe.config.mts"

/**
 * **Probes stay out of everything but `pnpm run probe` — #240.**
 *
 * `probes/` and `.scratch/` are where throwaway work goes, and each exclusion
 * below was a real failure first: a probe committed by a `git add` of its
 * folder, a scratch Playwright script turning `pnpm run lint` red because
 * eslint scans gitignored directories. Each one also depends on nobody
 * reverting it, which is what a check is for. Seen failing: with the eslint
 * ignore and the tsconfig exclude reverted, a deliberately broken scratch file
 * turned lint red and a deliberately mistyped probe turned typecheck red.
 */

const read = (path: string) => readFileSync(path, "utf8")
/** `mergeConfig` returns a loose type; this is the part read here. */
const probeTest = (probe as { test?: { include?: string[]; reporters?: unknown } }).test
const SPOT = "probes/anything.test.ts"

describe("probes", () => {
  it("are never committed", () => {
    const ignored = read(".gitignore")
      .split("\n")
      .map((line) => line.trim())
    expect(ignored).toContain("probes/")
    expect(ignored).toContain(".scratch/")
  })

  it("are not linted", () => {
    const config = read("eslint.config.mjs")
    expect(config).toMatch(/"probes\/"/)
    expect(config).toMatch(/"\.scratch\/"/)
  })

  it("are not typechecked", () => {
    const { exclude } = JSON.parse(read("tsconfig.json")) as { exclude?: string[] }
    expect(exclude).toEqual(expect.arrayContaining(["dist", ".scratch", "probes"]))
  })

  it("are not collected by either suite, and are by the probe runner", () => {
    const unitInclude = unit.test?.include ?? []
    expect(unitInclude.length, "the unit config names no include to test against").toBeGreaterThan(0)
    expect(
      unitInclude.some((glob) => matchesGlob(SPOT, glob)),
      "the unit suite would run a probe",
    ).toBe(false)

    // Presence: the probe runner's own glob does match, so the negative above
    // is not a matcher that matches nothing.
    const probeInclude = probeTest?.include ?? []
    expect(
      probeInclude.some((glob) => matchesGlob(SPOT, glob)),
      "the probe runner cannot see a probe",
    ).toBe(true)

    const playwright = read("playwright.config.ts")
    const globs = [...playwright.matchAll(/"([^"]*\*[^"]*\.spec\.ts)"/g)].map((match) => match[1]!)
    expect(globs.length, "no testMatch globs found in playwright.config.ts").toBeGreaterThan(0)
    expect(
      globs.some((glob) => matchesGlob("probes/anything.spec.ts", glob)),
      "the browser suite would run a probe",
    ).toBe(false)
  })

  it("print what they log", () => {
    expect(probeTest?.reporters).toEqual(["verbose"])
  })
})
