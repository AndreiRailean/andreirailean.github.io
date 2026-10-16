import type { ExperimentApi } from "@/experiments/walkers/runner"
import { PRESETS } from "@/experiments/walkers/presets"
import { expect, openExperiment, test } from "../../../../tests/support/experiment"

/**
 * Walkers, driven through its console API.
 *
 * The division of labour with `src/experiments/walkers/tests/` is sharper here than in the
 * other pieces, because the crowd needs no browser at all: `crowd.ts` is
 * arithmetic on numbers, so everything about who is out there and whether they
 * walk through each other is asserted in the unit suite, where four hundred
 * seconds of park runs in a second.
 *
 * What is left for a real page is what a real page adds:
 *
 * - the **canvas** actually has a crowd on it, and the ground is not the whole
 *   picture;
 * - the **camera** height reaches the picture — where a head lands for a given
 *   height is `placeHeads`, and `draw.test.ts` checks it against the pinhole
 *   with one walker and no canvas;
 * - the chrome's **escape hatches** work for tools that cannot evaluate JS (a
 *   scene round-tripping through its URL is the shared address codec's, and is
 *   tested for every piece at once in `tests/unit/experiments-urls.test.ts`);
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

/**
 * A cold landing — two seconds of park, not a minute: the opening cast is
 * scattered across the whole world, so the frame is full from the first frame.
 */
test("a crowd, on a ground", async ({ page }) => {
  const experiment = await openWalkers(page, { settings: MODEST, idle: true })
  await experiment.api(({ api }) => api.settle(2))
  await painted(page)

  const stats = await experiment.api(({ api }) => api.stats())
  expect(stats.inFrame, "nobody in shot").toBeGreaterThan(5)
  expect(stats.heads, "heads drawn").toBeGreaterThanOrEqual(stats.inFrame)

  const canvas = await inked(page)
  // Either side, not a named one. `skinOf` pitches the crowd against the ground
  // and puts them on **whichever side has room**, so which of these two carries
  // the count is a property of the ground rather than of the crowd. Asserting
  // `darker` by name passed only while every scene also had a shadow under
  // everybody to guarantee it.
  expect(canvas.lighter + canvas.darker, "nothing on the ground at all").toBeGreaterThan(400)
  // And the crowd is a crowd rather than a covering: most of the frame is still
  // ground, which is what stops this passing on a canvas that has gone wrong in
  // some other way entirely.
  expect(canvas.lighter + canvas.darker).toBeLessThan(canvas.pixels * 0.5)

  await experiment.shot("crowd")
})

/**
 * The camera height reaches the picture.
 *
 * Wiring only. Where a head lands for a given camera is `placeHeads`, tested in
 * `draw.test.ts` against camera / (camera − z) with one walker and no canvas.
 * What a page adds is that the setting gets there: `set({ camera })` rebuilds
 * the view and repaints. It used to be asserted here as the mean radius of the
 * bright pixels after a forty-five-second settle, which in a younger park
 * counted grass as heads and failed 4 runs in 6 (#287).
 *
 * The clock is stopped, so nothing but the camera changes between frames — and
 * the paired control is the same frame painted twice, which has to come back
 * identical, or a difference between two cameras proves nothing.
 */
test("the camera height reaches the picture, and moves nothing but the picture", async ({ page }) => {
  const experiment = await openWalkers(page, { settings: { ...MODEST, camera: 120 }, idle: true })
  await experiment.api(({ api }) => api.settle(2))
  await experiment.api(({ api }) => api.set({ playback: 0 }))

  /** A fingerprint of the canvas, after the repaint `set` asks for. */
  const frameAt = async (camera: number) => {
    await experiment.api(({ api, arg }) => api.set({ camera: arg }), camera)
    await painted(page)
    const print = await page.evaluate(() => {
      const canvas = document.querySelector("canvas") as HTMLCanvasElement
      const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height)
      let hash = 2166136261
      for (let index = 0; index < data.length; index++) hash = Math.imul(hash ^ data[index]!, 16777619)
      return hash >>> 0
    })
    const stats = await experiment.api(({ api }) => api.stats())
    return { print, area: stats.area, clock: stats.clock, inFrame: stats.inFrame }
  }

  const high = await frameAt(120)
  const again = await frameAt(120)
  const low = await frameAt(9)

  expect(high.inFrame, "nobody in shot").toBeGreaterThan(3)
  expect(again.clock, "the clock moved, so the frames are not of one crowd").toBe(high.clock)
  expect(again.print, "the same frame painted twice came back different").toBe(high.print)
  expect(low.print, "the camera height never reached the picture").not.toBe(high.print)
  // The area in frame is set by span alone, so the height must not reframe the park.
  expect(low.area).toBeCloseTo(high.area, 5)
})

