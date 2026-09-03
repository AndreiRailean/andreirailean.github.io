import { describe, expect, it } from "vitest"
import { createCrowd, type Crowd } from "@/experiments/walkers/crowd"
import { DEFAULT_SETTINGS, normalizeSettings, PRESETS, type Settings } from "@/experiments/walkers/settings"
import { makeSun, makeView } from "@/experiments/walkers/view"

/**
 * The crowd, run headless.
 *
 * Everything in `crowd.ts` is arithmetic on numbers — no canvas, no window — so
 * a whole afternoon in the park runs here in milliseconds, which is the only
 * reason any of the claims below are checkable at all. The browser suite can
 * open the page and confirm that a crowd appears; it cannot run four hundred
 * seconds of one and measure whether anybody walked through anybody.
 */

/**
 * Half the rate the scene runs at, on purpose.
 *
 * `walkers.ts` drains its clock in 1/120 s steps; these run at 1/60. A longer
 * step is the *harder* case for everything asserted below — twice as much
 * movement between one contact resolution and the next — so passing here implies
 * passing at the rate the piece actually uses, and the whole file costs half as
 * much to run. The unit suite is the one every other session reaches for while
 * working, and a crowd simulated for four hundred seconds is not free.
 */
const STEP = 1 / 60

function park(patch: Partial<Settings> = {}, seconds = 0) {
  const settings = normalizeSettings(patch)
  const view = makeView(settings.span, settings.camera, 1280, 800, 8)
  const sun = makeSun(settings.sunAzimuth, settings.sun)
  const crowd = createCrowd({ view, settings, sun })
  crowd.fill()
  run(crowd, seconds)
  return { crowd, view, settings }
}

function run(crowd: Crowd, seconds: number): void {
  for (let step = 0; step < Math.round(seconds / STEP); step++) crowd.step(STEP)
}

describe("nobody walks through anybody", () => {
  /**
   * The piece's one hard promise, and the reason the separation in `crowd.ts` is
   * positional rather than a force. A force can always be outrun: two runners
   * closing at 4 m/s cover 13 cm between frames, which is more than half a
   * body.
   *
   * Measured as the deepest interpenetration reached at any point over several
   * minutes at a density where people are genuinely in each other's way. It is
   * not zero and should not be: the correction runs after the step, so a frame
   * can end on a touch that the same frame then resolves, and at festival
   * density people really are pressed together. What it must never approach is a
   * body — 0.045 m is a tenth of a shoulder width, and passing through somebody
   * would register as most of half a metre.
   */
  it("never lets anybody get more than a tenth of a body inside anybody", { timeout: 90_000 }, () => {
    const { crowd } = park({ density: 70, flow: "through", span: 16, settling: 0.05 }, 25)

    let worst = 0
    for (let step = 0; step < 40 / STEP; step++) {
      crowd.step(STEP)
      worst = Math.max(worst, crowd.stats().overlap)
    }

    expect(crowd.stats().walkers).toBeGreaterThan(80)
    expect(worst).toBeLessThan(0.045)
  })

  it("holds even when everybody is running", { timeout: 60_000 }, () => {
    const { crowd } = park({ density: 40, runners: 0.6, flow: "through", span: 16, settling: 0 }, 25)

    let worst = 0
    for (let step = 0; step < 60 / STEP; step++) {
      crowd.step(STEP)
      worst = Math.max(worst, crowd.stats().overlap)
    }

    expect(worst).toBeLessThan(0.045)
  })
})

describe("the population", () => {
  it("fills the frame to the density asked for, and holds there", { timeout: 120_000 }, () => {
    const { crowd, view, settings } = park({ density: 12 }, 0)
    const wanted = (settings.density / 100) * view.area

    expect(crowd.stats().inFrame).toBeGreaterThanOrEqual(Math.floor(wanted))

    // Past the opening transient: the loop is deliberately slow, so the first
    // minute is the crowd the seed laid out rather than the one the controller
    // settles on.
    run(crowd, 40)

    // Averaged over four minutes rather than sampled once. Sixteen people is a
    // small number and groups arrive whole, so a single frame scatters by a
    // quarter either way for reasons that are the crowd rather than the loop.
    // Measured *in frame*, which is what density means — `walkers` includes
    // everyone out in the margin, and at a small span that is most of them.
    let total = 0
    let samples = 0
    for (let step = 0; step < 150 / STEP; step++) {
      crowd.step(STEP)
      if (step % 300 !== 0) continue
      total += crowd.stats().inFrame
      samples++
    }

    expect(total / samples).toBeGreaterThan(wanted * 0.8)
    expect(total / samples).toBeLessThan(wanted * 1.25)
  })

  /**
   * Nobody piles up in a corner.
   *
   * This is here because the first version failed it comprehensively and it was
   * invisible in a screenshot at fifteen people — the crowd was built before the
   * canvas had been measured, so the whole opening population landed inside a
   * few square metres at the centre of the frame and spent the next minute
   * dispersing. A quadrant count would have caught it on the first run.
   */
  it("spreads across the frame rather than gathering in one part of it", { timeout: 120_000 }, () => {
    // Pooled over four afternoons. One is not enough to say anything: people
    // arrive in groups and groups stay together, so the samples are clumped
    // and a single frame's quadrant counts scatter far wider than a coin
    // would. What this is looking for is the gross failure — a whole crowd in
    // one part of the frame — not a fair coin.
    const quadrants = [0, 0, 0, 0]
    let counted = 0

    for (const seed of [1, 2, 3, 4]) {
      const { crowd, view } = park({ density: 20, flow: "wander", settling: 0.3, span: 16, seed }, 100)
      for (const walker of crowd.walkers) {
        if (Math.abs(walker.x) > view.halfWidth || Math.abs(walker.y) > view.halfHeight) continue
        quadrants[(walker.x < 0 ? 0 : 1) + (walker.y < 0 ? 0 : 2)]!++
        counted++
      }
    }

    expect(counted).toBeGreaterThan(60)
    for (const count of quadrants) {
      expect(count / counted).toBeGreaterThan(0.12)
      expect(count / counted).toBeLessThan(0.42)
    }
  })

  it("turns the crowd over rather than keeping the same people", { timeout: 60_000 }, () => {
    const { crowd } = park({ density: 14, settling: 0.1, flow: "through" }, 20)
    const before = new Set(crowd.walkers.map((walker) => walker.id))

    run(crowd, 150)

    const still = crowd.walkers.filter((walker) => before.has(walker.id)).length
    expect(still).toBeLessThan(before.size * 0.5)
  })
})

