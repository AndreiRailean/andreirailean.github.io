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

const PIECES = ["dangler", "flotsam", "starry-night"]

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

  /**
   * A bound pair is two handles on **one** track.
   *
   * The kit renders DOM, not appearance: the class names are the contract with a
   * piece's own stylesheet, and a piece that uses a control kind it has no CSS
   * for gets it unstyled with nothing to say so. That is written down in
   * `kit/controls.ts` and it still caught Flotsam out — its first `.span` rule
   * stacked the two inputs one above the other, which is two ranges rather than
   * a range, and it looked deliberate.
   *
   * Skipped for a piece with no bound pair rather than asserted absent; Dangler
   * has none and is not wrong for it.
   */
  test(`${slug}: a bound pair is two handles on one track, not two tracks`, async ({ page }) => {
    const experiment = await openExperiment<BaseApi>(page, slug, { idle: false })
    await experiment.api(({ api }) => api.panel(true))

    const spans = page.locator(".panel .span")
    const count = await spans.count()
    test.skip(count === 0, `${slug} has no range control`)

    for (let i = 0; i < count; i++) {
      const span = spans.nth(i)
      await expect(span.locator("input[type=range]")).toHaveCount(2)

      const track = await span.boundingBox()
      const first = await span.locator("input[type=range]").nth(0).boundingBox()
      const second = await span.locator("input[type=range]").nth(1).boundingBox()
      if (!track || !first || !second) throw new Error(`${slug}: a range row has no box`)

      // Both handles run the full width of the row and sit on the same line.
      expect(Math.abs(first.y - second.y)).toBeLessThan(1)
      expect(first.width).toBeCloseTo(track.width, 0)
      expect(second.width).toBeCloseTo(track.width, 0)
      // And the row is one track's worth of height, not two stacked.
      expect(track.height).toBeLessThan(first.height * 1.5)
    }
  })
}
