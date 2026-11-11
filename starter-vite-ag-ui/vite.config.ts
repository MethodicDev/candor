import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    // The whole app is one chunk of about 850 kB minified (about 245 kB gzipped, measured at 4.0.1): React,
    // Base UI, Candor's components and the AG-UI client. That is fine for a starter, so
    // the default 500 kB warning would only add noise to a first build. Raised, not removed: if the app grows past
    // this, the warning is the signal to split it (dynamic import() for a route, or Vite's
    // build.rolldownOptions.output.codeSplitting).
    chunkSizeWarningLimit: 900,
  },
})
