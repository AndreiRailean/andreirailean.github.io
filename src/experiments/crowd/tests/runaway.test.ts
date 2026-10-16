import { describe, expect, it } from "vitest"
import {
  CAUGHT_AT,
  CAUGHT_FOR,
  CAUGHT_SHARE,
  createRunaway,
  farSide,
  flee,
  junctionHeading,
  keepCover,
  pickHide,
  REARM_AT,
  UNAWARE,
  type RunawayState,
  type RunawayWorld,
} from "@/experiments/crowd/runaway"
import type { Boulder, Boulders } from "@/experiments/crowd/boulders"
import { createStalls } from "@/experiments/crowd/stalls"
import type { Person } from "@/experiments/crowd/throng"
import { makeRng } from "@/experiments/random"

/**
 * The person in red, one decision at a time.
 *
 * **These used to be chases.** Each property was checked by chasing somebody
 * round the market for two to four minutes and counting what happened — four
 * tests, 43 s of the unit job — when every one of them is a decision made by
 * one function in `runaway.ts` from where the two of us are standing. So each
 * is checked here with a runaway, an observer and the ground under them, and
 * `structure.test.ts` keeps one short chase to show the throng calls them.
 *
 * Every "break it" note below was done: the fault named was put back and the
 * test was seen to go red.
 */

const DT = 1 / 120

function runaway(x: number, y: number): Person {
  return { x, y, vx: 0, vy: 0, gx: 1, gy: 0, preferred: 1.3, junction: -1 } as unknown as Person
}

/** Boulders that are just a list: `within` is every one whose edge comes inside the radius. */
function rocks(list: Boulder[]): Boulders {
  return {
    active: list.length > 0,
    push: () => {},
    blocked: () => false,
    within: (x, y, radius, out) => {
      out.length = 0
      for (const b of list) if (Math.hypot(b.x - x, b.y - y) - b.r < radius) out.push(b)
      return out
    },
    inside: () => 0,
  }
}

function world(observer: { x: number; y: number }, patch: Partial<RunawayWorld> = {}): RunawayWorld {
  return {
    observer,
    boulders: rocks([]),
    stalls: createStalls(0, 1, 0),
    halfWidth: Infinity,
    current: { walk: 1.3, flee: 1.1 },
    place: makeRng(7),
    ...patch,
  }
}

const RUN = 1.3 * 1.1
const DAWDLE = 1.3 * 0.2

describe("a catch", () => {
  it("happens within arm's reach, and stands us together for a few seconds", () => {
    const state = createRunaway()
    const them = runaway(0.9, 0)
    const w = world({ x: 0, y: 0 })
    flee(state, them, DT, w)
    expect(CAUGHT_AT).toBeGreaterThan(0.9)
    expect(state.caughtFor).toBeGreaterThanOrEqual(CAUGHT_FOR[0]!)
    expect(state.caughtFor).toBeLessThanOrEqual(CAUGHT_FOR[1]!)
    expect(them.preferred).toBe(0)
    // Standing together, not dawdling beside me while I circle them: nothing
    // moves them until the time is up. "i can't quite tell whether we're
    // walking together or we're wrestling" was a runaway with no such state.
    let steps = 0
    while (state.caughtFor > 0 && steps < 1000) {
      flee(state, them, DT, w)
      steps++
      if (state.caughtFor > 0) expect(them.preferred).toBe(0)
    }
    expect(steps * DT).toBeGreaterThanOrEqual(CAUGHT_FOR[0]! - DT)
  })

  it("ends with them bolting away from me, faster than they run, and out of reach of another catch", () => {
    const state = createRunaway()
    const them = runaway(0.6, 0.6)
    const w = world({ x: 0, y: 0 })
    flee(state, them, DT, w)
    while (state.caughtFor > 0) flee(state, them, DT, w)
    expect(state.fleeing).toBe(true)
    expect(state.armed).toBe(false)
    expect(them.preferred).toBeCloseTo(RUN * 1.3, 9)
    expect(Math.atan2(them.gy, them.gx)).toBeCloseTo(Math.PI / 4, 9)
  })

  it("bolts down an aisle, not across a stall, when there are stalls", () => {
    const state = createRunaway()
    const them = runaway(0.7, 0.4)
    const w = world({ x: 0, y: 0 }, { stalls: createStalls(0.5, 3, 1) })
    flee(state, them, DT, w)
    while (state.caughtFor > 0) flee(state, them, DT, w)
    // Straight away from me is 30° off the aisle; the bolt takes the aisle.
    expect(them.gx).toBeCloseTo(1, 9)
    expect(Math.abs(them.gy)).toBeLessThan(1e-9)
  })

  /**
   * They bolt from within arm's reach, so without a re-arm distance the next
   * step caught them again: 55 catches in four minutes on one seed. Break it:
   * leaving `armed` true at the bolt catches them on the very next step here.
   */
  it("cannot happen again until they have got properly away", () => {
    const state = createRunaway()
    const them = runaway(0.5, 0)
    const w = world({ x: 0, y: 0 })
    flee(state, them, DT, w)
    while (state.caughtFor > 0) flee(state, them, DT, w)
    // Still at arm's reach: no catch.
    flee(state, them, DT, w)
    expect(state.caughtFor).toBe(0)
    // Just short of away, and back: still no catch.
    them.x = REARM_AT - 0.1
    flee(state, them, DT, w)
    them.x = 0.5
    flee(state, them, DT, w)
    expect(state.caughtFor).toBe(0)
    // Properly away, and back: caught.
    them.x = REARM_AT + 0.1
    flee(state, them, DT, w)
    them.x = 0.5
    flee(state, them, DT, w)
    expect(state.caughtFor).toBeGreaterThan(0)
  })
})

