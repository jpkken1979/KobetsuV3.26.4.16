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
        "server/routes/**/*.ts",
        "src/routes/companies/-table-*.tsx",
      ],
      thresholds: {
        lines: 50,
        functions: 50,
        statements: 50,
        branches: 50,
        perFile: false,
        // Per-file floors for invariants documented in CLAUDE.md.
        "server/services/contract-dates.ts": {
          lines: 95,
          functions: 95,
          statements: 95,
          branches: 90,
        },
        "server/services/batch-helpers.ts": {
          lines: 85,
          functions: 85,
          statements: 85,
          branches: 80,
        },
        "server/services/koritsu-pdf-parser.ts": {
          lines: 80,
          functions: 80,
          statements: 80,
          branches: 70,
        },
      },
    },
  },
});
