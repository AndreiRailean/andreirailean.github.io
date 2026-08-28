import type { ExperimentApi } from "@/experiments/dangler/api"
import { DEFAULT_SETTINGS, PRESETS } from "@/experiments/dangler/settings"
import { expect, openExperiment, test } from "./support/experiment"

/**
 * Dangler, driven through its console API.
 *
 * Every test here corresponds to something `src/experiments/dangler/AGENTS.md`
 * records as a real bug or a stated invariant, and none of them is a pixel
 * comparison — a wrong strand and a right one both look like a scatter of dots.
 * The one visual assertion is that there is *light on the canvas at all*, which
 * is robust and which caught a real bug (a parked loop plus a resize left the
 * piece simply gone).
 *
 * Dangler's own thresholds and its ground colour live here rather than in
 * `support/experiment.ts`: per ADR-0002 nothing gets hoisted out of one piece
 * until a second and a third want it.
 */

/**
 * Settled, the largest link-length violation sits around 2e-4. Above about 1e-2
 * the strands are stretching or crumpling and any still is of a shape the piece
 * never actually holds.
 */
const SETTLED_MAX_CONSTRAINT_ERROR = 1e-2

/**
 * The ground is `#05070c`, so its channels sum to 24. Anything well above that
 * is a bulb rather than the background.
 */
const LIT_THRESHOLD = 90

/** A scene big enough to be representative and small enough to settle fast. */
const MODEST_SCENE = { strands: 12, segments: 18 }

/** `seed` is the one setting with no slider; it has explicit handling instead. */
const SETTINGS_WITHOUT_A_CONTROL = ["seed"]

function openDangler(page: Parameters<typeof openExperiment>[0], options?: Parameters<typeof openExperiment>[2]) {
  return openExperiment<ExperimentApi>(page, "dangler", options)
}

/** How many canvas pixels are brighter than the ground. */
async function litPixels(page: Parameters<typeof openExperiment>[0]): Promise<number> {
  return page.evaluate((threshold) => {
    const canvas = document.querySelector("canvas")
    if (!canvas) throw new Error("no canvas on the page")
    const context = canvas.getContext("2d")
    if (!context) throw new Error("no 2d context")
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    let lit = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i]! + data[i + 1]! + data[i + 2]! > threshold) lit++
    }
    return lit
  }, LIT_THRESHOLD)
}

test("settles to a shape it actually holds, with light on the canvas", async ({ page }) => {
  const experiment = await openDangler(page, { settings: MODEST_SCENE, idle: true })

  await experiment.api(({ api }) => api.settle())
  const stats = await experiment.api(({ api }) => api.stats())

  expect(stats.strands).toBe(MODEST_SCENE.strands)
  expect(stats.maxConstraintError).toBeLessThan(SETTLED_MAX_CONSTRAINT_ERROR)
  // A 200 and a settled solver still say nothing about anything reaching the
  // canvas; `drawnBeads` is bulbs that survived the projection and the clip.
  expect(stats.drawnBeads).toBeGreaterThan(0)
  expect(await litPixels(page)).toBeGreaterThan(0)

  await experiment.shot("settled")
})

test("every setting has a control, so the panel and a shared URL cannot disagree", async ({ page }) => {
  const experiment = await openDangler(page)

  const uncontrolled = await experiment.api(({ api }) => {
    const controlled = new Set(api.controls().map((control) => control.key))
    return Object.keys(api.get()).filter((key) => !controlled.has(key))
  })

  expect(uncontrolled).toEqual(SETTINGS_WITHOUT_A_CONTROL)
})

test("settings survive the round trip through the query string", async ({ page }) => {
  const experiment = await openDangler(page)

  // Every slider moved to a value inside its own bounds. Read the applied
  // settings back rather than predicting them: `get()` has already done the
  // clamping and the rounding, so the expectation is whatever the piece
  // actually holds and the test needs to know nothing about which keys are
  // integers.
  const applied = await experiment.api(({ api }) => {
    const patch: Record<string, number> = {}
    for (const control of api.controls()) patch[control.key] = control.min + (control.max - control.min) * 0.37
    // Kept small for runtime only; a small count round-trips the same code.
    api.set({ ...patch, strands: 5, segments: 12, beads: 4 })
    return { settings: api.get(), url: api.url() }
  })

  await page.goto(applied.url)
  await page.waitForFunction(() => Boolean(window.experiment))

  expect(await experiment.api(({ api }) => api.get())).toEqual(applied.settings)
})

