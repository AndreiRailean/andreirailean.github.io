/**
 * Which points in the parameter space are named — the piece's presets.
 *
 * Its own file because presets change for a different reason than the space
 * they sit in: curation, under Andrei's eye, where `settings.ts` changes when a
 * parameter does. The runner never imports this; see
 * `../docs/adr/20260928-a-piece-is-a-library-behind-three-files.md`.
 */
import type { Settings } from "@/experiments/starry-night/settings"

/**
 * Starting points, not conclusions. Keys 1-3 load these; the intent is that you
 * explore with the sliders, then a URL worth keeping gets baked in here.
 *
 * Every one of them states every setting and inherits from nothing — not from
 * another preset and not from `DEFAULT_SETTINGS`. `deep field` was a spread over
 * the defaults until #128, which is the shape that cost Psyxels four of its six
 * scenes; see `../docs/adr/20260830-a-preset-inherits-from-nothing.md`. The
 * values below are the ones that spread produced, written out unchanged.
 */
export const PRESETS: { label: string; hint: string; settings: Settings }[] = [
  {
    label: "deep field",
    hint: "Many faint layers on a dark sky. The starting point.",
    settings: {
      mode: "depth",
      invert: false,
      layerCount: 14,
      fade: 0.1,
      curve: 1,
      glimmersPerSecond: 0.5,
      densityScale: 1,
      nearRadius: 3,
      sizeMix: 1,
      wobble: 0.22,
      clouds: 0.15,
      haze: 0.2,
      hue: 247,
      minLifetimeMs: 6_000,
      maxLifetimeMs: 26_000,
    },
  },
  {
    label: "clay",
    hint: "Dark stars pressed into a warm light ground.",
    settings: {
      mode: "depth",
      invert: true,
      layerCount: 13,
      fade: 0.13,
      curve: 1,
      glimmersPerSecond: 1.45,
      densityScale: 3,
      nearRadius: 16,
      sizeMix: 0.65,
      wobble: 0.22,
      clouds: 0.25,
      haze: 0,
      hue: 30,
      minLifetimeMs: 2500,
      maxLifetimeMs: 9500,
    },
  },
  {
    label: "alive",
    hint: "Short lifespans and frequent flares, so the sky never settles.",
    settings: {
      mode: "depth",
      invert: false,
      layerCount: 18,
      fade: 0.45,
      curve: 1,
      glimmersPerSecond: 1.75,
      densityScale: 0.6,
      nearRadius: 2.6,
      sizeMix: 1,
      wobble: 0.22,
      clouds: 0.22,
      haze: 0,
      hue: 225,
      minLifetimeMs: 3500,
      maxLifetimeMs: 10500,
    },
  },
]
