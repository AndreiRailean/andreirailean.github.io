import {
  biasedRadius,
  characterAt,
  DEPTH_POLICIES,
  dotCountFor,
  envelope,
  initialLifetimesMs,
  exitPhase,
  initialPhases,
  randomLifetimeMs,
  SOLO_MIN_RADIUS,
  type LayerCharacter,
} from "@/experiments/starry-night/character"
import { createGlimmer, drawGlimmer, isGlimmerAlive, type Glimmer } from "@/experiments/starry-night/glimmer"
import {
  CLOUD_LIFETIME_FACTOR,
  createCloudLayer,
  createCloudScratch,
  drawCloudSet,
  type CloudLayer,
} from "@/experiments/starry-night/clouds"
import { cloudTint, paletteFor, rgba, type Palette } from "@/experiments/starry-night/palette"
import { createOutline, MIN_OUTLINE_RADIUS, traceOutline, type Outline } from "@/experiments/starry-night/shape"
import { DEFAULT_SETTINGS, needsCloudRebuild, needsRebuild, type Settings } from "@/experiments/starry-night/settings"

type Dot = {
  x: number
  y: number
  radius: number
  /** Null for small stars, which stay circular. */
  outline: Outline | null
}

/**
 * A star large enough to run on its own clock rather than its layer's, so that
 * watching it fade reveals nothing about its neighbours. It respawns on its own
 * schedule too, and survives its layer being replaced.
 */
type SoloDot = Dot & {
  peakAlpha: number
  phase: number
  lifetimeMs: number
}

type Layer = {
  dots: Dot[]
  /** Large stars, each independently clocked. Usually empty. */
  solo: SoloDot[]
  peakAlpha: number
  lifetimeMs: number
  /** Position in this layer's life, 0..1. Survives setting changes and resizes. */
  phase: number
}

/** What the sky currently costs to draw, for the console and for tuning. */
export type StarfieldStats = {
  layers: number
  dots: number
  soloStars: number
  /** Batched layer paths plus one per solo star plus the cloud composites. */
  fillCalls: number
  cloudLayers: number
  hazeLayers: number
  /** Rolling average, so a heavy setting shows up as a number. */
  fps: number
}

export type Starfield = {
  setSettings: (settings: Settings) => void
  stats: () => StarfieldStats
  start: () => void
  stop: () => void
  destroy: () => void
}

/** A big delta after the tab was backgrounded would teleport every layer. */
const MAX_FRAME_MS = 100

/** Few enough that overlaps stay legible as mottling rather than a haze. */
const CLOUD_LAYERS = 3

/** Fewer still: haze hides stars, so overlapping it thickly buries the sky. */
const HAZE_LAYERS = 2

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min)

/**
 * How long a retiring layer gets to leave. Staggered, so a settings change
 * reads as the sky dissolving rather than as one synchronised blink.
 */
