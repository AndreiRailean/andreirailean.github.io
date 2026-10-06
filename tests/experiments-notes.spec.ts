import type { Page } from "@playwright/test"
import { expect, openExperiment, test } from "./support/experiment.ts"
import { litPixels as countLit } from "./support/canvas.ts"

/**
 * The notes, which are the gallery's wall text rather than the works.
 *
 * `docs/adr/20260828-the-piece-is-independent-the-gallery-is-not` moved these
 * onto one layout after the two of them drifted: each had grown its own way out,
 * a `<nav>` on one and a link at the foot of the other, which nobody chose. The
 * assertion that matters here is therefore not that a note renders — it is that
 * every note is the *same* note, and that a third cannot quietly become a third
 * shape.
 */

const NOTES = [
  { slug: "starry-night", title: "Starry Night" },
  { slug: "bubbles", title: "Bubbles" },
  { slug: "dangler", title: "Dangler" },
  { slug: "flotsam", title: "Flotsam" },
  { slug: "psyxels", title: "Psyxels" },
  { slug: "walkers", title: "Walkers" },
  { slug: "embers", title: "Embers" },
  { slug: "crowd", title: "Crowd" },
  { slug: "streakers", title: "Streakers" },
]

/** In this order, on every note, forever. That is the whole point of the layout. */
const EXITS = ["view the piece", "all experiments"]

/**
 * Everything is looked for inside `main`, which is the note itself.
 *
 * A bare `page.locator("h1")` used to resolve to five elements here, four of
 * them Astro's dev toolbar. The harness now keeps the toolbar off the page
 * entirely (`tests/support/experiment.ts`), so this is no longer load-bearing —
 * but an assertion about a note should be scoped to the note regardless of what
 * else the document happens to contain.
 */
const note = (page: Page) => page.locator("main")

for (const { slug, title } of NOTES) {
  test(`${slug}: the note is headed by its piece and leaves the same way as every other`, async ({ page }) => {
    await page.goto(`/experiments/${slug}/about/`)

    await expect(note(page).locator("h1")).toHaveText(title)
    await expect(note(page).locator(".exits a")).toHaveText(EXITS)
    await expect(note(page).locator(".exits a").first()).toHaveAttribute("href", `/experiments/${slug}/`)
    await expect(note(page).locator(".exits a").nth(1)).toHaveAttribute("href", "/experiments/")

    // Above the title, so leaving does not require reading a long note first.
    const exits = await note(page).locator(".exits").boundingBox()
    const heading = await note(page).locator("h1").boundingBox()
    expect(exits!.y).toBeLessThan(heading!.y)
  })

  test(`${slug}: the piece itself runs behind the sheet`, async ({ page }) => {
    await page.goto(`/experiments/${slug}/about/`)

    // The backdrop is booted by a script the page passes into the layout's slot.
    // If that plumbing broke, the page would still render perfectly — with a
    // blank canvas behind it and nothing to say so.
    await expect.poll(() => litPixels(page), { timeout: 15_000 }).toBeGreaterThan(0)
  })
}

test("every note reaches the index, and the index reaches every note", async ({ page }) => {
  for (const { slug } of NOTES) {
    await page.goto(`/experiments/${slug}/about/`)
    await note(page).locator(".exits a", { hasText: "all experiments" }).click()
    await expect(page).toHaveURL(/\/experiments\/$/)
    await expect(page.locator(`.plate a.note[href="/experiments/${slug}/about/"]`)).toHaveCount(1)
  }
})

/** Canvas pixels brighter than any of these grounds, which are all near-black. */
/** Every piece here grounds well below this; the notes only ask whether anything lit at all. */
const LIT_THRESHOLD = 90

/**
 * Zero rather than a throw for a canvas that is not there yet.
 *
 * This polls a note whose backdrop boots after the sheet, so a missing canvas
 * is a state to wait through rather than a failure — every other caller wants
 * the throw, which is why it is asked for here rather than defaulted.
 */
async function litPixels(page: Page): Promise<number> {
  return countLit(page, LIT_THRESHOLD, 0)
}

/**
 * **A note read over its piece — #223.** A piece's `about` used to leave the
 * piece for a page of its own, and coming back meant finding "open the piece"
 * at the top of the note and landing on the primary rather than on the scene
 * that had been on screen. Now the note is an overlay on the running piece, and
 * every way of dismissing it leaves the viewer where they were.
 *
 * Asserted through the published `data-preset`, which is how the kit says which
 * scene is on screen, and through the address, which is what a shared link or a
 * reload would restore.
 */
const shown = (page: Page) => page.evaluate(() => document.documentElement.dataset.preset)
const overlay = (page: Page) => page.locator("#note")

for (const { slug } of NOTES) {
  test(`${slug}: about opens over the scene on screen, and a click outside the note leaves that scene`, async ({
    page,
  }) => {
    const experiment = await openExperiment(page, slug, { idle: false })
    await experiment.api(({ api }) => api.preset(3))
    expect(await shown(page)).toBe("2")

    await page.locator("#ui a.about").click()
    await expect(overlay(page)).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/experiments/${slug}/about/\\?`))

    // The piece hears no keys while the note is up: a digit would change the
    // scene under the text.
    await page.keyboard.press("5")
    expect(await shown(page), "a digit changed the scene under the note").toBe("2")

    // Outside the text column, on the right of the window.
    const width = page.viewportSize()!.width
    await page.mouse.click(width - 20, 300)
    await expect(overlay(page)).toBeHidden()
    await expect(page).toHaveURL(new RegExp(`/experiments/${slug}/\\?`))
    expect(await shown(page), "closing the note moved the scene").toBe("2")
  })

  test(`${slug}: Back and Escape close the note, and 'view the piece' does too`, async ({ page }) => {
    const experiment = await openExperiment(page, slug, { idle: false })
    await experiment.api(({ api }) => api.preset(2))

    await page.locator("#ui a.about").click()
    await page.goBack()
    await expect(overlay(page)).toBeHidden()
    await expect(page).toHaveURL(new RegExp(`/experiments/${slug}/\\?`))

    await page.locator("#ui a.about").click()
    await page.keyboard.press("Escape")
    await expect(overlay(page)).toBeHidden()

    await page.locator("#ui a.about").click()
    await overlay(page).locator(".exits a", { hasText: "view the piece" }).click()
    await expect(overlay(page)).toBeHidden()
    await expect(page).toHaveURL(new RegExp(`/experiments/${slug}/\\?`))
    expect(await shown(page)).toBe("1")
  })

  test(`${slug}: the note's own address is the piece with the note open, on the primary`, async ({ page }) => {
    await page.goto(`/experiments/${slug}/about/`)
    await page.waitForFunction(() => (window as { experiment?: unknown }).experiment)

    await expect(overlay(page)).toBeVisible()
    expect(await shown(page)).toBe("0")

    await page.mouse.click(20, 300)
    await expect(overlay(page)).toBeHidden()
    await expect(page).toHaveURL(new RegExp(`/experiments/${slug}/(\\?|$)`))
    expect(await shown(page)).toBe("0")
  })
}
