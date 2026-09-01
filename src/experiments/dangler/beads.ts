/**
 * Drawing bulbs.
 *
 * Every bulb is two pre-rendered sprites — a halo and a core — scaled and
 * composited additively. Additive is not only how light behaves; it is
 * order-independent, so a scene of any size needs no depth sort at all, which is
 * the single largest thing keeping the crowd cheap.
 *
 * Sprites are cached on quantised hue and saturation and built on demand, since
 * a scene with a narrow colour spread only ever touches a handful of buckets.
 * Brightness is `globalAlpha` and costs no cache entry.
 */

import { coreColour, haloColour } from "@/experiments/dangler/palette"

const HUE_BUCKETS = 24
const SATURATION_BUCKETS = 3
const HALO_PX = 64
const CORE_PX = 32

/**
 * Smallest a core may be drawn, in **device** pixels.
 *
 * Below about this, antialiasing spreads a dot's area across several pixels at
 * fractional coverage, so it can never reach the opacity it was asked for and a
 * whole population of far bulbs silently contributes nothing. Under the floor
 * the size is held and the *alpha* is scaled by the area given up instead, which
 * is what the bulb would actually have contributed.
 *
 * **Device pixels, not css px.** The floor is about a real pixel grid and the
 * canvas is backed at `dpr`, so on a 2× screen a 0.7 css-px floor is 1.4 device
 * pixels — it was spreading cores the screen could resolve perfectly well. At
 * `dpr` 1 the floor is what it always was, so nothing found on a plain monitor
 * moves.
 *
 * Flotsam had the same line, copied, and needed a second fix this piece does
 * **not**: its halo is a radius in px computed from the *unfloored* core, so the
 * floor never widens it and dimming it by the area given up over-dims the haze.
 * Here `outer` is a multiple of the *floored* core, so the glow grows with the
 * body and dimming both is the right compensation. See #94 — two blocks that
 * read identically encoding different geometry.
 */
export const MIN_CORE_DEVICE_PX = 0.7

export type Beads = {
  draw: (x: number, y: number, radius: number, halo: number, hue: number, saturation: number, alpha: number) => void
  /** The canvas's backing scale, so the sub-pixel floor applies in the pixels it is about. */
  setScale: (dpr: number) => void
  /** Bulbs whose core landed under the floor, and so were drawn wider and fainter than asked. */
  dimmed: () => number
  /** Total sprite area drawn since the last reset, in css px². */
  fill: () => number
  reset: () => void
}

/**
 * Jitters alpha by about a level.
 *
 * A soft gradient ramping over a few hundred pixels quantises into concentric
 * contour rings at 8-bit precision, and more colour stops cannot help — a near
 * bulb with a wide glow is exactly that case. Breaking the rings into grain is
 * the only thing that works.
 */
function dither(context: CanvasRenderingContext2D, size: number): void {
  const image = context.getImageData(0, 0, size, size)
  const { data } = image
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 0) continue
    data[i] = Math.max(0, Math.min(255, data[i] + (Math.random() * 2 - 1) * 1.5))
  }
  context.putImageData(image, 0, 0)
}

function sprite(size: number, stops: [number, string][], jitter: boolean): HTMLCanvasElement {
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
  if (jitter) dither(context, size)
  return canvas
}

const transparent = (colour: string) => colour.replace(")", " / 0)")

export function createBeads(context: CanvasRenderingContext2D): Beads {
  const halos = new Map<number, HTMLCanvasElement>()
  const cores = new Map<number, HTMLCanvasElement>()
  let filled = 0
  let dimmedCount = 0
  let floorPx = MIN_CORE_DEVICE_PX

  function bucket(hue: number, saturation: number): number {
    const h = Math.round(((((hue % 360) + 360) % 360) / 360) * HUE_BUCKETS) % HUE_BUCKETS
    const s = Math.round(Math.min(1, Math.max(0, saturation)) * (SATURATION_BUCKETS - 1))
    return h * SATURATION_BUCKETS + s
  }

  const hueOf = (key: number) => (Math.floor(key / SATURATION_BUCKETS) / HUE_BUCKETS) * 360
  const satOf = (key: number) => (key % SATURATION_BUCKETS) / (SATURATION_BUCKETS - 1)

  function halo(key: number): HTMLCanvasElement {
    let found = halos.get(key)
    if (!found) {
      const colour = haloColour(hueOf(key), satOf(key))
      const clear = transparent(colour)
      // Steep near the middle and long in the tail: a real glow is mostly a
      // faint wide skirt with a small bright heart, and a linear ramp reads as
      // a soft disc instead.
      found = sprite(
        HALO_PX,
        [
          [0, colour.replace(")", " / 0.85)")],
          [0.18, colour.replace(")", " / 0.34)")],
          [0.45, colour.replace(")", " / 0.08)")],
          [1, clear],
        ],
        true,
      )
      halos.set(key, found)
    }
    return found
  }

  function core(key: number): HTMLCanvasElement {
    let found = cores.get(key)
    if (!found) {
      const colour = coreColour(hueOf(key), satOf(key))
      found = sprite(
        CORE_PX,
        [
          [0, colour],
          [0.55, colour.replace(")", " / 0.9)")],
          [1, transparent(colour)],
        ],
        false,
      )
      cores.set(key, found)
    }
    return found
  }

  return {
    draw(x, y, radius, haloScale, hue, saturation, alpha) {
      let r = radius
      let a = alpha

      if (r < floorPx) {
        a *= (r / floorPx) ** 2
        r = floorPx
        dimmedCount++
      }
      if (a <= 0.002) return

      const key = bucket(hue, saturation)
      const outer = r * haloScale

      context.globalAlpha = Math.min(1, a)
      context.drawImage(halo(key), x - outer, y - outer, outer * 2, outer * 2)
      context.drawImage(core(key), x - r, y - r, r * 2, r * 2)

      filled += Math.PI * outer * outer
    },

    fill: () => filled,
    dimmed: () => dimmedCount,
    setScale(dpr) {
      floorPx = MIN_CORE_DEVICE_PX / Math.max(1, dpr)
    },
    reset: () => {
      filled = 0
      dimmedCount = 0
    },
  }
}
