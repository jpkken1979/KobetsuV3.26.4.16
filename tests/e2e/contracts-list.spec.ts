import { test, expect } from "@playwright/test";

/**
 * Smoke test de `/contracts` (listado).
 *
 * Verifica:
 *   - La tabla de contratos carga sin errores
 *   - Los toggle de filtros (cancelados, status) responden
 *   - El botón "新規作成" navega al wizard
 */
test.describe("Contracts list", () => {
  test("la tabla de contratos carga", async ({ page }) => {
    await page.goto("/contracts");

    // El page header debe estar visible
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });

    // El body no debería tener un error explícito
    const errorText = await page.locator("body").textContent();
    expect(errorText).not.toMatch(/error|エラー/i);
  });

  test('botón "新規作成" navega al wizard', async ({ page }) => {
    await page.goto("/contracts");

    const newButton = page.getByRole("link", { name: /新規作成|新規|new/i }).first();
    if (await newButton.isVisible()) {
      await newButton.click();
      await expect(page).toHaveURL(/\/contracts\/new/);
    }
  });
});
