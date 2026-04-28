// Batch contract creation endpoints — extracted from contracts.ts
// Business logic lives in server/services/batch-contracts.ts
import { Hono } from "hono";
import { z } from "zod";
import { toLocalDateStr } from "../services/contract-dates.js";
import {
  analyzeBatch,
  analyzeNewHires,
  analyzeMidHires,
  analyzeSmartBatch,
  groupEmployeesByIds,
  executeBatchCreate,
  executeNewHiresCreate,
  executeMidHiresCreate,
  executeIndividualBatchCreate,
  executeByLineCreate,
  executeSmartBatch,
} from "../services/batch-contracts.js";

// Re-export types used by other route files (documents-generate.ts)
export type { ByIdsGroup } from "../services/batch-contracts.js";
export { groupEmployeesByIds } from "../services/batch-contracts.js";

export const contractsBatchRouter = new Hono();

// ── Schemas ─────────────────────────────────────────────────────────

const batchPreviewSchema = z.object({
  companyId: z.number().int().positive(),
  factoryIds: z.array(z.number().int().positive()).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const batchSchema = z.object({
  companyId: z.number().int().positive(),
  factoryIds: z.array(z.number().int().positive()).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  generatePdf: z.boolean().optional(),
});

const newHiresSchema = z.object({
  companyId: z.number().int().positive(),
  factoryIds: z.array(z.number().int().positive()).optional(),
  hireDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hireDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  generateDocs: z.boolean().optional(),
});

const midHiresSchema = z.object({
  companyId: z.number().int().positive(),
  factoryIds: z.array(z.number().int().positive()).optional(),
  conflictDateOverrides: z.record(
    z.string(),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
  ).optional(),
  startDateOverride: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  generateDocs: z.boolean().optional(),
});

const previewByIdsSchema = z.object({
  ids: z.array(z.string().min(1)),
  idType: z.enum(["hakensaki", "hakenmoto"]),
  contractStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "contractStart must be YYYY-MM-DD"),
  contractEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "contractEnd must be YYYY-MM-DD"),
});

const individualBatchSchema = z
  .object({
    companyId: z.number().int().positive(),
    factoryId: z.number().int().positive(),
    // Modern: employeeAssignments con info por empleado (preferido).
    // Legacy: employeeIds plano (deprecated, queda para back-compat).
    employeeIds: z.array(z.number().int().positive()).optional(),
    employeeAssignments: z
      .array(z.object({ employeeId: z.number().int().positive() }))
      .optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    billingRate: z.number().int().positive().optional(),
    generateDocs: z.boolean().optional(),
  })
  .refine(
    (d) =>
      (d.employeeAssignments && d.employeeAssignments.length > 0) ||
      (d.employeeIds && d.employeeIds.length > 0),
    { message: "At least 1 employee required (employeeAssignments or employeeIds)" },
  );

const byLineSchema = z.object({
  companyId: z.number().int().positive(),
  factoryId: z.number().int().positive(),
  employees: z.array(z.object({
    employeeId: z.number().int().positive(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD"),
  })).min(1, "At least 1 employee required"),
  generatePdf: z.boolean().optional(),
});

const smartBatchSchema = z.object({
  companyId: z.number().int().positive(),
  factoryIds: z.array(z.number().int().positive()).optional(),
  globalStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "globalStartDate must be YYYY-MM-DD"),
  globalEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "globalEndDate must be YYYY-MM-DD"),
  generateDocs: z.boolean().optional(),
});

// ── POST /api/contracts/batch/preview ───────────────────────────────

