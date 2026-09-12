import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { PREVIEW_STATE, previewState, reviewPort } from "../tests/support/review-port.ts"

/**
 * Putting something on screen for a person to look at.
 *
 * `pnpm run preview`. Builds the site, serves `dist/` on the review port, and
 * prints the address to hand over.
 *
 * ## Why this is not `astro dev`
 *
 * Andrei reviews a *state*, not a stream. He does not want to watch files change
 * under him, and a dev server spends 1.3 GB and a Vite module graph keeping a
 * page alive between edits that he is not watching. A static build is cheaper by
 * seven times, closer to what deploys, and — because it is the artefact rather
 * than a rehearsal of it — free of a whole family of review traps that cost real
 * time here: a stale content store reordering the wall, and a `_image?href=`
 * URL cached for a year that shows him the *old* poster after a recapture. Built
 * pages carry content-hashed `_astro/` names, so a recapture cannot fail to
 * reach him. `tests/support/preview-server.ts` has the full list.
 *
 * ## Reloading is enough
 *
 * A rebuild does not restart the server — `astro preview` reads `dist/` off disk
 * per request. So the loop is: build, tell him to reload, same URL. The port
 * holds for the life of the worktree rather than of a session.
 *
 * The one sharp edge, since HMR does not have it: `astro build` **clears
 * `dist/`** before writing it, so a reload landing mid-build shows a blank page
 * or a 404. That is what "previews happen only when you are not building" is
 * for. The browser suite warns when it is about to do this to a live reviewer.
 */

const run = promisify(execFile)

/**
 * Astro reports one preview server per project and starts nothing when one is
 * up, so taking the review port means giving it up first.
 *
 * Cheap in a way the dev server never was: a preview holds no compile cache, so
 * stopping and restarting costs under three seconds and loses nothing. That is
 * the whole reason this can insist on a port where
 * `docs/adr/20260828-a-derived-port-per-worktree.md` could not — it does not
 * fight for the daemon slot, it takes it.
 */
async function releaseTheSlot(): Promise<void> {
  try {
    await run("pnpm", ["exec", "astro", "preview", "stop"])
  } catch {
    // Not for the empty case — `astro preview stop` exits 0 and says "No preview
    // server is running", so the ordinary path never throws. This is for a stop
    // that genuinely fails, which must not stop us trying to start one.
  }
}

async function main(): Promise<void> {
  await run("pnpm", ["run", "build:quick"], { env: process.env })
  await releaseTheSlot()
  const wanted = reviewPort()
  await run("pnpm", ["exec", "astro", "preview", "--port", String(wanted), "--host", "--background"])

  // Astro falls through to the next free port when the one asked for is taken
  // by something it does not own, and records where it actually landed. So the
  // address is read back rather than assumed: a number that lies is worse than
  // a number that surprises.
  const state = previewState()
  const port = typeof state?.port === "number" ? state.port : null
  if (port === null) {
    throw new Error(`The preview server started but wrote no port to ${PREVIEW_STATE}.`)
  }

  if (port !== wanted) {
    console.warn(
      `\n  Port ${wanted} was taken by something this worktree does not own,\n` +
        `  so the preview landed on ${port}. The usual cause is another worktree\n` +
        `  holding the review port; \`git worktree list\` says which are live.\n`,
    )
  }

  // **Never loopback.** This runs on a VM and Andrei's browser is elsewhere, so
  // a localhost URL is one he cannot open. Astro records the network addresses
  // it bound; those are the only ones worth printing.
  const urls: unknown = (state as { urls?: { network?: unknown } } | null)?.urls?.network
  const network = Array.isArray(urls) ? urls.filter((url): url is string => typeof url === "string") : []

  console.log(`\n  Reviewable at:\n`)
  for (const url of network) console.log(`    ${url}`)
  if (network.length === 0) {
    console.log(`    (no network address bound — started without --host?)`)
  }
  console.log(`\n  Rebuild with \`pnpm run build:quick\` and reload; the URL does not change.`)
  console.log(`  Stop it with \`pnpm exec astro preview stop\` when the review is over.\n`)
}

await main()
