import type { ExperimentApi } from "@/experiments/psyxels/api"
import { DEFAULT_SETTINGS, PRESETS, settingsToQuery } from "@/experiments/psyxels/settings"
import { expect, openExperiment, test } from "./support/experiment"

/**
 * Psyxels, driven through its console API.
 *
 * The piece's whole claim is a separation nothing on screen can show: the
 * packing decides where the pixels are, the life decides what they do, and the
 * second is not allowed to touch the first. A field whose colour control
 * quietly repacks it and one whose does not look identical in any still, and
 * differ completely to watch — the first jumps every time you drag a slider.
 *
 * So most of these read numbers. The two that look at the canvas are coarse and
 * robust: that there is light on it at all, and that the light is where the
 * subject is.
 *
 * Psyxels' own thresholds live here rather than in `support/experiment.ts`; per
 * ADR-0002 nothing is hoisted out of one piece until a second and a third want
 * it.
 */

/** The ground is `#05050a`, whose channels sum to 19. Anything well above it is a pixel. */
const LIT_THRESHOLD = 90

/**
 * Intersection over union between the packed field and the subject it was read
 * from. A square is a square and a letter is not, so 1 is unreachable; below
 * about 0.6 the subject is being described rather than drawn.
 */
const RECOGNISABLE = 0.85

function openPsyxels(page: Parameters<typeof openExperiment>[0], options?: Parameters<typeof openExperiment>[2]) {
  return openExperiment<ExperimentApi>(page, "psyxels", options)
}

/** How many canvas pixels are brighter than the ground, and where their weight sits. */
async function light(page: Parameters<typeof openExperiment>[0]) {
  return page.evaluate((threshold) => {
    const canvas = document.querySelector("canvas")
    if (!canvas) throw new Error("no canvas on the page")
    const context = canvas.getContext("2d")
    if (!context) throw new Error("no 2d context")
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)

    let lit = 0
    let left = 0
    let right = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i]! + data[i + 1]! + data[i + 2]! <= threshold) continue
      lit++
      const x = (i / 4) % canvas.width
      if (x < canvas.width / 2) left++
      else right++
    }
    return { lit, left, right, total: canvas.width * canvas.height }
  }, LIT_THRESHOLD)
}

test("the field is on the canvas, and it is a subject rather than a wash", async ({ page }) => {
  const experiment = await openPsyxels(page, { idle: true })
  await experiment.api(({ api }) => api.run(20))

  const { lit, total, left, right } = await light(page)
  expect(lit).toBeGreaterThan(2000)
  // A letter takes a fraction of the frame; anything past a third of it is the
  // piece having painted the ground.
  expect(lit / total).toBeLessThan(0.33)
  // An A is symmetric, so light either side of the middle within a few per cent
  // — which is a cheap way of asking whether the subject is being read at all.
  expect(Math.abs(left - right) / (left + right)).toBeLessThan(0.12)

  await experiment.shot("letter")
})

test("the packing covers the subject well enough to recognise it", async ({ page }) => {
  const experiment = await openPsyxels(page)
  const stats = await experiment.api(({ api }) => api.stats())
  expect(stats.match).toBeGreaterThan(RECOGNISABLE)
  expect(stats.pixels).toBeGreaterThan(200)
})

test("pixels come in a range of sizes, and the levels control is what decides it", async ({ page }) => {
  const experiment = await openPsyxels(page)

  const mixed = await experiment.api(({ api }) => api.stats())
  expect(mixed.largest / mixed.smallest).toBeGreaterThan(4)
  expect(mixed.byDepth.filter((count) => count > 0).length).toBeGreaterThan(2)

  const flat = await experiment.api(({ api }) => {
    api.set({ levels: 0 })
    return api.stats()
  })
  // No subdivision at all is an ordinary low-resolution image: one size.
  expect(flat.smallest).toBe(flat.largest)
  expect(flat.byDepth.filter((count) => count > 0).length).toBe(1)
})

/**
 * The piece's thesis, as a test.
 *
 * Everything in the moving half is read live and none of it may move a pixel.
 * Without this the obvious implementation — rebuild on any change — passes every
 * other test here and is a different piece to use: every drag of the colour
 * slider reshuffles the field under your hand.
 */
