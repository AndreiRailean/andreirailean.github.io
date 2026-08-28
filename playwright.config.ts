import { defineConfig } from "@playwright/test"
import { resolveChromium } from "./tests/support/chromium"
import { BASE_URL_ENV } from "./tests/support/dev-server"

/**
 * Playwright is here to *drive* the experiments, not to diff their pixels.
 *
 * Almost every bug listed in `src/experiments/dangler/AGENTS.md` was invisible
 * in a screenshot — a wrong wire and a right one both look like a scatter of
 * dots. So assertions go on `experiment.stats()` and on the console API, and
 * stills are written to `.scratch/shots/` as evidence for a human to look at
 * with nothing comparing them. A pixel baseline over an additively blended,
 * GPU-less canvas would fail for reasons nobody can read, and we would learn to
 * ignore it.
 *
 * What this replaces: a hand-rolled CDP harness per task (launch chromium with
 * `--remote-debugging-port=0`, read `DevToolsActivePort`, `Runtime.evaluate`).
 * `webcheck` is still the right tool for sweeping the whole site for console
 * errors; it cannot evaluate JS, which is the only reason this exists.
 */

export default defineConfig({
  testDir: "./tests",
  // `.spec.ts` only: `tests/unit/` is vitest's, and Playwright's default
  // `testMatch` would otherwise collect those too.
  testMatch: "**/*.spec.ts",
  // Traces and failure stills are scratch, never source. `.scratch/` is already
  // gitignored for exactly this.
  outputDir: ".scratch/playwright",
  reporter: [["list"]],
  // The scene is seeded and the wind is derived from the clock and the seed
  // rather than accumulated, so a failure here is a real difference and not
  // weather. A retry would only hide it.
  retries: 0,
  // Settling a large scene is the slow part, and a cold Astro dev server
  // compiles the experiment on first request.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Astro 7 runs its dev server as a daemon, which Playwright's `webServer`
  // cannot supervise. See tests/support/dev-server.ts.
  globalSetup: "./tests/support/dev-server.ts",
  use: {
    // Set by `globalSetup`, which is the only thing that knows the port — see
    // tests/support/dev-server.ts. Workers re-read this config after it has run
    // and inherit the environment, so by the time a test navigates it is here.
    baseURL: process.env[BASE_URL_ENV],
    // Fixed, because the piece divides by depth: field of view and therefore
    // what is on screen at all follow the viewport's aspect ratio.
    viewport: { width: 1280, height: 900 },
    launchOptions: { executablePath: resolveChromium() },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium" }],
})
