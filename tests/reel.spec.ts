import type { Page } from "@playwright/test"

import { expect, openExperiment, test, type BaseApi } from "./support/experiment.ts"

/**
 * The interactive view: a piece full-bleed, two axes of swipe, on a touch
 * device.
 *
 * Everything here needs a real browser for the same reason the chrome suite
 * does — a gesture is only reachable through a pointer, and what it did is only
 * readable through the console API. The arithmetic underneath is not repeated
 * here; it is a function and a number, so it lives in `tests/unit/gallery/`.
 *
 * Driven with `?reel=1` rather than by emulating a coarse pointer. Playwright
 * cannot emulate `(hover: none) and (pointer: coarse)` — `emulateMedia` has no
 * setting for either — and the escape hatch exists anyway, in the same idiom as
 * `?panel=1`, because it is how the view gets looked at on a desktop.
 */

/**
 * What this spec needs of a piece, over the section's minimum.
 *
 * `controls()` is not part of that minimum and this is the only place here that
 * wants it, so it is declared where it is used rather than pushed onto every
 * piece — the arrangement `tests/support/experiment.ts` describes for a spec that
 * knows more about a piece than the harness does.
 */
type ReelApi = BaseApi & {
  controls: () => { key: string; min: number; max: number }[]
}

/** Where a gesture starts: the middle of the screen, clear of both bits of furniture. */
async function swipe(page: Page, dx: number, dy: number) {
  const view = page.viewportSize()
  if (!view) throw new Error("no viewport to swipe across")
  const x = Math.round(view.width / 2)
  const y = Math.round(view.height / 2)

  await page.mouse.move(x, y)
  await page.mouse.down()
  // Stepped, or the axis never locks: `axisOf` needs movement to read, and one
  // jump from start to finish is a single event with nothing before it.
  await page.mouse.move(x + dx, y + dy, { steps: 12 })
  await page.mouse.up()
}

/** Which preset is on screen, as the kit publishes it. */
const sceneIndex = (page: Page) => page.evaluate(() => document.documentElement.dataset.preset)

/**
 * The wall's order, read off the index rather than written down.
 *
 * It sorts by `updated`, so naming the first piece here would make these tests
 * fail whenever any piece is touched — the same trap
 * `tests/experiments-index.spec.ts` names.
 */
async function wall(page: Page): Promise<string[]> {
  await page.goto("/experiments/")
  const hrefs = await page.locator(".plate a.open").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href") ?? ""),
  )
  return hrefs.map((href) => href.match(/^\/experiments\/([^/]+)\/$/)?.[1]).filter((slug): slug is string => Boolean(slug))
}

test("a touch device gets the piece and no panel; a mouse still gets the panel", async ({ page }) => {
  const slugs = await wall(page)
  const slug = slugs[0]

  await openExperiment<BaseApi>(page, slug, { query: { reel: "1" }, idle: false })
  await expect(page.locator("#reel")).toBeVisible()
  await expect(page.locator(".bar")).toHaveCount(0)
  await expect(page.locator("#reel .out")).toHaveAttribute("href", "/experiments/")

  // The same page with a pointer that can hit a 12px slider.
  await openExperiment<BaseApi>(page, slug, { idle: false })
  await expect(page.locator(".bar")).toBeVisible()
  await expect(page.locator("#reel")).toBeHidden()
})

test("the kit publishes which preset is on screen, and forgets when it is nobody's", async ({ page }) => {
  const slugs = await wall(page)
  const experiment = await openExperiment<ReelApi>(page, slugs[0], { idle: false })

  // A bare landing is the primary, which is position one.
  expect(await sceneIndex(page)).toBe("0")

  // The reel reads this attribute instead of comparing settings, so a scene that
  // is nobody's preset has to be legible as such rather than reported as the
  // first one.
  const controls = await experiment.api(({ api }) => api.controls())
  const slider = controls.find((control) => control.max > control.min)
  if (!slider) throw new Error("no numeric control to nudge")
  await experiment.api(
    ({ api, arg }) => api.set({ [arg.key]: (arg.min + arg.max) / 2 } as never),
    { key: slider.key, min: slider.min, max: slider.max },
  )
  expect(await sceneIndex(page)).toBeUndefined()
})

test("swiping across moves through the scenes, and stops at both ends", async ({ page }) => {
  const slugs = await wall(page)
  const experiment = await openExperiment<ReelApi>(page, slugs[0], { query: { reel: "1" }, idle: false })
  const names = await experiment.api(({ api }) => api.presets())
  expect(names.length).toBeGreaterThan(1)

  expect(await sceneIndex(page)).toBe("0")

  // Left is forward, the way a page turns.
  await swipe(page, -140, 0)
  expect(await sceneIndex(page)).toBe("1")
  await expect(page.locator("#reel .scene")).toHaveText(names[1])

  await swipe(page, 140, 0)
  expect(await sceneIndex(page)).toBe("0")

  // The primary has nothing before it. Neither axis wraps: the collection has a
  // top and a bottom, and the way out is the X.
  await swipe(page, 140, 0)
  expect(await sceneIndex(page)).toBe("0")

  for (let step = 0; step < names.length; step++) await swipe(page, -140, 0)
  expect(await sceneIndex(page)).toBe(String(names.length - 1))
})