contractsBatchRouter.post("/batch/preview", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = batchPreviewSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

    const { companyId, factoryIds, startDate, endDate } = parsed.data;
    const { lines, skipped } = await analyzeBatch(companyId, factoryIds, startDate, endDate);

    const totalContracts = lines.reduce((sum, l) => sum + l.totalContracts, 0);
    const totalEmployees = lines.reduce((sum, l) => sum + l.totalEmployees, 0);
    const totalDuplicates = lines.reduce((sum, l) => sum + (l.duplicates?.length || 0), 0);

    return c.json({
      preview: true,
      totalContracts,
      totalEmployees,
      totalDuplicates,
      lines: lines.map((l) => ({
        factoryId: l.factory.id,
        factoryName: l.factory.factoryName,
        department: l.factory.department,
        lineName: l.factory.lineName,
        effectiveEndDate: l.effectiveEndDate,
        capped: l.capped,
        autoCalculated: l.autoCalculated,
        contractPeriod: l.contractPeriod,
        conflictDate: l.factory.conflictDate,
        totalEmployees: l.totalEmployees,
        totalContracts: l.totalContracts,
        participationRate: l.participationRate,
        isExempt: l.isExempt,
        exemptionReason: l.exemptionReason,
        rateGroups: l.rateGroups.map((rg) => ({
          rate: rg.rate,
          count: rg.employeeCount,
          overtimeRate: rg.overtimeRate,
          holidayRate: rg.holidayRate,
          employeeNames: rg.employees.map((e) => e.fullName),
        })),
        duplicates: l.duplicates,
      })),
      skipped,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Preview failed";
    return c.json({ error: message }, 500);
  }
});

// ── POST /api/contracts/batch ───────────────────────────────────────

contractsBatchRouter.post("/batch", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = batchSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

    const { companyId, factoryIds, startDate, endDate, generatePdf } = parsed.data;
    const { lines, skipped } = await analyzeBatch(companyId, factoryIds, startDate, endDate);

    const { created, skipped: finalSkipped } = executeBatchCreate(companyId, startDate, lines, skipped);

    return c.json({
      created: created.length,
      skipped: finalSkipped.length,
      contracts: created,
      skippedDetails: finalSkipped,
      contractIds: created.map((cr) => cr.id),
      generatePdf: generatePdf || false,
    }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Batch creation failed";
    return c.json({ error: message }, 500);
  }
});

// ── POST /api/contracts/batch/new-hires/preview ─────────────────────

contractsBatchRouter.post("/batch/new-hires/preview", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = newHiresSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

    const { companyId, factoryIds, hireDateFrom, endDate } = parsed.data;
    const hireDateTo = parsed.data.hireDateTo || toLocalDateStr(new Date());

    const { lines, skipped } = await analyzeNewHires(companyId, factoryIds, hireDateFrom, hireDateTo, endDate);

    const totalContracts = lines.reduce((sum, l) => sum + l.totalContracts, 0);
    const totalEmployees = lines.reduce((sum, l) => sum + l.totalEmployees, 0);

    return c.json({
      preview: true,
      hireDateFrom,
      hireDateTo,
      totalContracts,
      totalEmployees,
      lines: lines.map((l) => ({
        factoryId: l.factory.id,
        factoryName: l.factory.factoryName,
        department: l.factory.department,
        lineName: l.factory.lineName,
        effectiveEndDate: l.effectiveEndDate,
        conflictDate: l.conflictDate,
        totalEmployees: l.totalEmployees,
        totalContracts: l.totalContracts,
        participationRate: l.participationRate,
        isExempt: l.isExempt,
        exemptionReason: l.exemptionReason,
        rateGroups: l.rateGroups.map((rg) => ({
          rate: rg.rate,
          count: rg.employeeCount,
          overtimeRate: rg.overtimeRate,
          holidayRate: rg.holidayRate,
          employees: rg.employees.map((e) => ({
            id: e.id,
            fullName: e.fullName,
            employeeNumber: e.employeeNumber,
            effectiveHireDate: e.effectiveHireDate,
            billingRate: e.billingRate,
            hourlyRate: e.hourlyRate,
            visaExpiry: e.visaExpiry,
            nationality: e.nationality,
          })),
        })),
      })),
      skipped,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Preview failed";
    return c.json({ error: message }, 500);
  }
});

// ── POST /api/contracts/batch/new-hires ─────────────────────────────

contractsBatchRouter.post("/batch/new-hires", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = newHiresSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

    const { companyId, factoryIds, hireDateFrom, endDate, generateDocs } = parsed.data;
    const hireDateTo = parsed.data.hireDateTo || toLocalDateStr(new Date());

    const { lines, skipped } = await analyzeNewHires(companyId, factoryIds, hireDateFrom, hireDateTo, endDate);
    const created = executeNewHiresCreate(companyId, hireDateFrom, hireDateTo, lines);

    return c.json({
      created: created.length,
      skipped: skipped.length,
      contracts: created,
      skippedDetails: skipped,
      contractIds: created.map((cr) => cr.id),
      generateDocs: generateDocs || false,
    }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "New hires batch creation failed";
    return c.json({ error: message }, 500);
  }
});

