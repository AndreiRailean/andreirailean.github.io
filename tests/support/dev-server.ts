import { execFile } from "node:child_process"
import { readFileSync } from "node:fs"
import { promisify } from "node:util"

/**
 * Starting, or adopting, the dev server the suite runs against.
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
 * ## Why the port is discovered rather than chosen
 *
 * It used to be a constant, 4355, picked to stay clear of the 4354 in
 * `astro.config.mjs` that a human's own server sits on. Two things were wrong
 * with that, and both bit:
 *
 * 1. **Worktrees share a machine.** A run here found 4355 already answering,
 *    skipped its own start, and spent the whole run driving a *different
 *    worktree's* branch — passing, because the pages it asked for existed there
 *    too. Nothing in the output said so. Posters captured in the same run were
 *    stills of the wrong code.
 * 2. **Astro allows one background server per project.** With one already up on
 *    another port, `astro dev --port <ours>` reports the running one and starts
 *    nothing, so the wait for "ours" times out after two minutes.
 *
 * Reading `.astro/dev.json` fixes both at once. It is Astro's own record of the
 * server it is running, it lives inside the worktree, and it is therefore
 * incapable of pointing at another branch. If a server is up — a human's
 * included — the suite uses it instead of fighting it for the daemon slot.
 *
 * The server is left running on purpose. Repeat runs then skip a cold start,
 * which for this repo means not recompiling an experiment's module on first
 * request. `npx astro dev stop` ends it and `npx astro dev logs` reads it.
 */

const run = promisify(execFile)

/** Astro's record of the dev server for *this* checkout. Gitignored. */
const DEV_STATE = ".astro/dev.json"

/**
 * The port to ask for when there is nothing to adopt.
 *
 * Not the 4354 in `astro.config.mjs`: if a human later starts one there, they
 * should get the daemon slot rather than a collision. Only ever a request —
 * what the suite actually talks to is whatever `.astro/dev.json` reports
 * afterwards.
 */
const PREFERRED_PORT = Number(process.env.PW_PORT ?? 4355)

const START_TIMEOUT_MS = 120_000

/**
 * Where the suite points, published as an environment variable rather than an
 * export.
 *
 * `playwright.config.ts` is evaluated before `globalSetup` runs, so a constant
 * exported from here could only ever hold a guess. Worker processes re-read the
 * config after this has run and inherit the environment, which is why
 * `use.baseURL` reads this variable. `scripts/posters.ts` calls
 * `startDevServer()` and then reads the return value directly.
 */
export const BASE_URL_ENV = "PW_BASE_URL"

export default async function startDevServer(): Promise<string> {
  const adopted = await adoptable()
  if (adopted) return publish(adopted)

  await run("npm", ["run", "dev", "--", "--port", String(PREFERRED_PORT), "--background"])

  const deadline = Date.now() + START_TIMEOUT_MS
  while (Date.now() < deadline) {
    const started = await adoptable()
    if (started) return publish(started)
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(
    `No dev server answered for this checkout within ${START_TIMEOUT_MS / 1000}s. ` +
      `Try \`npx astro dev logs\`, or \`npx astro dev stop\` and run again.`,
  )
}

function publish(baseUrl: string): string {
  process.env[BASE_URL_ENV] = baseUrl
  return baseUrl
}

/**
 * The running server's URL, or null.
 *
 * Both halves matter. The state file can name a server that has since died, and
 * a port can answer without being ours — so the file says *which* port to
 * believe, and the request proves something is listening on it.
 */
async function adoptable(): Promise<string | null> {
  let port: unknown
  try {
    port = JSON.parse(readFileSync(DEV_STATE, "utf8")).port
  } catch {
    // Missing, empty or half-written: `astro dev stop` empties it, and a start
    // in progress can be caught mid-write. Both mean "nothing to adopt yet".
    return null
  }
  if (typeof port !== "number") return null

  const baseUrl = `http://127.0.0.1:${port}`
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2_000) })
    return response.ok ? baseUrl : null
  } catch {
    return null
  }
}
