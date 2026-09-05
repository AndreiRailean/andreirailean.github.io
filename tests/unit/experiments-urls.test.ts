import { readdirSync, statSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * A shared address states the whole scene, in every piece.
 *
 * The query string is the unit of sharing here — a URL is how a scene is kept,
 * sent, or handed back to be saved as a preset. Four of the five pieces wrote it
 * as the **difference** from `DEFAULT_SETTINGS`, for a shorter link. That is the
 * same trap a preset spreading over the defaults is, one layer up: a link
 * resting on a default is a link whose scene changes the day the default does,
 * silently, in a bookmark belonging to somebody who is not watching.
 *
 * Psyxels had already made the change and written the reasoning into its own
 * `settingsToQuery`; nobody carried it across, which is exactly the shape of
 * hole this section keeps finding — a section-wide invariant implemented in one
 * piece is not duplication avoided, it is four pieces nobody checked.
 *
 * Starry Night is what it cost. Its primary holds its `DEFAULT_SETTINGS` values
 * exactly, so the difference was *empty*: the landing rewrite produced a bare
 * address, and a bare address is the one that means "whatever is featured". The
 * piece was skipped in `tests/kit.spec.ts` for it. #128.
 *
 * Written across every piece rather than in each piece's own file, because the
 * per-piece version of this is what already existed and did not hold.
 *
 * **`DEFAULT_SETTINGS` still has a job**, and it is the other direction:
 * filling an address that never named a setting at all. That address is an old
 * bookmark or a bare visit, and neither was ever promised a particular picture —
 * a bare visit gets the primary, via `settingsForLanding`.
 */

const EXPERIMENTS = "src/experiments"

/** Not pieces: shared code, and the section's own docs. */
const NOT_A_PIECE = new Set(["docs", "gallery", "kit"])

const slugs = readdirSync(EXPERIMENTS)
  .filter((name) => !NOT_A_PIECE.has(name) && statSync(`${EXPERIMENTS}/${name}`).isDirectory())
  .sort()

type Settings = Record<string, unknown>

/**
 * Loaded by relative path rather than through the `@/` alias.
 *
 * A dynamic import needs enough static shape for the bundler to find the
 * candidates, and a path with the slug as its only variable segment gives it
 * one. The `@/` alias form resolves for a literal import and not for this — the
 * same reason `tests/unit/experiments-presets.test.ts` does it this way.
 */
async function settingsModule(slug: string) {
  return (await import(`../../src/experiments/${slug}/settings.ts`)) as {
    DEFAULT_SETTINGS: Settings
    PRESETS: { label: string; settings: Settings }[]
    settingsToQuery: (settings: Settings) => URLSearchParams
    settingsFromQuery: (params: URLSearchParams) => Settings
    urlForSettings: (settings: Settings, pathname: string) => string
    settingsForLanding: (params: URLSearchParams) => { settings: Settings; featured: boolean }
  }
}

it("finds the experiments, so an empty run cannot pass for a clean one", () => {
  expect(slugs.length).toBeGreaterThan(0)
})

describe.each(slugs)("%s", (slug) => {
  it("names every setting in a shared address, including the ones on their default", async () => {
    const { DEFAULT_SETTINGS, settingsToQuery } = await settingsModule(slug)

    const named = [...settingsToQuery(DEFAULT_SETTINGS).keys()].sort()
    expect(
      named,
      `${slug}'s settingsToQuery leaves settings out of the address. Write every key, ` +
        `whatever its value: an address that omits a setting is an address that means ` +
        `"whatever the default is", and it silently changes scene the day that default ` +
        `moves. See #128.`,
    ).toEqual(Object.keys(DEFAULT_SETTINGS).sort())
  })

  /**
   * The landing address, which is the one nobody chose.
   *
   * A visitor arriving with no query gets the primary and the page rewrites the
   * address to it. That address has to name the scene, or promoting a preset
   * changes what an already-shared link shows — which is the whole reason the
   * rewrite exists.
   */
  it("rewrites a bare landing to an address that restores the same scene", async () => {
    const { settingsForLanding, settingsFromQuery, urlForSettings } = await settingsModule(slug)

    const landing = settingsForLanding(new URLSearchParams(""))
    expect(landing.featured, `${slug} does not treat a bare address as a landing`).toBe(true)

    const address = urlForSettings(landing.settings, `/experiments/${slug}/`)
    expect(address, `${slug}'s landing rewrite leaves the address bare`).toMatch(/\?.+=/)
    expect(
      settingsFromQuery(new URLSearchParams(address.split("?")[1])),
      `${slug}'s own landing address does not restore its own landing scene`,
    ).toEqual(landing.settings)
  })

  /**
   * The property the whole thing is for, stated as the failure it prevents.
   *
   * A moved default must not change what an address already written means. This
   * cannot be tested by moving `DEFAULT_SETTINGS`, which is a module constant —
   * so it is tested from the equivalent side: every preset's address parses back
   * to that preset with no help from the defaults at all, which is only possible
   * if the address named everything.
   */
  it("restores a scene from its address alone, with nothing left to the defaults", async () => {
    const { PRESETS, settingsToQuery, settingsFromQuery, normalizeSettings } = (await settingsModule(slug)) as Awaited<
      ReturnType<typeof settingsModule>
    > & { normalizeSettings: (patch: Partial<Settings>) => Settings }

    for (const preset of PRESETS) {
      const scene = normalizeSettings(preset.settings)
      const query = settingsToQuery(scene)
      expect(
        [...query.keys()].sort(),
        `${slug}'s "${preset.label}" writes an address that leaves settings out`,
      ).toEqual(Object.keys(scene).sort())
      expect(settingsFromQuery(query), `${slug}'s "${preset.label}" does not survive its own address`).toEqual(scene)
    }
  })
})