// ── POST /api/contracts/batch/mid-hires/preview ─────────────────────

contractsBatchRouter.post("/batch/mid-hires/preview", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = midHiresSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

    const { companyId, factoryIds, conflictDateOverrides, startDateOverride } = parsed.data;
    const { lines, skipped } = await analyzeMidHires({
      companyId,
      factoryIds,
      conflictDateOverrides,
      startDateOverride,
    });

    const totalContracts = lines.reduce((sum, l) => sum + l.totalContracts, 0);
    const totalEmployees = lines.reduce((sum, l) => sum + l.totalEmployees, 0);

    return c.json({
      preview: true,
      totalContracts,
      totalEmployees,
      startDateOverride,
      lines: lines.map((l) => ({
        factoryId: l.factory.id,
        factoryName: l.factory.factoryName,
        department: l.factory.department,
        lineName: l.factory.lineName,
        contractStartDate: l.contractStartDate,
        contractEndDate: l.contractEndDate,
        effectiveConflictDate: l.effectiveConflictDate,
        periodStart: l.periodStart,
        totalEmployees: l.totalEmployees,
        totalContracts: l.totalContracts,
        participationRate: l.participationRate,
        isExempt: l.isExempt,
        exemptionReason: l.exemptionReason,
        rateGroups: l.rateGroups.map((rg) => ({
          rate: rg.rate,
          count: rg.employeeCount,
          overtimeRate: rg.overtimeRate,
          holidayRate: rg.holidayRate,
          employees: rg.employees.map((e) => ({
            id: e.id,
            fullName: e.fullName,
            employeeNumber: e.employeeNumber,
            effectiveHireDate: e.effectiveHireDate,
            billingRate: e.billingRate,
            hourlyRate: e.hourlyRate,
            visaExpiry: e.visaExpiry,
            nationality: e.nationality,
          })),
        })),
      })),
      skipped,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Preview failed";
    return c.json({ error: message }, 500);
  }
});

// ── POST /api/contracts/batch/mid-hires ─────────────────────────────

contractsBatchRouter.post("/batch/mid-hires", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = midHiresSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

    const { companyId, factoryIds, conflictDateOverrides, startDateOverride, generateDocs } = parsed.data;
    const { lines, skipped } = await analyzeMidHires({
      companyId,
      factoryIds,
      conflictDateOverrides,
      startDateOverride,
    });

    const created = executeMidHiresCreate(companyId, lines);

    return c.json({
      created: created.length,
      skipped: skipped.length,
      contracts: created,
      skippedDetails: skipped,
      contractIds: created.map((cr) => cr.id),
      generateDocs: generateDocs || false,
    }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Mid-hires batch creation failed";
    return c.json({ error: message }, 500);
  }
});

// ── POST /api/contracts/preview-by-ids ──────────────────────────────

contractsBatchRouter.post("/preview-by-ids", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = previewByIdsSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

    const { ids, idType, contractStart, contractEnd } = parsed.data;
    const { groups, notFoundIds } = await groupEmployeesByIds(ids, idType, contractStart, contractEnd);

    return c.json({
      groups: groups.map((g, i) => ({ ...g, groupIndex: i })),
      notFoundIds,
      totalEmployees: groups.reduce((s, g) => s + g.employees.length, 0),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Preview failed";
    return c.json({ error: message }, 500);
  }
});

// ── POST /api/contracts/batch/individual ──────────────────────────────
// Creates 1 contract PER selected employee — no rate grouping.

