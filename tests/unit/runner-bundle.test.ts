import { readdirSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { build, type BuildOptions } from "esbuild"
import { describe, expect, it } from "vitest"

/**
 * **A runner ships no panel, read off the bundle it actually builds — #243.**
 *
 * `experiments-runner-weight.test.ts` guards the same property from the source:
 * it reads `settings.ts` as text for the one call shape that pins `CONTROLS` in
 * a bundle. Psyxels passed it for weeks while its runner carried every label,
 * hint and option list, because something else in its initializer pinned the
 * declaration and the check knew one shape. A check on the source can only
 * list the ways it knows to fail; a check on the output does not need to.
 *
 * So this builds each runner with the options `scripts/runners.ts` uses and
 * looks for the controls' own hint text in it. `20260906-a-runner-sheds-the-panel.md`
 * measured the panel at about 30% of a bundle.
 *
 * **Paired with a presence check**, because "no hint found" passes as readily
 * for a matcher that cannot see a hint as for a clean bundle: the same matcher
 * must find the hints in a bundle built to contain `CONTROLS`.
 */

const EXPERIMENTS = resolve("src/experiments")
const NOT_A_PIECE = new Set(["docs", "gallery", "kit"])

const slugs = readdirSync(EXPERIMENTS)
  .filter((name) => !NOT_A_PIECE.has(name) && statSync(`${EXPERIMENTS}/${name}`).isDirectory())
  .sort()

/** `scripts/runners.ts`'s options, so this measures the artefact that is published. */
const OPTIONS: BuildOptions = {
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  alias: { "@": resolve("src") },
  write: false,
}

async function bundle(entry: { path: string } | { contents: string }): Promise<string> {
  const built = await build(
    "path" in entry
      ? { ...OPTIONS, entryPoints: [entry.path] }
      : { ...OPTIONS, stdin: { contents: entry.contents, resolveDir: EXPERIMENTS, loader: "ts" } },
  )
  return new TextDecoder().decode(built.outputFiles![0]!.contents)
}

/**
 * The longest run of plain ASCII in each hint, at least twenty characters.
 * esbuild escapes anything outside ASCII by default, so an em dash in the
 * source is `—` in the bundle and a whole hint would never match.
 */
function fingerprints(controls: readonly { hint?: string }[]): string[] {
  return controls.flatMap(({ hint }) => {
    const runs = (hint ?? "").match(/[ -~]{20,}/g) ?? []
    const longest = runs.sort((a, b) => b.length - a.length)[0]
    return longest ? [longest.replace(/[\\"`]/g, "").slice(0, 60)] : []
  })
}

it("finds the experiments, so an empty run cannot pass for a clean one", () => {
  expect(slugs.length).toBeGreaterThan(0)
})

describe.each(slugs)("%s", (slug) => {
  it("ships none of its control list in its runner", { timeout: 60_000 }, async () => {
    const { CONTROLS } = (await import(`../../src/experiments/${slug}/settings.ts`)) as {
      CONTROLS: { hint?: string }[]
    }
    const marks = fingerprints(CONTROLS).filter((mark) => !/[\\"`]/.test(mark))
    expect(marks.length, `${slug}'s controls have no hint text to look for`).toBeGreaterThan(0)

    // Presence: the matcher can see a hint when one is there.
    const withPanel = await bundle({
      contents: `export { CONTROLS } from "@/experiments/${slug}/settings"`,
    })
    const seen = marks.filter((mark) => withPanel.includes(mark))
    expect(seen.length, `${slug}: no hint is visible even in a bundle that exports CONTROLS`).toBeGreaterThan(0)

    // And the runner carries none of them.
    const runner = await bundle({ path: `${EXPERIMENTS}/${slug}/runner.ts` })
    const shipped = seen.filter((mark) => runner.includes(mark))
    expect(
      shipped,
      `${slug}'s runner ships ${shipped.length} of its ${seen.length} control hints, so the panel ` +
        `rides along in every showcase scene. Find what pins CONTROLS — see #243.`,
    ).toEqual([])
  })
})
