import { describe, expect, it } from "vitest"
import { packField, type Field } from "@/experiments/psyxels/field"
import type { CellStats, Mask } from "@/experiments/psyxels/mask"
import { DEFAULT_SETTINGS, type Settings } from "@/experiments/psyxels/settings"

/**
 * The packing.
 *
 * Every property here is one a screenshot cannot show. A field that tiles the
 * subject exactly and one that overlaps itself by a third both look like a
 * pleasant scatter of signs; so does one whose psyxels quietly restir every time
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
const EDGE = maskOf(640, 480, (x, y) => (x + y < 480 ? 1 : 0), (480 * 480) / 2)

/** Deliberately not `DEFAULT_SETTINGS`, which is editorial. */
const PLAIN: Settings = {
  ...DEFAULT_SETTINGS,
  seed: 11,
  // A share of the frame's shorter side: 80px against these 640×480 masks.
  coarse: 80 / 480,
  levels: 3,
  detail: 0,
  variety: 0,
  churn: 0,
  flicker: 0,
  threshold: 0.5,
  fuzz: 0,
}

const sizes = (field: Field) => field.psyxels().map((psyxel) => psyxel.size)

describe("subdivision", () => {
  it("leaves a flat subject as whole coarse squares when nothing asks for detail", () => {
    const field = packField(FLOOD, PLAIN, 0)
    expect(new Set(sizes(field))).toEqual(new Set([80]))
  })

  it("subdivides an edge down to the finest level, and only near the edge", () => {
    const field = packField(EDGE, { ...PLAIN, detail: 1 }, 0)
    const finest = 80 / 2 ** PLAIN.levels

    const small = field.psyxels().filter((psyxel) => psyxel.size === finest)
    expect(small.length).toBeGreaterThan(0)
    // Everything fine is on the edge; the flat interior stays whole.
    for (const psyxel of small) {
      const distance = Math.abs(psyxel.x + psyxel.size / 2 + psyxel.y + psyxel.size / 2 - 480)
      expect(distance).toBeLessThan(80)
    }
    expect(sizes(field)).toContain(80)
  })

  it("splits squares that had no need of it, in proportion to variety", () => {
    const calm = packField(FLOOD, { ...PLAIN, variety: 0.1 }, 0).psyxels().length
    const busy = packField(FLOOD, { ...PLAIN, variety: 0.9 }, 0).psyxels().length
    expect(busy).toBeGreaterThan(calm * 3)
  })

  it("never packs a psyxel below the legible minimum, whatever it is asked for", () => {
    const field = packField(EDGE, { ...PLAIN, coarse: 16 / 480, levels: 5, detail: 1, variety: 1 }, 0)
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
    const psyxels = field.psyxels()

    const area = psyxels.reduce((sum, psyxel) => sum + psyxel.size * psyxel.size, 0)
    const inked = psyxels.reduce((sum, psyxel) => sum + psyxel.ink * psyxel.size * psyxel.size, 0)
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
      const hits = psyxels.filter(
        (psyxel) => x >= psyxel.x && x < psyxel.x + psyxel.size && y >= psyxel.y && y < psyxel.y + psyxel.size,
      )
      expect(hits.length).toBeLessThanOrEqual(1)
    }
  })

  it("prunes squares with nothing under them rather than packing empty picture", () => {
    const field = packField(EDGE, PLAIN, 0)
    // Nothing is packed more than one coarse square beyond the ink.
    for (const psyxel of field.psyxels()) expect(psyxel.x + psyxel.y).toBeLessThan(480 + 80)
  })
})

