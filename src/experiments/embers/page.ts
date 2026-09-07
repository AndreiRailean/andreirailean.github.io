/**
 * Booting Embers.
 *
 * **A page holds markup and calls this. It holds no logic** — see
 * `../docs/adr/20260906-a-page-holds-no-logic.md`, which exists because 115
 * lines per page used to live outside `src/experiments/`, where a grep of the
 * section never reached it and only `astro check` typed it.
 */
import { createEmbers } from "@/experiments/embers/embers"
import { createControls } from "@/experiments/kit/controls"
import { isReel } from "@/experiments/gallery/reel"
import { groundColour } from "@/experiments/embers/draw"
import {
  CONTROLS,
  GROUPS,
  normalizeSettings,
  PRESETS,
  reconcile,
  settingsForLanding,
  urlForSettings,
} from "@/experiments/embers/settings"
import { announceApi, createApi } from "@/experiments/embers/api"
import { keepAwake } from "@/experiments/kit/wakelock"
import { requireElement } from "@/experiments/element"

export function boot(): void {
  const canvas = requireElement("Embers", "fire", HTMLCanvasElement)
  const ui = requireElement("Embers", "ui", HTMLDivElement)

  // Read once and reused below. The escape hatches are pulled from the same
  // object rather than from `window.location.search`, because the landing
  // rewrite at the end of this function changes what that says.
  const params = new URLSearchParams(window.location.search)

  // A bare address lands on the primary rather than on `DEFAULT_SETTINGS`.
  const { settings, featured } = settingsForLanding(params)

  /**
   * The page owns document-level theming; the panel owns its own state.
   *
   * The fire's hue reaches the CSS as a custom property, so the chrome is tinted
   * from the same number Planck's law is being rotated by rather than from a
   * second copy of it — and the page's own background is the same near-black the
   * canvas fades toward, so a frame drawn before the first paint is not a black
   * rectangle in a warm document.
   */
  function applyTheme(next: { hue: number }) {
    const root = document.documentElement
    root.style.setProperty("--hue", String(next.hue))
    root.style.setProperty("--ground", groundColour(next.hue))
  }

  applyTheme(settings)

  const fire = createEmbers(canvas, settings)
  fire.start()

  const controls = createControls({
    root: ui,
    // Headless on a touch device: the kit keeps the settings, the validator and
    // the URL sync, and draws no bar.
    chrome: !isReel(),
    aboutHref: "/experiments/embers/about/",
    settings,
    controls: CONTROLS,
    groups: GROUPS,
    presets: PRESETS,
    actions: [
      {
        label: "burst",
        hint: "Make the fire surge now: a puff of hot gas and a slug of embers with it (b)",
        shortcut: "b",
        run: () => {
          fire.burst()
        },
      },
    ],
    // `reconcile` before the clamp, and only for the key actually moved: it is
    // what stops the bottom of the size band being dragged past the top.
    normalize: (next, changed) => normalizeSettings(changed ? reconcile(next, changed) : next),
    url: (next) => urlForSettings(next, window.location.pathname),
    onChange: (next) => {
      applyTheme(next)
      fire.setSettings(next)
    },
  })

  // Left running deliberately, so hold the display on.
  const wakeLock = keepAwake()

  const api = createApi(controls, wakeLock, fire)
  window.experiment = api
  announceApi()

  // Escape hatches for tools that cannot evaluate JS. None of them is a
  // setting, so none belongs in the shareable query string.
  if (params.get("panel") === "1") api.panel(true)
  const idleParam = params.get("idle")
  if (idleParam !== null) api.idle(idleParam !== "0")
  if (params.get("debug") === "1") api.debug(true)
  const settleParam = Number(params.get("settle"))
  if (Number.isFinite(settleParam) && settleParam > 0) api.settle(settleParam)

  // Last, so the escape hatches above are read from the address as opened. It
  // now describes the fire on screen, which means a link copied without touching
  // anything keeps working when the featured preset changes.
  if (featured) {
    window.history.replaceState(null, "", urlForSettings(settings, window.location.pathname))
  }
}
