import type { ExperimentApi } from "@/experiments/flotsam/api"
import { DEFAULT_SETTINGS, PRESETS } from "@/experiments/flotsam/settings"
import { expect, openExperiment, test } from "./support/experiment"

/**
 * Flotsam, driven through its console API.
 *
 * The piece is about two things that are invisible in a still — flotsam
 * *gathering* into lines, and flotsam being shaken hard while going nowhere — so
 * almost every test here reads a number rather than looking. The one visual
 * assertion is that there is light on the canvas at all, which is coarse,
 * robust, and caught a real bug in Dangler (a parked loop plus a resize left the
 * piece simply gone).
 *
 * Flotsam's own thresholds and its ground colour live here rather than in
 * `support/experiment.ts`: per ADR-0002 nothing gets hoisted out of one piece
 * until a second and a third want it.
 */

/**
 * The ground is `#04080b`, so its channels sum to 23. Anything well above that
 * is a piece of flotsam rather than the water.
 */
const LIT_THRESHOLD = 90

/** Below this the sea has folded over itself; see `FlotsamStats.minJacobian`. */
const FOLDED = 0

/**
 * A uniform random scatter disperses at 1. The homes are drawn uniformly, so
 * anything meaningfully above this is the waves having gathered the flotsam.
 */
const UNGATHERED = 1

/** Small enough to run fast, dense enough for a dispersion reading to mean something. */
const MODEST = { dots: 3000 }

function openFlotsam(page: Parameters<typeof openExperiment>[0], options?: Parameters<typeof openExperiment>[2]) {
  return openExperiment<ExperimentApi>(page, "flotsam", options)
}

/** How many canvas pixels are brighter than the water. */
async function litPixels(page: Parameters<typeof openExperiment>[0]): Promise<number> {
  return page.evaluate((threshold) => {
    const canvas = document.querySelector("canvas")
    if (!canvas) throw new Error("no canvas on the page")
    const context = canvas.getContext("2d")
    if (!context) throw new Error("no 2d context")
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    let lit = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i]! + data[i + 1]! + data[i + 2]! > threshold) lit++
    }
    return lit
  }, LIT_THRESHOLD)
}

test("draws flotsam on unfolded water", async ({ page }) => {
  const experiment = await openFlotsam(page, { settings: MODEST, idle: true })

  const stats = await experiment.api(({ api }) => api.stats())
  expect(stats.dots).toBe(MODEST.dots)
  // A 200 says nothing about anything reaching the canvas; `drawnDots` is
  // flotsam that survived the cull.
  expect(stats.drawnDots).toBeGreaterThan(0)
  expect(stats.minJacobian).toBeGreaterThan(FOLDED)
  expect(await litPixels(page)).toBeGreaterThan(0)

  await experiment.shot("landing")
})

/**
 * The piece's thesis, and the one thing that must never break.
 *
 * A violent sea with no current at all: the flotsam swings by half a metre and
 * has to be exactly where it started, because the wave displacement is a closed
 * form recomputed from the rest position every frame and nothing about it
 * accumulates. Anything above zero here means a wave has started transporting,
 * which is what the whole piece says waves do not do.
 */
test("a sea with no current takes the flotsam nowhere at all, however hard it shakes it", async ({ page }) => {
  const experiment = await openFlotsam(page, {
    settings: { ...MODEST, steepness: 0.9, trains: 1, drift: 0, eddies: 0, stokes: 0 },
    idle: true,
  })

  await experiment.api(({ api }) => api.run(120))
  const stats = await experiment.api(({ api }) => api.stats())

  expect(stats.transport).toBe(0)
  expect(stats.orbit).toBeGreaterThan(0.1)
})

/**
 * The other half of the same claim: a current a hundred times slower than the
 * swinging is the thing that actually moves flotsam.
 */
test("a slow current transports where a fast sea does not", async ({ page }) => {
  const experiment = await openFlotsam(page, {
    settings: { ...MODEST, steepness: 0.9, drift: 0.2, bearing: 0, eddies: 0, stokes: 0 },
    idle: true,
  })

  const stats = await experiment.api(({ api }) => api.stats())
  expect(stats.transport).toBeCloseTo(0.2, 3)
})

/**
 * The emergent behaviour the piece exists for, and there is no way to see it in
 * a still: a scatter that has gathered and one that has not both look like a
 * scatter of dots.
 */
