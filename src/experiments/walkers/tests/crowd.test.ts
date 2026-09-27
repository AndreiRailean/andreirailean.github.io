import { describe, expect, it } from "vitest"
import type { Crowd } from "@/experiments/walkers/crowd"
import { DEFAULT_SETTINGS, normalizeSettings } from "@/experiments/walkers/settings"
import { park, STEP } from "./park"

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

/** The leash in `crowd.ts`, which a child's *typical* distance stays inside. */
const LEASH_METRES = 3.4

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

    for (const seed of [1, 2, 3]) {
      const { crowd, view } = park({ density: 34, flow: "wander", settling: 0.3, span: 10, seed }).settle(70)
      for (const walker of crowd.walkers) {
        if (Math.abs(walker.x) > view.halfWidth || Math.abs(walker.y) > view.halfHeight) continue
        quadrants[(walker.x < 0 ? 0 : 1) + (walker.y < 0 ? 0 : 2)]!++
        counted++
      }
    }

    expect(counted).toBeGreaterThan(45)
    for (const count of quadrants) {
      expect(count / counted).toBeGreaterThan(0.12)
      expect(count / counted).toBeLessThan(0.42)
    }
  })

  it("turns the crowd over rather than keeping the same people", { timeout: 60_000 }, () => {
    const { crowd } = park({ density: 14, settling: 0.1, flow: "through" }).settle(20)
    const before = new Set(crowd.walkers.map((walker) => walker.id))

    run(crowd, 150)

    const still = crowd.walkers.filter((walker) => before.has(walker.id)).length
    expect(still).toBeLessThan(before.size * 0.5)
  })
})

