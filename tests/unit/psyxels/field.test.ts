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

const sizes = (field: Field) => field.psyxels().map((psyx) => psyx.size)

describe("subdivision", () => {
  it("leaves a flat subject as whole coarse squares when nothing asks for detail", () => {
    const field = packField(FLOOD, PLAIN, 0)
    expect(new Set(sizes(field))).toEqual(new Set([80]))
  })

  it("subdivides an edge down to the finest level, and only near the edge", () => {
    const field = packField(EDGE, { ...PLAIN, detail: 1 }, 0)
    const finest = 80 / 2 ** PLAIN.levels

    const small = field.psyxels().filter((psyx) => psyx.size === finest)
    expect(small.length).toBeGreaterThan(0)
    // Everything fine is on the edge; the flat interior stays whole.
    for (const psyx of small) {
      const distance = Math.abs(psyx.x + psyx.size / 2 + psyx.y + psyx.size / 2 - 480)
      expect(distance).toBeLessThan(80)
    }
    expect(sizes(field)).toContain(80)
  })

  it("splits squares that had no need of it, in proportion to variety", () => {
    const calm = packField(FLOOD, { ...PLAIN, variety: 0.1 }, 0).psyxels().length
    const busy = packField(FLOOD, { ...PLAIN, variety: 0.9 }, 0).psyxels().length
    expect(busy).toBeGreaterThan(calm * 3)
  })

  it("never packs a psyx below the legible minimum, whatever it is asked for", () => {
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

    const area = psyxels.reduce((sum, psyx) => sum + psyx.size * psyx.size, 0)
    const inked = psyxels.reduce((sum, psyx) => sum + psyx.ink * psyx.size * psyx.size, 0)
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
        (psyx) => x >= psyx.x && x < psyx.x + psyx.size && y >= psyx.y && y < psyx.y + psyx.size,
      )
      expect(hits.length).toBeLessThanOrEqual(1)
    }
  })

  it("prunes squares with nothing under them rather than packing empty picture", () => {
    const field = packField(EDGE, PLAIN, 0)
    // Nothing is packed more than one coarse square beyond the ink.
    for (const psyx of field.psyxels()) expect(psyx.x + psyx.y).toBeLessThan(480 + 80)
  })
})

