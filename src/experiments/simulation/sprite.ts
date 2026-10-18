/**
 * Pre-rendered glows: a square canvas holding one radial gradient, drawn later
 * with `drawImage` rather than rebuilt per mark.
 *
 * Four pieces built the same sprite — Dangler's bulbs, Flotsam's specks,
 * Embers' sparks and Hexgrid's hole vignettes — with the same canvas calls in
 * the same order, so this draws exactly what each of them drew. The stops are
 * the piece's: a glow's profile is a choice about light, not plumbing.
 */

/** A `size`-pixel square with a radial gradient from its centre to its edge. */
export function radialSprite(size: number, stops: Iterable<readonly [number, string]>): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext("2d")
  if (!context) return canvas

  const half = size / 2
  const gradient = context.createRadialGradient(half, half, 0, half, half, half)
  for (const [offset, colour] of stops) gradient.addColorStop(offset, colour)
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  return canvas
}

/**
 * Jitters every visible pixel's alpha by up to `amplitude` levels.
 *
 * A soft gradient ramping over a few hundred pixels quantises into concentric
 * contour rings at 8-bit precision, and more colour stops cannot help. Breaking
 * the rings into grain is the only thing that works. Alpha only: the banding
 * lives there, and the tint should stay a single hue. Unseeded on purpose — it
 * is grain, and no scene depends on which grain.
 */
export function ditherAlpha(context: CanvasRenderingContext2D, width: number, height: number, amplitude: number): void {
  const image = context.getImageData(0, 0, width, height)
  const { data } = image
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 0) continue
    data[i] = Math.max(0, Math.min(255, data[i]! + (Math.random() * 2 - 1) * amplitude))
  }
  context.putImageData(image, 0, 0)
}
