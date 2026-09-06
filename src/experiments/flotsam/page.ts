/**
 * Booting Flotsam: everything the page used to do inside its `<script>`.
 *
 * **A page holds markup and calls this. It holds no logic.** All of the below
 * lived in `src/pages/experiments/flotsam/index.astro`, outside
 * `src/experiments/`, where a grep of the section never reached it and only
 * `astro check` typed it — which is how five byte-identical copies of
 * `requireElement` sat past the third-copy rule with `kit-adoption.test.ts`
 * unable to see any of them. See `../docs/adr/20260906-a-page-holds-no-logic.md`.
 */
import { createFlotsam } from "@/experiments/flotsam/flotsam"
import { createControls } from "@/experiments/kit/controls"
import { isReel } from "@/experiments/gallery/reel"
import { reroll } from "@/experiments/flotsam/reroll"
import {
  CONTROLS,
  GROUP_ORDER,
  PRESETS,
  normalizeSettings,
  reconcile,
  settingsForLanding,
  urlForSettings,
} from "@/experiments/flotsam/settings"
import { announceApi, createApi } from "@/experiments/flotsam/api"
import { keepAwake } from "@/experiments/kit/wakelock"
import { requireElement } from "@/experiments/element"

export function boot(): void {
  const canvas = requireElement("Flotsam", "water", HTMLCanvasElement)
  const ui = requireElement("Flotsam", "ui", HTMLDivElement)

  // Read once and reused below. The escape hatches are pulled from the same
  // object rather than from `window.location.search`, because the landing
  // rewrite at the end of this script changes what that says.
  const params = new URLSearchParams(window.location.search)

  const { settings, featured } = settingsForLanding(params)

  /** Hue reaches the chrome so the controls take the colour of the light. */
  function applyTheme(next: { hue: number }) {
    document.documentElement.style.setProperty("--accent", `hsl(${next.hue}, 58%, 62%)`)
    document.documentElement.style.setProperty("--ui-on-bg", `hsl(${next.hue}, 38%, 38%)`)
    document.documentElement.style.setProperty("--ui-on-text", `hsl(${next.hue}, 60%, 95%)`)
  }

  applyTheme(settings)

  const scene = createFlotsam(canvas, settings)
  scene.start()

  // The chrome comes from the kit — offered, not imposed; see
  // src/experiments/docs/adr/20260828-the-piece-is-independent-the-gallery-is-not.
  // Everything below is Flotsam's own: which rows exist, how they group, the
  // one validator every input goes through, and what a scene's address is.
  const controls = createControls({
    root: ui,
    // Headless on a touch device: the kit keeps the settings, the validator
    // and the URL sync, and draws no bar. The interactive view presents the
    // piece full-bleed and moves through presets by swipe instead.
    chrome: !isReel(),
    aboutHref: "/experiments/flotsam/about/",
    settings,
    controls: CONTROLS,
    presets: PRESETS,
    groups: GROUP_ORDER,
    actions: [
      {
        label: "reroll",
        shortcut: "r",
        hint: "A fresh sea and a fresh scattering. The seed travels in the address bar.",
        run: (chrome) => reroll(chrome),
      },
    ],
    // `reconcile` before the clamp, and only for the key actually moved: it
    // is what lets the upper handle of a bound pair be dragged down past the
    // lower one instead of fighting it.
    normalize: (next, changed) => normalizeSettings(changed ? reconcile(next, changed) : next),
    url: (next) => urlForSettings(next, window.location.pathname),
    copy: [
      {
        label: "copy link to this water",
        title: "Copy this page's address, which carries every setting above.",
        text: () => window.location.href,
      },
    ],
    onChange: (next) => {
      applyTheme(next)
      scene.setSettings(next)
    },
  })

  // Left running deliberately, so hold the display on.
  const wakeLock = keepAwake()

  // Console handle. See src/experiments/AGENTS.md. Held locally as well as
  // on `window`, which is typed `unknown` so the experiments stay
  // independent of one another — see src/experiments/window.d.ts.
  const api = createApi(controls, wakeLock, scene)
  window.experiment = api
  announceApi()

  // Escape hatches for tools that cannot evaluate JS. None is a setting, so
  // none belongs in the shareable query string.
  if (params.get("panel") === "1") api.panel(true)
  const idleParam = params.get("idle")
  if (idleParam !== null) api.idle(idleParam !== "0")
  if (params.get("debug") === "1") api.debug(true)
  // The gathering takes a wave period or two to establish, and wave drift
  // takes far longer, so a still of frame one is a still of water that has
  // not started yet.
  const run = Number(params.get("run"))
  if (Number.isFinite(run) && run > 0) api.run(run)

  // Last, so the escape hatches above are read from the URL as opened. The
  // address now describes the scene on screen, which means a link copied
  // without touching anything keeps working when the featured preset
  // changes. Non-setting params drop out, exactly as they do on the first
  // slider drag.
  if (featured) {
    window.history.replaceState(null, "", urlForSettings(settings, window.location.pathname))
  }
}
