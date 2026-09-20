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

/**
 * Milliseconds, on every test here that simulates.
 *
 * **Not because they are slow — because this box is shared.** Each of these runs
 * in ten to twenty-five seconds alone and the suite's default allowance is
 * thirty, so under a full run against other sessions' work they sit either side
 * of the line and fail on whichever one happens to be unlucky. That is
 * flakiness, and it read as a failing check twice before it read as a slow one.
 * `tests/AGENTS.md` has the numbers on how far a single timing moves here.
 */
const PATIENT = 180_000

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
  it(
    "holds its population over a walk of a hundred metres",
    () => {
      const { crowd } = walk({ walk: 1.6, pausing: 0, density: 40 }, 90)
      const stats = crowd.stats()
      const wanted = Math.round((40 / 100) * Math.PI * stats.world * stats.world)
      expect(stats.people).toBe(Math.min(MAX_PEOPLE, wanted))
    },
    PATIENT,
  )

  it(
    "stays uniform around the observer, except for the hole they make in it",
    () => {
      // The crowd must not drain as the observer walks into it — a fault that
      // looks exactly like an ordinary thinning crowd and is invisible in any
      // single frame. Everybody walking at me is the worst case, so that is the
      // case.
      //
      // **This does now test `entryAngle`, and for a while it did not.** In a
      // smaller world the uniform version was self-correcting fast enough to be
      // indistinguishable here, and this check passed against a broken one. With
      // the world sized by `reach` it no longer keeps up: breaking `entryAngle`
      // takes the outer spread from 1.007 to 1.362. The statement that "a
      // density check cannot see this" was true when it was written and is not
      // true now, which is worth knowing before trusting either.
      //
      // **Averaged over the run, not read at the end**, and that was the second
      // mistake. A single instantaneous front/back count swings between 0.96 and
      // 1.20 with no trend, so which number comes out depends on when you stop —
      // shortening this run from 150 seconds to 100 turned it red on a crowd
      // that had not changed. Over fifty samples it is 1.04 and barely moves.
      const RINGS = 5
      const rings = new Array<number>(RINGS).fill(0)
      let front = 0
      let back = 0
      let samples = 0

      const { me, crowd, run } = walk({ stream: 1, against: 1, walk: 1.6, pausing: 0, density: 40 }, 30)
      for (let sample = 0; sample < 50; sample++) {
        run(2)
        samples++
        const edge = crowd.stats().world * 0.95
        const cos = Math.cos(me.course)
        const sin = Math.sin(me.course)
        for (const person of crowd.people) {
          const dx = person.x - me.x
          const dy = person.y - me.y
          const r = Math.hypot(dx, dy)
          if (r > edge) continue
          // **Equal-area rings**, so a uniform crowd puts the same count in each
          // — hence the square. Rings of equal *width* hold areas in the ratio
          // 1:3:5:7:9 and would pass on very nearly anything.
          rings[Math.min(RINGS - 1, Math.floor((r / edge) ** 2 * RINGS))]!++
          if (dx * cos + dy * sin > 0) front++
          else back++
        }
      }

      const outer = rings.slice(1)
      const mean = outer.reduce((a, b) => a + b, 0) / outer.length

      // The outer four are the crowd proper, uniform to about a per cent. This
      // is what a drain breaks, in whichever ring it drains.
      expect(Math.max(...outer) / Math.min(...outer)).toBeLessThan(1.1)

      // **The innermost ring is short, and the reason is not the one first
      // written here.** That said it was the hole the observer makes by being
      // avoided. Measured against a control with the observer's own avoidance
      // switched off, that accounts for a quarter of it: 0.925 against 0.897.
      //
      // The rest is the level of detail. Anticipation reaches four seconds
      // ahead, which is a long-range repulsion, and it only acts inside
      // `DETAIL` — so the crowd there relaxes outward and the surplus sits just
      // beyond, 214 people against 286 over equal areas either side of the
      // radius. It is not visible: at 24 m a head is a couple of pixels and the
      // band is already a continuum, and a render was checked for the seam
      // before this was left alone.
      expect(rings[0]! / mean).toBeLessThan(0.98)
      expect(rings[0]! / mean).toBeGreaterThan(0.5)

      // And no front-to-back bias beyond the mild pile-up of walking into people.
      expect(samples).toBe(50)
      expect(front / back).toBeGreaterThan(0.95)
      expect(front / back).toBeLessThan(1.15)
    },
    PATIENT,
  )

  it(
    "puts people back where they will stay, rather than where they will leave again",
    () => {
      // **The check `entryAngle` needs**, and the one the density check above
      // cannot be. Both versions produce the same crowd; only one of them produces
      // it without re-entering a third of the population into the side they are
      // already walking out of.
      //
      // Measured on this exact scene: 142 re-entries a second with the
      // flux-weighted angle, 335 with a uniform one. The threshold sits between
      // them with room either side, so this fails the moment somebody
      // simplifies that `asin` away.
      //
      // **Measured over a window, not over the whole run**, for two reasons. The
      // opening stretch is not steady state — nobody has reached the boundary yet
      // — so including it drags the rate down toward the threshold from the wrong
      // side. And the run has to be short: this box is shared, the first version
      // simulated 150 seconds and passed at 16s alone and timed out at 30s inside
      // a full suite, which is the flakiness `tests/AGENTS.md` warns about rather
      // than a slow test.
      const { crowd, run } = walk({ stream: 1, against: 1, walk: 1.6, pausing: 0, density: 40 }, 30)
      const from = crowd.stats().reentries
      run(30)
      const perSecond = (crowd.stats().reentries - from) / 30

      expect(perSecond).toBeGreaterThan(20)
      expect(perSecond, "re-entry angle is no longer weighted by inward flux").toBeLessThan(220)
    },
    PATIENT,
  )

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
    const street = walk({ density: 45, reach: 220, width: 7 }, 3)
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
    const fastest = BOUNDS.paceHigh.max + BOUNDS.walk.max
    expect(DETAIL).toBeGreaterThanOrEqual(CUTOFF * fastest)
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