test("a steep sea gathers the flotsam into lines, and a flat one does not", async ({ page }) => {
  const experiment = await openFlotsam(page, {
    settings: { dots: 9000, trains: 1, shortest: 6, longest: 6, steepness: 0, drift: 0, eddies: 0, stokes: 0 },
    idle: true,
  })

  const flat = await experiment.api(({ api }) => api.stats())
  expect(flat.dispersion).toBeCloseTo(UNGATHERED, 0)

  await experiment.api(({ api }) => api.set({ steepness: 0.85 }))
  await experiment.api(({ api }) => api.run(4))
  const steep = await experiment.api(({ api }) => api.stats())

  expect(steep.dispersion).toBeGreaterThan(3)
  // And it is genuinely the waves: the compression that did it is reported too.
  expect(steep.minJacobian).toBeLessThan(0.2)
  expect(steep.minJacobian).toBeGreaterThan(FOLDED)

  await experiment.shot("gathered")
})

/**
 * The bug that cost an afternoon and looked like a triumph.
 *
 * The eddies are incompressible *and* periodic on the wrapped patch, which
 * together are what stop them concentrating anything — so that every clump on
 * screen is the waves' doing. Before the periodicity, one minute of this took
 * the dispersion from 1 to 134: it emptied most of the frame and swept
 * everything into a few clots, and it looked like a spectacular emergent result
 * rather than a torus with a seam in it.
 */
test("eddies stir the flotsam for a minute without gathering any of it", async ({ page }) => {
  const experiment = await openFlotsam(page, {
    settings: { dots: 9000, steepness: 0, drift: 0, stokes: 0, eddies: 0.9, gyre: 3, span: 8 },
    idle: true,
  })

  const before = await experiment.api(({ api }) => api.stats())
  await experiment.api(({ api }) => api.run(60))
  const after = await experiment.api(({ api }) => api.stats())

  // It really did stir: sixty seconds at nearly a metre a second over
  // three-metre gyres is many turnovers, not a nudge.
  expect(after.transport).toBeGreaterThan(0.1)
  expect(after.dispersion).toBeLessThan(1.25)
  expect(Math.abs(after.dispersion - before.dispersion)).toBeLessThan(0.3)
})

/**
 * Wave drift is invisible on any single frame by construction — that is the
 * point of it — so the only way to check it exists is to skip a minute forward
 * and ask where everything went.
 */
test("wave drift moves the flotsam over a minute and nothing over a frame", async ({ page }) => {
  const experiment = await openFlotsam(page, {
    settings: { ...MODEST, trains: 1, shortest: 8, longest: 8, steepness: 0.6, drift: 0, eddies: 0, stokes: 1 },
    idle: true,
  })

  const stats = await experiment.api(({ api }) => api.stats())
  // uₛ = Q²c, and an eight-metre wave runs at 3.5 m/s, so 0.36 × 3.5.
  expect(stats.transport).toBeGreaterThan(0.5)
  expect(stats.transport).toBeLessThan(2)

  const off = await experiment.api(({ api }) => api.set({ stokes: 0 }))
  expect(off.stokes).toBe(0)
  expect((await experiment.api(({ api }) => api.stats())).transport).toBe(0)
})

test("a raft ignores the chop a speck beside it is tracing", async ({ page }) => {
  // The wave is deliberately long against the dispersion grid, not against the
  // rafts: gathering finer than a grid cell is invisible to the statistic, and a
  // first version of this test measured a 40cm wave through 30cm cells and read
  // a real four-to-one compression as 1.4.
  const experiment = await openFlotsam(page, {
    settings: { dots: 4000, trains: 1, shortest: 1.2, longest: 1.2, steepness: 0.8, span: 6 },
    idle: true,
  })

  // Everything tiny: all of it follows the ripple, so the water is compressed
  // and the flotsam gathers.
  await experiment.api(({ api }) => api.set({ smallest: 0.004, largest: 0.006 }))
  await experiment.api(({ api }) => api.run(3))
  const specks = await experiment.api(({ api }) => api.stats())

  // Everything a metre across: it spans the wave and barely notices it.
  await experiment.api(({ api }) => api.set({ smallest: 1, largest: 1.2 }))
  await experiment.api(({ api }) => api.run(3))
  const rafts = await experiment.api(({ api }) => api.stats())

  expect(specks.orbit).toBeGreaterThan(rafts.orbit * 50)
  expect(specks.dispersion).toBeGreaterThan(2)
  // The rafts are left where a flat sea would have left them.
  expect(rafts.dispersion).toBeCloseTo(UNGATHERED, 0)
})

