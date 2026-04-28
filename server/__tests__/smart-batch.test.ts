/**
 * Tests for analyzeSmartBatch + executeSmartBatch — ikkatsu por fábrica con
 * auto-clasificación 継続 / 途中入社者 según el nyushabi (入社日).
 *
 * Estrategia mixta:
 *   • Tests de firma / error: sin tocar fixtures, solo verifican contrato.
 *   • Tests de clasificación: asignan factory_id=1 a empleados específicos
 *     con hireDate controlado, después verifican el resultado, y limpian
 *     en afterEach (restauran factory_id a su valor previo).
 *   • Tests de creación: usan startDate 2099-* (no choca con fixture real)
 *     y limpian los contratos creados.
 */
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { db } from "../db/index.js";
import {
  contracts,
  contractEmployees,
  employees,
  factories,
} from "../db/schema.js";
import { eq, like, inArray } from "drizzle-orm";
import {
  analyzeSmartBatch,
  executeSmartBatch,
} from "../services/batch-contracts.js";

const TEST_COMPANY_ID = 3; // 瑞陵精機株式会社
const TEST_FACTORY_ID = 1; // 恵那工場 / 等速ジョイント
const TEST_DATE_PREFIX = "2099-";

// IDs de empleados que vamos a "prestar" a la factory 1 durante los tests.
const TEST_EMPLOYEE_IDS = [1, 2, 3, 4];

interface EmpSnapshot {
  id: number;
  factoryId: number | null;
  hireDate: string | null;
  actualHireDate: string | null;
}

let originalSnapshots: EmpSnapshot[] = [];

function snapshotEmployees(ids: number[]): EmpSnapshot[] {
  return db
    .select({
      id: employees.id,
      factoryId: employees.factoryId,
      hireDate: employees.hireDate,
      actualHireDate: employees.actualHireDate,
    })
    .from(employees)
    .where(inArray(employees.id, ids))
    .all();
}

function restoreEmployees(snapshots: EmpSnapshot[]) {
  for (const s of snapshots) {
    db.update(employees)
      .set({
        factoryId: s.factoryId,
        hireDate: s.hireDate,
        actualHireDate: s.actualHireDate,
      })
      .where(eq(employees.id, s.id))
      .run();
  }
}

function assignToFactory(empId: number, hireDate: string) {
  db.update(employees)
    .set({ factoryId: TEST_FACTORY_ID, hireDate, actualHireDate: hireDate })
    .where(eq(employees.id, empId))
    .run();
}

