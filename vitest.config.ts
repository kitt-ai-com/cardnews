import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "node",
    environmentMatchGlobs: [["tests/renderer/**", "jsdom"]],
  },
  resolve: {
    alias: {
      "@core": new URL("./src/core", import.meta.url).pathname,
      "@impl": new URL("./src/providers-impl", import.meta.url).pathname,
    },
  },
});