test("every setting has a control, so the panel and a shared URL cannot disagree", async ({ page }) => {
  const experiment = await openFlotsam(page)

  const uncontrolled = await experiment.api(({ api }) => {
    const controlled = new Set(api.controls().map((control) => control.key))
    return Object.keys(api.get()).filter((key) => !controlled.has(key))
  })

  // `seed` is the one setting with no slider; it has a re-roll button instead.
  expect(uncontrolled).toEqual(["seed"])
})

test("a scene survives a round trip through its own URL", async ({ page }) => {
  const experiment = await openFlotsam(page)

  const scene = await experiment.api(({ api }) => api.preset("riptide"))
  const url = await experiment.api(({ api }) => api.url())

  await page.goto(url)
  await page.waitForFunction(() => Boolean(window.experiment))
  expect(await experiment.api(({ api }) => api.get())).toEqual(scene)
})

test("a bare URL lands on the featured scene and says so in the address bar", async ({ page }) => {
  const experiment = await openFlotsam(page)

  expect(await experiment.api(({ api }) => api.get())).toEqual(PRESETS[0]!.settings)
  // The defaults *are* the first preset here, so the address stays bare — which
  // is the case that would break if the two were ever allowed to drift apart.
  expect(new URL(await experiment.api(({ api }) => api.url())).search).toBe("")
  expect(PRESETS[0]!.settings).toEqual(DEFAULT_SETTINGS)
})

test("re-rolling changes the water and keeps the settings", async ({ page }) => {
  const experiment = await openFlotsam(page, { settings: MODEST })

  const before = await experiment.api(({ api }) => api.get())
  const seed = await experiment.api(({ api }) => api.reroll())
  const after = await experiment.api(({ api }) => api.get())

  expect(seed).not.toBe(before.seed)
  expect({ ...after, seed: before.seed }).toEqual(before)
})

test("raising the count adds flotsam beside what is there rather than restirring it", async ({ page }) => {
  const experiment = await openFlotsam(page, {
    settings: { dots: 900, steepness: 0, drift: 0, eddies: 0, stokes: 0 },
    idle: true,
  })

  const before = await experiment.api(({ api }) => api.stats())
  const lit = await litPixels(page)

  await experiment.api(({ api }) => api.set({ dots: 5000 }))
  const after = await experiment.api(({ api }) => api.stats())

  expect(after.dots).toBe(5000)
  // Still water, so the original nine hundred have not moved: the canvas can
  // only have gained light, never lost it.
  expect(await litPixels(page)).toBeGreaterThan(lit)
  expect(after.dispersion).toBeCloseTo(before.dispersion, 0)
})

test("reduced motion gets a still frame of shaped water, and parks the loop", async ({ page }) => {
  const experiment = await openFlotsam(page, { settings: MODEST, idle: true, reducedMotion: true })

  // Not a flat sea: the clock simply does not advance, so the still keeps all
  // the shape and gathering the sea has at t = 0.
  const stats = await experiment.api(({ api }) => api.stats())
  expect(stats.orbit).toBeGreaterThan(0)
  expect(await litPixels(page)).toBeGreaterThan(0)

  await expect.poll(async () => (await experiment.api(({ api }) => api.stats())).running, { timeout: 5000 }).toBe(false)
})

test("the debug overlay draws the crests and the current the piece never shows", async ({ page }) => {
  const experiment = await openFlotsam(page, { settings: MODEST, idle: true })

  const plain = await litPixels(page)
  await experiment.api(({ api }) => api.debug(true))
  // The overlay is opaque strokes over an otherwise dark canvas, so it can only
  // add lit pixels. With only flotsam visible, a sea running the wrong way and a
  // current running the wrong way look identical.
  expect(await litPixels(page)).toBeGreaterThan(plain)

  await experiment.shot("debug")
})

test("survives a resize instead of vanishing", async ({ page }) => {
  const experiment = await openFlotsam(page, { settings: MODEST, idle: true })

  await page.setViewportSize({ width: 700, height: 1000 })
  await expect.poll(() => litPixels(page), { timeout: 5000 }).toBeGreaterThan(0)
  expect((await experiment.api(({ api }) => api.stats())).drawnDots).toBeGreaterThan(0)
})
