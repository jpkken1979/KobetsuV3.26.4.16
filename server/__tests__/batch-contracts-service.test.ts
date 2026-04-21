/**
 * Integration tests for batch-contracts.ts — executeBatchCreate & executeNewHiresCreate.
 *
 * Strategy: call the real transactional functions with hand-crafted AnalysisLine[]
 * (bypassing analyzeBatch which requires full DB state). Uses kobetsu.test.db
 * (VITEST=true → db/index.ts picks the test file automatically).
 *
 * Cleanup: contracts created here use startDate "2099-*" so we can safely
 * DELETE them in afterEach without touching production data.
 *
 * Note: los fixtures de Employee y RateGroup usan `as any` deliberadamente —
 * reconstruir un Employee completo en cada caso infla el archivo sin aportar
 * cobertura real. El cast asume que `executeBatchCreate`/`executeNewHiresCreate`
 * solo consultan los campos provistos (id, fullName, effectiveHireDate, etc.).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, afterEach } from "vitest";
import { db } from "../db/index.js";
import { contracts, contractEmployees, auditLog } from "../db/schema.js";
import { eq, like, inArray } from "drizzle-orm";
import {
  executeBatchCreate,
  executeNewHiresCreate,
  executeMidHiresCreate,
  type BatchCreateResult,
  type HiresCreateResult,
} from "../services/batch-contracts.js";
import type { AnalysisResult, AnalysisLine } from "../services/batch-helpers.js";
import type { MidHiresLine } from "../services/batch-contracts.js";
import type { Factory } from "../db/schema.js";

// ─── Test constants (IDs verified in kobetsu.test.db) ────────────────
// company_id=3 (瑞陵精機株式会社), factory id=1 (恵那工場, hourly_rate=1600)
// employees: id=1 (billing_rate=2000), id=2 (billing_rate=2000),
//            id=3 (billing_rate=2000), id=4 (billing_rate=2100)
const TEST_COMPANY_ID = 3;
const TEST_FACTORY_ID = 1;
const START_DATE = "2099-04-01";
const END_DATE = "2099-06-30";

// ─── Factory fixture matching the Factory type from db/schema.ts ──────

function makeTestFactory(overrides: Partial<Factory> = {}): Factory {
  return {
    id: TEST_FACTORY_ID,
    companyId: TEST_COMPANY_ID,
    factoryName: "恵那工場",
    address: null,
    phone: null,
    department: "製造部",
    lineName: "等速ジョイント",
    supervisorDept: null,
    supervisorName: null,
    supervisorPhone: null,
    complaintClientName: null,
    complaintClientPhone: null,
    complaintClientDept: null,
    complaintUnsName: null,
    complaintUnsPhone: null,
    complaintUnsDept: null,
    complaintUnsAddress: null,
    managerUnsName: null,
    managerUnsPhone: null,
    managerUnsDept: null,
    managerUnsAddress: null,
    hakensakiManagerName: null,
    hakensakiManagerPhone: null,
    hakensakiManagerDept: null,
    hakensakiManagerRole: null,
    supervisorRole: null,
    hourlyRate: 1600,
    jobDescription: null,
    shiftPattern: null,
    workHours: "8時00分～17時00分",
    workHoursDay: "8:00~17:00",
    workHoursNight: null,
    breakTime: 60,
    breakTimeDay: null,
    breakTimeNight: null,
    overtimeHours: null,
    overtimeOutsideDays: null,
    workDays: "月～金",
    jobDescription2: null,
    conflictDate: null,
    contractPeriod: null,
    calendar: null,
    closingDay: null,
    closingDayText: null,
    paymentDay: null,
    paymentDayText: null,
    bankAccount: null,
    timeUnit: null,
    workerClosingDay: null,
    workerPaymentDay: null,
    workerCalendar: null,
    agreementPeriodEnd: null,
    explainerName: null,
    hasRobotTraining: false,
    isActive: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  };
}

// ─── AnalysisLine builder ─────────────────────────────────────────────

function makeAnalysisLine(overrides: Partial<AnalysisLine> = {}): AnalysisLine {
  return {
    factory: makeTestFactory(),
    effectiveEndDate: END_DATE,
    capped: false,
    autoCalculated: false,
    contractPeriod: null,
    conflictDate: null,
    rateGroups: [],
    totalEmployees: 0,
    totalContracts: 0,
    duplicates: [],
    workStartTime: "08:00",
    workEndTime: "17:00",
    participationRate: 87.5,
    isExempt: false,
    exemptionReason: undefined,
    ...overrides,
  };
}

// ─── Cleanup: remove contracts created by tests (2099-* dates) ────────

afterEach(() => {
  // Find all contracts we created (startDate starts with "2099")
  const testContracts = db
    .select({ id: contracts.id })
    .from(contracts)
    .where(like(contracts.startDate, "2099%"))
    .all();

  if (testContracts.length > 0) {
    const ids = testContracts.map((c) => c.id);
    // contractEmployees cascade-deletes, but we also clean audit_log
    db.delete(contracts).where(inArray(contracts.id, ids)).run();
    // Remove audit log entries from these tests
    db.delete(auditLog).where(like(auditLog.detail, "%一括作成%2099%")).run();
  }
});

// ═══════════════════════════════════════════════════════════════════════
// executeBatchCreate
// ═══════════════════════════════════════════════════════════════════════

describe("executeBatchCreate", () => {
  it("crea un contrato por grupo de tarifa cuando todos tienen la misma rate", () => {
    // Employees 1, 2, 3 all have billing_rate=2000
    const rateGroup = {
      rate: 2000,
      overtimeRate: 2500,
      nightShiftRate: 2500,
      holidayRate: 2700,
      sixtyHourRate: 3000,
      employeeCount: 3,
      employees: [
        { id: 1, fullName: "THAI HUY DUC", effectiveHireDate: START_DATE } as any,
        { id: 2, fullName: "PHAM VAN THANH", effectiveHireDate: START_DATE } as any,
        { id: 3, fullName: "LE  VAN THAO", effectiveHireDate: START_DATE } as any,
      ],
    };

    const analysisResult: AnalysisResult = {
      lines: [makeAnalysisLine({ rateGroups: [rateGroup], totalEmployees: 3, totalContracts: 1 })],
      skipped: [],
    };

    const { created, skipped } = executeBatchCreate(
      TEST_COMPANY_ID,
      START_DATE,
      analysisResult.lines,
      analysisResult.skipped,
    );

    // Debe crear exactamente 1 contrato (1 grupo de tarifa)
    expect(created).toHaveLength(1);
    expect(skipped).toHaveLength(0);

    const result = created[0] as BatchCreateResult;
    expect(result.hourlyRate).toBe(2000);
    expect(result.employees).toBe(3);
    expect(result.factoryName).toBe("恵那工場");
    expect(result.endDate).toBe(END_DATE);
  });

  it("crea contratos separados para empleados con distintas tarifas", () => {
    // Group A: rate 2000 (employees 1, 2)
    const groupA = {
      rate: 2000,
      overtimeRate: 2500,
      nightShiftRate: 2500,
      holidayRate: 2700,
      sixtyHourRate: 3000,
      employeeCount: 2,
      employees: [
        { id: 1, fullName: "THAI HUY DUC", effectiveHireDate: START_DATE } as any,
        { id: 2, fullName: "PHAM VAN THANH", effectiveHireDate: START_DATE } as any,
      ],
    };
    // Group B: rate 2100 (employee 4)
    const groupB = {
      rate: 2100,
      overtimeRate: 2625,
      nightShiftRate: 2625,
      holidayRate: 2835,
      sixtyHourRate: 3150,
      employeeCount: 1,
      employees: [
        { id: 4, fullName: "LE DINH BINH", effectiveHireDate: START_DATE } as any,
      ],
    };

    const analysisResult: AnalysisResult = {
      lines: [makeAnalysisLine({ rateGroups: [groupA, groupB], totalEmployees: 3, totalContracts: 2 })],
      skipped: [],
    };

    const { created } = executeBatchCreate(
      TEST_COMPANY_ID,
      START_DATE,
      analysisResult.lines,
      analysisResult.skipped,
    );

    // Debe crear 2 contratos — uno por grupo de tarifa
    expect(created).toHaveLength(2);

    const rates = created.map((c) => c.hourlyRate).sort((a, b) => a - b);
    expect(rates).toEqual([2000, 2100]);

    const contractA = created.find((c) => c.hourlyRate === 2000)!;
    const contractB = created.find((c) => c.hourlyRate === 2100)!;
    expect(contractA.employees).toBe(2);
    expect(contractB.employees).toBe(1);
  });

  it("guarda las asignaciones de empleados en contract_employees", () => {
    const rateGroup = {
      rate: 2000,
      overtimeRate: 2500,
      nightShiftRate: 2500,
      holidayRate: 2700,
      sixtyHourRate: 3000,
      employeeCount: 2,
      employees: [
        { id: 1, fullName: "THAI HUY DUC", effectiveHireDate: START_DATE } as any,
        { id: 2, fullName: "PHAM VAN THANH", effectiveHireDate: START_DATE } as any,
      ],
    };

    const { created } = executeBatchCreate(
      TEST_COMPANY_ID,
      START_DATE,
      [makeAnalysisLine({ rateGroups: [rateGroup], totalEmployees: 2, totalContracts: 1 })],
      [],
    );

    expect(created).toHaveLength(1);
    const contractId = created[0].id;

    // Verificar que los registros en contract_employees existen
    const assignments = db
      .select()
      .from(contractEmployees)
      .where(eq(contractEmployees.contractId, contractId))
      .all();

    expect(assignments).toHaveLength(2);
    const employeeIds = assignments.map((a) => a.employeeId).sort((a, b) => a - b);
    expect(employeeIds).toEqual([1, 2]);

    // La tarifa individual usa billingRate (regla crítica del dominio)
    expect(assignments.every((a) => a.hourlyRate === 2000)).toBe(true);
  });

  it("el número de contrato tiene formato KOB-YYYYMM-XXXX", () => {
    const rateGroup = {
      rate: 2000,
      overtimeRate: 2500,
      nightShiftRate: 2500,
      holidayRate: 2700,
      sixtyHourRate: 3000,
      employeeCount: 1,
      employees: [
        { id: 1, fullName: "THAI HUY DUC", effectiveHireDate: START_DATE } as any,
      ],
    };

    const { created } = executeBatchCreate(
      TEST_COMPANY_ID,
      START_DATE,
      [makeAnalysisLine({ rateGroups: [rateGroup], totalEmployees: 1, totalContracts: 1 })],
      [],
    );

    expect(created).toHaveLength(1);
    // KOB-YYYYMM-XXXX: KOB-209904-0001 (usando startDate 2099-04-01)
    expect(created[0].contractNumber).toMatch(/^KOB-\d{6}-\d{4}$/);
    expect(created[0].contractNumber).toContain("209904");
  });

  it("la operación es atómica: si falla una inserción no quedan datos parciales", () => {
    // Forzamos un fallo: employee id=999999 no existe en la DB (FK violation)
    const rateGroup = {
      rate: 2000,
      overtimeRate: 2500,
      nightShiftRate: 2500,
      holidayRate: 2700,
      sixtyHourRate: 3000,
      employeeCount: 1,
      employees: [
        { id: 999999, fullName: "Inexistente", effectiveHireDate: START_DATE } as any,
      ],
    };

    // Contar contratos antes
    const countBefore = db.select({ id: contracts.id }).from(contracts).where(like(contracts.startDate, "2099%")).all().length;

    expect(() =>
      executeBatchCreate(
        TEST_COMPANY_ID,
        START_DATE,
        [makeAnalysisLine({ rateGroups: [rateGroup], totalEmployees: 1, totalContracts: 1 })],
        [],
      )
    ).toThrow();

    // Contar contratos después — debe ser igual (rollback)
    const countAfter = db.select({ id: contracts.id }).from(contracts).where(like(contracts.startDate, "2099%")).all().length;
    expect(countAfter).toBe(countBefore);
  });

  it("las líneas con duplicados se omiten y se registran en skipped", () => {
    // Una línea con duplicados existentes → debe ser skipped
    const rateGroup = {
      rate: 2000,
      overtimeRate: 2500,
      nightShiftRate: 2500,
      holidayRate: 2700,
      sixtyHourRate: 3000,
      employeeCount: 1,
      employees: [
        { id: 1, fullName: "THAI HUY DUC", effectiveHireDate: START_DATE } as any,
      ],
    };

    const lineWithDuplicate = makeAnalysisLine({
      rateGroups: [rateGroup],
      totalEmployees: 1,
      totalContracts: 1,
      duplicates: [
        {
          id: 999,
          contractNumber: "KOB-209904-9999",
          startDate: START_DATE,
          endDate: END_DATE,
          status: "active",
          employeeCount: 1,
        },
      ],
    });

    const { created, skipped } = executeBatchCreate(
      TEST_COMPANY_ID,
      START_DATE,
      [lineWithDuplicate],
      [],
    );

    expect(created).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toContain("重複契約");
  });

  it("escribe una entrada en audit_log por cada contrato creado", () => {
    const rateGroup = {
      rate: 2000,
      overtimeRate: 2500,
      nightShiftRate: 2500,
      holidayRate: 2700,
      sixtyHourRate: 3000,
      employeeCount: 1,
      employees: [
        { id: 1, fullName: "THAI HUY DUC", effectiveHireDate: START_DATE } as any,
      ],
    };

    const { created } = executeBatchCreate(
      TEST_COMPANY_ID,
      START_DATE,
      [makeAnalysisLine({ rateGroups: [rateGroup], totalEmployees: 1, totalContracts: 1 })],
      [],
    );

    expect(created).toHaveLength(1);
    const contractId = created[0].id;

    const auditEntries = db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, contractId))
      .all();

    const contractAuditEntry = auditEntries.find((entry) => entry.entityType === "contract");

    expect(auditEntries.length).toBeGreaterThanOrEqual(1);
    expect(contractAuditEntry).toBeDefined();
    expect(contractAuditEntry?.action).toBe("create");
    expect(contractAuditEntry?.entityType).toBe("contract");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// executeNewHiresCreate
// ═══════════════════════════════════════════════════════════════════════

describe("executeNewHiresCreate", () => {
  const HIRE_FROM = "2099-04-01";
  const HIRE_TO = "2099-04-15";

  it("crea contratos para nuevas incorporaciones con individualStartDate por empleado", () => {
    const rateGroup = {
      rate: 2000,
      overtimeRate: 2500,
      nightShiftRate: 2500,
      holidayRate: 2700,
      sixtyHourRate: 3000,
      employeeCount: 2,
      employees: [
        { id: 1, fullName: "THAI HUY DUC", effectiveHireDate: HIRE_FROM } as any,
        { id: 2, fullName: "PHAM VAN THANH", effectiveHireDate: HIRE_FROM } as any,
      ],
    };

    const lines: AnalysisResult["lines"] = [
      makeAnalysisLine({
        rateGroups: [rateGroup],
        totalEmployees: 2,
        totalContracts: 1,
        effectiveEndDate: END_DATE,
      }),
    ];

    const results = executeNewHiresCreate(TEST_COMPANY_ID, HIRE_FROM, HIRE_TO, lines);

    expect(results).toHaveLength(1);
    const result = results[0] as HiresCreateResult;
    expect(result.hourlyRate).toBe(2000);
    expect(result.employeeCount).toBe(2);
    expect(result.startDate).toBe(HIRE_FROM);
    expect(result.endDate).toBe(END_DATE);
  });

  it("guarda individualStartDate en contract_employees para nuevas incorporaciones", () => {
    const rateGroup = {
      rate: 2000,
      overtimeRate: 2500,
      nightShiftRate: 2500,
      holidayRate: 2700,
      sixtyHourRate: 3000,
      employeeCount: 1,
      employees: [
        { id: 3, fullName: "LE  VAN THAO", effectiveHireDate: HIRE_FROM } as any,
      ],
    };

    const results = executeNewHiresCreate(
      TEST_COMPANY_ID,
      HIRE_FROM,
      HIRE_TO,
      [makeAnalysisLine({ rateGroups: [rateGroup], totalEmployees: 1, totalContracts: 1, effectiveEndDate: END_DATE })],
    );

    expect(results).toHaveLength(1);
    const contractId = results[0].id;

    const assignments = db
      .select()
      .from(contractEmployees)
      .where(eq(contractEmployees.contractId, contractId))
      .all();

    expect(assignments).toHaveLength(1);
    expect(assignments[0].individualStartDate).toBe(HIRE_FROM);
    expect(assignments[0].individualEndDate).toBe(END_DATE);
  });

  it("usa la fecha de incorporación más temprana como startDate del contrato", () => {
    // Dos empleados con distintas fechas de incorporación — el contrato toma la más temprana
    const EARLY_DATE = "2099-04-01";
    const LATE_DATE = "2099-04-10";

    const rateGroup = {
      rate: 2000,
      overtimeRate: 2500,
      nightShiftRate: 2500,
      holidayRate: 2700,
      sixtyHourRate: 3000,
      employeeCount: 2,
      employees: [
        { id: 1, fullName: "THAI HUY DUC", billingRate: 2000, hourlyRate: 1500, employeeNumber: "220908", actualHireDate: LATE_DATE, hireDate: LATE_DATE, effectiveHireDate: LATE_DATE },
        { id: 2, fullName: "PHAM VAN THANH", billingRate: 2000, hourlyRate: 1500, employeeNumber: "230105", actualHireDate: EARLY_DATE, hireDate: EARLY_DATE, effectiveHireDate: EARLY_DATE },
      ],
    };

    const results = executeNewHiresCreate(
      TEST_COMPANY_ID,
      EARLY_DATE,
      LATE_DATE,
      [
        makeAnalysisLine({
          rateGroups: [
            {
              ...rateGroup,
              overtimeRate: rateGroup.overtimeRate ?? 2500,
              nightShiftRate: rateGroup.nightShiftRate ?? 2500,
              holidayRate: rateGroup.holidayRate ?? 2700,
              sixtyHourRate: rateGroup.sixtyHourRate ?? 3000,
            } as any,
          ],
          totalEmployees: 2,
          totalContracts: 1,
          effectiveEndDate: END_DATE,
        }),
      ],
    );

    expect(results).toHaveLength(1);
    // El contrato arranca en la fecha más temprana (sort()[0])
    expect(results[0].startDate).toBe(EARLY_DATE);
  });

  it("crea contratos separados por grupos de tarifa en nuevas incorporaciones", () => {
    const groupA = {
      rate: 2000,
      overtimeRate: 2500,
      nightShiftRate: 2500,
      holidayRate: 2700,
      sixtyHourRate: 3000,
      employeeCount: 1,
      employees: [
        { id: 1, fullName: "THAI HUY DUC", billingRate: 2000, hourlyRate: 1500, employeeNumber: "220908", actualHireDate: HIRE_FROM, hireDate: HIRE_FROM, effectiveHireDate: HIRE_FROM },
      ],
    };
    const groupB = {
      rate: 2100,
      overtimeRate: 2625,
      nightShiftRate: 2625,
      holidayRate: 2835,
      sixtyHourRate: 3150,
      employeeCount: 1,
      employees: [
        { id: 4, fullName: "LE DINH BINH", billingRate: 2100, hourlyRate: 1600, employeeNumber: "230316", actualHireDate: HIRE_FROM, hireDate: HIRE_FROM, effectiveHireDate: HIRE_FROM },
      ],
    };

    const results = executeNewHiresCreate(
      TEST_COMPANY_ID,
      HIRE_FROM,
      HIRE_TO,
      [
        makeAnalysisLine({
          rateGroups: [
            {
              ...groupA,
              overtimeRate: groupA.overtimeRate ?? 2500,
              nightShiftRate: groupA.nightShiftRate ?? 2500,
              holidayRate: groupA.holidayRate ?? 2700,
              sixtyHourRate: groupA.sixtyHourRate ?? 3000,
            } as any,
            {
              ...groupB,
              overtimeRate: groupB.overtimeRate ?? 2625,
              nightShiftRate: groupB.nightShiftRate ?? 2625,
              holidayRate: groupB.holidayRate ?? 2835,
              sixtyHourRate: groupB.sixtyHourRate ?? 3150,
            } as any,
          ],
          totalEmployees: 2,
          totalContracts: 2,
          effectiveEndDate: END_DATE,
        }),
      ],
    );

    expect(results).toHaveLength(2);
    const rates = results.map((r) => r.hourlyRate).sort((a, b) => a - b);
    expect(rates).toEqual([2000, 2100]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// executeMidHiresCreate
// ═══════════════════════════════════════════════════════════════════════

describe("executeMidHiresCreate", () => {
  const MID_START = "2099-04-01";
  const MID_END = "2099-06-30";

  it("crea contratos para incorporaciones durante el periodo de contrato vigente", () => {
    const factory = makeTestFactory();

    const midLine: MidHiresLine = {
      factory,
      contractStartDate: MID_START,
      contractEndDate: MID_END,
      effectiveConflictDate: "2099-07-01",
      periodStart: MID_START,
      totalEmployees: 1,
      totalContracts: 1,
      rateGroups: [
        {
          rate: 2000,
          employeeCount: 1,
          overtimeRate: 2500,
          nightShiftRate: 2500,
          holidayRate: 2700,
          employees: [
            { id: 1, fullName: "THAI HUY DUC", employeeNumber: "220908", billingRate: 2000, hourlyRate: 1500, visaExpiry: null, nationality: null, effectiveHireDate: MID_START },
          ],
        },
      ],
      workStartTime: "08:00",
      workEndTime: "17:00",
      participationRate: 87.5,
      isExempt: false,
      exemptionReason: null,
    };

    const results = executeMidHiresCreate(TEST_COMPANY_ID, [midLine]);

    expect(results).toHaveLength(1);
    expect(results[0].hourlyRate).toBe(2000);
    expect(results[0].endDate).toBe(MID_END);
    expect(results[0].employeeCount).toBe(1);
  });

  it("el contrato de mid-hire tiene individualStartDate y individualEndDate en contract_employees", () => {
    const factory = makeTestFactory();

    const midLine: MidHiresLine = {
      factory,
      contractStartDate: MID_START,
      contractEndDate: MID_END,
      effectiveConflictDate: "2099-07-01",
      periodStart: MID_START,
      totalEmployees: 1,
      totalContracts: 1,
      rateGroups: [
        {
          rate: 2000,
          employeeCount: 1,
          overtimeRate: 2500,
          nightShiftRate: 2500,
          holidayRate: 2700,
          employees: [
            { id: 2, fullName: "PHAM VAN THANH", employeeNumber: "230105", billingRate: 2000, hourlyRate: 1500, visaExpiry: null, nationality: null, effectiveHireDate: MID_START },
          ],
        },
      ],
      workStartTime: "08:00",
      workEndTime: "17:00",
      participationRate: 87.5,
      isExempt: false,
      exemptionReason: null,
    };

    const results = executeMidHiresCreate(TEST_COMPANY_ID, [midLine]);
    expect(results).toHaveLength(1);

    const contractId = results[0].id;
    const assignments = db
      .select()
      .from(contractEmployees)
      .where(eq(contractEmployees.contractId, contractId))
      .all();

    expect(assignments).toHaveLength(1);
    expect(assignments[0].individualStartDate).toBe(MID_START);
    expect(assignments[0].individualEndDate).toBe(MID_END);
    expect(assignments[0].isIndefinite).toBe(false);
  });
});
