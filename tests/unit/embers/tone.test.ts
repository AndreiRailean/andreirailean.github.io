import { expect, it } from "vitest"
import { bucketHue, HUE_BUCKETS, toneBucket } from "@/experiments/embers/draw"

/**
 * The hue spread has two halves in two files and they have to be exact
 * inverses.
 *
 * `embers.ts` turns a normal draw into a `tone` in 0…1 at birth; `draw.ts` turns
 * that tone back into degrees off the base hue. Neither can see the other, and a
 * mismatch is silent — the piece still works, it just disagrees with its own
 * slider. It did: `tone` was a sum of three uniforms, whose standard deviation
 * is 0.276 rather than the 0.2 the mapping assumes, so every scene's spread was
 * 38% wider than stated.
 *
 * That matters more here than the number suggests. A symmetric rotation carries
 * the *cool* end of the blackbody locus past red into magenta, and the fire
 * presets sit just inside the point where that starts to show — so a spread
 * that is quietly 38% too wide is pink embers in a campfire.
 */
it("spans exactly ±2.5σ across the buckets, which is what tone is scaled to", () => {
  expect(bucketHue(30, 10, 0)).toBeCloseTo(30 - 25, 9)
  expect(bucketHue(30, 10, HUE_BUCKETS - 1)).toBeCloseTo(30 + 25, 9)
  expect(bucketHue(30, 10, (HUE_BUCKETS - 1) / 2)).toBeCloseTo(30, 9)
})

it("puts a zero draw in the middle bucket and a full draw at the ends", () => {
  // The three values `0.5 + gaussian/5` can produce at the extremes of the
  // clamped normal in `@/experiments/random`, which is ±2.5.
  expect(toneBucket(0.5)).toBe((HUE_BUCKETS - 1) / 2)
  expect(toneBucket(0.5 - 2.5 / 5)).toBe(0)
  expect(toneBucket(0.5 + 2.5 / 5)).toBe(HUE_BUCKETS - 1)
})

it("leaves a scene with no spread entirely alone", () => {
  for (let bucket = 0; bucket < HUE_BUCKETS; bucket++) {
    expect(bucketHue(210, 0, bucket)).toBe(210)
  }
})
