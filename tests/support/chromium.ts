import { existsSync } from "node:fs"

/**
 * Which Chromium the harness drives.
 *
 * Shared by `playwright.config.ts` and `scripts/posters.ts` so a poster is
 * captured in the same browser the suite asserts against. When they diverged
 * the posters were silently rendered by a different build from the one every
 * test had agreed the piece looks right in.
 *
 * The machine's own Chromium in preference to Playwright's download. One is
 * installed everywhere this repo gets worked on, and nothing the harness does
 * needs a patched build. Falling through to `undefined` is deliberate: on a
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

export function resolveChromium(): string | undefined {
  // CI wants a known build rather than whatever the runner ships, and some
  // runner images do have /usr/bin/chromium. Forcing the fallback makes the
  // browser one thing we are not guessing about when a check goes red.
  if (process.env.PW_USE_BUNDLED_CHROMIUM) return undefined

  const override = process.env.CHROMIUM_PATH
  if (override) {
    if (!existsSync(override)) {
      throw new Error(`CHROMIUM_PATH is set to ${override}, which does not exist.`)
    }
    return override
  }
  return CHROMIUM_CANDIDATES.find((candidate) => existsSync(candidate))
}