describe("the chase", () => {
  /**
   * **Two states with a gap between their thresholds, so the gap to me cannot
   * settle.** The first version had a pace varying smoothly with distance, and
   * any such law has a distance where their pace equals mine: two minutes of the
   * market ended on 4 m, 4 m, 4 m. So this asserts the hysteresis itself — the
   * same distance gets a run or a dawdle depending on which way it was reached.
   * Break it: deciding `fleeing` from the distance alone (`d < farGap`) gives
   * the same pace both ways and fails.
   */
  it("runs until far enough, dawdles until I am nearly on them, and the same distance means either", () => {
    const state = createRunaway()
    state.farGap = 14
    const them = runaway(3, 0)
    const w = world({ x: 0, y: 0 })
    const pace = (x: number) => {
      them.x = x
      them.y = 0
      flee(state, them, DT, w)
      return them.preferred
    }
    expect(pace(6)).toBeCloseTo(RUN, 9)
    expect(pace(13)).toBeCloseTo(RUN, 9)
    pace(14.5)
    expect(state.fleeing).toBe(false)
    expect(state.nearGap).toBeLessThan(6)
    expect(pace(6)).toBeCloseTo(DAWDLE, 9)
    // Close enough, and they are off again.
    state.nearGap = 3
    expect(pace(2.5)).toBeCloseTo(RUN, 9)
    // Every run draws a new stopping distance, so the rhythm does not repeat.
    const stops = new Set<number>()
    for (let i = 0; i < 20; i++) {
      state.fleeing = false
      state.nearGap = 5
      pace(4)
      stops.add(state.farGap)
    }
    expect(stops.size).toBe(20)
    for (const far of stops) {
      expect(far).toBeGreaterThanOrEqual(9)
      expect(far).toBeLessThanOrEqual(21)
    }
  })

  it("does not see me coming the stated share of the time, which is how a chase ends in a catch", () => {
    const state = createRunaway()
    const them = runaway(30, 0)
    const w = world({ x: 0, y: 0 })
    let blind = 0
    const n = 4000
    for (let i = 0; i < n; i++) {
      state.fleeing = true
      state.farGap = 10
      flee(state, them, DT, w)
      if (state.nearGap === 0) blind++
    }
    expect(blind / n).toBeGreaterThan(CAUGHT_SHARE - 0.03)
    expect(blind / n).toBeLessThan(CAUGHT_SHARE + 0.03)
  })

  /**
   * Averaged over a hundred streams, because their heading also wanders, and
   * one stream's wander alone was seen to carry it 90° in two seconds — which
   * passed this with the bend deleted. Break it: without the bend the mean is
   * about zero.
   */
  it("bends away from me while running on open ground, and runs along the way in a corridor", () => {
    // Running off at 90° to me, with me 3 m away; away from me is +y.
    let mean = 0
    for (let seed = 0; seed < 100; seed++) {
      const open = createRunaway()
      const them = runaway(0, 3)
      const w = world({ x: 0, y: 0 }, { place: makeRng(seed) })
      for (let i = 0; i < 240; i++) {
        them.x = 0
        them.y = 3
        flee(open, them, DT, w)
      }
      mean += them.gy / 100
    }
    expect(mean).toBeGreaterThan(0.8)

    const street = createRunaway()
    const along = runaway(0, 3)
    along.gx = 0
    along.gy = 1
    const ws = world({ x: 0, y: 0 }, { halfWidth: 3.5 })
    for (let i = 0; i < 600; i++) {
      along.x = 0
      along.y = 3
      flee(street, along, DT, ws)
    }
    expect(along.gx).toBeGreaterThan(0.95)
  })
})

