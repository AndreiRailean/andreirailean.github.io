import type { Page } from "@playwright/test"
import { expect, test } from "./support/experiment.ts"
import { openKit, type Layout } from "./support/kit-fixture.ts"

/**
 * The kit, tested once, the way a library is.
 *
 * Andrei, 2026-10-16: "most of the kit needs to be tested independently of the
 * experiments. if a slider doesn't work, it's all we need to know. we don't want
 * to make sure that a slider works in every experiment. that's not a good kit,
 * if it works like that. [...] kit needs to be tested like a generic library
 * would be."
 *
 * So every test here drives `tests/kit/`, a synthetic piece holding one of
 * everything the kit offers, booted through the gallery's own `boot()` exactly
 * as a piece is. Until then this file ran each assertion against all eleven
 * pieces: 220 tests and 522 of the browser suite's 1,233 seconds, re-proving
 * one shared code path eleven times. Whether each *piece* is wired to the kit
 * is `tests/experiments-wiring.spec.ts`, one test a piece. See
 * `src/experiments/docs/adr/20261016-the-kit-is-tested-as-a-library.md`.
 *
 * **Each test names the bug it exists for**, because every one of them was
 * found on a real piece first; the fixture only lets them be checked without
 * one.
 */

test.describe.configure({ mode: "parallel" })

const shown = (page: Page) => page.evaluate(() => document.documentElement.dataset.preset)

/** Settings off the page, typed loosely: the fixture's own type would only be cast back to this. */
const settings = async (page: Page) =>
  (await page.evaluate(() => (window.experiment as { get: () => Record<string, unknown> }).get())) as Record<
    string,
    unknown
  >

const LAYOUTS: Layout[] = ["boxed", "column"]