test("winding the life controls anywhere leaves the packing exactly as it was", async ({ page }) => {
  const experiment = await openPsyxels(page)

  const before = await experiment.api(({ api }) => {
    api.set({ churn: 0 })
    return api.stats()
  })

  const after = await experiment.api(({ api }) => {
    api.set({
      hue: 20,
      spread: 180,
      wildness: 1,
      saturation: 0.1,
      pulse: 1,
      tempo: 3,
      wave: 1,
      flicker: 9,
      vocabulary: 9,
      weight: 0.3,
      inset: 0.4,
      playback: 2,
    })
    return api.stats()
  })

  expect(after.pixels).toBe(before.pixels)
  expect(after.byDepth).toEqual(before.byDepth)
  expect(after.changes).toBe(0)
})

test("the packing controls do repack, and say so", async ({ page }) => {
  const experiment = await openPsyxels(page)
  const before = await experiment.api(({ api }) => api.stats())
  const after = await experiment.api(({ api }) => {
    api.set({ coarse: 48 })
    return api.stats()
  })
  expect(after.pixels).toBeGreaterThan(before.pixels * 1.5)
})

test("the threshold sculpts the subject rather than dimming it", async ({ page }) => {
  const experiment = await openPsyxels(page)

  const at = (threshold: number) =>
    experiment.api(({ api, arg }) => {
      api.set({ threshold: arg })
      return api.stats()
    }, threshold)

  const fat = await at(0.05)
  const middling = await at(0.45)
  const lean = await at(0.97)

  // Same packing at every setting: the threshold decides which packed pixels
  // appear, never how many are packed. `live` rather than `drawn`, which is the
  // last frame's paint count and so still reports the settings before this one.
  expect(middling.pixels).toBe(fat.pixels)
  expect(lean.pixels).toBe(fat.pixels)

  // Wide open, nearly everything packed is let through — not quite all of it,
  // because quartering a square that straddles an edge leaves children with a
  // sliver of ink and no more. Winding it up takes the fringe away in order.
  expect(fat.live).toBeGreaterThan(fat.pixels * 0.9)
  expect(middling.live).toBeLessThan(fat.live)
  expect(lean.live).toBeLessThan(middling.live)

  /**
   * **The match is highest in the middle, and that is the whole shape of this
   * control.** Low, the letter wears a fringe of squares that are mostly empty:
   * they add to the union and barely to the intersection, so the letter is fatter
   * than it was drawn. High, its edge is eaten back and the ink that was there
   * goes unclaimed. A test asserting the match simply falls with the threshold
   * fails against a piece doing exactly the right thing — this one did.
   */
  expect(fat.match).toBeLessThan(middling.match)
  expect(lean.match).toBeLessThan(middling.match)
})

test("churn repacks squares over time, and holds still at zero", async ({ page }) => {
  const experiment = await openPsyxels(page)

  const busy = await experiment.api(({ api }) => {
    api.set({ churn: 60, variety: 0.5 })
    api.run(60)
    return api.stats()
  })
  expect(busy.changes).toBeGreaterThan(0)

  const still = await experiment.api(({ api }) => {
    api.set({ churn: 0 })
    const before = api.stats()
    api.run(120)
    const after = api.stats()
    return { before, after }
  })
  expect(still.after.changes).toBe(still.before.changes)
  expect(still.after.byDepth).toEqual(still.before.byDepth)
})

test("flicker changes frames, and held means held", async ({ page }) => {
  const experiment = await openPsyxels(page)

  const moving = await experiment.api(({ api }) => {
    api.set({ flicker: 4 })
    api.run(10)
    return api.stats()
  })
  expect(moving.flicks).toBeGreaterThan(0)

  const held = await experiment.api(({ api }) => {
    api.set({ flicker: 0 })
    const before = api.stats().flicks
    api.run(60)
    return { before, after: api.stats().flicks }
  })
  expect(held.after).toBe(held.before)
})

