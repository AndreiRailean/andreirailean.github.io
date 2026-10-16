import { describe, expect, it } from "vitest"
import { makeRng, type Rng } from "@/experiments/random"
import {
  changeGap,
  longestWhole,
  PATIENCE_LIMIT,
  reconsider,
  type Square,
  type Temper,
} from "@/experiments/psyxels/stack"

/**
 * One square's change of mind, with no picture, no mask and no field.
 *
 * Everything about how long a psyx lives is decided here — when each level of
 * the stack asks, and what it answers — so it is tested here, one square at a
 * time and one turn at a time. These used to be measured by packing a 640×480
 * field and watching it for ten minutes of piece time, which took six seconds
 * to say what a few hundred turns of one square say exactly. Andrei,
 * 2026-10-16: "the primitive would ensure that the large psyxel's lifetime is
 * bounded based on the decision at the stack level".
 *
 * What the field does with the answers — which squares are asked at all, and
 * the grain kept under a square that merges — is the field's, and
 * `field.test.ts` keeps one check that the stack's timing survives the tree.
 */

/** Three levels below the coarsest: the decision can always divide down to depth 2. */
const TEMPER: Temper = { churn: 60, detail: 0, fuzz: 0, variety: 0.64, coarse: 0.16, finest: 0.02 }

const squareAt = (depth: number, rng: Rng = makeRng(7)): Square => {
  const square: Square = { depth, size: 640 / 2 ** depth, dev: 0, patience: 0, changed: 0, changeRoll: 0, rng }
  square.changeRoll = square.rng()
  return square
}

/** The moment a square is next asked: `reconsider` compares with `>=`, and a sum can round below it. */
const dueAt = (square: Square, temper: Temper) =>
  square.changed + changeGap(temper.churn, square.changeRoll, square.depth) + 1e-9

/**
 * How long a square stays whole each time it is, turn by turn.
 *
 * The square is asked exactly when it is due — the decision depends on nothing
 * but the square's own draws and memory, so there is nothing between turns to
 * simulate. It starts whole, as a packed field's squares do.
 */
function wholeLives(temper: Temper, depth: number, turns: number, seed = 7): number[] {
  const square = squareAt(depth, makeRng(seed))
  let split = false
  let born = 0
  const lives: number[] = []
  for (let turn = 0; turn < turns; turn++) {
    const time = dueAt(square, temper)
    const wanted = reconsider(square, time, temper)
    if (wanted === null) throw new Error("a square was not asked when it was due")
    if (wanted === split) continue
    split = wanted
    if (split) lives.push(time - born)
    else born = time
  }
  return lives
}

describe("when a square is asked", () => {
  it("is not asked before its gap is up, and is asked once it is", () => {
    const square = squareAt(1)
    const gap = changeGap(TEMPER.churn, square.changeRoll, 1)
    expect(reconsider(square, gap * 0.999, TEMPER)).toBeNull()
    expect(reconsider(square, gap, TEMPER)).not.toBeNull()
    expect(square.changed).toBe(gap)
  })

  it("is never asked at all when churn is zero", () => {
    expect(changeGap(0, 0.5, 0)).toBe(Infinity)
    expect(reconsider(squareAt(0), 1e9, { ...TEMPER, churn: 0 })).toBeNull()
  })

  /** The whole of "life in proportion to the churn control", at every size, stated as arithmetic. */
  it("waits in inverse proportion to the churn control, at every size and every draw", () => {
    for (const roll of [0, 0.3, 0.7, 1]) {
      for (let depth = 0; depth < 6; depth++) {
        expect(changeGap(15, roll, depth) / changeGap(60, roll, depth)).toBeCloseTo(4, 12)
      }
    }
  })
})

describe("what a square answers", () => {
  /** A generator that always says "stay whole" to a chance it is offered. */
  const stubborn: Rng = () => 0.999

  it("divides on the turn after the deadline, however its draws fall", () => {
    const square = squareAt(0, stubborn)
    const answers: boolean[] = []
    for (let turn = 0; turn <= PATIENCE_LIMIT; turn++) answers.push(reconsider(square, dueAt(square, TEMPER), TEMPER)!)
    expect(answers).toEqual([...Array<boolean>(PATIENCE_LIMIT).fill(false), true])
    expect(square.patience).toBe(0)
  })

  it("has no deadline when variety leaves nothing to be undecided about", () => {
    const square = squareAt(0, stubborn)
    const settings = { ...TEMPER, variety: 0 }
    for (let turn = 0; turn < 20; turn++) expect(reconsider(square, dueAt(square, settings), settings)).toBe(false)
  })

  it("never divides below the finest level, whatever is asked", () => {
    const square = squareAt(3, () => 0)
    for (let turn = 0; turn < 10; turn++) expect(reconsider(square, dueAt(square, TEMPER), TEMPER)).toBe(false)
  })
})

describe("how long a square stays whole", () => {
  /**
   * The bound the deadline exists to give, and the shape it leaves.
   *
   * Unbounded, the longest of a few hundred lives ran to five times the mean and
   * beyond — "a large psyx staying on screen for a very long time" against a
   * mean that looked healthy. The deadline cuts the tail and leaves the mean.
   */
  it("is never longer than the deadline allows, and the tail stays near the mean", () => {
    const lives = wholeLives(TEMPER, 0, 4000)
    expect(lives.length).toBeGreaterThan(500)
    const mean = lives.reduce((sum, life) => sum + life, 0) / lives.length
    expect(Math.max(...lives)).toBeLessThanOrEqual(longestWhole(TEMPER.churn, 0))
    expect(Math.max(...lives) / mean).toBeLessThan(4)
  })

  /**
   * The same draws at a quarter of the churn are the same decisions four times
   * as slowly — exactly, because nothing a square decides depends on the time.
   */
  it("follows the churn control exactly, at every size that can divide", () => {
    for (let depth = 0; depth < 3; depth++) {
      const slow = wholeLives({ ...TEMPER, churn: 15 }, depth, 400)
      const fast = wholeLives(TEMPER, depth, 400)
      expect(slow.length).toBeGreaterThan(20)
      expect(slow).toHaveLength(fast.length)
      slow.forEach((life, at) => expect(life / fast[at]!, `depth ${depth}`).toBeCloseTo(4, 3))
    }
  })
})
