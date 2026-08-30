import { readdirSync, readFileSync, statSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * Whether every preset still carries a hue the presentation surfaces can use.
 *
 * **The first preset is the primary.** It is what the poster on the index is
 * captured from, what the about page runs behind its sheet, and what a visitor
 * gets when they open an experiment with no query string. Promoting a preset to
 * first is how all three change at once — which is the point of the arrangement,
 * and why nothing else should be reaching past it.
 *
 * `DEFAULT_SETTINGS` is **not** that, and the distinction is newer than some of
 * the pieces. It is the arbitrary set of values a piece starts from before a
 * human has touched it; there is no way to record a preset from the UI, so it is
 * a starting point rather than a scene anyone chose. Its role is diminishing and
 * it may be replaced by randomised controls. Reading presentation off it works
 * only while it happens to equal the primary, which is exactly the kind of
 * agreement that holds until it silently does not — dangler's did, for four
 * days, and the note has worn the wrong colour since.
 *
 * So this asserts the one thing the presentation surfaces actually depend on:
 * **a primary exists, and every preset has a usable hue.** That is what the
 * about page, the poster and the index placard read to tint themselves. It holds
 * today across every piece and every preset; the point of the check is that it
 * keeps holding as pieces are added, because the alternative is deriving a hue
 * from some other control and nobody has had to decide what that would mean yet.
 *
 * Deliberately *not* asserted here: that a piece's note accent matches any of
 * this. Starry-night's furniture is pitched 22° cooler than its sky on purpose,
 * and a check that called a considered palette choice a defect would be a bad
 * check. What a piece looks like stays the piece's.
 */

const EXPERIMENTS = "src/experiments"

/** Not pieces: shared code, and the section's own docs. */
const NOT_A_PIECE = new Set(["docs", "gallery", "kit"])

const OPT_OUT = "kit-opt-out:"

const slugs = readdirSync(EXPERIMENTS)
  .filter((name) => !NOT_A_PIECE.has(name) && statSync(`${EXPERIMENTS}/${name}`).isDirectory())
  .sort()

type Preset = { label: string; settings: Record<string, unknown> }

/**
 * Loaded by relative path rather than through the `@/` alias.
 *
 * A dynamic import needs enough static shape for the bundler to find the
 * candidates, and a path with the slug as its only variable segment gives it
 * one. The `@/` alias form resolves for a literal import and not for this.
 */
async function settingsModule(slug: string) {
  return (await import(`../../src/experiments/${slug}/settings.ts`)) as {
    PRESETS?: Preset[]
  }
}

it("finds the experiments, so an empty run cannot pass for a clean one", () => {
  expect(slugs.length).toBeGreaterThan(0)
})

describe.each(slugs)("%s", (slug) => {
  const source = readFileSync(`${EXPERIMENTS}/${slug}/settings.ts`, "utf8")
  const optedOut = source.includes(OPT_OUT)

  it("has a primary, which is the first preset", async () => {
    if (optedOut) return
    const { PRESETS } = await settingsModule(slug)
    expect(
      PRESETS,
      `${slug}/settings.ts exports no PRESETS. The first one is the primary — the poster, ` +
        `the about page's backdrop and a bare visit all come from it.`,
    ).toBeDefined()
    expect(
      PRESETS!.length,
      `${slug} has no presets, so there is nothing for the index poster or the note to render.`,
    ).toBeGreaterThan(0)
  })

  it("gives every preset a usable hue", async () => {
    if (optedOut) return
    const { PRESETS } = await settingsModule(slug)

    const bad = (PRESETS ?? [])
      .map((preset, index) => ({ index, label: preset.label, hue: preset.settings.hue }))
      .filter(({ hue }) => typeof hue !== "number" || !Number.isFinite(hue) || hue < 0 || hue >= 360)

    expect(
      bad,
      `${bad.map((b) => `${slug} preset ${b.index} (${b.label}) has hue ${String(b.hue)}`).join("; ")}. ` +
        `The about page, the poster and the index placard tint themselves from a preset's hue, ` +
        `so every preset needs one in [0, 360). If this piece genuinely has no hue control, ` +
        `that is the point at which the section has to decide how to derive one from its other ` +
        `settings — raise it rather than working around it, or say why not with a ` +
        `"${OPT_OUT} <reason>" comment in settings.ts.`,
    ).toEqual([])
  })
})
