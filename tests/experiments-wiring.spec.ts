import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { expect, openExperiment, test } from "./support/experiment.ts"
import { litPixels } from "./support/canvas.ts"

/**
 * Each piece is wired to the gallery, and that is all this asks of it.
 *
 * Andrei, 2026-10-16: "all the chrome is just overlay on top of experiments
 * that operates via experiment API. so at most we need to make sure that
 * experiment api is correctly wired up." The kit itself is tested once, as a
 * library, in `tests/kit.spec.ts`; a piece's own behaviour is its own spec's.
 * What is left between the two is one question per piece, and it is the one
 * thing neither of them can answer: **does this piece's page boot, hand the
 * gallery a console API, and draw?**
 *
 * The drawing half carries weight. Four pieces have no spec of their own, so
 * for them this is the only check that the canvas is not black — the note's
 * "the piece itself runs behind the sheet" was that check until #287 cut the
 * notes to one host. Grounds here are near-black and nothing asks for more than
 * a lit pixel: a blank canvas is the failure, not a dim one.
 *
 * **The pieces are read off the disk**, the same rule `scripts/affected.ts`
 * uses — a directory of `src/experiments/` holding a `runner.ts` — so a new
 * piece is checked here the day it exists. Titled `<slug>: `, which is how a
 * change confined to one piece selects its own test, and `scripts/affected.ts`
 * fails a selection that matches none.
 */

const PIECES = readdirSync("src/experiments", { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(join("src/experiments", entry.name, "runner.ts")))
  .map((entry) => entry.name)
  .sort()

/** Everything `boot()` promises on `window.experiment`: the kit's base handle, plus `controls` and `stats`. */
const SURFACE = ["get", "set", "preset", "presets", "pause", "decode", "panel", "idle", "url", "controls", "stats"]

/** Brighter than every piece's ground. Only whether anything lit at all is asked. */
const LIT_THRESHOLD = 90

test.describe.configure({ mode: "parallel" })

test("finds the pieces, so an empty run cannot pass for a clean one", () => {
  expect(PIECES.length).toBeGreaterThan(5)
  expect(PIECES).toContain("walkers")
})

for (const slug of PIECES) {
  test(`${slug}: boots through the gallery, exposes the console API, and draws`, async ({ page }) => {
    const experiment = await openExperiment(page, slug, { idle: false })

    const missing = await experiment.api(
      ({ api, arg }) => arg.filter((verb) => typeof (api as unknown as Record<string, unknown>)[verb] !== "function"),
      SURFACE,
    )
    expect(missing, `${slug}: window.experiment is missing verbs`).toEqual([])

    // The kit mounted: a bar to drive, and presets it was handed.
    await expect(page.locator("#ui .bar")).toBeVisible()
    expect((await experiment.api(({ api }) => api.presets())).length, `${slug} has no presets`).toBeGreaterThan(0)
    expect(await experiment.api(({ api }) => api.panel(true))).toBe(true)
    await expect(page.locator("#ui .panel .row").first(), `${slug}'s panel has no rows`).toBeVisible()

    // And the piece draws, through its runner.
    await expect.poll(() => litPixels(page, LIT_THRESHOLD, 0), { timeout: 15_000 }).toBeGreaterThan(0)
  })
}
