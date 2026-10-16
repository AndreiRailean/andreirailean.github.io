import { expect, it, vi } from "vitest"
import { park, STEP } from "./park"

/**
 * Whether the step asks which side to pass on, and whether it ever gets an
 * answer.
 *
 * The side to pass on is what lets a counterflow sort into files, and
 * `steering.test.ts` tests that decision itself — "the side to pass on". This is
 * the half it cannot see: that the walk consults it. It replaces a two-minute
 * run that measured lanes forming, 35 of `crowd.test.ts`'s 124 seconds, which
 * was checking the decision and the wiring at once through everything else a
 * crowd does (#287).
 *
 * **A file of its own because of the mock.** `passingBias` is passed straight
 * through, so the crowd behaves exactly as shipped, but wrapping it costs every
 * pair interaction a call: in `crowd.test.ts` it made the long cases half as
 * slow again. A counter rather than `vi.fn`, which records every call and took
 * that file from 15 seconds to 95.
 *
 * Seen failing: with the `passingBias` call removed from the step, nobody asks.
 */
const bias = vi.hoisted(() => ({ calls: 0, answered: 0 }))
vi.mock("@/experiments/walkers/steering", async (actual) => {
  const real = await actual<typeof import("@/experiments/walkers/steering")>()
  return {
    ...real,
    passingBias: (...args: Parameters<typeof real.passingBias>) => {
      const out = real.passingBias(...args)
      bias.calls++
      if (out.x !== 0 || out.y !== 0) bias.answered++
      return out
    },
  }
})

it("asks which side to pass on, and gets an answer, in a head-on crowd", () => {
  // Two streams meeting head on, densely, so every walker has somebody coming
  // at them within the half-second.
  const { crowd } = park(
    { density: 150, paceLow: 1.4, paceHigh: 1.4, flow: "through", settling: 0, span: 5, children: 0 },
    { width: 400, height: 250 },
  )
  bias.calls = 0
  bias.answered = 0
  for (let step = 0; step < 0.5 / STEP; step++) crowd.step(STEP)

  expect(bias.calls, "the step never asked").toBeGreaterThan(0)
  expect(bias.answered, "every answer was no preference").toBeGreaterThan(0)
})
