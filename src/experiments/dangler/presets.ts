/**
 * Which points in the parameter space are named — the piece's presets.
 *
 * Its own file because presets change for a different reason than the space
 * they sit in: curation, under Andrei's eye, where `settings.ts` changes when a
 * parameter does. The runner never imports this; see
 * `../docs/adr/20260928-a-piece-is-a-library-behind-three-files.md`.
 */
import type { Settings } from "@/experiments/dangler/settings"

/**
 * Recorded scenes.
 *
 * The section's convention is that presets are recorded from exploration rather
 * than designed up front, so each one is written out in full rather than spread
 * over `DEFAULT_SETTINGS`. A scene someone found by dragging sliders should stay
 * the scene they found; inheriting the defaults would let it drift silently the
 * next time one of those is retuned.
 */
export const PRESETS: { label: string; hint: string; settings: Settings }[] = [
  {
    label: "dreamy",
    hint: "Six arms of long, all but limp strands in cold blue, falling past you, everything barely moving.",
    settings: {
      seed: 310555,
      strands: 52,
      beads: 9,
      segments: 34,
      extent: 3.5,
      ceiling: 4,
      relief: 1.35,
      branches: 6,
      // Longer than the canopy is high, so the nearest bulbs fall past the
      // viewer and out of frame rather than resolving into a string.
      length: 4.45,
      // All but limp. What little shape the strands hold comes to almost nothing,
      // so they hang plumb and the arrangement is the canopy's, not theirs.
      stiffness: 0.01,
      set: 0.19,
      twist: -0.93,
      irregularity: 0.62,
      fieldOfView: 65,
      pitch: 0,
      hue: 196,
      hueSpread: 10,
      variance: 0.62,
      size: 0.01,
      bloom: 14,
      // Orientation ignored: with strands this limp every bulb faces much the same
      // way, and dimming by it would only thin the scene out.
      facing: 0,
      falloff: 0.22,
      flicker: 0.23,
      breeze: 0.33,
      gust: 0.1,
      gustRate: 17,
      tremble: 0,
      sway: 0.5,
    },
  },
  {
    label: "together",
    hint: "A tight low cluster, strands plumb and plunging past you, all of it moving.",
    settings: {
      seed: 7,
      strands: 50,
      beads: 4,
      segments: 20,
      extent: 0.65,
      ceiling: 1.7,
      // Relief larger than the ceiling on purpose. The anchors themselves stay
      // in front of you — measured, 0.36m at the lowest — but hanging their own
      // length again from that puts the bottom of most strands behind the camera,
      // so roughly a fifth of the bulbs are culled at any moment and the rest
      // pass by very close.
      relief: 2,
      branches: 0,
      length: 1.7,
      // No bend at all. Every strand hangs plumb, and the arrangement comes
      // entirely from where the anchors are and how the breeze moves them.
      stiffness: 0,
      set: 0,
      twist: -0.61,
      irregularity: 1,
      fieldOfView: 56,
      pitch: 0,
      hue: 38,
      hueSpread: 7.5,
      variance: 0.74,
      size: 0.01,
      bloom: 8.4,
      facing: 0.38,
      falloff: 0.34,
      flicker: 0.48,
      breeze: 0.51,
      gust: 0,
      gustRate: 6,
      tremble: 0,
      sway: 0.7,
    },
  },
  {
    label: "frantic",
    hint: "Fifty-one short strands crammed almost overhead, hot pink through green, hit hard and often.",
    settings: {
      seed: 7,
      strands: 51,
      beads: 4,
      segments: 20,
      extent: 0.2,
      ceiling: 1.8,
      relief: 1,
      branches: 0,
      length: 0.65,
      stiffness: 0.63,
      set: 0.39,
      twist: -0.61,
      irregularity: 1,
      fieldOfView: 56,
      pitch: 0,
      hue: 323,
      hueSpread: 62.5,
      variance: 0.74,
      size: 0.01,
      bloom: 8.4,
      facing: 0.38,
      falloff: 0.49,
      flicker: 0,
      breeze: 0,
      gust: 1,
      gustRate: 9,
      tremble: 0,
      sway: 0,
    },
  },
]
