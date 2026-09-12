import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { previewState, reviewInProgress } from "./review-port.ts"

/**
 * Building the site, and serving it to the suite.
 *
 * ## Why a build rather than `astro dev`
 *
 * The suite used to drive Astro's dev server. It now drives `astro preview`
 * over a static build, because **the dev server is not the thing that ships**
 * and this repo has paid for the difference more than once:
 *
 * - A page referenced `/_astro/<hash>.jpg` that the build never wrote, and
 *   every gate said the site was fine. `astro dev` serves imports straight off
 *   disk, so the browser suite passed; the only symptom was a 404 in
 *   production, found by a person. `scripts/check-links.mts` carries that story.
 * - Astro builds its **content store at startup**, so a server left up across an
 *   `about.md` edit serves the old wall order — which silently changes the
 *   subject of every test that reads `wall(page)`.
 * - Editing `astro.config.mjs` re-optimises Vite's deps, and a server restarted
 *   across that edit answers `504 (Outdated Optimize Dep)` on the old hashes.
 *   Five failures in `showcase.spec.ts`, none of them about the code.
 * - The dev toolbar injects four extra `h1`s into every page.
 * - A fixed port let a run adopt *another worktree's* server and drive that
 *   branch, green and silent.
 *
 * None of those can happen to a directory of files. The build is the artefact
 * that deploys, so the suite now asserts against the artefact.
 *
 * Measured before the switch, on the same box with both servers up: the dev
 * server held **1311 MB** while serving the suite and the preview held
 * **179 MB**, and the run went 4.9 minutes to 2.8. 177 tests passed either way,
 * with no test changed. The cold build that buys it is under five seconds.
 *
 * ## Why the port is still discovered rather than chosen
 *
 * Unchanged, and for the reason `docs/adr/20260828-a-derived-port-per-worktree.md`
 * records: **Astro allows one background server per project and reports the
 * running one instead of starting a second**, so anything that picks a port and
 * then insists on it hangs whenever a server is already up. That is as true of
 * `astro preview` as it was of `astro dev` — verified, not assumed.
 *
 * The consequence worth stating, because it is the one people try to tidy away:
 * **the suite cannot have a port of its own.** One preview per worktree means
 * the review server on `REVIEW_PORT` and the suite's server are the same
 * process. So the suite names no port at all, lets Astro settle on one, and
 * reads `.astro/preview.json` to find out which. That file lives inside the
 * worktree and is therefore incapable of naming another branch's server, which
 * is the property the old fixed port lacked.
 *
 * The server is left running on purpose, as before. `pnpm exec astro preview stop`
 * ends it and `pnpm exec astro preview logs` reads it.
 */

const run = promisify(execFile)

const START_TIMEOUT_MS = 120_000

/**
 * Where the suite points, published as an environment variable rather than an
 * export.
 *
 * `playwright.config.ts` is evaluated before `globalSetup` runs, so a constant
 * exported from here could only ever hold a guess. Worker processes re-read the
 * config after this has run and inherit the environment, which is why
 * `use.baseURL` reads this variable. `scripts/posters.ts` calls
 * `startPreviewServer()` and then reads the return value directly.
 */
export const BASE_URL_ENV = "PW_BASE_URL"

export default async function startPreviewServer(): Promise<string> {
  await warnIfSomebodyIsWatching()
  await build()

  const adopted = await adoptable()
  if (adopted) return publish(adopted)

  // No `--` separator, and no `--port`. npm strips one before handing the
  // script its arguments and pnpm forwards it, so `pnpm run <script> -- --port`
  // reaches astro as a literal `--` and it rejects the command outright.
  await run("pnpm", ["exec", "astro", "preview", "--host", "--background"])

  const deadline = Date.now() + START_TIMEOUT_MS
  while (Date.now() < deadline) {
    const started = await adoptable()
    if (started) return publish(started)
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(
    `No preview server answered for this checkout within ${START_TIMEOUT_MS / 1000}s. ` +
      `Try \`pnpm exec astro preview logs\`, or \`pnpm exec astro preview stop\` and run again.`,
  )
}

/**
 * Say so when a build is about to replace what somebody is looking at.
 *
 * `astro build` **clears `dist/` before writing it**, so a run started while
 * Andrei has the review port open blanks his page for a couple of seconds and
 * then serves him a different build. He would be looking at something other
 * than what he thinks — the wrong-branch bug, arriving from the build side
 * rather than the port side.
 *
 * **A warning rather than a refusal, on purpose.** A guard that blocks would
 * teach people a way around it, and the way around a stale block is
 * indistinguishable from overriding a live one. Nothing here is unrecoverable:
 * the cost is a reload, and the person it affects is the one being told.
 */
async function warnIfSomebodyIsWatching(): Promise<void> {
  const url = await reviewInProgress()
  if (!url) return
  console.warn(
    `\n  A preview is serving this worktree on the review port (${url}).\n` +
      `  The build below clears dist/, so whoever is reviewing will see the page\n` +
      `  go blank and come back as this run's build. Nothing is broken; they\n` +
      `  will want to reload when the run finishes.\n`,
  )
}

/**
 * `runners` then `astro build`, which is `pnpm run build` without the two steps
 * that answer a different question.
 *
 * `astro check` and `check:links` belong to the `lint` job, which is the
 * required check and runs them on every pull request. Paying for them here
 * would add them to every local run of a suite that is not asking about types
 * or dangling URLs.
 *
 * **`runners` has to come first**, and not only for tidiness: a piece changed in
 * the same commit is otherwise served by a stale runner, and the page under test
 * is then not the page that was written.
 */
async function build(): Promise<void> {
  await run("pnpm", ["run", "build:quick"])
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
  const port = previewState()?.port
  if (typeof port !== "number") return null

  const baseUrl = `http://127.0.0.1:${port}`
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2_000) })
    return response.ok ? baseUrl : null
  } catch {
    return null
  }
}
