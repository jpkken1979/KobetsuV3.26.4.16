import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@server": path.resolve(__dirname, "server"),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      include: [
        "server/services/**/*.ts",
        "src/routes/companies/-table-*.tsx",
      ],
      thresholds: {
        lines: 50,
        functions: 50,
        statements: 50,
        branches: 50,
        perFile: false,
      },
    },
  },
});