for (const layout of LAYOUTS) {
  /**
   * **Where the chrome sits — #223.** Presets down the left, the actions and
   * `adjust` top right with the panel opening beneath them and stopping short
   * of `about`, which has the bottom-right corner to itself; `all experiments`
   * bottom left. Held at a short window, where the panel would run over `about`
   * if its height were not capped — at a tall one this passes on any panel.
   */
  test(`${layout}: the corners are presets, bar and panel, about, and all experiments`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 420 })
    const experiment = await openKit(page, { layout, idle: false })
    await experiment.api(({ api }) => api.panel(true))

    const box = async (selector: string) => {
      const found = await page.locator(selector).first().boundingBox()
      if (!found) throw new Error(`nothing at ${selector}`)
      return found
    }
    const { width, height } = page.viewportSize()!
    const presets = await box("#ui .presets")
    const bar = await box("#ui .bar")
    const panel = await box("#ui .panel")
    const about = await box("#ui > .about")
    const index = await box("#ui > .index")
    const play = await box("#ui > .play")

    expect(presets.x, "the presets are not on the left").toBeLessThan(width / 4)
    expect(presets.y, "the presets do not start at the top").toBeLessThan(height / 8)
    expect(bar.x + bar.width, "the bar is not on the right").toBeGreaterThan(width * 0.9)
    expect(bar.y, "the bar is not at the top").toBeLessThan(height / 8)
    expect(play.x + play.width, "play is not in the right corner").toBeGreaterThan(width * 0.97)
    expect(play.y + play.height, "play is not at the bottom").toBeGreaterThan(height * 0.9)
    expect(about.x + about.width, "about does not stop short of play").toBeLessThanOrEqual(play.x)
    expect(Math.abs(about.height - play.height), "about and play are not one height").toBeLessThan(2)
    expect(about.x + about.width, "about is not on the right").toBeGreaterThan(width * 0.85)
    expect(about.y + about.height, "about is not at the bottom").toBeGreaterThan(height * 0.9)
    expect(panel.y, "the panel is not beneath the bar").toBeGreaterThanOrEqual(bar.y + bar.height - 1)
    expect(panel.y + panel.height, "the panel runs over about").toBeLessThanOrEqual(about.y + 1)
    expect(index.x, "all experiments is not on the left").toBeLessThan(width / 10)
    expect(index.y + index.height, "all experiments is not at the bottom").toBeGreaterThan(height * 0.9)
  })

  /**
   * **A governed group disables what the scene does not use — #242.** While
   * its governor holds its off value the group's other rows are inert: still
   * shown, disabled and marked, because hiding them made the panel jump
   * whenever a layer was switched. The governor stays live, since it is how the
   * group comes back. In a box a governing toggle sits in the heading as its
   * switch; in a column it is the row above the group. Both are drawn here.
   */
  test(`${layout}: a governed group's rows are inert, not hidden, while its governor is off`, async ({ page }) => {
    const experiment = await openKit(page, { layout, idle: false })
    await experiment.api(({ api }) => {
      api.pause(true)
      api.panel(true)
    })
    const body = page.locator('#ui .panel .rows[data-governor="layer"]')
    await expect(body).toHaveCount(1)
    expect(await body.getAttribute("data-off")).toBe("false")

    await experiment.api(({ api }) => api.set({ layer: false } as never))
    await expect(body, "the layer is off and its rows were hidden").toBeVisible()
    await expect(body.locator(".row")).toHaveCount(2)
    await expect(body.locator('.row[data-inert="false"]'), "the layer is off and a row is still live").toHaveCount(0)
    await expect(body.locator("input:not([disabled])"), "an input under an off governor takes a drag").toHaveCount(0)

    const governor = body.locator(
      "xpath=preceding-sibling::*[1]/descendant-or-self::*[contains(concat(' ', normalize-space(@class), ' '), ' governor ')]",
    )
    await expect(governor, "the governor is not the row above its group").toHaveClass(/\bgovernor\b/)
    await expect(governor, "the governor went with the rows").toBeVisible()
    await expect(governor, "the governor cannot be switched back on").toHaveAttribute("data-inert", "false")
    if (layout === "boxed")
      await expect(governor, "a governing toggle is not its box's switch").toHaveClass(/\bswitch\b/)

    await governor.locator("button.mode", { hasText: "on" }).click()
    expect((await settings(page)).layer, "the governor's own button did not switch it on").toBe(true)
    await expect(body.locator('.row[data-inert="false"]'), "on, and every row is still inert").toHaveCount(2)
  })

  /**
   * **A value is one line, always.** A value that wrapped — crowd's boulders
   * going from "none" to "4% of the ground" — made its row taller and moved
   * every row below it as the slider was dragged; in a box it ran past the
   * edge instead (#257). The fixture's `verbose` formats far wider than its
   * column, so the ellipsis has to be doing the work: the presence half is that
   * the text really does overflow.
   */
  test(`${layout}: a value too long for its column stays on one line inside the panel`, async ({ page }) => {
    const experiment = await openKit(page, { layout, idle: false })
    await experiment.api(({ api }) => {
      api.pause(true)
      api.panel(true)
    })
    const measured = await page.locator("#ui .panel .row", { hasText: "verbose" }).evaluate((row) => {
      const value = row.querySelector<HTMLElement>(".value")!
      const container = row.closest<HTMLElement>(".box") ?? row.closest<HTMLElement>(".panel")!
      const style = getComputedStyle(container)
      const range = document.createRange()
      range.selectNodeContents(value)
      return {
        overflows: value.scrollWidth > value.clientWidth,
        lines: new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size,
        right: value.getBoundingClientRect().right,
        // Rects are in zoomed pixels and computed lengths are not, and below
        // 1440 px the chrome is zoomed to 85% (#258): unscaled, the padding
        // came off two pixels too wide and a fitting value read as overrunning.
        edge:
          container.getBoundingClientRect().right -
          (parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth)) * container.currentCSSZoom,
      }
    })
    expect(measured.lines, "a long value wrapped").toBe(1)
    expect(measured.right, "a long value runs past the panel's edge").toBeLessThanOrEqual(measured.edge + 1)
    expect(measured.overflows, "the value fits, so this measured nothing; lengthen its format").toBe(true)
  })
}

/**
 * **The presets run down the left edge until they have to wrap** (Andrei, #258).
 * At a short window twelve presets need a second column: it must start at the
 * top, and only once the first could not have taken one more. The cap is read
 * rather than where the presets happen to end, which clears `all experiments`
 * at most heights even when the cap does not.
 */
test("the presets fill the left edge before they wrap", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 420 })
  await openKit(page, { idle: false })
  const boxes = await page
    .locator("#ui .presets .preset")
    .evaluateAll((all) => all.map((element) => element.getBoundingClientRect().toJSON() as DOMRect))
  expect(boxes).toHaveLength(12)
  const first = boxes[0]!
  const inFirst = boxes.filter((box) => Math.abs(box.x - first.x) < 1)
  const rest = boxes.slice(inFirst.length)
  expect(rest.length, "twelve presets at 420px did not wrap, so this measured nothing").toBeGreaterThan(0)

  const link = await page.locator("#ui > .index").evaluate((element) => element.getBoundingClientRect().top)
  // `max-height` is a calc() getComputedStyle leaves unresolved, so let the column grow to it and read it.
  const floor = await page.locator("#ui .presets").evaluate((element) => {
    const column = element as HTMLElement
    column.style.height = "100vh"
    const limit = column.getBoundingClientRect().bottom
    column.style.height = ""
    return limit
  })
  expect(floor, "the presets can run over all experiments").toBeLessThanOrEqual(link)
  expect(boxes.slice(0, inFirst.length), "the first column is not the leading presets").toEqual(inFirst)
  const last = inFirst.at(-1)!
  expect(
    last.bottom + (last.y - (inFirst.at(-2) ?? first).bottom) + last.height,
    "a second column started while the first had room for another preset",
  ).toBeGreaterThan(floor)
  expect(rest[0]!.x, "the second column is not to the right of the first").toBeGreaterThan(first.x + 1)
  expect(rest[0]!.y, "the second column does not start at the top").toBeCloseTo(first.y, 0)
})

