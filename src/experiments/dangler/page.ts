/**
 * Booting Dangler: everything the page used to do inside its `<script>`.
 *
 * **A page holds markup and calls this. It holds no logic.** All of the below
 * lived in `src/pages/experiments/dangler/index.astro`, outside
 * `src/experiments/`, where a grep of the section never reached it and only
 * `astro check` typed it — which is how five byte-identical copies of
 * `requireElement` sat past the third-copy rule with `kit-adoption.test.ts`
 * unable to see any of them. See `../docs/adr/20260906-a-page-holds-no-logic.md`.
 */
import { createDangler } from "@/experiments/dangler/dangler"
import { createControls } from "@/experiments/kit/controls"
import { isReel } from "@/experiments/gallery/reel"
import { reroll } from "@/experiments/dangler/reroll"
import {
  CONTROLS,
  GROUP_ORDER,
  PRESETS,
  normalizeSettings,
  settingsForLanding,
  urlForSettings,
} from "@/experiments/dangler/settings"
import { announceApi, createApi } from "@/experiments/dangler/api"
import { keepAwake } from "@/experiments/kit/wakelock"
import { requireElement } from "@/experiments/element"

export function boot(): void {
  const canvas = requireElement("Dangler", "lights", HTMLCanvasElement)
  const ui = requireElement("Dangler", "ui", HTMLDivElement)

  // Read once and reused below. The escape hatches are pulled from the same
  // object rather than from `window.location.search`, because the landing
  // rewrite at the end of this script changes what that says.
  const params = new URLSearchParams(window.location.search)

  // A URL naming no settings lands on the first preset rather than on the
  // defaults; see `settingsForLanding`. The defaults stay exactly what they
  // were, so every URL already shared still means what it meant.
  const { settings, featured } = settingsForLanding(params)

  /** Hue reaches the chrome so the controls pick up the colour of the lights. */
  function applyTheme(next: { hue: number }) {
    document.documentElement.style.setProperty("--accent", `hsl(${next.hue}, 62%, 62%)`)
    document.documentElement.style.setProperty("--ui-on-bg", `hsl(${next.hue}, 40%, 40%)`)
    document.documentElement.style.setProperty("--ui-on-text", `hsl(${next.hue}, 60%, 95%)`)
  }

  applyTheme(settings)

  const scene = createDangler(canvas, settings)
  scene.start()

  // The chrome comes from the kit — offered, not imposed; see
  // src/experiments/docs/adr/20260828-the-piece-is-independent-the-gallery-is-not.
  // Everything below is Dangler's own: which rows exist, how they group, the
  // one validator every input goes through, and what a scene's address is.
  const controls = createControls({
    root: ui,
    // Headless on a touch device: the kit keeps the settings, the validator
    // and the URL sync, and draws no bar. The interactive view presents the
    // piece full-bleed and moves through presets by swipe instead.
    chrome: !isReel(),
    aboutHref: "/experiments/dangler/about/",
    settings,
    controls: CONTROLS,
    presets: PRESETS,
    groups: GROUP_ORDER,
    actions: [
      {
        label: "reroll",
        shortcut: "r",
        hint: "A fresh arrangement of strands and bulbs. The seed travels in the address bar.",
        run: (chrome) => reroll(chrome),
      },
    ],
    normalize: (next) => normalizeSettings(next),
    url: (next) => urlForSettings(next, window.location.pathname),
    copy: [
      {
        label: "copy link to this scene",
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
  // A still taken mid-relaxation shows a shape the piece never holds.
  if (params.get("settle") === "1") api.settle()

  // Last, so the escape hatches above are read from the URL as opened. The
  // address now describes the scene on screen, which means a link copied
  // without touching anything keeps working when the featured preset
  // changes. Non-setting params drop out, exactly as they do on the first
  // slider drag.
  if (featured) {
    window.history.replaceState(null, "", urlForSettings(settings, window.location.pathname))
  }
}
