import { defineConfig } from "astro/config"
import tailwind from "@astrojs/tailwind"
import react from "@astrojs/react"

import icon from "astro-icon"

// https://astro.build/config
export default defineConfig({
  site: "https://andrei.md",
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    react(),
    icon({
      include: {
        "fa6-brands": ["*"],
      },
    }),
  ],
  output: "static",
  server: {
    port: 4354,
  },
})
