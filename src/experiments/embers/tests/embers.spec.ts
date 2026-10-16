import type { ExperimentApi } from "@/experiments/embers/runner"
import { expect, openExperiment, test } from "../../../../tests/support/experiment"
import { litPixels as countLit } from "../../../../tests/support/canvas.ts"

/**
 * Embers, driven through its console API.
 *
 * **What is here is deliberately only what needs a browser.** The physics — the
 * plume, the drag balance, the cooling, the eddy field — is DOM-free and lives in
 * `src/experiments/embers/tests/fire.test.ts`, which answers in milliseconds and is where
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
 * `src/experiments/embers/tests/mark.test.ts` holds `haloRadius` to it, and the measured
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
  // over frames wherever the shutter is open. **Not shorter**: tried at three on
  // 2026-10-16, and the unpainted band below had not filled yet — the share came
  // out 0.03 to 0.38 in 9 runs of 12. An ember has to live long enough to cool
  // into it, which is the fire's time and not the test's.
  //
  // Then a further second, one frame at a time, all inside this one call so
  // nothing can step the piece between a frame and the stats read after it.
  const { stats, frames } = await experiment.api(({ api }) => {
    api.settle(10)
    const stats = api.stats()
    const frames: { alive: number; drawn: number }[] = []
    for (let frame = 0; frame < 60; frame++) {
      api.settle(1 / 60)
      const { alive, drawn } = api.stats()
      frames.push({ alive, drawn })
    }
    return { stats, frames }
  })

  expect(stats.alive).toBeGreaterThan(50)
  expect(stats.running).toBe(true)
  expect(stats.clock).toBeGreaterThan(9)
  expect(await litPixels(page)).toBeGreaterThan(0)

  /**
   * **Fewer drawn than alive, and that gap is the point of the whole palette.**
   *
   * An ember's visible emission collapses by four orders of magnitude as it
   * cools, so it stops being worth a mark before it stops being an ember. A
   * piece that faded brightness linearly over a lifetime would have these two
   * numbers equal, and would look like a particle system. It is also the only
   * thing that sees retirement drift above the paint cutoff — `SEEN` in
   * `palette.ts` has the history.
   *
   * **Read over a second, not at an instant — #226.** The unpainted band is
   * narrow on purpose: `SEEN.keep` is half of `SEEN.paint`, so at any moment it
   * holds a handful of the ~900 embers and sometimes none. Measured over 600
   * frames: the gap has a median of 9 and a tenth percentile of 1, and it is
   * zero in 21 frames — 3.5%, so a single sample failed about one run in 28.
   * With retirement at or above the cutoff (`keep` set to 0.004 or 0.006) it
   * is zero in all 600. So the assertion is on the share of frames, which
   * separates 96% from 0% with room either side.
   */
  expect(stats.drawn).toBeGreaterThan(0)
  const unpainted = frames.filter(({ alive, drawn }) => drawn < alive).length
  expect(unpainted / frames.length).toBeGreaterThan(0.5)

  await experiment.shot("campfire")
})

test("a mote is drawn with no body at all, and still paints", async ({ page }) => {
  // `mark: mote` skips the core and the streak — the halo is the whole mark. It
  // is the one mark kind a refactor of the drawing could silently blank, because
  // every other kind would keep painting from its core. Two seconds rather than
  // eight: skipping the halo for a mote still fails it, seen 2026-10-16.
  const experiment = await openFire(page, { settings: { mark: "mote", hue: 190, hueSpread: 50 }, idle: true })

  const stats = await experiment.api(({ api }) => {
    api.settle(2)
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