/**
 * browser-because: `settle` is the page's verb, not the crowd's. `advance` in
 * `walkers.ts` is what capped itself at sixteen steps, and `crowd.step` — all
 * the headless harness has — was never wrong. Asserting this against
 * `src/experiments/walkers/tests/park.ts` would be asserting that a loop written in the
 * test file runs the number of times the test file asked it to.
 */
test("settle moves the park forward, and by a lot", async ({ page }) => {
  const experiment = await openWalkers(page, { settings: MODEST, idle: true })

  /**
   * The regression this exists for.
   *
   * `settle` reused the frame loop's catch-up ceiling and was silently capped
   * at sixteen steps — an eighth of a second — so the poster recipe's
   * `settle(120)` did nothing, every still was of a park that had barely started
   * arriving, and nothing errored. A minute of park has to be a minute of park.
   *
   * Five seconds asked, not ninety. The fault is a ceiling of a handful of
   * steps — `MAX_STEPS` is 4 now, a thirtieth of a second — so any request
   * longer than that tells the two apart; ninety only made the honest version
   * slow. Seen failing with `advance` capped at `MAX_STEPS`: 0.075 s passed.
   */
  const before = await experiment.api(({ api }) => api.stats())
  const after = await experiment.api(({ api }) => api.settle(5))

  // Asserted on the **clock**, which is exact. Comparing a crowd before and
  // after is not: two different afternoons can hold the same number of people,
  // and this test passed and failed by coincidence before `stats()` could say
  // what time it was.
  expect(after.clock - before.clock, "five seconds of park did not pass").toBeGreaterThan(4.9)
  expect(after.inFrame).toBeGreaterThan(3)
})

/**
 * browser-because: a re-roll is a page action. `reroll()` is on the experiment
 * API, it is a button in the bar, and what is under test is that it replaces
 * the cast and nothing else in the scene — which is a claim about `api.get()`
 * round-tripping, not about how anybody walks.
 */
test("a re-roll is a different crowd at the same settings", async ({ page }) => {
  const experiment = await openWalkers(page, { settings: MODEST, idle: true })

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
  await experiment.api(({ api }) => api.settle(2))
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

test("?settle= lands on a park that has already been running", async ({ page }) => {
  // For tools that cannot evaluate JS, which is the same reason ?panel= and
  // ?idle= exist.
  //
  // Asserted on the **clock**. It used to compare populations, on the reasoning
  // that a cold landing is a nearly empty field — which was true when the
  // opening crowd was laid out only inside the frame, and stopped being true
  // when it was scattered across the whole world. A cold landing is now a full
  // frame, so the population says nothing and the two readings differed by one
  // person.
  //
  // Five seconds, not a hundred and twenty: a cold landing's clock is a frame
  // or two, so anything past a second tells the two apart. Seen failing with
  // `advance` capped at `MAX_STEPS`: the warm landing's clock read 0.26.
  const cold = await openWalkers(page, { settings: MODEST, query: { idle: "1" } })
  const coldStats = await cold.api(({ api }) => api.stats())

  const warm = await openWalkers(page, { settings: MODEST, query: { idle: "1", settle: "5" } })
  const warmStats = await warm.api(({ api }) => api.stats())

  expect(coldStats.clock).toBeLessThan(1)
  expect(warmStats.clock).toBeGreaterThan(4.9)
  expect(warmStats.inFrame).toBeGreaterThan(3)
})

test("the primary runs, populates and draws", async ({ page }) => {
  // **The primary, not every preset — #238.** A preset is a set of parameters,
  // and that it is a valid one is `tests/unit/experiments-presets.test.ts`'s
  // job, in milliseconds. Every preset goes through the same renderer, so
  // settling and drawing each one here proved only that the same code ran with
  // other numbers, at a browser run per preset.
  const experiment = await openWalkers(page, { idle: true })
  const names = await experiment.api(({ api }) => api.presets())
  expect(names).toEqual(PRESETS.map((preset) => preset.label))

  await experiment.api(({ api }) => {
    api.preset(1)
    api.settle(2)
  })
  await painted(page)

  const stats = await experiment.api(({ api }) => api.stats())
  expect(stats.inFrame, `${names[0]} has nobody in shot`).toBeGreaterThan(1)
  expect(stats.overlap, `${names[0]} has somebody inside somebody`).toBeLessThan(0.05)

  // Dots are pitched away from the ground in whichever direction has room, so
  // a scene draws them either lighter or darker than it. What it owes is
  // *some* ink: a frame that is all ground is a frame where the piece did not
  // run.
  const canvas = await inked(page)
  expect(canvas.lighter + canvas.darker, `${names[0]} drew nothing at all`).toBeGreaterThan(60)

  await experiment.shot(`preset-${names[0]!.replace(/\s+/g, "-")}`)
})
