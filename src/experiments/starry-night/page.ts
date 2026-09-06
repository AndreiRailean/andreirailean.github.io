/**
 * Booting Starry Night: everything the page used to do inside its `<script>`.
 *
 * **A page holds markup and calls this. It holds no logic.** All of the below
 * lived in `src/pages/experiments/starry-night/index.astro`, outside
 * `src/experiments/`, where a grep of the section never reached it and only
 * `astro check` typed it — which is how five byte-identical copies of
 * `requireElement` sat past the third-copy rule with `kit-adoption.test.ts`
 * unable to see any of them. See `../docs/adr/20260906-a-page-holds-no-logic.md`.
 */
import { createStarfield } from "@/experiments/starry-night/starfield"
import { createControls } from "@/experiments/kit/controls"
import { isReel } from "@/experiments/gallery/reel"
import {
  CONTROLS,
  PRESETS,
  normalizeSettings,
  reconcile,
  settingsForLanding,
  urlForSettings,
} from "@/experiments/starry-night/settings"
import { announceApi, createApi } from "@/experiments/starry-night/api"
import { keepAwake } from "@/experiments/kit/wakelock"
import { requireElement } from "@/experiments/element"

export function boot(): void {
  const canvas = requireElement("Starry Night", "sky", HTMLCanvasElement)
  const ui = requireElement("Starry Night", "ui", HTMLDivElement)

  // Read once and reused below. The escape hatches are pulled from the same
  // object rather than from `window.location.search`, because the landing
  // rewrite at the end of this script changes what that says.
  const params = new URLSearchParams(window.location.search)

  const { settings, featured } = settingsForLanding(params)

  /**
   * The page owns document-level theming; the panel owns its own state.
   * Hue reaches the CSS as a custom property so the chrome picks up the
   * same colour as the clouds without duplicating the palette in script.
   */
  function applyTheme(next: { invert: boolean; hue: number }) {
    const root = document.documentElement
    root.dataset.invert = String(next.invert)
    root.style.setProperty("--hue", String(next.hue))
  }

  applyTheme(settings)

  const sky = createStarfield(canvas, settings)
  sky.start()

  // The chrome comes from the kit — offered, not imposed; see
  // src/experiments/docs/adr/20260828-the-piece-is-independent-the-gallery-is-not.
  // Everything below is Starry Night's own: which rows exist, and the one
  // validator every input goes through. No groups — twelve rows read fine
  // undivided, where Dangler's twenty-seven do not.
  const controls = createControls({
    root: ui,
    // Headless on a touch device: the kit keeps the settings, the validator
    // and the URL sync, and draws no bar. The interactive view presents the
    // piece full-bleed and moves through presets by swipe instead.
    chrome: !isReel(),
    aboutHref: "/experiments/starry-night/about/",
    settings,
    controls: CONTROLS,
    presets: PRESETS,
    // `reconcile` before the clamp, and only for the key actually moved:
    // it is what stops a lifespan minimum being dragged past its maximum.
    // The panel used to skip this, and that was the bug.
    normalize: (next, changed) => normalizeSettings(changed ? reconcile(next, changed) : next),
    url: (next) => urlForSettings(next, window.location.pathname),
    onChange: (next) => {
      applyTheme(next)
      sky.setSettings(next)
    },
  })

  // Left running deliberately, so hold the display on.
  const wakeLock = keepAwake()

  // Console handle. See src/experiments/AGENTS.md. Held locally as well as
  // on `window`, which is typed `unknown` so the experiments stay
  // independent of one another — see src/experiments/window.d.ts.
  const api = createApi(controls, wakeLock, sky)
  window.experiment = api
  announceApi()

  // Two escape hatches for tools that cannot evaluate JS: ?panel=1 opens the
  // settings panel on load, ?idle=0 stops the chrome hiding itself. Neither
  // is a setting, so neither belongs in the shareable query string.
  if (params.get("panel") === "1") api.panel(true)
  const idleParam = params.get("idle")
  if (idleParam !== null) api.idle(idleParam !== "0")

  // Last, so the escape hatches above are read from the URL as opened. The
  // address then describes the sky on screen, which means a link copied
  // without touching anything keeps working when the featured preset
  // changes.
  //
  // It writes a bare address today, and that is the open half of #128: the
  // primary and `DEFAULT_SETTINGS` hold the same values, so the diff
  // `urlForSettings` writes is empty and the rewrite pins nothing. The wiring
  // is here so that stops being true the moment the two are separated.
  if (featured) {
    window.history.replaceState(null, "", urlForSettings(settings, window.location.pathname))
  }
}