describe("who is out there", () => {
  it("makes about as many children as asked for", { timeout: 60_000 }, () => {
    const { crowd } = park({ density: 40, children: 0.35, span: 10 }).settle(60)
    const stats = crowd.stats()
    // Children arrive attached to adults, so the fraction is approached rather
    // than hit: a group of two adults and one child cannot be 35% child.
    expect(stats.children / stats.walkers).toBeGreaterThan(0.15)
    expect(stats.children / stats.walkers).toBeLessThan(0.55)
  })

  it("makes no children at all when asked for none", { timeout: 60_000 }, () => {
    const { crowd } = park({ density: 40, children: 0, span: 10 }).settle(40)
    expect(crowd.stats().children).toBe(0)
  })

  it("puts people on the ground when they are there to sit down", { timeout: 60_000 }, () => {
    const { crowd } = park({ density: 20, flow: "gather", settling: 1, span: 14 }).settle(110)
    expect(crowd.stats().sitting).toBeGreaterThan(0)
  })

  it("leaves nobody sitting when nobody is stopping", { timeout: 60_000 }, () => {
    const { crowd } = park({ density: 20, flow: "through", settling: 0 }).settle(90)
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
    // A **small frame** at the same densities. The claim is about people per
    // square metre, not about how many people there are, so the frame can be a
    // third of the size and the physics is identical — at a third of the cost.
    // At span 16 this one case was 44 of the file's 165 seconds, all of it spent
    // simulating four hundred walkers to measure a property four dozen show.
    const plain = { flow: "through", span: 9, settling: 0, children: 0, play: 0, runners: 0 } as const
    // 100 per 100 m² is one per square metre. The published fundamental
    // diagrams put a crowd there at about four fifths of its free speed, and
    // have it barely slowed at all below 40 — which is why the first version of
    // this test compared 4 against 34 and found a difference of six per cent,
    // correctly, having picked two densities that are both free flow.
    const empty = park({ ...plain, density: 4 }).settle(40)
    const packed = park({ ...plain, density: 100 }).settle(40)

    expect(packed.crowd.stats().meanSpeed).toBeLessThan(empty.crowd.stats().meanSpeed * 0.9)
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
  it("gives the same afternoon twice", { timeout: 60_000 }, () => {
    const one = park({ seed: 12345 }).settle(30)
    const two = park({ seed: 12345 }).settle(30)

    expect(one.crowd.stats()).toEqual(two.crowd.stats())
  })

  it("gives a different one for a different seed", { timeout: 60_000 }, () => {
    const one = park({ seed: 1 }).settle(30)
    const two = park({ seed: 2 }).settle(30)

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
    const { crowd } = park({ density: 34, children: 0.55, play: 1.5, span: 8, flow: "gather", settling: 0.8 }).settle(
      15,
    )

    const seen = new Set<string>()
    let jumped = false

    for (let step = 0; step < 110 / STEP; step++) {
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
    const { crowd } = park({ density: 26, children: 0.5, play: 0, span: 9, flow: "gather", settling: 0.8 }).settle(15)

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
    const { crowd } = park({ density: 24, children: 0.5, play: 1.5, span: 10, flow: "gather", settling: 0.7 }).settle(
      40,
    )

    let worst = 0
    let total = 0
    let samples = 0
    for (let step = 0; step < 80 / STEP; step++) {
      crowd.step(STEP)
      if (step % 20 !== 0) continue
      for (const walker of crowd.walkers) {
        if (walker.body.age !== "child") continue
        const adult = walker.group.members.find((member) => member.body.age === "adult")
        if (!adult) continue
        const away = Math.hypot(walker.x - adult.x, walker.y - adult.y)
        worst = Math.max(worst, away)
        total += away
        samples++
      }
    }
    const mean = samples > 0 ? total / samples : 0

    // The leash is 3.4 m and it is a rule about *starting* to come back, not a
    // wall: a child running flat out when it turns overshoots it, and so does
    // one whose adult walked off the other way at the same moment. What has to
    // hold is that it is bounded and that it is rare — so the worst case gets
    // room and the typical one does not.
    expect(worst).toBeLessThan(11)
    expect(mean).toBeLessThan(LEASH_METRES)
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
  it("sorts a head-on counterflow into files as it runs", { timeout: 120_000 }, () => {
    // A smaller frame than the file's other crowded cases, but **not as small**.
    // Sorting is unlike the other properties here in that the frame's size is
    // part of it: files form along a walker's path, and at span 10 a crossing
    // takes ten seconds, which is not long enough for one to. It failed there,
    // correctly. 13 is where the effect survives and the run still costs a third
    // of what it did.
    // **One park, read twice**, rather than two parks read once each. The
    // effect is a few hundredths and the seed-to-seed scatter is about as
    // large, so comparing two different afternoons was comparing the seeds as
    // much as the sorting. It is also half the work.
    const { crowd } = park({
      density: 60,
      span: 13,
      settling: 0,
      grouping: 0.05,
      children: 0,
      play: 0,
      flow: "through",
    }).settle(12)
    const early = crowd.stats().sorting
    run(crowd, 110)
    const settled = crowd.stats().sorting

    // The margin over the unsorted case is smaller than it once was, and that
    // is the model rather than a regression. Files form out of people agreeing
    // about which side to pass on, and every source of human variability added
    // since — a pace that drifts, groups that dawdle and hurry, somebody
    // stopping dead to let a stranger cross — is a disagreement. Real
    // heterogeneous crowds sort less crisply than uniform ones for the same
    // reason. What has to hold is that it sorts at all, and more the longer it
    // runs.
    expect(settled).toBeGreaterThan(early + 0.02)
    expect(settled).toBeGreaterThan(0.15)
  })
})

describe("nobody holds one speed for ever", () => {
  /**
   * The thing that gave the whole piece away at a distance.
   *
   * A walker drew a preferred speed when they arrived and held it exactly, for
   * ever, and at small sizes a field of dots each gliding at its own fixed rate
   * does not read as people — it reads as something swimming. Three mechanisms
   * answer it and all three have to be measurable, because none of them is
   * visible in a still.
   */
  it("gives one person a speed that wanders while they walk", { timeout: 60_000 }, () => {
    // A wide frame, so whoever is followed is in it long enough to be a sample
    // of one person's pace over time rather than a snapshot of two readings.
    const { crowd } = park({ density: 6, flow: "wander", settling: 0, children: 0, play: 0, span: 24 }).settle(20)

    // Follow whoever is still here for the whole sample, so this is one
    // person's speed over time rather than a population's spread.
    const followed = crowd.walkers.find((walker) => walker.body.age === "adult")
    if (!followed) throw new Error("nobody to follow")

    const speeds: number[] = []
    for (let step = 0; step < 60 / STEP; step++) {
      crowd.step(STEP)
      if (!followed.present) break
      if (step % 12 === 0 && followed.speed > 0.2) speeds.push(followed.speed)
    }

    // Fewer samples than the run is long: people arrive scattered across the
    // whole world now rather than only inside the frame, so whoever is followed
    // may well walk out of it partway through. What matters is the spread.
    expect(speeds.length).toBeGreaterThan(10)
    const mean = speeds.reduce((sum, value) => sum + value, 0) / speeds.length
    const spread = Math.sqrt(speeds.reduce((sum, value) => sum + (value - mean) ** 2, 0) / speeds.length)

    // Measured intra-individual variability over a walk is a coefficient of
    // variation of five to ten per cent. Anything near zero is the old bug.
    expect(spread / mean).toBeGreaterThan(0.02)
  })

  it("has some of the crowd dawdling or hurrying at any moment", { timeout: 60_000 }, () => {
    const { crowd } = park({ density: 20, settling: 0.5, span: 12 }).settle(60)
    expect(crowd.stats().unsteady).toBeGreaterThan(0)
  })

  it("has nobody stopping for anybody in an empty frame, and somebody in a busy one", { timeout: 90_000 }, () => {
    // Yielding is a response to an imminent crossing, so it must be absent when
    // there is nothing to cross. A rate that fires anyway would be a walker
    // stopping for no reason, which reads as a stutter.
    const empty = park({ density: 1, flow: "wander", span: 10, settling: 0, children: 0 }).settle(15)
    const busy = park({ density: 60, flow: "wander", span: 10, settling: 0, children: 0 }).settle(20)

    let stoppedAlone = 0
    let stoppedInCrowd = 0
    for (let step = 0; step < 30 / STEP; step++) {
      empty.crowd.step(STEP)
      busy.crowd.step(STEP)
      if (step % 4 !== 0) continue
      stoppedAlone += empty.crowd.stats().yielding
      stoppedInCrowd += busy.crowd.stats().yielding
    }

    expect(stoppedAlone).toBe(0)
    expect(stoppedInCrowd).toBeGreaterThan(0)
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
