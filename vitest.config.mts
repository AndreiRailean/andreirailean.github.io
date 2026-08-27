import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

/**
 * The unit runner, for everything about a piece that can be checked without a
 * browser: the physics, the arrangement, the wind, the settings.
 *
 * Two runners, deliberately. Playwright drives a real page and is the only thing
 * that can reach `window.experiment` (see `playwright.config.ts`); this one
 * imports a module directly and answers in milliseconds, which is what makes it
 * usable mid-change — `npx vitest rope` while editing the solver.
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
