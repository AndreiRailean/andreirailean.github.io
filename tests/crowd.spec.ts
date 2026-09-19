import type { ExperimentApi } from "@/experiments/crowd/api"
import { PRESETS } from "@/experiments/crowd/settings"
import { expect, openExperiment, test } from "./support/experiment"

/**
 * Crowd, driven through its console API.
 *
 * The division of labour with `tests/unit/crowd/` is sharp, and it is the same
 * one Walkers draws: the crowd needs no browser at all. Who is out there,
 * whether they walk through each other, whether the population holds over a
 * hundred metres of walking, whether a counterflow sorts itself into files —
 * all arithmetic, all in the unit suite, where two minutes of walking runs in
 * twenty seconds.
 *
 * What is left for a real page is what a real page adds:
 *
 * - the **canvas** has a crowd on it rather than a black rectangle, which is
 *   what a parked loop or a botched resize produces and what every number in
 *   `stats()` is blind to;
 * - the **projection** does what the geometry says, in pixels — a head passing
 *   close is large, a head at the back is a speck, and who is above the horizon
 *   depends on how tall the observer is;
 * - the **settings round-trip** through a URL, and the escape hatches work for
 *   tools that cannot evaluate JS;
 * - **reduced motion** gets a populated still rather than one loop-free frame of
 *   a crowd that has not moved, which no screenshot can distinguish.
 */

/** Small enough to run fast, busy enough that the assertions mean something. */
const MODEST = { density: 18, fade: 14 }

function openCrowd(page: Parameters<typeof openExperiment>[0], options?: Parameters<typeof openExperiment>[2]) {
  return openExperiment<ExperimentApi>(page, "crowd", options)
}

/**
 * Wait until the piece has painted, before reading its canvas or a draw-time stat.
 *
 * `set()` does not draw. It marks the scene dirty and asks for a single
 * animation frame, so the canvas holds the *previous* frame and `drawn`,
 * `fills` and `largest` hold the previous frame's values until it runs. See the
 * section on this in `tests/AGENTS.md`; it has cost two sessions across two
 * pieces, and this piece has four stats in that window.
 */
const painted = (page: Parameters<typeof openExperiment>[0]) =>
  page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))))

/** How much of the canvas is brighter than the black it is drawn on. */
async function lit(page: Parameters<typeof openExperiment>[0]) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas")
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("no canvas")
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) throw new Error("no 2d context")
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
    let above = 0
    let brightest = 0
    // The topmost and bottommost lit rows, as a fraction of the frame.
    let top = 1
    let bottom = 0
    for (let i = 0; i < data.length; i += 4) {
      const value = data[i]!
      if (value <= 8) continue
      above++
      if (value > brightest) brightest = value
      const row = Math.floor(i / 4 / width) / height
      if (row < top) top = row
      if (row > bottom) bottom = row
    }
    return { fraction: above / (width * height), brightest, top, bottom }
  })
}

test("there is a crowd on the canvas, not a black rectangle", async ({ page }) => {
  const experiment = await openCrowd(page, { idle: false })
  await experiment.api(({ api, arg }) => api.set(arg), MODEST)
  await experiment.api(({ api }) => api.settle(6))
  await painted(page)

  const { fraction, brightest } = await lit(page)
  // Heads are white on black and nothing else is drawn, so a crowd is a small
  // fraction of the frame — but not none of it, and not all of it.
  expect(fraction).toBeGreaterThan(0.0015)
  expect(fraction).toBeLessThan(0.4)
  expect(brightest).toBeGreaterThan(180)

  await experiment.shot("crowd-market")
})

test("the frame is a band around the eye line, because heads are all near one height", async ({ page }) => {
  const experiment = await openCrowd(page, { idle: false })
  // Level, so the band sits at the middle of the frame and the claim is about
  // the world rather than about the pitch.
  await experiment.api(({ api, arg }) => api.set(arg), { ...MODEST, pitch: 0, height: 1.72 })
  await experiment.api(({ api }) => api.settle(6))
  await painted(page)

  const { top, bottom } = await lit(page)
  // Nothing is drawn far above the eye line — there are no bodies, no sky and
  // nobody three metres tall — and the near heads spread downward. If this ever
  // fills the whole frame, something is being drawn that is not a head.
  expect(top).toBeGreaterThan(0.1)
  expect(bottom).toBeGreaterThan(0.45)
})

