// Batch contract creation endpoints — extracted from contracts.ts
// Business logic lives in server/services/batch-contracts.ts
import { Hono } from "hono";
import { z } from "zod";
import { toLocalDateStr } from "../services/contract-dates.js";
import {
  analyzeBatch,
  analyzeNewHires,
  analyzeMidHires,
  groupEmployeesByIds,
  executeBatchCreate,
  executeNewHiresCreate,
  executeMidHiresCreate,
  executeIndividualBatchCreate,
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

const individualBatchSchema = z.object({
  companyId: z.number().int().positive(),
  factoryId: z.number().int().positive(),
  employeeIds: z.array(z.number().int().positive()).min(1, "At least 1 employee required"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  billingRate: z.number().int().positive().optional(),
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

    const { companyId, factoryId, employeeIds, startDate, endDate, billingRate, generateDocs } = parsed.data;
    const result = executeIndividualBatchCreate({ companyId, factoryId, employeeIds, startDate, endDate, billingRate });

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
