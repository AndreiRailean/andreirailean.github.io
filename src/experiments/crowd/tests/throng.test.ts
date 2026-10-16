import { describe, expect, it } from "vitest"
import { createStroll } from "@/experiments/crowd/stroll"
import { createThrong, MAX_PEOPLE } from "@/experiments/crowd/throng"
import { entryAngle } from "@/experiments/crowd/random"
import { normalizeSettings } from "@/experiments/crowd/settings"
import { PRESETS } from "@/experiments/crowd/presets"
import { makeRng } from "@/experiments/random"
import { walk } from "./support"

/**
 * The crowd as a population: how big it is, and where somebody who leaves it
 * comes back in.
 *
 * **These used to be two-minute walks of the market** — a population that
 * holds, a crowd that stays uniform round the observer, a re-entry rate — at
 * 77, 82 and 28 seconds (#287). Each is a property of one decision: `restock`
 * says how many, and `entryAngle` says where a leaver comes back. So
 * `entryAngle` is checked as the function it is, and the population in a world
 * small enough that everybody leaves it every few seconds.
 */

describe("where somebody comes back in", () => {
  const rng = makeRng(5)
  const samples = (ux: number, uy: number, n = 40_000) => Array.from({ length: n }, () => entryAngle(rng, ux, uy))

  it("puts them on the side they would have come from, walking in", () => {
    // **Inward, always.** Somebody re-entered on the side they are already
    // leaving is re-entered again at once: a uniform angle did that to half of
    // them, 335 re-entries a second against 142 — and in a world sized by
    // `reach`, the crowd stopped keeping up and the outer rings spread 1.36
    // against 1.01. Break it: `return rng() * Math.PI * 2` sends half outward.
    for (const [ux, uy] of [
      [1.4, 0],
      [-0.3, 1.1],
      [0, -2],
    ] as const) {
      const outward = samples(ux, uy).filter((a) => Math.cos(a) * ux + Math.sin(a) * uy > 1e-9).length
      expect(outward).toBe(0)
    }
  })

  it("weights the entry by how fast a uniform crowd crosses each part of the boundary", () => {
    // The rate a uniform crowd crosses a boundary element is its density times
    // the inward component of velocity, so entries are distributed as `cos`
    // about the direction the person comes from. That is what keeps the crowd
    // they enter uniform. Six bins either side, against the cosine's share.
    const from = Math.atan2(-0, -1.4)
    const BINS = 12
    const counts = new Array<number>(BINS).fill(0)
    const all = samples(1.4, 0)
    for (const angle of all) {
      const delta = Math.atan2(Math.sin(angle - from), Math.cos(angle - from))
      counts[Math.min(BINS - 1, Math.floor(((delta + Math.PI / 2) / Math.PI) * BINS))]!++
    }
    for (let bin = 0; bin < BINS; bin++) {
      const low = -Math.PI / 2 + (bin * Math.PI) / BINS
      const expected = (Math.sin(low + Math.PI / BINS) - Math.sin(low)) / 2
      expect(counts[bin]! / all.length).toBeCloseTo(expected, 2)
    }
  })

  it("has no preferred side for somebody keeping pace with me", () => {
    // Nobody moving relative to the observer crosses the boundary at all, so
    // every angle is as good as another.
    const all = samples(0, 0)
    const ahead = all.filter((a) => Math.cos(a) > 0).length / all.length
    expect(ahead).toBeCloseTo(0.5, 1)
  })
})