/**
 * **Boxes: nothing scrolls, and a fold is the viewer's, not the scene's.** At a
 * window too short for them the boxes wrap into columns rather than the panel
 * scrolling, and
 * a heading folds its box — remembered across a reload, never written into the
 * address, which is the scene's (`20260929-a-panel-in-boxes-folds-are-the-viewers`).
 */
test("a boxed panel does not scroll, and a fold survives a reload without touching the address", async ({ page }) => {
  // Short enough that the three boxes need two columns, tall enough that each
  // box fits one: a box taller than the window has nowhere to wrap to.
  // 540 rather than 640 since the chrome is zoomed to 85% below 1440 px wide
  // (#258), which made the three fit one column.
  await page.setViewportSize({ width: 1280, height: 540 })
  const experiment = await openKit(page, { idle: false })
  await experiment.api(({ api }) => api.panel(true))
  const boxes = page.locator("#ui .panel.boxed > .box")
  await expect(boxes).toHaveCount(3)
  const lefts = await boxes.evaluateAll((all) => new Set(all.map((box) => box.getBoundingClientRect().left)).size)
  expect(lefts, "the boxes did not need a second column, so nothing was asked not to scroll").toBeGreaterThan(1)
  const scrolls = await page
    .locator("#ui .panel")
    .evaluate((element) => element.scrollHeight > element.clientHeight + 1)
  expect(scrolls, "the boxed panel scrolls").toBe(false)

  const rows = () => page.locator("#ui .panel.boxed > .box").first().locator(".row").first()
  await expect(rows(), "an open box shows its rows").toBeVisible()
  const before = page.url()
  await boxes.first().locator(".group").click()
  await expect(rows(), "a folded box still shows its rows").toBeHidden()
  expect(page.url(), "folding a box changed the address").toBe(before)

  await page.reload()
  await page.waitForFunction(() => Boolean(window.experiment))
  await experiment.api(({ api }) => api.panel(true))
  await expect(rows(), "a fold did not survive a reload").toBeHidden()
})

/**
 * **A toggle is a toggle group**: two buttons, the current one lit, each
 * setting its own value. It was one button whose label flipped, which reads as
 * an action — "unorthodox and surprising". So the labels must not move.
 */
test("a toggle is two buttons, one lit, that set their own value", async ({ page }) => {
  const experiment = await openKit(page, { idle: false })
  await experiment.api(({ api }) => {
    api.pause(true)
    api.panel(true)
  })
  const row = page.locator("#ui .panel .row", { has: page.locator(".label", { hasText: /^flag$/ }) })
  const buttons = row.locator("button.mode")
  await expect(buttons).toHaveCount(2)
  const labels = await buttons.allTextContents()
  await expect(row.locator('button.mode[data-active="true"]')).toHaveCount(1)

  const before = Boolean((await settings(page)).flag)
  await buttons.nth(before ? 0 : 1).click()
  const after = Boolean((await settings(page)).flag)
  expect(after, "the toggle did not flip").toBe(!before)
  await expect(buttons.nth(after ? 1 : 0), "the toggle lit the wrong one").toHaveAttribute("data-active", "true")
  await expect(row.locator('button.mode[data-active="true"]'), "both are lit").toHaveCount(1)
  expect(await buttons.allTextContents(), "the toggle's labels moved").toEqual(labels)
})

/** A choice sets its value and lights it, in a row or stacked one per line. */
test("a choice's buttons set their own value, in a row or stacked", async ({ page }) => {
  const experiment = await openKit(page, { idle: false })
  await experiment.api(({ api }) => {
    api.pause(true)
    api.panel(true)
  })
  for (const [key, label, option] of [
    ["mode", "three", "three"],
    ["route", "straight through", "through"],
  ] as const) {
    const button = page
      .locator(`#ui .panel .row`, { has: page.locator(".label", { hasText: key }) })
      .locator("button.mode", { hasText: label })
    await button.click()
    expect((await settings(page))[key], `${key} did not take ${option}`).toBe(option)
    await expect(button).toHaveAttribute("data-active", "true")
  }
  // Stacked is one per line: every option of `route` at its own height.
  const tops = await page
    .locator("#ui .panel .modes.stacked button.mode")
    .evaluateAll((all) => new Set(all.map((element) => Math.round(element.getBoundingClientRect().top))).size)
  expect(tops, "a stacked choice is not one option per line").toBe(4)
})

/**
 * **A set refuses its last removal, and says so.** `least` is one rule in one
 * place instead of every reader having an opinion about an empty set; the
 * buttons that cannot be the one to empty it carry `data-locked`, because a
 * click that silently does nothing reads as broken.
 */
