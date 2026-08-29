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
   * A bound pair is two handles on **one** track, and both of them can be
   * grabbed.
   *
   * Two separate bugs, one of which had been shipped in Starry Night since the
   * range control existed and was inherited by the next piece to use one.
   *
   * The kit renders DOM, not appearance: the class names are its contract with a
   * piece's stylesheet, and a control kind a piece has no CSS for renders
   * unstyled with nothing to say so. Flotsam's first `.span` rule stacked the two
   * inputs one above the other, which is two ranges rather than a range, and it
   * looked deliberate.
   *
   * The second is why this test presses a real mouse rather than checking
   * geometry. The filled bar between the handles is a pseudo-element, so it is
   * the row's *last* child in paint order and sits on top of both inputs — and
   * its left edge lands exactly on the lower thumb, which therefore could not be
   * grabbed at all. The upper thumb sits on the bar's right edge, a pixel
   * outside it, and worked fine; so the row was half broken in a way that looked
   * like a knack rather than a bug, and no assertion about layout would ever
   * have caught it.
   *
   * Skipped for a piece with no bound pair rather than asserted absent; Dangler
   * has none and is not wrong for it.
   */
  test(`${slug}: both handles of a bound pair sit on one track and can be dragged`, async ({ page }) => {
    const experiment = await openExperiment<BaseApi>(page, slug, { idle: false })
    await experiment.api(({ api }) => api.panel(true))

    const spans = page.locator(".panel .span")
    const count = await spans.count()
    test.skip(count === 0, `${slug} has no range control`)

    for (let i = 0; i < count; i++) {
      const span = spans.nth(i)
      const inputs = span.locator("input[type=range]")
      await expect(inputs).toHaveCount(2)

      const track = await span.boundingBox()
      const first = await inputs.nth(0).boundingBox()
      const second = await inputs.nth(1).boundingBox()
      if (!track || !first || !second) throw new Error(`${slug}: a range row has no box`)

      // One track: both handles run its full width and sit on the same line.
      expect(Math.abs(first.y - second.y)).toBeLessThan(1)
      expect(first.width).toBeCloseTo(track.width, 0)
      expect(second.width).toBeCloseTo(track.width, 0)
      expect(track.height).toBeLessThan(first.height * 1.5)

      // And both can be taken hold of. Dragged *inward*, toward each other, so
      // neither is asked to move off a stop it is already sitting on.
      for (const [index, direction] of [
        [0, 1],
        [1, -1],
      ] as const) {
        const input = inputs.nth(index)
        const key = await input.getAttribute("data-key")
        if (!key) throw new Error(`${slug}: a range handle has no data-key`)

        const box = (await input.boundingBox())!
        const along = await input.evaluate((element) => {
          const range = element as HTMLInputElement
          const min = Number(range.min)
          return (Number(range.value) - min) / (Number(range.max) - min)
        })
        const x = box.x + box.width * along
        const y = box.y + box.height / 2

        // The thing under the pointer must be the input itself. When it was the
        // row — a pseudo-element, which `elementFromPoint` reports as its
        // owner — the press went nowhere and the handle simply did not move.
        const under = await page.evaluate(
          ({ x, y }) => document.elementFromPoint(x, y)?.tagName.toLowerCase() ?? "nothing",
          { x, y },
        )
        expect(under, `${slug}: handle ${index} of row ${i} is covered by something`).toBe("input")

        const before = await experiment.api(({ api }) => api.get())
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(x + direction * 24, y, { steps: 8 })
        await page.mouse.up()
        const after = await experiment.api(({ api }) => api.get())

        expect(after[key], `${slug}: dragging handle ${index} of row ${i} changed nothing`).not.toBe(before[key])
      }
    }
  })
}