test("reduced motion gets a still frame, not a running loop and not a blank canvas", async ({ page }) => {
  // Motion stated rather than inherited. The point is to prove the loop parks
  // *because* of the preference, so the scene has to be one that would otherwise
  // be running — and which scene the defaults describe is editorial, not
  // something this test should depend on.
  const moving = { ...MODEST_SCENE, breeze: 0.4 }

  const animated = await openDangler(page, { settings: moving })
  await expect.poll(() => animated.api(({ api }) => api.stats().running)).toBe(true)

  // Pinned before the piece starts, so the strands are laid out, settled and never
  // set moving — which is what lets the loop park with no separate
  // reduced-motion path.
  //
  // Turning the preference on *mid-session* is a different thing and is not
  // asserted here: the change listener stops the wind, but strands already
  // swinging then coast until `ropes.atRest()`, which was still false after 30s
  // of measuring. The documented invariant is the one at load.
  const still = await openDangler(page, { settings: moving, reducedMotion: true })
  await expect.poll(() => still.api(({ api }) => api.stats().running)).toBe(false)
  expect(await litPixels(page)).toBeGreaterThan(0)
})

test("the panel opens styled, with a row for every control", async ({ page }) => {
  const experiment = await openDangler(page, { settings: MODEST_SCENE, idle: false })

  await experiment.api(({ api }) => api.panel(true))
  const panel = page.locator(".panel")
  await expect(panel).toBeVisible()

  const controlCount = await experiment.api(({ api }) => api.controls().length)
  await expect(panel.locator(".row input[type=range]")).toHaveCount(controlCount)

  // A panel that rendered unstyled went unnoticed once. Its background is the
  // cheapest proof the stylesheet reached it, since the piece imports no
  // globals.css and owns every rule itself.
  const background = await panel.evaluate((node) => getComputedStyle(node).backgroundColor)
  expect(background).not.toBe("rgba(0, 0, 0, 0)")

  await experiment.shot("panel")
})

test("a resize does not blank the piece", async ({ page }) => {
  const experiment = await openDangler(page, { settings: MODEST_SCENE, idle: true })
  await experiment.api(({ api }) => api.settle())
  expect(await litPixels(page)).toBeGreaterThan(0)

  // Setting `canvas.width` on a resize clears it, so a parked loop used to
  // leave the piece simply gone. Anything that changes the picture without
  // moving a particle has to mark the scene dirty.
  await page.setViewportSize({ width: 900, height: 1200 })
  await expect.poll(() => litPixels(page)).toBeGreaterThan(0)

  await experiment.shot("resized")
})

test("a bare URL lands on the first preset, and says so in the address bar", async ({ page }) => {
  const experiment = await openDangler(page, { idle: true })

  // The scene, not just the address: the defaults are three strands and the
  // first preset is fifty-two, so this would pass on a redirect that rewrote the
  // URL without actually loading anything.
  const landed = await experiment.api(({ api }) => api.get())
  expect(landed).toEqual(PRESETS[0]!.settings)
  expect(landed.strands).not.toBe(DEFAULT_SETTINGS.strands)

  // Rewritten, so a link copied without touching a control keeps pointing at
  // this scene rather than at whichever preset is featured later.
  const url = new URL(page.url())
  expect(url.searchParams.get("strands")).toBe(String(PRESETS[0]!.settings.strands))

  // And the rewrite has to be one the piece can read back.
  await page.goto(page.url())
  await page.waitForFunction(() => Boolean(window.experiment))
  expect(await experiment.api(({ api }) => api.get())).toEqual(landed)
})

test("the escape hatches still work on a bare URL, which the landing rewrite replaces", async ({ page }) => {
  // `?panel=1` names no setting, so it lands on the preset *and* has to survive
  // being read before the address is rewritten. Reading it afterwards would
  // silently stop opening the panel.
  const experiment = await openDangler(page, { query: { panel: "1" }, idle: false })

  // Asserted on the DOM rather than through `api.panel()`, which toggles when
  // called with no argument and would close the very thing it was asked about.
  await expect(page.locator(".panel")).toBeVisible()
  expect(await experiment.api(({ api }) => api.get())).toEqual(PRESETS[0]!.settings)
})
