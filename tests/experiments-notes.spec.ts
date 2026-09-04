import type { Page } from "@playwright/test"
import { expect, test } from "./support/experiment.ts"
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
  { slug: "dangler", title: "Dangler" },
  { slug: "flotsam", title: "Flotsam" },
  { slug: "psyxels", title: "Psyxels" },
  { slug: "walkers", title: "Walkers" },
]

/** In this order, on every note, forever. That is the whole point of the layout. */
const EXITS = ["open the piece", "all experiments"]

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
