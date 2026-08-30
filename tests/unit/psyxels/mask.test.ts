import { describe, expect, it } from "vitest"
import { buildMask, maskSize } from "@/experiments/psyxels/mask"

/**
 * The coverage tables.
 *
 * Everything the packing decides comes from two numbers this hands back, so an
 * error here is invisible and total: a mean that is slightly wrong moves every
 * edge, and a variance that is wrong puts the small pixels somewhere other than
 * where the picture has detail.
 *
 * The canvas is a stand-in rather than a real one — the arithmetic is the
 * subject, not the rasteriser — so the tests state the pixels directly.
 */

type Paint = (x: number, y: number) => [number, number, number, number]

function canvasOf(cols: number, rows: number, paint: Paint): HTMLCanvasElement {
  const data = new Uint8ClampedArray(cols * rows * 4)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const [r, g, b, a] = paint(x, y)
      const p = (y * cols + x) * 4
      data[p] = r
      data[p + 1] = g
      data[p + 2] = b
      data[p + 3] = a
    }
  }
  return {
    width: cols,
    height: rows,
    getContext: () => ({ getImageData: () => ({ data }) }),
  } as unknown as HTMLCanvasElement
}

const WHITE: [number, number, number, number] = [255, 255, 255, 255]
const NOTHING: [number, number, number, number] = [0, 0, 0, 0]

describe("coverage", () => {
  it("reads a solid subject as full coverage with no variation", () => {
    const mask = buildMask(
      canvasOf(64, 64, () => WHITE),
      64,
      64,
    )
    const stats = mask.stats(8, 8, 16)
    expect(stats.ink).toBeCloseTo(1, 6)
    expect(stats.dev).toBeCloseTo(0, 6)
    expect(mask.total).toBeCloseTo(64 * 64, 3)
  })

  it("reads an edge through a square as half coverage and maximum variation", () => {
    const mask = buildMask(
      canvasOf(64, 64, (x) => (x < 32 ? WHITE : NOTHING)),
      64,
      64,
    )
    const across = mask.stats(0, 0, 64)
    expect(across.ink).toBeCloseTo(0.5, 6)
    // A hard edge splitting a square in two is the widest a coverage can vary,
    // and it is what the detail threshold is calibrated against.
    expect(across.dev).toBeCloseTo(0.5, 6)

    // Either side of it is flat, which is why subdivision stops there.
    expect(mask.stats(0, 0, 16).dev).toBeCloseTo(0, 6)
    expect(mask.stats(40, 0, 16).ink).toBeCloseTo(0, 6)
  })

  it("weights colour by ink, so an edge takes the colour of the lit side", () => {
    const mask = buildMask(
      canvasOf(64, 64, (x) => (x < 32 ? [255, 0, 0, 255] : NOTHING)),
      64,
      64,
    )
    const stats = mask.stats(0, 0, 64)
    // Half the square is unlit, and the answer is still red rather than a
    // half-strength red — the square is red picture that happens to be half
    // empty. Averaged flat, every edge in a portrait drags toward the ground.
    expect(stats.r).toBeCloseTo(1, 6)
    expect(stats.g).toBeCloseTo(0, 6)
    expect(stats.b).toBeCloseTo(0, 6)
  })

  it("has nothing to say about a square outside the picture", () => {
    const mask = buildMask(
      canvasOf(32, 32, () => WHITE),
      32,
      32,
    )
    const outside = mask.stats(-40, -40, 20)
    expect(outside.ink).toBe(0)
    expect(outside.dev).toBe(0)
  })
})

describe("the white point", () => {
  /**
   * Without this, `threshold` means something different for every subject: the
   * portrait's brightest tone is a lit forehead well short of white, and the
   * controls calibrated on a white letter put the whole picture in the bottom
   * third of the scale.
   */
  it("stretches a subject that never reaches white up to it", () => {
    const dim = buildMask(
      canvasOf(64, 64, () => [128, 128, 128, 255]),
      64,
      64,
    )
    expect(dim.stats(0, 0, 64).ink).toBeCloseTo(1, 1)
  })

  it("leaves a subject that already reaches white alone", () => {
    const mask = buildMask(
      canvasOf(64, 64, (x) => (x < 32 ? WHITE : [64, 64, 64, 255])),
      64,
      64,
    )
    expect(mask.stats(0, 0, 32).ink).toBeCloseTo(1, 2)
    expect(mask.stats(32, 0, 32).ink).toBeCloseTo(64 / 255, 1)
  })

  /**
   * A single specular highlight is enough to set the point at white and undo
   * the stretch entirely, and photographs have those.
   */
  it("ignores a handful of the very brightest pixels", () => {
    const mask = buildMask(
      canvasOf(64, 64, (x, y) => (x === 0 && y === 0 ? WHITE : [120, 120, 120, 255])),
      64,
      64,
    )
    expect(mask.stats(10, 10, 20).ink).toBeGreaterThan(0.9)
  })
})

describe("the sampling grid", () => {
  it("is the frame itself until the frame is large, and never an upsample", () => {
    expect(maskSize(640, 480)).toEqual({ cols: 640, rows: 480 })
    const big = maskSize(3840, 2160)
    expect(Math.max(big.cols, big.rows)).toBeLessThanOrEqual(900)
    expect(big.cols / big.rows).toBeCloseTo(3840 / 2160, 2)
  })
})
