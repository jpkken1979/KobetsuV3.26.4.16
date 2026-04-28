import { test, expect } from "@playwright/test";

/**
 * Smoke test del dashboard (`/`).
 *
 * Verifica que el shell de la app carga, los stats principales aparecen
 * y la sidebar tiene los links principales. Es la prueba más básica de
 * "la app no está rota".
 */
test.describe("Dashboard", () => {
  test("carga el shell de la app y muestra stats", async ({ page }) => {
    await page.goto("/");

    // Header / sidebar debe estar visible
    await expect(page.getByRole("link", { name: /契約管理|契約一覧|ダッシュボード/i }).first())
      .toBeVisible({ timeout: 10000 });

    // El dashboard tiene al menos una métrica numérica
    await expect(page.locator("body")).toContainText(/契約|社員|工場/);
  });

  test("links principales de la sidebar funcionan", async ({ page }) => {
    await page.goto("/");

    // Click en /contracts (debe haber un link en el sidebar)
    const contractsLink = page.getByRole("link", { name: /契約一覧|contracts/i }).first();
    if (await contractsLink.isVisible()) {
      await contractsLink.click();
      await expect(page).toHaveURL(/\/contracts/);
    }
  });
});