describe("the world travels with the observer", () => {
  it("holds its population inside the world, step after step", () => {
    // **A drain looks exactly like an ordinary thinning crowd** and is
    // invisible in any single frame. In a world of reach 8, walking at 1.6 m/s
    // with everybody streaming at me, the whole crowd leaves and comes back
    // every few seconds, so a population that would drain over a long walk
    // drains here at once. Counted inside the world, not as the length of an
    // array the leavers stay in. Break it: return from `reenter` before moving
    // anybody, and the count inside falls within a second.
    const { me, crowd, run } = walk({ reach: 8, walk: 1.6, pausing: 0, density: 40, stream: 1, against: 1 }, 0)
    const stats = crowd.stats()
    const wanted = Math.min(MAX_PEOPLE, Math.round((40 / 100) * Math.PI * stats.world * stats.world))
    expect(stats.people).toBe(wanted)
    let lowest = Infinity
    for (let t = 0; t < 20; t += 0.5) {
      run(0.5)
      const world = crowd.stats().world
      const inside = crowd.people.filter((p) => Math.hypot(p.x - me.x, p.y - me.y) <= world + 0.5).length
      lowest = Math.min(lowest, inside)
    }
    expect(crowd.stats().people).toBe(wanted)
    expect(lowest / wanted).toBeGreaterThan(0.97)
    // And it was a walk: the observer went somewhere, through the crowd.
    expect(Math.hypot(me.x, me.y)).toBeGreaterThan(20)
  })

  it("is a different crowd at another seed, and the same crowd at the same one", () => {
    // What a re-roll is for. `crowd.spec.ts` checks the page passes the seed
    // through; this checks the seed is what decides who is there.
    const cast = (seed: number) => {
      const settings = normalizeSettings({ ...PRESETS[0]!.settings, reach: 12, seed })
      const crowd = createThrong(settings, createStroll(settings, settings.seed))
      return crowd.people.map((p) => [p.x, p.y])
    }
    expect(cast(4242)).toEqual(cast(4242))
    expect(cast(4242)).not.toEqual(cast(4243))
  })

  it("sizes the world from reach, whatever the fade is", () => {
    // **`fade` does not size the world any more**, and this is the check that
    // says so: ask for a reach the budget affords and you get exactly it, at any
    // fade. The two used to be one number, which made a long view and a dense
    // crowd mutually exclusive and paid for depth by washing out the near
    // layers — "distance appears to introduce linear fog".
    for (const fade of [12, 72]) {
      const { crowd } = walk({ density: 6, reach: 80, width: 250, fade }, 0)
      expect(crowd.stats().world).toBeCloseTo(80, 6)
      expect(crowd.stats().budgeted).toBe(false)
    }

    // And when it cannot be afforded, that is reported rather than silent.
    const dense = walk({ density: 100, reach: 250, width: 250 }, 0)
    expect(dense.crowd.stats().budgeted).toBe(true)
    expect(dense.crowd.stats().world).toBeLessThan(250)
  })

  it("affords a corridor the reach a disc never could", () => {
    // **The affordable radius is bisected over the real ground**, not solved for
    // a disc. A 7 m street holds a fiftieth of the people a disc of the same
    // radius does, so the disc formula clamped a street to a fraction of the
    // reach it could easily afford — the difference between a street that
    // recedes and one that stops just ahead.
    const open = walk({ density: 45, reach: 220, width: 250 }, 0)
    // Three seconds in, not at t = 0. `regroup` puts a group's members beside
    // their leader without asking where the walls are, so a leader walking near
    // one starts with a companion just outside it — 40 people out of 1,386. The
    // wall force is what deals with that, and asserting after it has had a
    // moment tests the placement *and* the wall rather than only the placement.
    const street = walk({ density: 45, reach: 220, way: true, width: 7 }, 3)
    expect(open.crowd.stats().budgeted).toBe(true)
    expect(street.crowd.stats().world).toBeCloseTo(220, 6)
    expect(street.crowd.stats().budgeted).toBe(false)

    // And it is a corridor rather than a disc with a stripe painted on it.
    // Sampling used to *clamp* into the corridor, which stacks everybody outside
    // it onto the two boundary lines: 96% of the crowd on two lines with nothing
    // between them, and 33 heads on screen out of 632.
    const inside = street.crowd.people.filter((p) => Math.abs(p.y) <= 3.5)
    expect(inside.length).toBe(street.crowd.people.length)
    // Uniform across the corridor, not piled on its walls: the middle half of
    // the width should hold about half of them.
    const middle = street.crowd.people.filter((p) => Math.abs(p.y) <= 1.75).length
    expect(middle / street.crowd.people.length).toBeGreaterThan(0.4)
    expect(middle / street.crowd.people.length).toBeLessThan(0.6)
  })

  it("keeps every shipped scene short of a wall of heads", () => {
    // `edge` is how bright a head at the boundary still is. **This threshold is
    // a backstop and not a claim.** Whether a crowd looks like it ends is a
    // visual question that no number here can see; what was actually done is
    // that 0.076 and 0.108 were looked at, and neither shows a wall, because the
    // far heads are sub-pixel and have merged into the band long before the
    // boundary reaches them.
    //
    // It used to be 0.03, from when the edge sat wherever the budget put it and
    // had to be hidden. `reach` is a control now, and a crowd that visibly ends
    // is a thing somebody may want to build.
    for (const preset of PRESETS) {
      const settings = normalizeSettings(preset.settings)
      const me = createStroll(settings, settings.seed)
      const crowd = createThrong(settings, me)
      const { edge, world } = crowd.stats()
      expect(edge, `${preset.label} ends at ${(edge * 100).toFixed(1)}% brightness`).toBeLessThan(0.25)
      // Derived rather than restated, so a change to how the world is sized has
      // to survive the arithmetic as well as the threshold.
      expect(edge).toBeCloseTo(Math.exp(-world / settings.fade), 9)
    }
  })
})
