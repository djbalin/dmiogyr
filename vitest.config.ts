import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
    // The app formats every date in a fixed forecast timezone, so the suite
    // runs in a deliberately *different* one: anything that quietly falls back
    // to the machine's local time fails here rather than in production.
    env: { TZ: "Pacific/Auckland" },
  },
});
