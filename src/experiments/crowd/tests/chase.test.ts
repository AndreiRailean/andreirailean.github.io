import { describe, expect, it } from "vitest"
import { chaseSpell, createStroll, SPELL_AHEAD, SPELL_ON_THEM, type Neighbourhood } from "@/experiments/crowd/stroll"
import { createBoulders } from "@/experiments/crowd/boulders"
import { createPath } from "@/experiments/crowd/path"
import { createStalls } from "@/experiments/crowd/stalls"
import { normalizeSettings, type Settings } from "@/experiments/crowd/settings"
import { PRESETS } from "@/experiments/crowd/presets"
import type { Person } from "@/experiments/crowd/throng"
import { makeRng } from "@/experiments/random"
import { STEP, wrap } from "./support"

/**
 * The chaser: me, after the person in red.
 *
 * **These used to be chases through the market**, minutes of them, with the
 * person in red run by the throng — and every property here is mine, not
 * theirs or the crowd's. So the person in red is scripted, there is nobody
 * else, and what is measured is where my head and my feet go. What they do is
 * `runaway.test.ts` (#287).
 *
 * Every "break it" note below was done: the fault named was put back and the
 * test was seen to go red.
 */

const CATCH_ME = PRESETS.find((preset) => preset.label === "catch me")!

const quarry = (x: number, y: number): Person => ({ x, y, vx: 0, vy: 0, head: 1.6, headR: 0.1 }) as unknown as Person

/** Open ground with nobody on it but the one I am chasing. */
function alone(them: Person | null): Neighbourhood {
  const path = createPath(0, 1, 0, 0)
  return {
    neighbours: () => [],
    companions: [],
    halfWidth: Infinity,
    path,
    quarry: them,
    stalls: createStalls(0, 1, 0),
    boulders: createBoulders(0, 0, 0, path, Infinity, 0, 0),
    caught: false,
  }
}

const settingsFor = (patch: Partial<Settings>) => normalizeSettings({ ...CATCH_ME.settings, ...patch })

describe("a chaser's spells of looking", () => {
  const spells = (chase: number, run: number) => {
    const roll = makeRng(5)
    let onThem = true
    const out: { onThem: boolean; chaseGaze: boolean; spell: number }[] = []
    for (let i = 0; i < 20_000; i++) {
      const next = chaseSpell(onThem, chase, run, roll)
      onThem = next.onThem
      out.push(next)
    }
    return out
  }

  it("alternates them and the way ahead, every spell, and offers nothing in between", () => {
    const out = spells(1, 0)
    for (let i = 1; i < out.length; i++) expect(out[i]!.onThem).toBe(!out[i - 1]!.onThem)
    expect(out.every((s) => s.chaseGaze)).toBe(true)
    for (const s of out) {
      const [low, high] = s.onThem ? SPELL_ON_THEM : SPELL_AHEAD
      expect(s.spell).toBeGreaterThanOrEqual(low!)
      expect(s.spell).toBeLessThanOrEqual(high!)
    }
  })

  /**
   * "the head should face predominantly in one of 2 directions … that means the
   * head turns much more often." About a second a spell walking, so a turn every
   * second: the original measure was 38 switches a minute against six for a head
   * that rested part of the way toward them.
   */
  it("turns often, and more often at a run", () => {
    const mean = (xs: { spell: number }[]) => xs.reduce((a, s) => a + s.spell, 0) / xs.length
    const walking = mean(spells(1, 0))
    const running = mean(spells(1, 1))
    expect(60 / walking).toBeGreaterThan(40)
    expect(running / walking).toBeCloseTo(0.55, 2)
  })

  it("is the chase's only `chase` of the time, the rest going the ordinary way", () => {
    for (const chase of [0, 0.25, 0.75]) {
      const out = spells(chase, 0)
      const share = out.filter((s) => s.chaseGaze).length / out.length
      expect(Math.abs(share - chase)).toBeLessThan(0.015)
    }
  })
})

describe("the chaser's head", () => {
  /**
   * The person in red held 40° off my line, 8 m away, while I walk. The head
   * should spend its time on the way or on them, and not between — which a
   * head resting part of the way toward them did 44% of the time. Break it:
   * aiming the chase's look halfway toward them puts it between nearly always.
   */
  function gaze(patch: Partial<Settings>) {
    const settings = settingsFor(patch)
    const me = createStroll(settings, settings.seed)
    const them = quarry(0, 0)
    const crowd = alone(them)
    const OFF = (40 * Math.PI) / 180
    let samples = 0
    let ahead = 0
    let onThem = 0
    let between = 0
    let switches = 0
    let mode = ""
    for (let step = 0; step < 60 * 120; step++) {
      const bearing = me.course + OFF
      them.x = me.x + Math.cos(bearing) * 8
      them.y = me.y + Math.sin(bearing) * 8
      me.step(STEP, crowd)
      if (step < 5 * 120) continue
      samples++
      const toThem = Math.atan2(them.y - me.y, them.x - me.x)
      const now =
        Math.abs(wrap(me.yaw - me.course)) < 0.14 ? "ahead" : Math.abs(wrap(me.yaw - toThem)) < 0.14 ? "them" : ""
      if (now === "ahead") ahead++
      else if (now === "them") onThem++
      else between++
      if (now && now !== mode) {
        if (mode) switches++
        mode = now
      }
    }
    return {
      ahead: ahead / samples,
      onThem: onThem / samples,
      between: between / samples,
      perMinute: switches / (55 / 60),
    }
  }

  it("looks at the way or at them, not in between, and keeps them in sight because of the chase", () => {
    // Measured: on them 0.46, ahead 0.39, between 0.15, 57 turns a minute.
    const full = gaze({ chase: 1 })
    expect(full.between).toBeLessThan(0.3)
    expect(full.onThem).toBeGreaterThan(0.35)
    expect(full.perMinute).toBeGreaterThan(30)
    // The controls: a quarter of the chase (0.31 on them, 11 turns a minute)
    // and none (0.04), where glances go the ordinary way.
    const quarter = gaze({ chase: 0.25 })
    expect(quarter.onThem).toBeLessThan(full.onThem - 0.1)
    expect(quarter.perMinute).toBeLessThan(full.perMinute / 2)
    expect(gaze({ chase: 0 }).onThem).toBeLessThan(0.1)
  })
})

