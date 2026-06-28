import { defineConfig } from "vitest/config";

// Tests cover the server-side logic and API handlers, which run on Web-standard APIs
// (Response, crypto, btoa/atob) — all available in Node, so the "node" environment is enough.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