test("a set adds and removes, and will not go below its floor", async ({ page }) => {
  const experiment = await openKit(page, { idle: false })
  await experiment.api(({ api }) => {
    api.pause(true)
    api.panel(true)
  })
  const row = page.locator("#ui .panel .row", { has: page.locator(".label", { hasText: "marks" }) })
  const mark = (name: string) => row.locator("button.mode", { hasText: new RegExp(`^${name}$`) })

  await mark("bar").click()
  expect((await settings(page)).marks).toEqual(["dot", "ring", "bar"])
  await mark("dot").click()
  await mark("ring").click()
  expect((await settings(page)).marks).toEqual(["bar"])
  await expect(mark("bar"), "the last one standing is not marked locked").toHaveAttribute("data-locked", "true")
  await mark("bar").click()
  expect((await settings(page)).marks, "the set emptied").toEqual(["bar"])
})

/**
 * **Typing is not a shortcut** (#263). While a text field has the focus the
 * panel's keys are left alone, or typing "Luna" would load a preset and the
 * `c` in "Acid" would close the panel under the cursor. What is typed is the
 * setting, and reaches the address.
 */
test("text typed into the panel is the setting, and no key in it is a shortcut", async ({ page }) => {
  const experiment = await openKit(page, { idle: false })
  await experiment.api(({ api }) => {
    api.pause(true)
    api.panel(true)
  })
  const field = page.locator("#ui .panel input.text")
  await field.click()
  await page.keyboard.type("c2 nr")
  expect((await settings(page)).words).toBe("c2 nr")
  await expect(page.locator("#ui .panel"), "a c typed into the field closed the panel").toBeVisible()
  expect(await shown(page), "a digit typed into the field loaded a preset").toBeUndefined()
  expect(await experiment.api(({ api }) => api.decode()), "the address does not carry the text").toMatchObject({
    words: "c2 nr",
  })
})

/**
 * **Play and pause, the way a video has them — #313.** Space and the corner
 * button are one verb with `experiment.pause()`, so each shows what the others
 * did. Pausing holds the scene and moves no setting: Andrei, 2026-10-18, "we
 * def do not want to meddle with any speed settings when pausing". The preset
 * click is the case the arrows' comment names: the focus stays on that button,
 * and a Space that clicked it again would load the preset instead of pausing.
 */
test("Space and the corner button pause and resume, and no setting moves", async ({ page }) => {
  const experiment = await openKit(page, { idle: false })
  const paused = () =>
    experiment.api(({ api }) => (api as unknown as { stats: () => { paused: boolean } }).stats().paused)
  const play = page.locator("#ui > .play")

  await expect(play).toHaveAttribute("aria-label", "pause")
  const before = { settings: await settings(page), url: page.url() }

  await page.keyboard.press(" ")
  expect(await paused(), "Space did not pause").toBe(true)
  await expect(play).toHaveAttribute("aria-label", "play")
  expect(await settings(page), "pausing moved a setting").toEqual(before.settings)
  expect(page.url(), "pausing rewrote the address").toBe(before.url)

  await play.click()
  expect(await paused(), "the button did not resume").toBe(false)
  await expect(play).toHaveAttribute("aria-label", "pause")

  // Focus on the button itself: its own click on keyup would undo the toggle.
  await play.click()
  expect(await paused()).toBe(true)
  await page.keyboard.press(" ")
  expect(await paused(), "Space on the focused play button toggled twice").toBe(false)

  // Focus on a preset, then a scene that is no longer that preset: a Space
  // that clicked the button would load it again.
  await page.locator("#ui .presets .preset").nth(1).click()
  await experiment.api(({ api }) => api.set({ seed: 4242 } as never))
  await page.keyboard.press(" ")
  expect(await paused(), "Space on a focused preset did not pause").toBe(true)
  expect((await settings(page)).seed, "Space on a focused preset clicked it").toBe(4242)
  await page.keyboard.press(" ")
  expect(await paused()).toBe(false)

  // A slider has no use for Space, so the press after a drag pauses.
  await experiment.api(({ api }) => api.panel(true))
  await page.locator("#ui .panel input[type=range]").first().focus()
  await page.keyboard.press(" ")
  expect(await paused(), "Space on a focused slider did not pause").toBe(true)
  await play.click()

  await experiment.api(({ api }) => api.pause(false))
  await expect(play, "the button missed a pause from the console").toHaveAttribute("aria-label", "pause")
})

test("Space typed into a field is text, not a pause", async ({ page }) => {
  const experiment = await openKit(page, { idle: false })
  await experiment.api(({ api }) => api.panel(true))
  await page.locator("#ui .panel input.text").fill("")
  await page.locator("#ui .panel input.text").click()
  await page.keyboard.type("a b")
  expect((await settings(page)).words).toBe("a b")
  expect(
    await experiment.api(({ api }) => (api as unknown as { stats: () => { paused: boolean } }).stats().paused),
  ).toBe(false)
})

