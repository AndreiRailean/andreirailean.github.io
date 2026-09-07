import { keysOf, type Control, type Controls, type Preset } from "@/experiments/kit/controls"
import { setFullscreen, toggleFullscreen } from "@/experiments/kit/fullscreen"
import type { WakeLock } from "@/experiments/kit/wakelock"

/**
 * The half of a piece's console API that is about the chrome rather than the work.
 *
 * `src/experiments/AGENTS.md` requires every piece to expose `window.experiment`
 * with a minimum surface, and says nothing about how — a shared contract with a
 * free implementation, which was right while there was one piece. By the fourth
 * there were four implementations of it and they were byte-identical: `get`,
 * `set`, `preset`, `presets`, `panel`, `pause`, `idle`, `url`, `fullscreen` and
 * `awake` differed between Dangler and Flotsam by nothing at all, and between
 * those two and Starry Night by one identifier — `sky.setPaused` for
 * `scene.setPaused`.
 *
 * That duplication had already cost something. #85 was a divergence inside this
 * exact region: three pieces reported `controls()` three different ways, nothing
 * said which was the contract, and generic code reading `.key` off a range
 * control got `undefined`, wrote its patch to a setting no piece has, and then
 * passed because nothing had moved. The section's own diagnosis of every kit
 * fault so far — "reached a second piece by being copied, and each was invisible
 * because nothing said a duplicate existed" — describes it precisely.
 *
 * **This is `kit/` and not the section level** on the ADR's discriminating test:
 * whether a piece could take it without taking the chrome. It could not. Every
 * line below is a call into the `Controls` handle `createControls` returns, or
 * into `fullscreen.ts` and `wakelock.ts` beside it. It travels with the chrome.
 * See `docs/adr/20260828-the-piece-is-independent-the-gallery-is-not.md`.
 *
 * **Offered, like the rest of the kit.** A piece composes this because the ten
 * methods are already learned; one that needs a different handle writes its own
 * and says so with a `kit-opt-out:` line. Nothing here reaches into what a piece
 * draws, and the kit still knows nothing about what any setting means — the
 * piece's validator and its presets come in as arguments.
 */

/**
 * What the base handle needs of a piece's scene, which is one method.
 *
 * `pause()` is deliberately not the scene's `stop()`. `stop()` is teardown — it
 * drops the resize listener, and in two pieces `start()` visibly moves the scene
 * on the way back. `setPaused` parks the animation frame and nothing else, and
 * picks the clock up from the moment it comes back. See `src/experiments/AGENTS.md`.
 */
export type Holdable = {
  setPaused: (held: boolean) => void
}

/**
 * The minimum surface, less the parts that are genuinely the piece's.
 *
 * `stats()`, `debug()` and a piece's own verbs like `settle()` and `run()` are
 * not here, and will not be: they differ because the pieces differ.
 *
 * **`controls()` is not a method on this handle either, and that is now a
 * narrower statement than it used to be.** It cannot be, because building the
 * report needs the piece's `CONTROLS` array and `createBaseApi` is given a
 * validator and a scene rather than a control list. But its *shape* and the
 * mapping that produces it are the kit's now — `ControlReport` and
 * `reportControls` below — so a piece's `controls()` is one call rather than a
 * switch of its own.
 *
 * This docblock used to say `controls()` was excluded because "the pieces
 * legitimately disagree about its fields", and listed the disagreement: Starry
 * Night carrying a `kind` discriminant, Psyxels zeroing the bounds a choice row
 * does not have, the other two carrying `group`. #130 took that list apart.
 * Walkers' and Starry Night's unions differed by one optional field, and the
 * three "flat" shapes were not a third design but the same type written three
 * times — the one that cannot tell the truth about a trackless control. None of
 * that was a disagreement worth protecting.
 *
 * `tests/support/experiment.ts` declares the base list a third time, loosely
 * typed, because a Playwright fixture cannot know a piece's `Settings`. That one
 * is a mirror for the harness; this one is the implementation.
 */
