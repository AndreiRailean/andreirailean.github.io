import type { ExperimentApi } from "@/experiments/psyxels/api"
import { DEFAULT_SETTINGS, PRESETS, settingsToQuery } from "@/experiments/psyxels/settings"
import { expect, openExperiment, test } from "./support/experiment"

/**
 * Psyxels, driven through its console API.
 *
 * The piece's whole claim is a separation nothing on screen can show: the
 * packing decides where the psyxels are, the life decides what they do, and the
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

/** The ground is `#05050a`, whose channels sum to 19. Anything well above it is a psyx. */
const LIT_THRESHOLD = 90

/**
 * Intersection over union between the packed field and the subject it was read
 * from. A square is a square and a letter is not, so 1 is unreachable; below
 * about 0.6 the subject is being described rather than drawn. The landing scene
 * sits near 0.88 rather than higher on purpose: `fuzz` spends some of it on a
 * boundary that is a scatter rather than a line.
 */
const RECOGNISABLE = 0.8

function openPsyxels(page: Parameters<typeof openExperiment>[0], options?: Parameters<typeof openExperiment>[2]) {
  return openExperiment<ExperimentApi>(page, "psyxels", options)
}

/** How many canvas psyxels are brighter than the ground, and where their weight sits. */
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
  // An A is symmetric, so light either side of the middle within a quarter —
  // a cheap way of asking whether the subject is being read at all. Loose,
  // because the balance is *noisy* by construction: a handful of coarse psyxels
  // carry a large share of the lit area, and where they fall, how far they have
  // wandered and how far each has bloomed are all the seed's business.
  expect(Math.abs(left - right) / (left + right)).toBeLessThan(0.25)

  await experiment.shot("letter")
})

test("the packing covers the subject well enough to recognise it", async ({ page }) => {
  const experiment = await openPsyxels(page)
  const stats = await experiment.api(({ api }) => api.stats())
  expect(stats.match).toBeGreaterThan(RECOGNISABLE)
  expect(stats.psyxels).toBeGreaterThan(200)
})

test("psyxels come in a range of sizes, and the levels control is what decides it", async ({ page }) => {
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
 * Everything in the moving half is read live and none of it may move a psyx.
 * Without this the obvious implementation — rebuild on any change — passes every
 * other test here and is a different piece to use: every drag of the colour
 * slider reshuffles the field under your hand.
 */
test("winding the life controls anywhere leaves the packing exactly as it was", async ({ page }) => {
  const experiment = await openPsyxels(page)

  // Churn off first, and the counts compared as *deltas*: the landing scene
  // repacks about once a second, so a bare count taken twice differs by a
  // handful for reasons that have nothing to do with what is under test.
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
      morph: 1,
      ease: 4,
      weight: 0.3,
      inset: 0.4,
      wander: 0.6,
      bloom: 1,
      solid: 1,
      layers: 1,
      glow: 1,
      afterglow: 1,
      edge: 1,
      edgeHue: -180,
      playback: 2,
    })
    return api.stats()
  })

  expect(after.psyxels).toBe(before.psyxels)
  expect(after.byDepth).toEqual(before.byDepth)
  expect(after.changes).toBe(before.changes)
})

test("the packing controls do repack, and say so", async ({ page }) => {
  const experiment = await openPsyxels(page)
  const before = await experiment.api(({ api }) => {
    api.set({ churn: 0 })
    return api.stats()
  })
  const coarser = await experiment.api(({ api }) => {
    api.set({ coarse: 0.4 })
    return api.stats()
  })
  const finer = await experiment.api(({ api }) => {
    api.set({ coarse: 0.06 })
    return api.stats()
  })

  // Bigger squares, fewer of them, and the other way round — a packing control
  // is one that changes what exists rather than how it looks.
  expect(coarser.psyxels).toBeLessThan(before.psyxels)
  expect(finer.psyxels).toBeGreaterThan(coarser.psyxels * 1.5)
  expect(finer.largest).toBeLessThan(coarser.largest)
})

