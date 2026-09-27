import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * **A piece is a library behind three files**, and this holds the shape.
 *
 * `settings.ts` says what parameters are allowed, `presets.ts` which points in
 * that space are named, and `runner.ts` how a point becomes pixels. The
 * gallery's boot wires any piece from those three, and the showcase reaches a
 * piece through `runner.ts` alone. See
 * `src/experiments/docs/adr/20260928-a-piece-is-a-library-behind-three-files.md`.
 *
 * Three rules, each one a way the shape has already been broken or would be
 * broken silently:
 *
 * - **Every piece has exactly the three**, and none of the files they replaced.
 *   A `page.ts` or an `api.ts` coming back is a second way into the piece.
 * - **Nothing outside a piece imports past them.** The page used to import a
 *   piece's constructor, console API, reroll and settings tables directly while
 *   the showcase went through `runner.ts`: two contracts, and no way for a
 *   change to say which consumers it touched.
 * - **`runner.ts` never reaches `presets.ts`**, however indirectly. A runner is
 *   frozen into a published bundle and draws no preset; curation churns, and
 *   a presets-only change should not be able to move a runner.
 *
 * Every piece is derived from the tree rather than listed, and each rule is
 * checked against cases the repo does not contain as well as the real tree,
 * because an import scan that matches nothing passes on every tree.
 */

const EXPERIMENTS = "src/experiments"
const NOT_A_PIECE = new Set(["docs", "gallery", "kit"])

const slugs = readdirSync(EXPERIMENTS)
  .filter((name) => !NOT_A_PIECE.has(name) && statSync(join(EXPERIMENTS, name)).isDirectory())
  .sort()

/**
 * The files a consumer outside a piece may import from it.
 *
 * The three, plus two hooks that are not the piece's contract with a visitor:
 * `Piece.astro` is what its two routes render, and `poster` is the recipe
 * `scripts/posters.ts` captures the index's still with, which never ships.
 */
const PUBLIC = new Set(["settings", "presets", "runner", "Piece.astro", "poster"])

/** What the three files replaced. Their return would be a second way in. */
const RETIRED = ["page.ts", "api.ts", "reroll.ts"]

/** Every source file under a root, recursively. */
function sources(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sources(path)
    return /\.(ts|mts|astro)$/.test(entry.name) ? [path] : []
  })
}

/**
 * Every module specifier a file names: static, side-effect and dynamic imports,
 * and re-exports — including a template literal, which is how a script reaches
 * whichever piece it was asked for. A path spelled into `src/experiments/` is
 * read as the alias would name it, with a `${…}` slug standing for any piece.
 */
export function specifiers(source: string): string[] {
  const found: string[] = []
  for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)(["'`])([^"'`]+)\1/g)) {
    const raw = match[2]!
    const spelled = /(?:^|\/)src\/experiments\/(.+)$/.exec(raw)
    found.push(spelled ? `@/experiments/${spelled[1]!.replace(/\.ts$/, "")}` : raw)
  }
  return found
}

/**
 * Where an import reaches past a piece's public files, if it does.
 *
 * `importer` is the importing file's path from the repo root. A file inside
 * the piece's own folder may import anything of it, which includes its tests
 * in `src/experiments/<slug>/tests/`.
 */
export function reachesPast(importer: string, specifier: string, pieces: readonly string[]): string | null {
  const match = /^@\/experiments\/([^/]+)\/(.+)$/.exec(specifier)
  if (!match) return null
  const [, slug, rest] = match
  // A slug written as `${…}` is any piece, so it is held to the same rule.
  if (!pieces.includes(slug!) && !slug!.startsWith("${")) return null
  if (importer.startsWith(`${EXPERIMENTS}/${slug}/`)) return null
  return PUBLIC.has(rest!) ? null : `${importer} imports ${specifier}`
}

/** The piece's own files `start` can reach from a file, following `@/experiments/<slug>/…` imports. */
export function closure(entry: string, read: (file: string) => string | null, slug: string): Set<string> {
  const seen = new Set<string>()
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    const source = read(file)
    if (source === null) continue
    for (const specifier of specifiers(source)) {
      const own = new RegExp(`^@/experiments/${slug}/(.+)$`).exec(specifier)
      if (own) queue.push(`${own[1]}.ts`)
    }
  }
  return seen
}

const readPiece = (slug: string) => (file: string) => {
  const path = join(EXPERIMENTS, slug, file)
  return existsSync(path) ? readFileSync(path, "utf8") : null
}

it("finds the pieces, so an empty run cannot pass for a clean one", () => {
  expect(slugs.length).toBeGreaterThan(1)
})

