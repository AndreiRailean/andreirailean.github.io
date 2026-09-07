import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import tailwindcss from "@tailwindcss/vite"

import icon from "astro-icon"

/**
 * Lets the dev server hand out a committed runner as a module.
 *
 * Two correct things disagree here. Runners are **built artefacts committed
 * under `public/`**, served byte-for-byte, because a published page pins one
 * by content hash — `src/experiments/docs/adr/20260907-runners-are-committed.md`.
 * And Vite holds that nothing in `public/` is ever a module: it bypasses the
 * plugin transforms, so one "should not be imported from source code. It can
 * only be referenced via HTML tags."
 *
 * A dynamic import written in source is rewritten to `<url>?import`, and that
 * query is what trips the guard. A `@vite-ignore` comment does not prevent it:
 * it stops Vite *resolving* the specifier, and the query is injected anyway.
 *
 * `gallery/embed.ts` never meets this, because it is bundled to
 * `public/showcase/embed.js` and loaded from an HTML tag — its own dynamic
 * import is a plain browser import Vite never sees. Anything driving runners
 * from source does meet it.
 *
 * **Dev only, and it changes nothing about what is served.** The built site has
 * no Vite in front of it, so this exists so that what you preview is what you
 * deploy. Dropping the query is the whole fix: the request then falls through
 * to the static handler that already answers that exact path.
 */
const runnersAreModules = {
  name: "showcase-runners-are-modules",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      const [path, query] = (request.url ?? "").split("?")
      if (query === "import" && path.startsWith("/showcase/runners/") && path.endsWith(".js")) {
        request.url = path
      }
      next()
    })
  },
}

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [
      tailwindcss({
        applyBaseStyles: false,
      }),
      runnersAreModules,
    ],
  },
  site: "https://www.andrei.md",
  integrations: [
    react(),
    icon({
      include: {
        "fa6-brands": ["*"],
      },
    }),
  ],
  output: "static",
  // Off by default. It is dev-only either way — a static build never emits it —
  // so this changes nothing about the published site; what it changes is that
  // `astro dev` no longer opens with it on screen.
  //
  // **Project-scoped rather than personal on purpose.** Astro's own alternative
  // is `pnpm exec astro preferences disable devToolbar`, which is per-machine
  // and would not travel: several worktrees on this box each start their own dev
  // server, and whichever one a browser lands on should behave the same.
  //
  // The test suite does not rely on this and still suppresses the toolbar
  // itself, because it *adopts* a running dev server rather than insisting on
  // its own and so has no say in how that one was configured — an older
  // worktree cut before this landed still serves it. See the `noDevToolbar`
  // fixture in `tests/support/experiment.ts`.
  devToolbar: {
    enabled: false,
  },
  server: {
    // Bind all interfaces so the dev server is reachable when running on a
    // remote box rather than localhost.
    host: true,
    port: 4354,
    // Vite rejects requests whose Host header is not an IP or localhost, so
    // Tailscale MagicDNS names have to be allowlisted explicitly.
    allowedHosts: [".ts.net"],
  },
})
