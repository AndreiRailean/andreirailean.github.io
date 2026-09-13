import { describe, expect, it } from "vitest"

import { makeRng } from "@/experiments/random"
import { lap, pickInterval, playSpan } from "@/showcase/viewer"

/**
 * What `?play` asks for, and the order a shuffled wall plays in.
 *
 * All of it is numbers in and numbers out, so it lives here rather than in
 * `tests/showcase-autoplay.spec.ts` — which drives a real wall and cannot
 * enumerate a dozen malformed values, or run a thousand laps, without costing a
 * page load each. The browser suite keeps the two claims a page is needed for:
 * that the wall actually steps, and that a shuffled one does not repeat within
 * the first few entries.
 *
 * The module imports cleanly under node because nothing in it touches a DOM
 * until `mountViewer` is called.
 */

describe("playSpan", () => {
  it("is off when nobody asked", () => {
    // The default every shared link inherits. A wall that walked away from the
    // scene it was sent for would make every address on the site a lie.
    expect(playSpan(null)).toEqual({ min: 0, max: 0 })
  })

  it("takes the default when `?play` carries no number", () => {
    expect(playSpan("")).toEqual({ min: 30_000, max: 30_000 })
  })

  it("takes seconds, because that is the unit a room is described in", () => {
    expect(playSpan("45")).toEqual({ min: 45_000, max: 45_000 })
  })

  it("takes a range, which is what makes an interval vary at all", () => {
    expect(playSpan("20-45")).toEqual({ min: 20_000, max: 45_000 })
  })

  it("sorts a range written backwards rather than failing on it", () => {
    // Nobody's mistake worth a frozen kiosk.
    expect(playSpan("45-20")).toEqual({ min: 20_000, max: 45_000 })
  })

  it("is off when told so out loud", () => {
    // `?play=0` is how a kiosk's address gets autoplay switched off without
    // being rewritten, which is the only reason it is spelled at all.
    expect(playSpan("0")).toEqual({ min: 0, max: 0 })
    expect(playSpan("-10")).toEqual({ min: 0, max: 0 })
  })

  it("floors an interval too short to mount a piece in, at both ends", () => {
    // Below this the wall tears down a canvas it has only just built, and a
    // prefetch that has not landed means every entry fails to load.
    expect(playSpan("0.01")).toEqual({ min: 1000, max: 1000 })
    expect(playSpan("0.01-0.02")).toEqual({ min: 1000, max: 1000 })
  })

  it("reads an unreadable number as on rather than off", () => {
    // The failure that matters is silent: a kiosk showing one frozen scene all
    // week looks exactly like a kiosk nobody configured.
    expect(playSpan("thirty")).toEqual({ min: 30_000, max: 30_000 })
    expect(playSpan("20-forty")).toEqual({ min: 30_000, max: 30_000 })
  })
})

describe("pickInterval", () => {
  const rng = makeRng(1)

  it("is exact when the span has no width, so `?play=30` means thirty", () => {
    // A range is opt-in. Jitter nobody asked for would make every existing
    // address drift.
    expect(pickInterval({ min: 30_000, max: 30_000 }, rng)).toBe(30_000)
  })

  it("stays inside the range, and does not sit at one end of it", () => {
    const span = { min: 20_000, max: 45_000 }
    const draws = Array.from({ length: 500 }, () => pickInterval(span, rng))

    expect(Math.min(...draws)).toBeGreaterThanOrEqual(span.min)
    expect(Math.max(...draws)).toBeLessThanOrEqual(span.max)

    // The claim that makes the feature worth having: it actually varies, and
    // over most of the range rather than in a corner of it. A generator stuck
    // at a constant would satisfy the bounds above perfectly.
    expect(Math.max(...draws) - Math.min(...draws)).toBeGreaterThan(20_000)
  })

  it("is zero for a span that is off, so a caller cannot schedule one", () => {
    expect(pickInterval({ min: 0, max: 0 }, rng)).toBe(0)
  })
})

describe("lap", () => {
  const rng = makeRng(7)

  it("is a permutation: every entry once, none twice, none missed", () => {
    // The property that makes a lap better than a random jump. Uniform picks
    // repeat about one step in twenty-four on this wall and cluster visibly
    // over an evening — more repetitive than the fixed order it replaces.
    const order = lap(24, rng)
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: 24 }, (_, index) => index))
  })

  it("is not the curated order", () => {
    const order = lap(24, rng)
    expect(order).not.toEqual(Array.from({ length: 24 }, (_, index) => index))
  })

  it("differs between seeds, or two kiosks side by side would play in step", () => {
    expect(lap(24, makeRng(1))).not.toEqual(lap(24, makeRng(2)))
  })

  it("never opens on the entry already showing", () => {
    // The seam between two laps is the one place a repeat can hide, and it is
    // the most visible one there is: the same scene twice in a row.
    for (let seed = 0; seed < 300; seed++) {
      for (const after of [0, 5, 23]) {
        expect(lap(24, makeRng(seed), after)[0]).not.toBe(after)
      }
    }
  })

  it("survives a wall too short to shuffle", () => {
    // `schedulePlay` refuses to run on a wall of one, but nothing here should
    // depend on that being true somewhere else.
    expect(lap(1, rng, 0)).toEqual([0])
    expect(lap(0, rng)).toEqual([])
  })
})
