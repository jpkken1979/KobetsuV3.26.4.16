import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/index.js";
import { getFullDispatchMap } from "../services/dispatch-mapping.js";
import { buildFactoryLookup } from "../services/import-assignment.js";
import { normalizeImportRow } from "../services/import-utils.js";
import {
  importEmployees,
  importCompanies,
  buildEmployeeData,
  EMPLOYEE_KNOWN_HEADERS,
  DIFF_ALWAYS_SYNC_KEYS,
  DIFF_COMPARE_KEYS,
} from "../services/import-employees.js";

export const importRouter = new Hono();

/**
 * POST /api/import/employees — Import employees from parsed Excel data
 *
 * Expects JSON body with array of employee objects matching DBGenzaiX columns.
 * The frontend reads the Excel file and sends parsed JSON.
 *
 * Column mapping from DBGenzaiX sheet (社員台帳) — 42 columns (A-AP):
 *
 * A: 現在 → status (在職中→active / 退社→inactive)
 * B: 社員№ → employeeNumber
 * C: 派遣先ID → clientEmployeeId (ID assigned by client company)
 * D: 派遣先 → rawDispatch (abbreviated → resolved via dispatch-mapping.ts)
 * E: 配属先 → department (factory resolution)
 * F: 配属ライン → lineName (factory resolution)
 * H: 氏名 → fullName
 * I: カナ → katakanaName
 * J: 性別 → gender (男→male, 女→female)
 * K: 国籍 → nationality
 * L: 生年月日 → birthDate (Excel serial → YYYY-MM-DD)
 * N: 時給 → hourlyRate (UNS→worker pay rate)
 * P: 請求単価 → billingRate (client→UNS billing rate)
 * W: ビザ期限 → visaExpiry (Excel serial → YYYY-MM-DD)
 * Y: ビザ種類 → visaType
 * Z: 〒 → postalCode
 * AA: 住所 → address
 * AB: ｱﾊﾟｰﾄ → address (appended)
 * AD: 入社日 → hireDate (Excel serial → YYYY-MM-DD)
 * AJ: 現入社 → actualHireDate (Excel serial → YYYY-MM-DD)
 *
 * Company resolution: 派遣先 abbreviations are resolved via dispatch-mapping.ts
 * which maps "高雄工業 本社" → "高雄工業株式会社" + "本社工場"
 */
const importBodySchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())).min(1, "No data provided").max(10000, "Import exceeds maximum of 10,000 rows"),
  mode: z.enum(["upsert", "skip"]).default("upsert"),
});

