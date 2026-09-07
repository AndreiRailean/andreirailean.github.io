import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import tailwindcss from "@tailwindcss/vite"

import icon from "astro-icon"

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [
      tailwindcss({
        applyBaseStyles: false,
      }),
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