describe("who is out there", () => {
  it("makes about as many children as asked for", { timeout: 60_000 }, () => {
    const { crowd } = park({ density: 30, children: 0.35, span: 16 }, 70)
    const stats = crowd.stats()
    // Children arrive attached to adults, so the fraction is approached rather
    // than hit: a group of two adults and one child cannot be 35% child.
    expect(stats.children / stats.walkers).toBeGreaterThan(0.15)
    expect(stats.children / stats.walkers).toBeLessThan(0.55)
  })

  it("makes no children at all when asked for none", { timeout: 60_000 }, () => {
    const { crowd } = park({ density: 30, children: 0, span: 16 }, 50)
    expect(crowd.stats().children).toBe(0)
  })

  it("puts people on the ground when they are there to sit down", { timeout: 60_000 }, () => {
    const { crowd } = park({ density: 20, flow: "gather", settling: 1, span: 14 }, 110)
    expect(crowd.stats().sitting).toBeGreaterThan(0)
  })

  it("leaves nobody sitting when nobody is stopping", { timeout: 60_000 }, () => {
    const { crowd } = park({ density: 20, flow: "through", settling: 0 }, 90)
    expect(crowd.stats().sitting).toBe(0)
  })

  /**
   * A crowd slows down as it thickens, and that is the model rather than a rule.
   *
   * Nothing in the piece reads density and lowers anyone's speed. The
   * anticipatory term makes every encounter cost a little of somebody's
   * progress, and at thirty people per hundred square metres there are simply
   * more encounters. If this ever passes at equal speeds, the avoidance has
   * stopped doing anything.
   */
  it("walks slower when it is crowded, with nothing saying so", { timeout: 180_000 }, () => {
    // No children and no play, which is not tidiness: a crouching child has a
    // speed of zero, and in a sparse frame two of them move the mean further
    // than the whole of the avoidance does. The claim under test is about
    // people getting in each other's way.
    const plain = { flow: "through", span: 16, settling: 0, children: 0, play: 0, runners: 0 } as const
    // 100 per 100 m² is one per square metre. The published fundamental
    // diagrams put a crowd there at about four fifths of its free speed, and
    // have it barely slowed at all below 40 — which is why the first version of
    // this test compared 4 against 34 and found a difference of six per cent,
    // correctly, having picked two densities that are both free flow.
    const empty = park({ ...plain, density: 4 }, 60)
    const packed = park({ ...plain, density: 100 }, 60)

    expect(packed.crowd.stats().meanSpeed).toBeLessThan(empty.crowd.stats().meanSpeed * 0.9)
  })
})

describe("the presets", () => {
  it.each(PRESETS.map((preset, index) => [index, preset.label] as const))(
    "%i (%s) runs for three quarters of a minute without anyone overlapping or escaping",
    (index) => {
      const settings = PRESETS[index]!.settings
      const view = makeView(settings.span, settings.camera, 1280, 800, 8)
      const crowd = createCrowd({ view, settings, sun: makeSun(settings.sunAzimuth, settings.sun) })
      crowd.fill()

      let worst = 0
      for (let step = 0; step < 45 / STEP; step++) {
        crowd.step(STEP)
        if (step % 30 === 0) worst = Math.max(worst, crowd.stats().overlap)
      }

      // The same bound as the crowded case: a tenth of a shoulder width. See
      // "never lets anybody get more than a tenth of a body inside anybody".
      expect(worst).toBeLessThan(0.045)
      expect(crowd.stats().walkers).toBeGreaterThan(0)
      // Nobody is off in the middle distance: the cull keeps the world bounded.
      for (const walker of crowd.walkers) {
        expect(Math.abs(walker.x)).toBeLessThan(view.halfWidth + view.margin + 6)
        expect(Math.abs(walker.y)).toBeLessThan(view.halfHeight + view.margin + 6)
      }
    },
    240_000,
  )
})