test("playback scales the clock, and pauses it", async ({ page }) => {
  const experiment = await openPsyxels(page)

  const paused = await experiment.api(async ({ api }) => {
    api.set({ playback: 0 })
    const before = api.stats().clock
    await new Promise((resolve) => setTimeout(resolve, 400))
    return api.stats().clock - before
  })
  expect(paused).toBe(0)

  const running = await experiment.api(async ({ api }) => {
    api.set({ playback: 2 })
    const before = api.stats().clock
    await new Promise((resolve) => setTimeout(resolve, 400))
    return api.stats().clock - before
  })
  expect(running).toBeGreaterThan(0.3)
})

test("the portrait is a photograph that actually arrived", async ({ page }) => {
  const experiment = await openPsyxels(page)

  const portrait = await experiment.api(({ api }) => {
    api.preset("portrait")
    return api.stats()
  })

  // The image is decoded after the piece starts, and an undecoded one
  // rasterises to nothing at all — a blank subject and no error anywhere. The
  // count is the only thing that says it arrived.
  await expect
    .poll(async () => (await experiment.api(({ api }) => api.stats())).pixels, { timeout: 5000 })
    .toBeGreaterThan(500)
  expect(portrait.byDepth.length).toBeGreaterThan(2)

  // A photograph has colour of its own, which a letter has not.
  const colours = (await experiment.api(({ api }) => api.stats())).colours
  expect(colours).toBeGreaterThan(50)

  await experiment.shot("portrait")
})

test("every setting has a control, and a scene survives its own URL", async ({ page }) => {
  const experiment = await openPsyxels(page)

  const controls = await experiment.api(({ api }) => api.controls())
  const named = new Set(controls.map((control) => control.key))
  const settings = await experiment.api(({ api }) => api.get())
  for (const key of Object.keys(settings)) {
    if (key === "seed") continue
    expect(named.has(key), key).toBe(true)
  }

  const scene = await experiment.api(({ api }) => api.set({ hue: 33, levels: 2, subject: "&", spread: 140 }))
  const url = await experiment.api(({ api }) => api.url())
  await page.goto(url)
  await page.waitForFunction(() => Boolean(window.experiment))
  expect(await experiment.api(({ api }) => api.get())).toEqual(scene)
})

test("every preset loads, packs something, and keeps its subject", async ({ page }) => {
  const experiment = await openPsyxels(page)

  for (const preset of PRESETS) {
    const stats = await experiment.api(({ api, arg }) => {
      api.preset(arg)
      api.run(4)
      return api.stats()
    }, preset.label)
    expect(stats.pixels, preset.label).toBeGreaterThan(100)
    expect(stats.live, preset.label).toBeGreaterThan(50)
  }
})

test("a shared address is the whole scene and nothing else", async ({ page }) => {
  await openPsyxels(page, { settings: { hue: 111, wildness: 0.4 } })
  // Landing on a bare URL rewrites it to describe the featured scene; landing on
  // one that names settings leaves it alone.
  expect(new URL(page.url()).searchParams.get("hue")).toBe("111")

  await page.goto("/experiments/psyxels/")
  await page.waitForFunction(() => Boolean(window.experiment))
  expect(new URL(page.url()).search).toBe(`?${settingsToQuery(PRESETS[0]!.settings).toString()}`.replace(/\?$/, ""))
})

test("reduced motion holds the field still, with everything still on the canvas", async ({ page }) => {
  const experiment = await openPsyxels(page, { reducedMotion: true })

  const clock = await experiment.api(async ({ api }) => {
    const before = api.stats().clock
    await new Promise((resolve) => setTimeout(resolve, 400))
    return api.stats().clock - before
  })
  expect(clock).toBe(0)

  // Frozen, not blank: the piece still draws its first frame.
  const { lit } = await light(page)
  expect(lit).toBeGreaterThan(2000)
})

test("the settings panel opens with a row for every control", async ({ page }) => {
  const experiment = await openPsyxels(page, { idle: false })
  await experiment.api(({ api }) => api.panel(true))

  const rows = page.locator(".panel .row:not(.copy)")
  const controls = await experiment.api(({ api }) => api.controls())
  // One row per control, and a bound pair would be one row for two keys — there
  // are none here, so the two counts agree.
  expect(await rows.count()).toBe(controls.length)
  expect(await page.locator(".panel .group").count()).toBe(4)
})

test("the defaults are the first preset, which is what the note renders", async () => {
  expect(PRESETS[0]!.settings).toEqual(DEFAULT_SETTINGS)
})
