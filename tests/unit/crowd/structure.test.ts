import { describe, expect, it } from "vitest"
import { createLoop, createPath } from "@/experiments/crowd/path"
import { createStroll } from "@/experiments/crowd/stroll"
import { createThrong } from "@/experiments/crowd/throng"
import { bodyRadius } from "@/experiments/crowd/body"
import { normalizeSettings, PRESETS, type Settings } from "@/experiments/crowd/settings"

/**
 * The structured crowd: a lining that stands, a way that bends, teams.
 *
 * **Each of these asserts that a mechanism fired**, not that the scene ran.
 * A lining nobody is placed in, a bend nobody follows and a team size that
 * never forms all leave a scene that renders perfectly well — which is the
 * class `docs/agents/experiment-writer.md` warns about under _Measure before
 * you look_.
 */

const STEP = 1 / 120

function walk(label: string, seconds: number) {
  const preset = PRESETS.find((p) => p.label === label)
  if (!preset) throw new Error(`no preset ${label}`)
  const settings = normalizeSettings(preset.settings)
  const me = createStroll(settings, settings.seed)
  const crowd = createThrong(settings, me)
  for (let t = 0; t < seconds; t += STEP) {
    me.step(STEP, crowd)
    crowd.step(STEP)
  }
  return { settings, me, crowd }
}

describe("a path", () => {
  it("is the old corridor exactly when it does not bend", () => {
    const path = createPath(0, 300, 1, 2)
    expect(path.straight).toBe(true)
    expect(path.centre(123)).toBe(0)
    expect(path.lateral(50, -2.5)).toBe(-2.5)
  })

  it("passes through where the observer starts, and bends away from it", () => {
    const path = createPath(30, 300, 1.1, 4.2)
    expect(path.centre(0)).toBeCloseTo(0, 9)
    const swing = Math.max(...Array.from({ length: 60 }, (_, i) => Math.abs(path.centre(i * 10))))
    expect(swing).toBeGreaterThan(10)
    expect(path.minRadius).toBeGreaterThan(10)
  })
})

describe("the parade", () => {
  const { settings, crowd, me } = walk("parade", 8)
  const stats = crowd.stats()

  it("has a lining, and the lining stands still inside it", () => {
    expect(stats.watchers).toBeGreaterThan(500)
    let moving = 0
    let astray = 0
    let near = 0
    for (const person of crowd.people) {
      if (!person.watcher) continue
      if (Math.hypot(person.x - me.x, person.y - me.y) > 30) continue
      near++
      if (Math.hypot(person.vx, person.vy) > 0.3) moving++
      const lat = Math.abs(crowd.path.lateral(person.x, person.y))
      if (lat < crowd.halfWidth - 0.3 || lat > crowd.halfWidth + settings.lining + 0.3) astray++
    }
    expect(near).toBeGreaterThan(200)
    expect(moving / near).toBeLessThan(0.05)
    expect(astray / near).toBeLessThan(0.02)
  })

  it("keeps the walkers on the way, going my way", () => {
    let on = 0
    let off = 0
    let along = 0
    for (const person of crowd.people) {
      if (person.watcher || person.companion) continue
      if (Math.hypot(person.x - me.x, person.y - me.y) > 30) continue
      if (Math.abs(person.y) > crowd.halfWidth + 0.3) off++
      else on++
      if (person.vx > 0.3) along++
    }
    expect(on).toBeGreaterThan(20)
    expect(off).toBe(0)
    expect(along / on).toBeGreaterThan(0.9)
  })

  it("moves me past the lining rather than with it", () => {
    expect(me.x).toBeGreaterThan(6)
    expect(Math.abs(me.y)).toBeLessThan(crowd.halfWidth)
  })
})

