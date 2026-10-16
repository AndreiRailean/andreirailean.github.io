import { describe, expect, it } from "vitest"
import { createLoop, createPath, hikingPace, lanePush } from "@/experiments/crowd/path"
import { createStroll, type Neighbourhood } from "@/experiments/crowd/stroll"
import { createThrong, teamSlots } from "@/experiments/crowd/throng"
import { normalizeSettings, type Settings } from "@/experiments/crowd/settings"
import { PRESETS } from "@/experiments/crowd/presets"

/**
 * The structured crowd: a lining that stands, a way that bends, teams, a hill,
 * sides of the way, a run, a chase.
 *
 * **Each of these asserts that a mechanism fired**, not that the scene ran.
 * A lining nobody is placed in, a bend nobody follows and a team size that
 * never forms all leave a scene that renders perfectly well — which is the
 * class `docs/agents/experiment-writer.md` warns about under _Measure before
 * you look_.
 *
 * **And each is the smallest thing that can show it** (#287). Where the
 * property is one function's — Tobler's pace, the lane push, my team's places
 * — that function is checked directly; what is left in the throng is a few
 * seconds showing the throng calls it. Where it is mine — my gait, my course
 * round a loop, my glances at a run — I walk the scene's own way with nobody
 * else on it. The chase's decisions are `runaway.test.ts` and
 * `chase.test.ts`; this file used to chase for minutes, 81 s of the unit job.
 *
 * Every "break it" note below was done: the fault named was put back and the
 * test was seen to go red.
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

/**
 * Me, walking a scene's own way with nobody else on it. The throng is built
 * for its way and its ground and never stepped; what I am handed is that, and
 * no people.
 */
