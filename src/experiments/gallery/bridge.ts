/**
 * The preview bridge: a page Andrei has open, talking to the session that built it.
 *
 * He reviews on another machine, so until this the only way anything on his
 * screen reached a session was a copied link or a screenshot — and #303 was
 * diagnosed off a photo of a green box. With a bridge, a preview page posts
 * what it is showing (the scene, the viewport) and, under `?trace=1`, the
 * events behind it, to a sidecar beside `astro preview` that appends them to
 * `.astro/bridge.jsonl`. `pnpm run bridge state` then answers "save what I have
 * on screen as preset X" without anybody copying anything. See #305.
 *
 * ## Never in what deploys, and not by remembering
 *
 * **Whether a page carries the client is derived, not declared**, the way the
 * review port's flag is (`tests/support/review-port.ts`): a build includes it
 * only while a sidecar is actually running for this worktree — `.astro/bridge.json`
 * names a pid and the pid is alive. CI and the deploy have no sidecar and so
 * never get one. `pnpm run build` sets `NO_BRIDGE` as well, so a full build in
 * a worktree with a preview up still produces exactly what deploys, and
 * `scripts/check-no-bridge.ts` fails that build if the marker below appears
 * anywhere in `dist/`. `tests/unit/preview-bridge.test.ts` tests that gate.
 *
 * Build-time only: this reads the filesystem, and is imported by
 * `PiecePage.astro`'s frontmatter, never by anything shipped to a browser.
 */

import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

/** Written by the sidecar when it starts, removed when it stops. Gitignored with the rest of `.astro/`. */
export const BRIDGE_STATE = ".astro/bridge.json"

/** Every event a preview page has posted, one JSON object a line. */
export const BRIDGE_LOG = ".astro/bridge.jsonl"

/** In the client's source, so a production build containing it can be found and refused. */
export const BRIDGE_MARKER = "andrei-md-preview-bridge"

/** Set by `pnpm run build`: what deploys never carries the client, sidecar or not. */
export const NO_BRIDGE_ENV = "NO_BRIDGE"

/** What the sidecar writes. */
export type BridgeState = { pid: number; port: number; startedAt: string }

/** The state file, or null when there is none or it cannot be read. */
export function bridgeState(path: string = BRIDGE_STATE): BridgeState | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
    if (typeof parsed !== "object" || parsed === null) return null
    const { pid, port, startedAt } = parsed as Record<string, unknown>
    if (typeof pid !== "number" || typeof port !== "number") return null
    return { pid, port, startedAt: typeof startedAt === "string" ? startedAt : "" }
  } catch {
    return null
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * The port a page built now should post to, or null for no client at all.
 *
 * A dead pid reads as no bridge, so a sidecar that died with its session
 * leaves nothing behind that a later build would honour.
 */
export function bridgePort(env: NodeJS.ProcessEnv = process.env, path: string = BRIDGE_STATE): number | null {
  if (env[NO_BRIDGE_ENV]) return null
  const state = bridgeState(path)
  return state && alive(state.pid) ? state.port : null
}

/**
 * Every file under `dir` whose text contains the bridge marker, as paths.
 *
 * What `scripts/check-no-bridge.ts` runs over `dist/` after a production build.
 * Reads every file rather than guessing at which kinds could hold a script —
 * a guess is the shape of check that goes on passing after the thing it
 * guarded moves somewhere it does not look.
 */
export function filesCarryingTheBridge(dir: string, marker: string = BRIDGE_MARKER): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...filesCarryingTheBridge(path, marker))
    else if (entry.isFile() && readFileSync(path).includes(marker)) found.push(path)
  }
  return found
}