describe("teams", () => {
  it("forms teams of the stated size", () => {
    const { crowd, settings } = walk("teams", 1)
    const stats = crowd.stats()
    expect(stats.teams).toBeGreaterThan(5)
    for (const group of crowd.groups) expect(group.size).toBe(settings.team)
  })

  it("puts me at the back of a team of my own, with nobody behind me", () => {
    const { crowd, settings } = walk("teams", 6)
    const mates = crowd.companions
    expect(settings.companions).toBeGreaterThan(3)
    expect(mates.length).toBe(settings.companions)
    for (const mate of mates) expect(mate.besideAhead).toBeGreaterThanOrEqual(0)
    const ahead = mates.filter((mate) => mate.besideAhead > 0.5).length
    expect(ahead).toBeGreaterThan(mates.length / 2)
  })
})

describe("the trail", () => {
  const { crowd, me } = walk("the trail", 20)

  it("bends and climbs", () => {
    expect(crowd.path.straight).toBe(false)
    expect(crowd.path.flat).toBe(false)
    expect(crowd.stats().minRadius).toBeGreaterThan(20)
  })

  it("keeps me on it, facing along it", () => {
    const lat = crowd.path.lateral(me.x, me.y)
    expect(Math.abs(lat)).toBeLessThan(crowd.halfWidth)
    const along = crowd.path.along(me.x, me.y)
    const off = Math.abs(Math.atan2(Math.sin(me.course - along), Math.cos(me.course - along)))
    expect(off).toBeLessThan(0.35)
    expect(me.x).toBeGreaterThan(15)
  })

  it("has the crowd following the bends rather than the axis", () => {
    let aligned = 0
    let counted = 0
    let bent = 0
    for (const person of crowd.people) {
      const speed = Math.hypot(person.vx, person.vy)
      if (speed < 0.3) continue
      const along = crowd.path.along(person.x, person.y)
      counted++
      if (Math.abs(along) > 0.2) bent++
      if ((person.vx * Math.cos(along) + person.vy * Math.sin(along)) / speed > 0.9) aligned++
    }
    // A control inside the assertion: plenty of the crowd is on a stretch that
    // is not along the axis, so following the axis would fail this.
    expect(bent / counted).toBeGreaterThan(0.3)
    expect(aligned / counted).toBeGreaterThan(0.85)
  })

  // **The assertion above cannot see the mechanism on its own**, and was
  // watched passing with the path rotation deleted: on a 3.5 m trail the walls
  // steer everybody round the bends anyway, so velocity along the path is
  // guaranteed either way. What the walls cannot do is spread people across the
  // way — a crowd shoved round a bend rides its outside edge. Measured on a
  // bend: 0.47 of the half-width from the centre with the rotation, 0.64
  // without it.
  it("spreads the crowd across the way on a bend, rather than pressing it to the wall", () => {
    let sum = 0
    let n = 0
    for (const person of crowd.people) {
      if (Math.abs(crowd.path.along(person.x, person.y)) < 0.3) continue
      sum += Math.abs(crowd.path.lateral(person.x, person.y)) / crowd.halfWidth
      n++
    }
    expect(n).toBeGreaterThan(100)
    expect(sum / n).toBeLessThan(0.55)
  })
})

describe("effort", () => {
  /**
   * The concertina: a crowd walking a hill by Tobler's function bunches on the
   * climbs. **The ratio is against the control at effort 0**, which measured
   * 0.92 over ninety seconds, so an effort that stopped doing anything fails
   * rather than passing on the seed's terrain. 1.87 with it.
   */
  function bunching(effort: number): number {
    const preset = PRESETS.find((p) => p.label === "the trail")!
    const settings = normalizeSettings({ ...preset.settings, effort })
    const me = createStroll(settings, settings.seed)
    const crowd = createThrong(settings, me)
    let up = 0
    let down = 0
    let upLen = 0
    let downLen = 0
    for (let step = 0; step < 75 * 120; step++) {
      me.step(STEP, crowd)
      crowd.step(STEP)
      if (step < 45 * 120 || step % 240 !== 0) continue
      for (let x = me.x - 200; x < me.x + 200; x += 1) {
        const g = crowd.path.groundSlope(x)
        if (g > 0.1) upLen++
        else if (g < -0.1) downLen++
      }
      for (const person of crowd.people) {
        if (Math.abs(person.x - me.x) > 200) continue
        const g = crowd.path.groundSlope(person.x)
        if (g > 0.1) up++
        else if (g < -0.1) down++
      }
    }
    return up / upLen / (down / downLen)
  }

  it("bunches the crowd on the climbs, and only when it is on", () => {
    const off = bunching(0)
    const on = bunching(1)
    expect(off).toBeLessThan(1.25)
    expect(on).toBeGreaterThan(off * 1.4)
  })
})

