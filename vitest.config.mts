import { defineConfig } from "vitest/config";
import path from "node:path";

const root = import.meta.dirname;

export default defineConfig({
  resolve: { alias: { "@": path.resolve(root, "src"), "server-only": path.resolve(root, "tests/stubs/server-only.ts") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
