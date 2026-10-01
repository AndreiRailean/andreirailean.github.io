/**
 * Booting a piece: the one boot every piece runs.
 *
 * It was eight `page.ts` files that were one function with different names in
 * it, plus eight `api.ts` files forwarding the same verbs and five byte-identical
 * `reroll.ts`. A piece now hands over its three files and this wires them:
 * `settings.ts` for what is allowed, `presets.ts` for which points are named,
 * and `runner.ts`'s `start` for how a point becomes pixels. See
 * `../docs/adr/20260928-a-piece-is-a-library-behind-three-files.md`.
 *
 * **Given the modules, never importing them.** A piece's `Piece.astro` makes
 * the three imports and calls this, so the gallery still imports no piece, and
 * nothing here knows what a setting means — apart from `seed`, on a piece that
 * says it rerolls.
 *
 * **A page holds no logic**, and this is where the logic went; see
 * `../docs/adr/20260906-a-page-holds-no-logic.md`.
 */
import { createBaseApi, reportControls } from "@/experiments/kit/api"
import { createControls, type Control } from "@/experiments/kit/controls"
import { keepAwake } from "@/experiments/kit/wakelock"
import { isReel } from "@/experiments/gallery/reel"
import { requireElement } from "@/experiments/element"
import {
  settingsForLanding,
  type Chrome,
  type PieceApi,
  type Preset,
  type SettingsModule,
  type Start,
  type Verbs,
} from "@/experiments/piece"

export type Piece<S extends object, V extends Verbs, T> = {
  settings: SettingsModule<S>
  presets: Preset<S>[]
  start: Start<S, V, T>
}

/** Tints the document from a scene. The page owns document-level theming; the panel owns its own state. */
function applyTheme<S>(chrome: Chrome<S>, next: S): void {
  const root = document.documentElement
  const { style = {}, data = {} } = chrome.theme(next)
  for (const [name, value] of Object.entries(style)) root.style.setProperty(name, value)
  for (const [name, value] of Object.entries(data)) root.dataset[name] = value
}

/** Printed once on load. The console keeps it, so it waits until the panel is opened. */
function announce<S>(chrome: Chrome<S>): void {
  const width = Math.max(...chrome.banner.map(([call]) => call.length))
  const body = chrome.banner.map(([call, note]) => `  ${call.padEnd(width)}   ${note}`).join("\n")
  console.log(`%c${chrome.title}%c is scriptable from here.\n\n${body}\n`, "font-weight:600", "font-weight:400")
}

export function boot<S extends object, V extends Verbs, T>(piece: Piece<S, V, T>): PieceApi<S, V, T> {
  const { settings: module, presets, start } = piece
  const chrome = module.CHROME
  const canvas = requireElement(chrome.title, chrome.canvas, HTMLCanvasElement)
  const ui = requireElement(chrome.title, "ui", HTMLDivElement)

  // Read once and reused below. The escape hatches are pulled from the same
  // object rather than from `window.location.search`, because the landing
  // rewrite at the end of this function changes what that says.
  const params = new URLSearchParams(window.location.search)
  const { settings, featured } = settingsForLanding(module, presets, params)

  applyTheme(chrome, settings)

  const scene = start(canvas, settings)

  // Bound late: an action button is built before the handle it calls exists.
  let api: Record<string, unknown> = {}
  const call = (verb: string, arg?: number | boolean): unknown => {
    const method = api[verb]
    if (typeof method !== "function") throw new Error(`${chrome.slug}: no verb ${JSON.stringify(verb)}`)
    return (method as (arg?: number | boolean) => unknown)(arg)
  }

  const reconcile = module.reconcile as ((next: S, changed: string & keyof S) => S) | undefined

  const controls = createControls<S>({
    root: ui,
    // Headless on a touch device: the kit keeps the settings, the validator and
    // the URL sync, and draws no bar.
    chrome: !isReel(),
    aboutHref: `/experiments/${chrome.slug}/about/`,
    indexHref: "/experiments/",
    settings,
    controls: module.CONTROLS as Control<string & keyof S>[],
    groups: chrome.groups,
    ...(chrome.boxes ? { boxes: true, folds: chrome.slug } : {}),
    presets,
    actions: (chrome.actions ?? []).map(({ label, hint, shortcut, verb }) => ({
      label,
      hint,
      shortcut,
      run: () => {
        call(verb)
      },
    })),
    normalize: (next, changed) => module.normalizeSettings(reconcile && changed ? reconcile(next, changed) : next),
    url: (next) => module.urlForSettings(next, window.location.pathname),
    onChange: (next) => {
      applyTheme(chrome, next)
      scene.setSettings(next)
    },
  })

  // Left running deliberately, so hold the display on.
  const wakeLock = keepAwake()

  const { reroll } = module
  const handle = {
    // The chrome half — get, set, preset, presets, panel, pause, decode, idle,
    // url, fullscreen, awake — comes from the kit. See `@/experiments/kit/api`.
    ...createBaseApi({
      controls,
      wakeLock,
      scene,
      presets,
      normalize: module.normalizeSettings,
      fromQuery: module.settingsFromQuery,
    }),
    controls: () => reportControls(module.CONTROLS as Control<string & keyof S>[]),
    stats: () => scene.stats(),
    ...scene.verbs,
    // The bar button and the console call this one definition, so the two
    // cannot come to mean different things.
    ...(reroll
      ? {
          reroll: (seed?: number) => {
            controls.apply(module.normalizeSettings(reroll(controls.getSettings(), seed)))
            return (controls.getSettings() as { seed?: number }).seed
          },
        }
      : {}),
  } as PieceApi<S, V, T>
  api = handle as unknown as Record<string, unknown>
  window.experiment = handle
  announce(chrome)

  // Escape hatches for tools that cannot evaluate JS. None of them is a
  // setting, so none belongs in the shareable query string.
  if (params.get("panel") === "1") handle.panel(true)
  const idleParam = params.get("idle")
  if (idleParam !== null) handle.idle(idleParam !== "0")
  for (const [verb, kind] of Object.entries(chrome.hatches ?? {})) {
    const raw = params.get(verb)
    if (raw === null) continue
    if (kind === "flag") {
      if (raw === "1") call(verb, true)
    } else {
      const value = Number(raw)
      if (Number.isFinite(value) && value > 0) call(verb, value)
    }
  }

  // Last, so the escape hatches above are read from the address as opened. It
  // now describes the scene on screen, which means a link copied without
  // touching anything keeps working when the featured preset changes.
  if (featured) {
    window.history.replaceState(null, "", module.urlForSettings(settings, window.location.pathname))
  }

  return handle
}
