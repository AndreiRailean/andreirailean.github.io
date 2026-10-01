/**
 * How the glow buffer forgets — #117.
 *
 * The buffer fades by a `destination-out` of `amount` over the whole of it,
 * every frame. **With 8-bit alpha that cannot reach zero**: a pixel whose
 * alpha times `amount` rounds to nothing never moves again. At a long
 * afterglow and a slow playback `amount` is about 0.004, and then every alpha
 * from 1 to 127 is a fixed point and everything brighter walks down to 127 and
 * stops — a 50% plateau over everywhere the picture has ever been bright. The
 * measurement is on the issue, isolated from every confound the sliders have.
 *
 * **`dither` spends the same removal on fewer pixels.** Each frame a sparse,
 * shifting share `amount / STRENGTH` of the buffer is erased at `STRENGTH`,
 * which is big enough to move any alpha down by at least one step. The mean
 * removal per frame is the same as the flat fill's, so the trail's length, the
 * playback and the motion are unchanged by construction — what changes is that
 * a pixel is handed a quantum it can act on, and the floor goes.
 *
 * **Self-contained on purpose: no imports and no closures.** The browser test
 * injects this function's own source into a scratch canvas, so the thing that
 * is measured against a real rasteriser is the thing the piece runs.
 */
export function eraseHalo(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number,
  dither: boolean,
  tile: { canvas: HTMLCanvasElement | OffscreenCanvas; thresholds: Uint8Array; data: ImageData | null },
): void {
  // Erasing at this alpha moves any 8-bit value: 1 × 0.75 rounds to a step.
  const STRENGTH = 0.75
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = "destination-out"
  ctx.fillStyle = "#000"

  if (!dither || amount >= STRENGTH) {
    ctx.globalAlpha = Math.min(1, amount)
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
    return
  }

  // Which pixels this frame erases: those whose fixed random threshold falls
  // under the share wanted, so the share is exact on average at any rate and
  // the set changes smoothly as the rate does.
  const tctx = tile.canvas.getContext("2d") as CanvasRenderingContext2D | null
  if (!tctx) {
    ctx.restore()
    return
  }
  const side = tile.canvas.width
  const data = tile.data ?? tctx.createImageData(side, side)
  tile.data = data
  const cut = (amount / STRENGTH) * 256
  const pixels = data.data
  for (let i = 0; i < tile.thresholds.length; i++) {
    // The threshold is jittered by a fraction of a step so a share below
    // 1/256 still selects somebody.
    pixels[i * 4 + 3] = tile.thresholds[i]! + Math.random() < cut ? 255 : 0
  }
  tctx.putImageData(data, 0, 0)

  const pattern = ctx.createPattern(tile.canvas, "repeat")
  if (!pattern) {
    ctx.restore()
    return
  }
  // A fresh offset every frame, so no pixel is favoured by where the tile
  // happens to sit.
  pattern.setTransform(new DOMMatrix().translate(Math.floor(Math.random() * side), Math.floor(Math.random() * side)))
  ctx.globalAlpha = STRENGTH
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
}

/** The dither's scratch: a square of fixed random thresholds and its canvas. */
export function createFadeTile(side = 64): {
  canvas: HTMLCanvasElement
  thresholds: Uint8Array
  data: ImageData | null
} {
  const canvas = document.createElement("canvas")
  canvas.width = side
  canvas.height = side
  const thresholds = new Uint8Array(side * side)
  for (let i = 0; i < thresholds.length; i++) thresholds[i] = Math.floor(Math.random() * 256)
  return { canvas, thresholds, data: null }
}
