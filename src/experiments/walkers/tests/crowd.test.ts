import { describe, expect, it } from "vitest"
import type { Crowd } from "@/experiments/walkers/crowd"
import { DEFAULT_SETTINGS, normalizeSettings } from "@/experiments/walkers/settings"
import { park, STEP } from "./park"

/**
 * The crowd, run headless — for what only a crowd can show.
 *
 * **A decision is not tested here.** Who stops, who sits, how many are
 * children, when somebody gives way, which game a child plays and when the
 * leash pulls them back are each a function in `crowd.ts`, tested on its own in
 * `decisions.test.ts` with constructed inputs and no park (#287). They used to
 * be checked here by running a crowd for a minute or two and counting what came
 * out, which measured the decision through everything else the crowd does and
 * mostly measured the random number generator.
 *
 * What is left is of two kinds. **Properties of the whole crowd** — nobody
 * inside anybody, the population holding, the world staying bounded — which no
 * single function owns. And **wiring**: a second of park, enough to show that
 * each decision is actually consulted by the walk. Every one of those shows in
 * the first second, so none of them settles for long.
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

/** Step a crowd built by hand, for the cases that do not want a whole park. */
function run(crowd: Crowd, seconds: number): void {
  for (let step = 0; step < Math.round(seconds / STEP); step++) crowd.step(STEP)
}

/**
 * **The densest, fastest corner the settings allow, in a small world** — #238.
 *
 * These used to be long walks: thirty, forty-three and eighty-five simulated
 * seconds of an ordinary-sized park, and a per-preset run on top, on the theory
 * that a longer walk is more likely to meet the bad case. It is not, and one of
 * them proved it: with avoidance switched off entirely, the forty-three-second
 * crowded walk still passed. A long run of a general scene measures the general
 * scene. What finds a fault is a scene built so the fault shows at once.
 *
 * So: five metres of world, the most people and the fastest pace the settings
 * permit, heading straight at each other. About ninety people, so the pairwise
 * reading below is cheap, and every one of them in somebody's way within a
 * second.
 */
const CORNER = {
  density: 150,
  paceLow: 4.5,
  paceHigh: 4.5,
  runners: 0.6,
  flow: "through",
  settling: 0,
  span: 5,
  children: 0.6,
} as const
const SMALL = { width: 400, height: 250 }

/** A tenth of a shoulder width. Passing through somebody would read as most of half a metre. */
const TENTH_OF_A_BODY = 0.045

/**
 * The deepest anyone is inside anyone, read off the positions — **not** off
 * `stats().overlap`, which the contact solver computes as it works, so a
 * crowd with no solver at all reports none.
 */
function deepest(crowd: Crowd): number {
  let worst = 0
  const walkers = crowd.walkers
  for (let i = 0; i < walkers.length; i++) {
    for (let j = i + 1; j < walkers.length; j++) {
      const a = walkers[i]!
      const b = walkers[j]!
      worst = Math.max(worst, a.body.radius + b.body.radius - Math.hypot(b.x - a.x, b.y - a.y))
    }
  }
  return worst
}