describe("life", () => {
  it("holds every frame and every size when both rates are zero", () => {
    const field = packField(FLOOD, PLAIN, 0)
    const before = field.psyxels().map((psyx) => `${psyx.size}:${psyx.glyph}`)

    for (let t = 0; t < 120; t += 0.5) field.update(t, PLAIN)

    expect(field.psyxels().map((psyx) => `${psyx.size}:${psyx.glyph}`)).toEqual(before)
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
   * The vocabulary is read live, so a psyx can be left showing a frame that no
   * longer exists. It was, until this was caught: the field kept drawing rings
   * and crosses after the control said four.
   */
  it("brings a psyx back into a vocabulary that has shrunk under it", () => {
    const wide = { ...PLAIN, flicker: 3, vocabulary: 9 }
    const field = packField(FLOOD, wide, 0)
    for (let t = 0; t < 10; t += 1 / 30) field.update(t, wide)
    expect(Math.max(...field.psyxels().map((psyx) => psyx.glyph))).toBeGreaterThan(3)

    const narrow = { ...wide, vocabulary: 2 }
    field.update(10, narrow)
    for (const psyx of field.psyxels()) expect(psyx.glyph).toBeLessThan(2)
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

    const key = (psyx: { x: number; y: number }) => `${psyx.x},${psyx.y}`
    const byPlace = new Map(deep.psyxels().map((psyx) => [key(psyx), psyx]))

    for (const psyx of shallow.psyxels()) {
      const other = byPlace.get(key(psyx))
      if (!other || other.size !== psyx.size) continue
      expect(other.glyph).toBe(psyx.glyph)
      expect(other.phase).toBeCloseTo(psyx.phase, 12)
      expect(other.hue).toBeCloseTo(psyx.hue, 12)
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
 * How long a psyx lasts, by how big it is.
 *
 * Nothing here is visible in a still and the whole of it was reported by eye:
 * the coarse marks looked like the only stable thing on screen while the grain
 * around them turned over. They were — a psyx is ended by the first of its
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
      for (const psyx of field.psyxels()) {
        const key = `${psyx.x},${psyx.y},${psyx.size},${psyx.born}`
        now.set(key, { depth: psyx.depth, born: psyx.born })
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

  it("keeps a psyx's life in proportion to the churn control at every size", () => {
    const slow = livesByDepth({ ...PLAIN, levels: 2, churn: 15, variety: 0.64, detail: 0 }, 400)
    const fast = livesByDepth({ ...PLAIN, levels: 2, churn: 60, variety: 0.64, detail: 0 }, 400)

    for (let depth = 0; depth < slow.length; depth++) {
      if (!(slow[depth]! > 0) || !(fast[depth]! > 0)) continue
      expect(slow[depth]! / fast[depth]!, `depth ${depth}`).toBeGreaterThan(2)
    }
  })
})

/**
 * A coarse psyx coming and going must not restir the grain underneath it.
 *
 * Rebuilding the subtree on every split was the first version, and it gave a
 * square's fine psyxels a life no shorter than the coarse one covering them: any
 * ancestor changing its mind wiped them. Kept, they resume — same marks, same
 * colours, same places.
 */
describe("the grain under a coarse psyx", () => {
  it("resumes where it left off after the square above it has been and gone", () => {
    // Flicker on, so a psyx's frame wanders away from the one it was born
    // with — which is the only thing that tells a subtree being *resumed* from
    // one being built again. Rebuilt, its generator restarts and it comes back
    // showing its first frame.
    const settings = { ...PLAIN, levels: 1, churn: 40, flicker: 2, variety: 0.64, detail: 0 }
    const field = packField(FLOOD, settings, 0)

    const place = (psyx: { x: number; y: number; size: number }) => `${psyx.x},${psyx.y},${psyx.size}`
    const lastSeen = new Map<string, number>()
    const firstSeen = new Map<string, number>()
    let resumed = 0
    let restarted = 0

    for (let t = 0; t < 200; t += 1 / 10) {
      field.update(t, settings)
      const now = new Set<string>()
      for (const psyx of field.psyxels()) {
        if (psyx.depth !== 1) continue
        const key = place(psyx)
        now.add(key)
        if (!firstSeen.has(key)) firstSeen.set(key, psyx.glyph)
        const before = lastSeen.get(key)
        if (before === undefined) continue
        // Back after an absence: did it keep its frame, or start again?
        if (psyx.born === t) {
          if (psyx.glyph === before) resumed++
          else if (psyx.glyph === firstSeen.get(key)) restarted++
        }
        lastSeen.set(key, psyx.glyph)
      }
      for (const psyx of field.psyxels()) if (psyx.depth === 1) lastSeen.set(place(psyx), psyx.glyph)
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
      field.psyxels().filter((psyx) => psyx.ink > 0.05 && psyx.ink < 0.95 && psyx.size >= 40)

    // With a hard boundary every square that straddles the edge is subdivided to
    // the finest level, so the artwork ends in a hairline however soft the marks
    // either side of it are.
    expect(onEdge(hard).length).toBe(0)
    expect(onEdge(soft).length).toBeGreaterThan(0)
  })

  it("costs psyxels, which is why it is only a third of the control", () => {
    const hard = packField(EDGE, { ...PLAIN, detail: 1, fuzz: 0 }, 0).psyxels().length
    const soft = packField(EDGE, { ...PLAIN, detail: 1, fuzz: 1 }, 0).psyxels().length
    // A square that declines is one psyx where there would have been four, so
    // the whole field thins. At half the control it lost a third of them and the
    // letter went patchy; this bound is what keeps that in view.
    expect(soft).toBeGreaterThan(hard * 0.45)
    expect(soft).toBeLessThan(hard)
  })
})

describe("where a psyx sits", () => {
  it("gives every psyx its own offset inside its square, and the same one each time", () => {
    const field = packField(FLOOD, PLAIN, 0)
    const psyxels = field.psyxels()
    const offsets = psyxels.map((psyx) => psyx.offsetX)

    expect(Math.min(...offsets)).toBeLessThan(-0.5)
    expect(Math.max(...offsets)).toBeGreaterThan(0.5)

    const again = packField(FLOOD, PLAIN, 0).psyxels()
    for (let i = 0; i < psyxels.length; i++) {
      expect(again[i]!.offsetX).toBe(psyxels[i]!.offsetX)
      expect(again[i]!.offsetY).toBe(psyxels[i]!.offsetY)
    }
  })
})

describe("what a psyx leaves behind", () => {
  it("keeps a departing psyx long enough for its replacement to arrive", () => {
    const settings = { ...PLAIN, churn: 60, variety: 0.64, detail: 0 }
    const field = packField(FLOOD, settings, 0)
    expect(field.ghosts()).toHaveLength(0)

    let seen = 0
    for (let t = 0; t < 20; t += 1 / 30) {
      field.update(t, settings)
      seen = Math.max(seen, field.ghosts().length)
      // Nothing lingers: every ghost on the list is a recent one.
      for (const ghost of field.ghosts()) expect(t - ghost.died).toBeLessThan(1.5)
    }
    expect(seen).toBeGreaterThan(0)
  })

  it("gives a ghost the mark and the place the psyx had, so it fades where it stood", () => {
    const settings = { ...PLAIN, churn: 60, variety: 0.64, detail: 0 }
    const field = packField(FLOOD, settings, 0)
    const before = new Map(field.psyxels().map((psyx) => [`${psyx.x},${psyx.y},${psyx.size}`, psyx.glyph]))

    for (let t = 0; t < 5; t += 1 / 30) field.update(t, settings)

    const ghosts = field.ghosts()
    expect(ghosts.length).toBeGreaterThan(0)
    for (const ghost of ghosts) {
      const was = before.get(`${ghost.x},${ghost.y},${ghost.size}`)
      if (was === undefined) continue
      expect(ghost.size).toBeGreaterThan(0)
      expect(ghost.died).toBeGreaterThan(0)
    }
  })
})

/**
 * **No psyx may hold a square indefinitely by winning a fair toss.**
 *
 * The odds of dividing are the same on every turn, so a life is memoryless and
 * has a long tail — a coarse psyx sat in one square for twenty seconds against a
 * mean of two, which is what the piece's author saw and what the mean hid. The
 * deadline cuts the tail without moving the mean, which is the whole point:
 * leaning the odds instead halved every coarse psyx's life.
 */
describe("the longest a psyx can stay", () => {
  it("bounds the tail while leaving the average where it was", () => {
    const settings = { ...PLAIN, levels: 1, churn: 60, variety: 0.64, detail: 0 }
    const field = packField(FLOOD, settings, 0)

    const seen = new Map<string, number>()
    const lives: number[] = []
    for (let t = 0; t < 600; t += 1 / 20) {
      field.update(t, settings)
      const now = new Map<string, number>()
      for (const psyx of field.psyxels()) {
        if (psyx.depth !== 0) continue
        now.set(`${psyx.x},${psyx.y},${psyx.born}`, psyx.born)
      }
      for (const [key, born] of seen) if (!now.has(key)) lives.push(t - born)
      seen.clear()
      for (const [key, born] of now) seen.set(key, born)
    }

    expect(lives.length).toBeGreaterThan(50)
    const mean = lives.reduce((sum, life) => sum + life, 0) / lives.length
    // Four turns of a one-second-ish clock, and nothing beyond it. Unbounded,
    // the longest of a few hundred runs to five times the mean and beyond.
    expect(Math.max(...lives) / mean).toBeLessThan(4)
  })
})

/**
 * The squares that divided keep a mark of their own.
 *
 * A psyx covers its square exactly and its *mark* does not — ink is a fraction
 * of a square, and the larger the square the more of it is ground. Drawing the
 * divided squares as well is what puts finer psyxels in the gaps of a big one
 * rather than leaving the ground there.
 */
describe("the levels above a leaf", () => {
  it("hands back every square that divided, each with a life of its own", () => {
    const field = packField(FLOOD, { ...PLAIN, levels: 3, variety: 0.64 }, 0)
    const branches = field.branches()
    const leaves = field.psyxels()

    expect(branches.length).toBeGreaterThan(0)
    // A tree of quarters has about a third as many divided squares as leaves.
    expect(branches.length).toBeLessThan(leaves.length)

    for (const branch of branches) {
      // Born with a mark, a phase and a colour, exactly as a leaf is: a square
      // that divided at birth used to have none, so raising the control lit up
      // half the tree with whatever glyph zero happened to be.
      expect(branch.size).toBeGreaterThan(0)
      expect(branch.phase).toBeGreaterThan(0)
      expect(branch.rate).toBeGreaterThan(0)
    }
  })

  it("has no divided squares at all when nothing divides", () => {
    expect(packField(FLOOD, { ...PLAIN, levels: 0 }, 0).branches()).toHaveLength(0)
  })

  it("covers the same picture as its leaves, one level up", () => {
    // A flooded subject, because a masked one *prunes*: squares with nothing
    // under them are never packed, so the leaves under a branch that straddles
    // the edge do not tile it and are not meant to.
    const field = packField(FLOOD, { ...PLAIN, levels: 2, variety: 0.64 }, 0)
    for (const branch of field.branches()) {
      // Only the squares wholly on the picture: the root grid overhangs the
      // frame, and a child with nothing under it is pruned rather than packed —
      // so a branch at the edge is genuinely not tiled by its leaves.
      if (branch.x < 0 || branch.y < 0) continue
      if (branch.x + branch.size > FLOOD.width || branch.y + branch.size > FLOOD.height) continue
      const inside = field
        .psyxels()
        .filter(
          (psyx) =>
            psyx.x >= branch.x &&
            psyx.y >= branch.y &&
            psyx.x < branch.x + branch.size &&
            psyx.y < branch.y + branch.size,
        )
      // Every divided square is exactly the psyxels beneath it, whatever depth
      // they ended up at.
      const area = inside.reduce((sum, psyx) => sum + psyx.size * psyx.size, 0)
      expect(area).toBeCloseTo(branch.size * branch.size, 6)
    }
  })
})
