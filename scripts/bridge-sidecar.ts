import { appendFileSync, mkdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { dirname } from "node:path"
import { BRIDGE_LOG, BRIDGE_MARKER, BRIDGE_STATE } from "../src/experiments/gallery/bridge.ts"
import { previewState, reviewPort } from "../tests/support/review-port.ts"

/**
 * The preview bridge's session half: takes what a preview page posts and
 * appends it to `.astro/bridge.jsonl`. Started by `scripts/preview.ts`, never by
 * hand; read with `pnpm run bridge`. See `src/experiments/gallery/bridge.ts` and #305.
 *
 * **It lives exactly as long as the preview does, and nobody has to stop it.**
 * Every two seconds it asks whether `.astro/preview.json` names a live pid, and
 * once it has gone thirty seconds without one it removes its own state and
 * exits. So `astro preview stop`, `/wrap-up` and a session dying all end it
 * without knowing it exists — a second thing to remember to stop is a second
 * thing that gets left running. The thirty seconds cover the first build, which
 * runs before the preview it belongs to has started.
 *
 * **It binds where the preview binds** — every interface, because Andrei's
 * browser is on another machine — and takes only small JSON posts, which it
 * writes to a file and never executes or serves back.
 */

/** Clear of the review range (4400–4799) and still derived per worktree. */
const OFFSET = 1000
const ATTEMPTS = 10
const GRACE_MS = 30_000
const POLL_MS = 2_000
const MAX_BODY = 64 * 1024
const MAX_LOG = 20 * 1024 * 1024

function previewAlive(): boolean {
  const pid = previewState()?.pid
  if (typeof pid !== "number") return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function append(line: string): void {
  try {
    if (statSync(BRIDGE_LOG).size > MAX_LOG) renameSync(BRIDGE_LOG, `${BRIDGE_LOG}.1`)
  } catch {
    // No log yet.
  }
  appendFileSync(BRIDGE_LOG, line + "\n")
}

const server = createServer((request, response) => {
  // Read by the page only to see whether it worked, but without this header a
  // cross-origin fetch rejects and the page stops posting.
  response.setHeader("access-control-allow-origin", "*")
  if (request.method !== "POST" || request.url !== "/event") {
    response.writeHead(request.method === "OPTIONS" ? 204 : 404).end()
    return
  }
  let body = ""
  let tooBig = false
  request.setEncoding("utf8")
  request.on("data", (chunk: string) => {
    body += chunk
    if (body.length > MAX_BODY) {
      tooBig = true
      request.destroy()
    }
  })
  request.on("end", () => {
    if (tooBig) return
    try {
      const event: unknown = JSON.parse(body)
      if (typeof event !== "object" || event === null || (event as { marker?: unknown }).marker !== BRIDGE_MARKER) {
        response.writeHead(400).end()
        return
      }
      append(JSON.stringify(event))
      response.writeHead(204).end()
    } catch {
      response.writeHead(400).end()
    }
  })
})

function listen(port: number, left: number): void {
  server.once("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" && left > 1) listen(port + 1, left - 1)
    else throw error
  })
  server.listen(port, "0.0.0.0", () => {
    // A fresh worktree has no `.astro/` until its first build, and the sidecar
    // starts before that build — which is how the first run here died silently.
    mkdirSync(dirname(BRIDGE_STATE), { recursive: true })
    writeFileSync(BRIDGE_STATE, JSON.stringify({ pid: process.pid, port, startedAt: new Date().toISOString() }))
  })
}

function stop(): void {
  try {
    rmSync(BRIDGE_STATE, { force: true })
  } finally {
    process.exit(0)
  }
}

process.on("SIGTERM", stop)
process.on("SIGINT", stop)

let seen = Date.now()
setInterval(() => {
  if (previewAlive()) seen = Date.now()
  else if (Date.now() - seen > GRACE_MS) stop()
}, POLL_MS)

listen(reviewPort() + OFFSET, ATTEMPTS)