test("a twitch is not a swipe", async ({ page }) => {
  const slugs = await wall(page)
  await openExperiment<BaseApi>(page, slugs[0], { query: { reel: "1" }, idle: false })

  // Under the axis lock, so it is a tap with a wobble — the commonest thing a
  // thumb does on a full-screen graphic, and it must not change the scene.
  await swipe(page, -8, 3)
  expect(await sceneIndex(page)).toBe("0")
})

test("swiping up leaves for the next piece, still in the interactive view", async ({ page }) => {
  const slugs = await wall(page)
  await openExperiment<BaseApi>(page, slugs[0], { query: { reel: "1" }, idle: false })

  await swipe(page, 0, -200)
  await page.waitForURL(`**/experiments/${slugs[1]}/**`)

  /*
   * The view has to survive the crossing, and the address is no way to check
   * that it did: the piece landed on rewrites its own query to the primary
   * preset's settings, which drops every param that is not one. The reel reads
   * the address it arrived at instead, before that rewrite — so what is
   * observable, and what actually matters, is that the next piece has no bar on
   * it.
   */
  await expect(page.locator("#reel")).toBeVisible()
  await expect(page.locator(".bar")).toHaveCount(0)
})

test("the last piece has nothing below it", async ({ page }) => {
  const slugs = await wall(page)
  const last = slugs[slugs.length - 1]
  await openExperiment<BaseApi>(page, last, { query: { reel: "1" }, idle: false })

  await swipe(page, 0, -200)
  await page.waitForTimeout(600)
  expect(new URL(page.url()).pathname).toBe(`/experiments/${last}/`)
})

test("the dots say how many scenes there are and which one this is", async ({ page }) => {
  const slugs = await wall(page)
  const experiment = await openExperiment<ReelApi>(page, slugs[0], { query: { reel: "1" }, idle: false })
  const names = await experiment.api(({ api }) => api.presets())

  const dots = page.locator("#reel .dots li")
  await expect(dots).toHaveCount(names.length)
  await expect(page.locator('#reel .dots li[data-here="true"]')).toHaveCount(1)
  await expect(dots.nth(0)).toHaveAttribute("data-here", "true")

  await swipe(page, -140, 0)
  await expect(dots.nth(1)).toHaveAttribute("data-here", "true")
  await expect(dots.nth(0)).toHaveAttribute("data-here", "false")
})

test("a tap holds the piece and says so, and then stops saying it", async ({ page }) => {
  const slugs = await wall(page)
  await openExperiment<ReelApi>(page, slugs[0], { query: { reel: "1" }, idle: false })

  const view = page.viewportSize()
  if (!view) throw new Error("no viewport to tap")
  const middle = { x: Math.round(view.width / 2), y: Math.round(view.height / 2) }

  await expect(page.locator("#reel .held")).toBeHidden()
  await page.mouse.click(middle.x, middle.y)
  await expect(page.locator("#reel .held")).toBeVisible()

  // Everything in the middle of the screen goes, the way the chrome does.
  await expect(page.locator("#reel .held")).toBeHidden({ timeout: 5000 })

  // And the hold outlives the mark that announced it: the next tap is a resume,
  // which is the other icon rather than the same one again.
  await page.mouse.click(middle.x, middle.y)
  await expect(page.locator("#reel .playing")).toBeVisible()
  await expect(page.locator("#reel .held")).toBeHidden()
})

test("arriving names the piece over the gap where it boots, and then stops", async ({ page }) => {
  const slugs = await wall(page)

  // Not through `openExperiment`, which waits for the piece's own module: the
  // name is up during exactly that wait, which is the whole point of it.
  await page.goto(`/experiments/${slugs[0]}/?reel=1`)

  const name = page.locator("#reel .name")
  await expect(name).toBeVisible()
  await expect(name).toHaveText(await page.title())
  await expect(name).toBeHidden({ timeout: 5000 })
})

test("swiping past the end of the wall says there is nothing there", async ({ page }) => {
  const slugs = await wall(page)
  const last = slugs[slugs.length - 1]
  await openExperiment<ReelApi>(page, last, { query: { reel: "1" }, idle: false })

  // Silence here reads as a gesture the view failed to register, which is the
  // explanation a visitor reaches for first.
  await swipe(page, 0, -200)
  await expect(page.locator("#reel .word")).toBeVisible()
  await expect(page.locator("#reel .word")).toHaveText(/end of the wall/)

  // And then goes, rather than sitting on the work.
  await expect(page.locator("#reel .word")).toBeHidden({ timeout: 5000 })
})
