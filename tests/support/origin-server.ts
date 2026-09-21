import { createServer, type Server } from "node:http"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

/**
 * Two throwaway origins, so the embed can be tested the way it is actually used.
 *
 * **Everything else in this suite runs same-origin, and same-origin hides three
 * separate requirements at once** — the module script tag that loads
 * `embed.js`, the dynamic `import()` of the runner, and any fetch either of
 * them makes all need CORS once they cross a host boundary, and none of them
 * needs it here. `gallery/embed.ts` exists so a page *we do not control* can
 * run a piece, and until this file nothing exercised that boundary. The gap and
 * the technique are #186; the technique came from a deleted prototype.
 *
 * So there are two servers:
 *
 * - **`host`** stands in for somebody else's site. It serves one page, whatever
 *   the test sets, and nothing else.
 * - **`assets`** stands in for ours, and serves `dist/showcase/` twice over:
 *
 *   | mount      | headers                          | stands for                      |
 *   | ---------- | -------------------------------- | ------------------------------- |
 *   | `/cors/`   | `access-control-allow-origin: *` | how it really ships — GitHub    |
 *   |            |                                  | Pages sends this on every asset |
 *   | `/nocors/` | none                             | a host that forgets             |
 *
 * **Two mounts rather than a flag, so the difference is visible rather than
 * asserted.** The same bytes are served both ways in one run, which is the only
 * arrangement where "CORS is what made the difference" is a fact about the run
 * rather than a claim about the code.
 *
 * ## Ports
 *
 * **Both listen on 0 and report what they got.** `tests/AGENTS.md` is emphatic
 * that the suite must not name a port or insist on one, and the reasons are
 * recorded failures — a fixed port let a run adopt another worktree's server.
 * These are in-process and short-lived rather than daemons: the test that
 * starts them closes them, and nothing outside the test can find or adopt them.
 *
 * They serve `dist/`, which `globalSetup` has already built by the time any
 * test runs, so they add no build and no compile.
 */

/** What a started pair offers. Origins are full `http://127.0.0.1:<port>` strings. */
export type Origins = {
  /** Somebody else's site. `setPage` decides what it returns. */
  host: string
  /** Ours. Serves `dist/showcase/` under `/cors/` and `/nocors/`. */
  assets: string
  /** Replace the host page's HTML. Takes effect on the next navigation. */
  setPage: (html: string) => void
  close: () => Promise<void>
}

const SHOWCASE = resolve("dist/showcase")

/** Enough of a content-type table for what `dist/showcase/` holds. */
const TYPES: Record<string, string> = {
  js: "text/javascript; charset=utf-8",
  html: "text/html; charset=utf-8",
  json: "application/json; charset=utf-8",
  css: "text/css; charset=utf-8",
}

const listen = (server: Server): Promise<string> =>
  new Promise((ok) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (typeof address === "string" || address === null) throw new Error("origin-server: no port")
      ok(`http://127.0.0.1:${address.port}`)
    })
  })

const shut = (server: Server): Promise<void> =>
  new Promise((ok, fail) => server.close((error) => (error ? fail(error) : ok())))

export async function startOrigins(): Promise<Origins> {
  let page = "<!doctype html><title>host</title>"

  const hostServer = createServer((_request, response) => {
    response.writeHead(200, { "content-type": TYPES.html! })
    response.end(page)
  })

  const assetsServer = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1")
    const match = /^\/(cors|nocors)\/(.+)$/.exec(url.pathname)
    if (!match) {
      response.writeHead(404).end("not a mount")
      return
    }
    const [, mount, rest] = match

    // Refuse to climb out of dist/showcase/. A test harness is still a server.
    const file = resolve(SHOWCASE, rest!)
    if (!file.startsWith(SHOWCASE)) {
      response.writeHead(403).end("outside the store")
      return
    }

    void readFile(file)
      .then((body) => {
        const extension = file.split(".").pop() ?? ""
        const headers: Record<string, string> = { "content-type": TYPES[extension] ?? "application/octet-stream" }
        // The whole point of the pair: identical bytes, one header apart.
        if (mount === "cors") headers["access-control-allow-origin"] = "*"
        response.writeHead(200, headers).end(body)
      })
      .catch(() => response.writeHead(404).end("no such artefact"))
  })

  const [host, assets] = await Promise.all([listen(hostServer), listen(assetsServer)])

  return {
    host,
    assets,
    setPage: (html) => {
      page = html
    },
    close: async () => {
      await Promise.all([shut(hostServer), shut(assetsServer)])
    },
  }
}
