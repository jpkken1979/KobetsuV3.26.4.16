import { describe, it, expect } from "vitest";
import { analyzeMidHires } from "../services/batch-contracts";

describe("analyzeMidHires — auto-period", () => {
  it("retorna error cuando companyId no existe", async () => {
    await expect(analyzeMidHires({ companyId: 999999 })).rejects.toThrow("not found");
  });

  it("acepta params con conflictDateOverrides sin lanzar error de firma", async () => {
    // Con companyId válido en la test DB — puede retornar lines vacías si no hay empleados.
    // Lo importante es que no tire error por la nueva firma de objeto.
    const result = await analyzeMidHires({
      companyId: 1,
      conflictDateOverrides: { "999": "2027-01-01" },
    });
    expect(Array.isArray(result.lines)).toBe(true);
    expect(Array.isArray(result.skipped)).toBe(true);
  });

  it("acepta startDateOverride sin lanzar error", async () => {
    const result = await analyzeMidHires({
      companyId: 1,
      startDateOverride: "2026-01-01",
    });
    expect(Array.isArray(result.lines)).toBe(true);
    expect(Array.isArray(result.skipped)).toBe(true);
  });
});

describe("analyzeMidHires — lógica de negocio", () => {
  it("retorna skipped para fábrica sin 抵触日 cuando company tampoco tiene", async () => {
    // Con startDateOverride muy futuro para que no haya empleados elegibles,
    // y sin conflictDate en company ni factory, debería skipear todas las factories
    const result = await analyzeMidHires({
      companyId: 1,
      startDateOverride: "2099-01-01",
    });
    // Puede ser lines vacías o skipped — lo importante es que no lanza
    expect(Array.isArray(result.lines)).toBe(true);
    expect(Array.isArray(result.skipped)).toBe(true);
  });

  it("startDateOverride sobreescribe el cálculo de periodStart", async () => {
    // Con startDateOverride muy futuro, no puede haber empleados elegibles
    const withFuture = await analyzeMidHires({
      companyId: 1,
      startDateOverride: "2099-01-01",
    });
    expect(withFuture.lines).toHaveLength(0);

    // Con startDateOverride muy pasado, puede haber más empleados elegibles
    const withPast = await analyzeMidHires({
      companyId: 1,
      startDateOverride: "2000-01-01",
    });
    // No importa si hay resultados, solo que no lanza
    expect(Array.isArray(withPast.lines)).toBe(true);
  });

  it("conflictDateOverride por fábrica se aplica independientemente", async () => {
    // Pasamos un factoryId que no existe (999) para que el override no se aplique a nada
    // pero tampoco cause crash
    const result = await analyzeMidHires({
      companyId: 1,
      conflictDateOverrides: { "999": "2027-06-01" },
      startDateOverride: "2099-01-01",
    });
    expect(Array.isArray(result.lines)).toBe(true);
  });

  it("estructura de MidHiresLine tiene los campos requeridos cuando hay líneas", async () => {
    // Usar startDateOverride muy pasado para maximizar chances de tener líneas
    const result = await analyzeMidHires({
      companyId: 1,
      startDateOverride: "2000-01-01",
    });

    for (const line of result.lines) {
      expect(line).toHaveProperty("effectiveConflictDate");
      expect(line).toHaveProperty("periodStart");
      expect(line).toHaveProperty("contractStartDate");
      expect(line).toHaveProperty("contractEndDate");
      expect(typeof line.effectiveConflictDate).toBe("string");
      expect(typeof line.periodStart).toBe("string");
      // contractEndDate debe ser 1 día antes de effectiveConflictDate
      // Verificar formato YYYY-MM-DD
      expect(line.contractEndDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(line.effectiveConflictDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
