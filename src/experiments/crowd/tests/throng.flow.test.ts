import { describe, expect, it } from "vitest"
import { CUTOFF } from "@/experiments/crowd/steering"
import { DETAIL, detailFor } from "@/experiments/crowd/throng"
import { BOUNDS } from "@/experiments/crowd/settings"
import { STEP, walk } from "./support"

/**
 * Nobody walks through anybody where it can be seen.
 *
 * This used to be a forty-second walk of the market (64 s, #287). What it
 * checks is the level of detail: past the detail radius nobody avoids anybody,
 * and that is only safe if what the far crowd carries in is resolved before it
 * is close enough to see. So the scene is a crowd just wider than the detail
 * radius, which is all that needs.
 *
 * **The counterflow test that lived here is gone, because it could not see
 * what it claimed.** It read how often a walker's six nearest neighbours go
 * the same way, before and after two minutes. Measured on 2026-10-16: at the
 * market's size it rose 0.485 → 0.597 with the avoidance as shipped and
 * 0.501 → 0.565 with `spacing` at its floor of 0.3 (a tenth of the force), and
 * both pass its `+0.05`; in a world of reach 16 to 20 the weakened crowd
 * scores *higher* than the real one, on that statistic and on a lateral-only
 * version of it. So it was measuring where re-entered walkers land, mostly,
 * and not files. A test that can tell files from that needs a design — a world
 * with no boundary to re-enter through, or a control the statistic responds
 * to — and is in `crowd/AGENTS.md` as open.
 */

describe("nobody walks through anybody where it can be seen", () => {
  it("keeps visible overlaps rare, in a crowd just wider than the detail radius", () => {
    // **Past the detail radius nobody avoids anybody**, so the far crowd
    // interpenetrates freely and carries those overlaps in as I walk. That is
    // fine if and only if they are resolved before they come within `SEEN`,
    // where an overlap is unmistakable — and `overlapsSeen` is the count that
    // can say so; `overlaps` includes the far ones and would pass a broken
    // piece.
    //
    // **A world of reach 30, not the market's ninety.** All the check needs is
    // a ring of crowd outside the detail radius to carry overlaps in, and me
    // going fast enough — 3 m/s, closing at nearly 5 — that the far crowd
    // crosses from the detail radius to `SEEN` inside the window. Measured 0.04
    // a step; with the detail radius cut to 8 m it is 0.24, so the line sits
    // between with three times of room either side.
    const { crowd, run } = walk({ reach: 30, density: 60, walk: 3 }, 1)
    expect(crowd.stats().world).toBeGreaterThan(DETAIL + 4)
    let seen = 0
    let steps = 0
    for (let t = 0; t < 3.5; t += STEP) {
      run(STEP)
      seen += crowd.stats().overlapsSeen
      steps++
    }
    expect(seen / steps).toBeLessThan(0.12)
  }, 60_000)

  it("has a detail radius wide enough for the anticipation it is cutting off", () => {
    // Not a measurement — an arithmetic invariant between two constants in two
    // different files. The fastest pair this piece can produce is the top of the
    // crowd's pace band closing with the top of the observer's, and the force is
    // cut off at `CUTOFF` seconds. If the detail radius is shorter than that, the
    // crowd is skipping encounters it has already decided are worth having, and
    // nothing about the picture says so.
    // Derived per scene now, since only a runner needs more than `DETAIL`: so
    // the invariant is on the function, at the corner of the tracks where it
    // is hardest, and at an ordinary walk where it must not have grown.
    const fastest = BOUNDS.paceHigh.max + BOUNDS.walk.max
    expect(detailFor({ paceHigh: BOUNDS.paceHigh.max, walk: BOUNDS.walk.max })).toBeGreaterThanOrEqual(CUTOFF * fastest)
    expect(detailFor({ paceHigh: 1.8, walk: 1.3 })).toBe(DETAIL)
  })
})