function me(label: string, patch: Partial<Settings>, seconds: number) {
  const preset = PRESETS.find((p) => p.label === label)!
  const settings = normalizeSettings({ ...preset.settings, ...patch })
  const walker = createStroll(settings, settings.seed)
  const throng = createThrong(settings, walker)
  const empty: Neighbourhood = {
    neighbours: () => [],
    companions: [],
    halfWidth: throng.halfWidth,
    path: throng.path,
    quarry: null,
    stalls: throng.stalls,
    boulders: throng.boulders,
    caught: false,
  }
  const bias = (settings.pitch * Math.PI) / 180
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
  let n = 0
  let running = 0
  let low = Infinity
  let high = -Infinity
  let lateral = 0
  let absLateral = 0
  let maxAbsLateral = 0
  let turned = 0
  let fastestTurn = 0
  let wide = 0
  let steep = 0
  let last = walker.course
  for (let step = 0; step < seconds * 120; step++) {
    walker.step(STEP, empty)
    const d = wrap(walker.course - last)
    last = walker.course
    if (step < 5 * 120) continue
    n++
    if (walker.stats().running) running++
    const z = walker.eye().z
    low = Math.min(low, z)
    high = Math.max(high, z)
    const lat = throng.path.lateral(walker.x, walker.y)
    lateral += lat
    absLateral += Math.abs(lat)
    maxAbsLateral = Math.max(maxAbsLateral, Math.abs(lat))
    turned += d
    fastestTurn = Math.max(fastestTurn, Math.abs(d / STEP))
    if (Math.abs(wrap(walker.yaw - walker.course)) > (25 * Math.PI) / 180) wide++
    if (Math.abs(walker.pitch - bias) > (10 * Math.PI) / 180) steep++
  }
  return {
    running: running / n,
    bounce: high - low,
    meanLateral: lateral / n,
    meanAbsLateral: absLateral / n,
    maxAbsLateral,
    halfWidth: throng.halfWidth,
    turned,
    fastestTurn,
    wide: wide / n,
    steep: steep / n,
  }
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

  /**
   * "A companion behind you provides no reference, because you cannot see
   * them" — so my own team is a block with me in the middle of its back row.
   * This was six seconds of the teams scene; it is one function. Break it:
   * putting me in the front row (`row: 0`) sends most of them behind me and
   * fails.
   */
  it("puts me at the back of a team of my own, with nobody behind me, at every size", () => {
    for (let mates = 4; mates <= 15; mates++) {
      const slots = teamSlots(mates)
      expect(slots.length).toBe(mates)
      for (const [, ahead] of slots) expect(ahead).toBeGreaterThanOrEqual(0)
      expect(slots.filter(([, ahead]) => ahead > 0.5).length).toBeGreaterThan(mates / 2)
    }
  })

  it("stands my team in those places from the first frame", () => {
    const { crowd, settings } = walk("teams", 0)
    expect(settings.companions).toBeGreaterThan(3)
    const places = crowd.companions.map((mate) => [mate.besideRight, mate.besideAhead])
    expect(places).toEqual(teamSlots(settings.companions).map(([right, ahead]) => [right, ahead]))
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
   * Tobler's hiking function, relative to level ground. Its fastest point is a
   * gentle descent of 5%, and it is asymmetric: climbing 25% is about 0.42 of
   * level pace, descending it about 0.59.
   */
  it("slows a climb more than the same descent, and does nothing at effort 0", () => {
    for (const grade of [-0.3, -0.1, 0, 0.1, 0.3]) expect(hikingPace(grade, 0)).toBe(1)
    expect(hikingPace(0, 1)).toBeCloseTo(1, 9)
    expect(hikingPace(-0.05, 1)).toBeGreaterThan(1)
    expect(hikingPace(0.25, 1)).toBeCloseTo(0.42, 2)
    expect(hikingPace(-0.25, 1)).toBeCloseTo(0.59, 2)
    expect(hikingPace(0.25, 0.5)).toBeCloseTo(1 + 0.5 * (hikingPace(0.25, 1) - 1), 9)
  })

  /**
   * The concertina: a crowd walking a hill by Tobler's function bunches on the
   * climbs, because it slows on them. This was ninety seconds of the trail
   * counting heads on climbs against descents; what it needs to show is that
   * the throng applies the pace at all, which three seconds does: walkers on a
   * climb move at 0.52 of their pace with it and 0.94 without. Break it:
   * dropping `hikingPace` from the throng's wanted velocity fails.
   */
  it("is what the crowd walks a climb at", () => {
    const climbing = (effort: number) => {
      const preset = PRESETS.find((p) => p.label === "the trail")!
      const settings = normalizeSettings({ ...preset.settings, effort })
      const walker = createStroll(settings, settings.seed)
      const crowd = createThrong(settings, walker)
      let pace = 0
      let n = 0
      for (let step = 0; step < 3 * 120; step++) {
        walker.step(STEP, crowd)
        crowd.step(STEP)
        if (step < 2 * 120 || step % 30 !== 0) continue
        for (const p of crowd.people) {
          if (p.watcher || p.standing || p.companion) continue
          const speed = Math.hypot(p.vx, p.vy)
          if (speed < 0.3 || (crowd.path.groundSlope(p.x) * p.vx) / speed <= 0.1) continue
          pace += speed / p.preferred
          n++
        }
      }
      expect(n).toBeGreaterThan(100)
      return pace / n
    }
    expect(climbing(0)).toBeGreaterThan(0.85)
    expect(climbing(1)).toBeLessThan(0.65)
  })
})

describe("keeping to a side", () => {
  it("pushes toward my side of the way, the oncoming the other, mirrored by sign, and not on open ground", () => {
    const half = 3
    // From the middle of the way: walking with me (along +1) is pushed left
    // at keep 1, oncoming right, and keep −1 mirrors.
    expect(lanePush(0, half, 1, 1)).toBeGreaterThan(0)
    expect(lanePush(0, half, -1, 1)).toBeLessThan(0)
    expect(lanePush(0, half, 1, -1)).toBeLessThan(0)
    // At rest on their own side, a quarter of the way across.
    expect(lanePush(half * 0.5, half, 1, 1)).toBeCloseTo(0, 9)
    expect(lanePush(-half * 0.5, half, -1, 1)).toBeCloseTo(0, 9)
    expect(lanePush(0, half, 1, 0)).toBe(0)
    expect(lanePush(0, Infinity, 1, 1)).toBe(0)
    // Stronger the more `keep` there is.
    expect(lanePush(0, half, 1, 1)).toBeCloseTo(2 * lanePush(0, half, 1, 0.5), 9)
  })

  /**
   * The share of walkers on their own side of the way, against the same scene
   * at `keep` 0 — 0.49, random — so a lane force that stopped doing anything
   * fails rather than passing on the seed's luck. Three seconds is enough to
   * see the sorting under way: 0.74 and 0.79 at keep 1, 0.18 mirrored. This
   * was twenty-five seconds, three times over. Break it: dropping `lanePush`
   * from the throng fails.
   */
  function sides(keep: number) {
    const preset = PRESETS.find((p) => p.label === "keep left")!
    const settings = normalizeSettings({ ...preset.settings, keep })
    const walker = createStroll(settings, settings.seed)
    const crowd = createThrong(settings, walker)
    let withMe = 0
    let withMeLeft = 0
    let oncoming = 0
    let oncomingRight = 0
    for (let step = 0; step < 3 * 120; step++) {
      walker.step(STEP, crowd)
      crowd.step(STEP)
      if (step % 60 !== 0) continue
      for (const person of crowd.people) {
        if (Math.hypot(person.x - walker.x, person.y - walker.y) > 40) continue
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
    return { withMe: withMeLeft / withMe, oncoming: oncomingRight / oncoming }
  }

  it("sorts the crowd onto its sides, and mirrors when told to keep right", () => {
    const off = sides(0)
    const on = sides(1)
    const right = sides(-1)
    expect(off.withMe).toBeLessThan(0.6)
    expect(off.oncoming).toBeLessThan(0.6)
    expect(on.withMe).toBeGreaterThan(0.65)
    expect(on.oncoming).toBeGreaterThan(0.65)
    expect(right.withMe).toBeLessThan(0.3)
    expect(right.oncoming).toBeLessThan(0.3)
  })

  it("keeps me on my side too", () => {
    expect(me("keep left", { keep: 1 }, 10).meanLateral).toBeGreaterThan(0.5)
    expect(me("keep left", { keep: -1 }, 10).meanLateral).toBeLessThan(-0.5)
  })
})

describe("the runner", () => {
  /**
   * "i can increase my pace … but not enough to make it feel like a jog. maybe
   * because my bobbing is still walk-like." Both were true: the track stopped at
   * 2.2 m/s, which is the walk-run transition, and the bob was a walk's at any
   * speed. So this asserts the gait, not the pace — and the gait is mine, so it
   * is run on the runner's way with nobody else on it. Not running into people
   * is the avoidance, which `steering.test.ts` checks.
   */
  it("runs, bouncing twice as far as a walk, down the middle", () => {
    const runner = me("runner", {}, 20)
    expect(runner.running).toBeGreaterThan(0.95)
    expect(runner.bounce).toBeGreaterThan(0.065)
    expect(runner.meanAbsLateral).toBeLessThan(0.5)
  })

  it("walks, with a walk's bob, at a walking pace", () => {
    const walker = me("runner", { walk: 1.3 }, 12)
    expect(walker.running).toBe(0)
    expect(walker.bounce).toBeLessThan(0.055)
  })
})

describe("the chase, wired", () => {
  /**
   * What the person in red decides is `runaway.test.ts`, and what I do about it
   * is `chase.test.ts`. This is that the throng hands both the real ground:
   * twenty seconds among boulders is enough for the gap to open and close and
   * for them to get behind one (at 11.8 s on this seed), and I never walk into
   * a boulder doing it. It replaces four tests that chased for two to four
   * minutes each.
   */
  it("runs a chase among boulders: the gap opens and closes, they hide, and I go round", () => {
    const preset = PRESETS.find((p) => p.label === "catch me")!
    const settings = normalizeSettings({ ...preset.settings, density: 12, reach: 40 })
    const walker = createStroll(settings, settings.seed)
    const crowd = createThrong(settings, walker)
    let hid = false
    let low = Infinity
    let high = 0
    let inside = 0
    for (let step = 0; step < 20 * 120; step++) {
      walker.step(STEP, crowd)
      crowd.step(STEP)
      if (crowd.stats().hiding) hid = true
      if (crowd.boulders.inside(walker.x, walker.y) > 0.3) inside++
      if (step < 5 * 120 || step % 60 !== 0) continue
      low = Math.min(low, crowd.stats().quarry)
      high = Math.max(high, crowd.stats().quarry)
    }
    expect(crowd.boulders.active).toBe(true)
    expect(crowd.quarry).not.toBeNull()
    expect(hid).toBe(true)
    expect(high - low).toBeGreaterThan(4)
    expect(high).toBeLessThan(35)
    expect(inside).toBe(0)
  })

  /**
   * **The stalls scene, pinned.** `catch me` walks among boulders now, but the
   * stalls are still reachable through addresses that name them — the
   * showcase's `catch me` among them. Nobody walks through a stall, least of
   * all me, which is what makes a straight line to them impossible.
   */
  it("runs a chase through the stalls, and nobody walks through one", () => {
    const preset = PRESETS.find((p) => p.label === "catch me")!
    const settings = normalizeSettings({
      ...preset.settings,
      stalls: 0.5,
      aisle: 3,
      boulders: 0,
      density: 12,
      reach: 40,
    })
    const walker = createStroll(settings, settings.seed)
    const crowd = createThrong(settings, walker)
    let trespass = 0
    let crowdIn = 0
    let crowdN = 0
    let low = Infinity
    let high = 0
    for (let step = 0; step < 15 * 120; step++) {
      walker.step(STEP, crowd)
      crowd.step(STEP)
      if (crowd.stalls.blocked(walker.x, walker.y, 0)) trespass++
      if (step % 600 === 0) {
        for (const person of crowd.people) {
          crowdN++
          if (crowd.stalls.blocked(person.x, person.y, 0)) crowdIn++
        }
      }
      if (step < 5 * 120 || step % 60 !== 0) continue
      low = Math.min(low, crowd.stats().quarry)
      high = Math.max(high, crowd.stats().quarry)
    }
    expect(crowd.stalls.active).toBe(true)
    expect(trespass).toBe(0)
    expect(crowdIn / crowdN).toBeLessThan(0.02)
    expect(high - low).toBeGreaterThan(2)
  })

  it("has nobody in red when there is nothing to chase", () => {
    const { crowd } = walk("market", 0)
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
   * The run has to go round, not merely stay on a curve, so the turning is
   * checked by sign as well as size: a loop turns one way and a street that
   * bends turns both. It is my course, so it is run on the loop with nobody
   * else on it.
   */
  it("takes me round it, always turning the same way, smoothly, on the way", () => {
    const run = me("loop run", {}, 40)
    // Thirty-five seconds at 3 m/s is about a sixth of a 700 m lap: some 50° of left turn.
    expect(run.turned).toBeGreaterThan(0.6)
    expect(run.fastestTurn).toBeLessThan(0.6)
    expect(run.maxAbsLateral).toBeLessThan(run.halfWidth)
  })

  it("brings my companions", () => {
    expect(walk("loop run", 0).crowd.stats().companions).toBe(3)
  })
})

describe("glancing at a run", () => {
  /**
   * "Current glancing model breaks the loop running illusion because it appears
   * like a distracted child is about to fall over." The same way walked and
   * run, so the comparison is the gait alone: measured on the loop, running
   * took wide head turns from 19.5% of the time to 4.7% and glances up or down
   * from 10% to under 1%. The head is mine, so it is run with nobody else on
   * the loop; what a glance is about at a run is `glanceKind` in
   * `stroll.test.ts`.
   */
  it("keeps a runner's eyes on the way ahead", () => {
    const walking = me("loop run", { walk: 1.3 }, 60)
    const running = me("loop run", { walk: 3 }, 60)
    expect(running.wide).toBeLessThan(walking.wide * 0.5)
    expect(running.steep).toBeLessThan(0.02)
    expect(walking.steep).toBeGreaterThan(running.steep * 3)
  })
})