describe("caught", () => {
  /**
   * "if i catch them we can stand together for a little bit, then they run away
   * and I chase them again. tom and jerry style." My half of standing together:
   * I stop, and I look at them. Break it: ignoring `caught` in my wanted pace
   * keeps me walking and fails.
   */
  it("stops me beside them, looking at them", () => {
    const settings = settingsFor({ chase: 1 })
    const me = createStroll(settings, settings.seed)
    const them = quarry(0, 0)
    const crowd = alone(them)
    // A few seconds of chasing them along +x.
    for (let step = 0; step < 3 * 120; step++) {
      them.x = me.x + 6
      them.y = 0
      me.step(STEP, crowd)
    }
    // They are a little ahead and to my left: I take a step or two to stop.
    them.x = me.x + Math.cos(me.course + 0.4) * 3
    them.y = me.y + Math.sin(me.course + 0.4) * 3
    const caught = { ...crowd, caught: true }
    let speed = Infinity
    let lastX = me.x
    let lastY = me.y
    for (let step = 0; step < 2 * 120; step++) {
      me.step(STEP, caught)
      speed = Math.hypot(me.x - lastX, me.y - lastY) / STEP
      lastX = me.x
      lastY = me.y
    }
    expect(speed).toBeLessThan(0.05)
    const toThem = Math.atan2(them.y - me.y, them.x - me.x)
    expect(Math.abs(wrap(me.yaw - toThem))).toBeLessThan(0.15)
  })
})

describe("the chaser's feet", () => {
  /**
   * Nobody walks through a stall, least of all me, which is what makes a
   * straight line to them impossible. The hardest case is built rather than
   * waited for: they are standing in the middle of one, so everything that
   * steers me — their trail, their head — points into it. Break it: dropping
   * the stalls' push from my step walks me in.
   */
  it("is stopped by a stall, even with them standing inside it", () => {
    const stalls = createStalls(0.5, 3, 4)
    let target: { x: number; y: number } | null = null
    for (let r = 4; r < 30 && !target; r += 0.5) {
      for (let a = 0; a < Math.PI / 2 && !target; a += 0.05) {
        const x = Math.cos(a) * r
        const y = Math.sin(a) * r
        if (stalls.blocked(x, y, -0.8)) target = { x, y }
      }
    }
    expect(target).not.toBeNull()
    const settings = settingsFor({ chase: 1, stalls: 0.5, aisle: 3, boulders: 0 })
    const me = createStroll(settings, settings.seed)
    const them = quarry(target!.x, target!.y)
    const crowd = { ...alone(them), stalls }
    let inside = 0
    let nearest = Infinity
    for (let step = 0; step < 15 * 120; step++) {
      me.step(STEP, crowd)
      if (stalls.blocked(me.x, me.y, 0)) inside++
      nearest = Math.min(nearest, Math.hypot(them.x - me.x, them.y - me.y))
    }
    expect(inside).toBe(0)
    // And I did try: I got up against it.
    expect(nearest).toBeLessThan(Math.hypot(target!.x, target!.y) / 2)
  })

  /**
   * **I follow their trail, not their head.** Walking straight at them made
   * them a crosshair — "they're almost always in front, which makes them
   * appear like a center marker on a camera screen" — so where I mean to walk
   * turns toward the oldest place I noted them that I have not reached. Here
   * they run down +x and turn a corner up +y at x = 20; I should go to the
   * corner rather than cut across. Break it: aiming at where they are now
   * turns me off the x axis seconds before the corner and fails.
   */
  it("goes round the corner they went round, rather than cutting across to them", () => {
    const settings = settingsFor({ chase: 1 })
    const me = createStroll(settings, settings.seed)
    const them = quarry(6, 0)
    const crowd = alone(them)
    let worst = 0
    let reached = 0
    for (let step = 0; step < 25 * 120; step++) {
      const t = step * STEP
      const run = 6 + 2.4 * t
      them.x = Math.min(20, run)
      them.y = Math.max(0, run - 20)
      me.step(STEP, crowd)
      // Before the corner, while they are well round it.
      if (me.x < 15 && them.y > 4) worst = Math.max(worst, Math.abs(me.y))
      if (me.x > 18 && me.y > 3) reached++
    }
    expect(worst).toBeLessThan(1)
    // And I do go round it after them.
    expect(reached).toBeGreaterThan(0)
  })
})