/**
 * **The bar reads the piece's actions, then copy link, then adjust — #257.**
 * The presence half is what keeps the absence half honest: a panel with no copy
 * row passes as readily when the button is gone altogether.
 */
test("the bar is the actions, copy link and adjust, and the presets are numbered from one", async ({ page }) => {
  const experiment = await openKit(page, { idle: false })
  expect(await page.locator("#ui .bar button, #ui .bar a").allTextContents()).toEqual([
    "reroll",
    "nudge",
    "copy link",
    "adjust",
  ])
  await experiment.api(({ api }) => api.panel(true))
  await expect(page.locator("#ui .panel")).toBeVisible()
  await expect(page.locator("#ui .panel .copy")).toHaveCount(0)
  // The way back to every piece has a corner of its own (Andrei, 2026-10-02).
  await expect(page.locator("#ui > .about")).toHaveText("about")
  await expect(page.locator("#ui > .about")).toHaveAttribute("href", "/experiments/kit-fixture/about/")
  await expect(page.locator("#ui > .index")).toHaveText("all experiments")
  await expect(page.locator("#ui > .index")).toHaveAttribute("href", "/experiments/")
  // Numbered from one, because the digits load them.
  expect((await page.locator("#ui .presets .preset").allTextContents())[0]).toBe("1 scene 1")
})

/** An action runs on its button and on its key; reroll is the gallery's, through the piece's own `reroll`. */
test("an action runs from its button and its key, and reroll moves the seed and the address", async ({ page }) => {
  const experiment = await openKit(page, { idle: false })
  const nudges = () =>
    experiment.api(({ api }) => (api as unknown as { stats: () => { nudges: number } }).stats().nudges)

  await page.locator("#ui .bar button", { hasText: "nudge" }).click()
  expect(await nudges()).toBe(1)
  await page.keyboard.press("n")
  expect(await nudges()).toBe(2)

  const before = { seed: (await settings(page)).seed, url: page.url() }
  await page.keyboard.press("r")
  expect((await settings(page)).seed, "reroll kept the seed").not.toBe(before.seed)
  expect(page.url(), "reroll left the address on the old seed").not.toBe(before.url)
})

test("c opens the panel, Escape closes it, and a digit loads a preset", async ({ page }) => {
  const experiment = await openKit(page, { idle: false })
  const panel = page.locator("#ui .panel")

  await page.keyboard.press("c")
  await expect(panel).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(panel).toBeHidden()

  const second = await experiment.api(({ api }) => api.preset(2))
  await experiment.api(({ api }) => api.preset(1))
  await page.keyboard.press("2")
  expect(await settings(page)).toEqual(second)
})

/**
 * **A preset's title names its key only if it has one — #223.** The titles said
 * `key 10` through `key 16` on crowd, and there is no such key: a digit is one
 * keypress. Twelve presets put both sides of that line here, and every key a
 * title claims is pressed.
 */
test("every key a preset's title names loads that preset, and the tenth onward claim none", async ({ page }) => {
  const experiment = await openKit(page, { idle: false })
  const titles = await page
    .locator("#ui button.preset")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("title") ?? ""))
  expect(titles).toHaveLength(12)
  const claims = titles.map((title) => /\(key ([^,)]+)/.exec(title)?.[1])
  expect(claims.slice(0, 9)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"])
  expect(claims.slice(9), "a preset past the ninth claims a key").toEqual([undefined, undefined, undefined])

  for (const [index, key] of claims.slice(0, 9).entries()) {
    // From a different preset, so the key has to move something.
    await experiment.api(({ api, arg }) => api.preset(arg), index === 0 ? 2 : 1)
    await page.keyboard.press(key!)
    expect(await shown(page), `key ${key} did not load preset ${index + 1}`).toBe(String(index))
  }
})

/**
 * Left and right step through the presets, the way a swipe does, and stop at
 * both ends rather than wrapping. Pressed past each stop, since a clamp that is
 * off by one only shows when it is overshot.
 */
test("left and right step through the presets, and stop at both ends", async ({ page }) => {
  const experiment = await openKit(page, { idle: false })
  expect(await shown(page)).toBe("0")
  await page.keyboard.press("ArrowRight")
  expect(await shown(page), "right did not step forward").toBe("1")
  await page.keyboard.press("ArrowLeft")
  expect(await shown(page), "left did not step back").toBe("0")
  await page.keyboard.press("ArrowLeft")
  expect(await shown(page), "the primary wrapped to the last preset").toBe("0")

  await experiment.api(({ api }) => api.preset(12))
  await page.keyboard.press("ArrowRight")
  expect(await shown(page), "the last preset wrapped to the primary").toBe("11")
  await page.keyboard.press("ArrowLeft")
  expect(await shown(page), "left did not step back from the last").toBe("10")

  // From a scene that is nobody's preset, either direction lands on the primary.
  await experiment.api(({ api }) => api.set({ amount: 9 } as never))
  expect(await shown(page)).toBeUndefined()
  await page.keyboard.press("ArrowRight")
  expect(await shown(page), "stepping from nobody's scene did not land on the primary").toBe("0")
})

