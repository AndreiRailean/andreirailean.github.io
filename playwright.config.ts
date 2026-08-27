import { existsSync } from "node:fs"
import { defineConfig } from "@playwright/test"
import { BASE_URL } from "./tests/support/dev-server"

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

/**
 * The machine's own Chromium in preference to Playwright's download.
 *
 * One is installed everywhere this repo gets worked on, and nothing the harness
 * does needs a patched build. Falling through to `undefined` is deliberate: on a
 * machine where `npm install` ran normally, Playwright's own browser is present
 * and its "run npx playwright install" message is better than anything invented
 * here.
 */
const CHROMIUM_CANDIDATES = [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]

function resolveChromium(): string | undefined {
  const override = process.env.CHROMIUM_PATH
  if (override) {
    if (!existsSync(override)) {
      throw new Error(`CHROMIUM_PATH is set to ${override}, which does not exist.`)
    }
    return override
  }
  return CHROMIUM_CANDIDATES.find((candidate) => existsSync(candidate))
}

export default defineConfig({
  testDir: "./tests",
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
    baseURL: BASE_URL,
    // Fixed, because the piece divides by depth: field of view and therefore
    // what is on screen at all follow the viewport's aspect ratio.
    viewport: { width: 1280, height: 900 },
    launchOptions: { executablePath: resolveChromium() },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium" }],
})