export type BaseApi<S> = {
  /** Current settings. */
  get: () => S
  /** Merge a partial change; returns what was actually applied after clamping. */
  set: (patch: Partial<S>) => S
  /** Load a preset by 1-based number or by name. */
  preset: (which: number | string) => S
  /** Preset names, in keyboard order. */
  presets: () => string[]
  /** Open or close the settings panel; omit to toggle. Returns the new state. */
  panel: (open?: boolean) => boolean
  /**
   * Hold the piece where it is, or let it run on. Omit to toggle; returns
   * whether it is now held.
   *
   * Part of the section's minimum surface since the interactive view arrived: a
   * tap on a phone holds the piece, and there is nothing else on the screen for
   * that to go through. See `Holdable` above for why this is not `stop()`.
   */
  pause: (held?: boolean) => boolean
  /** What scene an address describes. Defaults to the one in the address bar. */
  decode: (address?: string) => S
  /** Pin idle on or off — hiding the cursor and chrome. Omit to resume auto. */
  idle: (force?: boolean | null) => void
  /** The shareable URL for the current scene. */
  url: () => string
  /** Enter or leave fullscreen; omit to toggle. Resolves to whether it is on. */
  fullscreen: (on?: boolean) => Promise<boolean>
  /** Whether the screen is currently being held awake. */
  awake: () => boolean
}

/**
 * One entry per **settings key**, as every piece's `controls()` reports it.
 *
 * A discriminated union rather than a flat record, because **not every control
 * has a track and a flat shape forces one to invent a bound.** `slider` and
 * `range` carry `min`/`max`, `choice` and `set` carry their `options`, `toggle`
 * carries neither. A caller switches on `kind` before reading, and TypeScript
 * stops it doing anything else.
 *
 * `group` is optional: three pieces file their rows under headings and two do
 * not, which is a real difference and the only one left.
 *
 * ### Why this is the kit's, and why it took three faults to get here
 *
 * This report is a cross-piece contract — `tests/kit.spec.ts` holds all five
 * pieces to it — that lived nowhere. It existed as five hand-written shapes and
 * has now produced the same class of fault three times:
 *
 * - **#85**: three pieces reported three ways, nothing said which was the
 *   contract, and generic code reading `.key` off a range entry got `undefined`,
 *   wrote its patch to a setting no piece has, and passed because nothing moved.
 * - **#127**: two pieces had a `default:` branch reading `control.min` off a
 *   control with no `min`, so the field was present-and-`undefined` and every
 *   consumer's arithmetic came out `NaN`.
 * - **#130**: Psyxels' flat type requires `min` and `max`, so its `glyphs` set —
 *   a setting whose value is a *list of five names* — reported `min: 0, max: 0`.
 *   A valid number and a complete untruth, which is why no tightening of the
 *   `#127` assertion could reach it.
 *
 * It is `kit/` and not the section level on the ADR's discriminating test —
 * whether a piece could take it without taking the chrome. It could not: the
 * union is written in terms of the kit's own control kinds, so taking it means
 * taking the kit's control vocabulary. See
 * `docs/adr/20260828-the-piece-is-independent-the-gallery-is-not.md` and
 * `docs/adr/20260907-the-controls-report-is-the-kits.md`.
 */
export type ControlReport =
  | { kind: "slider" | "range"; key: string; label: string; hint: string; group?: string; min: number; max: number }
  | { kind: "choice" | "set"; key: string; label: string; hint: string; group?: string; options: string[] }
  | { kind: "toggle"; key: string; label: string; hint: string; group?: string }

/**
 * A piece's control list, as `controls()` should report it.
 *
 * **Flattened over `keysOf`**, so a range's two ends arrive as two entries. A
 * range owns two settings and carries `keys` rather than a `key`; a piece
 * mapping `control.key` straight through reports `undefined` for it, which is
 * #85 exactly.
 *
 * **The switch is exhaustive on purpose — there is no `default:` branch.** That
 * is the whole mechanical value of hoisting the mapping rather than only the
 * type. Every previous instance of this fault came out of a `default:` reading
 * `min` and `max` off whatever fell through it, and `tests/kit.spec.ts` had
 * already predicted the next one: "the day the kit gains a kind that has no
 * track, the default hands back `min: control.min` off a control with no `min`".
 * With one exhaustive switch here, that day is a compile error in this file
 * instead of five silent untruths in the pieces.
 *
 * **Offered, like the rest of the kit.** A piece that needs a different report
 * writes its own and says why in a `kit-opt-out:` line; `tests/kit.spec.ts`
 * still holds whatever it produces to `key` and to an honest bound.
 */
