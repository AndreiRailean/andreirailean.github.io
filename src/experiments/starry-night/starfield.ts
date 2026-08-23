import {
  biasedRadius,
  characterAt,
  DEPTH_POLICIES,
  dotCountFor,
  envelope,
  initialLifetimesMs,
  initialPhases,
  randomLifetimeMs,
} from "@/experiments/starry-night/character"
import { createGlimmer, drawGlimmer, isGlimmerAlive, type Glimmer } from "@/experiments/starry-night/glimmer"
import {
  CLOUD_LIFETIME_FACTOR,
  createCloudLayer,
  drawCloudLayer,
  type CloudLayer,
} from "@/experiments/starry-night/clouds"
import { cloudTint, paletteFor, rgba, type Palette } from "@/experiments/starry-night/palette"
import { createOutline, MIN_OUTLINE_RADIUS, traceOutline, type Outline } from "@/experiments/starry-night/shape"
import { DEFAULT_SETTINGS, type Settings } from "@/experiments/starry-night/settings"

type Dot = {
  x: number
  y: number
  radius: number
  /** Null for small stars, which stay circular. */
  outline: Outline | null
}

type Layer = {
  dots: Dot[]
  peakAlpha: number
  lifetimeMs: number
  /** Position in this layer's life, 0..1. Survives setting changes and resizes. */
  phase: number
}

export type Starfield = {
  setSettings: (settings: Settings) => void
  start: () => void
  stop: () => void
  destroy: () => void
}

/** A big delta after the tab was backgrounded would teleport every layer. */
const MAX_FRAME_MS = 100

/** Few enough that overlaps stay legible as mottling rather than a haze. */
const CLOUD_LAYERS = 3

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min)

function require2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Starry Night: canvas 2D context unavailable")
  return context
}

