/**
 * Star outlines.
 *
 * Small stars are circles: at a couple of pixels across nothing else is
 * perceptible, and `arc` is the cheapest thing available. Larger ones get an
 * irregular outline, because a big perfect circle reads as machine-drawn rather
 * than as something in a sky.
 */

/** Under this radius (css px) irregularity is invisible, so don't pay for it. */
export const MIN_OUTLINE_RADIUS = 2.2

const POINTS = 7

export type Outline = { multipliers: number[]; rotation: number }

export function createOutline(amount: number): Outline {
  return {
    multipliers: Array.from({ length: POINTS }, () => 1 + (Math.random() * 2 - 1) * amount),
    rotation: Math.random() * Math.PI * 2,
  }
}

/**
 * Traces one closed, smooth, irregular outline as its own subpath.
 *
 * Quadratic segments run midpoint-to-midpoint using each wobbled point as the
 * control handle — the standard trick for a smooth closed blob without solving
 * for spline tangents. Going straight through the points instead would give a
 * visibly faceted polygon.
 */
export function traceOutline(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  outline: Outline,
): void {
  const { multipliers, rotation } = outline
  const count = multipliers.length

  const pointAt = (index: number): [number, number] => {
    const wrapped = index % count
    const angle = rotation + (wrapped / count) * Math.PI * 2
    const reach = radius * multipliers[wrapped]
    return [x + Math.cos(angle) * reach, y + Math.sin(angle) * reach]
  }

  const midpointAt = (index: number): [number, number] => {
    const [ax, ay] = pointAt(index)
    const [bx, by] = pointAt(index + 1)
    return [(ax + bx) / 2, (ay + by) / 2]
  }

  const [startX, startY] = midpointAt(0)
  context.moveTo(startX, startY)
  for (let index = 1; index <= count; index += 1) {
    const [controlX, controlY] = pointAt(index)
    const [endX, endY] = midpointAt(index)
    context.quadraticCurveTo(controlX, controlY, endX, endY)
  }
}