function cleanupContracts() {
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

// ─── 1. Tests de firma y errores ────────────────────────────────────

describe("analyzeSmartBatch — firma y errores", () => {
  it("rechaza globalStartDate > globalEndDate", async () => {
    await expect(
      analyzeSmartBatch({
        companyId: TEST_COMPANY_ID,
        globalStartDate: "2099-12-31",
        globalEndDate: "2099-01-01",
      })
    ).rejects.toThrow(/globalStartDate/);
  });

  it("retorna lines y skipped como arrays", async () => {
    const result = await analyzeSmartBatch({
      companyId: TEST_COMPANY_ID,
      globalStartDate: "2099-01-01",
      globalEndDate: "2099-12-31",
    });
    expect(Array.isArray(result.lines)).toBe(true);
    expect(Array.isArray(result.skipped)).toBe(true);
  });

  it("retorna lines vacías si no hay empleados asignados a la fábrica", async () => {
    // Sin asignar empleados a factory 1, el seed por defecto los deja sin factoryId.
    const result = await analyzeSmartBatch({
      companyId: TEST_COMPANY_ID,
      factoryIds: [TEST_FACTORY_ID],
      globalStartDate: "2099-01-01",
      globalEndDate: "2099-12-31",
    });
    expect(result.lines).toHaveLength(0);
    expect(result.skipped.length).toBeGreaterThan(0);
  });
});

// ─── 2. Tests de clasificación de empleados ────────────────────────

describe("analyzeSmartBatch — clasificación 継続 / 途中入社者 / future-skip", () => {
  beforeEach(() => {
    originalSnapshots = snapshotEmployees(TEST_EMPLOYEE_IDS);
  });

  afterEach(() => {
    restoreEmployees(originalSnapshots);
    cleanupContracts();
  });

  it("clasifica correctamente: hireDate < globalStart → continuation", async () => {
    assignToFactory(1, "2095-01-01"); // muy anterior al globalStart
    assignToFactory(2, "2098-06-01"); // anterior al globalStart

    const result = await analyzeSmartBatch({
      companyId: TEST_COMPANY_ID,
      factoryIds: [TEST_FACTORY_ID],
      globalStartDate: "2099-04-01",
      globalEndDate: "2099-09-30",
    });

    expect(result.lines).toHaveLength(1);
    const line = result.lines[0];
    expect(line.continuation.length).toBeGreaterThanOrEqual(2);
    expect(line.midHires).toHaveLength(0);
    expect(line.futureSkip).toHaveLength(0);

    const cont1 = line.continuation.find((e) => e.id === 1);
    const cont2 = line.continuation.find((e) => e.id === 2);
    expect(cont1?.contractStartDate).toBe("2099-04-01");
    expect(cont2?.contractStartDate).toBe("2099-04-01");
    expect(cont1?.contractEndDate).toBe("2099-09-30");
  });

  it("clasifica correctamente: hireDate dentro del rango → mid-hire", async () => {
    assignToFactory(1, "2099-04-01"); // exactamente el inicio (mid-hire)
    assignToFactory(2, "2099-06-15"); // a mitad de período
    assignToFactory(3, "2099-09-30"); // exactamente el fin (mid-hire)

    const result = await analyzeSmartBatch({
      companyId: TEST_COMPANY_ID,
      factoryIds: [TEST_FACTORY_ID],
      globalStartDate: "2099-04-01",
      globalEndDate: "2099-09-30",
    });

    expect(result.lines).toHaveLength(1);
    const line = result.lines[0];
    expect(line.midHires.length).toBeGreaterThanOrEqual(3);

    const m1 = line.midHires.find((e) => e.id === 1);
    const m2 = line.midHires.find((e) => e.id === 2);
    const m3 = line.midHires.find((e) => e.id === 3);
    expect(m1?.contractStartDate).toBe("2099-04-01");
    expect(m2?.contractStartDate).toBe("2099-06-15");
    expect(m3?.contractStartDate).toBe("2099-09-30");
    // Todos terminan en globalEndDate
    expect(m1?.contractEndDate).toBe("2099-09-30");
    expect(m2?.contractEndDate).toBe("2099-09-30");
    expect(m3?.contractEndDate).toBe("2099-09-30");
  });

  it("clasifica correctamente: hireDate > globalEnd → future-skip", async () => {
    assignToFactory(1, "2099-12-31"); // futuro respecto al rango

    const result = await analyzeSmartBatch({
      companyId: TEST_COMPANY_ID,
      factoryIds: [TEST_FACTORY_ID],
      globalStartDate: "2099-04-01",
      globalEndDate: "2099-09-30",
    });

    expect(result.lines.length + result.skipped.length).toBeGreaterThan(0);
    const line = result.lines[0];
    if (line) {
      const skip = line.futureSkip.find((e) => e.id === 1);
      expect(skip).toBeDefined();
      expect(skip?.kind).toBe("future-skip");
    }
  });

  it("trata hireDate null como continuation (asume antiguo)", async () => {
    db.update(employees)
      .set({ factoryId: TEST_FACTORY_ID, hireDate: null, actualHireDate: null })
      .where(eq(employees.id, 1))
      .run();

    const result = await analyzeSmartBatch({
      companyId: TEST_COMPANY_ID,
      factoryIds: [TEST_FACTORY_ID],
      globalStartDate: "2099-04-01",
      globalEndDate: "2099-09-30",
    });

    const line = result.lines[0];
    expect(line).toBeDefined();
    const emp = line.continuation.find((e) => e.id === 1);
    expect(emp).toBeDefined();
    expect(emp?.kind).toBe("continuation");
    expect(emp?.effectiveHireDate).toBeNull();
    expect(emp?.contractStartDate).toBe("2099-04-01");
  });

  it("actualHireDate tiene prioridad sobre hireDate", async () => {
    db.update(employees)
      .set({
        factoryId: TEST_FACTORY_ID,
        hireDate: "2095-01-01", // antiguo
        actualHireDate: "2099-06-15", // dentro del rango
      })
      .where(eq(employees.id, 1))
      .run();

    const result = await analyzeSmartBatch({
      companyId: TEST_COMPANY_ID,
      factoryIds: [TEST_FACTORY_ID],
      globalStartDate: "2099-04-01",
      globalEndDate: "2099-09-30",
    });

    const line = result.lines[0];
    expect(line).toBeDefined();
    // Debería caer como mid-hire usando actualHireDate
    const emp = line.midHires.find((e) => e.id === 1);
    expect(emp).toBeDefined();
    expect(emp?.effectiveHireDate).toBe("2099-06-15");
    expect(emp?.contractStartDate).toBe("2099-06-15");
  });

  it("totales por línea son consistentes", async () => {
    assignToFactory(1, "2095-01-01"); // continuation
    assignToFactory(2, "2099-05-15"); // mid-hire
    assignToFactory(3, "2199-01-01"); // future-skip
    assignToFactory(4, "2095-01-01"); // continuation

    const result = await analyzeSmartBatch({
      companyId: TEST_COMPANY_ID,
      factoryIds: [TEST_FACTORY_ID],
      globalStartDate: "2099-04-01",
      globalEndDate: "2099-09-30",
    });

    const line = result.lines[0];
    expect(line).toBeDefined();
    expect(line.totalEligible).toBe(line.continuation.length + line.midHires.length);
    // future-skip NO cuenta como eligible
    expect(line.totalEligible).not.toBe(
      line.continuation.length + line.midHires.length + line.futureSkip.length
    );
  });
});

// ─── 3. Tests de creación end-to-end ────────────────────────────────

describe("executeSmartBatch — creación de contratos", () => {
  beforeEach(() => {
    originalSnapshots = snapshotEmployees(TEST_EMPLOYEE_IDS);
  });

  afterEach(() => {
    restoreEmployees(originalSnapshots);
    cleanupContracts();
  });

  it("crea contratos separados para continuation y mid-hires", async () => {
    assignToFactory(1, "2095-01-01"); // continuation
    assignToFactory(2, "2095-02-01"); // continuation
    assignToFactory(3, "2099-06-15"); // mid-hire

    const { lines } = await analyzeSmartBatch({
      companyId: TEST_COMPANY_ID,
      factoryIds: [TEST_FACTORY_ID],
      globalStartDate: "2099-04-01",
      globalEndDate: "2099-09-30",
    });

    const result = executeSmartBatch(lines);

    // Esperamos al menos 2 contratos: 1 para los 2 continuation con misma rate,
    // 1 para el mid-hire con startDate distinto.
    expect(result.contracts.length).toBeGreaterThanOrEqual(2);
    expect(result.contractIds.length).toBe(result.contracts.length);

    // Verificar que existe un contrato cuyo startDate sea 2099-04-01 (continuation)
    const contStart = result.contracts.find((c) => c.startDate === "2099-04-01");
    expect(contStart).toBeDefined();

    // Verificar que existe un contrato con startDate 2099-06-15 (mid-hire)
    const midStart = result.contracts.find((c) => c.startDate === "2099-06-15");
    expect(midStart).toBeDefined();
    expect(midStart?.endDate).toBe("2099-09-30");

    // Verificar que perFactory reporta los counts correctos
    expect(result.perFactory).toHaveLength(1);
    const pf = result.perFactory[0];
    expect(pf.factoryId).toBe(TEST_FACTORY_ID);
    expect(pf.continuationCount).toBe(2);
    expect(pf.midHireCount).toBe(1);
    expect(pf.contractsCreated).toBe(result.contracts.length);
  });

  it("no crea contratos cuando solo hay future-skip", async () => {
    assignToFactory(1, "2199-01-01"); // futuro

    const { lines } = await analyzeSmartBatch({
      companyId: TEST_COMPANY_ID,
      factoryIds: [TEST_FACTORY_ID],
      globalStartDate: "2099-04-01",
      globalEndDate: "2099-09-30",
    });

    // Si llegó a haber línea, debe tener 0 elegibles
    if (lines.length > 0) {
      expect(lines[0].totalEligible).toBe(0);
    }

    const result = executeSmartBatch(lines);
    expect(result.contracts).toHaveLength(0);
    expect(result.contractIds).toHaveLength(0);
  });
});

// ─── 4. Test que verifica que la fábrica existe en el seed ──────────

describe("smart-batch fixture sanity", () => {
  it("la fábrica de test existe en kobetsu.test.db", () => {
    const f = db
      .select({ id: factories.id, companyId: factories.companyId })
      .from(factories)
      .where(eq(factories.id, TEST_FACTORY_ID))
      .get();
    expect(f).toBeDefined();
    expect(f?.companyId).toBe(TEST_COMPANY_ID);
  });
});
