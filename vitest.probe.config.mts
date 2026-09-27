import { mergeConfig } from "vitest/config"
import base from "./vitest.config.mts"

/**
 * **Probes: throwaway measurements, run the way the unit suite runs, kept out
 * of everything else — #240.** `pnpm run probe probes/<name>.test.ts`.
 *
 * Every session that measured something had to improvise this: copy a vitest
 * file into `tests/unit/` because that is where vitest looks, write results to
 * a file because vitest's default reporter swallows a passing test's
 * `console.log` (measured: only `--reporter=verbose` shows it), then delete it
 * — and one was committed by mistake with a `git add` of the folder.
 *
 * So a probe lives in `probes/`, which is gitignored, excluded from eslint, the
 * type checker and both suites, and has the section's `@/` alias. It prints what
 * it logs. A probe that turns out to be a check worth keeping is rewritten as
 * one in the piece's `tests/`, with a failure it has been seen to produce.
 */
export default mergeConfig(base, {
  test: {
    include: ["probes/**/*.test.ts"],
    reporters: ["verbose"],
    testTimeout: 600_000,
  },
})