const RETIRE_MIN_MS = 250
const RETIRE_MAX_MS = 900

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
  let cloudScratch: CanvasRenderingContext2D | null = null
  let cloudLayers: CloudLayer[] = []
  let hazeLayers: CloudLayer[] = []
  let glimmers: Glimmer[] = []
  let width = 0
  let height = 0
  let frameId = 0
  let lastFrameMs = 0
  let smoothedFrameMs = 16.7

  function makeDot(character: LayerCharacter): Dot {
    const radius = biasedRadius(character.minRadius, character.maxRadius, settings.sizeMix)
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      radius,
      outline: settings.wobble > 0 && radius >= MIN_OUTLINE_RADIUS ? createOutline(settings.wobble) : null,
    }
  }

  function characterFor(index: number): LayerCharacter {
    return characterAt(DEPTH_POLICIES[settings.mode](index, settings.layerCount), settings.nearRadius)
  }

  /**
   * Builds a layer, sending any star over the solo threshold onto its own clock.
   *
   * `solo` is carried over when supplied, so a layer respawning does not reset
   * the big stars riding on it — they are not part of its cycle. It is left out
   * on a resize or a settings change, where their positions and their
   * eligibility both depend on something that just moved.
   */
  function buildLayer(index: number, phase: number, lifetimeMs: number, carried?: SoloDot[]): Layer {
    const character = characterFor(index)
    const count = dotCountFor(character, width, height, settings.densityScale)

    const dots: Dot[] = []
    const promoted: SoloDot[] = []

    for (let made = 0; made < count; made += 1) {
      const dot = makeDot(character)
      if (dot.radius < SOLO_MIN_RADIUS) {
        dots.push(dot)
        continue
      }
      promoted.push({
        ...dot,
        peakAlpha: character.peakAlpha,
        phase: Math.random(),
        lifetimeMs: freshLifetime(),
      })
    }

    // Big stars are not part of the layer's cycle, so those already running keep
    // their own clocks across a respawn. The population is then topped up or
    // trimmed to whatever the current settings imply — carrying the old array
    // wholesale meant a layer could never gain a big star once it had none, so
    // raising the size did nothing.
    const solo = carried ? [...carried.slice(0, promoted.length), ...promoted.slice(carried.length)] : promoted

    return { dots, solo, peakAlpha: character.peakAlpha, lifetimeMs, phase }
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

  /**
   * Built regardless of intensity. Zero simply draws nothing, which makes
   * turning clouds on instant instead of waiting on an allocation, and means a
   * settings change never has to distinguish "hidden" from "absent".
   */
  function buildCloudSet(count: number, tint: (a: number) => string) {
    if (width === 0 || height === 0) return []
    return initialPhases(count)
      .map((phase) => createCloudLayer(width, height, tint, cloudLifetime(), phase))
      .filter((layer): layer is CloudLayer => layer !== null)
  }

  function rebuildClouds() {
    cloudScratch = createCloudScratch(width, height)
    cloudLayers = buildCloudSet(CLOUD_LAYERS, cloudTint(palette, settings.hue))
    hazeLayers = buildCloudSet(HAZE_LAYERS, (alpha) => rgba(palette.background, alpha))
  }

  function advanceCloudSet(set: CloudLayer[], deltaMs: number, tint: (a: number) => string) {
    set.forEach((layer, index) => {
      layer.phase += deltaMs / layer.lifetimeMs
      if (layer.phase < 1) return
      const replacement = createCloudLayer(width, height, tint, cloudLifetime(), 0)
      if (replacement) set[index] = replacement
    })
  }

  function advanceClouds(deltaMs: number) {
    advanceCloudSet(cloudLayers, deltaMs, cloudTint(palette, settings.hue))
    advanceCloudSet(hazeLayers, deltaMs, (alpha) => rgba(palette.background, alpha))
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
    context.fillStyle = rgba(palette.background, 1)
    context.fillRect(0, 0, width, height)

    if (cloudScratch) {
      drawCloudSet(context, cloudScratch, cloudLayers, width, height, settings.fade, settings.curve, settings.clouds)
    }

    context.globalAlpha = 1
    context.fillStyle = rgba(palette.star, 1)

    for (const layer of layers) {
      const alpha = layer.peakAlpha * envelope(layer.phase, settings.fade, settings.curve)
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

    // Each solo star carries its own alpha, so it cannot join a batched path.
    // At the default size none exist; past it the count climbs with `nearRadius`
    // and falls again as `sizeMix` drops. Even at the extreme these are a few
    // hundred small fills, which canvas handles without trouble.
    for (const layer of layers) {
      for (const dot of layer.solo) {
        const alpha = dot.peakAlpha * envelope(dot.phase, settings.fade, settings.curve)
        if (alpha < 0.002) continue
        context.globalAlpha = alpha
        context.beginPath()
        if (dot.outline) {
          traceOutline(context, dot.x, dot.y, dot.radius, dot.outline)
        } else {
          context.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2)
        }
        context.fill()
      }
    }

    for (const glimmer of glimmers) drawGlimmer(context, glimmer, palette.star)

    if (cloudScratch) {
      drawCloudSet(context, cloudScratch, hazeLayers, width, height, settings.fade, settings.curve, settings.haze)
    }

    context.globalAlpha = 1
  }

  /**
   * Picks a layer weighted by how visible it is right now, so a flare never
   * appears where there was no star bright enough to flare.
   */
  function spawnGlimmer() {
    const weights = layers.map((layer) => layer.peakAlpha * envelope(layer.phase, settings.fade, settings.curve))
    const total = weights.reduce((sum, weight) => sum + weight, 0)
    if (total <= 0) return

    let remaining = Math.random() * total
    for (let index = 0; index < layers.length; index += 1) {
      remaining -= weights[index]
      if (remaining > 0) continue

      const layer = layers[index]
      const candidates = [...layer.dots, ...layer.solo]
      const dot = candidates[Math.floor(Math.random() * candidates.length)]
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

  /** Each big star ages and respawns alone, elsewhere on screen. */
  function advanceSolo(layer: Layer, index: number, deltaMs: number) {
    const character = characterFor(index)
    layer.solo.forEach((dot, slot) => {
      dot.phase += deltaMs / dot.lifetimeMs
      if (dot.phase < 1) return
      layer.solo[slot] = {
        ...makeDot(character),
        peakAlpha: character.peakAlpha,
        phase: 0,
        lifetimeMs: freshLifetime(),
      }
    })
  }

  /**
   * Ages every layer, and reconciles their number with the setting.
   *
   * Layers are never replaced where they stand. A dead one is rebuilt with
   * whatever the settings now say, a surplus one is simply let go, and a
   * shortfall is filled with newcomers that fade up from nothing. Between that
   * and `retire`, the array converges on the target without anything jumping.
   */
  function advance(deltaMs: number) {
    let surplus = Math.max(0, layers.length - settings.layerCount)
    const alive: Layer[] = []

    layers.forEach((layer, index) => {
      layer.phase += deltaMs / layer.lifetimeMs

      if (layer.phase < 1) {
        advanceSolo(layer, index, deltaMs)
        alive.push(layer)
        return
      }

      if (surplus > 0) {
        surplus -= 1
        return
      }

      const reborn = buildLayer(alive.length, 0, freshLifetime(), layer.solo)
      advanceSolo(reborn, alive.length, deltaMs)
      alive.push(reborn)
    })

    while (alive.length < settings.layerCount) {
      alive.push(buildLayer(alive.length, 0, freshLifetime()))
    }

    layers = alive
  }

  function frame(nowMs: number) {
    const deltaMs = lastFrameMs === 0 ? 0 : Math.min(nowMs - lastFrameMs, MAX_FRAME_MS)
    lastFrameMs = nowMs
    // Exponential average: one slow frame should not read as a slow sky.
    if (deltaMs > 0) smoothedFrameMs += (deltaMs - smoothedFrameMs) * 0.05
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

  /**
   * Hurries something off stage: same brightness, now descending, and with its
   * remaining time compressed into well under a second.
   *
   * This is what lets a geometry change be smooth without being slow. Waiting
   * for layers to die naturally would take up to their full lifespan, so a
   * setting could not be judged; rebuilding in place teleports every star. This
   * does neither — the old sky dissolves and the new one forms in its place.
   */
  function retire(layer: Layer) {
    const send = (phase: number) => {
      const exit = exitPhase(phase, settings.fade)
      return { exit, lifetimeMs: randomBetween(RETIRE_MIN_MS, RETIRE_MAX_MS) / (1 - exit || 1e-3) }
    }

    const sent = send(layer.phase)
    layer.phase = sent.exit
    layer.lifetimeMs = sent.lifetimeMs

    layer.solo.forEach((dot) => {
      const dotSent = send(dot.phase)
      dot.phase = dotSent.exit
      dot.lifetimeMs = dotSent.lifetimeMs
    })
  }

  function setSettings(next: Settings) {
    const before = settings
    settings = { ...next }
    palette = paletteFor(settings.invert)

    // Nothing is rebuilt in place. Anything whose look has changed is asked to
    // leave, and its replacement is built from the new settings when it goes.
    if (needsRebuild(before, settings)) layers.forEach(retire)
    if (needsCloudRebuild(before, settings)) {
      for (const layer of [...cloudLayers, ...hazeLayers]) {
        const exit = exitPhase(layer.phase, settings.fade)
        layer.phase = exit
        layer.lifetimeMs = randomBetween(RETIRE_MIN_MS, RETIRE_MAX_MS) / (1 - exit || 1e-3)
      }
    }
    if (prefersReducedMotion.matches) drawStill()
  }

  function stats(): StarfieldStats {
    const soloStars = layers.reduce((sum, layer) => sum + layer.solo.length, 0)
    const dots = layers.reduce((sum, layer) => sum + layer.dots.length, 0) + soloStars
    return {
      layers: layers.length,
      dots,
      soloStars,
      // Two composites now, whatever the layer counts.
      fillCalls: layers.length + soloStars + 2,
      cloudLayers: cloudLayers.length,
      hazeLayers: hazeLayers.length,
      fps: Math.round(1000 / smoothedFrameMs),
    }
  }

  function destroy() {
    stop()
    window.removeEventListener("resize", handleResize)
  }

  measure()
  rebuildLayers()
  rebuildClouds()
  window.addEventListener("resize", handleResize)

  return { setSettings, stats, start, stop, destroy }
}
