import { describe, expect, it } from "vitest"
import { SLUGS, slugsFrom } from "../../scripts/posters.ts"

/**
 * Which pieces `pnpm run posters` was asked for.
 *
 * The whole of the poster script needs a browser and a dev server, so none of
 * it is testable here — except this, which is a function and a list, and which
 * is the part that broke. #114: `pnpm run posters -- dangler` is the form the
 * section's instructions gave for two months, npm swallowed the `--` and pnpm
 * forwards it, so after the migration the first command anyone adding a piece
 * runs died with `No such experiment: --`.
 *
 * **Importing this module is itself the other half of the check.** The script
 * used to end in a bare top-level `await main()`, which would make this file
 * start a dev server, launch Chromium and overwrite every tracked
 * `poster.webp` — the exact thing `scripts/posters.ts` says `pnpm test` must
 * never do. If the guard is removed, this suite stops being a unit suite and
 * says so loudly.
 */
describe("slugsFrom", () => {
  it("takes a bare slug, which is the pnpm spelling", () => {
    expect(slugsFrom(["dangler"])).toEqual(["dangler"])
  })

  it("ignores the npm separator rather than reading it as a slug", () => {
    expect(slugsFrom(["--", "dangler"])).toEqual(["dangler"])
  })

  it("captures everything when nothing is named", () => {
    expect(slugsFrom([])).toEqual(SLUGS)
    // And a lone separator is still "nothing named", not an empty selection —
    // `pnpm run posters --` should capture the wall, not silently capture zero.
    expect(slugsFrom(["--"])).toEqual(SLUGS)
  })

  it("takes several", () => {
    expect(slugsFrom(["--", "dangler", "flotsam"])).toEqual(["dangler", "flotsam"])
  })

  /**
   * The guard the separator must not weaken. A typo has to fail *before* the
   * capture, because a run that starts is a run that rewrites tracked files.
   */
  it("refuses a slug it does not know, and names the ones it does", () => {
    expect(() => slugsFrom(["dangier"])).toThrow(/No such experiment: dangier/)
    expect(() => slugsFrom(["dangier"])).toThrow(/dangler/)
    expect(() => slugsFrom(["--", "dangier"])).toThrow(/No such experiment: dangier/)
  })

  it("lists every piece that has a poster recipe", () => {
    // Not a glob, deliberately — see the comment on SLUGS. So it can drift, and
    // this is what says so when a piece is added and its poster is forgotten.
    expect(SLUGS.length).toBeGreaterThan(0)
    expect([...SLUGS].sort()).toEqual([...new Set(SLUGS)].sort())
  })
})