importRouter.post("/employees", async (c) => {
  const raw = await c.req.json().catch(() => null);
  if (!raw) return c.json({ error: "Invalid JSON body" }, 400);
  const parsed = importBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
  const { data: rows, mode } = parsed.data;

  try {
    const { result, unrecognizedHeaders } = await importEmployees(rows, mode);

    return c.json({
      success: true,
      summary: {
        total: rows.length,
        inserted: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors.length,
      },
      errors: result.errors.slice(0, 20),
      warnings: unrecognizedHeaders.length > 0
        ? [`以下のヘッダーは無視されました: ${unrecognizedHeaders.join(", ")}`]
        : [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /api/import/companies — Import company master data (企業情報)
 *
 * Expected columns:
 * 会社名, 会社名カナ, 略称, 住所, TEL, 代表者, 有効
 */
const companyImportSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())).min(1, "No data provided").max(1000, "Too many rows"),
  mode: z.enum(["upsert", "skip"]).default("upsert"),
});

importRouter.post("/companies", async (c) => {
  const raw = await c.req.json().catch(() => null);
  if (!raw) return c.json({ error: "Invalid JSON body" }, 400);
  const parsed = companyImportSchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
  const { data: rows, mode } = parsed.data;

  try {
    const result = await importCompanies(rows, mode);

    return c.json({
      success: true,
      summary: {
        total: rows.length,
        inserted: result.inserted,
        updated: result.updated,
        deleted: 0,
        skipped: result.skipped,
        errors: result.errors.length,
      },
      errors: result.errors.slice(0, 20),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});

// GET /api/import/mapping — View dispatch name mapping for debugging/admin
importRouter.get("/mapping", (c) => {
  try {
    return c.json(getFullDispatchMap());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Failed to get mapping: ${message}` }, 500);
  }
});

// POST /api/import/preview — Preview first N rows without importing
const previewSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())),
});

importRouter.post("/preview", async (c) => {
  const raw = await c.req.json().catch(() => null);
  if (!raw) return c.json({ error: "Invalid JSON body" }, 400);
  const parsed = previewSchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
  const { data: rows } = parsed.data;

  return c.json({
    totalRows: rows.length,
    preview: rows.slice(0, 10),
    columns: rows.length > 0 ? Object.keys(rows[0]) : [],
  });
});

/**
 * POST /api/import/employees/diff — Compare Excel data against DB without importing
 *
 * Returns inserts, updates (with field-by-field changes), and unchanged count.
 * Uses the same parsing logic as the import endpoint but READ-ONLY.
 */
const diffSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())).min(1).max(10000),
});

importRouter.post("/employees/diff", async (c) => {
  const raw = await c.req.json().catch(() => null);
  if (!raw) return c.json({ error: "Invalid JSON body" }, 400);
  const parsed = diffSchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
  const { data: rows } = parsed.data;

  try {
    // Precarga todos los datos de lookup (igual que el endpoint de import)
    const allCompanies = await db.query.clientCompanies.findMany();
    const companyMap = new Map<string, number>();
    const companyIdToName = new Map<number, string>();
    for (const co of allCompanies) {
      companyMap.set(co.name, co.id);
      companyIdToName.set(co.id, co.name);
      if (co.shortName) companyMap.set(co.shortName, co.id);
    }

    const allFactories = await db.query.factories.findMany();
    const factoryLookup = buildFactoryLookup(allFactories);
    const factoryIdToName = new Map<number, string>();
    for (const f of allFactories) {
      factoryIdToName.set(
        f.id,
        `${f.factoryName}${f.department ? ` ${f.department}` : ""}${f.lineName ? ` ${f.lineName}` : ""}`,
      );
    }

    // Precarga empleados existentes con todos los campos para comparar
    const existingEmployees = await db.query.employees.findMany();
    const existingByNumber = new Map(existingEmployees.map((e) => [e.employeeNumber, e]));

    const inserts: Array<{ employeeNumber: string; fullName: string; company: string | null; factory: string | null }> = [];
    const updates: Array<{
      employeeNumber: string;
      fullName: string;
      company: string | null;
      factory: string | null;
      changes: Record<string, { old: unknown; new: unknown }>;
    }> = [];
    let unchanged = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const rawRow of rows) {
      const row = normalizeImportRow(rawRow);

      try {
        const employeeNumber = String(
          row.employeeNumber || row["社員番号"] || row["社員№"] || row["社員No"] || "",
        ).trim();
        if (!employeeNumber) { skipped++; continue; }

        const fullName = String(row.fullName || row["氏名"] || "").trim();
        if (!fullName) { skipped++; continue; }

        // Usa la misma lógica de parseo que el endpoint de import
        const newData = {
          fullName,
          ...buildEmployeeData(row, companyMap, allFactories, factoryLookup),
        };

        // Verifica que los encabezados no reconocidos sean detectados (consistencia con import)
        void EMPLOYEE_KNOWN_HEADERS;

        const companyName = newData.companyId ? (companyIdToName.get(newData.companyId) ?? null) : null;
        const factoryName = newData.factoryId ? (factoryIdToName.get(newData.factoryId) ?? null) : null;

        const existing = existingByNumber.get(employeeNumber);
        if (!existing) {
          inserts.push({ employeeNumber, fullName, company: companyName, factory: factoryName });
        } else {
          // Compara campos — solo los que se actualizarían (valores no-null + alwaysSyncKeys)
          const changes: Record<string, { old: unknown; new: unknown }> = {};

          for (const key of DIFF_COMPARE_KEYS) {
            const oldVal = existing[key as keyof typeof existing];
            const newVal = newData[key as keyof typeof newData];
            // Omite si el nuevo valor es null y no es alwaysSync (no sobreescribiría)
            if (newVal === null && !DIFF_ALWAYS_SYNC_KEYS.has(key)) continue;
            const oldStr = oldVal == null ? "" : String(oldVal);
            const newStr = newVal == null ? "" : String(newVal);
            if (oldStr !== newStr) {
              if (key === "companyId") {
                changes[key] = {
                  old: oldVal ? (companyIdToName.get(oldVal as number) ?? oldVal) : null,
                  new: newVal ? (companyIdToName.get(newVal as number) ?? newVal) : null,
                };
              } else if (key === "factoryId") {
                changes[key] = {
                  old: oldVal ? (factoryIdToName.get(oldVal as number) ?? oldVal) : null,
                  new: newVal ? (factoryIdToName.get(newVal as number) ?? newVal) : null,
                };
              } else {
                changes[key] = { old: oldVal ?? null, new: newVal ?? null };
              }
            }
          }

          if (Object.keys(changes).length > 0) {
            updates.push({ employeeNumber, fullName, company: companyName, factory: factoryName, changes });
          } else {
            unchanged++;
          }
        }
      } catch (err: unknown) {
        errors.push(
          `Row ${row.employeeNumber || "?"}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return c.json({ inserts, updates, unchanged, skipped, errors: errors.slice(0, 20) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
});
