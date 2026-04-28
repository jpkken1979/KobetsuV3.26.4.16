import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config para E2E tests del sistema 個別契約書.
 *
 * Antes de correr:
 *   npm install
 *   npx playwright install chromium
 *
 * Comandos:
 *   npm run test:e2e          → ejecuta todos los tests headless
 *   npm run test:e2e:ui       → modo interactivo con UI Mode de Playwright
 *   npm run test:e2e:headed   → ejecuta con browser visible
 *
 * El servidor dev (port 3026 frontend + 8026 API) se levanta automáticamente
 * vía `webServer` antes de los tests. La DB usada es la de prod local
 * (data/kobetsu.db) — los tests deben ser idempotentes y NO escribir datos.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // SQLite + dev server único → serial
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // dev server compartido
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3026",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3026",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