describe("nobody walks through anybody", () => {
  /**
   * **The contact solver's promise: nobody is ever drawn inside anybody.**
   * `separate()` runs after each step and clears what the step left, which is
   * what a frame shows.
   *
   * Seen failing: with `separate()` removed, this reads 0.43 m on the fourth
   * step. As shipped it reads nothing at all over six seconds, with the solver
   * cut to one pass as well as at four.
   */
  it("never ends a step with anybody inside anybody, at the settings' hardest corner", () => {
    const { crowd } = park(CORNER, SMALL)
    expect(crowd.walkers.length, "the corner is not crowded").toBeGreaterThan(50)

    let worst = 0
    for (let step = 0; step < 2 / STEP; step++) {
      crowd.step(STEP)
      worst = Math.max(worst, deepest(crowd))
    }
    expect(worst).toBeLessThan(TENTH_OF_A_BODY)
  })

  /**
   * **Steering's job: people see each other coming and do not collide hard.**
   * `stats().overlap` is how deep a contact got *before* the solver cleared it —
   * which is what avoidance, not the solver, is responsible for. After a second
   * for the spawn to shake out.
   *
   * Seen failing: with `AVOID_STRENGTH` at zero, 0.092 in the first half-second.
   * As shipped the worst half-second is 0.017.
   */
  it("keeps every collision to a tenth of a body, at the settings' hardest corner", () => {
    const scene = park(CORNER, SMALL).settle(1)

    let worst = 0
    for (let step = 0; step < 3 / STEP; step++) {
      scene.crowd.step(STEP)
      worst = Math.max(worst, scene.crowd.stats().overlap)
    }
    expect(scene.crowd.walkers.length, "the corner emptied").toBeGreaterThan(50)
    expect(worst).toBeLessThan(TENTH_OF_A_BODY)
  })
})

