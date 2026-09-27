/**
 * Which points in the parameter space are named — the piece's presets.
 *
 * Its own file because presets change for a different reason than the space
 * they sit in: curation, under Andrei's eye, where `settings.ts` changes when a
 * parameter does. The runner never imports this; see
 * `../docs/adr/20260928-a-piece-is-a-library-behind-three-files.md`.
 */
import type { Settings } from "@/experiments/walkers/settings"

/**
 * Scenes worth keeping, each stating every setting.
 *
 * **A preset inherits from nothing** — not from another preset and not from
 * `DEFAULT_SETTINGS`. Spreading over the defaults reads as tidy and is the trap
 * that cost Psyxels four of its six scenes; see
 * `../docs/adr/20260830-a-preset-inherits-from-nothing.md`.
 */
export const PRESETS: { label: string; hint: string; settings: Settings }[] = [
  {
    label: "chalky",
    hint: "Nothing drawn but where people went, in chalk on slate. Andrei's, found with the sliders.",
    settings: {
      flow: "wander",
      palette: "quiet",
      dusk: true,
      heads: false,
      density: 26,
      grouping: 0.15,
      children: 0.16,
      runners: 0.6,
      settling: 0,
      paceLow: 0.9,
      paceHigh: 3.15,
      play: 1.3,
      gaze: 0,
      bob: 0.9,
      span: 24,
      camera: 60,
      traces: 6,
      // Given as 360, which is the same colour: the hue every presentation
      // surface reads has to be in [0, 360), and `tests/unit/experiments-presets`
      // holds every piece to it.
      hue: 0,
      tint: 0.18,
      spread: 78,
      pastel: 1,
      playback: 0.65,
      seed: 58901,
    },
  },
  {
    label: "bacteria",
    hint: "Far enough up that people are motile specks. Found by accident and kept.",
    settings: {
      flow: "wander",
      palette: "kin",
      dusk: true,
      heads: true,
      density: 34,
      grouping: 0.3,
      children: 0.46,
      runners: 0.6,
      settling: 0,
      paceLow: 1.05,
      paceHigh: 4.05,
      play: 1.1,
      gaze: 1.45,
      bob: 0.8,
      span: 30,
      camera: 150,
      traces: 0,
      hue: 230,
      tint: 0.74,
      spread: 108,
      pastel: 1,
      playback: 1,
      seed: 44232,
    },
  },
  {
    label: "busy",
    hint: "Nobody with anybody, all going the same way, from high enough up that a person is a point of light.",
    settings: {
      flow: "through",
      palette: "crowd",
      dusk: true,
      heads: true,
      density: 55,
      grouping: 0,
      children: 0.6,
      runners: 0.6,
      settling: 0.02,
      paceLow: 1.1,
      paceHigh: 4.05,
      play: 1.5,
      gaze: 0,
      bob: 2.5,
      span: 15.5,
      camera: 150,
      traces: 0,
      hue: 245,
      tint: 0.18,
      spread: 120,
      pastel: 1,
      playback: 1,
      seed: 1307,
    },
  },
]
