/**
 * Booting Walkers: everything the page used to do inside its `<script>`.
 *
 * **A page holds markup and calls this. It holds no logic.** All of the below
 * lived in `src/pages/experiments/walkers/index.astro`, outside
 * `src/experiments/`, where a grep of the section never reached it and only
 * `astro check` typed it — which is how five byte-identical copies of
 * `requireElement` sat past the third-copy rule with `kit-adoption.test.ts`
 * unable to see any of them. See `../docs/adr/20260906-a-page-holds-no-logic.md`.
 */
import { createWalkers } from "@/experiments/walkers/walkers"
import { createControls } from "@/experiments/kit/controls"
import { isReel } from "@/experiments/gallery/reel"
import {
  CONTROLS,
  GROUPS,
  PRESETS,
  normalizeSettings,
  reconcile,
  settingsForLanding,
  urlForSettings,
} from "@/experiments/walkers/settings"
import { announceApi, createApi } from "@/experiments/walkers/api"
import { reroll } from "@/experiments/walkers/reroll"
import { keepAwake } from "@/experiments/kit/wakelock"
import { requireElement } from "@/experiments/element"

export function boot(): void {
  const canvas = requireElement("Walkers", "park", HTMLCanvasElement)
  const ui = requireElement("Walkers", "ui", HTMLDivElement)

  // Read once and reused below. The escape hatches are pulled from the same
  // object rather than from `window.location.search`, because the landing
  // rewrite at the end of this script changes what that says.
  const params = new URLSearchParams(window.location.search)

  // A bare address lands on the primary rather than on `DEFAULT_SETTINGS`;
  // see `settingsForLanding`.
  const { settings, featured } = settingsForLanding(params)

  /**
   * The page owns document-level theming; the panel owns its own state.
   * The ground's hue reaches the CSS as a custom property so the chrome is
   * tinted from the same colour the grass is without duplicating the
   * palette in script.
   */
  function applyTheme(next: { dusk: boolean; hue: number }) {
    const root = document.documentElement
    root.dataset.dusk = String(next.dusk)
    root.style.setProperty("--hue", String(next.hue))
  }

  applyTheme(settings)

  const park = createWalkers(canvas, settings)
  park.start()

  // The chrome comes from the kit — offered, not imposed; see
  // src/experiments/docs/adr/20260828-the-piece-is-independent-the-gallery-is-not.
  // Everything below is this piece's own: which rows exist, how they are
  // filed, and the one validator every input goes through.
  const controls = createControls({
    root: ui,
    // Headless on a touch device: the kit keeps the settings, the validator
    // and the URL sync, and draws no bar.
    chrome: !isReel(),
    aboutHref: "/experiments/walkers/about/",
    settings,
    controls: CONTROLS,
    groups: GROUPS,
    presets: PRESETS,
    actions: [
      {
        label: "another crowd",
        hint: "A different set of people at the same settings (r)",
        shortcut: "r",
        run: (handle) => {
          reroll(handle)
        },
      },
    ],
    // `reconcile` before the clamp, and only for the key actually moved: it
    // is what stops the bottom of the pace band being dragged past the top.
    normalize: (next, changed) => normalizeSettings(changed ? reconcile(next, changed) : next),
    url: (next) => urlForSettings(next, window.location.pathname),
    onChange: (next) => {
      applyTheme(next)
      park.setSettings(next)
    },
  })

  // Left running deliberately, so hold the display on.
  const wakeLock = keepAwake()

  // Console handle. See src/experiments/AGENTS.md. Held locally as well as
  // on `window`, which is typed `unknown` so the experiments stay
  // independent of one another — see src/experiments/window.d.ts.
  const api = createApi(controls, wakeLock, park)
  window.experiment = api
  announceApi()

  // Escape hatches for tools that cannot evaluate JS: ?panel=1 opens the
  // settings panel on load, ?idle=0 stops the chrome hiding itself, and
  // ?settle=90 lands on a park that has been going for ninety seconds
  // rather than on a field people have only just started walking into.
  // None of them is a setting, so none belongs in the shareable query
  // string.
  if (params.get("panel") === "1") api.panel(true)
  const idleParam = params.get("idle")
  if (idleParam !== null) api.idle(idleParam !== "0")
  if (params.get("debug") === "1") api.debug(true)
  const settleParam = Number(params.get("settle"))
  if (Number.isFinite(settleParam) && settleParam > 0) api.settle(settleParam)

  // Last, so the escape hatches above are read from the address as opened.
  // It now describes the park on screen, which means a link copied without
  // touching anything keeps working when the featured preset changes.
  if (featured) {
    window.history.replaceState(null, "", urlForSettings(settings, window.location.pathname))
  }
}
