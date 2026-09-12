import type { ExperimentApi } from "@/experiments/embers/api"
import { expect, openExperiment, test } from "./support/experiment"
import { litPixels as countLit } from "./support/canvas.ts"

/**
 * Embers, driven through its console API.
 *
 * **What is here is deliberately only what needs a browser.** The physics — the
 * plume, the drag balance, the cooling, the eddy field — is DOM-free and lives in
 * `tests/unit/embers/fire.test.ts`, which answers in milliseconds and is where
 * both of the piece's real faults were found. What that cannot reach is the
 * canvas: whether anything is actually painted, what a frame costs, and whether
 * a reduced-motion visitor gets a fire or an empty rectangle.
 *
 * **The piece's frame cost is checked in the unit runner, not here**, and the
 * reason is worth keeping. It was asserted through `drawMs` as a ratio between
 * two flare settings, on the section's own advice that a headless run's absolute
 * frame times are pessimistic and its ratios are not. That advice does not
 * survive four parallel workers: contention is added to *both* halves of a
 * wall-clock ratio, so at enough load the ratio approaches 1 whatever the
 * drawing is doing. Measured — 30.7 ms against 15.5 ms where the same test alone
 * gives 8 ms against 1.6 ms — it failed one run in three and passed every time
 * it was run by itself, which is the exact signature of flotsam's #65.
 *
 * The claim underneath it is about *area*, which is arithmetic:
 * `tests/unit/embers/mark.test.ts` holds `haloRadius` to it, and the measured
 * milliseconds live in `src/experiments/embers/AGENTS.md`, where a measurement
 * belongs.
 */

/** The ground is `hsl(25 55% 2.6%)`, whose channels sum to about 18. */
const LIT_THRESHOLD = 90

const openFire = (page: Parameters<typeof openExperiment>[0], options?: Parameters<typeof openExperiment>[2]) =>
  openExperiment<ExperimentApi>(page, "embers", options)

const litPixels = (page: Parameters<typeof openExperiment>[0]) => countLit(page, LIT_THRESHOLD)

test("puts embers over the fire, and draws fewer of them than it is carrying", async ({ page }) => {
  const experiment = await openFire(page, { idle: true })

  // Ten seconds, because the scene does not exist at t=0 in either sense: an
  // ember takes a second or two to cross the frame, and the picture is built up
  // over frames wherever the shutter is open.
  const stats = await experiment.api(({ api }) => {
    api.settle(10)
    return api.stats()
  })

  expect(stats.alive).toBeGreaterThan(50)
  expect(stats.running).toBe(true)
  expect(stats.clock).toBeGreaterThan(9)
  expect(await litPixels(page)).toBeGreaterThan(0)

  /**
   * **Fewer drawn than alive, and that gap is the point of the whole palette.**
   *
   * An ember's visible emission collapses by four orders of magnitude as it
   * cools, so it stops being worth a mark well before it stops being an ember.
   * A piece that faded brightness linearly over a lifetime would have these two
   * numbers equal, and would look like a particle system.
   */
  expect(stats.drawn).toBeGreaterThan(0)
  expect(stats.drawn).toBeLessThan(stats.alive)

  await experiment.shot("campfire")
})

test("a mote is drawn with no body at all, and still paints", async ({ page }) => {
  // `mark: mote` skips the core and the streak — the halo is the whole mark. It
  // is the one mark kind a refactor of the drawing could silently blank, because
  // every other kind would keep painting from its core.
  const experiment = await openFire(page, { settings: { mark: "mote", hue: 190, hueSpread: 50 }, idle: true })

  const stats = await experiment.api(({ api }) => {
    api.settle(8)
    return api.stats()
  })

  expect(stats.drawn).toBeGreaterThan(0)
  expect(await litPixels(page)).toBeGreaterThan(0)

  await experiment.shot("motes")
})

test("reduced motion gets a fire that has been going a while, and no loop", async ({ page }) => {
  const experiment = await openFire(page, { reducedMotion: true, idle: true })

  const stats = await experiment.api(({ api }) => api.stats())

  // A still, not a stopped clock at zero: `start()` runs the fire forward before
  // it paints, because a picture of the moment a fire was lit is not a picture
  // of this piece. And the accumulation matters here too — the last stretch of
  // that run-up is drawn as well as stepped, or a scene with trails arrives with
  // none.
  expect(stats.running).toBe(false)
  expect(stats.clock).toBeGreaterThan(10)
  expect(stats.alive).toBeGreaterThan(50)
  expect(await litPixels(page)).toBeGreaterThan(0)

  await experiment.shot("reduced-motion")
})

test("settings survive the round trip through the query string", async ({ page }) => {
  const experiment = await openFire(page)

  const applied = await experiment.api(({ api }) => {
    // Every control, moved off whatever it currently is, so the round trip has
    // to carry it. `mark` is swept too: it is not a number, and a report that
    // gave it bounds would have this loop setting values the validator rejects
    // — passing while testing nothing. See #85.
    const patch: Record<string, unknown> = {}
    for (const control of api.controls()) {
      const key = control.key
      if (control.kind === "slider" || control.kind === "range") {
        patch[key] = control.min + (control.max - control.min) * 0.37
      } else if (control.kind === "choice" || control.kind === "set") {
        const held = api.get()[key as keyof ReturnType<typeof api.get>]
        patch[key] = control.options.find((option) => option !== held) ?? control.options[0]
      } else {
        patch[key] = !api.get()[key as keyof ReturnType<typeof api.get>]
      }
    }

    // Kept small for runtime only; a small population round-trips the same code.
    api.set({ ...patch, count: 200 } as Parameters<typeof api.set>[0])
    return { settings: api.get(), url: api.url() }
  })

  await page.goto(applied.url)
  await page.waitForFunction(() => Boolean(window.experiment))
  const restored = await experiment.api(({ api }) => api.get())

  expect(restored).toEqual(applied.settings)
})