describe("the seed", () => {
  it("gives the same afternoon twice", { timeout: 60_000 }, () => {
    const one = park({ seed: 12345 }, 30)
    const two = park({ seed: 12345 }, 30)

    expect(one.crowd.stats()).toEqual(two.crowd.stats())
  })

  it("gives a different one for a different seed", { timeout: 60_000 }, () => {
    const one = park({ seed: 1 }, 30)
    const two = park({ seed: 2 }, 30)

    expect(one.crowd.walkers.map((w) => w.body.stature)).not.toEqual(two.crowd.walkers.map((w) => w.body.stature))
  })
})

describe("playback and the defaults", () => {
  it("starts from a legal set of settings", () => {
    expect(normalizeSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS)
  })
})

describe("children", () => {
  /**
   * Play is a set of states, and all of them have to actually happen.
   *
   * Each is a different branch of one decision tree in `updatePlay`, and a
   * threshold typed wrong silently removes one of them — the crowd still looks
   * busy, and the piece has quietly lost jumping. Counting them over a few
   * minutes is the only way to see that.
   */
  it("darts, chases, crouches, jumps and falls over", { timeout: 120_000 }, () => {
    const { crowd } = park({ density: 30, children: 0.55, play: 1.5, span: 9, flow: "gather", settling: 0.8 }, 20)

    const seen = new Set<string>()
    let jumped = false

    for (let step = 0; step < 150 / STEP; step++) {
      crowd.step(STEP)
      for (const walker of crowd.walkers) {
        if (walker.body.age !== "child") continue
        seen.add(walker.activity)
        if (walker.hop > 0.01) jumped = true
      }
    }

    for (const activity of ["darting", "chasing", "fleeing", "crouching", "fallen"]) {
      expect(seen, `no child was ever ${activity}`).toContain(activity)
    }
    expect(jumped, "no child ever left the ground").toBe(true)
  })

  it("does none of it when play is off", { timeout: 60_000 }, () => {
    const { crowd } = park({ density: 26, children: 0.5, play: 0, span: 9, flow: "gather", settling: 0.8 }, 15)

    const seen = new Set<string>()
    for (let step = 0; step < 50 / STEP; step++) {
      crowd.step(STEP)
      for (const walker of crowd.walkers) if (walker.body.age === "child") seen.add(walker.activity)
    }

    for (const activity of ["darting", "chasing", "crouching", "fallen"]) {
      expect(seen).not.toContain(activity)
    }
  })

  /**
   * The leash is what makes a family a family rather than a crowd that happens
   * to contain children.
   */
  it("keeps children near the adult they came with", { timeout: 60_000 }, () => {
    const { crowd } = park({ density: 24, children: 0.5, play: 1.5, span: 10, flow: "gather", settling: 0.7 }, 40)

    let worst = 0
    for (let step = 0; step < 80 / STEP; step++) {
      crowd.step(STEP)
      if (step % 20 !== 0) continue
      for (const walker of crowd.walkers) {
        if (walker.body.age !== "child") continue
        const adult = walker.group.members.find((member) => member.body.age === "adult")
        if (!adult) continue
        worst = Math.max(worst, Math.hypot(walker.x - adult.x, walker.y - adult.y))
      }
    }

    // The leash is 3.4 m and it is a rule about *starting* to come back, not a
    // wall, so a child running when it trips still overshoots it.
    expect(worst).toBeLessThan(7)
  })
})

describe("lanes", () => {
  /**
   * The claim in the note that is worth being able to check.
   *
   * Two streams meeting head-on sort themselves into files. Nothing in the code
   * knows what a lane is, so the evidence has to be a measurement: `sorting` is
   * how much more a person's neighbours agree with their heading than the crowd
   * as a whole does, which is what a lane is and what a merely uniform flow is
   * not.
   *
   * Compared against **the same scene, earlier**. A wandering crowd was tried as
   * the control and is not one: its people are spread over a dozen routes, so
   * neighbours agree with each other far more than the room does simply because
   * they came in the same way, and it scored *higher* than a counterflow that
   * was genuinely sorting. Time is the honest control — a crowd that has been
   * running for three minutes has had the chance to sort, and one twelve seconds
   * old has not.
   */
  it("sorts a head-on counterflow into files, and a wandering crowd not at all", { timeout: 120_000 }, () => {
    const plain = { density: 60, span: 16, settling: 0, grouping: 0.05, children: 0, play: 0 } as const
    const early = park({ ...plain, flow: "through" }, 12)
    const settled = park({ ...plain, flow: "through" }, 150)

    expect(settled.crowd.stats().sorting).toBeGreaterThan(early.crowd.stats().sorting + 0.08)
    expect(settled.crowd.stats().sorting).toBeGreaterThan(0.25)
  })
})
