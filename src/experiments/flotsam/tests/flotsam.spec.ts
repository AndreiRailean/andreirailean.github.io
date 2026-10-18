import type { ExperimentApi } from "@/experiments/flotsam/runner"
import { expect, openExperiment, test } from "../../../../tests/support/experiment"
import { litPixels as countLit } from "../../../../tests/support/canvas.ts"

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

/** Small enough to run fast, dense enough for a dispersion reading to mean something. */
const MODEST = { dots: 3000 }

function openFlotsam(page: Parameters<typeof openExperiment>[0], options?: Parameters<typeof openExperiment>[2]) {
  return openExperiment<ExperimentApi>(page, "flotsam", options)
}

/**
 * Wait until the piece has painted, before reading its canvas.
 *
 * `set()` does not draw. It marks the scene dirty and asks for a single
 * animation frame — `wake()` in `flotsam.ts` — so the canvas still holds the
 * *previous* frame until that frame runs. A read in the round trip straight
 * after a `set()` is therefore a read of the old scene, and how wide that window
 * is depends on when the browser next produces a frame, which is exactly the
 * kind of thing that differs between one CI runner and another.
 *
 * This is issue #65, and what disguised it for two sessions is worth keeping:
 * the scenes these readings are taken on set `steepness`, `drift`, `eddies` and
 * `stokes` to 0, so nothing moves, the clock stays at 0 and the loop parks. A
 * stale frame is then **byte-identical every run** — the failure came back with
 * the same numbers on two different commits, which is what a race is not
 * supposed to do, so a race was ruled out. The determinism is the static scene,
 * not the render path.
 *
 * One frame is enough, and not by luck: `wake()` registers its callback before
 * this one, and callbacks run in registration order within a frame.
 */
async function painted(page: Parameters<typeof openExperiment>[0]): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
}

/**
 * How many canvas pixels are brighter than the water.
 *
 * The frame wait stays here rather than moving into `countLit`: `light` is
 * summed while drawing, so a reading taken straight after a `set()` is the
 * previous frame's. That is a fact about flotsam, not about canvases.
 */
async function litPixels(page: Parameters<typeof openExperiment>[0]): Promise<number> {
  await painted(page)
  return countLit(page, LIT_THRESHOLD)
}

/**
 * What the lit pixels of the canvas look like, as numbers.
 *
 * A pixel readback, not a comparison against a baseline image: reading the
 * *shape* of a distribution is a number, `tests/AGENTS.md` rules out the other
 * thing, and there is no other way to ask whether a piece has an edge.
 *
 * Everything here is a percentile rather than a maximum, and that is not
 * fussiness. Pieces overlap, overlaps add — the drawing is additive — and a few
 * per cent of doubled-up pixels set a maximum that says nothing about what one
 * piece looks like. The first version of these tests measured exactly that and
 * read a solid disc as a ball of fog.
 */
