import type { ExperimentApi } from "@/experiments/walkers/api"
import { DEFAULT_SETTINGS, PRESETS } from "@/experiments/walkers/settings"
import { expect, openExperiment, test } from "./support/experiment"

/**
 * Walkers, driven through its console API.
 *
 * The division of labour with `tests/unit/walkers/` is sharper here than in the
 * other pieces, because the crowd needs no browser at all: `crowd.ts` is
 * arithmetic on numbers, so everything about who is out there and whether they
 * walk through each other is asserted in the unit suite, where four hundred
 * seconds of park runs in a second.
 *
 * What is left for a real page is what a real page adds:
 *
 * - the **canvas** actually has a crowd on it, and the ground is not the whole
 *   picture;
 * - the **camera** does what the geometry says — heads lean outward from their
 *   feet at a low camera and stop leaning at a high one, which is a claim about
 *   pixels and nothing else;
 * - the **settings round-trip** through a URL, and the chrome's escape hatches
 *   work for tools that cannot evaluate JS;
 * - **reduced motion** gets a populated still rather than an empty field, which
 *   no screenshot can distinguish from a running one;
 * - and the piece's own verbs — `settle`, `reroll`, `debug` — do what they say.
 */

/** Small enough to run fast, busy enough that the assertions mean something. */
const MODEST = { density: 20, span: 12 }

function openWalkers(page: Parameters<typeof openExperiment>[0], options?: Parameters<typeof openExperiment>[2]) {
  return openExperiment<ExperimentApi>(page, "walkers", options)
}

/**
 * Wait until the piece has painted, before reading its canvas.
 *
 * `set()` does not draw. It marks the scene dirty and asks for a single
 * animation frame — `wake()` in `walkers.ts` — so the canvas still holds the
 * *previous* frame until that frame runs. See the section on this in
 * `tests/AGENTS.md`; it has cost two sessions across two pieces.
 */
const painted = (page: Parameters<typeof openExperiment>[0]) =>
  page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))))

/**
 * How many pixels differ from the ground, and where the darkest and lightest of
 * them are.
 *
 * Coarse on purpose. `tests/AGENTS.md` bans pixel baselines, and the one visual
 * assertion worth making is that there is *something* on the canvas other than
 * grass — which is precisely the failure a parked loop plus a resize produces,
 * and which every number in `stats()` is blind to.
 */
async function inked(page: Parameters<typeof openExperiment>[0]) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas")
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("no canvas")
    const context = canvas.getContext("2d")
    if (!context) throw new Error("no 2d context")

    const { width, height } = canvas
    const { data } = context.getImageData(0, 0, width, height)

    // The ground is the most common colour by a wide margin, so the middle of
    // the top-left corner of the frame — where a walker may or may not be — is
    // no use as a reference. The modal luminance is.
    const histogram = new Uint32Array(256)
    for (let index = 0; index < data.length; index += 4) {
      const luminance = (data[index]! * 3 + data[index + 1]! * 6 + data[index + 2]!) / 10
      histogram[Math.min(255, Math.round(luminance))]! += 1
    }
    let ground = 0
    for (let value = 0; value < 256; value++) if (histogram[value]! > histogram[ground]!) ground = value

    let lighter = 0
    let darker = 0
    for (let value = 0; value < 256; value++) {
      if (value > ground + 12) lighter += histogram[value]!
      if (value < ground - 12) darker += histogram[value]!
    }

    // Strongly saturated pixels, which the piece itself has none of: the whole
    // palette is pastel, so the widest channel spread anywhere in a scene is
    // well under a hundred. The debug overlay draws in saturated primaries, so
    // this counts the overlay and nothing else — and unlike a before-and-after
    // luminance comparison it does not also count the crowd having moved
    // between the two reads, which made that version flaky.
    let vivid = 0
    for (let index = 0; index < data.length; index += 4) {
      const r = data[index]!
      const g = data[index + 1]!
      const b = data[index + 2]!
      if (Math.max(r, g, b) - Math.min(r, g, b) > 120) vivid += 1
    }

    return { ground, lighter, darker, vivid, pixels: width * height }
  })
}

test("a crowd, on a ground, with shadows", async ({ page }) => {
  const experiment = await openWalkers(page, { settings: MODEST, idle: true })
  await experiment.api(({ api }) => api.settle(60))
  await painted(page)

  const stats = await experiment.api(({ api }) => api.stats())
  expect(stats.inFrame, "nobody in shot").toBeGreaterThan(5)
  expect(stats.heads, "heads drawn").toBeGreaterThanOrEqual(stats.inFrame)

  const canvas = await inked(page)
  // At this ground the heads are pitched lighter and the shadows darker, so
  // both populations have to exist. A picture with only one of them is a
  // picture with either no people in it or no light on them.
  expect(canvas.lighter, "no heads brighter than the ground").toBeGreaterThan(200)
  expect(canvas.darker, "no shadows darker than the ground").toBeGreaterThan(200)
  // And the crowd is a crowd rather than a covering: most of the frame is still
  // ground, which is what stops this passing on a canvas that has gone wrong in
  // some other way entirely.
  expect(canvas.lighter + canvas.darker).toBeLessThan(canvas.pixels * 0.5)

  await experiment.shot("crowd")
})