describe("hiding behind a boulder", () => {
  const me = { x: 0, y: 0 }

  /**
   * Each refusal on its own, because offered together with a good boulder the
   * good one wins on score anyway and a dropped rule would not show. Break it:
   * without the "not nearer me than they are" rule the boulder at (7, 3) — its
   * far side is barely back toward me, but it is closer to me than they are —
   * is taken.
   */
  it("picks one whose far side is further from me, and refuses one back past me or nearer me than they are", () => {
    const behind: Boulder = { x: 14, y: 2, r: 1.5, side: 0 }
    const between: Boulder = { x: 5, y: 0, r: 1.5, side: 0 }
    const nearerMe: Boulder = { x: 7, y: 3, r: 1.5, side: 0 }
    const backPastMe: Boulder = { x: -6, y: 0, r: 1.5, side: 0 }
    for (const refused of [between, nearerMe, backPastMe]) {
      for (let i = 0; i < 50; i++) {
        const state = createRunaway()
        pickHide(state, runaway(10, 0), world(me, { boulders: rocks([refused]), place: makeRng(i) }))
        expect(state.hiding).toBe(false)
      }
    }
    const w = world(me, { boulders: rocks([behind, between, nearerMe, backPastMe]) })
    for (let i = 0; i < 200; i++) {
      const state = createRunaway()
      pickHide(state, runaway(10, 0), w)
      expect(state.hiding).toBe(true)
      expect(state.cover).toBe(behind)
    }
    // The one just left is never picked again straight away.
    const state = createRunaway()
    state.cover = behind
    pickHide(state, runaway(10, 0), w)
    expect(state.cover).toBeNull()
    expect(state.hiding).toBe(false)
  })

  it("hides nowhere when there are no boulders, and is unaware of me the stated share of hidings", () => {
    const none = createRunaway()
    pickHide(none, runaway(10, 0), world(me))
    expect(none.hiding).toBe(false)

    const w = world(me, { boulders: rocks([{ x: 14, y: 2, r: 1.5, side: 0 }]) })
    let unaware = 0
    const n = 4000
    for (let i = 0; i < n; i++) {
      const state = createRunaway()
      pickHide(state, runaway(10, 0), w)
      if (state.unaware) unaware++
    }
    expect(unaware / n).toBeGreaterThan(UNAWARE - 0.03)
    expect(unaware / n).toBeLessThan(UNAWARE + 0.03)
  })

  /**
   * **Keeping a boulder between us, not running to a spot behind it.** A fixed
   * spot was built first and hid them 0% of the time: I came round the boulder
   * the way they had, and there they were. So the place they make for is the
   * far side from where I am *now*. Break it: freezing the spot where it was
   * when they picked the boulder leaves them making for my side once I have
   * walked round, and this fails.
   */
  it("makes for the far side from where I am now, so coming round one way sends them round the other", () => {
    const rock: Boulder = { x: 10, y: 0, r: 2, side: 0 }
    const state: RunawayState = { ...createRunaway(), hiding: true, cover: rock, coverFor: 100 }
    const them = runaway(10, 4)
    const observer = { x: 0, y: 0 }
    const w = world(observer, { boulders: rocks([rock]) })
    keepCover(state, them, Math.hypot(10, 4), DT, w)
    const first = farSide(rock, observer)
    expect(first.x).toBeGreaterThan(rock.x)
    expect(Math.atan2(them.gy, them.gx)).toBeCloseTo(Math.atan2(first.y - them.y, first.x - them.x), 9)
    // I walk round to the far side; now the near side is the hiding place.
    observer.x = 20
    observer.y = 0
    keepCover(state, them, Math.hypot(10, 4), DT, w)
    const second = farSide(rock, observer)
    expect(second.x).toBeLessThan(rock.x)
    expect(Math.atan2(them.gy, them.gx)).toBeCloseTo(Math.atan2(second.y - them.y, second.x - them.x), 9)
  })

  it("hurries into position, settles there, and bolts straight away from me when I find them", () => {
    const rock: Boulder = { x: 10, y: 0, r: 2, side: 0 }
    const w = world(me, { boulders: rocks([rock]) })
    const spot = farSide(rock, me)

    const out = { ...createRunaway(), hiding: true, cover: rock, coverFor: 100 }
    const far = runaway(10, 6)
    keepCover(out, far, Math.hypot(10, 6), DT, w)
    expect(far.preferred).toBeCloseTo(RUN, 9)

    const there = { ...createRunaway(), hiding: true, cover: rock, coverFor: 100 }
    const settled = runaway(spot.x, spot.y)
    keepCover(there, settled, spot.x, DT, w)
    expect(there.inCover).toBe(true)
    expect(settled.preferred).toBeLessThan(0.01)

    // Found: me within reach of their boulder.
    const near = { x: 11, y: 3 }
    const found = { ...createRunaway(), hiding: true, cover: rock, coverFor: 100, inCover: true }
    const caught = runaway(spot.x, spot.y)
    keepCover(found, caught, Math.hypot(spot.x - near.x, spot.y - near.y), DT, world(near, { boulders: rocks([rock]) }))
    expect(found.hiding).toBe(false)
    expect(found.fleeing).toBe(true)
    const away = Math.atan2(caught.y - near.y, caught.x - near.x)
    expect(Math.atan2(caught.gy, caught.gx)).toBeCloseTo(away, 9)
  })

  it("stays put when not watching for me, so I can come round and catch them", () => {
    const rock: Boulder = { x: 10, y: 0, r: 2, side: 0 }
    const spot = farSide(rock, me)
    const near = { x: 11, y: 3 }
    const state = { ...createRunaway(), hiding: true, cover: rock, coverFor: 100, inCover: true, unaware: true }
    const them = runaway(spot.x, spot.y)
    keepCover(state, them, 1.5, DT, world(near, { boulders: rocks([rock]) }))
    expect(state.hiding).toBe(true)
    expect(them.preferred).toBe(0)
  })
})

