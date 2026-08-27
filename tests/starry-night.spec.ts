import type { ExperimentApi } from "@/experiments/starry-night/api"
import { expect, openExperiment, test } from "./support/experiment"

/**
 * Starry Night, driven through its console API.
 *
 * Two of the bugs in `src/experiments/starry-night/AGENTS.md` reported zero
 * console errors and were only ever visible in an image: the panel rendering
 * with default browser chrome, and the panel refusing to close. Both are
 * assertable without comparing a single pixel — what they broke was the computed
 * style and the visibility, not the look.
 */

/** NIGHT's background is rgb(5, 7, 15), so its channels sum to 27. */
const LIT_THRESHOLD = 90

const openSky = (page: Parameters<typeof openExperiment>[0], options?: Parameters<typeof openExperiment>[2]) =>
  openExperiment<ExperimentApi>(page, "starry-night", options)

/** How many canvas pixels are brighter than the background. */
const litPixels = (page: Parameters<typeof openExperiment>[0]) =>
  page.evaluate((threshold) => {
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

test("puts stars on the canvas, in as many layers as asked for", async ({ page }) => {
  const experiment = await openSky(page, { settings: { layerCount: 8 }, idle: true })

  const stats = await experiment.api(({ api }) => api.stats())
  expect(stats.layers).toBe(8)
  expect(stats.dots).toBeGreaterThan(0)
  expect(await litPixels(page)).toBeGreaterThan(0)

  await experiment.shot("default")
})

test("the panel opens styled, closes when asked, and leaves the sliders hand-drawn", async ({ page }) => {
  const experiment = await openSky(page, { idle: false })
  const panel = page.locator(".panel")

  await experiment.api(({ api }) => api.panel(true))
  await expect(panel).toBeVisible()

  // The page's <style> must stay `is:global`. Astro scopes styles with a
  // `data-astro-cid-*` attribute on template elements, and the panel is built in
  // JS — so its elements never get one and scoped rules cannot match them. The
  // symptom is controls in default browser chrome, with zero console errors.
  expect(await panel.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe("rgba(0, 0, 0, 0)")

  const slider = panel.locator('input[type="range"]').first()
  expect(await slider.evaluate((node) => getComputedStyle(node).appearance)).toBe("none")

  // The track is hand-styled against a hue-independent `--track`, because the UA
  // derives thumb contrast from the accent's perceived luminance and flips to a
  // contrasting scheme partway around the wheel.
  expect(await slider.evaluate((node) => getComputedStyle(node).accentColor)).toBe("auto")

  await experiment.shot("panel")

  // `.panel { display: flex }` outranks the UA's `[hidden] { display: none }`,
  // so the attribute does nothing without an explicit `.panel[hidden]` rule.
  // The symptom is a panel that will not close.
  await experiment.api(({ api }) => api.panel(false))
  await expect(panel).toBeHidden()
})

test("settings survive the round trip through the query string", async ({ page }) => {
  const experiment = await openSky(page)

  const applied = await experiment.api(({ api }) => {
    const patch: Record<string, number> = {}
    for (const control of api.controls()) {
      for (const key of control.keys) patch[key] = control.min + (control.max - control.min) * 0.37
    }
    api.set({ ...patch, layerCount: 5 })
    return { settings: api.get(), url: api.url() }
  })

  await page.goto(applied.url)
  await page.waitForFunction(() => Boolean(window.experiment))

  expect(await experiment.api(({ api }) => api.get())).toEqual(applied.settings)
})

test("reduced motion gets a still field and no loop, not a blank canvas", async ({ page }) => {
  const moving = await openSky(page)
  expect(await moving.api(({ api }) => api.stats().running)).toBe(true)

  // One still field at full brightness rather than a slowed animation, so there
  // is no RAF loop at all — which a screenshot cannot tell apart from a running
  // one.
  const still = await openSky(page, { reducedMotion: true })
  expect(await still.api(({ api }) => api.stats().running)).toBe(false)
  expect(await litPixels(page)).toBeGreaterThan(0)

  await still.shot("reduced-motion")
})

test("inverting swaps the scheme and changes nothing else", async ({ page }) => {
  const experiment = await openSky(page, { settings: { layerCount: 8 }, idle: true })
  const before = await experiment.api(({ api }) => api.stats())

  await experiment.api(({ api }) => api.set({ invert: true }))
  const after = await experiment.api(({ api }) => api.stats())

  // Same layers, same lifespans, same glimmers — only the palette moves.
  expect(after.layers).toBe(before.layers)
  expect(after.dots).toBe(before.dots)

  await experiment.shot("inverted")
})