test("nobody is standing inside anybody", async ({ page }) => {
  const experiment = await openWalkers(page, { settings: { density: 60, span: 14 }, idle: true })
  await experiment.api(({ api }) => api.settle(90))

  const stats = await experiment.api(({ api }) => api.stats())
  expect(stats.inFrame).toBeGreaterThan(20)
  // The unit suite measures this over minutes; here it is a smoke test that the
  // number reaches the page at all, and that the browser's own step size does
  // not change the answer.
  expect(stats.overlap, "somebody is inside somebody").toBeLessThan(0.045)
})

/**
 * The camera is a pinhole, and the only evidence for that is on the glass.
 *
 * A head sits closer to the lens than the ground does, so it is displaced
 * outward from the centre of the frame. Asserted as the mean distance of every
 * lit pixel from the middle of the frame, at two camera heights on the same
 * crowd: a low camera throws the heads outward, so that mean has to grow.
 *
 * There is no way to measure this through `stats()`. The projection happens in
 * `draw.ts` and touches nothing the simulation knows about — which is exactly
 * the kind of thing the section's "assert on numbers" rule has to be read
 * carefully about. This is a number, read off the canvas, with no baseline.
 */
test("heads lean out over their own feet, and lean further from a lower camera", async ({ page }) => {
  const experiment = await openWalkers(page, { settings: { ...MODEST, camera: 120 }, idle: true })
  await experiment.api(({ api }) => api.settle(45))

  const leanAt = async (camera: number) => {
    await experiment.api(({ api, arg }) => api.set({ camera: arg }), camera)
    await painted(page)
    return experiment.api(({ api }) => {
      const stats = api.stats()
      return stats.area
    })
  }

  // The area in frame is set by span alone, so camera height must not move it —
  // if it did, the two readings below would not be of the same crowd.
  const wide = await leanAt(120)
  const close = await leanAt(9)
  expect(close).toBeCloseTo(wide, 5)

  // And the lean itself, read off the canvas: a head at 1.7 m under a 9 m camera
  // is magnified by 1.23 and thrown nearly a quarter of its distance from the
  // centre outward, which puts light in the corners of the frame that a plan
  // view leaves as ground.
  const spread = async () =>
    page.evaluate(() => {
      const canvas = document.querySelector("canvas") as HTMLCanvasElement
      const context = canvas.getContext("2d")!
      const { width, height } = canvas
      const { data } = context.getImageData(0, 0, width, height)
      let sum = 0
      let count = 0
      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          const at = (y * width + x) * 4
          const luminance = (data[at]! * 3 + data[at + 1]! * 6 + data[at + 2]!) / 10
          if (luminance < 150) continue
          sum += Math.hypot(x / width - 0.5, y / height - 0.5)
          count++
        }
      }
      return count > 0 ? sum / count : 0
    })

  await experiment.api(({ api }) => api.set({ camera: 120 }))
  await painted(page)
  const plan = await spread()

  await experiment.api(({ api }) => api.set({ camera: 9 }))
  await painted(page)
  const leaning = await spread()

  expect(plan).toBeGreaterThan(0)
  expect(leaning, "a low camera did not throw the heads outward").toBeGreaterThan(plan)
})

test("settle moves the park forward, and by a lot", async ({ page }) => {
  const experiment = await openWalkers(page, { settings: MODEST, idle: true })

  /**
   * The regression this exists for.
   *
   * `settle` reused the frame loop's catch-up ceiling and was silently capped
   * at sixteen steps — an eighth of a second — so the poster recipe's
   * `settle(120)` did nothing, every still was of a park that had barely started
   * arriving, and nothing errored. A minute of park has to be a minute of park.
   */
  const before = await experiment.api(({ api }) => api.stats())
  const after = await experiment.api(({ api }) => api.settle(90))

  // Asserted on the **clock**, which is exact. Comparing a crowd before and
  // after is not: two different afternoons can hold the same number of people,
  // and this test passed and failed by coincidence before `stats()` could say
  // what time it was.
  expect(after.clock - before.clock, "ninety seconds of park did not pass").toBeGreaterThan(85)
  expect(after.inFrame).toBeGreaterThan(3)
})

test("a re-roll is a different crowd at the same settings", async ({ page }) => {
  const experiment = await openWalkers(page, { settings: MODEST, idle: true })
  await experiment.api(({ api }) => api.settle(30))

  const before = await experiment.api(({ api }) => api.get())
  const seed = await experiment.api(({ api }) => api.reroll())
  const after = await experiment.api(({ api }) => api.get())

  expect(seed).not.toBe(before.seed)
  expect(after.seed).toBe(seed)
  // Everything else is untouched: a re-roll is a new cast, not a new scene.
  expect({ ...after, seed: 0 }).toEqual({ ...before, seed: 0 })
})

