import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/**/*.test.ts", "__tests__/**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["app/**/*.ts", "app/**/*.tsx", "components/**/*.tsx"],
      exclude: ["node_modules", ".next", "__tests__"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