describe("the population", () => {
  it("fills the frame to the density asked for, and holds there", { timeout: 120_000 }, () => {
    const { crowd, view, settings } = park({ density: 12 })
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
   * The opening cast covers the frame rather than gathering in one part of it.
   *
   * Read at the moment of `fill()`, before anybody has walked: what is under
   * test is where the spawner puts people, and a minute of walking afterwards
   * only blurs it. This used to settle three parks for seventy seconds each.
   *
   * It does **not** guard the fault it was first written for, and never could:
   * the crowd filled before the canvas was measured, so everybody landed in a
   * few square metres at the middle. That ordering is in `walkers.ts`, which a
   * headless park never runs — `park()` measures first by construction. Nor
   * does anything else any more, because the fault no longer has a visible
   * failure: the placeholder view is now a span-sized square rather than a
   * point, and with `fill()` moved above `resize()` the page's crowd still
   * covers the frame — tried, and "a crowd, on a ground" stayed green.
   *
   * Two readings, because a quadrant count alone cannot fail for the commonest
   * way to get this wrong. Laying the cast out with the inset `spotInside`, as
   * `crowd.ts` warns against, leaves a quarter of the picture empty round the
   * edge — and the quadrants stay perfectly balanced. Seen exactly that: the
   * quadrant half passed with the swap made. So the **outer band** is counted
   * as well, the part of the frame past three quarters of the way out, which
   * holds 44 per cent of the frame's area and almost none of an inset cast —
   * only the few a group's formation spills past it. Seen failing with the
   * swap: 7 per cent in the band.
   */
  it("lays the opening crowd out across the whole frame, edges included", () => {
    const quadrants = [0, 0, 0, 0]
    let counted = 0
    let outer = 0
    for (const seed of [1, 2, 3]) {
      const { crowd, view } = park({ density: 34, flow: "wander", settling: 0.3, span: 10, seed })
      for (const walker of crowd.walkers) {
        if (Math.abs(walker.x) > view.halfWidth || Math.abs(walker.y) > view.halfHeight) continue
        quadrants[(walker.x < 0 ? 0 : 1) + (walker.y < 0 ? 0 : 2)]!++
        counted++
        if (Math.abs(walker.x) > view.halfWidth * 0.75 || Math.abs(walker.y) > view.halfHeight * 0.75) outer++
      }
    }

    expect(counted).toBeGreaterThan(100)
    for (const count of quadrants) {
      expect(count / counted).toBeGreaterThan(0.17)
      expect(count / counted).toBeLessThan(0.33)
    }
    expect(outer / counted, "nobody near the edge of the frame").toBeGreaterThan(0.25)
  })

  it("turns the crowd over rather than keeping the same people", { timeout: 60_000 }, () => {
    const { crowd } = park({ density: 14, settling: 0.1, flow: "through" }).settle(20)
    const before = new Set(crowd.walkers.map((walker) => walker.id))

    run(crowd, 150)

    const still = crowd.walkers.filter((walker) => before.has(walker.id)).length
    expect(still).toBeLessThan(before.size * 0.5)
  })
})

describe("the world stays bounded", () => {
  /**
   * **Nobody walks off into the middle distance: the cull keeps the world
   * bounded.** This used to be checked after forty-five seconds of every
   * preset. It is a property of the cull, and the case that tests it is people
   * leaving as fast as the settings let them, through a small frame.
   *
   * The allowance is a group's own length rather than a tight margin, because a
   * group is culled when *every* member is past the line — and a family
   * straddling it, with a child at the end of its leash on the inside and an
   * adult walking out toward a goal fourteen metres further, is a real thing
   * rather than a leak.
   *
   * Three seconds, because at this pace the population thins in waves — it has
   * to be measured while there is somebody to measure. Seen failing: with the
   * cull removed, somebody is 23 m past the edge at two seconds and 33 m at
   * three. As shipped the furthest is 11.
   */
  it("culls anybody who gets further out than a group's own length", () => {
    const { crowd, view } = park({ ...CORNER, density: 20 }, SMALL)
    const allowance = view.margin + 16

    for (let second = 0; second < 3; second++) {
      run(crowd, 1)
      expect(crowd.walkers.length, `nobody left to measure at ${second + 1}s`).toBeGreaterThan(0)
      for (const walker of crowd.walkers) {
        expect(Math.abs(walker.x)).toBeLessThan(view.halfWidth + allowance)
        expect(Math.abs(walker.y)).toBeLessThan(view.halfHeight + allowance)
      }
    }
  })
})

describe("the seed", () => {
  /**
   * Two seconds rather than thirty: a stream that diverges does so on its first
   * draw, and every walker draws on every step.
   */
  it("gives the same afternoon twice", () => {
    const one = park({ seed: 12345 }).settle(2)
    const two = park({ seed: 12345 }).settle(2)

    expect(one.crowd.stats()).toEqual(two.crowd.stats())
    expect(one.crowd.walkers.map((w) => [w.x, w.y])).toEqual(two.crowd.walkers.map((w) => [w.x, w.y]))
  })

  it("gives a different one for a different seed", () => {
    const one = park({ seed: 1 })
    const two = park({ seed: 2 })

    expect(one.crowd.walkers.map((w) => w.body.stature)).not.toEqual(two.crowd.walkers.map((w) => w.body.stature))
  })
})

describe("playback and the defaults", () => {
  it("starts from a legal set of settings", () => {
    expect(normalizeSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS)
  })
})

/**
 * Each decision in `decisions.test.ts` is consulted by the walk.
 *
 * A second of park apiece, with a presence paired to every absence. All of
 * these show at once — a park opens with residents already in place and
 * children already at play — so a longer run would only be waiting.
 */
describe("wired into the walk", () => {
  /**
   * Seen failing: with `stoppingChance` bypassed in `spawnGroup`, the first
   * reads nobody sitting.
   */
  it("puts people on the ground when they are there to stop, and nobody when nobody is", () => {
    expect(park({ density: 20, flow: "gather", settling: 1, span: 14 }).stats().sitting).toBeGreaterThan(0)
    expect(park({ density: 20, flow: "through", settling: 0 }).settle(1).stats().sitting).toBe(0)
  })

  it("makes children when asked for them, and none when not", () => {
    expect(park({ density: 40, children: 0.35, span: 10 }).stats().children).toBeGreaterThan(0)
    expect(park({ density: 40, children: 0, span: 10 }).settle(1).stats().children).toBe(0)
  })

  /**
   * Seen failing: with the `mayYield` call removed from the step, nobody in a
   * busy park ever gives way.
   */
  it("has somebody giving way in a busy park within a second", () => {
    const busy = park({ density: 60, flow: "wander", span: 10, settling: 0, children: 0 })
    let yielded = 0
    for (let step = 0; step < 1 / STEP; step++) {
      busy.crowd.step(STEP)
      yielded += busy.crowd.stats().yielding
    }
    expect(yielded).toBeGreaterThan(0)
  })

  it("has groups dawdling or hurrying from the first second", () => {
    expect(park({ density: 20, settling: 0.5, span: 12 }).settle(1).stats().unsteady).toBeGreaterThan(0)
  })

  /**
   * Seen failing: with `updatePlay`'s call to `playChoice` short-circuited to
   * "carry on", no child does anything but walk.
   */
  it("has children playing within a second, and none when play is off", () => {
    const playing = (play: number) => {
      const { crowd } = park({ density: 34, children: 0.55, play, span: 8, flow: "gather", settling: 0.8 })
      let seen = 0
      for (let step = 0; step < 1 / STEP; step++) {
        crowd.step(STEP)
        for (const walker of crowd.walkers) {
          if (walker.body.age !== "child") continue
          if (["darting", "chasing", "fleeing", "crouching", "fallen"].includes(walker.activity)) seen++
        }
      }
      return seen
    }
    expect(playing(1.5)).toBeGreaterThan(0)
    expect(playing(0)).toBe(0)
  })

  /**
   * The leash is checked before anything else a playing child decides, in every
   * state. A child built fleeing, five metres from its adult and with seconds of
   * fleeing still to run, is walking back on the next step.
   *
   * Seen failing: with the leash check moved below the `clock < until` return —
   * the shape of the first version, which let a fleeing child run twenty-one
   * metres — the child is still fleeing.
   */
  it("calls a fleeing child back to its adult on the next step", () => {
    const { crowd } = park({ density: 24, children: 0.5, play: 1.5, span: 10, flow: "gather", settling: 0.7 })
    const child = crowd.walkers.find(
      (walker) => walker.body.age === "child" && walker.group.members.some((member) => member.body.age === "adult"),
    )
    if (!child) throw new Error("no child with an adult")
    const adult = child.group.members.find((member) => member.body.age === "adult")!

    child.activity = "fleeing"
    child.quarry = null
    child.until = crowd.clock + 10
    child.x = adult.x + 5
    child.y = adult.y

    crowd.step(STEP)
    expect(child.activity).toBe("walking")
  })
})

describe("changing their minds", () => {
  /**
   * A crowd all holding one bearing reads as traffic however well it avoids
   * itself. `flow` decides how firmly a heading is held — `through` really is a
   * crowd on a mission, and blurring that would cost the setting its point.
   */
  it("wanders off the straight line, and less when everyone is crossing", { timeout: 90_000 }, () => {
    const straightness = (flow: "through" | "wander") => {
      const { crowd } = park({ flow, density: 8, span: 16, settling: 0, children: 0, play: 0, grouping: 0 }).settle(20)

      const headings = new Map<number, number[]>()
      for (let step = 0; step < 60 / STEP; step++) {
        crowd.step(STEP)
        if (step % 60 !== 0) continue
        for (const walker of crowd.walkers) {
          if (walker.speed < 0.3) continue
          const list = headings.get(walker.id) ?? []
          list.push(Math.atan2(walker.vy, walker.vx))
          headings.set(walker.id, list)
        }
      }

      // Mean absolute turn between samples, over everybody seen twice or more.
      let turned = 0
      let steps = 0
      for (const list of headings.values()) {
        for (let index = 1; index < list.length; index++) {
          let delta = list[index]! - list[index - 1]!
          while (delta > Math.PI) delta -= Math.PI * 2
          while (delta < -Math.PI) delta += Math.PI * 2
          turned += Math.abs(delta)
          steps++
        }
      }
      return steps > 0 ? turned / steps : 0
    }

    const crossing = straightness("through")
    const wandering = straightness("wander")

    expect(wandering).toBeGreaterThan(crossing * 1.5)
  })
})
