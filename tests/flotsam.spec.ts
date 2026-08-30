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

/** How many canvas pixels are brighter than the water. */
async function litPixels(page: Parameters<typeof openExperiment>[0]): Promise<number> {
  await painted(page)
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

  const full = await experiment.api(({ api }) => api.stats())
  expect(full.light).toBeGreaterThan(0)

  await experiment.api(({ api }) => api.set({ exposure: 0.4 }))
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

  const coarse = await experiment.api(({ api }) => api.stats())
  await experiment.api(({ api }) => api.set({ sizeMix: 0.2 }))
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
  expect(crisp.nearBody).toBeGreaterThan(0.55)

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
test("playback slows everything by the same factor, and pauses at nothing", async ({ page }) => {
  const experiment = await openFlotsam(page, { settings: { ...MODEST, playback: 1 }, idle: true })

  const advanced = async (over: number) => {
    const before = await experiment.api(({ api }) => api.stats())
    await page.waitForTimeout(over)
    const after = await experiment.api(({ api }) => api.stats())
    return after.clock - before.clock
  }

  const full = await advanced(600)
  expect(full).toBeGreaterThan(0.3)

  await experiment.api(({ api }) => api.set({ playback: 0.25 }))
  const quarter = await advanced(600)
  // A quarter of the sea in the same wall-clock time. Loose bounds: this is a
  // real browser and a real six hundred milliseconds.
  expect(quarter).toBeGreaterThan(full * 0.12)
  expect(quarter).toBeLessThan(full * 0.45)

  // Nothing at all, and the loop parks rather than redrawing a still frame for
  // ever — which is the same path reduced motion takes.
  await experiment.api(({ api }) => api.set({ playback: 0 }))
  expect(await advanced(400)).toBe(0)
  await expect.poll(async () => (await experiment.api(({ api }) => api.stats())).running, { timeout: 5000 }).toBe(false)
})

test("run() is seconds of sea, not seconds of watching", async ({ page }) => {
  // A poster recipe asking for forty seconds wants forty seconds of water
  // whatever rate someone happens to be viewing at.
  const experiment = await openFlotsam(page, { settings: { ...MODEST, playback: 0.1 }, idle: true })

  const before = await experiment.api(({ api }) => api.stats())
  await experiment.api(({ api }) => api.run(30))
  const after = await experiment.api(({ api }) => api.stats())

  expect(after.clock - before.clock).toBeCloseTo(30, 0)
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
