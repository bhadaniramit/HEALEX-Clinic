import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Auth/session pages are dynamic; keep classic App Router behavior.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