describe("keeping to a side", () => {
  /**
   * The share of walkers on their own side of the way. **The control is the
   * same scene at `keep` 0**, which measured 0.45 — random, and a little under
   * half because the middle counts for neither side — so a lane force that
   * stopped doing anything fails rather than passing on the seed's luck.
   */
  function sides(keep: number) {
    const preset = PRESETS.find((p) => p.label === "keep left")!
    const settings = normalizeSettings({ ...preset.settings, keep })
    const me = createStroll(settings, settings.seed)
    const crowd = createThrong(settings, me)
    let withMe = 0
    let withMeLeft = 0
    let oncoming = 0
    let oncomingRight = 0
    let mine = 0
    let samples = 0
    for (let step = 0; step < 25 * 120; step++) {
      me.step(STEP, crowd)
      crowd.step(STEP)
      if (step < 12 * 120 || step % 120 !== 0) continue
      mine += crowd.path.lateral(me.x, me.y)
      samples++
      for (const person of crowd.people) {
        if (Math.hypot(person.x - me.x, person.y - me.y) > 40) continue
        const speed = Math.hypot(person.vx, person.vy)
        if (speed < 0.3) continue
        const along = crowd.path.along(person.x, person.y)
        const heading = (person.vx * Math.cos(along) + person.vy * Math.sin(along)) / speed
        const lateral = crowd.path.lateral(person.x, person.y)
        if (heading > 0.7) {
          withMe++
          if (lateral > 0) withMeLeft++
        } else if (heading < -0.7) {
          oncoming++
          if (lateral < 0) oncomingRight++
        }
      }
    }
    return { withMe: withMeLeft / withMe, oncoming: oncomingRight / oncoming, me: mine / samples }
  }

  it("puts my stream on the left and the oncoming one on my right", () => {
    const off = sides(0)
    const on = sides(1)
    expect(off.withMe).toBeLessThan(0.65)
    expect(off.oncoming).toBeLessThan(0.65)
    expect(on.withMe).toBeGreaterThan(0.95)
    expect(on.oncoming).toBeGreaterThan(0.95)
    expect(on.me).toBeGreaterThan(0.5)
  })

  it("mirrors when told to keep right", () => {
    const right = sides(-1)
    expect(right.withMe).toBeLessThan(0.05)
    expect(right.oncoming).toBeLessThan(0.05)
    expect(right.me).toBeLessThan(-0.5)
  })
})

describe("the runner", () => {
  /**
   * "i can increase my pace … but not enough to make it feel like a jog. maybe
   * because my bobbing is still walk-like." Both were true: the track stopped at
   * 2.2 m/s, which is the walk-run transition, and the bob was a walk's at any
   * speed. So this asserts the gait, not the pace.
   */
  function run(patch: Partial<Settings>, seconds: number) {
    const preset = PRESETS.find((p) => p.label === "runner")!
    const settings = normalizeSettings({ ...preset.settings, ...patch })
    const me = createStroll(settings, settings.seed)
    const crowd = createThrong(settings, me)
    let running = 0
    let steps = 0
    let low = Infinity
    let high = -Infinity
    let lateral = 0
    let hits = 0
    for (let step = 0; step < seconds * 120; step++) {
      me.step(STEP, crowd)
      crowd.step(STEP)
      if (step < 5 * 120) continue
      steps++
      if (me.stats().running) running++
      const z = me.eye().z
      low = Math.min(low, z)
      high = Math.max(high, z)
      lateral += Math.abs(crowd.path.lateral(me.x, me.y))
      for (const person of crowd.neighbours(me.x, me.y, 1.5)) {
        if (Math.hypot(person.x - me.x, person.y - me.y) < person.radius + bodyRadius(settings.height)) hits++
      }
    }
    return { running: running / steps, bounce: high - low, lateral: lateral / steps, hits }
  }

  it("runs, bouncing twice as far as a walk, down the middle, into nobody", () => {
    const runner = run({}, 20)
    expect(runner.running).toBeGreaterThan(0.95)
    expect(runner.bounce).toBeGreaterThan(0.065)
    expect(runner.lateral).toBeLessThan(0.5)
    expect(runner.hits).toBe(0)
  })

  it("walks, with a walk's bob, at a walking pace", () => {
    const walker = run({ walk: 1.3 }, 12)
    expect(walker.running).toBe(0)
    expect(walker.bounce).toBeLessThan(0.055)
  })
})

