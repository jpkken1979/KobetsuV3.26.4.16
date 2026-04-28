// Rutas HTTP para importación de fábricas — lógica de negocio en import-factories-service.ts
import { Hono } from "hono";
import { z } from "zod";
import {
  importFactories,
  diffFactories,
} from "../services/import-factories-service.js";

export const importFactoriesRouter = new Hono();

/**
 * POST /api/import/factories — Import factories from parsed TBKaisha Excel data
 *
 * Column mapping from TBKaisha sheet:
 *   会社名 → resolve companyId
 *   工場名 → factoryName
 *   部署 → department
 *   ライン名 → lineName
 *   住所 → address
 *   TEL → phone
 *   ... (see full mapping in import-factories-service.ts)
 *
 * Upsert: match by (companyId, factoryName, department, lineName)
 */
const factoryImportSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())).min(1, "No data provided").max(5000, "Import exceeds maximum of 5,000 rows"),
  mode: z.enum(["upsert", "skip"]).default("upsert"),
  deleteIds: z.array(z.number().int().positive()).default([]),
  /** Auto-delete factory rows NOT in the Excel (for companies present in the import).
   *  Only deletes rows with 0 employees and 0 contracts.
   *  Safe: always skips protected rows regardless of this flag. */
  deleteMissing: z.boolean().default(false),
  companyData: z.array(z.record(z.string(), z.unknown())).default([]),
  enrichCompanies: z.boolean().default(false),
});

importFactoriesRouter.post("/factories", async (c) => {
  const raw = await c.req.json().catch(() => null);
  if (!raw) return c.json({ error: "Invalid JSON body" }, 400);
  const parsed = factoryImportSchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
  const { data: rows, mode, deleteIds, deleteMissing, companyData: rawCompanyData, enrichCompanies } = parsed.data;

  try {
    const result = await importFactories(rows, mode, deleteIds, rawCompanyData, enrichCompanies, deleteMissing);

    return c.json({
      success: true,
      summary: {
        total: rows.length,
        inserted: result.inserted,
        updated: result.updated,
        deleted: result.deleted,
        skipped: result.skipped,
        errors: result.errors.length,
        warnings: result.warnings.length,
        companiesUpdated: result.companiesUpdated,
      },
      errors: result.errors.slice(0, 20),
      warnings: result.warnings.slice(0, 20),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});

// POST /api/import/factories/diff — Compare Excel data with DB
const diffSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())).min(1, "No data provided"),
});

importFactoriesRouter.post("/factories/diff", async (c) => {
  const raw = await c.req.json().catch(() => null);
  if (!raw) return c.json({ error: "Invalid JSON body" }, 400);
  const parsed = diffSchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
  const { data: rows } = parsed.data;

  try {
    const result = await diffFactories(rows);
    return c.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});
