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
 * Smallest a core may be drawn, in **device** pixels.
 *
 * Below about this, antialiasing spreads a dot's area over several pixels at
 * fractional coverage, so it can never reach the opacity it was asked for and a
 * whole population of small specks silently contributes nothing. Under the floor
 * the size is held and the *alpha* is scaled by the area given up instead, which
 * is what the speck would actually have contributed. The trade is exactly
 * energy-preserving — `a·πr²` is unchanged — so what the floor costs is never
 * light, only **peak brightness**. That is the distinction the whole of this
 * constant turns on: the peak is the shine.
 *
 * **Device pixels, not css px, and that is the correction.** The floor exists
 * because of a real pixel grid, and the canvas is backed at `dpr` — so on a 2×
 * screen a 0.7 css-px floor is 1.4 device pixels, nearly three across, and it
 * was spreading cores the screen could resolve perfectly well. Flotsam's
 * `simmer` is where it showed: 241 metres of water across the short side puts
 * its largest core at 0.95 css px on a laptop and 0.43 on a phone, so every
 * speck in the scene fell under the old floor and the brightest of them was
 * drawn at 38% of its peak. Cores that had been hard points inside the haze
 * became dull smudges in it, and the haze — a 30px halo, in css px, unchanged by
 * any of this — was all that was left to see.
 *
 * At `dpr` 1 the floor is what it always was, so nothing about a scene found on
 * a plain monitor moves.
 *
 * This matters far more here than in Dangler. The size range is the control the
 * piece is about, and at a wide span the entire small half of it is sub-pixel —
 * without this floor, widening the range would appear to *delete* flotsam.
 */
export const MIN_CORE_DEVICE_PX = 0.7

/**
 * The reference size a glare is dimmed against, in css px.
 *
 * Numerically what the floor used to be, and deliberately left there: it is no
 * longer a statement about pixels but about how much light a speck this small
 * reflects, and it is the scale every scene here was found at.
 */
const MIN_CORE_CSS_PX = 0.7

/** How much wider than the core a halo has to be before it is worth compositing. */
const HALO_WORTH_DRAWING = 1.08

const TAU = Math.PI * 2

/** How much of a piece is at full strength before its edge begins, at softness 0. */
const SOLID_FRACTION = 0.86

