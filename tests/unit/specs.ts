import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

/**
 * Every browser spec, as a path from the repo root: the shared ones in
 * `tests/`, and each piece's own in `src/experiments/<slug>/tests/`.
 *
 * **One list, because two checks read specs as text** — `browser-suite` and
 * `draw-time-stats` — and each used to `readdirSync("tests")`. When #238 moved
 * the piece specs next to their pieces, that listing would have kept passing
 * over the shared specs alone and stopped seeing every piece's, which is the
 * vacuous-check shape `AGENTS.md` lists first. It mirrors `testMatch` in
 * `playwright.config.ts`; `piecesAmong` below lets a caller assert it found some.
 */
export function browserSpecs(): string[] {
  const shared = readdirSync("tests")
    .filter((name) => name.endsWith(".spec.ts"))
    .map((name) => join("tests", name))
  const pieces = readdirSync("src/experiments", { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join("src/experiments", entry.name, "tests")))
    .flatMap((entry) =>
      readdirSync(join("src/experiments", entry.name, "tests"))
        .filter((name) => name.endsWith(".spec.ts"))
        .map((name) => join("src/experiments", entry.name, "tests", name)),
    )
  return [...shared, ...pieces].sort()
}

/** The ones that belong to a piece — a presence the callers pair with their own checks. */
export const piecesAmong = (specs: readonly string[]) => specs.filter((path) => path.startsWith("src/experiments/"))
