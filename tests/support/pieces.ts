import { existsSync, readdirSync } from "node:fs"
import { resolve } from "node:path"

/**
 * The section's pieces, found rather than listed: **a piece is a directory with
 * a `settings.ts`.** Every piece has settings and no shared directory does.
 *
 * Ten suites each kept a `NOT_A_PIECE` denylist of `docs`, `gallery` and `kit`
 * until 2026-10-18, which made the section's *next* shared directory a false
 * piece in all ten at once — exactly what adding `simulation/` would have done.
 * `experiments-seeds.test.ts` had already derived the set this way; this is that
 * rule, once.
 */
export const EXPERIMENTS = "src/experiments"

export const pieces: string[] = readdirSync(EXPERIMENTS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(resolve(EXPERIMENTS, entry.name, "settings.ts")))
  .map((entry) => entry.name)
  .sort()
