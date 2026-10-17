/**
 * The settings plumbing every piece's `settings.ts` wrote out for itself.
 *
 * **Hoisted at the twelfth copy**, well past the third the section waits for —
 * ADR-0002 as narrowed by
 * `docs/adr/20260828-the-piece-is-independent-the-gallery-is-not.md`. It sat
 * that long because every copy was a *non-exported* helper or a function whose
 * body nobody compared, which is the blind spot `tests/unit/kit-adoption.test.ts`
 * names: the check reads what a piece exports, and `snap` and `clamp` were
 * never exported.
 *
 * Section level rather than `kit/`, on the layers ADR's test: a piece could
 * take this without taking the chrome. It is pure and needs no browser.
 *
 * **What is here is the part with no opinion in it.** Clamping, snapping onto
 * a track's grid, reading and writing the packed address, rerolling a seed.
 * What is **not** here is each piece's `normalizeSettings`, which is a list of
 * that piece's own rules — which keys are whole, which two ends of a band may
 * not cross — and its legacy named-parameter reader, which knows that piece's
 * history. Those stay with the piece and are handed in.
 *
 * Every variant the copies had is an option rather than a fork, and each one
 * keeps its piece's exact output: `tests/unit/__snapshots__/experiments-address.test.ts.snap`
 * and `experiments-urls.test.ts` pin every piece's codec.
 */

import { decodeScene, encodeScene, type Scene, type Slot } from "@/experiments/address"
import { gridAt, snapToGrid, type Track } from "@/experiments/kit/controls"

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** `value` if it is one of `options`, else `fallback` — how a piece reads an enum it was handed. */
export const oneOf = <T extends string>(options: readonly T[], value: unknown, fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback

/**
 * `gridFor` and `snap` over a piece's tracks.
 *
 * `finer` is the per-key grid finer than a slider's step that some pieces
 * keep, and `untracked` says what happens to a key with no track at all —
 * `seed` has none. Four pieces rounded it and eight left it alone; both are
 * kept rather than reconciled, because which one a piece chose is visible in
 * its addresses.
 */
export function onTracks<K extends string>(
  tracks: Partial<Record<K, Track>>,
  options: { finer?: Partial<Record<K, number>>; untracked: "keep" | "round" },
): { gridFor: (key: K, value: number) => number; snap: (key: K, value: number) => number } {
  const { finer, untracked } = options
  return {
    /**
     * The spacing one setting is stored on, or 0 for a key with no track.
     *
     * A piece exports it because a check that a value is on its grid has to read
     * the grid from the piece rather than re-derive it — re-deriving is how a test
     * ends up asserting its own copy of the rule.
     */
    gridFor(key, value) {
      const track = tracks[key]
      return track ? gridAt(track, value, finer?.[key]) : 0
    },
    snap(key, value) {
      const track = tracks[key]
      if (track) return snapToGrid(track, value, finer?.[key])
      return untracked === "round" ? Math.round(value) : value
    },
  }
}

/**
 * The four functions that carry a scene in and out of a URL, over one registry.
 *
 * The packed parameter `s` wins when it is there and readable. Without one, a
 * piece with a `legacy` reader falls through to it — which is why every link
 * written before the packed form still restores its own scene, and why a
 * corrupt `s` degrades to the defaults rather than throwing in a page's first
 * statement. A piece younger than the packed form has no legacy and lands on
 * `normalize({})`.
 *
 * `upgrade` maps a decoded scene before it is normalised, for a piece whose
 * slots retired into a different setting rather than the same one.
 */
export function packedAddress<S extends object>(options: {
  registry: readonly Slot[]
  normalize: (patch: Partial<S>) => S
  upgrade?: (scene: Partial<S>) => Partial<S>
  legacy?: {
    /** Reads the named-parameter form, which is still read forever and no longer written. */
    read: (params: URLSearchParams) => S
    /** Whether the named-parameter form names anything — the same rule `read` applies. */
    names: (params: URLSearchParams) => boolean
  }
}): {
  settingsToQuery: (settings: S) => URLSearchParams
  urlForSettings: (settings: S, pathname: string) => string
  settingsFromQuery: (params: URLSearchParams) => S
  namesASetting: (params: URLSearchParams) => boolean
} {
  const { registry, normalize, upgrade, legacy } = options
  const decode = (params: URLSearchParams): Scene | null => {
    const packed = params.get("s")
    return packed ? decodeScene(registry, packed) : null
  }

  /**
   * Opaque on purpose — `docs/adr/20260906-an-address-is-packed-not-readable.md`.
   * `experiment.decode()` expands an address back to a plain object, which is
   * where readability went.
   */
  function settingsToQuery(settings: S): URLSearchParams {
    const params = new URLSearchParams()
    params.set("s", encodeScene(registry, settings as Scene))
    return params
  }

  return {
    settingsToQuery,
    /**
     * One definition with two callers — the chrome, which rewrites the URL on
     * every change, and the page, which rewrites it once on landing.
     */
    urlForSettings: (settings, pathname) => `${pathname}?${settingsToQuery(settings).toString()}`,
    settingsFromQuery(params) {
      const scene = decode(params) as Partial<S> | null
      if (scene) return normalize(upgrade ? upgrade(scene) : scene)
      return legacy ? legacy.read(params) : normalize({})
    },
    /**
     * Whether a query string names any setting at all. The packed form names
     * the whole scene by definition, so it settles this before any legacy test.
     */
    namesASetting: (params) => decode(params) !== null || (legacy?.names(params) ?? false),
  }
}

/**
 * Whether a query string carries a usable number for any of `bounds`' keys.
 *
 * Absent, blank and unparseable are all "not a setting", which is the rule a
 * named-parameter reader applies: an absent param is `null` and `Number(null)`
 * is 0, a legal value for most settings, so a bare `Number()` would silently
 * zero them.
 */
export function namesANumber(params: URLSearchParams, bounds: object): boolean {
  return Object.keys(bounds).some((key) => {
    const raw = params.get(key)
    return raw !== null && raw.trim() !== "" && Number.isFinite(Number(raw))
  })
}

/**
 * A piece's `reroll`: a fresh seed drawn uniformly over `0..max`, or the one
 * given.
 *
 * Pure, and the piece's to configure rather than the frame's, because which
 * values a seed may take is the piece's to say. `experiment.reroll()` and the
 * bar button both reach it through `gallery/boot.ts`.
 */
export function reroller<S extends { seed: number }>(
  normalize: (patch: Partial<S>) => S,
  seeds: { max: number },
): (settings: S, seed?: number) => S {
  return (settings, seed) => normalize({ ...settings, seed: seed ?? Math.floor(Math.random() * (seeds.max + 1)) })
}