describe("the chase", () => {
  /**
   * The gap to the person in red has to keep opening and closing. **The first
   * version settled** — a pace varying smoothly with distance always has a
   * distance where it equals mine, and two minutes of the market ended on
   * 4 m, 4 m, 4 m — so the assertion is on the range over the *last* minute,
   * where a settled chase has none. The ceiling catches the other failure: a
   * quarry that only ever runs is gone.
   */
  it("keeps the gap opening and closing, and never loses them", () => {
    const preset = PRESETS.find((p) => p.label === "catch me")!
    // Thinned and pulled in, because the chase does not depend on how many
    // strangers there are and the full market is forty seconds of test.
    const settings = normalizeSettings({ ...preset.settings, density: 12, reach: 40 })
    const me = createStroll(settings, settings.seed)
    const crowd = createThrong(settings, me)
    const late: number[] = []
    let furthest = 0
    for (let step = 0; step < 100 * 120; step++) {
      me.step(STEP, crowd)
      crowd.step(STEP)
      if (step % 60 !== 0) continue
      const gap = crowd.stats().quarry
      furthest = Math.max(furthest, gap)
      if (step > 40 * 120) late.push(gap)
    }
    expect(crowd.quarry).not.toBeNull()
    expect(Math.max(...late) - Math.min(...late)).toBeGreaterThan(8)
    expect(Math.min(...late)).toBeLessThan(5)
    expect(furthest).toBeLessThan(35)
  })

  it("has nobody in red when there is nothing to chase", () => {
    const { crowd } = walk("market", 1)
    expect(crowd.quarry).toBeNull()
    expect(crowd.stats().quarry).toBe(0)
  })
})

describe("the loop", () => {
  it("closes on itself, where it started, facing the way I am", () => {
    const loop = createLoop(700, 0.85, 1, 2, 5, -3, 0.4)
    expect(loop.closed).toBe(true)
    const f = { lateral: 0, cos: 1, sin: 0 }
    loop.frame(5, -3, f)
    expect(Math.abs(f.lateral)).toBeLessThan(0.01)
    expect(Math.atan2(f.sin, f.cos)).toBeCloseTo(0.4, 2)
    expect(loop.lengthWithin(5, -3, 5000)).toBeCloseTo(700, -1)
    expect(loop.minRadius).toBeGreaterThan(8)
    expect(loop.minRadius).toBeLessThan(40)
  })

  /**
   * The run has to go round, not merely stay on a curve. **Thinned for speed**
   * — the lining is what costs, and what is asserted is my own course — and
   * the turning is checked by sign as well as size, since a loop turns one way
   * and a street that bends turns both.
   */
  it("takes me round it, always turning the same way, smoothly, on the way", () => {
    const preset = PRESETS.find((p) => p.label === "loop run")!
    const settings = normalizeSettings({ ...preset.settings, watchers: 30 })
    const me = createStroll(settings, settings.seed)
    const crowd = createThrong(settings, me)
    let last = me.course
    let turned = 0
    let fastest = 0
    let off = 0
    for (let step = 0; step < 40 * 120; step++) {
      me.step(STEP, crowd)
      crowd.step(STEP)
      const d = Math.atan2(Math.sin(me.course - last), Math.cos(me.course - last))
      last = me.course
      if (step < 3 * 120) continue
      turned += d
      fastest = Math.max(fastest, Math.abs(d / STEP))
      off = Math.max(off, Math.abs(crowd.path.lateral(me.x, me.y)))
    }
    // Forty seconds at 3 m/s is a sixth of a 700 m lap: about 60° of left turn.
    expect(turned).toBeGreaterThan(0.6)
    expect(fastest).toBeLessThan(0.6)
    expect(off).toBeLessThan(crowd.halfWidth)
    expect(crowd.stats().companions).toBe(3)
  })
})

