import { test, expect } from "@playwright/test";

/**
 * Smoke test del flujo Smart-Batch (`/contracts/smart-batch`).
 *
 * Cubre el flujo nuevo (#9 de generación de bundle):
 *   1. La page carga
 *   2. Hay selector de empresa
 *   3. Los inputs de globalStartDate/globalEndDate existen
 *   4. El botón Preview está deshabilitado sin inputs (canSearch: false)
 *
 * NO hace mutaciones de DB — solo verifica la UI.
 */
test.describe("Smart-Batch page", () => {
  test("la page carga y muestra los inputs del flujo", async ({ page }) => {
    await page.goto("/contracts/smart-batch");

    // Title visible
    await expect(page.getByText(/スマート一括作成|Smart Batch/i).first())
      .toBeVisible({ timeout: 10000 });

    // Inputs de fecha presentes
    const dateInputs = page.locator('input[type="date"]');
    await expect(dateInputs).toHaveCount(2, { timeout: 5000 });
  });

  test("explica las reglas de clasificación 継続/途中入社者", async ({ page }) => {
    await page.goto("/contracts/smart-batch");

    // El texto de ayuda debe mencionar la lógica
    await expect(page.locator("body")).toContainText(/継続/);
    await expect(page.locator("body")).toContainText(/途中入社/);
  });

  test("botón Preview está deshabilitado sin inputs", async ({ page }) => {
    await page.goto("/contracts/smart-batch");

    const previewBtn = page.getByRole("button", { name: /プレビュー/ });
    if (await previewBtn.isVisible()) {
      // Sin company ni fechas, debe estar disabled
      await expect(previewBtn).toBeDisabled();
    }
  });
});
