/**
 * Integration tests for executeByLineCreate — batch creation by line with
 * per-employee dates. Strategy: usa kobetsu.test.db (VITEST=true → db/index.ts
 * lo selecciona), inserta contratos con startDate 2099-* y limpia despues.
 *
 * Test fixture (verified en kobetsu.test.db):
 *   company_id=3 (瑞陵精機株式会社), factory id=1 (恵那工場)
 *   employees id=1 (billing_rate=2000), id=2 (billing_rate=2000),
 *             id=3 (billing_rate=2000), id=4 (billing_rate=2100)
 */
import { describe, it, expect, afterEach } from "vitest";
import { db } from "../db/index.js";
import { contracts, contractEmployees } from "../db/schema.js";
import { like, inArray } from "drizzle-orm";
import { executeByLineCreate } from "../services/batch-contracts.js";

const TEST_COMPANY_ID = 3;
const TEST_FACTORY_ID = 1;
const TEST_DATE_PREFIX = "2099-";

function cleanup() {
  const created = db
    .select({ id: contracts.id })
    .from(contracts)
    .where(like(contracts.startDate, `${TEST_DATE_PREFIX}%`))
    .all();
  if (created.length === 0) return;
  const ids = created.map((c) => c.id);
  db.delete(contractEmployees).where(inArray(contractEmployees.contractId, ids)).run();
  db.delete(contracts).where(inArray(contracts.id, ids)).run();
}

describe("executeByLineCreate", () => {
  afterEach(cleanup);

  it("agrupa empleados con misma tarifa y mismas fechas en 1 contrato", () => {
    const result = executeByLineCreate({
      companyId: TEST_COMPANY_ID,
      factoryId: TEST_FACTORY_ID,
      employees: [
        { employeeId: 1, startDate: "2099-04-01", endDate: "2099-06-30" },
        { employeeId: 2, startDate: "2099-04-01", endDate: "2099-06-30" },
        { employeeId: 3, startDate: "2099-04-01", endDate: "2099-06-30" },
      ],
    });

    expect(result.contracts).toHaveLength(1);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].count).toBe(3);
    expect(result.groups[0].rate).toBe(2000);
    expect(result.contracts[0].employeeCount).toBe(3);
  });

  it("crea contratos separados cuando las fechas difieren con misma tarifa", () => {
    const result = executeByLineCreate({
      companyId: TEST_COMPANY_ID,
      factoryId: TEST_FACTORY_ID,
      employees: [
        { employeeId: 1, startDate: "2099-04-01", endDate: "2099-06-30" },
        { employeeId: 2, startDate: "2099-04-01", endDate: "2099-06-30" },
        // empleado 3: 中途入社 con startDate distinto
        { employeeId: 3, startDate: "2099-05-15", endDate: "2099-06-30" },
      ],
    });

    expect(result.contracts).toHaveLength(2);
    expect(result.groups).toHaveLength(2);
    const group2 = result.groups.find((g) => g.startDate === "2099-04-01");
    const group1 = result.groups.find((g) => g.startDate === "2099-05-15");
    expect(group2?.count).toBe(2);
    expect(group1?.count).toBe(1);
  });

  it("crea contratos separados cuando las tarifas difieren", () => {
    const result = executeByLineCreate({
      companyId: TEST_COMPANY_ID,
      factoryId: TEST_FACTORY_ID,
      employees: [
        // empleados 1-3 a ¥2000
        { employeeId: 1, startDate: "2099-04-01", endDate: "2099-06-30" },
        { employeeId: 2, startDate: "2099-04-01", endDate: "2099-06-30" },
        // empleado 4 a ¥2100
        { employeeId: 4, startDate: "2099-04-01", endDate: "2099-06-30" },
      ],
    });

    expect(result.contracts).toHaveLength(2);
    const rates = result.groups.map((g) => g.rate).sort();
    expect(rates).toEqual([2000, 2100]);
    const group2k = result.groups.find((g) => g.rate === 2000);
    const group21k = result.groups.find((g) => g.rate === 2100);
    expect(group2k?.count).toBe(2);
    expect(group21k?.count).toBe(1);
  });

  it("persiste hourlyRate per-employee en contract_employees", () => {
    const result = executeByLineCreate({
      companyId: TEST_COMPANY_ID,
      factoryId: TEST_FACTORY_ID,
      employees: [
        { employeeId: 1, startDate: "2099-04-01", endDate: "2099-06-30" },
      ],
    });

    expect(result.contracts).toHaveLength(1);
    const contractId = result.contracts[0].id;
    const assignments = db
      .select()
      .from(contractEmployees)
      .where(inArray(contractEmployees.contractId, [contractId]))
      .all();

    expect(assignments).toHaveLength(1);
    expect(assignments[0].employeeId).toBe(1);
    expect(assignments[0].hourlyRate).toBe(2000); // billingRate
    expect(assignments[0].individualStartDate).toBe("2099-04-01");
    expect(assignments[0].individualEndDate).toBe("2099-06-30");
  });

  it("retorna vacío cuando no hay empleados", () => {
    const result = executeByLineCreate({
      companyId: TEST_COMPANY_ID,
      factoryId: TEST_FACTORY_ID,
      employees: [],
    });

    expect(result.contracts).toHaveLength(0);
    expect(result.groups).toHaveLength(0);
  });
});