describe("glancing at a run", () => {
  /**
   * "Current glancing model breaks the loop running illusion because it appears
   * like a distracted child is about to fall over." The same scene walked and
   * run, so the comparison is the gait alone: measured on the loop, running
   * took wide head turns from 19.5% of the time to 4.7% and glances up or down
   * from 10% to under 1%.
   */
  function gaze(walk: number) {
    const preset = PRESETS.find((p) => p.label === "loop run")!
    const settings = normalizeSettings({ ...preset.settings, watchers: 30, walk })
    const me = createStroll(settings, settings.seed)
    const crowd = createThrong(settings, me)
    const bias = (settings.pitch * Math.PI) / 180
    let n = 0
    let wide = 0
    let steep = 0
    for (let step = 0; step < 60 * 120; step++) {
      me.step(STEP, crowd)
      crowd.step(STEP)
      if (step < 5 * 120) continue
      n++
      const yaw = Math.abs(Math.atan2(Math.sin(me.yaw - me.course), Math.cos(me.yaw - me.course)))
      if (yaw > (25 * Math.PI) / 180) wide++
      if (Math.abs(me.pitch - bias) > (10 * Math.PI) / 180) steep++
    }
    return { wide: wide / n, steep: steep / n }
  }

  it("keeps a runner's eyes on the way ahead", () => {
    const walking = gaze(1.3)
    const running = gaze(3)
    expect(running.wide).toBeLessThan(walking.wide * 0.5)
    expect(running.steep).toBeLessThan(0.02)
    expect(walking.steep).toBeGreaterThan(running.steep * 3)
  })
})

describe("chasing through the stalls", () => {
  /**
   * "They're almost always in front, which makes them appear like a center
   * marker on a camera screen." Measured as the share of the chase with the red
   * head within 5° of my heading. Aiming at them straight down an aisle was 77%;
   * following their trail through a runaway who ducks round corners is 12%.
   * The stalls are asserted too, from both sides: nobody walks through one,
   * least of all me, which is what makes a straight line to them impossible.
   */
  it("follows their trail round the corners rather than locking on", () => {
    const preset = PRESETS.find((p) => p.label === "catch me")!
    const settings = normalizeSettings({ ...preset.settings, density: 12, reach: 40 })
    const me = createStroll(settings, settings.seed)
    const crowd = createThrong(settings, me)
    let samples = 0
    let centred = 0
    let trespass = 0
    let crowdIn = 0
    let crowdN = 0
    for (let step = 0; step < 200 * 120; step++) {
      me.step(STEP, crowd)
      crowd.step(STEP)
      if (step < 10 * 120 || step % 30 !== 0) continue
      if (crowd.stalls.blocked(me.x, me.y, 0)) trespass++
      // Only while they are running. Closing on somebody who has stopped is
      // head-on by nature — that is how a catch happens — and a window short
      // enough to be one long approach read 0.50 on this seed where the whole
      // chase reads 0.29 and the running part 0.25.
      const runaway = crowd.quarry!
      if (crowd.caught || runaway.preferred < 1) continue
      samples++
      const bearing = Math.atan2(runaway.y - me.y, runaway.x - me.x) - me.course
      if (Math.abs(Math.atan2(Math.sin(bearing), Math.cos(bearing))) < (5 * Math.PI) / 180) centred++
      if (step % 1200 === 0) {
        for (const person of crowd.people) {
          crowdN++
          if (crowd.stalls.blocked(person.x, person.y, 0)) crowdIn++
        }
      }
    }
    expect(crowd.stalls.active).toBe(true)
    expect(centred / samples).toBeLessThan(0.35)
    expect(trespass).toBe(0)
    expect(crowdIn / crowdN).toBeLessThan(0.02)
  })
})

