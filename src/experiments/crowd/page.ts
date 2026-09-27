/**
 * Booting Crowd: everything the page would otherwise do inside a `<script>`.
 *
 * **A page holds markup and calls this. It holds no logic.** Code inside
 * `src/pages/` is outside `src/experiments/`, where a grep of the section never
 * reaches it and only `astro check` types it — which is how five byte-identical
 * copies of `requireElement` sat past the third-copy rule with
 * `kit-adoption.test.ts` structurally unable to see any of them. See
 * `../docs/adr/20260906-a-page-holds-no-logic.md`.
 */
import { createCrowd } from "@/experiments/crowd/crowd"
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
} from "@/experiments/crowd/settings"
import { announceApi, createApi } from "@/experiments/crowd/api"
import { reroll } from "@/experiments/crowd/reroll"
import { keepAwake } from "@/experiments/kit/wakelock"
import { requireElement } from "@/experiments/element"

export function boot(): void {
  const canvas = requireElement("Crowd", "square", HTMLCanvasElement)
  const ui = requireElement("Crowd", "ui", HTMLDivElement)

  // Read once and reused below. The escape hatches are pulled from this object
  // rather than from `window.location.search`, because the landing rewrite at
  // the end of this function changes what that says.
  const params = new URLSearchParams(window.location.search)

  // A bare address lands on the primary rather than on `DEFAULT_SETTINGS`.
  const { settings, featured } = settingsForLanding(params)

  /**
   * The page owns document-level theming; the panel owns its own state.
   *
   * The crowd's hue reaches the CSS as a custom property so the chrome is tinted
   * from the same number the heads are, without a second copy of the palette in
   * script. It is a real value even in the scenes that are pure white, which is
   * why this is unconditional.
   */
  function applyTheme(next: { hue: number }) {
    document.documentElement.style.setProperty("--hue", String(next.hue))
  }

  applyTheme(settings)

  const square = createCrowd(canvas, settings)
  square.start()

  // The chrome comes from the kit — offered, not imposed. Everything below is
  // this piece's own: which rows exist, how they are filed, and the one
  // validator every input goes through.
  const controls = createControls({
    root: ui,
    // Headless on a touch device: the kit keeps the settings, the validator and
    // the URL sync, and draws no bar.
    chrome: !isReel(),
    aboutHref: "/experiments/crowd/about/",
    settings,
    controls: CONTROLS,
    groups: GROUPS,
    presets: PRESETS,
    actions: [
      {
        label: "other strangers",
        hint: "A different set of people at the same settings (r)",
        shortcut: "r",
        run: (handle) => {
          reroll(handle)
        },
      },
    ],
    // `reconcile` before the clamp, and only for the key actually moved: it is
    // what stops the bottom of the pace band being dragged past the top.
    normalize: (next, changed) => normalizeSettings(changed ? reconcile(next, changed) : next),
    url: (next) => urlForSettings(next, window.location.pathname),
    onChange: (next) => {
      applyTheme(next)
      square.setSettings(next)
    },
  })

  // Left running deliberately, so hold the display on.
  const wakeLock = keepAwake()

  // Console handle. Held locally as well as on `window`, which is typed
  // `unknown` so the experiments stay independent of one another.
  const api = createApi(controls, wakeLock, square)
  window.experiment = api
  announceApi()

  // Escape hatches for tools that cannot evaluate JS: ?panel=1 opens the
  // settings panel on load, ?idle=0 stops the chrome hiding itself, and
  // ?settle=60 lands on a walk that has been going a minute rather than on a
  // crowd that has not yet negotiated anything. None of them is a setting, so
  // none belongs in the shareable query string.
  if (params.get("panel") === "1") api.panel(true)
  const idleParam = params.get("idle")
  if (idleParam !== null) api.idle(idleParam !== "0")
  const settleParam = Number(params.get("settle"))
  if (Number.isFinite(settleParam) && settleParam > 0) api.settle(settleParam)

  // Last, so the escape hatches above are read from the address as opened. It
  // now describes the walk on screen, which means a link copied without touching
  // anything keeps working when the featured preset changes.
  if (featured) {
    window.history.replaceState(null, "", urlForSettings(settings, window.location.pathname))
  }
}
