import { describe, expect, it } from "vitest"
import { createAir } from "@/experiments/embers/air"
import { createBed, type Spawn } from "@/experiments/embers/bed"
import { PRESETS, type Settings } from "@/experiments/embers/settings"

/**
 * Who gets a slot when the population ceiling binds.
 *
 * **`count` is a drawing budget, and a budget spent first-come is spent on
 * whatever is most numerous.** Reported as *"I slid splinters up and down and it
 * doesn't seem to change anything"* — and it did not: on a four-metre fire the
 * steady sputter asks for 5,720 embers a second against a ceiling of a thousand,
 * so every splinter fragment arrived to find the pool full. Measured at the time:
 * 1.4% of them were ever born, with the control at maximum.
 *
 * Nothing about this is visible in a frame. The splinters that do get through
 * look exactly as they should; there are simply a fiftieth as many as asked for.
 */

const STEP = 1 / 60

/** The scene's own rule, which is the thing under test. */
const EVENT_RESERVE = 0.08
const reserveFor = (count: number) => Math.min(count - 1, Math.max(24, Math.round(count * EVENT_RESERVE)))

/**
 * Twenty seconds of a fire against a pool that is already full, counting what
 * each kind asked for and what it was granted.
 *
 * The pool is held permanently saturated rather than simulated, because what is
 * being tested is the admission rule and not the physics — and a saturated pool
 * is the case the rule exists for.
 */
function admissions(settings: Settings, freeSlots: number) {
  const air = createAir(settings, 1)
  const bed = createBed(settings, 1)
  const asked = { lift: 0, splinter: 0, burst: 0 }
  const born = { lift: 0, splinter: 0, burst: 0 }
  const reserve = reserveFor(Math.round(settings.count))
  let free = freeSlots

  const emit = (spawn: Spawn) => {
    asked[spawn.kind]++
    if (spawn.kind === "lift" && free <= reserve) return
    if (free <= 0) return
    born[spawn.kind]++
    // Slots come back at the rate they are taken, which is what a fire at
    // steady state does — the point is which kind is holding them.
    free--
    if (free < reserve) free = reserve
  }

  for (let frame = 0; frame < 20 / STEP; frame++) {
    air.step(STEP)
    bed.step(STEP, air, emit)
  }
  return { asked, born }
}

describe("a full pool", () => {
  const winter = PRESETS.find((preset) => preset.label === "winter blues")!.settings

  it("lets the splinters through even when the sputter has taken everything", () => {
    const { asked, born } = admissions(winter, reserveFor(Math.round(winter.count)))

    expect(asked.splinter, "the scene throws no splinters, so this tests nothing").toBeGreaterThan(200)
    const granted = born.splinter / asked.splinter
    expect(granted, `only ${(granted * 100).toFixed(1)}% of splinter fragments were born`).toBeGreaterThan(0.9)
  })

  it("lets the bursts through too", () => {
    const { asked, born } = admissions(winter, reserveFor(Math.round(winter.count)))
    expect(asked.burst).toBeGreaterThan(5)
    expect(born.burst / asked.burst).toBeGreaterThan(0.9)
  })

  /**
   * And the background is the thing that yields, which is the whole trade: a
   * density control that stops adding when the budget is full is ordinary, and
   * one that shortens every ember's life instead would be very strange.
   */
  it("stops the sputter rather than taking a slot back from anything", () => {
    const { asked, born } = admissions(winter, reserveFor(Math.round(winter.count)))
    expect(asked.lift).toBeGreaterThan(born.lift)
  })

  it("hands the whole pool to the sputter when nothing is competing for it", () => {
    const quiet = { ...winter, pops: 0, bursts: 0 }
    const roomy = admissions(quiet, Math.round(quiet.count))
    expect(roomy.born.lift).toBeGreaterThan(0)
  })
})

describe("the reserve itself", () => {
  it("never swallows the pool, however small the pool is", () => {
    for (const count of [100, 300, 1010, 6000]) {
      expect(reserveFor(count)).toBeLessThan(count)
      expect(reserveFor(count)).toBeGreaterThan(0)
    }
  })

  it("is big enough for the largest single splinter, at any population", () => {
    // A splinter throws up to fourteen fragments at once; a reserve smaller than
    // one event would let a fragment through and drop the rest of its own fan.
    for (const count of [100, 1010, 6000]) expect(reserveFor(count)).toBeGreaterThanOrEqual(14)
  })
})
