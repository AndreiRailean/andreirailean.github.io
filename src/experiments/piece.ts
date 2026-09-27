import type { BaseApi, ControlReport } from "@/experiments/kit/api"
import type { GovernedGroup } from "@/experiments/kit/controls"

/**
 * The contract between a piece and the frame it runs in: a shape, not a base
 * class, in the way `poster.ts` is.
 *
 * A piece is a library behind three files — `settings.ts`, `presets.ts` and
 * `runner.ts` — and the types here say what each one hands over. The frame is
 * `gallery/boot.ts`, which is given those three modules and wires any piece from
 * them. So nothing here knows what any setting means, apart from `seed` on a
 * piece that rerolls. See
 * `docs/adr/20260928-a-piece-is-a-library-behind-three-files.md`.
 */

/**
 * One of a piece's own verbs, as the console and the bar call it.
 *
 * Written as a method so a verb taking `(seconds: number)` and one taking
 * `(on?: boolean)` both satisfy it: method parameters are compared bivariantly,
 * and a property of function type is not.
 */
type VerbShape = { call(arg?: number | boolean): unknown }
export type Verb = VerbShape["call"]

/** A piece's verbs by name: `settle`, `run`, `clear`, `burst`, `debug`. */
export type Verbs = Record<string, Verb>

/**
 * What `start` hands the page: a live scene.
 *
 * `destroy` is teardown and `setPaused` is not, for the reasons
 * `src/experiments/AGENTS.md` gives under "`pause()` is not the scene's
 * `stop()`".
 */
export type Live<S, V extends Verbs = Verbs, T = unknown> = {
  setSettings: (settings: S) => void
  setPaused: (held: boolean) => void
  stats: () => T
  destroy: () => void
  verbs: V
}

/** `runner.ts`'s live export. The frozen export, `mount`, is the showcase's and is written in terms of this. */
export type Start<S, V extends Verbs = Verbs, T = unknown> = (canvas: HTMLCanvasElement, settings: S) => Live<S, V, T>

/** A bar button, naming the console verb it calls — `reroll` or one of the piece's own. */
export type ChromeAction = { label: string; hint: string; shortcut?: string; verb: string }

/**
 * A query parameter that reaches a verb, for tools that cannot evaluate JS.
 *
 * `seconds` calls the verb with the number when it is positive, as `?settle=60`
 * does. `flag` calls it with `true` when the value is `1`, as `?debug=1` does.
 */
export type Hatch = "seconds" | "flag"

/**
 * Everything the frame needs from a piece beyond its settings tables, as data.
 *
 * In `settings.ts` rather than `runner.ts` because every export of `runner.ts`
 * ships in a frozen runner, which draws none of this. Out of `settings.ts` it is
 * shaken off the way `CONTROLS` is, and
 * `tests/unit/experiments-runner-weight.test.ts` holds it to the same rule: no
 * call expression at module scope without a pure annotation.
 */
export type Chrome<S> = {
  /** The directory and route name. */
  slug: string
  /** As the piece is named in an error and in the console banner. */
  title: string
  /** The id of the piece's `<canvas>` in its `Piece.astro`. */
  canvas: string
  /**
   * Headings the panel files its rows under, in order. Omitted for a piece whose
   * rows read fine undivided. An entry may be a governed group, whose rows hide
   * while one of its controls holds its off value — `GovernedGroup` in the kit.
   */
  groups?: readonly (string | GovernedGroup<string & keyof S>)[]
  /**
   * How a scene tints the document: custom properties on `<html>`, and
   * `data-*` attributes beside them. Applied on landing and on every change,
   * so the chrome is tinted from the same number the picture is.
   */
  theme: (settings: S) => { style?: Record<string, string>; data?: Record<string, string> }
  actions?: ChromeAction[]
  /** A "copy link" button, labelled for what the piece shows. */
  copy?: { label: string; title: string }
  /** Query parameters that call a verb, in the order they are honoured. */
  hatches?: Record<string, Hatch>
  /** Printed once on load: each line a call and what it does. */
  banner: readonly (readonly [string, string])[]
}

/** What a piece that rerolls exports from `settings.ts`: a fresh arrangement, and nothing else changed. */
export type Reroll<S> = (settings: S, seed?: number) => S

/**
 * `settings.ts`, as the frame reads it.
 *
 * `reconcile` is optional because only pieces with a two-ended band need it:
 * it runs before the clamp, and only for the key actually moved, which is
 * what stops the bottom of a band being dragged past the top.
 */
export type SettingsModule<S extends object> = {
  CHROME: Chrome<S>
  // The piece's own control type, narrowed however it likes. The kit reads it
  // as its own `Control`, which every piece's is assignable to.
  CONTROLS: readonly object[]
  normalizeSettings: (patch: Partial<S>, base?: S) => S
  reconcile?: (next: S, changed: never) => S
  settingsFromQuery: (params: URLSearchParams) => S
  namesASetting: (params: URLSearchParams) => boolean
  urlForSettings: (settings: S, pathname: string) => string
  reroll?: Reroll<S>
}

export type Preset<S> = { label: string; hint: string; settings: S }

/**
 * `window.experiment` for a piece: the kit's chrome half, the controls report,
 * the piece's stats, and its verbs.
 *
 * A spec or a poster recipe names a piece's handle as
 * `ExperimentApi` from its `runner.ts`, which is this type applied, so the handle
 * is derived rather than written out a second time.
 */
export type PieceApi<S, V extends Verbs, T> = BaseApi<S> & {
  /** Every control the panel shows, in panel order, one entry per settings key. */
  controls: () => ControlReport[]
  stats: () => T
} & V

/** Added to `PieceApi` for a piece whose settings carry a `seed`. Returns the seed applied. */
export type Rerollable = { reroll: (seed?: number) => number }

/**
 * The scene a freshly opened address should show.
 *
 * **A bare address lands on the primary**, `presets[0]`, rather than on
 * `DEFAULT_SETTINGS`, and `featured` says the caller should rewrite the address
 * so a landing visitor leaves with a link to *this* scene rather than one
 * standing for "whatever is featured next month".
 */
export function settingsForLanding<S extends object>(
  settings: Pick<SettingsModule<S>, "namesASetting" | "settingsFromQuery" | "normalizeSettings">,
  presets: Preset<S>[],
  params: URLSearchParams,
): { settings: S; featured: boolean } {
  if (settings.namesASetting(params)) return { settings: settings.settingsFromQuery(params), featured: false }
  return { settings: settings.normalizeSettings(presets[0]!.settings), featured: true }
}
