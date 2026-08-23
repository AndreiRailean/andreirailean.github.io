/**
 * A layer's look and lifespan, all derived from a single `depth` value.
 *
 * The three visual variants this experiment compares differ only in how they
 * *sample* depth — never in the underlying character space — so the comparison
 * stays apples-to-apples.
 */
export type LayerCharacter = {
  /** Dots per megapixel of viewport, so density is resolution-independent. */
  density: number
  minRadius: number
  maxRadius: number
  peakAlpha: number
}

/** depth 0: many, tiny, dim. */
const FAR: LayerCharacter = {
  // Per-layer density is deliberately low: the sky is built from many thin
  // layers rather than a few dense ones, so no single fade dominates.
  density: 60,
  // Kept above ~0.7 so a dot is never sub-pixel at DPR 1: a 0.4px radius
  // covers half a pixel, so antialiasing spreads it thin and it can never
  // reach its nominal alpha.
  minRadius: 0.7,
  maxRadius: 1.1,
  peakAlpha: 0.5,
}

/** depth 1: few, large, bright. */
const NEAR: LayerCharacter = {
  density: 8,
  minRadius: 1.4,
  maxRadius: 2.6,
  peakAlpha: 0.95,
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const lerp = (from: number, to: number, t: number) => from + (to - from) * t

/** Interpolates the far/near extremes into the character for an arbitrary depth. */
export function characterAt(depth: number): LayerCharacter {
  const t = clamp01(depth)
  return {
    density: lerp(FAR.density, NEAR.density, t),
    minRadius: lerp(FAR.minRadius, NEAR.minRadius, t),
    maxRadius: lerp(FAR.maxRadius, NEAR.maxRadius, t),
    peakAlpha: lerp(FAR.peakAlpha, NEAR.peakAlpha, t),
  }
}

export const MODES = ["depth", "random", "identical"] as const

export type Mode = (typeof MODES)[number]

export function isMode(value: unknown): value is Mode {
  return typeof value === "string" && (MODES as readonly string[]).includes(value)
}

/** Chooses the depth a layer is born at. Called once per layer birth. */
type DepthPolicy = (layerIndex: number, layerCount: number) => number

export const DEPTH_POLICIES: Record<Mode, DepthPolicy> = {
  /** Fixed tiers spread across the full range: 0, 0.5, 1 for three layers. */
  depth: (index, count) => (count < 2 ? 0.5 : index / (count - 1)),
  /** A fresh roll on every respawn, so a layer's tier changes over time. */
  random: () => Math.random(),
  /** Every layer parked mid-range, forever — no depth cue at all. */
  identical: () => 0.5,
}

/** Viewport the densities above are tuned against, in megapixels (1920x1080). */
const REFERENCE_MEGAPIXELS = 2.07

/**
 * How many dots a character wants, for a viewport measured in CSS pixels.
 *
 * Count grows with area^0.75 rather than with area itself. A phone is held far
 * closer than a desktop monitor, so matching dots-per-area leaves small screens
 * looking empty; the exponent compresses that spread. Anchored so a 1920x1080
 * viewport comes out exactly as tuned.
 */
export function dotCountFor(character: LayerCharacter, width: number, height: number, densityScale = 1): number {
  const megapixels = (width * height) / 1_000_000
  const scale = REFERENCE_MEGAPIXELS * (megapixels / REFERENCE_MEGAPIXELS) ** 0.75
  return Math.max(1, Math.round(character.density * scale * densityScale))
}

/** A lifespan for a newly born layer, independent of its depth. */
export function randomLifetimeMs(minMs: number, maxMs: number): number {
  return minMs + Math.random() * (maxMs - minMs)
}

/**
 * Opening lifespans, spread geometrically across the range and then shuffled.
 *
 * Two layers whose lifespans are near-equal stay in near-lockstep for minutes:
 * their beat period is L1*L2/|L1-L2|, so 15s against 15.5s holds together for
 * about eight of them. Spreading the first set by a constant *ratio* keeps every
 * pair's beat period short, so the layers drift apart immediately rather than
 * waiting on luck. Respawns draw freely — by then the clocks are scattered.
 */
export function initialLifetimesMs(count: number, minMs: number, maxMs: number): number[] {
  if (count < 2) return [randomLifetimeMs(minMs, maxMs)]
  const ratio = maxMs / minMs
  return Array.from({ length: count }, (_, index) => minMs * ratio ** (index / (count - 1)))
    .map((lifetimeMs) => ({ lifetimeMs, sortKey: Math.random() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((entry) => entry.lifetimeMs)
}

/**
 * Evenly spread starting phases, shuffled so that where a layer sits in its
 * fade cycle bears no relation to its depth. Without the shuffle the opening
 * seconds read as a gradient sweeping from far to near, and an evenly spread
 * start is what keeps the sky populated before the clocks have drifted apart.
 */
export function initialPhases(count: number): number[] {
  return Array.from({ length: count }, (_, index) => (index + 0.5) / count)
    .map((phase) => ({ phase, sortKey: Math.random() }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((entry) => entry.phase)
}

const smoothstep = (t: number) => t * t * (3 - 2 * t)

/**
 * Opacity multiplier across a layer's life, from birth (0) to death (1).
 *
 * `hold` is the fraction of the lifetime spent at full opacity; the default 0
 * gives a pure fade-in/fade-out bell with no plateau. Raise it if the sky feels
 * too busy — stars then persist rather than continuously breathing.
 */
export function envelope(phase: number, hold = 0): number {
  const t = clamp01(phase)
  const ramp = (1 - clamp01(hold)) / 2
  if (ramp <= 0) return 1
  if (t < ramp) return smoothstep(t / ramp)
  if (t <= 1 - ramp) return 1
  return smoothstep((1 - t) / ramp)
}