export type Specks = {
  /**
   * The canvas's backing scale, so the sub-pixel floor can be applied in the
   * pixels it is about. Set once a frame beside `setSoftness`.
   */
  setScale: (dpr: number) => void
  /**
   * Pieces whose core landed under the floor and were therefore drawn wider and
   * fainter than asked.
   *
   * Not a cost so much as a reading of how much of the population the screen can
   * still resolve as a point. All of them, and the scene is haze.
   */
  dimmed: () => number
  /**
   * How sharply a piece's edge falls off, 0 for a defined edge and 1 for a soft
   * ball. Uniform across a frame, so it is set once rather than passed per
   * piece — and it invalidates the body sprites, which bake it in.
   */
  setSoftness: (softness: number) => void
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
  let dimmedCount = 0
  let floorPx = MIN_CORE_DEVICE_PX
  let softness = 0

  function bucket(hue: number, saturation: number): number {
    const h = Math.round(((((hue % 360) + 360) % 360) / 360) * HUE_BUCKETS) % HUE_BUCKETS
    const s = Math.round(Math.min(1, Math.max(0, saturation)) * (SATURATION_BUCKETS - 1))
    return h * SATURATION_BUCKETS + s
  }

  const hueOf = (key: number) => (Math.floor(key / SATURATION_BUCKETS) / HUE_BUCKETS) * 360
  const satOf = (key: number) => (key % SATURATION_BUCKETS) / (SATURATION_BUCKETS - 1)

  /**
   * The glare's alpha profile, as offsets along whatever span it is given.
   *
   * Softness turns its peak down rather than moving it. The glare has to stay
   * *outside* the body — anything that lets it under a lit face makes a piece
   * brighter when the gleam is widened, which is the fault this rendering exists
   * to have fixed — so it cannot be blended inward. But a hard 0.7 landing on the
   * edge of a body that has no edge left reads as an outline drawn round a soft
   * blob, and turning it down is enough to make it a bloom again.
   */
  const glareProfile = (): [number, number][] => [
    [0, 0.7 - 0.5 * softness],
    [0.16, 0.26 - 0.17 * softness],
    [0.42, 0.05 - 0.03 * softness],
    [1, 0],
  ]

  /**
   * The glare, for a body that fills `step / GLARE_STEPS` of it.
   *
   * At step 0 the piece is a point and this is the plain centre-peaked glow —
   * steeper and shorter-tailed than Dangler's, because a glow in air is a wide
   * faint skirt where the air scatters, and a glint off water is a sharp
   * reflection whose long tail would read as fog on the surface.
   *
   * Above that the same profile is pushed outward so it begins at the body's
   * edge, and the part inside is empty: `gleam` is glare *around* a piece, and
   * filling the middle would make it brighten the body as well, so that widening
   * the glare quietly changed how bright everything was.
   */
  function halo(key: number, step: number): HTMLCanvasElement {
    const id = key * GLARE_STEPS + step
    let found = halos.get(id)
    if (!found) {
      const colour = haloColour(hueOf(key), satOf(key))
      const at = (alpha: number) => (alpha === 0 ? transparent(colour) : colour.replace(")", ` / ${alpha})`))
      const inner = step / GLARE_STEPS

      const stops: [number, string][] = glareProfile().map(([offset, alpha]) => [
        inner + (1 - inner) * offset,
        at(alpha),
      ])
      if (inner > 0) stops.unshift([0, at(0)], [inner * 0.995, at(0)])

      found = sprite(HALO_PX, stops, true)
      halos.set(id, found)
    }
    return found
  }

  function core(key: number): HTMLCanvasElement {
    let found = cores.get(key)
    if (!found) {
      const colour = coreColour(hueOf(key), satOf(key))
      // Solid nearly to its edge, then a quick fade — a piece of flotsam is an
      // object with an edge, and a sprite built for a point of light is a ball
      // of fog once it is a hundred pixels across. `softness` walks that edge
      // back to the centre when a reader wants the ball instead, which is why
      // this bakes it in and is thrown away when it changes.
      found = sprite(
        CORE_PX,
        [
          [0, colour],
          [SOLID_FRACTION * (1 - softness), colour],
          [1, transparent(colour)],
        ],
        false,
      )
      cores.set(key, found)
    }
    return found
  }

  /**
   * Drawn rather than blitted, for a piece bigger than the sprite it would come
   * from.
   *
   * Two things go wrong when a 64-pixel sprite is stretched over a piece several
   * hundred across, and both were reported by eye. The gradient becomes
   * piecewise-linear between its texels, which shows as faceting; and the dither
   * that breaks eight-bit banding at native size — a level of noise per pixel —
   * is magnified with everything else into coarse mottling. A gradient asked for
   * at the size it is wanted has neither.
   *
   * It is also *faster* here, which was a surprise worth recording: four
   * thousand draws at a 60px radius took 497ms as scaled `drawImage` calls
   * against 9.8ms as native fills. That ratio is a software rasteriser's, where
   * a scaled blit is a full CPU resample and a gradient fill is a span fill, so
   * do not read it as a claim about real hardware. The rule it justifies is
   * conservative either way: blit while the sprite is being used at or below its
   * own size, draw when it would have to be stretched — which is exactly where a
   * sprite looks wrong.
   */
  function paintBody(x: number, y: number, r: number, hue: number, saturation: number): void {
    const colour = coreColour(hue, saturation)
    const edge = r * SOLID_FRACTION * (1 - softness)
    const gradient = context.createRadialGradient(x, y, edge, x, y, r)
    gradient.addColorStop(0, colour)
    gradient.addColorStop(1, transparent(colour))

    context.fillStyle = gradient
    context.beginPath()
    context.arc(x, y, r, 0, TAU)
    context.fill()
  }

  /**
   * The glare, as a ring from `inner` of the radius outward.
   *
   * Drawn as an annulus rather than a disc, and that is load-bearing: a radial
   * gradient holds its first stop's colour everywhere inside its inner circle,
   * so filling the whole disc would lay the glare's brightest value across the
   * body underneath — which is the exact fault this rendering exists to have
   * fixed. The reversed second arc punches the hole.
   *
   * Takes the true fraction rather than a bucketed one. Nothing is cached here,
   * so there is nothing to quantise for, and a piece drawn this way has its
   * glare exactly at its edge at every size.
   */
  function paintGlare(x: number, y: number, outer: number, inner: number, hue: number, saturation: number): void {
    const colour = haloColour(hue, saturation)
    const gradient = context.createRadialGradient(x, y, outer * inner, x, y, outer)
    for (const [offset, alpha] of glareProfile()) {
      gradient.addColorStop(offset, alpha === 0 ? transparent(colour) : colour.replace(")", ` / ${alpha})`))
    }

    context.fillStyle = gradient
    context.beginPath()
    context.arc(x, y, outer, 0, TAU)
    if (inner > 0) context.arc(x, y, outer * inner, 0, TAU, true)
    context.fill()
  }

  return {
    setSoftness(next) {
      const clamped = Math.min(1, Math.max(0, next))
      if (clamped === softness) return
      softness = clamped
      cores.clear()
      halos.clear()
    },

    draw(x, y, coreRadius, haloRadius, hue, saturation, alpha) {
      /*
       * The glare and the body are dimmed by different amounts, and separating
       * them is what this is about.
       *
       * Both used to take one alpha, attenuated by however much the body had to
       * be *widened* to clear the sub-pixel floor. For the body that is exactly
       * right and exactly energy-preserving — `a·πr²` is unchanged, so what the
       * floor costs is never light, only peak brightness. For the glare it was a
       * coincidence: the glare is not widened by the floor and has no reason to
       * be dimmed by it.
       *
       * It is not the wrong number, though, only the wrong reason. A smaller
       * speck reflects less light, so its glare should be fainter in proportion
       * to its area — which is what `(r / MIN_CORE_CSS_PX)²` says, read as an
       * area ratio rather than as a pixel-grid correction. So the glare keeps the
       * css-px reference it was tuned against and the body gets the device-pixel
       * floor it was always about.
       */
      const glareAlpha = coreRadius < MIN_CORE_CSS_PX ? alpha * (coreRadius / MIN_CORE_CSS_PX) ** 2 : alpha

      let r = coreRadius
      let a = alpha

      if (r < floorPx) {
        a *= (r / floorPx) ** 2
        r = floorPx
        dimmedCount++
      }
      if (a <= 0.002 && glareAlpha <= 0.002) return

      const outer = Math.max(r, haloRadius)
      const opacity = Math.min(1, a)
      context.globalAlpha = Math.min(1, glareAlpha)

      // A halo no wider than the body is not a halo, and at the counts this
      // piece runs the second draw is half the frame's calls — nine thousand
      // pieces at a low gleam went from eighteen thousand composites to nine.
      if (outer > r * HALO_WORTH_DRAWING) {
        // Where the glare begins: at the body's edge, always. Letting softness
        // walk it inward was tried and is wrong — the glare's peak landing on a
        // body that is still lit outshines the body's own middle, so a piece came
        // out as a flat disc inside a brighter ring. Softness turns the peak
        // down instead; see `glareProfile`.
        const inner = r / outer
        if (outer > HALO_PX / 2) {
          paintGlare(x, y, outer, inner, hue, saturation)
        } else {
          const step = Math.min(GLARE_STEPS - 1, Math.round(inner * GLARE_STEPS))
          context.drawImage(halo(bucket(hue, saturation), step), x - outer, y - outer, outer * 2, outer * 2)
        }
      }

      context.globalAlpha = opacity
      if (r > CORE_PX / 2) paintBody(x, y, r, hue, saturation)
      else context.drawImage(core(bucket(hue, saturation)), x - r, y - r, r * 2, r * 2)

      filled += Math.PI * outer * outer
      // Weighted by the glare's alpha, which is what covers the canvas. The body
      // is a rounding error against a thirty-pixel halo, and `light` is the
      // number the scenes were judged against.
      light += Math.min(1, glareAlpha) * Math.PI * outer * outer
    },

    fill: () => filled,
    lit: () => light,
    dimmed: () => dimmedCount,
    setScale(dpr) {
      floorPx = MIN_CORE_DEVICE_PX / Math.max(1, dpr)
    },
    reset: () => {
      filled = 0
      light = 0
      dimmedCount = 0
    },
  }
}
