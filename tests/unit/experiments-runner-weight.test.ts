import { readFileSync, readdirSync, statSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * A runner must not carry the panel's prose it will never draw.
 *
 * A **runner** is a piece's drawing code frozen into a bundle, with no chrome,
 * no panel and no controls. It still pulled in the whole of `CONTROLS` —
 * labels, hints, `format` closures, option lists. On the one runner that exists
 * that was 4.3kb of 14.1kb, about 30%, and it only grows: `settings.ts` is where
 * per-piece metadata accumulates. #151.
 *
 * **Two separate things kept it, and removing either alone changed nothing.**
 * That was measured, not reasoned:
 *
 * 1. `BOUNDS` and `TRACKS` were *derived* from `CONTROLS` at module scope, so it
 *    was reachable from `normalizeSettings`, which every runner calls. They are
 *    written out as literals now, with
 *    `tests/unit/experiments-grid.test.ts` checking they still match.
 * 2. The `CONTROLS` initializer contains **call expressions** — `MODES.map(...)`
 *    building a choice row's options. esbuild cannot prove a call is
 *    side-effect-free, so it pins the whole declaration even when nothing
 *    references it. An unexported, unreferenced `CONTROLS` still shipped.
 *    `/* @__PURE__ *\/` is what tells it otherwise.
 *
 * Fixing only the derivation left the bundle at 14.4kb — *larger*, since the
 * literals are extra bytes and the prose stayed. Fixing only the annotation left
 * it at 14.1kb, unchanged. Together: 10.1kb.
 *
 * So this checks both, at the source, because the built bundle is gitignored and
 * a check that silently skips when it is absent is the failure mode this whole
 * area keeps hitting.
 */

const EXPERIMENTS = "src/experiments"
const NOT_A_PIECE = new Set(["docs", "gallery", "kit"])

const slugs = readdirSync(EXPERIMENTS)
  .filter((name) => !NOT_A_PIECE.has(name) && statSync(`${EXPERIMENTS}/${name}`).isDirectory())
  .sort()

const source = (slug: string) => readFileSync(`${EXPERIMENTS}/${slug}/settings.ts`, "utf8")

/**
 * The `CONTROLS = [ ... ]` initializer, by brace depth rather than by regex.
 *
 * **Anchored on the `=`, not on the first `[`.** The declaration is
 * `export const CONTROLS: Control[] = [`, so the first bracket belongs to the
 * *type annotation* — taking it gave a two-character initializer, no calls
 * inside it, and a check that passed no matter what. Found by removing a pure
 * annotation and watching this fail to notice.
 */
function controlsInitializer(text: string): string {
  const at = text.indexOf("export const CONTROLS")
  if (at < 0) return ""
  const assign = text.indexOf("=", at)
  const open = text.indexOf("[", assign)
  let depth = 0
  for (let i = open; i < text.length; i++) {
    if ("[{(".includes(text[i]!)) depth++
    else if ("]})".includes(text[i]!)) {
      depth--
      if (depth === 0) return text.slice(open, i + 1)
    }
  }
  return text.slice(open)
}

/** Code with comments and string literals removed, so prose cannot answer for it. */
const codeOnly = (text: string) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")

it("finds the experiments, so an empty run cannot pass for a clean one", () => {
  expect(slugs.length).toBeGreaterThan(0)
})

describe.each(slugs)("%s", (slug) => {
  it("does not derive the validator's tables from the control list", async () => {
    const text = codeOnly(source(slug))
    for (const table of ["TRACKS", "BOUNDS"]) {
      const at = text.indexOf(`const ${table}`)
      expect(at, `${slug} declares no ${table}`).toBeGreaterThan(-1)
      const declaration = text.slice(at, text.indexOf("\n}", at) + 2)
      expect(
        declaration.includes("CONTROLS"),
        `${slug}'s ${table} is derived from CONTROLS, which makes the whole control list — ` +
          `labels, hints, format closures — reachable from normalizeSettings and therefore from ` +
          `any runner. Write the numbers out; experiments-grid.test.ts checks they still match.`,
      ).toBe(false)
    }
  })

  it("marks every call in the control list as droppable", async () => {
    const initializer = controlsInitializer(source(slug))
    expect(initializer.length, `${slug} has no CONTROLS initializer to read`).toBeGreaterThan(0)

    // **A call that runs while the array is being built**, which is the only
    // kind that pins the declaration: a property whose value *is* a call, as in
    // `options: MODES.map(...)`.
    //
    // Not a call inside a closure. `format: (v) => v.toFixed(2)` never runs at
    // module scope and pins nothing — an earlier version of this matched those
    // too and failed every piece, which is the mirror of the vacuous version it
    // replaced. Both were found by breaking it rather than by reading it.
    const calls = [...initializer.matchAll(/(\w+)\s*:\s*([A-Za-z_$][\w$]*\s*\.\s*\w+)\s*\(/g)]
    const unmarked = calls
      .filter((match) => !initializer.slice(Math.max(0, match.index - 30), match.index).includes("__PURE__"))
      .map((match) => `${match[1]}: ${match[2].replace(/\s+/g, "")}()`)

    expect(
      unmarked,
      `${slug}'s CONTROLS initializer contains calls esbuild cannot prove pure (${unmarked.join(", ")}), ` +
        `so the whole control list ships in every runner even when nothing references it. Prefix ` +
        `each with a pure annotation, the way the choice rows already are.`,
    ).toEqual([])
  })
})