async function pixels(
  page: Parameters<typeof openExperiment>[0],
): Promise<{ lit: number; body: number; nearBody: number; chroma: number; warmth: number }> {
  await painted(page)
  return page.evaluate((cut) => {
    const canvas = document.querySelector("canvas")
    if (!canvas) throw new Error("no canvas on the page")
    const context = canvas.getContext("2d")
    if (!context) throw new Error("no 2d context")
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)

    // 256 bins of mean channel value. Percentiles come off the histogram, so
    // nothing has to be sorted.
    const bins = new Int32Array(256)
    let lit = 0
    for (let i = 0; i < data.length; i += 4) {
      const sum = data[i]! + data[i + 1]! + data[i + 2]!
      if (sum <= cut) continue
      lit++
      bins[Math.min(255, Math.round(sum / 3))]!++
    }
    if (lit === 0) return { lit: 0, body: 0, nearBody: 0, chroma: 0, warmth: 0 }

    // The 95th centile stands for one piece's own brightness: most of a solid
    // disc sits at it, and it is above the rim and below the overlaps.
    let seen = 0
    let body = 0
    for (let b = 0; b < 256; b++) {
      seen += bins[b]!
      if (seen >= lit * 0.95) {
        body = b * 3
        break
      }
    }

    let nearBody = 0
    const chromas: number[] = []
    const warmths: number[] = []
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!
      const g = data[i + 1]!
      const b = data[i + 2]!
      const sum = r + g + b
      if (sum <= cut) continue
      if (Math.abs(sum - body) <= body * 0.15) nearBody++
      if (sum >= body * 0.6) {
        const high = Math.max(r, g, b)
        chromas.push(high === 0 ? 0 : (high - Math.min(r, g, b)) / high)
        warmths.push(r - b)
      }
    }

    const middle = (list: number[]) => {
      if (list.length === 0) return 0
      list.sort((x, y) => x - y)
      return list[Math.floor(list.length / 2)]!
    }

    return {
      lit,
      body,
      nearBody: nearBody / lit,
      chroma: middle(chromas),
      warmth: middle(warmths),
    }
  }, LIT_THRESHOLD)
}

/**
 * Big enough to see the shape of, sparse enough that most pieces stand alone,
 * and still water so nothing moves between two readings.
 */
