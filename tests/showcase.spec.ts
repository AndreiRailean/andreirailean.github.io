import { expect, test } from "./support/experiment.ts"

/**
 * The published background on the site's own home page.
 *
 * Everything here needs a real browser, and for a sharper reason than most of
 * this suite: the whole point of the arrangement is that the page reaches the
 * piece through **two URLs and no imports**. A unit test cannot tell the
 * difference between that working and a build that quietly inlined the piece —
 * only fetching the page and watching a canvas appear can.
 *
 * The static half of the same subject, which needs no browser, is in
 * `tests/unit/showcase-artefacts.test.ts`.
 */

/** The loader publishes this the moment it is parsed, before anything mounts. */
type ShowcaseWindow = {
  showcase?: {
    setVariant: (variant: string) => void
    stats: () => { variant: string; dots: number; running: boolean }[]
  }
}

test("the home page runs a published artefact as its background", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(() => (window as unknown as ShowcaseWindow).showcase?.stats().length === 1)

  const container = page.locator("#showcase-bg")
  await expect(container).toHaveAttribute("data-showcase-state", "running")
  await expect(container.locator("canvas")).toHaveCount(1)

  // Reading through the loader rather than off the pixels: a still canvas and a
  // running one look identical in a screenshot, which is the same reason
  // `stats().running` exists for the pieces.
  const stats = await page.evaluate(() => (window as unknown as ShowcaseWindow).showcase!.stats()[0]!)
  expect(stats.running).toBe(true)
  expect(stats.dots).toBeGreaterThan(0)
})

test("the page's own content sits over the background, not under it", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("#showcase-bg canvas")).toHaveCount(1)

  // A `position: fixed` container outranks unpositioned block content in the
  // paint order whatever the DOM order says, so this is one CSS rule away from
  // a page whose text is invisible — and invisible in a way nothing else here
  // would catch, since every element still exists and still reports a box.
  await expect(page.locator("h1")).toBeVisible()
  await expect(page.locator("footer button").first()).toBeVisible()
  const heading = page.locator("h1")
  expect(await heading.evaluate((node) => node.getBoundingClientRect().width)).toBeGreaterThan(0)
})

test("the background follows the site's theme, which is a class and not a media query", async ({ page }) => {
  await page.goto("/")
  await page.waitForFunction(() => (window as unknown as ShowcaseWindow).showcase?.stats().length === 1)

  const variant = () => page.evaluate(() => (window as unknown as ShowcaseWindow).showcase!.stats()[0]!.variant)
  const before = await variant()

  await page.evaluate(() => document.documentElement.classList.toggle("dark"))
  await expect.poll(variant).not.toBe(before)

  await page.evaluate(() => document.documentElement.classList.toggle("dark"))
  await expect.poll(variant).toBe(before)
})

/**
 * The failure that matters, because it is the one nobody would notice.
 *
 * The site's dot pattern is left in `globals.css` precisely so a dead embed
 * leaves the page looking deliberate rather than blank. If the loader ever
 * started leaving an empty canvas behind instead of removing it, the page would
 * go flat and every other test here would still pass.
 */
test("a missing artefact leaves the host page exactly as it was", async ({ page, problems }) => {
  await page.route("**/showcase/artefacts/*.json", (route) => route.fulfill({ status: 404, body: "gone" }))
  await page.goto("/")

  const container = page.locator("#showcase-bg")
  await expect(container).toHaveAttribute("data-showcase-state", "failed")
  await expect(container.locator("canvas")).toHaveCount(0)

  await expect(page.locator("h1")).toBeVisible()
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundImage)
  expect(background).toContain("bg")
  expect(background).not.toBe("none")

  // This test breaks something on purpose, so the suite's console watchdog is
  // read rather than suppressed: the 404 is the *only* thing the page is allowed
  // to complain about, and anything else here would be a real fault hiding
  // behind an expected one. Cleared afterwards, or the fixture fails the test
  // for the failure it was asked to cause.
  expect(problems.join("\n")).toMatch(/404|Failed to load resource/)
  expect(problems.filter((problem) => !/404|Failed to load resource/.test(problem))).toEqual([])
  problems.length = 0
})
