import type { BaseApi } from "./support/experiment.ts"
import { expect, openExperiment, test } from "./support/experiment.ts"

/**
 * The chrome both pieces build from the kit.
 *
 * Every assertion here is written once and runs against each piece, which is the
 * whole point of the kit — not that the code is shared, but that the *behaviour*
 * is, so nobody has to relearn the panel in the next room.
 *
 * These are the things that had already drifted before the kit existed: Starry
 * Night's panel opened downward from the bar while Dangler's opened up, and each
 * piece had its own copy of the keyboard handling to drift next.
 */

const PIECES = ["dangler", "starry-night"]

for (const slug of PIECES) {
  test(`${slug}: the panel opens above the bar, not below it`, async ({ page }) => {
    const experiment = await openExperiment<BaseApi>(page, slug, { idle: false })
    await experiment.api(({ api }) => api.panel(true))

    const panel = await page.locator(".panel").boundingBox()
    const bar = await page.locator(".bar").boundingBox()
    if (!panel || !bar) throw new Error(`${slug}: no chrome on the page`)

    // The bar is what is anchored to the corner; the panel grows upward from it.
    // Starry Night used to do the opposite, which nobody had decided.
    expect(panel.y + panel.height).toBeLessThanOrEqual(bar.y + 1)
  })

  test(`${slug}: the bar ends with adjust, then the way to the note`, async ({ page }) => {
    await openExperiment<BaseApi>(page, slug, { idle: false })

    const labels = await page.locator(".bar button, .bar a").allTextContents()
    expect(labels.slice(-2)).toEqual(["adjust", "about"])
    // Presets are numbered from one and lead the bar, because the digits load them.
    expect(labels[0]).toMatch(/^1 /)
  })

  test(`${slug}: c opens the panel, Escape closes it, and a digit loads a preset`, async ({ page }) => {
    const experiment = await openExperiment<BaseApi>(page, slug, { idle: false })
    const panel = page.locator(".panel")

    await page.keyboard.press("c")
    await expect(panel).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(panel).toBeHidden()

    const second = await experiment.api(({ api }) => api.preset(2))
    await experiment.api(({ api }) => api.preset(1))
    await page.keyboard.press("2")
    expect(await experiment.api(({ api }) => api.get())).toEqual(second)
  })

  test(`${slug}: the panel is reachable by keyboard and its rows are labelled`, async ({ page }) => {
    const experiment = await openExperiment<BaseApi>(page, slug, { idle: false })
    await experiment.api(({ api }) => api.panel(true))

    // Every row carries its own tooltip and a label, which is the only thing
    // naming a bare slider.
    const rows = page.locator(".panel .row:not(.copy)")
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i).locator(".label")).not.toBeEmpty()
      expect(await rows.nth(i).getAttribute("title")).toBeTruthy()
    }
  })
}
