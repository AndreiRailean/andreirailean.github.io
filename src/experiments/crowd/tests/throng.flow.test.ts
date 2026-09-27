import { describe, expect, it } from "vitest"
import { CUTOFF } from "@/experiments/crowd/steering"
import { DETAIL, detailFor } from "@/experiments/crowd/throng"
import { BOUNDS } from "@/experiments/crowd/settings"
import { PATIENT, relative, STEP, walk } from "./support"

/**
 * The crowd, over long enough for the things it claims to be about to happen.
 *
 * **These are slow and are meant to be.** Every claim here is about a crowd that
 * has been walking for a minute or two: a population that holds, a crowd that
 * does not thin out on the side the observer is walking into, files that form
 * without anything knowing what a file is. None of them is visible in a frame
 * and none is expressible in a shorter run. `pnpm exec vitest crowd` is the
 * filter; see `tests/AGENTS.md` on why the unit suite has a slow module in it.
 */

describe("nobody walks through anybody where it can be seen", () => {
  it(
    "keeps visible overlaps rare across a long walk",
    () => {
      // **The check the detail radius needs.** Past `DETAIL` nobody avoids
      // anybody, so the far crowd interpenetrates freely and carries those
      // overlaps in as the observer walks. That is fine if and only if they are
      // resolved long before anybody can see them, and `overlapsSeen` is the only
      // thing that can say so — `overlaps` counts the far ones too and would pass
      // a piece that was visibly broken.
      //
      // Measured at 0.06-0.19 pairs per step across the five scenes. Dropping
      // `DETAIL` to 8 takes it past 2.
      const { me, crowd, run } = walk({ density: 50, walk: 1.2 }, 20)
      let seen = 0
      let steps = 0
      for (let t = 0; t < 40; t += STEP) {
        run(STEP)
        seen += crowd.stats().overlapsSeen
        steps++
      }
      void me
      expect(seen / steps).toBeLessThan(0.6)
    },
    PATIENT,
  )

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

describe("what nothing in the code knows about", () => {
  it(
    "sorts a counterflow into files",
    () => {
      // Two streams meeting head on sort themselves into lanes within a few
      // metres. Nothing in this piece knows what a lane is; it is what happens
      // when avoidance is anticipatory, and it is the single strongest claim the
      // note makes.
      //
      // The statistic: for each person, how many of their six nearest neighbours
      // are going the same way. Random mixing gives a half. **The control is the
      // same reading at the start of the same run** — without it this is measuring
      // whatever else the placement happened to do.
      // Nobody standing, because a file is a claim about people who are walking
      // and `sign(0)` matches no walker. The first version left the primary's 22%
      // standing in and its own control failed at 0.38 — which is exactly right
      // for that scene (`0.22² + 0.78²/2 = 0.353`) and says nothing at all about
      // files. **The control was working; the expectation was wrong.**
      const settings = { stream: 1, against: 0.5, density: 45, walk: 1.4, pausing: 0, grouping: 0, standing: 0 }
      const { me, crowd, run } = walk(settings, 0)

      const agreement = () => {
        // Walkers only, belt and braces: `standing: 0` above already excludes
        // them, and a later edit to these settings must not quietly turn this
        // statistic back into a measurement of how many people are stopped.
        const near = relative(crowd, me)
          .filter((p) => Math.hypot(p.ahead, p.beside) < 14)
          .filter((p) => Math.hypot(p.person.vx, p.person.vy) > 0.25)
        let total = 0
        let same = 0
        for (const self of near) {
          const mine = Math.sign(self.person.vx * Math.cos(me.course) + self.person.vy * Math.sin(me.course))
          const others = near
            .filter((o) => o !== self)
            .map((o) => ({ o, d: Math.hypot(o.ahead - self.ahead, o.beside - self.beside) }))
            .sort((a, b) => a.d - b.d)
            .slice(0, 6)
          for (const { o } of others) {
            total++
            if (Math.sign(o.person.vx * Math.cos(me.course) + o.person.vy * Math.sin(me.course)) === mine) same++
          }
        }
        return same / total
      }

      const before = agreement()
      run(120)
      const after = agreement()

      // The control: a scattered crowd is near chance.
      expect(before).toBeGreaterThan(0.42)
      expect(before).toBeLessThan(0.58)
      // And after two minutes it is not.
      expect(after, `files did not form: ${before.toFixed(3)} to ${after.toFixed(3)}`).toBeGreaterThan(before + 0.05)
    },
    PATIENT,
  )
})
