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
    // Excluir tests E2E de Playwright (corren con `npm run test:e2e`).
    // Vitest los descubriría por la extensión .spec.ts y fallaría
    // al intentar resolver `@playwright/test`.
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/tests/e2e/**",
    ],
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
