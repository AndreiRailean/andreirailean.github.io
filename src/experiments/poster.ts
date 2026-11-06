/**
 * The poster contract: how a piece says what it should look like on the index.
 *
 * Types only, and deliberately so. `AGENTS.md` says there is no shared
 * experiment layout, theme or component, and this is none of those — it is the
 * same kind of thing as `window.d.ts` beside it, a shape the capture script and
 * the pieces both have to agree on. The knowledge of *which* moment is worth
 * photographing stays in each experiment's own `poster.ts`, because that is
 * per-piece knowledge and ADR-0002 is about exactly this.
 *
 * `scripts/posters.ts` reads the recipes, and `gallery/plates.ts` reads them
 * again to draw the same moment live on the index.
 */

/**
 * The box a poster is captured in and a plate's canvas draws in: 38rem at
 * 16:9, the size a plate on the index sits at.
 *
 * The one value here rather than a type, because the capture and the index
 * have to agree on it and a second copy would drift. A piece sized in css px
 * (hexgrid's hexes, streakers' dots) composes differently in a different box,
 * so a plate drawing at another size would not be the poster's picture.
 */
export const PLATE = { width: 608, height: 342 } as const

/**
 * Everything the capture script needs from one experiment.
 *
 * Generic over the piece's own `ExperimentApi` so a recipe gets the real thing
 * in `prepare` — `api.settle()` should not typecheck for a piece that has no
 * solver to settle.
 */
export type PosterRecipe<Api> = {
  /**
   * A preset to load, by name. Preferred over hand-written settings: a preset
   * is already a look someone chose. It is not an arrangement: a preset that
   * names no `seed` rolls a fresh one each time it is applied, here and on the
   * index alike, so no capture is reproducible on that account.
   */
  preset?: string

  /**
   * Settings layered over `preset` (or the primary, when there is none), which
   * is the escape hatch for "that preset, but wound down for a thumbnail".
   *
   * Applied through the piece's own `set()` after the preset, and checked
   * against what `get()` reads back, so a key the piece does not know fails the
   * capture. They used to go in the query string, where both recipes using
   * them were silently dropped: streakers reads only the packed `s=` address,
   * and embers' preset was loaded after the address and replaced it (#341).
   */
  settings?: Record<string, number | string>

  /**
   * Bring the piece to the moment worth photographing, via its console API.
   *
   * Serialised and run inside the page, so nothing from the module's scope
   * comes with it — a closure over an import throws `ReferenceError` in the
   * browser. Everything it needs arrives through its one parameter.
   */
  prepare?: (handle: { api: Api }) => void | Promise<void>

  /**
   * Wall-clock milliseconds to let the piece run before the shutter.
   *
   * For a piece with no seed and no settling point, this is the only knob that
   * means "further along". Zero for anything that reaches its poster state
   * deterministically — dwelling then would only pick a different frame of the
   * same motion, at the cost of a slower capture.
   */
  dwellMs?: number

  /**
   * Shoot this many frames, `dwellMs` apart, and keep the liveliest.
   *
   * What a photographer does, and for the same reason. Starry Night's glimmers
   * are transient by design and spawn at well under one per second, so a single
   * shutter usually catches a sky with none of the flaring its own summary
   * promises. Nothing is wrong with that frame; it is just not the one worth
   * hanging.
   *
   * "Liveliest" is mean luminance, a proxy and an honest one for these pieces:
   * every one of them is light emitted onto a dark ground, so the brightest
   * frame is the one with the most alight in it. Leave it at 1 for a piece that
   * settles to a fixed state, where every frame is the same frame.
   */
  attempts?: number
}