describe.each(slugs)("%s", (slug) => {
  it("is a library behind settings.ts, presets.ts and runner.ts", () => {
    for (const file of ["settings.ts", "presets.ts", "runner.ts"]) {
      expect(existsSync(join(EXPERIMENTS, slug, file)), `${slug} has no ${file}`).toBe(true)
    }
    const present = RETIRED.filter((file) => existsSync(join(EXPERIMENTS, slug, file)))
    expect(
      present,
      `${slug} carries ${present.join(", ")}. The gallery's boot supplies the page, the console handle and ` +
        `reroll from the three files — see gallery/boot.ts.`,
    ).toEqual([])
  })

  it("exports what the frame and the showcase call", async () => {
    const settings = (await import(`../../src/experiments/${slug}/settings.ts`)) as Record<string, unknown>
    const presets = (await import(`../../src/experiments/${slug}/presets.ts`)) as Record<string, unknown>
    const runner = (await import(`../../src/experiments/${slug}/runner.ts`)) as Record<string, unknown>

    expect((settings.CHROME as { slug?: string } | undefined)?.slug, `${slug}'s CHROME names another slug`).toBe(slug)
    for (const name of ["normalizeSettings", "settingsFromQuery", "namesASetting", "urlForSettings"]) {
      expect(typeof settings[name], `${slug}/settings.ts exports no ${name}`).toBe("function")
    }
    expect(Array.isArray(presets.PRESETS) && presets.PRESETS.length > 0, `${slug}/presets.ts has no PRESETS`).toBe(true)
    expect(typeof runner.start, `${slug}/runner.ts exports no start`).toBe("function")
    expect(typeof runner.mount, `${slug}/runner.ts exports no mount`).toBe("function")
  })

  it("never reaches presets.ts from runner.ts", () => {
    const reached = closure("runner.ts", readPiece(slug), slug)
    // Paired presence: the walk has to find settings.ts, or it is walking nothing.
    expect(reached.has("settings.ts"), `the walk from ${slug}/runner.ts did not reach settings.ts`).toBe(true)
    expect(
      reached.has("presets.ts"),
      `${slug}/runner.ts reaches presets.ts. A runner is frozen into a published bundle and draws no preset.`,
    ).toBe(false)
  })
})

it("imports nothing past a piece's three files from outside it", () => {
  // Not this file: its own cases below are imports the gate must catch.
  const importers = [...sources("src"), ...sources("scripts"), ...sources("tests")].filter(
    (file) => file !== "tests/unit/experiments-contract.test.ts",
  )
  const reaches = importers.flatMap((file) =>
    specifiers(readFileSync(file, "utf8"))
      .map((specifier) => reachesPast(file, specifier, slugs))
      .filter((reach): reach is string => reach !== null),
  )
  expect(
    reaches,
    `${reaches.slice(0, 5).join("; ")}. Outside a piece, reach it through settings, presets or runner.`,
  ).toEqual([])
})

/**
 * The gate itself, against cases the repo does not contain. Each one must be
 * caught, so a regex that stopped matching fails here rather than passing the
 * real tree by seeing nothing in it.
 */
describe("the gate", () => {
  it("reads every kind of import", () => {
    expect(
      specifiers(
        [
          `import { a } from "@/experiments/x/one"`,
          `import type { B } from '@/experiments/x/two'`,
          `import "@/experiments/x/three"`,
          `const m = await import("@/experiments/x/four")`,
          `export { c } from "@/experiments/x/five"`,
          "const r = await import(`../src/experiments/${slug}/six.ts`)",
        ].join("\n"),
      ),
    ).toEqual([
      "@/experiments/x/one",
      "@/experiments/x/two",
      "@/experiments/x/three",
      "@/experiments/x/four",
      "@/experiments/x/five",
      "@/experiments/${slug}/six",
    ])
  })

  it("fails a reach past the three files, and allows the three", () => {
    expect(reachesPast("src/experiments/gallery/boot.ts", "@/experiments/crowd/crowd", ["crowd"])).not.toBeNull()
    expect(reachesPast("tests/kit.spec.ts", "@/experiments/crowd/api", ["crowd"])).not.toBeNull()
    expect(reachesPast("src/showcase/wall.ts", "@/experiments/crowd/settings", ["crowd"])).toBeNull()
    expect(reachesPast("src/experiments/crowd/runner.ts", "@/experiments/crowd/crowd", ["crowd"])).toBeNull()
    expect(reachesPast("src/experiments/gallery/boot.ts", "@/experiments/kit/api", ["crowd"])).toBeNull()
    expect(reachesPast("scripts/x.ts", "@/experiments/${slug}/walkers", ["crowd"])).not.toBeNull()
  })

  it("follows a runner into presets however indirectly", () => {
    const files: Record<string, string> = {
      "runner.ts": `import { x } from "@/experiments/p/draw"`,
      "draw.ts": `import { y } from "@/experiments/p/settings"`,
      "settings.ts": `import { PRESETS } from "@/experiments/p/presets"`,
      "presets.ts": ``,
    }
    expect(closure("runner.ts", (file) => files[file] ?? null, "p").has("presets.ts")).toBe(true)
  })
})
