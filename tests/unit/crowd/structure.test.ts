import { describe, expect, it } from "vitest"
import { createPath } from "@/experiments/crowd/path"
import { createStroll } from "@/experiments/crowd/stroll"
import { createThrong } from "@/experiments/crowd/throng"
import { normalizeSettings, PRESETS } from "@/experiments/crowd/settings"

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
    const along = Math.atan(crowd.path.slope(me.x))
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
      const along = Math.atan(crowd.path.slope(person.x))
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
      if (Math.abs(Math.atan(crowd.path.slope(person.x))) < 0.3) continue
      sum += Math.abs(crowd.path.lateral(person.x, person.y)) / crowd.halfWidth
      n++
    }
    expect(n).toBeGreaterThan(100)
    expect(sum / n).toBeLessThan(0.55)
  })
})
