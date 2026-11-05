import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "client/src/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