/**
 * **A focused slider keeps its own arrow keys**: they are how a range input is
 * worked without a pointer. The value moves and the scene does not jump to the
 * next preset.
 *
 * And on a **log track the arrow must not stall.** Its step is one part in a
 * thousand of the position, which just above a power of ten is finer than the
 * grid, so the value rounded back to where it was and the handle never moved
 * again — found on psyxels' sizes. The fixture's `span` lands on 1, one of the
 * values where that happens.
 */
test("a focused slider keeps its arrow keys, and a log track's arrows do not stall", async ({ page }) => {
  const experiment = await openKit(page, { idle: false })
  await experiment.api(({ api }) => {
    api.pause(true)
    api.panel(true)
  })

  const amount = page.locator('#ui .panel input[type=range][data-key="amount"]')
  await amount.focus()
  await page.keyboard.press("ArrowRight")
  expect(await shown(page), "an arrow on a focused slider stepped the presets").not.toBe("1")
  expect((await settings(page)).amount, "an arrow on a focused slider did not move it").toBe(0.5)

  expect((await settings(page)).span).toBe(1)
  const span = page.locator('#ui .panel input[type=range][data-key="span"]')
  await span.focus()
  await page.keyboard.press("ArrowRight")
  const up = Number((await settings(page)).span)
  expect(up, "an arrow on a log track stalled at 1").toBeGreaterThan(1)
  await page.keyboard.press("ArrowLeft")
  await page.keyboard.press("ArrowLeft")
  expect(Number((await settings(page)).span), "the log track did not come back down").toBeLessThan(1)
})

/**
 * **A bound pair is two handles on one track, and both can be grabbed.** The
 * filled bar between them is a pseudo-element painted over both inputs, and
 * its left edge landed on the lower thumb, which could not be taken hold of at
 * all — half broken in a way that looked like a knack. So this presses a real
 * mouse, after checking the input itself is what is under it.
 */
test("both handles of a bound pair sit on one track and can be dragged", async ({ page }) => {
  const experiment = await openKit(page, { idle: false })
  await experiment.api(({ api }) => {
    api.pause(true)
    api.panel(true)
  })
  const span = page.locator("#ui .panel .span")
  await expect(span).toHaveCount(1)
  const inputs = span.locator("input[type=range]")
  await expect(inputs).toHaveCount(2)

  const track = (await span.boundingBox())!
  const first = (await inputs.nth(0).boundingBox())!
  const second = (await inputs.nth(1).boundingBox())!
  expect(Math.abs(first.y - second.y)).toBeLessThan(1)
  expect(first.width).toBeCloseTo(track.width, 0)
  expect(second.width).toBeCloseTo(track.width, 0)
  expect(track.height).toBeLessThan(first.height * 1.5)

  // Inward, toward each other, so neither is asked off a stop.
  for (const [index, direction] of [
    [0, 1],
    [1, -1],
  ] as const) {
    const input = inputs.nth(index)
    const key = (await input.getAttribute("data-key"))!
    const box = (await input.boundingBox())!
    const along = await input.evaluate((element) => {
      const range = element as HTMLInputElement
      return (Number(range.value) - Number(range.min)) / (Number(range.max) - Number(range.min))
    })
    const x = box.x + box.width * along
    const y = box.y + box.height / 2
    const under = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName.toLowerCase(), { x, y })
    expect(under, `handle ${index} is covered by something`).toBe("input")

    const before = (await settings(page))[key]
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + direction * 24, y)
    await page.mouse.up()
    expect((await settings(page))[key], `dragging handle ${index} changed nothing`).not.toBe(before)
  }
})

/**
 * **`data-preset` on `<html>`** is how anything outside the kit — the reel's
 * placard, a stylesheet — knows which preset is on screen without an opinion
 * about a piece's settings. Absent, not `-1`, for a scene that is nobody's,
 * so a dragged slider stops the piece claiming to be preset 0.
 */
test("publishes which preset is on screen, and stops when it is nobody's", async ({ page }) => {
  const experiment = await openKit(page, { idle: false })
  await expect(page.locator("html")).toHaveAttribute("data-preset", "0")
  for (const index of [0, 1, 11]) {
    await experiment.api(({ api, arg }) => api.preset(arg), index + 1)
    expect(await shown(page), `preset ${index + 1}`).toBe(String(index))
  }
  // No preset holds `amount: 9`.
  const moved = await experiment.api(({ api }) => api.set({ amount: 9 } as never))
  expect(moved.amount).toBe(9)
  expect(await shown(page), "still claims a preset after amount moved").toBeUndefined()
})