contractsBatchRouter.post("/batch/individual", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = individualBatchSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

    const { companyId, factoryId, employeeAssignments, employeeIds, startDate, endDate, billingRate, generateDocs } = parsed.data;

    // Detectar payload legacy: solo employeeIds, sin employeeAssignments.
    const usesLegacyEmployeeIdsPayload = !employeeAssignments && Array.isArray(employeeIds);

    // Resolver IDs efectivos: preferir employeeAssignments, fallback a employeeIds.
    const effectiveIds: number[] = employeeAssignments
      ? employeeAssignments.map((a) => a.employeeId)
      : (employeeIds ?? []);

    const result = executeIndividualBatchCreate({
      companyId,
      factoryId,
      employeeIds: effectiveIds,
      startDate,
      endDate,
      billingRate,
    });

    // Deprecation notice (RFC 7234 Warning + draft Deprecation header)
    if (usesLegacyEmployeeIdsPayload) {
      c.header("Deprecation", "true");
      c.header("Warning", '299 - "employeeIds is deprecated; use employeeAssignments: [{employeeId}] instead"');
    }

    return c.json({
      created: result.length,
      contracts: result,
      contractIds: result.map((r) => r.id),
      generateDocs: generateDocs || false,
    }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Individual batch creation failed";
    return c.json({ error: message }, 500);
  }
});

// ── POST /api/contracts/batch/by-line ────────────────────────────────
// Selección granular: empleados de una sola línea con startDate/endDate
// individuales por persona. El servicio agrupa por (rate, startDate, endDate)
// y crea N contratos en una transacción.

contractsBatchRouter.post("/batch/by-line", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = byLineSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

    const { companyId, factoryId, employees, generatePdf } = parsed.data;

    for (const e of employees) {
      if (e.startDate > e.endDate) {
        return c.json({ error: `社員ID ${e.employeeId}: 開始日が終了日より後です` }, 400);
      }
    }

    const { contracts: created, groups } = executeByLineCreate({
      companyId,
      factoryId,
      employees,
    });

    return c.json({
      created: created.length,
      contracts: created,
      contractIds: created.map((r) => r.id),
      groups,
      generatePdf: generatePdf || false,
    }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "By-line batch creation failed";
    return c.json({ error: message }, 500);
  }
});

// ── POST /api/contracts/batch/smart-by-factory/preview ──────────────
// Smart-batch: ikkatsu por fábrica con auto-clasificación 継続/途中入社者.
// Devuelve el detalle por factory para que la UI muestre quién entra como
// continuación, quién como mid-hire, y quién se descarta (future-skip).

contractsBatchRouter.post("/batch/smart-by-factory/preview", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = smartBatchSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

    const { companyId, factoryIds, globalStartDate, globalEndDate } = parsed.data;
    if (globalStartDate > globalEndDate) {
      return c.json({ error: "開始日が終了日より後です" }, 400);
    }

    const { lines, skipped } = await analyzeSmartBatch({
      companyId,
      factoryIds,
      globalStartDate,
      globalEndDate,
    });

    const totalContracts = lines.reduce((s, l) => s + l.estimatedContracts, 0);
    const totalContinuation = lines.reduce((s, l) => s + l.continuation.length, 0);
    const totalMidHires = lines.reduce((s, l) => s + l.midHires.length, 0);
    const totalFutureSkip = lines.reduce((s, l) => s + l.futureSkip.length, 0);

    return c.json({
      lines,
      skipped,
      totals: {
        contracts: totalContracts,
        continuation: totalContinuation,
        midHires: totalMidHires,
        futureSkip: totalFutureSkip,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Smart-batch preview failed";
    return c.json({ error: message }, 500);
  }
});

// ── POST /api/contracts/batch/smart-by-factory ──────────────────────
// Crea los contratos a partir del análisis. Re-corre analyzeSmartBatch
// (no aceptamos el preview del cliente para evitar drift de estado)
// y delega a executeSmartBatch.

contractsBatchRouter.post("/batch/smart-by-factory", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = smartBatchSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

    const { companyId, factoryIds, globalStartDate, globalEndDate, generateDocs } = parsed.data;
    if (globalStartDate > globalEndDate) {
      return c.json({ error: "開始日が終了日より後です" }, 400);
    }

    const { lines, skipped } = await analyzeSmartBatch({
      companyId,
      factoryIds,
      globalStartDate,
      globalEndDate,
    });

    const result = executeSmartBatch(lines);

    return c.json({
      created: result.contracts.length,
      contracts: result.contracts,
      contractIds: result.contractIds,
      perFactory: result.perFactory,
      skippedDetails: skipped,
      generateDocs: generateDocs || false,
    }, 201);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Smart-batch creation failed";
    return c.json({ error: message }, 500);
  }
});
