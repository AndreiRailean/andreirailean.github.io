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