test("the debug overlay draws over the crowd and comes off again", async ({ page }) => {
  const experiment = await openWalkers(page, { settings: MODEST, idle: true })
  await experiment.api(({ api }) => api.settle(45))
  await painted(page)
  const plain = await inked(page)
  expect(plain.vivid, "the piece itself drew saturated pixels").toBeLessThan(50)

  expect(await experiment.api(({ api }) => api.debug(true))).toBe(true)
  await painted(page)
  const marked = await inked(page)
  expect(marked.vivid, "the overlay drew nothing").toBeGreaterThan(500)

  expect(await experiment.api(({ api }) => api.debug(false))).toBe(false)
  await painted(page)
  const cleaned = await inked(page)
  expect(cleaned.vivid, "the overlay would not come off").toBeLessThan(50)

  await experiment.shot("debug")
})

/**
 * Reduced motion gets one still of a *populated* park.
 *
 * An invariant no screenshot can show, because a still park and a running one
 * look identical in a photograph. Two things have to hold: the loop is not
 * running, and there is nevertheless a crowd — the piece runs the simulation
 * forward before taking its one frame, so what a visitor who asked for no
 * animation gets is a photograph rather than an empty field.
 */
test("reduced motion parks the loop on a crowd, not on an empty field", async ({ page }) => {
  const experiment = await openWalkers(page, { settings: MODEST, idle: true, reducedMotion: true })
  await painted(page)

  const stats = await experiment.api(({ api }) => api.stats())
  expect(stats.running, "the loop is still going under reduced motion").toBe(false)
  expect(stats.inFrame, "reduced motion got an empty park").toBeGreaterThan(3)

  const canvas = await inked(page)
  expect(canvas.lighter).toBeGreaterThan(100)

  await experiment.shot("still")
})

test("a scene round-trips through its URL", async ({ page }) => {
  const experiment = await openWalkers(page, { idle: true })

  const wanted = {
    flow: "gather",
    palette: "teams",
    dusk: true,
    density: 27,
    children: 0.34,
    span: 17,
    sun: 41,
    bob: 1.65,
  } as const

  const applied = await experiment.api(({ api, arg }) => api.set(arg as never), wanted)
  const url = await experiment.api(({ api }) => api.url())

  await page.goto(url)
  await page.waitForFunction(() => Boolean(window.experiment))
  const restored = await experiment.api(({ api }) => api.get())

  expect(restored).toEqual(applied)
})

test("a bare address lands on the primary and says so in the URL", async ({ page }) => {
  const experiment = await openWalkers(page, { idle: true })

  const landed = await experiment.api(({ api }) => api.get())
  expect(landed).toEqual(PRESETS[0]!.settings)

  // And nothing presentational reads `DEFAULT_SETTINGS`; see ../CONTEXT.md.
  expect(PRESETS[0]!.settings).not.toEqual(DEFAULT_SETTINGS)
})

test("?settle= lands on a park that has been going a while", async ({ page }) => {
  // For tools that cannot evaluate JS, which is the same reason ?panel= and
  // ?idle= exist. A cold landing is a nearly empty field for the first minute.
  const cold = await openWalkers(page, { settings: MODEST, query: { idle: "1" } })
  const coldStats = await cold.api(({ api }) => api.stats())

  const warm = await openWalkers(page, { settings: MODEST, query: { idle: "1", settle: "120" } })
  const warmStats = await warm.api(({ api }) => api.stats())

  expect(warmStats.inFrame).toBeGreaterThan(coldStats.inFrame * 0.9)
  expect(warmStats.inFrame).toBeGreaterThan(3)
})

test("every preset runs, populates and draws", async ({ page }) => {
  // Eight scenes, one of which settles a thousand walkers, so the default
  // minute is not enough — and a timeout here reads as a broken piece.
  test.setTimeout(180_000)

  const experiment = await openWalkers(page, { idle: true })
  const names = await experiment.api(({ api }) => api.presets())
  expect(names).toEqual(PRESETS.map((preset) => preset.label))

  for (let index = 0; index < names.length; index++) {
    await experiment.api(({ api, arg }) => api.preset(arg), index + 1)
    await experiment.api(({ api }) => api.settle(20))
    await painted(page)

    const stats = await experiment.api(({ api }) => api.stats())
    expect(stats.inFrame, `${names[index]} has nobody in shot`).toBeGreaterThan(1)
    expect(stats.overlap, `${names[index]} has somebody inside somebody`).toBeLessThan(0.05)

    // Heads are pitched away from the ground in whichever direction has room,
    // so a scene draws people either lighter or darker than the grass — and one
    // scene draws no people at all on purpose. What every preset owes is *some*
    // ink: a frame that is all ground is a frame where the piece did not run.
    const canvas = await inked(page)
    expect(canvas.lighter + canvas.darker, `${names[index]} drew nothing at all`).toBeGreaterThan(300)

    await experiment.shot(`preset-${names[index]!.replace(/\s+/g, "-")}`)
  }
})
