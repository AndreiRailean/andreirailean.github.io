import type { Controls, Preset } from "@/experiments/kit/controls"
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
 * `controls()` is **not** here on purpose. The pieces legitimately disagree
 * about its fields — Starry Night carries a `kind` discriminant, Psyxels zeroes
 * the bounds a choice row does not have, the other two carry `group` — and
 * `AGENTS.md` blesses that: extra fields are fine, and `key` is the part
 * everything else may rely on. Nor are `stats()`, `debug()` or a piece's own
 * verbs like `settle()` and `run()`.
 *
 * `tests/support/experiment.ts` declares the same list a third time, loosely
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
  /** Pin idle on or off — hiding the cursor and chrome. Omit to resume auto. */
  idle: (force?: boolean | null) => void
  /** The shareable URL for the current scene. */
  url: () => string
  /** Enter or leave fullscreen; omit to toggle. Resolves to whether it is on. */
  fullscreen: (on?: boolean) => Promise<boolean>
  /** Whether the screen is currently being held awake. */
  awake: () => boolean
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
}

export function createBaseApi<S>({ controls, wakeLock, scene, presets, normalize }: BaseApiOptions<S>): BaseApi<S> {
  // Held here rather than read back off the scene: whether a piece is paused is
  // a fact about how it is being looked at, not about what it is drawing.
  let paused = false

  return {
    get: () => controls.getSettings(),

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
