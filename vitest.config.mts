import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

/**
 * The unit runner, for everything about a piece that can be checked without a
 * browser: the physics, the arrangement, the wind, the settings.
 *
 * Two runners, deliberately. Playwright drives a real page and is the only thing
 * that can reach `window.experiment` (see `playwright.config.ts`); this one
 * imports a module directly and answers in milliseconds, which is what makes it
 * usable mid-change — `pnpm exec vitest rope` while editing the solver.
 *
 * `.mts` because this file uses `import.meta.url` and the project is CommonJS
 * by default; Vite's native config loader warns otherwise.
 *
 * The split is by *what a check needs*, not by how fast it is. If it needs a
 * canvas, a layout or the console API it belongs in `tests/*.spec.ts`. If it is a
 * function and a number, it belongs here.
 */
export default defineConfig({
  test: {
    // `.test.ts` here, `.spec.ts` for Playwright. The two runners would
    // otherwise collect each other's files and fail on the other's imports.
    include: ["tests/unit/**/*.test.ts"],
    // Nothing here touches a DOM. A piece's own modules are written for a
    // browser but the ones under test take numbers and return numbers.
    environment: "node",
    /**
     * Sized for the statistical checks, rather than left on vitest's 5s default.
     *
     * Most of this suite answers in single-digit milliseconds, which is the
     * point of it. A handful do not: a claim about how long a psyx *lives*
     * needs samples, so `tests/unit/psyxels/field.test.ts` steps a fully-inked
     * mask for hundreds of updates and its slowest test took **4865ms** on an
     * idle machine — 135ms inside the default. It duly failed in a full run
     * with prettier and eslint just before it, and a vitest timeout is reported
     * as an ordinary test failure, so it read as flakiness rather than as a
     * limit. #122.
     *
     * The result cannot vary with load — every clock in those tests is
     * simulated, the seeds are stated, and there is no `Math.random` anywhere
     * beneath them — so this only ever decides whether a test is allowed to
     * finish, never what it concludes. Retries would have hidden the difference;
     * see #119 for why this repo does not take them.
     *
     * Raise this rather than trimming a sample count, which would weaken the
     * claim the samples are for.
     */
    testTimeout: 30_000,
  },
  resolve: {
    // The same `@/` the bundler resolves, so a test imports a module by the path
    // the piece itself uses. This is what the old `checks.ts` needed a `mktemp`
    // and `sed` dance to fake.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
})