test("a head passing close is large and a head at the back is a speck", async ({ page }) => {
  const experiment = await openCrowd(page, { idle: false })
  await experiment.api(({ api, arg }) => api.set(arg), { ...MODEST, density: 45, fade: 15 })
  // Long enough that somebody has actually come past. The claim is about the
  // projection, and a crowd that has not moved has nobody near the camera.
  await experiment.api(({ api }) => api.settle(40))
  await painted(page)

  const stats = await experiment.api(({ api }) => api.stats())
  // Somebody within a few metres, drawn tens of pixels across.
  expect(stats.largest).toBeGreaterThan(12)
  // And far more heads than that reaching the glass, which are the far ones.
  expect(stats.drawn).toBeGreaterThan(120)
  // The batching is the whole reason a thousand heads is affordable: one fill
  // per brightness rather than one per head.
  expect(stats.fills).toBeLessThan(stats.drawn / 3)
})

test("how tall the observer is decides who is above the horizon", async ({ page }) => {
  const experiment = await openCrowd(page, { idle: false })
  // The piece's premise, in pixels: at a child's height the crowd is overhead,
  // and at well above everybody's it is not. Nothing else in the piece
  // distinguishes a child from an adult by more than an eighth.
  const litAbove = async (height: number) => {
    await experiment.api(({ api, arg }) => api.set(arg), { ...MODEST, pitch: 0, height })
    await experiment.api(({ api }) => api.settle(4))
    await painted(page)
    return (await lit(page)).top
  }

  const asChild = await litAbove(1.1)
  const asGiant = await litAbove(2.05)
  // A child has heads well above the middle of the frame; somebody 2.05 m tall
  // has almost nothing up there.
  expect(asChild).toBeLessThan(asGiant)
})

test("settings round-trip through the address, and a bare visit lands on the primary", async ({ page }) => {
  const experiment = await openCrowd(page)
  const landed = await experiment.api(({ api }) => api.get())
  const primary = PRESETS[0]!.settings
  expect(landed.density).toBe(primary.density)
  expect(landed.height).toBe(primary.height)

  // The landing rewrite: a visitor leaves with a link to *this* scene rather
  // than to whatever is featured next month.
  expect(page.url()).toContain("?s=")

  const address = await experiment.api(({ api, arg }) => api.set(arg).density !== arg.density, {
    density: 33,
    fade: 12,
  })
  expect(address).toBe(false)

  const url = await experiment.api(({ api }) => api.url())
  await page.goto(url)
  const restored = await experiment.api(({ api }) => api.get())
  expect(restored.density).toBe(33)
  expect(restored.fade).toBe(12)
})

test("the escape hatches work for a tool that cannot evaluate JS", async ({ page }) => {
  // `?panel=1` and `?settle=` exist because `webcheck` and anything like it
  // cannot reach the console API at all.
  await page.goto("/experiments/crowd/?panel=1&idle=0&settle=8")
  await page.waitForFunction(() => Boolean(window.experiment))
  await expect(page.locator(".panel")).toBeVisible()

  const clock = await page.evaluate(() => (window.experiment as ExperimentApi).stats().clock)
  expect(clock).toBeGreaterThan(7)
})

test("reduced motion gets a crowd, and no loop", async ({ page }) => {
  const experiment = await openCrowd(page, { reducedMotion: true })
  const stats = await experiment.api(({ api }) => api.stats())

  // No frame loop — an invariant no screenshot can show, because a held crowd
  // and a walking one look identical in a photograph.
  expect(stats.running).toBe(false)
  // And a walk that has been going, rather than the moment before anybody had
  // negotiated anything.
  expect(stats.clock).toBeGreaterThan(1)
  expect(stats.drawn).toBeGreaterThan(50)
})

test("a re-roll is a different crowd at the same settings", async ({ page }) => {
  const experiment = await openCrowd(page, { idle: false })
  await experiment.api(({ api, arg }) => api.set(arg), MODEST)
  const before = await experiment.api(({ api }) => api.stats().children)
  const seed = await experiment.api(({ api }) => api.reroll(4242))
  expect(seed).toBe(4242)

  const after = await experiment.api(({ api }) => api.get())
  expect(after.seed).toBe(4242)
  // The settings that decide the picture are untouched; only who is in it moves.
  expect(after.density).toBe(MODEST.density)
  void before
})
