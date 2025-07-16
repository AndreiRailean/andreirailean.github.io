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
  site: "https://andrei.md",
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
    port: 4354,
    // allowedHosts: ["localhost", "ngrok domain here"],
  },
})
