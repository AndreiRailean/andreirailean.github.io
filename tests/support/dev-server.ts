import { execFile } from "node:child_process"
import { promisify } from "node:util"

/**
 * Starting the dev server the suite runs against.
 *
 * This is Playwright's `globalSetup` rather than its `webServer` because Astro 7
 * runs its dev server as a daemon: `astro dev` starts a background process and
 * returns, and it decides *for itself* whether to do that — daemonising when it
 * detects an agent environment and staying in the foreground for a human.
 * Playwright's `webServer` reads a command that returns as the server having
 * "exited early" and fails the run, so the harness would have worked for one of
 * us and not the other. Asking for the background server explicitly, and
 * waiting for the port ourselves, behaves the same either way.
 *
 * The server is left running on purpose. Repeat runs then skip a cold start,
 * which for this repo means not recompiling an experiment's module on first
 * request. `npx astro dev stop` ends it and `npx astro dev logs` reads it.
 */

const run = promisify(execFile)

/**
 * Its own port, not the 4354 in `astro.config.mjs`.
 *
 * Worktrees share a machine, so 4354 usually already has a human's dev server on
 * it, and reusing that would silently test another branch's code. A stale server
 * on *this* port from a concurrent run in another worktree is the same hazard,
 * so override it when that bites.
 */
export const PORT = Number(process.env.PW_PORT ?? 4355)
export const BASE_URL = `http://127.0.0.1:${PORT}`

const START_TIMEOUT_MS = 120_000

export default async function startDevServer(): Promise<void> {
  if (await responding()) return

  await run("npm", ["run", "dev", "--", "--port", String(PORT), "--background"])

  const deadline = Date.now() + START_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await responding()) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(
    `The dev server did not answer on ${BASE_URL} within ${START_TIMEOUT_MS / 1000}s. ` +
      `Try \`npx astro dev logs\`, or \`npx astro dev stop\` and run again.`,
  )
}

async function responding(): Promise<boolean> {
  try {
    const response = await fetch(BASE_URL, { signal: AbortSignal.timeout(2_000) })
    return response.ok
  } catch {
    return false
  }
}
