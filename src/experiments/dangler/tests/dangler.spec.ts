import type { ExperimentApi } from "@/experiments/dangler/runner"
import { expect, openExperiment, test } from "../../../../tests/support/experiment"
import { litPixels as countLit } from "../../../../tests/support/canvas.ts"

/**
 * Dangler, driven through its console API.
 *
 * Every test here corresponds to something `src/experiments/dangler/AGENTS.md`
 * records as a real bug or a stated invariant, and none of them is a pixel
 * comparison — a wrong strand and a right one both look like a scatter of dots.
 * The one visual assertion is that there is *light on the canvas at all*, which
 * is robust and which caught a real bug (a parked loop plus a resize left the
 * piece simply gone).
 *
 * Dangler's own thresholds and its ground colour live here rather than in
 * `support/experiment.ts`: per ADR-0002 nothing gets hoisted out of one piece
 * until a second and a third want it.
 */

/**
 * Settled, the largest link-length violation sits around 2e-4. Above about 1e-2
 * the strands are stretching or crumpling and any still is of a shape the piece
 * never actually holds.
 */
const SETTLED_MAX_CONSTRAINT_ERROR = 1e-2

/**
 * The ground is `#05070c`, so its channels sum to 24. Anything well above that
 * is a bulb rather than the background.
 */
const LIT_THRESHOLD = 90

/** A scene big enough to be representative and small enough to settle fast. */
const MODEST_SCENE = { strands: 12, segments: 18 }

function openDangler(page: Parameters<typeof openExperiment>[0], options?: Parameters<typeof openExperiment>[2]) {
  return openExperiment<ExperimentApi>(page, "dangler", options)
}

/** How many canvas pixels are brighter than the ground. */
const litPixels = (page: Parameters<typeof openExperiment>[0]) => countLit(page, LIT_THRESHOLD)

test("settles to a shape it actually holds, with light on the canvas", async ({ page }) => {
  const experiment = await openDangler(page, { settings: MODEST_SCENE, idle: true })

  await experiment.api(({ api }) => api.settle())
  const stats = await experiment.api(({ api }) => api.stats())

  expect(stats.strands).toBe(MODEST_SCENE.strands)
  expect(stats.maxConstraintError).toBeLessThan(SETTLED_MAX_CONSTRAINT_ERROR)
  // A 200 and a settled solver still say nothing about anything reaching the
  // canvas; `drawnBeads` is bulbs that survived the projection and the clip.
  expect(stats.drawnBeads).toBeGreaterThan(0)
  expect(await litPixels(page)).toBeGreaterThan(0)

  await experiment.shot("settled")
})

test("reduced motion gets a still frame, not a running loop and not a blank canvas", async ({ page }) => {
  // Motion stated rather than inherited. The point is to prove the loop parks
  // *because* of the preference, so the scene has to be one that would otherwise
  // be running — and which scene the defaults describe is editorial, not
  // something this test should depend on.
  const moving = { ...MODEST_SCENE, breeze: 0.4 }

  const animated = await openDangler(page, { settings: moving })
  await expect.poll(() => animated.api(({ api }) => api.stats().running)).toBe(true)

  // Pinned before the piece starts, so the strands are laid out, settled and never
  // set moving — which is what lets the loop park with no separate
  // reduced-motion path.
  //
  // Turning the preference on *mid-session* is a different thing and is not
  // asserted here: the change listener stops the wind, but strands already
  // swinging then coast until `ropes.atRest()`, which was still false after 30s
  // of measuring. The documented invariant is the one at load.
  const still = await openDangler(page, { settings: moving, reducedMotion: true })
  await expect.poll(() => still.api(({ api }) => api.stats().running)).toBe(false)
  expect(await litPixels(page)).toBeGreaterThan(0)
})

test("a resize does not blank the piece", async ({ page }) => {
  const experiment = await openDangler(page, { settings: MODEST_SCENE, idle: true })
  await experiment.api(({ api }) => api.settle())
  expect(await litPixels(page)).toBeGreaterThan(0)

  // Setting `canvas.width` on a resize clears it, so a parked loop used to
  // leave the piece simply gone. Anything that changes the picture without
  // moving a particle has to mark the scene dirty.
  await page.setViewportSize({ width: 900, height: 1200 })
  await expect.poll(() => litPixels(page)).toBeGreaterThan(0)

  await experiment.shot("resized")
})
