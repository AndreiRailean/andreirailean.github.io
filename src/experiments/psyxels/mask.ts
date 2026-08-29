/**
 * The subject as a field of coverage: what a cell of any size and position can
 * ask about the picture underneath it.
 *
 * Two questions, and both have to be answered thousands of times a frame at
 * every scale at once: *how much ink is under this square*, and *how uneven is
 * it*. The second is the one that keeps the letter legible — a square straddling
 * an edge is uneven, and unevenness is what forces the packing to subdivide, so
 * detail lands where the picture has detail without anything here knowing what
 * the picture is.
 *
 * Both come from summed-area tables, which answer any axis-aligned rectangle in
 * four lookups regardless of its size. A hundred-pixel cell and a three-pixel
 * cell cost the same, which is the whole reason the piece can pack squares of
 * wildly different sizes without the large ones being expensive.
 *
 * **Colour is ink-weighted, and that is not a detail.** A cell half over a lit
 * cheek and half over black is not a dim grey cell; it is a cell of cheek that
 * happens to be half empty. Averaging colour flat would drag every edge in a
 * portrait toward the ground and the face would come out ringed with mud.
 */

/** Longest side of the sampling grid. Beyond this the tables cost more than they buy. */
const MAX_SIDE = 900

export type CellStats = {
  /** Mean coverage under the square, 0 to 1. */
  ink: number
  /** Standard deviation of coverage under it: 0 flat, 0.5 a hard edge through the middle. */
  dev: number
  /** Ink-weighted mean colour, each channel 0 to 1. */
  r: number
  g: number
  b: number
}

export type Mask = {
  /** Frame size the tables were built for, in CSS pixels. */
  width: number
  height: number
  /** Grid samples per CSS pixel. At most 1: the grid is a downsample, never an upsample. */
  scale: number
  /** Total ink in the picture, in CSS pixels squared. The denominator of every coverage figure. */
  total: number
  stats: (x: number, y: number, size: number) => CellStats
}

const EMPTY: CellStats = { ink: 0, dev: 0, r: 0, g: 0, b: 0 }

/**
 * Reads a painted canvas into the tables.
 *
 * Ink is alpha × luminance, which unifies the two kinds of subject: a white
 * letter on transparency is its own antialiased coverage, and a photograph is
 * its own tonality. In both cases black is *nothing there* rather than something
 * dark, which is what lets one threshold control sculpt a letterform and a face.
 */
export function buildMask(source: HTMLCanvasElement, width: number, height: number): Mask {
  const cols = source.width
  const rows = source.height
  const scale = cols / width

  const context = source.getContext("2d", { willReadFrequently: true })
  const pixels = context ? context.getImageData(0, 0, cols, rows).data : new Uint8ClampedArray(cols * rows * 4)

  const gain = 1 / whitePoint(pixels)

  // One row and column of zeros on the top and left, so a lookup never needs a
  // bounds test — the standard summed-area layout.
  const stride = cols + 1
  const satInk = new Float32Array(stride * (rows + 1))
  const satSquare = new Float32Array(stride * (rows + 1))
  const satR = new Float32Array(stride * (rows + 1))
  const satG = new Float32Array(stride * (rows + 1))
  const satB = new Float32Array(stride * (rows + 1))

  for (let y = 0; y < rows; y++) {
    let runInk = 0
    let runSquare = 0
    let runR = 0
    let runG = 0
    let runB = 0
    for (let x = 0; x < cols; x++) {
      const p = (y * cols + x) * 4
      const r = pixels[p]! / 255
      const g = pixels[p + 1]! / 255
      const b = pixels[p + 2]! / 255
      const alpha = pixels[p + 3]! / 255
      const ink = Math.min(1, alpha * (0.2126 * r + 0.7152 * g + 0.0722 * b) * gain)

      runInk += ink
      runSquare += ink * ink
      runR += r * ink
      runG += g * ink
      runB += b * ink

      const here = (y + 1) * stride + (x + 1)
      const above = y * stride + (x + 1)
      satInk[here] = satInk[above]! + runInk
      satSquare[here] = satSquare[above]! + runSquare
      satR[here] = satR[above]! + runR
      satG[here] = satG[above]! + runG
      satB[here] = satB[above]! + runB
    }
  }

  const sum = (table: Float32Array, x0: number, y0: number, x1: number, y1: number) =>
    table[y1 * stride + x1]! - table[y0 * stride + x1]! - table[y1 * stride + x0]! + table[y0 * stride + x0]!

  const total = satInk[rows * stride + cols]! / (scale * scale)

  return {
    width,
    height,
    scale,
    total,

    stats(x, y, size) {
      const x0 = Math.max(0, Math.min(cols, Math.round(x * scale)))
      const y0 = Math.max(0, Math.min(rows, Math.round(y * scale)))
      const x1 = Math.max(x0, Math.min(cols, Math.round((x + size) * scale)))
      const y1 = Math.max(y0, Math.min(rows, Math.round((y + size) * scale)))
      const area = (x1 - x0) * (y1 - y0)
      if (area === 0) return EMPTY

      const ink = sum(satInk, x0, y0, x1, y1) / area
      // Variance from the mean of squares. Clamped at zero: the two tables are
      // accumulated separately, so cancellation can put a flat cell a hair below
      // it, and a negative under the root is a NaN that spreads.
      const variance = Math.max(0, sum(satSquare, x0, y0, x1, y1) / area - ink * ink)

      const weight = sum(satInk, x0, y0, x1, y1)
      if (weight <= 0) return { ink: 0, dev: Math.sqrt(variance), r: 0, g: 0, b: 0 }

      return {
        ink,
        dev: Math.sqrt(variance),
        r: sum(satR, x0, y0, x1, y1) / weight,
        g: sum(satG, x0, y0, x1, y1) / weight,
        b: sum(satB, x0, y0, x1, y1) / weight,
      }
    },
  }
}

/**
 * The subject's own white point: the brightest tone it actually contains,
 * ignoring the top half per cent.
 *
 * Without this, `threshold` means something different for every subject. A white
 * letter runs the full range and its controls are calibrated against that; the
 * portrait's brightest pixel is a lit forehead well short of white and its
 * darkest useful tone is a wall not far below it, so the same settings landed
 * the whole picture in the bottom third of the scale and it came out as a brown
 * smear on black. Stretching to the top of what is there costs the letter
 * nothing — its white point *is* white — and hands the photograph the range the
 * controls expect.
 *
 * The half per cent matters: a single specular highlight is enough to set the
 * point at 1 and undo the stretch entirely, and photographs have those.
 */
function whitePoint(pixels: Uint8ClampedArray): number {
  const bins = new Uint32Array(64)
  let seen = 0
  for (let p = 0; p < pixels.length; p += 4) {
    const alpha = pixels[p + 3]! / 255
    if (alpha <= 0) continue
    const ink = alpha * (0.2126 * pixels[p]! + 0.7152 * pixels[p + 1]! + 0.0722 * pixels[p + 2]!) / 255
    if (ink <= 0.02) continue
    bins[Math.min(63, Math.floor(ink * 64))]!++
    seen++
  }
  if (seen === 0) return 1

  let above = 0
  for (let bin = 63; bin >= 0; bin--) {
    above += bins[bin]!
    if (above > seen * 0.005) return Math.max(0.25, (bin + 1) / 64)
  }
  return 1
}

/** The sampling grid for a frame: the frame itself, capped so the tables stay cheap. */
export function maskSize(width: number, height: number): { cols: number; rows: number } {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
  return { cols: Math.max(1, Math.round(width * scale)), rows: Math.max(1, Math.round(height * scale)) }
}