test("the threshold sculpts the subject rather than dimming it", async ({ page }) => {
  const experiment = await openPsyxels(page)

  // Churn off, or the field repacks between readings and the counts wander.
  await experiment.api(({ api }) => api.set({ churn: 0 }))
  const at = (threshold: number) =>
    experiment.api(({ api, arg }) => {
      api.set({ threshold: arg })
      return api.stats()
    }, threshold)

  const fat = await at(0.05)
  const middling = await at(0.45)
  const lean = await at(0.97)

  // Same packing at every setting: the threshold decides which packed psyxels
  // appear, never how many are packed. `live` rather than `drawn`, which is the
  // last frame's paint count and so still reports the settings before this one.
  expect(middling.psyxels).toBe(fat.psyxels)
  expect(lean.psyxels).toBe(fat.psyxels)

  // Wide open, nearly everything packed is let through — not quite all of it,
  // because quartering a square that straddles an edge leaves children with a
  // sliver of ink and no more. Winding it up takes the fringe away in order.
  expect(fat.live).toBeGreaterThan(fat.psyxels * 0.9)
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

test("fuzz softens the boundary rather than trimming the subject", async ({ page }) => {
  const experiment = await openPsyxels(page)

  const at = (fuzz: number) =>
    experiment.api(({ api, arg }) => {
      api.set({ fuzz: arg })
      return api.stats()
    }, fuzz)

  const hard = await at(0)
  const soft = await at(1)

  // Both halves of the control show here: squares that decline to subdivide
  // (fewer psyxels, some of them coarse and hanging over the edge), and psyxels
  // let through by their own luck rather than by the rule.
  expect(soft.psyxels).toBeLessThan(hard.psyxels)
  expect(soft.match).toBeLessThan(hard.match)
  // Still a letter, though: this is a soft edge, not a lost one.
  expect(soft.match).toBeGreaterThan(0.7)
})

test("the edge accent is colour and only colour", async ({ page }) => {
  const experiment = await openPsyxels(page)

  const plain = await experiment.api(({ api }) => {
    api.set({ edge: 0, churn: 0 })
    return api.stats()
  })
  const accented = await experiment.api(({ api }) => {
    api.set({ edge: 1, edgeHue: 180 })
    // The colour count is filled in while drawing, so a reading taken before the
    // next frame still describes the settings before this one — the same trap
    // `drawn` sets, and the reason `live` exists.
    api.run(0.2)
    return api.stats()
  })

  // Not one psyx moved, and none appeared or went.
  expect(accented.psyxels).toBe(plain.psyxels)
  expect(accented.byDepth).toEqual(plain.byDepth)
  expect(accented.live).toBe(plain.live)
  // But the scene needs more colours than it did, because the psyxels on the
  // contours are no longer drawn from the same span of the wheel as the rest.
  expect(accented.colours).toBeGreaterThan(plain.colours)
})

/**
 * The two answers to a large psyx sitting in a hole.
 *
 * A mark's ink is a fixed share of its own square, so the same drawing reads as
 * tone at seven screen pixels and as a thin sign surrounded by ground at a
 * hundred — and the eye reads that ground as part of the mark. Both controls put
 * ink where the hole was, and neither may move a psyx.
 */
test("bloom and overlap fill the ground around a large psyx without repacking", async ({ page }) => {
  const experiment = await openPsyxels(page, { idle: true })

  /**
   * `api.run()` before every reading, and that is not belt and braces.
   * `set()` marks the scene dirty and waits for an animation frame, so a canvas
   * read in the round trip after it gets the *previous* frame — the fault behind
   * issue #65 on another piece, which hid for weeks because a still scene's
   * stale frame is byte-identical. `run()` draws synchronously.
   */
  const paint = async (patch: Record<string, number>) => {
    await experiment.api(({ api, arg }) => {
      api.set(arg)
      api.run(2)
    }, patch)
    return { lit: (await light(page)).lit, stats: await experiment.api(({ api }) => api.stats()) }
  }

  // Glow off throughout: it spreads light of its own, which inflates every
  // reading here and shrinks the ratios this test is about.
  const bare = await paint({ bloom: 0, solid: 0, layers: 0, glow: 0, inset: 0.2, churn: 0 })
  const bloomed = await paint({ bloom: 1 })
  const overlapped = await paint({ bloom: 0, inset: -0.4 })
  const solid = await paint({ inset: 0.2, solid: 1 })
  const layered = await paint({ solid: 0, layers: 1 })

  // Read off the canvas rather than from `fill`, which is the marks' *bounding*
  // area and cannot see ink: the bloom does not change a mark's extent, only how
  // much of it is drawn on.
  expect(bloomed.lit).toBeGreaterThan(bare.lit * 1.15)
  expect(overlapped.lit).toBeGreaterThan(bare.lit * 1.15)
  // A tile with the sign cut out of it is the complete answer: the square is
  // filled and only the knockout is ground.
  expect(solid.lit).toBeGreaterThan(bare.lit * 1.8)
  // And layering puts the coarse marks back over the grain that replaced them,
  // so what shows through the gaps in a big one is finer psyxels.
  expect(layered.lit).toBeGreaterThan(bare.lit * 1.15)

  // And neither is a packing change: same psyxels, same sizes, in the same places.
  expect(bloomed.stats.psyxels).toBe(bare.stats.psyxels)
  expect(bloomed.stats.byDepth).toEqual(bare.stats.byDepth)
  expect(overlapped.stats.psyxels).toBe(bare.stats.psyxels)
  expect(overlapped.stats.byDepth).toEqual(bare.stats.byDepth)
  expect(solid.stats.psyxels).toBe(bare.stats.psyxels)
  expect(solid.stats.byDepth).toEqual(bare.stats.byDepth)
  expect(layered.stats.psyxels).toBe(bare.stats.psyxels)
  expect(layered.stats.byDepth).toEqual(bare.stats.byDepth)
})

/**
 * The glow is a post-process with a memory.
 *
 * Both halves are visible only on the canvas: `stats()` counts psyxels and the
 * glow adds no psyxels at all. The afterglow is the harder one — it is light
 * that is still there after the psyx that made it has moved — so it is measured
 * as *extra lit area on a moving field*, which is what a trail is.
 */
test("the glow spills light, and the afterglow leaves it behind", async ({ page }) => {
  const experiment = await openPsyxels(page, { idle: true })

  const paint = async (patch: Record<string, number>) => {
    await experiment.api(({ api, arg }) => {
      api.set(arg)
      // Long enough for the buffer to reach its resting value at any afterglow.
      api.run(6)
    }, patch)
    return { lit: (await light(page)).lit, stats: await experiment.api(({ api }) => api.stats()) }
  }

  const dark = await paint({ glow: 0, afterglow: 0, churn: 40 })
  const lit = await paint({ glow: 1, afterglow: 0 })
  const trailing = await paint({ glow: 1, afterglow: 0.95 })

  // Light where there was none: the blur puts some of every mark outside itself.
  expect(lit.lit).toBeGreaterThan(dark.lit * 1.2)
  // And a field that is repacking leaves more of it behind when the buffer is
  // faded slowly than when it is faded fast — the trail.
  expect(trailing.lit).toBeGreaterThan(lit.lit)

  // None of it is a psyx: the glow adds light, never population.
  expect(lit.stats.psyxels).toBeGreaterThan(0)
  expect(trailing.stats.byDepth.length).toBe(dark.stats.byDepth.length)
})

/**
 * **A memory of a picture that no longer exists is a stain, not an afterglow.**
 *
 * The buffer fades on the piece's clock, so loading a preset that is watched
 * slowly left the previous scene's light sitting over the new one for seconds —
 * bright, long, and belonging to nothing on screen. Reported by the piece's
 * author as "afterglow stays for a long time and is totally unrelated to the
 * active preset".
 */
test("a repacked field does not keep the light of the one before it", async ({ page }) => {
  const experiment = await openPsyxels(page, { idle: true })

  // A long trail on a still field, given time to reach its resting value.
  await experiment.api(({ api }) => {
    api.set({ glow: 1, afterglow: 0.95, churn: 0, flicker: 0, playback: 1 })
    api.run(6)
  })
  const before = (await light(page)).lit
  expect(before).toBeGreaterThan(1000)

  // A much smaller subject, and a single frame — far less than the trail's own
  // length, so anything still lit is light the old field left behind.
  await experiment.api(({ api }) => {
    api.set({ fill: 0.25 })
    api.run(0.05)
  })
  const after = (await light(page)).lit

  expect(after).toBeLessThan(before * 0.5)
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
    .poll(async () => (await experiment.api(({ api }) => api.stats())).psyxels, { timeout: 5000 })
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

  const scene = await experiment.api(({ api }) =>
    api.set({ hue: 33, levels: 2, subject: "&", face: "roman", spread: 140 }),
  )
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
    expect(stats.psyxels, preset.label).toBeGreaterThan(100)
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

test("the defaults are a baseline rather than a scene, and no preset leans on them", async () => {
  // Position one is only position one. Every preset states every setting, so
  // changing which is first moves nothing but which one a bare address lands on.
  for (const { label, settings } of PRESETS) {
    expect(Object.keys(settings).sort(), label).toEqual(Object.keys(DEFAULT_SETTINGS).sort())
  }
  expect(PRESETS[0]!.settings).not.toEqual(DEFAULT_SETTINGS)
})