/**
 * **The landing contract.** A bare address lands on the primary and is
 * rewritten to *that scene*, so a link copied without touching anything keeps
 * working when the featured preset changes; and the rewritten address restores
 * it. The escape hatches are read from the address as opened, before the
 * rewrite. `src/experiments/CONTEXT.md` on *primary*.
 */
test("a bare address lands on the primary and is rewritten to the scene it landed on", async ({ page }) => {
  const experiment = await openKit(page, { idle: true })
  const landed = await settings(page)
  // The digit, not the index: `preset(0)` throws.
  const primary = await experiment.api(({ api }) => api.preset(1))
  expect(landed, "a bare address did not land on the first preset").toEqual(primary)

  const address = page.url()
  expect(address, "a bare address was left bare").toMatch(/\?s=.+/)
  await page.goto(address)
  await page.waitForFunction(() => Boolean(window.experiment))
  expect(await settings(page), "its own address did not restore its own scene").toEqual(landed)
})

test("the escape hatches open the panel, pin idle and call the piece's own", async ({ page }) => {
  const experiment = await openKit(page, { query: "panel=1&idle=0&debug=1" })
  await expect(page.locator("#ui .panel")).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.dataset.idle)).toBe("false")
  const stats = await experiment.api(({ api }) => (api as unknown as { stats: () => { debug: boolean } }).stats())
  expect(stats.debug, "?debug=1 did not reach the piece's verb").toBe(true)
  // None of them is a setting, so none survives into the shareable address.
  expect(page.url()).not.toMatch(/panel=|idle=|debug=/)
})

/**
 * **`decode` is how an opaque address is read** — whole URL, bare packed value,
 * or the bar — since addresses stopped being readable on purpose
 * (`20260906-an-address-is-packed-not-readable.md`).
 */
test("says what its own address means", async ({ page }) => {
  const experiment = await openKit(page, { idle: true })
  await experiment.api(({ api }) => api.preset(5))
  const showing = await settings(page)
  const address = page.url()
  expect(await experiment.api(({ api, arg }) => api.decode(arg), address)).toEqual(showing)
  const packed = new URLSearchParams(address.split("?")[1]).get("s")
  expect(packed, "no packed address was written").toBeTruthy()
  expect(await experiment.api(({ api, arg }) => api.decode(arg), packed!)).toEqual(showing)
  expect(await experiment.api(({ api }) => api.decode())).toEqual(showing)
})

/** The gallery tints the document from a scene, through the piece's `theme`. */
test("the page is themed from the scene on screen", async ({ page }) => {
  const experiment = await openKit(page, { idle: false })
  await experiment.api(({ api }) => api.set({ mode: "two" } as never))
  expect(await page.evaluate(() => document.documentElement.dataset.fixtureMode)).toBe("two")
})

/** Every row carries a label and its own tooltip, which is the only thing naming a bare slider. */
test("every row of the panel is labelled and has a tooltip", async ({ page }) => {
  const experiment = await openKit(page, { idle: false })
  await experiment.api(({ api }) => api.panel(true))
  const rows = page.locator("#ui .panel .row")
  const missing = await rows.evaluateAll(
    (all) =>
      all.filter((row) => !row.querySelector(".label")?.textContent?.trim() || !row.getAttribute("title")).length,
  )
  expect(await rows.count()).toBeGreaterThan(5)
  expect(missing, "a row has no label or no tooltip").toBe(0)
})

/**
 * **The copy button reports back, and goes back to what it said.** What reached
 * the clipboard is not asserted: `kit/copy.ts` has two paths and which one runs
 * depends on the origin and a permission. The label is what every piece relies
 * on and what a refactor can break.
 */
test("the bar's copy button is labelled and reports back", async ({ page }) => {
  await openKit(page, { idle: false })
  const copy = page.locator("#ui .bar .copy")
  await expect(copy).toHaveCount(1)
  await expect(copy).toHaveText("copy link")
  expect(await copy.getAttribute("title")).toBeTruthy()
  await copy.click()
  await expect(copy).not.toHaveText("copy link")
  await expect(copy).toHaveText("copy link", { timeout: 4000 })
})

/**
 * **The chrome stays while the pointer rests on it, whatever the boundary
 * events said.** Leaving the window and coming back lost a `pointerenter`, so
 * the kit believed the pointer was over the piece while it rested on a slider,
 * and the panel faded 2.5 s after the last move — just as Andrei reached to
 * drag it. No headless browser can leave the window, so the lost event is
 * stood in for by a stray `pointerleave`, which leaves the same belief behind.
 *
 * The paired half is resting over the piece, which must still hide it: without
 * it, a timer that never ran would pass as readily as one that was cleared.
 */
