/**
 * A piece's canvas: its 2d context, and its size in css px and device pixels.
 *
 * Ten pieces asked for the context and threw the same error by hand, and nine
 * sized the canvas with the same four lines — the css box, falling back to the
 * window before layout has happened, at a device-pixel ratio capped at 2.
 * Beyond 2 the backing store quadruples again for a difference nobody can see
 * at arm's length, and these pieces redraw it every frame.
 */

/** The 2d context, or an error naming the piece — a canvas that cannot draw should fail loudly in the first frame. */
export function context2d(
  canvas: HTMLCanvasElement,
  piece: string,
  options?: CanvasRenderingContext2DSettings,
): CanvasRenderingContext2D {
  const context = canvas.getContext("2d", options)
  if (!context) throw new Error(`${piece}: no 2d context`)
  return context
}

export type CanvasSize = { width: number; height: number; dpr: number }

/** The size the canvas should be now, without touching it. */
export function measureCanvas(canvas: HTMLCanvasElement): CanvasSize {
  return {
    width: canvas.clientWidth || window.innerWidth,
    height: canvas.clientHeight || window.innerHeight,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
  }
}

/**
 * Sizes the backing store to the canvas's box and returns that size.
 *
 * Given the size it last had, it returns `null` and leaves the canvas alone
 * when nothing changed — assigning `canvas.width` clears the canvas even to the
 * same value, so a resize event that changed nothing would blank a parked
 * piece.
 */
export function fitCanvas(canvas: HTMLCanvasElement): CanvasSize
export function fitCanvas(canvas: HTMLCanvasElement, current: CanvasSize): CanvasSize | null
export function fitCanvas(canvas: HTMLCanvasElement, current?: CanvasSize): CanvasSize | null {
  const next = measureCanvas(canvas)
  if (current && next.width === current.width && next.height === current.height && next.dpr === current.dpr) return null
  canvas.width = Math.round(next.width * next.dpr)
  canvas.height = Math.round(next.height * next.dpr)
  return next
}
