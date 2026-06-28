import { defineConfig } from "vite";

// Frontend lives at the project root (index.html → src/main.ts). Functions are NOT built
// by Vite — Cloudflare compiles functions/ separately. Output goes to dist/, which
// wrangler.toml serves as the Pages output directory.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