describe("at an aisle crossing", () => {
  const QUARTER = Math.PI / 2
  const choices = (dx: number, dy: number) => {
    const place = makeRng(11)
    const counts = { straight: 0, turn: 0, back: 0 }
    const n = 20_000
    for (let i = 0; i < n; i++) {
      const h = junctionHeading(0, dx, dy, Math.hypot(dx, dy), place)
      const t = Math.round(h / QUARTER)
      if (t === 0) counts.straight++
      else if (Math.abs(t) === 1) counts.turn++
      else counts.back++
    }
    return { straight: counts.straight / n, turn: counts.turn / n, back: counts.back / n }
  }

  /**
   * **A child trying to lose you ducks round corners.** Scoring by distance from
   * me alone was built first: from behind in the same aisle straight on always
   * wins, so they ran down it dead ahead of me 77% of the time — the crosshair
   * the stalls were meant to break. With me straight behind, the arithmetic
   * gives a turn 83% of the time. Break it: dropping the turn's 0.7 bonus gives
   * straight on 79% and fails.
   */
  it("mostly turns a corner when I am behind them, and still sometimes goes straight on", () => {
    const { straight, turn, back } = choices(10, 0)
    expect(turn).toBeGreaterThan(0.75)
    expect(straight).toBeGreaterThan(0.1)
    expect(back).toBe(0)
  })

  it("never takes the way back toward me", () => {
    // I am ahead of them in their aisle: straight on is toward me.
    const { straight, back } = choices(-10, 0)
    expect(straight).toBe(0)
    expect(back).toBe(0)
  })
})