describe("life", () => {
  it("holds every frame and every size when both rates are zero", () => {
    const field = packField(FLOOD, PLAIN, 0)
    const before = field.psyxels().map((psyxel) => `${psyxel.size}:${psyxel.glyph}`)

    for (let t = 0; t < 120; t += 0.5) field.update(t, PLAIN)

    expect(field.psyxels().map((psyxel) => `${psyxel.size}:${psyxel.glyph}`)).toEqual(before)
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
      const settings = { ...PLAIN, churn, variety: 0.64 }
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
   * The vocabulary is read live, so a psyxel can be left showing a frame that no
   * longer exists. It was, until this was caught: the field kept drawing rings
   * and crosses after the control said four.
   */
  it("brings a psyxel back into a vocabulary that has shrunk under it", () => {
    const wide = { ...PLAIN, flicker: 3, vocabulary: 9 }
    const field = packField(FLOOD, wide, 0)
    for (let t = 0; t < 10; t += 1 / 30) field.update(t, wide)
    expect(Math.max(...field.psyxels().map((psyxel) => psyxel.glyph))).toBeGreaterThan(3)

    const narrow = { ...wide, vocabulary: 2 }
    field.update(10, narrow)
    for (const psyxel of field.psyxels()) expect(psyxel.glyph).toBeLessThan(2)
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

    const key = (psyxel: { x: number; y: number }) => `${psyxel.x},${psyxel.y}`
    const byPlace = new Map(deep.psyxels().map((psyxel) => [key(psyxel), psyxel]))

    for (const psyxel of shallow.psyxels()) {
      const other = byPlace.get(key(psyxel))
      if (!other || other.size !== psyxel.size) continue
      expect(other.glyph).toBe(psyxel.glyph)
      expect(other.phase).toBeCloseTo(psyxel.phase, 12)
      expect(other.hue).toBeCloseTo(psyxel.hue, 12)
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

/**
 * How long a psyxel lasts, by how big it is.
 *
 * Nothing here is visible in a still and the whole of it was reported by eye:
 * the coarse marks looked like the only stable thing on screen while the grain
 * around them turned over. They were — a psyxel is ended by the first of its
 * ancestors to change its mind, and a coarse one has the fewest.
 */
describe("lifetimes", () => {
  /** Mean life of the leaves at each depth, measured by watching them go. */
  function livesByDepth(settings: Settings, until: number): number[] {
    const field = packField(FLOOD, settings, 0)
    const seen = new Map<string, { depth: number; born: number }>()
    const lives: number[][] = []

    const note = (time: number) => {
      const now = new Map<string, { depth: number; born: number }>()
      for (const psyxel of field.psyxels()) {
        const key = `${psyxel.x},${psyxel.y},${psyxel.size},${psyxel.born}`
        now.set(key, { depth: psyxel.depth, born: psyxel.born })
      }
      for (const [key, was] of seen) {
        if (now.has(key)) continue
        const at = was.depth
        lives[at] = lives[at] ?? []
        lives[at]!.push(time - was.born)
      }
      seen.clear()
      for (const [key, is] of now) seen.set(key, is)
    }

    for (let t = 0; t < until; t += 1 / 10) {
      field.update(t, settings)
      note(t)
    }
    return lives.map((at) => (at && at.length > 0 ? at.reduce((sum, life) => sum + life, 0) / at.length : 0))
  }

  it("does not let the coarse psyxels outlast the grain around them", () => {
    const lives = livesByDepth({ ...PLAIN, levels: 3, churn: 40, variety: 0.64, detail: 0 }, 400)
    const measured = lives.filter((life) => life > 0)
    expect(measured.length).toBeGreaterThan(2)

    /**
     * The coarsest may not outlast the shortest-lived by more than a half.
     *
     * The scene's `variety` is stated as the raw setting; `splitChance` caps it,
     * so the square's actual odds of dividing on a whim are a half.
     *
     * Measured on this scene, mean life in seconds by level, coarsest first:
     * **3.6, 2.1, 1.6, 1.7** with every square asking at the same rate, against
     * **2.0, 1.7, 1.7, 1.7** with the slowing in place. The coarse marks are the
     * ones the eye goes to, and they were sitting more than twice as long as the
     * grain around them.
     */
    expect(measured[0]! / Math.min(...measured)).toBeLessThan(1.5)
  })

  it("keeps a psyxel's life in proportion to the churn control at every size", () => {
    const slow = livesByDepth({ ...PLAIN, levels: 2, churn: 15, variety: 0.64, detail: 0 }, 400)
    const fast = livesByDepth({ ...PLAIN, levels: 2, churn: 60, variety: 0.64, detail: 0 }, 400)

    for (let depth = 0; depth < slow.length; depth++) {
      if (!(slow[depth]! > 0) || !(fast[depth]! > 0)) continue
      expect(slow[depth]! / fast[depth]!, `depth ${depth}`).toBeGreaterThan(2)
    }
  })
})

/**
 * A coarse psyxel coming and going must not restir the grain underneath it.
 *
 * Rebuilding the subtree on every split was the first version, and it gave a
 * square's fine psyxels a life no shorter than the coarse one covering them: any
 * ancestor changing its mind wiped them. Kept, they resume — same marks, same
 * colours, same places.
 */
describe("the grain under a coarse psyxel", () => {
  it("resumes where it left off after the square above it has been and gone", () => {
    // Flicker on, so a psyxel's frame wanders away from the one it was born
    // with — which is the only thing that tells a subtree being *resumed* from
    // one being built again. Rebuilt, its generator restarts and it comes back
    // showing its first frame.
    const settings = { ...PLAIN, levels: 1, churn: 40, flicker: 2, variety: 0.64, detail: 0 }
    const field = packField(FLOOD, settings, 0)

    const place = (psyxel: { x: number; y: number; size: number }) => `${psyxel.x},${psyxel.y},${psyxel.size}`
    const lastSeen = new Map<string, number>()
    const firstSeen = new Map<string, number>()
    let resumed = 0
    let restarted = 0

    for (let t = 0; t < 200; t += 1 / 10) {
      field.update(t, settings)
      const now = new Set<string>()
      for (const psyxel of field.psyxels()) {
        if (psyxel.depth !== 1) continue
        const key = place(psyxel)
        now.add(key)
        if (!firstSeen.has(key)) firstSeen.set(key, psyxel.glyph)
        const before = lastSeen.get(key)
        if (before === undefined) continue
        // Back after an absence: did it keep its frame, or start again?
        if (psyxel.born === t) {
          if (psyxel.glyph === before) resumed++
          else if (psyxel.glyph === firstSeen.get(key)) restarted++
        }
        lastSeen.set(key, psyxel.glyph)
      }
      for (const psyxel of field.psyxels()) if (psyxel.depth === 1) lastSeen.set(place(psyxel), psyxel.glyph)
      for (const key of [...lastSeen.keys()]) if (!now.has(key) && !firstSeen.has(key)) lastSeen.delete(key)
    }

    expect(resumed).toBeGreaterThan(0)
    expect(resumed).toBeGreaterThan(restarted)
  })
})

describe("a soft boundary", () => {
  it("lets an edge square decline to subdivide, so a coarse mark hangs over the edge", () => {
    const hard = packField(EDGE, { ...PLAIN, detail: 1, fuzz: 0 }, 0)
    const soft = packField(EDGE, { ...PLAIN, detail: 1, fuzz: 1 }, 0)

    const onEdge = (field: Field) =>
      field.psyxels().filter((psyxel) => psyxel.ink > 0.05 && psyxel.ink < 0.95 && psyxel.size >= 40)

    // With a hard boundary every square that straddles the edge is subdivided to
    // the finest level, so the artwork ends in a hairline however soft the marks
    // either side of it are.
    expect(onEdge(hard).length).toBe(0)
    expect(onEdge(soft).length).toBeGreaterThan(0)
  })

  it("costs psyxels, which is why it is only a third of the control", () => {
    const hard = packField(EDGE, { ...PLAIN, detail: 1, fuzz: 0 }, 0).psyxels().length
    const soft = packField(EDGE, { ...PLAIN, detail: 1, fuzz: 1 }, 0).psyxels().length
    // A square that declines is one psyxel where there would have been four, so
    // the whole field thins. At half the control it lost a third of them and the
    // letter went patchy; this bound is what keeps that in view.
    expect(soft).toBeGreaterThan(hard * 0.55)
    expect(soft).toBeLessThan(hard)
  })
})

describe("where a psyxel sits", () => {
  it("gives every psyxel its own offset inside its square, and the same one each time", () => {
    const field = packField(FLOOD, PLAIN, 0)
    const psyxels = field.psyxels()
    const offsets = psyxels.map((psyxel) => psyxel.offsetX)

    expect(Math.min(...offsets)).toBeLessThan(-0.5)
    expect(Math.max(...offsets)).toBeGreaterThan(0.5)

    const again = packField(FLOOD, PLAIN, 0).psyxels()
    for (let i = 0; i < psyxels.length; i++) {
      expect(again[i]!.offsetX).toBe(psyxels[i]!.offsetX)
      expect(again[i]!.offsetY).toBe(psyxels[i]!.offsetY)
    }
  })
})
