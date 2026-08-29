import { describe, expect, it } from "vitest"
import { packField, type Field } from "@/experiments/psyxels/field"
import type { CellStats, Mask } from "@/experiments/psyxels/mask"
import { DEFAULT_SETTINGS, type Settings } from "@/experiments/psyxels/settings"

/**
 * The packing.
 *
 * Every property here is one a screenshot cannot show. A field that tiles the
 * subject exactly and one that overlaps itself by a third both look like a
 * pleasant scatter of signs; so does one whose pixels quietly restir every time
 * an unrelated control moves.
 *
 * The mask is synthetic on purpose — a rectangle of ink with an exactly known
 * area — because the question here is what the subdivision does with coverage,
 * not what a rasteriser produces.
 */

/** A mask from a coverage function, sampled the way the real one is. */
function maskOf(width: number, height: number, ink: (x: number, y: number) => number, total = 0): Mask {
  const samples = 8
  return {
    width,
    height,
    scale: 1,
    total,
    stats(x, y, size): CellStats {
      let sum = 0
      let squares = 0
      for (let row = 0; row < samples; row++) {
        for (let column = 0; column < samples; column++) {
          const px = x + ((column + 0.5) * size) / samples
          const py = y + ((row + 0.5) * size) / samples
          // Outside the frame there is no picture, which is what the real
          // mask's tables say too: they are clamped to the grid, so a square
          // overhanging the frame reports the mean of the part that is on it.
          const value = px < 0 || py < 0 || px >= width || py >= height ? 0 : ink(px, py)
          sum += value
          squares += value * value
        }
      }
      const count = samples * samples
      const mean = sum / count
      return { ink: mean, dev: Math.sqrt(Math.max(0, squares / count - mean * mean)), r: 1, g: 1, b: 1 }
    },
  }
}

/** Ink everywhere: nothing to split for, so only `variety` can. */
const FLOOD = maskOf(640, 480, () => 1, 640 * 480)

/**
 * A hard diagonal edge: the case detail exists for.
 *
 * Diagonal rather than vertical, and that is not decoration. A vertical edge on
 * a round number lands *on* a cell boundary two levels down, and both children
 * are then uniform — so subdivision correctly stops, and a test asking for the
 * finest level fails against a field that is doing exactly the right thing.
 */
const EDGE = maskOf(640, 480, (x, y) => (x + y < 480 ? 1 : 0), 480 * 480 / 2)

/** Deliberately not `DEFAULT_SETTINGS`, which is editorial. */
const PLAIN: Settings = {
  ...DEFAULT_SETTINGS,
  seed: 11,
  coarse: 80,
  levels: 3,
  detail: 0,
  variety: 0,
  churn: 0,
  flicker: 0,
  threshold: 0.5,
}

const sizes = (field: Field) => field.pixels().map((pixel) => pixel.size)

describe("subdivision", () => {
  it("leaves a flat subject as whole coarse squares when nothing asks for detail", () => {
    const field = packField(FLOOD, PLAIN, 0)
    expect(new Set(sizes(field))).toEqual(new Set([80]))
  })

  it("subdivides an edge down to the finest level, and only near the edge", () => {
    const field = packField(EDGE, { ...PLAIN, detail: 1 }, 0)
    const finest = 80 / 2 ** PLAIN.levels

    const small = field.pixels().filter((pixel) => pixel.size === finest)
    expect(small.length).toBeGreaterThan(0)
    // Everything fine is on the edge; the flat interior stays whole.
    for (const pixel of small) {
      const distance = Math.abs(pixel.x + pixel.size / 2 + pixel.y + pixel.size / 2 - 480)
      expect(distance).toBeLessThan(80)
    }
    expect(sizes(field)).toContain(80)
  })

  it("splits squares that had no need of it, in proportion to variety", () => {
    const calm = packField(FLOOD, { ...PLAIN, variety: 0.1 }, 0).pixels().length
    const busy = packField(FLOOD, { ...PLAIN, variety: 0.9 }, 0).pixels().length
    expect(busy).toBeGreaterThan(calm * 3)
  })

  it("never packs a pixel below the legible minimum, whatever it is asked for", () => {
    const field = packField(EDGE, { ...PLAIN, coarse: 16, levels: 5, detail: 1, variety: 1 }, 0)
    expect(Math.min(...sizes(field))).toBeGreaterThanOrEqual(3)
  })
})

describe("the cover", () => {
  /**
   * The reason the packing is a subdivision rather than a bin-pack: the squares
   * tile exactly, at every mixture of sizes, with no arithmetic to get wrong.
   */
  it("covers the inked area exactly once, at any mixture of sizes", () => {
    const field = packField(EDGE, { ...PLAIN, detail: 0.8, variety: 0.6 }, 0)
    const pixels = field.pixels()

    const area = pixels.reduce((sum, pixel) => sum + pixel.size * pixel.size, 0)
    const inked = pixels.reduce((sum, pixel) => sum + pixel.ink * pixel.size * pixel.size, 0)
    // Every square carrying ink is accounted for exactly once, so the ink under
    // the field is the ink in the picture — no square counted twice, none missed.
    expect(inked / EDGE.total).toBeCloseTo(1, 1)
    expect(area).toBeGreaterThan(inked)

    // And no two squares overlap: sampled points land in exactly one.
    for (const [x, y] of [
      [100, 100],
      [239, 240],
      [321, 91],
      [500, 400],
    ]) {
      const hits = pixels.filter(
        (pixel) => x >= pixel.x && x < pixel.x + pixel.size && y >= pixel.y && y < pixel.y + pixel.size,
      )
      expect(hits.length).toBeLessThanOrEqual(1)
    }
  })

  it("prunes squares with nothing under them rather than packing empty picture", () => {
    const field = packField(EDGE, PLAIN, 0)
    // Nothing is packed more than one coarse square beyond the ink.
    for (const pixel of field.pixels()) expect(pixel.x + pixel.y).toBeLessThan(480 + 80)
  })
})

