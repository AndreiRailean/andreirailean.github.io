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

const PIECES = ["dangler", "flotsam", "psyxels", "starry-night", "walkers"]

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

  /**
   * Left and right step through the presets, the way a swipe does on a phone.
   *
   * Stepping is not the digits with extra steps: it is how a scene gets compared
   * to the one beside it, where hunting for the right digit is a different
   * gesture entirely. Asserted through the published `data-preset` rather than
   * by comparing settings, which is what the kit itself uses to decide.
   */
  test(`${slug}: left and right step through the presets, and stop at both ends`, async ({ page }) => {
    const experiment = await openExperiment<BaseApi>(page, slug, { idle: false })
    const shown = () => page.evaluate(() => document.documentElement.dataset.preset)

    const names = await experiment.api(({ api }) => api.presets())
    test.skip(names.length < 2, `${slug} has only one preset`)

    expect(await shown()).toBe("0")

    await page.keyboard.press("ArrowRight")
    expect(await shown(), `${slug}: right did not step forward`).toBe("1")
    await page.keyboard.press("ArrowLeft")
    expect(await shown(), `${slug}: left did not step back`).toBe("0")

    // Neither end wraps, which is what the same gesture does in the interactive
    // view. Pressed past the stop rather than up to it, since a clamp that is
    // off by one only shows when it is overshot.
    await page.keyboard.press("ArrowLeft")
    expect(await shown(), `${slug}: the primary wrapped to the last preset`).toBe("0")

    for (let step = 0; step < names.length + 1; step++) await page.keyboard.press("ArrowRight")
    expect(await shown(), `${slug}: the last preset wrapped to the primary`).toBe(String(names.length - 1))
  })

  /**
   * A focused slider keeps its own arrow keys.
   *
   * Arrows are how a range input is operated without a pointer, and the panel is
   * deliberately keyboard-reachable — taking them would make every slider
   * unusable for anyone not holding a mouse.
   *
   * The assertion is about the presets, not about the slider: whether the value
   * moves is the browser's business, and a handle already sitting on its stop
   * would not move either. What must not happen is the scene jumping to the next
   * preset.
   */
  test(`${slug}: a focused slider keeps its own arrow keys`, async ({ page }) => {
    const experiment = await openExperiment<BaseApi>(page, slug, { idle: false })
    await experiment.api(({ api }) => api.panel(true))

    const slider = page.locator(".panel input[type=range]").first()
    await expect(slider).toBeVisible()
    await slider.focus()

    await page.keyboard.press("ArrowRight")
    const shown = await page.evaluate(() => document.documentElement.dataset.preset)
    expect(shown, `${slug}: an arrow on a focused slider stepped the presets`).not.toBe("1")
  })

  /**
   * `data-preset` on `<html>`, which the kit publishes and the gallery reads.
   *
   * The interactive view names the scene on its placard and lights one dot from
   * this attribute and nothing else — it is the only way anything outside the
   * kit can know which preset is on screen without holding an opinion about
   * what a piece's settings mean, which is exactly what `gallery/` may not have.
   *
   * It arrived in #82 with its only check inside `tests/reel.spec.ts`, the
   * consumer's own spec. That tested that the reel's reading worked, not that
   * the kit publishes anything: delete the reel and the promise went with it,
   * and the next surface to rely on it would start from an untested one. So it
   * is asserted here, across every piece, the same way every other kit
   * behaviour is. See #83.
   *
   * Absent rather than `-1` for a scene that is nobody's preset. That
   * distinction is the whole reason the attribute can be trusted — a piece
   * someone has dragged a slider on must not keep claiming to be preset 0.
   */
  test(`${slug}: publishes which preset is on screen, and stops when it is nobody's`, async ({ page }) => {
    const experiment = await openExperiment<BaseApi>(page, slug, { idle: false })
    const html = page.locator("html")
    const shown = () => page.evaluate(() => document.documentElement.dataset.preset)

    // A bare landing is the primary, which is position one.
    await expect(html).toHaveAttribute("data-preset", "0")

    // Every preset names itself, so the placard cannot be right by luck at
    // index 0 and wrong everywhere else. Each scene is kept, because the last
    // assertion needs a value that belongs to none of them.
    const names = await experiment.api(({ api }) => api.presets())
    const scenes: Record<string, unknown>[] = []
    for (let index = 0; index < names.length; index++) {
      scenes.push(await experiment.api(({ api, arg }) => api.preset(arg), index + 1))
      expect(await shown(), `${slug} preset ${index} (${names[index]})`).toBe(String(index))
    }

    // And a scene that is nobody's preset says so by saying nothing.
    //
    // Driven through `get`/`set` and the presets alone — the documented minimum
    // surface — rather than through `controls()`. Two earlier attempts failed
    // for reasons worth keeping: the slider's midpoint happened to *be* the
    // loaded preset's value on starry-night, so nothing moved; and
    // `controls()` is not the same shape in every piece, so reading `.key` off
    // it silently yielded `undefined` there and the nudge went to a key no
    // piece has. A kit-wide assertion may only lean on what every piece
    // promises.
    const scene = scenes.at(-1)!
    const numeric = Object.keys(scene).filter((key) => typeof scene[key] === "number")
    const key = numeric.find((candidate) => new Set(scenes.map((each) => each[candidate])).size > 1) ?? numeric[0]
    if (key === undefined) throw new Error(`${slug}: no numeric setting to move`)

    // A value no preset uses for this key, so the attribute has to go absent
    // rather than land on a neighbour by coincidence.
    const taken = new Set(scenes.map((each) => each[key] as number))
    let free = (scene[key] as number) + 1
    while (taken.has(free)) free += 1

    const moved = await experiment.api(({ api, arg }) => api.set({ [arg.key]: arg.value } as never), {
      key,
      value: free,
    })
    expect(moved[key], `${slug}: setting ${key} did not take, so nothing was tested`).toBe(free)
    expect(await shown(), `${slug} still claims a preset after ${key} moved`).toBeUndefined()
  })

  /**
   * `controls()` reports one entry per **settings key**, and every key is real.
   *
   * The shape had drifted three ways and nothing said which was the contract.
   * Flotsam and Psyxels flattened over `keysOf` — one entry per key. Dangler
   * read `control.key` directly, which is `undefined` for a range control and
   * was correct only because Dangler has none. Starry Night reported one entry
   * per *control* with a `keys` array and no `key` at all.
   *
   * That cost a real assertion: generic code reading `.key` got `undefined` on
   * Starry Night, wrote the patch to a setting no piece has, and the check that
   * followed passed because nothing had moved. See #85, and #84 where it bit.
   *
   * So the contract is the flat one, and this holds every piece to it. A key
   * that does not name a real setting is the failure worth catching — it is
   * indistinguishable from a working control until something tries to drive it.
   */
  test(`${slug}: reports one control entry per settings key`, async ({ page }) => {
    const experiment = await openExperiment<BaseApi & { controls: () => { key?: unknown }[] }>(page, slug, {
      idle: false,
    })

    const entries = await experiment.api(({ api }) => api.controls())
    expect(entries.length, `${slug} reports no controls`).toBeGreaterThan(0)

    const settings = await experiment.api(({ api }) => api.get())
    const unusable = entries.filter((entry) => typeof entry.key !== "string" || !(entry.key in settings))

    expect(
      unusable.map((entry) => JSON.stringify(entry)),
      `${slug}: every controls() entry needs a \`key\` naming a real setting. An entry reporting ` +
        `\`keys\` instead, or a key the piece has no setting for, cannot be driven — and code that ` +
        `tries writes to nothing and passes. Flatten over keysOf(), as the other pieces do.`,
    ).toEqual([])
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
