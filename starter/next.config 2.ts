import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The Claude Agent SDK starts its own process; keep it out of the bundle.
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
  turbopack: {
    // This folder is the project root, even when it sits inside another repo.
    root: import.meta.dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default nextConfig