const BIG_PIECES = {
  dots: 60,
  smallest: 0.05,
  largest: 0.05,
  span: 4,
  steepness: 0,
  drift: 0,
  eddies: 0,
  stokes: 0,
  glint: 0,
  shade: 0,
  variance: 0,
  hueSpread: 0,
  hue: 38,
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
 * **Wiring, not the physics.** That a sea with no current transports nothing, that
 * a slow current does, that a steep sea gathers and eddies do not, and that wave
 * drift moves the flotsam over a minute and not over a frame, and that a raft
 * ignores the chop a speck is tracing, are all
 * `water.test.ts`, against the water with no page around it (#287). What is
 * left for a page is that the engine steps the water it draws and reports what
 * that water measured — so one scene with a current, stepped through `run()`.
 *
 * `run()` rather than a frame wait, and it is not interchangeable here.
 * `transport` is the only stat written by stepping rather than by drawing — see
 * the table in flotsam/AGENTS.md — and the `dirty` path of `tick()` draws
 * without stepping, so a frame wait leaves it as stale as it was (#65, #107).
 *
 * **Under reduced motion, or this cannot see `run()` at all.** A scene with a
 * current is animated, so the loop steps the water in real time between any
 * two reads, and with `run()` emptied this passed anyway — seen 2026-10-16.
 * Reduced motion parks the clock, so the only thing that can step the water
 * here is the call under test.
 */
test("the page steps the water it draws, and reports what the water measured", async ({ page }) => {
  const experiment = await openFlotsam(page, {
    settings: { ...MODEST, steepness: 0.9, drift: 0.2, bearing: 0, eddies: 0, stokes: 0 },
    idle: true,
    reducedMotion: true,
  })

  const before = await experiment.api(({ api }) => api.stats())
  await experiment.api(({ api }) => api.run(1))
  const after = await experiment.api(({ api }) => api.stats())

  expect(after.clock - before.clock).toBeCloseTo(1, 5)
  expect(after.transport).toBeCloseTo(0.2, 3)
  // Measured by the frame `run()` drew, not left over from the first one.
  expect(after.orbit).toBeGreaterThan(0.1)
  expect(after.dispersion).toBeGreaterThan(0)
  expect(after.minJacobian).not.toBe(before.minJacobian)
})

/**
 * Exposure exists because every other way of dimming a scene also changes what
 * is floating on it — the count empties the water, the size range narrows it,
 * the size mix flattens it. This is the one control that moves the light and
 * nothing else, and `light` in the stats is what makes "too bright" a number
 * rather than a view of one monitor in one room.
 */
test("exposure changes how much light the scene makes and nothing else about it", async ({ page }) => {
  // Still water, so the only difference between the two readings is the one
  // under test rather than a second of sea having gone by between them.
  const experiment = await openFlotsam(page, {
    settings: { ...MODEST, exposure: 1, steepness: 0, drift: 0, eddies: 0, stokes: 0 },
    idle: true,
  })

  await painted(page)
  const full = await experiment.api(({ api }) => api.stats())
  expect(full.light).toBeGreaterThan(0)

  await experiment.api(({ api }) => api.set({ exposure: 0.4 }))
  await painted(page)
  const dim = await experiment.api(({ api }) => api.stats())

  expect(dim.light).toBeLessThan(full.light * 0.6)
  // The same water: the same pieces, in the same places, gathered the same way.
  expect(dim.dots).toBe(full.dots)
  expect(dim.dispersion).toBeCloseTo(full.dispersion, 5)
  // Exactly, now that a piece's glare no longer blooms with its brightness. It
  // used to, and the cull bound follows the glare, so a handful of pieces just
  // off the edge stopped reaching into frame when the exposure came down — a
  // per cent of drift that had to be allowed for here.
  expect(dim.drawnDots).toBe(full.drawnDots)

  await experiment.api(({ api }) => api.set({ exposure: 0 }))
  await painted(page)
  expect((await experiment.api(({ api }) => api.stats())).light).toBe(0)
  expect(await litPixels(page)).toBe(0)
})

/**
 * The other half of the same problem: keeping the size range wide while making
 * its large end rarer. Narrowing the range instead is what a reader reaches for
 * and it costs them the size variation they wanted in the first place.
 */
test("the size mix thins the large pieces without emptying the water or narrowing it", async ({ page }) => {
  const settings = { dots: 4000, smallest: 0.004, largest: 0.4, span: 8, steepness: 0, drift: 0, eddies: 0, stokes: 0 }
  const experiment = await openFlotsam(page, { settings: { ...settings, sizeMix: 0.9 }, idle: true })

  // `light` is summed while drawing, so both readings wait a frame — the rule
  // in `tests/AGENTS.md`, and the same one the exposure test above follows. This
  // test was written without it and passed for weeks on luck: the scene is
  // deliberately still, so a stale frame comes back byte-identical rather than
  // obviously old. It failed in CI on a documentation-only PR, reading
  // `fine.light` of 6.455 against a `coarse.light` of exactly 6.455.
  await painted(page)
  const coarse = await experiment.api(({ api }) => api.stats())
  await experiment.api(({ api }) => api.set({ sizeMix: 0.2 }))
  await painted(page)
  const fine = await experiment.api(({ api }) => api.stats())

  expect(fine.light).toBeLessThan(coarse.light / 2)
  // Not by emptying it. Every piece is still there and still drawn.
  expect(fine.dots).toBe(coarse.dots)
  expect(fine.drawnDots).toBeGreaterThan(coarse.drawnDots * 0.95)
  // And still lit: thinning the large end must not put the whole population
  // under the sub-pixel floor and switch the scene off.
  expect(await litPixels(page)).toBeGreaterThan(0)
})

/**
 * Three faults in one, all of them invisible until the size range was opened up
 * far enough to see a piece rather than a point, and all reported by someone
 * looking at the thing.
 *
 * A piece was drawn from a sprite built for a glint: a soft ball whose
 * brightness halved by half its radius, painted at 96% lightness and a quarter
 * saturation so it came out flat white however the hue was set, with a glare
 * whose bright heart sat in the *middle* of the piece rather than around it. At
 * a pixel across none of that is noticeable. At a hundred, a large piece was a
 * fuzzy white ball with a bright pinprick in it, and the colour controls did
 * nothing to it at all.
 */
test("a large piece is a body with an edge, not a ball of fog", async ({ page }) => {
  const experiment = await openFlotsam(page, { settings: { ...BIG_PIECES, gleam: 0 }, idle: true })

  const seen = await pixels(page)
  expect(seen.lit).toBeGreaterThan(0)

  // Most of a piece sits at very nearly one brightness, with the fall to nothing
  // happening in a thin rim. The soft ball this replaced was half strength by
  // half its radius, so barely a third of it was ever near its own level.
  expect(seen.nearBody).toBeGreaterThan(0.55)

  await experiment.shot("large-pieces")
})

test("a large piece shows the hue it was given", async ({ page }) => {
  const experiment = await openFlotsam(page, { settings: { ...BIG_PIECES, gleam: 0, hue: 38 }, idle: true })

  // Flat white is a chroma of 0. A body painted at 96% lightness, as this was,
  // has nowhere to put a colour and measured near nothing whatever the hue.
  const warm = await pixels(page)
  expect(warm.chroma).toBeGreaterThan(0.2)
  // And it is *this* hue: red over blue at 38, blue over red at 220.
  expect(warm.warmth).toBeGreaterThan(20)

  await experiment.api(({ api }) => api.set({ hue: 220 }))
  const cold = await pixels(page)
  expect(cold.chroma).toBeGreaterThan(0.2)
  expect(cold.warmth).toBeLessThan(-20)
})

test("raising the gleam makes a large piece bigger, not brighter", async ({ page }) => {
  const experiment = await openFlotsam(page, { settings: { ...BIG_PIECES, gleam: 0 }, idle: true })

  const bare = await pixels(page)
  await experiment.api(({ api }) => api.set({ gleam: 24 }))
  const glared = await pixels(page)

  // Both halves matter, and the sprite centred on the piece rather than started
  // at its edge fails both. Measured on this scene, with the glare raised from
  // nothing to twenty-four pixels:
  //
  //                     lit pixels      a piece's own level
  //   centred (wrong)   +7%             624 → 712
  //   at the rim        +157%           624 → 632
  //
  // Which is the fault in one line: the glare was landing *on* the pieces
  // instead of around them, so it barely lit any more of the canvas and made
  // every large piece brighter in the middle — a pinprick inside a ball of fog,
  // exactly as it was reported.
  expect(glared.lit).toBeGreaterThan(bare.lit * 1.4)
  expect(glared.body).toBeLessThan(bare.body * 1.1)
})

/**
 * Softness exists because a scene could not be smooth at large sizes.
 *
 * A body is drawn at its real size with an edge, and a speck is drawn as a point
 * of light in a glow — so a wide size range put two different-looking families
 * in one picture, hard discs among fuzz, and the only way to keep a scene smooth
 * was to keep every piece small. This is the control that makes the range read
 * as one family.
 */
test("softness takes a piece from an object with an edge to a soft blob", async ({ page }) => {
  const experiment = await openFlotsam(page, { settings: { ...BIG_PIECES, gleam: 8, softness: 0 }, idle: true })

  const crisp = await pixels(page)
  // Most of a crisp piece sits at one level, which is what an edge means.
  //
  // **0.52, not 0.55, because 0.55 was the reading rather than a bound.** A
  // crisp scene measures 0.5501–0.5506 across ten loads (the lit count moves by
  // a few dozen pixels between them), and CI read 0.54992 once and failed. The
  // bound belongs between what crisp reads and what a hint of softness reads:
  // softness 0.1 is 0.476, 0.2 is 0.407, 1 is 0.122. So 0.52 clears the noise
  // by 0.03 and still fails a piece that has lost even a tenth of its edge.
  expect(crisp.nearBody).toBeGreaterThan(0.52)

  await experiment.api(({ api }) => api.set({ softness: 1 }))
  const soft = await pixels(page)

  // A soft piece has no plateau to sit on: its brightness falls the whole way
  // from the middle, so almost nothing is near any one level.
  expect(soft.nearBody).toBeLessThan(crisp.nearBody / 2)
  // Softened rather than removed. Fewer pixels are lit than were, and that is
  // what soft means: the outer part of a blob falls below anything you would
  // call lit, where a crisp piece is at full strength right up to its rim.
  expect(soft.lit).toBeGreaterThan(0)
  expect(soft.lit).toBeLessThan(crisp.lit)
})

/**
 * Watching slowly, which is not the same as a slow sea.
 *
 * `waves.ts` refuses to have a wave-speed setting, because a wave's speed is
 * fixed by its length and a knob that overrode it would flatten the piece's
 * whole dynamic range into one look. This is a different thing and the
 * difference is the assertion below: it scales the *clock*, so everything moves
 * slower together and every relationship between the waves, the current and the
 * wind is untouched.
 */
/**
 * **Wiring: pause stops the clock and parks the loop.** Playback 0 did this
 * until the kit's speed control replaced it (#312) — a speed has no 0 now, and
 * holding the sea is pause's. That speed scales the step, and is applied in one
 * place, is `clock.test.ts`.
 */
test("pause stops the sea and parks the loop", async ({ page }) => {
  const experiment = await openFlotsam(page, { settings: { ...MODEST, timescale: 1 }, idle: true })
  await expect.poll(async () => (await experiment.api(({ api }) => api.stats())).clock).toBeGreaterThan(0)

  await experiment.api(({ api }) => api.pause(true))
  await expect.poll(async () => (await experiment.api(({ api }) => api.stats())).running, { timeout: 5000 }).toBe(false)
  const parked = (await experiment.api(({ api }) => api.stats())).clock
  await page.waitForTimeout(200)
  expect((await experiment.api(({ api }) => api.stats())).clock).toBe(parked)
})

test("run() is seconds of sea, not seconds of watching", async ({ page }) => {
  // A poster recipe asking for forty seconds wants forty seconds of water
  // whatever rate someone happens to be viewing at. Five rather than thirty: at
  // half speed, a tenth of real time, a run that obeyed the speed would come out at 0.5.
  const experiment = await openFlotsam(page, { settings: { ...MODEST, timescale: 0.5 }, idle: true })

  const before = await experiment.api(({ api }) => api.stats())
  await experiment.api(({ api }) => api.run(5))
  const after = await experiment.api(({ api }) => api.stats())

  expect(after.clock - before.clock).toBeCloseTo(5, 0)
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
  // `dispersion` is measured while drawing, and this test's whole claim is that
  // it has *not* moved — which is exactly what reading the previous frame would
  // guarantee. Without the wait the assertion cannot tell a gathering that
  // stayed put from the same frame measured twice, which is #109's fault in a
  // different piece. Waited, it still passes: 0.9518 against 0.9740, well inside
  // the bound.
  await painted(page)
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

/**
 * **Wiring: the canvas tells the specks how dense its pixels are.** The floor
 * itself (halving on a 2× screen, keeping `a·r²`, leaving the glare alone) is
 * `specks.test.ts`. This used to run `simmer` for 60 s in each context and
 * compare the light as well. Seen red 2026-10-16 with `setScale` never called.
 */
test("a denser screen resolves more cores", async ({ browser }) => {
  const read = async (deviceScaleFactor: number) => {
    const context = await browser.newContext({ viewport: { width: 900, height: 700 }, deviceScaleFactor })
    try {
      const page = await context.newPage()
      await page.goto("/experiments/flotsam/")
      await page.waitForFunction(() => Boolean(window.experiment), undefined, { timeout: 15_000 })
      // Awaited before the `finally` closes the context out from under it.
      return await page.evaluate(() => {
        const api = window.experiment as ExperimentApi
        api.preset("simmer")
        api.run(0.1)
        const reading = api.stats()
        return { dimmed: reading.dimmedDots, dots: reading.dots }
      })
    } finally {
      await context.close()
    }
  }

  const plain = await read(1)
  const dense = await read(2)

  expect(plain.dots, "the two runs are not looking at the same scene").toBe(dense.dots)
  expect(dense.dimmed, "a 2× screen resolved no more cores than a 1× one").toBeLessThan(plain.dimmed)
})
