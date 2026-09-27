import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { browserGrep, classify, piecesOnDisk, select, unitArgs } from "../../scripts/affected.ts"
import { browserSpecs } from "./specs.ts"

/**
 * **CI runs what a change can affect, and everything when it cannot say.**
 *
 * `scripts/affected.ts` maps a diff to a set of pieces, and the pull request
 * jobs run only those. That trade is safe for one reason: a path it does not
 * recognise selects *everything*. So the default is what this file holds
 * hardest — against paths the repo does not contain as well as the ones it
 * does — together with the two things that would route around it: a spec that
 * belongs to no piece and is not declared shared, and a workflow that stops
 * running the full suite on `main`. See #238 and
 * `src/experiments/docs/adr/20260928-a-piece-is-a-library-behind-three-files.md`.
 */

const pieces = piecesOnDisk()

it("finds the pieces, so an empty run cannot pass for a clean one", () => {
  expect(pieces.length).toBeGreaterThan(5)
  expect(pieces).toContain("walkers")
})

describe("what a path selects", () => {
  it.each([
    ["src/experiments/walkers/walkers.ts", "walkers"],
    ["src/experiments/walkers/tests/crowd.test.ts", "walkers"],
    ["src/experiments/walkers/about.md", "walkers"],
    ["src/experiments/starry-night/presets.ts", "starry-night"],
    ["src/pages/experiments/crowd/index.astro", "crowd"],
  ])("%s selects %s", (path, slug) => {
    expect(select([path], pieces)).toEqual({ everything: false, pieces: [slug] })
  })

  it.each(["docs/adr/20260928-x.md", "src/experiments/docs/adr/x.md", "src/experiments/crowd/AGENTS.md", "README.md"])(
    "%s, being prose, selects no piece",
    (path) => {
      expect(select([path], pieces)).toEqual({ everything: false, pieces: [] })
    },
  )

  /**
   * **The default, against paths nobody classified.** Every one of these is
   * shared by pieces, or new, or tooling, and each must cost the whole suite.
   * A selector that answered "no piece" for any of them would skip tests on
   * exactly the change that needed them, and nothing would say so.
   */
  it.each([
    "package.json",
    "pnpm-lock.yaml",
    "src/experiments/kit/controls.ts",
    "src/experiments/gallery/boot.ts",
    "src/experiments/piece.ts",
    "src/experiments/address.ts",
    "src/experiments/a-piece-not-yet-written/runner.ts",
    "src/pages/experiments/index.astro",
    "src/showcase/wall.ts",
    "tests/kit.spec.ts",
    "tests/support/experiment.ts",
    "scripts/affected.ts",
    ".github/workflows/test-unit.yml",
    "vitest.config.mts",
    "a/path/from/next/year.ts",
  ])("%s selects everything", (path) => {
    expect(select([path], pieces).everything).toBe(true)
    // And it wins over a piece that came first in the diff.
    expect(select(["src/experiments/walkers/walkers.ts", path], pieces).everything).toBe(true)
  })

  it("keeps the shared checks for every selection, and adds each piece's own", () => {
    expect(unitArgs({ everything: false, pieces: [] })).toEqual(["run", "tests/unit/"])
    expect(unitArgs({ everything: false, pieces: ["walkers"] })).toEqual([
      "run",
      "tests/unit/",
      "src/experiments/walkers/tests/",
    ])
    expect(unitArgs({ everything: true, why: "x" })).toEqual(["run"])
  })

  /**
   * Playwright matches `--grep` against `project file title`, so a slug anchored
   * on `^` selects nothing. That was the form the ticket proposed; the script
   * also lists a selection before running it and fails an empty kit slice.
   */
  it("anchors the slug where Playwright's matched string puts it", () => {
    const grep = new RegExp(browserGrep({ everything: false, pieces: ["walkers"] })!)
    expect(grep.test("chromium tests/kit.spec.ts walkers: presets run down the left")).toBe(true)
    expect(grep.test("chromium src/experiments/walkers/tests/walkers.spec.ts the primary runs")).toBe(true)
    expect(grep.test("chromium tests/experiments-index.spec.ts lists every experiment")).toBe(true)
    expect(grep.test("chromium tests/kit.spec.ts crowd: presets run down the left")).toBe(false)
    expect(grep.test("chromium tests/showcase.spec.ts the page")).toBe(false)
    expect(browserGrep({ everything: false, pieces: [] })).toBeNull()
  })

  it("classifies the unit suite's own shared files as affecting no piece", () => {
    expect(classify("tests/unit/kit-adoption.test.ts", pieces)).toEqual({ kind: "shared-unit" })
  })
})

/**
 * **Every spec belongs to a piece or is declared shared.** A shared spec runs
 * only when a change selects everything, so a spec about one piece sitting in
 * `tests/` would be skipped on every change to that piece. Listing the shared
 * ones makes that a decision rather than an accident; a new spec in `tests/`
 * fails here until someone says which it is.
 */
const SHARED_SPECS = [
  "tests/embed-origin.spec.ts",
  "tests/experiments-index.spec.ts",
  "tests/experiments-notes.spec.ts",
  "tests/harness.spec.ts",
  "tests/kit.spec.ts",
  "tests/reel.spec.ts",
  "tests/showcase-autoplay.spec.ts",
  "tests/showcase-wall.spec.ts",
  "tests/showcase.spec.ts",
  "tests/theme.spec.ts",
]

it("places every browser spec in a piece or on the shared list", () => {
  const stray = browserSpecs().filter(
    (path) => !SHARED_SPECS.includes(path) && !pieces.some((slug) => path.startsWith(`src/experiments/${slug}/tests/`)),
  )
  expect(
    stray,
    `${stray.join(", ")} belongs to no piece and is not declared shared. Move a piece's spec to ` +
      `src/experiments/<slug>/tests/, or add a genuinely shared one to SHARED_SPECS here.`,
  ).toEqual([])
  // Every declared shared spec exists, so the list cannot rot into a pass.
  for (const path of SHARED_SPECS) expect(browserSpecs(), `${path} is declared shared and missing`).toContain(path)
})

/**
 * **No bypass of the everything default.** Each test workflow runs the affected
 * set on a pull request and the full suite on a push to `main`, and nothing
 * else decides what runs.
 */
describe.each([
  ["test-unit.yml", "unit", "pnpm run test:unit"],
  ["test-browser.yml", "browser", "pnpm run test:browser"],
])("%s", (file, suite, full) => {
  const source = readFileSync(`.github/workflows/${file}`, "utf8")

  it("selects on a pull request through scripts/affected.ts, from the base branch tip", () => {
    expect(source).toContain(`pnpm run test:affected ${suite} --base HEAD^1`)
    expect(source, `${file} needs the base commit to diff against`).toMatch(/fetch-depth:\s*2/)
  })

  it("runs the full suite on every push to main, and does not cancel it", () => {
    expect(source).toMatch(/push:\s*\n\s*branches:\s*\[main\]/)
    expect(source).toContain(full)
    expect(source).toContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}")
  })
})