export function reportControls<K>(controls: readonly Control<K>[]): ControlReport[] {
  return controls.flatMap((control): ControlReport[] =>
    keysOf(control).map((key): ControlReport => {
      // `group` is spread in only when the piece has one, rather than written as
      // `group: control.group`. Present-and-`undefined` is the signature of #127
      // and it costs nothing to not reintroduce it one field over.
      const shared = {
        key: String(key),
        label: control.label,
        hint: control.hint,
        ...(control.group === undefined ? {} : { group: control.group }),
      }
      switch (control.kind) {
        case "slider":
        case "range":
          return { kind: control.kind, ...shared, min: control.min, max: control.max }
        case "choice":
        case "set":
          return { kind: control.kind, ...shared, options: control.options.map(({ value }) => value) }
        case "toggle":
          return { kind: "toggle", ...shared }
      }
    }),
  )
}

export type BaseApiOptions<S> = {
  controls: Controls<S>
  wakeLock: WakeLock
  scene: Holdable
  /** The piece's presets, in keyboard order. Named in errors, so order matters. */
  presets: Preset<S>[]
  /**
   * The piece's one validator, the same function `createControls` was given.
   *
   * Passed in rather than reached through the handle because `Controls.apply`
   * is the raw setter — it does not normalize, and every call site inside
   * `controls.ts` wraps it. An external caller that forgets is how the API
   * reaches a state a URL could not, which `AGENTS.md` rules out.
   */
  normalize: (patch: Partial<S>, base?: S) => S
  /**
   * The piece's query-string reader, for `decode`.
   *
   * Optional only because a piece could exist without one; every piece has one
   * today and should pass it. Without it, an address cannot be read back at all
   * from the console, which is the whole reason `decode` exists.
   */
  fromQuery?: (params: URLSearchParams) => S
}

export function createBaseApi<S>({
  controls,
  wakeLock,
  scene,
  presets,
  normalize,
  fromQuery,
}: BaseApiOptions<S>): BaseApi<S> {
  // Held here rather than read back off the scene: whether a piece is paused is
  // a fact about how it is being looked at, not about what it is drawing.
  let paused = false

  return {
    get: () => controls.getSettings(),

    /**
     * What scene an address describes, as a plain object.
     *
     * **This is where the readability went.** An address is a packed, opaque
     * string — `../docs/adr/20260906-an-address-is-packed-not-readable.md` — so
     * "what is this link" stopped being answerable by looking. Without a
     * decoder, the first confusing report costs an afternoon, which is the only
     * reason this is part of the base handle rather than a piece's own verb.
     *
     * Takes a whole URL, a query string, or the bare packed value, because all
     * three are things a person actually has in hand when they ask. Defaults to
     * the address currently in the bar.
     */
    decode(address) {
      if (!fromQuery) throw new Error("This piece was built without a query reader, so an address cannot be decoded.")
      const text = address ?? window.location.search
      const query = text.includes("?") ? text.slice(text.indexOf("?") + 1) : text
      // A bare packed value has no `=` in it; treat it as the value of `s`.
      return fromQuery(new URLSearchParams(query.includes("=") ? query : `s=${query}`))
    },

    set(patch) {
      const next = normalize(patch, controls.getSettings())
      controls.apply(next)
      return next
    },

    preset(which) {
      const found = typeof which === "number" ? presets[which - 1] : presets.find(({ label }) => label === which)
      if (!found) {
        throw new Error(`No such preset: ${JSON.stringify(which)}. Try ${presets.map((p) => p.label).join(", ")}.`)
      }
      const next = normalize(found.settings)
      controls.apply(next)
      return next
    },

    presets: () => presets.map(({ label }) => label),

    panel(open) {
      const next = open ?? !controls.isPanelOpen()
      controls.setPanelOpen(next)
      return next
    },

    pause(held) {
      paused = held ?? !paused
      scene.setPaused(paused)
      return paused
    },

    idle(force = null) {
      controls.setIdle(force)
    },

    url: () => window.location.href,

    fullscreen: (on) => (on === undefined ? toggleFullscreen() : setFullscreen(on)),

    awake: () => wakeLock.held(),
  }
}
