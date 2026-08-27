import { describe, expect, it } from "vitest"
import { TREMBLE_REACH, canopyTremble, gustEnvelope, scheduleGusts, type Gust } from "@/experiments/dangler/wind"

/**
 * The wind stays pure: gusts are derived from the clock and the seed rather than
 * accumulated, which is what makes them reproducible and checkable outside a
 * browser at all. A burst lasts about two seconds, so no still frame can tell
 * you one was ever scheduled — the rate, the determinism and the envelope are
 * the only things that can be checked.
 */

describe("scheduleGusts", () => {
  it("schedules nothing at rate 0", () => {
    const out: Gust[] = []
    scheduleGusts(7, 0, 0, out)
    expect(out).toEqual([])
  })

  it("arrives at about the requested rate, each gust exactly once", () => {
    const out: Gust[] = []
    const starts = new Set<number>()
    for (let t = 0; t < 600; t += 0.25) {
      scheduleGusts(7, t, 6, out)
      for (const gust of out) starts.add(Math.round(gust.start * 1000))
    }
    const expected = Math.floor(600 / (60 / 6))
    expect(Math.abs(starts.size - expected)).toBeLessThanOrEqual(2)
  })

  it("gives the same weather for the same seed and clock", () => {
    const first: Gust[] = []
    const second: Gust[] = []
    scheduleGusts(7, 123.4, 6, first)
    scheduleGusts(7, 123.4, 6, second)
    expect(second).toEqual(first)
  })

  it("gives different weather for a different seed", () => {
    const seven: Gust[] = []
    const eight: Gust[] = []
    scheduleGusts(7, 123.4, 6, seven)
    scheduleGusts(8, 123.4, 6, eight)
    expect(eight).not.toEqual(seven)
  })

  it("does not drop a gust from the schedule while it still matters", () => {
    // Leaving the scene calm forever is the symptom of expiring a gust that is
    // still in play.
    const out: Gust[] = []
    let calm = 0
    for (let t = 0; t < 300; t += 0.05) {
      scheduleGusts(7, t, 6, out)
      const strongest = Math.max(0, ...out.map((gust) => gustEnvelope(t - gust.start)))
      if (strongest < 0.02) calm += 0.05
    }
    expect(calm).toBeLessThan(300)
  })
})

describe("gustEnvelope", () => {
  it("is silent before the gust", () => {
    expect(gustEnvelope(-1)).toBe(0)
    expect(gustEnvelope(0)).toBe(0)
  })

  it("peaks at exactly 1, so `gust` means what it says", () => {
    // GUST_PEAK is sampled from this envelope at load rather than written down,
    // so retuning the attack or the decay must not silently rescale the control.
    const peak = Math.max(...Array.from({ length: 2000 }, (_, i) => gustEnvelope(i / 200)))
    expect(Math.abs(peak - 1)).toBeLessThan(0.005)
  })

  it("rises fast and falls slow, which is what makes it an event", () => {
    expect(gustEnvelope(0.35)).toBeGreaterThan(0.9)
    expect(gustEnvelope(3)).toBeLessThan(0.25)
    expect(gustEnvelope(8)).toBeLessThan(0.01)
  })
})

/**
 * `anchorOffsets` is a displacement, never a force, and that is the point. A
 * force integrates, so a wire under one sweeps steadily outward; an anchor that
 * moves drags its wire about by roughly its own travel and stops. That bound is
 * what lets a crowd be agitated without being blown apart.
 */
describe("canopyTremble", () => {
  const displaced = (x: number, y: number, t: number, amount: number) => {
    const out = { x: 0, y: 0, z: 0 }
    canopyTremble(x, y, t, amount, out)
    return out
  }

  it("is perfectly still at 0", () => {
    const out = displaced(0.3, -0.2, 4.2, 0)
    // Magnitudes rather than the components themselves: a term multiplied by 0
    // can come out as -0, which is perfectly still but is not `Object.is`-equal
    // to 0, and that is what `toEqual` compares with.
    expect([Math.abs(out.x), Math.abs(out.y), Math.abs(out.z)]).toEqual([0, 0, 0])
  })

  it("never exceeds its reach, however long it runs", () => {
    let worst = 0
    for (let t = 0; t < 200; t += 0.01) {
      const out = displaced(0.31, -0.22, t, 1)
      worst = Math.max(worst, Math.abs(out.x), Math.abs(out.y), Math.abs(out.z))
    }
    expect(worst).toBeLessThanOrEqual(TREMBLE_REACH + 1e-9)
    // And uses most of it, or the bound is met by doing nothing.
    expect(worst).toBeGreaterThan(TREMBLE_REACH * 0.5)
  })

  it("is deterministic", () => {
    expect(displaced(0.3, -0.2, 4.2, 0.7)).toEqual(displaced(0.3, -0.2, 4.2, 0.7))
  })

  it("moves neighbouring anchors differently", () => {
    // This is what makes it read as the observer being jostled rather than the
    // scene moving, and why `sway` exists as the coherent alternative.
    const here = displaced(0.3, -0.2, 4.2, 0.7)
    const there = displaced(0.9, 0.4, 4.2, 0.7)
    expect(Math.abs(here.x - there.x) > 1e-6 || Math.abs(here.y - there.y) > 1e-6).toBe(true)
  })

  it("runs well above a wire's own swing period", () => {
    // A hanging wire swings at well under 1Hz. An anchor shaken near that pumps
    // it instead of shivering it: 25mm of anchor travel once produced 0.43m of
    // tip travel. Counted here as sign changes — at least a few cycles a second.
    let crossings = 0
    let previous = 0
    for (let t = 0; t < 10; t += 0.002) {
      const { x } = displaced(0.31, -0.22, t, 1)
      if (previous !== 0 && Math.sign(x) !== Math.sign(previous)) crossings++
      previous = x
    }
    expect(crossings / 2 / 10).toBeGreaterThan(2)
  })
})