describe("catching them", () => {
  /**
   * Seed 2222 is the one that stuck: a runaway pinned against a stall for 172
   * seconds with me half a metre behind — "i can't quite tell whether we're
   * walking together or we're wrestling". What it should be instead: "if i
   * catch them we can stand together for a little bit, then they run away and
   * I chase them again. tom and jerry style."
   */
  function chase(patch: Partial<Settings>) {
    const preset = PRESETS.find((p) => p.label === "catch me")!
    const settings = normalizeSettings({ ...preset.settings, density: 12, reach: 40, seed: 2222, ...patch })
    const me = createStroll(settings, settings.seed)
    const crowd = createThrong(settings, me)
    let catches = 0
    let was = false
    let stuck = 0
    let longestStuck = 0
    let escapedAfterCatch = false
    let samples = 0
    let inView = 0
    let apart = 0
    let sideways = 0
    let switches = 0
    let mode = ""
    for (let step = 0; step < 240 * 120; step++) {
      me.step(STEP, crowd)
      crowd.step(STEP)
      const runaway = crowd.quarry!
      if (crowd.caught && !was) catches++
      was = crowd.caught
      if (catches > 0 && !crowd.caught && crowd.stats().quarry > 6) escapedAfterCatch = true
      const trapped = !crowd.caught && runaway.preferred > 1 && Math.hypot(runaway.vx, runaway.vy) < 0.4
      stuck = trapped ? stuck + 1 : 0
      longestStuck = Math.max(longestStuck, stuck)
      if (step < 10 * 120 || step % 30 !== 0) continue
      samples++
      const wrap = (a: number) => Math.abs(Math.atan2(Math.sin(a), Math.cos(a)))
      const toThem = Math.atan2(runaway.y - me.y, runaway.x - me.x)
      if (wrap(toThem - me.yaw) < 0.54) inView++
      // Only while they are well off my line of travel, where the two ways to
      // look are different ways.
      if (wrap(toThem - me.course) > 0.35) {
        apart++
        const now = wrap(me.yaw - me.course) < 0.14 ? "ahead" : wrap(me.yaw - toThem) < 0.14 ? "them" : ""
        if (!now) sideways++
        else if (now !== mode) {
          if (mode) switches++
          mode = now
        }
      }
    }
    return {
      catches,
      escapedAfterCatch,
      longestStuck: longestStuck * STEP,
      inView: inView / samples,
      sideways: sideways / apart,
      switchesPerMinute: switches / 3.8,
    }
  }

  it("catches them, stands with them, and they get away again — never wrestling", () => {
    const run = chase({})
    expect(run.catches).toBeGreaterThan(0)
    expect(run.escapedAfterCatch).toBe(true)
    expect(run.longestStuck).toBeLessThan(2)
  })

  // They bolt from within arm's reach, so without a re-arm distance the next
  // step caught them again: 55 catches in four minutes on this seed.
  it("lets them get away before they can be caught again", () => {
    expect(chase({ seed: 31337 }).catches).toBeLessThan(10)
  })

  it("keeps them in sight most of the time, and only because of the chase", () => {
    // The control is the same chase at a quarter of the strength, where most
    // glances go the ordinary way.
    expect(chase({}).inView).toBeGreaterThan(0.65)
    expect(chase({ chase: 0.25 }).inView).toBeLessThan(0.6)
  })

  /**
   * "the head should face predominantly in one of 2 directions: direction of
   * travel, person being chased. We can't run looking sideways, so that means
   * the head turns much more often." Measured while they are off to one side:
   * resting the head part of the way toward them pointed it at neither 44% of
   * the time and switched six times a minute; the two-way gaze is 17%, the
   * turn itself, and 38 switches.
   */
  it("looks at the way or at them, not in between, and turns often", () => {
    const run = chase({})
    expect(run.sideways).toBeLessThan(0.3)
    expect(run.switchesPerMinute).toBeGreaterThan(20)
  })
})