describe("life", () => {
  it("holds every frame and every size when both rates are zero", () => {
    const field = packField(FLOOD, PLAIN, 0)
    const before = field.pixels().map((pixel) => `${pixel.size}:${pixel.glyph}`)

    for (let t = 0; t < 120; t += 0.5) field.update(t, PLAIN)

    expect(field.pixels().map((pixel) => `${pixel.size}:${pixel.glyph}`)).toEqual(before)
    expect(field.changes()).toBe(0)
    expect(field.flicks()).toBe(0)
  })

  it("changes frames without ever changing a size", () => {
    const settings = { ...PLAIN, flicker: 4 }
    const field = packField(FLOOD, settings, 0)
    const before = sizes(field)

    for (let t = 0; t < 30; t += 1 / 30) field.update(t, settings)

    expect(field.flicks()).toBeGreaterThan(0)
    expect(field.changes()).toBe(0)
    expect(sizes(field)).toEqual(before)
  })

  /**
   * **Churn re-asks the question; variety is what makes the answer change.**
   *
   * A square that has no reason to be four squares and no whim about it is
   * stable however fast it is asked, which is why turning churn up on a scene
   * with no variety does nothing at all. Worth pinning, because the obvious
   * implementation — reshuffle on a timer — gives a field that boils at every
   * setting and cannot be held still.
   */
  it("leaves the packing alone when churn has nothing to be undecided about", () => {
    const settings = { ...PLAIN, churn: 60, variety: 0, detail: 0 }
    const field = packField(FLOOD, settings, 0)

    for (let t = 0; t < 60; t += 1 / 30) field.update(t, settings)

    expect(field.changes()).toBe(0)
  })

  it("repacks at a rate that follows the churn control", () => {
    const run = (churn: number, until: number) => {
      const settings = { ...PLAIN, churn, variety: 0.5 }
      const field = packField(FLOOD, settings, 0)
      for (let t = 0; t < until; t += 1 / 30) field.update(t, settings)
      return field.changes()
    }

    const slow = run(6, 60)
    const fast = run(60, 60)
    const longer = run(60, 120)

    expect(slow).toBeGreaterThan(0)
    // An order of magnitude more asking, most of the way to an order of
    // magnitude more changing — not exactly, because a square that has just
    // decided to split has fewer ways to change its mind next time.
    expect(fast).toBeGreaterThan(slow * 4)
    // And it is a rate, not a burst: twice the time is about twice the changes.
    expect(longer / fast).toBeGreaterThan(1.6)
    expect(longer / fast).toBeLessThan(2.4)
  })

  /**
   * The vocabulary is read live, so a pixel can be left showing a frame that no
   * longer exists. It was, until this was caught: the field kept drawing rings
   * and crosses after the control said four.
   */
  it("brings a pixel back into a vocabulary that has shrunk under it", () => {
    const wide = { ...PLAIN, flicker: 3, vocabulary: 9 }
    const field = packField(FLOOD, wide, 0)
    for (let t = 0; t < 10; t += 1 / 30) field.update(t, wide)
    expect(Math.max(...field.pixels().map((pixel) => pixel.glyph))).toBeGreaterThan(3)

    const narrow = { ...wide, vocabulary: 2 }
    field.update(10, narrow)
    for (const pixel of field.pixels()) expect(pixel.glyph).toBeLessThan(2)
  })
})

describe("stability", () => {
  /**
   * A square's identity is *where it is*, not when it was made. Break this and
   * raising the subdivision restirs the whole picture instead of adding to it —
   * the same class of bug as Dangler's anchors and Flotsam's specks.
   */
  it("gives a square the same life wherever else the field changed", () => {
    const shallow = packField(FLOOD, { ...PLAIN, levels: 1 }, 0)
    const deep = packField(FLOOD, { ...PLAIN, levels: 3 }, 0)

    const key = (pixel: { x: number; y: number }) => `${pixel.x},${pixel.y}`
    const byPlace = new Map(deep.pixels().map((pixel) => [key(pixel), pixel]))

    for (const pixel of shallow.pixels()) {
      const other = byPlace.get(key(pixel))
      if (!other || other.size !== pixel.size) continue
      expect(other.glyph).toBe(pixel.glyph)
      expect(other.phase).toBeCloseTo(pixel.phase, 12)
      expect(other.hue).toBeCloseTo(pixel.hue, 12)
    }
  })

  it("packs the same field twice from one seed, and a different one from another", () => {
    const settings = { ...PLAIN, variety: 0.5, detail: 0.6 }
    const once = sizes(packField(EDGE, settings, 0))
    const again = sizes(packField(EDGE, settings, 0))
    const other = sizes(packField(EDGE, { ...settings, seed: 12 }, 0))

    expect(again).toEqual(once)
    expect(other).not.toEqual(once)
  })
})
