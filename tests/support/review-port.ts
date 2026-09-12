/**
 * The review port, and the only thing that is allowed to ask for it.
 *
 * ## Two ports, deliberately not one
 *
 * A **stable** port is how a human keeps a bookmark: one per worktree, held
 * across rebuilds, restarts and sessions, so several pieces can be on screen at
 * once and "reload the page" means the same thing every time for each of them.
 *
 * Choosing a port is also the recorded way this repo's browser suite drove the
 * *wrong branch* for a whole run — green, silent, and with posters captured as
 * stills of code nobody had written. `docs/adr/20260828-a-derived-port-per-worktree.md`
 * is the record, and `tests/AGENTS.md` opens with "do not give it a fixed port,
 * and do not make it insist on one".
 *
 * Both are true because they are about different consumers. A human wants a
 * stable address and can see which branch is on screen. The suite wants no
 * address at all — it wants *this checkout's* server, whatever port that landed
 * on, which is what `.astro/preview.json` answers and a number never can.
 *
 * **So the suite must never reach for this constant**, and
 * `tests/unit/preview-ports.test.ts` fails if it starts to. The risk is not that
 * anyone argues for it; it is that the two ports look like duplication to
 * somebody tidying up, and collapsing them fails silently.
 *
 * ## The flag is a process, not a field
 *
 * A build clears `dist/` before writing it — verified, not assumed — so a build
 * in the worktree Andrei is reviewing wipes his page and then serves him a
 * different one. That is the wrong-branch bug arriving from the build side.
 *
 * The obvious guard is a "someone is reviewing" flag file, and it is the wrong
 * shape. **Dying is the case that matters**: a session that ends abruptly
 * cannot clear its own flag, and ending abruptly is how most sessions end. So
 * the default outcome of a declared flag is a corpse, every later build refuses
 * citing a reviewer who left hours ago, the remedy becomes "delete the flag",
 * and that reflex is indistinguishable from ignoring a live reviewer. A guard
 * everybody has learned to clear is worse than no guard, because it still reads
 * as protection. The same shape cost a session real time on a steward claim held
 * by a process that no longer existed.
 *
 * So nothing declares anything. **A preview actually serving on the review port
 * is the flag.** It cannot outlive what it asserts, because it *is* what it
 * asserts. This is the pattern `tests/AGENTS.md` already records for
 * `dev.json` — the file names a pid, and a file naming a dead pid is
 * self-evidently stale rather than a leak.
 *
 * The pid is checked *and* the port is asked to answer. `kill -0` is true for
 * any process that inherited the number, so the pid alone is "probably alive"
 * where a request is "actually serving".
 */

import { readFileSync } from "node:fs"

/**
 * The review port for *this* worktree, derived from its path.
 *
 * **Stable, and different in every checkout by construction.** That is both
 * halves of what a reviewer needs when several pieces are in flight at once: one
 * bookmark per branch that keeps working across rebuilds, restarts and sessions,
 * and no two worktrees fighting over a number.
 *
 * A single fixed port was the first design and it was wrong for exactly one
 * reason, which only came out when the requirement did: it gives one bookmark
 * *in total*, so a second worktree wanting to be on screen has to take the port
 * away from the first. Fine for reviewing one thing at a time; useless for
 * reviewing three.
 *
 * ## This is the scheme a rejected ADR describes, and it is safe here
 *
 * `docs/adr/20260828-a-derived-port-per-worktree.md` tried an FNV-1a hash of the
 * checkout path for the *browser suite* and it failed — not because the hash was
 * wrong ("the hash is not the problem", it says) but because the suite then
 * **insisted** on the port, and Astro reports the running server rather than
 * starting a second one, so the wait timed out. Its sibling failure was adopting
 * whatever answered on a fixed number, which is how a run drove another
 * worktree's branch.
 *
 * Neither reproduces here, and the difference is not subtle:
 *
 * - **Nothing insists.** `scripts/preview.ts` stops this worktree's own preview
 *   and then takes the slot, which costs under three seconds because a preview
 *   holds no compile cache. It never waits for a port to become free.
 * - **Nothing adopts a stranger.** The port is only ever *asked for*. What is
 *   believed afterwards is `.astro/preview.json`, which lives inside the
 *   worktree and cannot name another branch's server.
 * - **The suite still derives nothing** and asks for no port at all.
 *   `tests/unit/preview-ports.test.ts` fails if that changes.
 *
 * So a collision — two worktrees hashing to the same number, or something
 * unrelated holding it — costs a different port and a printed warning, never a
 * hang and never the wrong branch.
 */
export function reviewPort(cwd: string = process.cwd()): number {
  let hash = 0x811c9dc5 // FNV-1a
  for (const character of cwd) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return PORT_BASE + (hash % PORT_SPAN)
}

/**
 * The range review ports fall in.
 *
 * Kept clear of the 4321 Astro defaults to and the 4354 in `astro.config.mjs`,
 * and wide enough that a handful of worktrees are unlikely to collide — with
 * "unlikely" doing honest work, since collision is a warning rather than a
 * failure and pretending otherwise would be the mistake.
 */
const PORT_BASE = 4400
const PORT_SPAN = 400

/** Astro's own record of the preview server for *this* checkout. Gitignored. */
export const PREVIEW_STATE = ".astro/preview.json"

/** What Astro writes there. Only the fields anything here reads. */
type PreviewState = { pid?: unknown; port?: unknown }

/** The state file, or null when there is nothing to read. */
export function previewState(): PreviewState | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(PREVIEW_STATE, "utf8"))
    return typeof parsed === "object" && parsed !== null ? (parsed as PreviewState) : null
  } catch {
    // Missing, empty or half-written. `astro preview stop` empties it, and a
    // start in progress can be caught mid-write. All mean "nothing running".
    return null
  }
}

/** Whether a pid is a live process. True for an inherited number, hence the probe below. */
function alive(pid: unknown): boolean {
  if (typeof pid !== "number") return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Whether somebody is reviewing this worktree right now.
 *
 * Derived from three things that are all observable and none of which anybody
 * writes: the state file names a port, that port is the review port, and a
 * request to it is answered.
 *
 * Returns the URL so a caller can name it, because a warning that cannot say
 * *what* is on screen is one nobody can act on.
 */
export async function reviewInProgress(): Promise<string | null> {
  const state = previewState()
  const port = reviewPort()
  if (!state || state.port !== port || !alive(state.pid)) return null

  const url = `http://127.0.0.1:${port}`
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) })
    return response.ok ? url : null
  } catch {
    return null
  }
}
