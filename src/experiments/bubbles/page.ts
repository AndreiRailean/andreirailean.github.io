/**
 * Booting Bubbles.
 *
 * **A page holds markup and calls this. It holds no logic** — see
 * `../docs/adr/20260906-a-page-holds-no-logic.md`, which exists because 115
 * lines per page used to live outside `src/experiments/`, where a grep of the
 * section never reached it and only `astro check` typed it.
 */
import { createBubbles } from "@/experiments/bubbles/bubbles"
import { createControls } from "@/experiments/kit/controls"
import { isReel } from "@/experiments/gallery/reel"
import {
  CONTROLS,
  GROUPS,
  normalizeSettings,
  PRESETS,
  reconcile,
  settingsForLanding,
  urlForSettings,
} from "@/experiments/bubbles/settings"
import { announceApi, createApi } from "@/experiments/bubbles/api"
import { keepAwake } from "@/experiments/kit/wakelock"
import { requireElement } from "@/experiments/element"

export function boot(): void {
  const canvas = requireElement("Bubbles", "water", HTMLCanvasElement)
  const ui = requireElement("Bubbles", "ui", HTMLDivElement)

  // Read once and reused below. The escape hatches are pulled from the same
  // object rather than from `window.location.search`, because the landing
  // rewrite at the end of this function changes what that says.
  const params = new URLSearchParams(window.location.search)

  // A bare address lands on the primary rather than on `DEFAULT_SETTINGS`.
  const { settings, featured } = settingsForLanding(params)

  /**
   * The page owns document-level theming; the panel owns its own state.
   *
   * The water is black and the bubbles are white, so the hue reaches nothing in
   * the picture — only the chrome and the written note. It is still read from
   * the settings rather than typed as a literal, because every instance of that
   * fault in the section was a literal that was correct on the day.
   */
  function applyTheme(next: { hue: number }) {
    document.documentElement.style.setProperty("--hue", String(next.hue))
  }

  applyTheme(settings)

  const water = createBubbles(canvas, settings)
  water.start()

  const controls = createControls({
    root: ui,
    // Headless on a touch device: the kit keeps the settings, the validator and
    // the URL sync, and draws no bar.
    chrome: !isReel(),
    aboutHref: "/experiments/bubbles/about/",
    settings,
    controls: CONTROLS,
    groups: GROUPS,
    presets: PRESETS,
    actions: [
      {
        label: "sweep",
        hint: "Take every bubble off the surface and watch the jets fill it again (x)",
        shortcut: "x",
        run: () => {
          water.clear()
        },
      },
      {
        label: "reroll",
        hint: "A fresh seed: a new arrangement of jets, and a new choice of which way each turns (r)",
        shortcut: "r",
        run: (handle) => {
          handle.apply(normalizeSettings({ seed: 1 + Math.floor(Math.random() * 9999) }, handle.getSettings()))
        },
      },
    ],
    // `reconcile` before the clamp, and only for the key actually moved: it is
    // what stops the bottom of the birth band being dragged past the top.
    normalize: (next, changed) => normalizeSettings(changed ? reconcile(next, changed) : next),
    url: (next) => urlForSettings(next, window.location.pathname),
    onChange: (next) => {
      applyTheme(next)
      water.setSettings(next)
    },
  })

  // Left running deliberately, so hold the display on.
  const wakeLock = keepAwake()

  const api = createApi(controls, wakeLock, water)
  window.experiment = api
  announceApi()

  // Escape hatches for tools that cannot evaluate JS. None of them is a
  // setting, so none belongs in the shareable query string.
  if (params.get("panel") === "1") api.panel(true)
  const idleParam = params.get("idle")
  if (idleParam !== null) api.idle(idleParam !== "0")
  const settleParam = Number(params.get("settle"))
  if (Number.isFinite(settleParam) && settleParam > 0) api.settle(settleParam)

  // Last, so the escape hatches above are read from the address as opened. It
  // now describes the water on screen, which means a link copied without
  // touching anything keeps working when the featured preset changes.
  if (featured) {
    window.history.replaceState(null, "", urlForSettings(settings, window.location.pathname))
  }
}
