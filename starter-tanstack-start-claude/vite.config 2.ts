import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { nitro } from "nitro/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  server: { port: 3000 },
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackStart(),
    // Builds a Node server (.output/server/index.mjs): the agent's permission requests wait in its memory.
    nitro(),
    // React's plugin comes after Start's.
    viteReact(),
    tailwindcss(),
  ],
})