export function createStarfield(canvas: HTMLCanvasElement, initial?: Settings): Starfield {
  const context = require2dContext(canvas)
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")

  let settings: Settings = { ...DEFAULT_SETTINGS, ...initial }
  let palette: Palette = paletteFor(settings.invert)
  let layers: Layer[] = []
  let cloudLayers: CloudLayer[] = []
  let glimmers: Glimmer[] = []
  let width = 0
  let height = 0
  let frameId = 0
  let lastFrameMs = 0

  function buildLayer(index: number, phase: number, lifetimeMs: number): Layer {
    const character = characterAt(DEPTH_POLICIES[settings.mode](index, settings.layerCount), settings.nearRadius)
    const count = dotCountFor(character, width, height, settings.densityScale)
    const dots: Dot[] = Array.from({ length: count }, () => {
      const radius = biasedRadius(character.minRadius, character.maxRadius, settings.sizeMix)
      const wobbles = settings.wobble > 0 && radius >= MIN_OUTLINE_RADIUS
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        radius,
        outline: wobbles ? createOutline(settings.wobble) : null,
      }
    })

    return { dots, peakAlpha: character.peakAlpha, lifetimeMs, phase }
  }

  function freshLifetime() {
    return randomLifetimeMs(settings.minLifetimeMs, settings.maxLifetimeMs)
  }

  /**
   * Rebuilds every layer, carrying each one's phase and lifespan across.
   * Preserving both is what keeps the layers out of sync — reset them and they
   * would all fade in together, the exact artifact this piece avoids. Layers
   * added by raising the count are seeded staggered, so they join out of phase
   * with the ones already running.
   */
  function rebuildLayers() {
    const target = settings.layerCount
    const seedPhases = initialPhases(target)
    const seedLifetimes = initialLifetimesMs(target, settings.minLifetimeMs, settings.maxLifetimeMs)

    layers = Array.from({ length: target }, (_, index) => {
      const existing = layers[index]
      return existing
        ? buildLayer(index, existing.phase, existing.lifetimeMs)
        : buildLayer(index, seedPhases[index], seedLifetimes[index])
    })
  }

  function cloudLifetime() {
    return randomBetween(settings.minLifetimeMs, settings.maxLifetimeMs) * CLOUD_LIFETIME_FACTOR
  }

  /** Skipped entirely at zero intensity, so the buffers are not even allocated. */
  function rebuildClouds() {
    if (settings.clouds <= 0 || width === 0 || height === 0) {
      cloudLayers = []
      return
    }
    const phases = initialPhases(CLOUD_LAYERS)
    cloudLayers = phases
      .map((phase, index) =>
        createCloudLayer(
          width,
          height,
          cloudTint(palette, settings.hue),
          cloudLayers[index]?.lifetimeMs ?? cloudLifetime(),
          cloudLayers[index]?.phase ?? phase,
        ),
      )
      .filter((layer): layer is CloudLayer => layer !== null)
  }

  function advanceClouds(deltaMs: number) {
    cloudLayers.forEach((layer, index) => {
      layer.phase += deltaMs / layer.lifetimeMs
      if (layer.phase < 1) return
      const replacement = createCloudLayer(width, height, cloudTint(palette, settings.hue), cloudLifetime(), 0)
      if (replacement) cloudLayers[index] = replacement
    })
  }

  function measure() {
    // Backing store in device pixels, drawing coordinates in CSS pixels —
    // without this, sub-pixel dots turn to mush on a high-DPI screen.
    const ratio = window.devicePixelRatio || 1
    width = canvas.clientWidth
    height = canvas.clientHeight
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
  }

  function draw() {
    context.fillStyle = palette.background
    context.fillRect(0, 0, width, height)

    for (const layer of cloudLayers) {
      drawCloudLayer(context, layer, width, height, settings.hold, settings.clouds)
    }

    context.globalAlpha = 1
    context.fillStyle = rgba(palette.star, 1)

    for (const layer of layers) {
      const alpha = layer.peakAlpha * envelope(layer.phase, settings.hold)
      if (alpha < 0.002) continue

      // One path per layer: every dot in it shares an alpha, so a single fill
      // is far cheaper than one per dot.
      context.globalAlpha = alpha
      context.beginPath()
      for (const dot of layer.dots) {
        if (dot.outline) {
          traceOutline(context, dot.x, dot.y, dot.radius, dot.outline)
          continue
        }
        // moveTo lands exactly on the arc's start point, so consecutive dots
        // are separate subpaths rather than being joined by a line.
        context.moveTo(dot.x + dot.radius, dot.y)
        context.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2)
      }
      context.fill()
    }

    for (const glimmer of glimmers) drawGlimmer(context, glimmer, palette.star)

    context.globalAlpha = 1
  }

  /**
   * Picks a layer weighted by how visible it is right now, so a flare never
   * appears where there was no star bright enough to flare.
   */
  function spawnGlimmer() {
    const weights = layers.map((layer) => layer.peakAlpha * envelope(layer.phase, settings.hold))
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    if (total <= 0) return

    let remaining = Math.random() * total
    for (let index = 0; index < layers.length; index += 1) {
      remaining -= weights[index]
      if (remaining > 0) continue

      const dots = layers[index].dots
      const dot = dots[Math.floor(Math.random() * dots.length)]
      if (dot) glimmers.push(createGlimmer(dot.x, dot.y, dot.radius, dot.outline))
      return
    }
  }

  function advanceGlimmers(deltaMs: number) {
    // Bernoulli per frame approximates a Poisson process closely enough at
    // these rates, and keeps the spacing irregular rather than metronomic.
    if (Math.random() < (settings.glimmersPerSecond * deltaMs) / 1000) spawnGlimmer()
    for (const glimmer of glimmers) glimmer.elapsedMs += deltaMs
    glimmers = glimmers.filter(isGlimmerAlive)
  }

  function advance(deltaMs: number) {
    layers.forEach((layer, index) => {
      layer.phase += deltaMs / layer.lifetimeMs
      if (layer.phase >= 1) layers[index] = buildLayer(index, 0, freshLifetime())
    })
  }

  function frame(nowMs: number) {
    const deltaMs = lastFrameMs === 0 ? 0 : Math.min(nowMs - lastFrameMs, MAX_FRAME_MS)
    lastFrameMs = nowMs
    advance(deltaMs)
    advanceClouds(deltaMs)
    advanceGlimmers(deltaMs)
    draw()
    frameId = requestAnimationFrame(frame)
  }

  /** Reduced motion gets one still field at full brightness, and no RAF loop. */
  function drawStill() {
    glimmers = []
    layers.forEach((layer) => {
      layer.phase = 0.5
    })
    draw()
  }

  function handleResize() {
    measure()
    rebuildLayers()
    rebuildClouds()
    if (prefersReducedMotion.matches) drawStill()
  }

  function start() {
    if (frameId !== 0) return
    if (prefersReducedMotion.matches) {
      drawStill()
      return
    }
    lastFrameMs = 0
    frameId = requestAnimationFrame(frame)
  }

  function stop() {
    if (frameId === 0) return
    cancelAnimationFrame(frameId)
    frameId = 0
  }

  function setSettings(next: Settings) {
    settings = { ...next }
    palette = paletteFor(settings.invert)
    rebuildLayers()
    rebuildClouds()
    if (prefersReducedMotion.matches) drawStill()
  }

  function destroy() {
    stop()
    window.removeEventListener("resize", handleResize)
  }

  measure()
  rebuildLayers()
  rebuildClouds()
  window.addEventListener("resize", handleResize)

  return { setSettings, start, stop, destroy }
}