test("a pointer resting on the panel keeps it, even after a boundary event went astray", async ({ page }) => {
  const experiment = await openKit(page)
  await experiment.api(({ api }) => api.panel(true))
  const idle = () => page.evaluate(() => document.documentElement.dataset.idle)
  const row = await page.locator("#ui .panel .row").first().boundingBox()
  if (!row) throw new Error("no row to rest on")
  const x = row.x + row.width / 2
  const y = row.y + row.height / 2

  await page.mouse.move(x - 40, y, { steps: 4 })
  await page.mouse.move(x, y, { steps: 4 })
  await page.evaluate(() => document.getElementById("ui")!.dispatchEvent(new PointerEvent("pointerleave")))
  await page.mouse.move(x + 2, y, { steps: 2 })
  await page.waitForTimeout(3200)
  expect(await idle(), "the panel faded under a resting pointer").toBe("false")

  const size = page.viewportSize()!
  await page.mouse.move(size.width / 2, size.height - 40, { steps: 4 })
  await page.waitForTimeout(3200)
  expect(await idle(), "resting over the piece never hid the chrome, so the half above measured nothing").toBe("true")
})

/**
 * **A window without the focus is chromeless, and the focus restores it.**
 * Unfocused, the page cannot see the pointer — traced on Andrei's machine as one
 * `mousemove`, a false `mouseleave` and then nothing — so neither waking nor a
 * timer can be right. Andrei: "when screen is not focused it can go to
 * chromeless and when it's back in focus it restores its state from the
 * session. if controls were open, they behave like they should. if they were
 * closed, they stay hidden".
 *
 * Headless windows always have the focus, so `hasFocus` and the two events are
 * stood in for.
 */
/** Read, not toggled: `api.panel()` with no argument flips it. */
const panelOpen = (page: Page) => page.locator("#ui .panel").evaluate((panel) => !(panel as HTMLElement).hidden)

const unfocusable = async (page: Page) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __focused: boolean }
    w.__focused = true
    document.hasFocus = () => w.__focused
  })
  const focus = (focused: boolean) =>
    page.evaluate((to) => {
      ;(window as unknown as { __focused: boolean }).__focused = to
      window.dispatchEvent(new FocusEvent(to ? "focus" : "blur"))
    }, focused)
  const idle = () => page.evaluate(() => document.documentElement.dataset.idle)
  return { focus, idle }
}

test("losing the focus hides an open panel, the pointer cannot wake it, and the focus brings it back", async ({
  page,
}) => {
  const { focus, idle } = await unfocusable(page)
  const experiment = await openKit(page)
  await experiment.api(({ api }) => api.panel(true))
  const size = page.viewportSize()!
  await page.mouse.move(size.width / 2, size.height - 40, { steps: 2 })
  expect(await idle(), "the pointer did not wake the chrome in a focused window").toBe("false")

  await focus(false)
  expect(await idle(), "losing the focus left the chrome up").toBe("true")
  await page.mouse.move(size.width / 2 + 30, size.height - 60, { steps: 4 })
  expect(await idle(), "the pointer woke the chrome in a window without the focus").toBe("true")

  await focus(true)
  expect(await idle(), "the focus did not bring an open panel back").toBe("false")
  expect(await panelOpen(page), "the panel closed while the window was away").toBe(true)
})

test("a closed panel stays hidden when the focus comes back, until the pointer moves", async ({ page }) => {
  const { focus, idle } = await unfocusable(page)
  await openKit(page)
  const size = page.viewportSize()!
  await page.mouse.move(size.width / 2, size.height - 40, { steps: 2 })
  await focus(false)
  await focus(true)
  expect(await idle(), "the focus brought back chrome that nobody had asked for").toBe("true")
  await page.mouse.move(size.width / 2 + 30, size.height - 60, { steps: 4 })
  expect(await idle(), "the pointer no longer wakes the chrome once focused").toBe("false")
})

test("the click that gives the window its focus does not close the panel", async ({ page }) => {
  const { focus } = await unfocusable(page)
  const experiment = await openKit(page)
  await experiment.api(({ api }) => api.panel(true))
  await focus(false)
  // On the piece, since the hidden chrome takes no pointer: before the focus
  // arrives, and straight after it, which are the two orders a platform uses.
  const size = page.viewportSize()!
  await page.mouse.click(size.width / 2, size.height - 40)
  expect(await panelOpen(page), "a click before the focus closed the panel").toBe(true)
  await focus(true)
  await page.mouse.click(size.width / 2, size.height - 40)
  expect(await panelOpen(page), "a click just after the focus closed the panel").toBe(true)

  // The paired half: a click on the piece once settled still closes it.
  await page.waitForTimeout(500)
  await page.mouse.click(size.width / 2, size.height - 40)
  expect(await panelOpen(page), "a click away no longer closes the panel").toBe(false)
})
