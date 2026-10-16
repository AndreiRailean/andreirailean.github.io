import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { Page } from "@playwright/test"
import { buildSync } from "esbuild"
import { callApi, type BaseApi, type Experiment } from "./experiment.ts"

/**
 * Serving the kit's synthetic piece, `tests/kit/`, to a page.
 *
 * **Bundled here and routed, never built into the site.** The fixture must not
 * be published, so it has no page under `src/pages/` and the build never sees
 * it. esbuild — already the runners' bundler — packs `tests/kit/entry.ts` and
 * everything it imports from `src/experiments/` into one script, in about a
 * tenth of a second, once per worker. `page.route` then answers for an origin
 * that does not exist, `http://kit.test`, with a document shaped like the
 * gallery's own `PiecePage.astro`: the kit's stylesheet, a canvas and `#ui`.
 *
 * The alternatives cost more for less. A route in the site gated on an
 * environment variable is one misconfigured build from being published; a
 * second Astro build doubles `globalSetup`; Vitest's browser mode is a new
 * dependency, which is the owner's call. This needs nothing that is not
 * already installed, and the kit under test is the same source the site
 * bundles — the bytes differ, the code does not.
 *
 * Its own origin keeps it apart from the site's as well: folds are remembered
 * in `localStorage` per origin, so a fold made here cannot follow anybody onto
 * a real piece.
 */

export const KIT_ORIGIN = "http://kit.test"

/** The two configurations: a box per group, or the one scrolling column. */
export type Layout = "boxed" | "column"

let script: string | undefined

function bundle(): string {
  script ??= buildSync({
    entryPoints: [resolve("tests/kit/entry.ts")],
    bundle: true,
    format: "iife",
    target: "es2022",
    alias: { "@": resolve("src") },
    write: false,
  }).outputFiles[0]!.text
  return script
}

/** The gallery's page, minus everything the kit does not need: no note, no reel. */
function document(): string {
  const css = readFileSync(resolve("src/experiments/kit/controls.css"), "utf8")
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kit fixture</title>
    <style>${css}</style>
    <style>
      html, body { margin: 0; height: 100%; background: #000; }
      body { overflow: hidden; color: #ddd; font: 13px system-ui, sans-serif; }
      canvas { position: fixed; inset: 0; display: block; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <canvas id="field"></canvas>
    <div id="ui"></div>
    <script>${bundle()}</script>
  </body>
</html>`
}

export type OpenKitOptions = {
  layout?: Layout
  /** Anything after the `?`: an address under test, or an escape hatch. */
  query?: string
  /** Pin the chrome shown (false) or hidden (true). Omit to leave the idle timer alone. */
  idle?: boolean
}

/**
 * Opens the fixture and hands back the same handle `openExperiment` does, so a
 * kit test reads exactly like a piece's.
 *
 * Every other path on the origin answers 204, so the favicon the browser asks
 * for unprompted is not a console error the `problems` fixture would fail on.
 */
export async function openKit(page: Page, options: OpenKitOptions = {}): Promise<Experiment<BaseApi>> {
  const html = document()
  await page.route(`${KIT_ORIGIN}/**`, (route) => {
    const { pathname } = new URL(route.request().url())
    if (pathname === "/boxed/" || pathname === "/column/") {
      return route.fulfill({ status: 200, contentType: "text/html", body: html })
    }
    return route.fulfill({ status: 204, body: "" })
  })
  await page.emulateMedia({ reducedMotion: "no-preference" })
  await page.goto(`${KIT_ORIGIN}/${options.layout ?? "boxed"}/${options.query ? `?${options.query}` : ""}`)
  await page.waitForFunction(() => Boolean(window.experiment))

  const experiment: Experiment<BaseApi> = {
    page,
    api: (fn, arg) => callApi(page, fn, arg as never),
    shot: () => Promise.reject(new Error("the kit fixture takes no stills")),
  }
  if (options.idle !== undefined) await experiment.api(({ api, arg }) => api.idle(arg), options.idle)
  return experiment
}
