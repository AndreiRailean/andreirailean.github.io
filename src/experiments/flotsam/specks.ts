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

/**
 * Bigger than the glare's sprite, and bigger than it used to be.
 *
 * A body is drawn at its real size, so at a wide size range it can be a hundred
 * pixels across — and a 32-pixel sprite blown up eight times is soft everywhere,
 * which was half of why large pieces read as fuzz rather than as objects.
 */
const CORE_PX = 64

/**
 * How many buckets the glare is cached at, by how much of it the body fills.
 *
 * The glare has to sit *around* a piece, and one centre-peaked sprite cannot do
 * that at every size: scaled over a large body it puts its bright heart in the
 * middle of the piece, which is exactly the "tiny solid dot inside a fuzzy ball"
 * a large piece used to be. So the sprite's falloff starts at the body's edge,
 * and where that edge falls is what these buckets are of. Six is enough because
 * the draw below scales the sprite so the bucket's edge lands *on* the body
 * rather than near it — the quantisation costs the glare a little width, never
 * its position.
 */
const GLARE_STEPS = 6

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
  /**
   * The same area weighted by the alpha it was drawn at, in css px².
   *
   * How much light actually reached the canvas, as against how much of it was
   * covered — the two come apart badly, since the small pieces are drawn at a
   * fraction of full alpha and a wide `gleam` covers a great deal of canvas very
   * faintly. This is the number a viewer is judging when they say a scene is too
   * bright, and until it existed there was nothing to judge it by but eyes and a
   * monitor.
   */
  lit: () => number
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
  let light = 0

  function bucket(hue: number, saturation: number): number {
    const h = Math.round(((((hue % 360) + 360) % 360) / 360) * HUE_BUCKETS) % HUE_BUCKETS
    const s = Math.round(Math.min(1, Math.max(0, saturation)) * (SATURATION_BUCKETS - 1))
    return h * SATURATION_BUCKETS + s
  }

  const hueOf = (key: number) => (Math.floor(key / SATURATION_BUCKETS) / HUE_BUCKETS) * 360
  const satOf = (key: number) => (key % SATURATION_BUCKETS) / (SATURATION_BUCKETS - 1)

  /**
   * The glare, for a body that fills `step / GLARE_STEPS` of it.
   *
   * At step 0 the piece is a point and this is the old centre-peaked glow —
   * steeper and shorter-tailed than Dangler's, because a glow in air is a wide
   * faint skirt where the air scatters, and a glint off water is a sharp
   * reflection whose long tail would read as fog on the surface.
   *
   * Above that the same profile is pushed outward so it begins at the body's
   * edge, and the part inside is empty: `gleam` is glare *around* a piece, and
   * filling the middle would make the halo brighten the body as well, so that
   * widening the glare quietly changed how bright everything was.
   */
  function halo(key: number, step: number): HTMLCanvasElement {
    const id = key * GLARE_STEPS + step
    let found = halos.get(id)
    if (!found) {
      const colour = haloColour(hueOf(key), satOf(key))
      const clear = transparent(colour)
      const at = (alpha: number) => colour.replace(")", ` / ${alpha})`)
      const inner = step / GLARE_STEPS
      const beyond = (fraction: number) => inner + (1 - inner) * fraction

      found = sprite(
        HALO_PX,
        inner === 0
          ? [
              [0, at(0.7)],
              [0.16, at(0.26)],
              [0.42, at(0.05)],
              [1, clear],
            ]
          : [
              [0, clear],
              [inner * 0.995, clear],
              [inner, at(0.7)],
              [beyond(0.16), at(0.26)],
              [beyond(0.42), at(0.05)],
              [1, clear],
            ],
        true,
      )
      halos.set(id, found)
    }
    return found
  }

  function core(key: number): HTMLCanvasElement {
    let found = cores.get(key)
    if (!found) {
      const colour = coreColour(hueOf(key), satOf(key))
      // Solid nearly to its edge, then a quick fade. A piece of flotsam is an
      // object with an edge, and the old profile — half-strength by 55% of the
      // radius and gone by 100% — was a soft ball. At a pixel across nobody could
      // tell; at a hundred it was the other half of why large pieces read as
      // fuzz. The fade that remains is there so an edge does not alias, and the
      // brightening at the centre a small piece needs comes from its own glare
      // adding on top rather than from the body being brightest in the middle.
      found = sprite(
        CORE_PX,
        [
          [0, colour],
          [0.86, colour],
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
      const opacity = Math.min(1, a)

      context.globalAlpha = opacity

      // A halo no wider than the body is not a halo, and at the counts this
      // piece runs the second `drawImage` is half the frame's draw calls — nine
      // thousand pieces at a low gleam went from eighteen thousand composites to
      // nine. Skipping it is the difference between fine flotsam being cheap and
      // being the reason to turn the count down.
      let painted = r
      if (outer > r * HALO_WORTH_DRAWING) {
        const step = Math.min(GLARE_STEPS - 1, Math.round((r / outer) * GLARE_STEPS))
        const inner = step / GLARE_STEPS
        // Scaled so the bucket's inner edge lands *on* the body's edge, and
        // never wider than the gleam actually asked for. Where the bucket is
        // coarser than the truth the glare loses a little width; it never ends
        // up in the wrong place, which is the failure that would show.
        painted = inner > 0 ? Math.min(r / inner, outer) : outer
        context.drawImage(halo(key, step), x - painted, y - painted, painted * 2, painted * 2)
      }
      context.drawImage(core(key), x - r, y - r, r * 2, r * 2)

      filled += Math.PI * painted * painted
      light += opacity * Math.PI * painted * painted
    },

    fill: () => filled,
    lit: () => light,
    reset: () => {
      filled = 0
      light = 0
    },
  }
}
