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
