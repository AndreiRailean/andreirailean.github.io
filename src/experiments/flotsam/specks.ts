/**
 * Drawing the flotsam.
 *
 * Two pre-rendered sprites per colour — a halo and a core — scaled and
 * composited additively. Additive because a glint on water is light arriving at
 * the eye, and because it is order-independent, so a scene of any size needs no
 * sorting at all. Sprites are cached on quantised hue and saturation and built
 * on demand; brightness is `globalAlpha` and costs no cache entry. All of that
 * is Dangler's, unchanged, and it earns its keep here for the same reasons.
 *
 * **The one real difference is the halo, and it is not a detail.** Dangler's
 * bloom is a multiple of the core, which is right when the cores differ in size
 * only because they are at different distances. Here every speck is the same
 * distance away and they differ because they *are* different sizes — sixty to
 * one, from a seed to a raft. A halo proportional to that would give the largest
 * pieces a glow the width of the screen while the smallest had none at all, and
 * a sea of pinpricks with a few blazing suns in it is not what water looks like.
 *
 * So the halo is a radius in **pixels**, from `gleam`, plus the core. Which is
 * also the honest physics: the spread of a glint is a property of the light and
 * the eye — the glare around a highlight, the bleed in a lens — not of how big
 * the thing catching it is. A sequin and a wet stone throw the same size flare.
 */

import { coreColour, haloColour } from "@/experiments/flotsam/palette"

const HUE_BUCKETS = 24
const SATURATION_BUCKETS = 3
const HALO_PX = 64
const CORE_PX = 32

/**
 * Smallest a core may be drawn, in css px.
 *
 * Below about this, antialiasing spreads a dot's area over several pixels at
 * fractional coverage, so it can never reach the opacity it was asked for and a
 * whole population of small specks silently contributes nothing. Under the floor
 * the size is held and the *alpha* is scaled by the area given up instead, which
 * is what the speck would actually have contributed.
 *
 * This matters far more here than in Dangler. The size range is the control the
 * piece is about, and at a wide span the entire small half of it is sub-pixel —
 * without this floor, widening the range would appear to *delete* flotsam.
 */
export const MIN_CORE_PX = 0.7

/** How much wider than the core a halo has to be before it is worth compositing. */
const HALO_WORTH_DRAWING = 1.08

export type Specks = {
  draw: (x: number, y: number, core: number, halo: number, hue: number, saturation: number, alpha: number) => void
  /** Total sprite area drawn since the last reset, in css px². */
  fill: () => number
  reset: () => void
}

/**
 * Jitters alpha by about a level.
 *
 * A soft gradient ramping over a few hundred pixels quantises into concentric
 * contour rings at 8-bit precision, and more colour stops cannot help. Breaking
 * the rings into grain is the only thing that works.
 */
function dither(context: CanvasRenderingContext2D, size: number): void {
  const image = context.getImageData(0, 0, size, size)
  const { data } = image
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 0) continue
    data[i] = Math.max(0, Math.min(255, data[i]! + (Math.random() * 2 - 1) * 1.5))
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

export function createSpecks(context: CanvasRenderingContext2D): Specks {
  const halos = new Map<number, HTMLCanvasElement>()
  const cores = new Map<number, HTMLCanvasElement>()
  let filled = 0

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
      // Steeper and shorter-tailed than Dangler's. A glow in air is a wide faint
      // skirt because the air itself scatters; a glint off water is a sharp
      // reflection, and the same long tail here reads as fog on the surface.
      found = sprite(
        HALO_PX,
        [
          [0, colour.replace(")", " / 0.7)")],
          [0.16, colour.replace(")", " / 0.26)")],
          [0.42, colour.replace(")", " / 0.05)")],
          [1, transparent(colour)],
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
    draw(x, y, coreRadius, haloRadius, hue, saturation, alpha) {
      let r = coreRadius
      let a = alpha

      if (r < MIN_CORE_PX) {
        a *= (r / MIN_CORE_PX) ** 2
        r = MIN_CORE_PX
      }
      if (a <= 0.002) return

      const key = bucket(hue, saturation)
      const outer = Math.max(r, haloRadius)

      context.globalAlpha = Math.min(1, a)
      // A halo no wider than the core is not a halo, and at the counts this
      // piece runs the second `drawImage` is half the frame's draw calls — nine
      // thousand pieces at a low gleam went from eighteen thousand composites to
      // nine. Skipping it is the difference between fine flotsam being cheap and
      // being the reason to turn the count down.
      if (outer > r * HALO_WORTH_DRAWING) {
        context.drawImage(halo(key), x - outer, y - outer, outer * 2, outer * 2)
      }
      context.drawImage(core(key), x - r, y - r, r * 2, r * 2)

      filled += Math.PI * outer * outer
    },

    fill: () => filled,
    reset: () => {
      filled = 0
    },
  }
}
