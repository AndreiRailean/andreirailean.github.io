import { describe, expect, it } from "vitest"
import { CUTOFF } from "@/experiments/crowd/steering"
import { createStroll } from "@/experiments/crowd/stroll"
import { createThrong, DETAIL, MAX_PEOPLE } from "@/experiments/crowd/throng"
import { BOUNDS, normalizeSettings, PRESETS, type Settings } from "@/experiments/crowd/settings"

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

const STEP = 1 / 120

function walk(patch: Partial<Settings>, seconds: number) {
  const settings = normalizeSettings({ ...PRESETS[0]!.settings, ...patch })
  const me = createStroll(settings, settings.seed)
  const crowd = createThrong(settings, me)
  const run = (forSeconds: number) => {
    for (let t = 0; t < forSeconds; t += STEP) {
      me.step(STEP, crowd)
      crowd.step(STEP)
    }
  }
  run(seconds)
  return { me, crowd, run, settings }
}

/** Where everybody is relative to the observer's own line of travel. */
function relative(crowd: ReturnType<typeof createThrong>, me: ReturnType<typeof createStroll>) {
  const cos = Math.cos(me.course)
  const sin = Math.sin(me.course)
  return crowd.people.map((person) => {
    const dx = person.x - me.x
    const dy = person.y - me.y
    return { ahead: dx * cos + dy * sin, beside: dx * sin - dy * cos, person }
  })
}

describe("the world travels with the observer", () => {
  it("holds its population over a walk of a hundred metres", () => {
    const { crowd } = walk({ walk: 1.6, pausing: 0, density: 40 }, 90)
    const stats = crowd.stats()
    const wanted = Math.round((40 / 100) * Math.PI * stats.world * stats.world)
    expect(stats.people).toBe(Math.min(MAX_PEOPLE, wanted))
  })

  it("does not thin out on the side it is walking into", () => {
    // The crowd ahead of the observer must not drain as they walk into it — a
    // fault that looks exactly like an ordinary thinning crowd and is invisible
    // in any single frame. Everybody walking at me is the worst case, so that is
    // the case.
    //
    // **This does not test `entryAngle`, and it was written believing it did.**
    // Breaking that function to a uniform angle leaves this passing, because the
    // uniform version is self-correcting: anybody put back on the wrong side of
    // the disc is already leaving it and is simply re-entered again. What this
    // does cover is the rest of the mechanism — the re-entry radius, the
    // velocity being kept, the boundary test — any of which drains the crowd for
    // real. `entryAngle` is guarded by the re-entry rate below, which is the
    // only statistic that can see it.
    const { crowd, me } = walk({ stream: 1, against: 1, walk: 1.6, pausing: 0, density: 40 }, 150)

    // Counted over the same area front and back, well inside the boundary, so
    // this is a density comparison rather than a geometry one.
    const reach = crowd.stats().world * 0.6
    let front = 0
    let back = 0
    for (const { ahead, beside } of relative(crowd, me)) {
      if (Math.hypot(ahead, beside) > reach) continue
      if (ahead > 0) front++
      else back++
    }

    expect(front / back).toBeGreaterThan(0.85)
    expect(front / back).toBeLessThan(1.18)
  })

  it("puts people back where they will stay, rather than where they will leave again", () => {
    // **The check `entryAngle` needs**, and the one the density check above
    // cannot be. Both versions produce the same crowd; only one of them produces
    // it without re-entering a third of the population into the side they are
    // already walking out of.
    //
    // Measured on this exact scene: 99 re-entries a second with the flux-weighted
    // angle, 232 with a uniform one. The threshold sits between them with room
    // either side, so this fails the moment somebody simplifies that `asin` away.
    const { crowd } = walk({ stream: 1, against: 1, walk: 1.6, pausing: 0, density: 40 }, 150)
    const perSecond = crowd.stats().reentries / 150
    expect(perSecond).toBeGreaterThan(20)
    expect(perSecond, "re-entry angle is no longer weighted by inward flux").toBeLessThan(150)
  })

  it("keeps its edge too faint to be an edge, in every scene that ships", () => {
    // The budget caps the world, so a scene asking for a long `distance` over a
    // dense crowd cannot have the depth it asked for and the crowd ends where
    // somebody can see it end. That is reported rather than disguised — see
    // `edge` — and the presets are the place it must not happen.
    for (const preset of PRESETS) {
      const settings = normalizeSettings(preset.settings)
      const me = createStroll(settings, settings.seed)
      const crowd = createThrong(settings, me)
      const { edge, world } = crowd.stats()
      expect(edge, `${preset.label} ends at ${(edge * 100).toFixed(1)}% brightness`).toBeLessThan(0.03)
      // Derived rather than restated, so a change to how the world is sized has
      // to survive the arithmetic as well as the threshold.
      expect(edge).toBeCloseTo(Math.exp(-world / settings.fade), 9)
    }
  })
})

describe("nobody walks through anybody where it can be seen", () => {
  it("keeps visible overlaps rare across a long walk", () => {
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
  })

  it("has a detail radius wide enough for the anticipation it is cutting off", () => {
    // Not a measurement — an arithmetic invariant between two constants in two
    // different files. The fastest pair this piece can produce is the top of the
    // crowd's pace band closing with the top of the observer's, and the force is
    // cut off at `CUTOFF` seconds. If the detail radius is shorter than that, the
    // crowd is skipping encounters it has already decided are worth having, and
    // nothing about the picture says so.
    const fastest = BOUNDS.paceHigh.max + BOUNDS.walk.max
    expect(DETAIL).toBeGreaterThanOrEqual(CUTOFF * fastest)
  })
})

describe("what nothing in the code knows about", () => {
  it("sorts a counterflow into files", () => {
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
  })
})
