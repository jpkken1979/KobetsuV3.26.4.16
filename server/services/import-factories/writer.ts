/**
 * Database write operations for factory import.
 * Wraps the sqlite transaction and all write logic.
 */
import { db, sqlite } from "../../db/index.js";
import {
  factories,
  clientCompanies,
  employees,
  contracts,
  auditLog,
} from "../../db/schema.js";
import { eq, count } from "drizzle-orm";
import { normalizeImportRow, normalizeCompanyName } from "../import-utils.js";
import { factoryKey, relaxedKey, buildFactoryData, buildCompanyInfo } from "./parser.js";
import { validateFactory, DIFF_FIELDS } from "./validator.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FactoryImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  deleted: number;
  errors: string[];
  warnings: string[];
  companiesUpdated: number;
}

export interface FactoryDiffInsert {
  company: string;
  factory: string;
  dept: string | null;
  line: string | null;
}

export interface FactoryDiffUpdate {
  factoryId: number;
  company: string;
  factory: string;
  dept: string | null;
  line: string | null;
  changes: Record<string, { old: unknown; new: unknown }>;
}

export interface FactoryDiffMissing {
  factoryId: number;
  company: string;
  companyId: number;
  factory: string;
  dept: string | null;
  line: string | null;
}

export interface FactoryDiffResult {
  inserts: FactoryDiffInsert[];
  updates: FactoryDiffUpdate[];
  unchanged: number;
  missing: FactoryDiffMissing[];
  companyErrors: string[];
}

type DbFactory = {
  id: number;
  companyId: number;
  factoryName: string;
  department: string | null;
  lineName: string | null;
  [key: string]: unknown;
};

// ─── Factory maps ─────────────────────────────────────────────────────────────

interface FactoryMaps {
  existingMap: Map<string, number>;
  relaxedMap: Map<string, number[]>;
}

function buildFactoryMaps(allFactories: DbFactory[]): FactoryMaps {
  const existingMap = new Map<string, number>();
  const relaxedMap = new Map<string, number[]>();

  for (const f of allFactories) {
    existingMap.set(
      factoryKey(f.companyId, f.factoryName, f.department ?? "", f.lineName ?? ""),
      f.id,
    );
    const rk = relaxedKey(f.companyId, f.factoryName, f.lineName ?? "");
    if (!relaxedMap.has(rk)) relaxedMap.set(rk, []);
    relaxedMap.get(rk)!.push(f.id);
  }

  return { existingMap, relaxedMap };
}

// ─── Company resolution ──────────────────────────────────────────────────────

interface CompanyInfo {
  address: string | null;
  phone: string | null;
  representative: string | null;
  nameKana: string | null;
  shortName: string | null;
}

export function resolveOrCreateCompany(
  normalizedCompany: string,
  rawCompany: string,
  companyMap: Map<string, number>,
  companyInfoMap: Map<string, CompanyInfo>,
): number | null {
  let companyId = companyMap.get(normalizedCompany) ?? null;

  if (!companyId) {
    for (const [name, id] of companyMap) {
      if (
        name.includes(normalizedCompany) ||
        normalizedCompany.includes(name) ||
        name.includes(rawCompany) ||
        rawCompany.includes(name)
      ) {
        companyId = id;
        break;
      }
    }
  }

  if (!companyId) {
    const companyInfo = companyInfoMap.get(normalizedCompany);
    const created = db.insert(clientCompanies).values({
      name: normalizedCompany,
      shortName: companyInfo?.shortName || (() => {
        const short = normalizedCompany.replace(/株式会社|有限合伙|合同会社/g, "").trim();
        return short.length > 0 ? short : null;
      })(),
      nameKana: companyInfo?.nameKana ?? null,
      address: companyInfo?.address ?? null,
      phone: companyInfo?.phone ?? null,
      representative: companyInfo?.representative ?? null,
      isActive: true,
    }).returning().get();

    companyId = created.id;
    companyMap.set(created.name, created.id);
    if (created.shortName) companyMap.set(created.shortName, created.id);
  }

  return companyId;
}

// ─── Main import ─────────────────────────────────────────────────────────────

export async function importFactories(
  rows: Record<string, unknown>[],
  mode: "upsert" | "skip",
  deleteIds: number[],
  rawCompanyData: Record<string, unknown>[],
): Promise<FactoryImportResult> {
  // Build company info map from Sheet 2 (企業情報)
  const companyInfoMap = new Map<string, CompanyInfo>();
  for (const rawRow of rawCompanyData) {
    const row = normalizeImportRow(rawRow);
    const rawName = String(row["会社名"] || row.name || "").trim();
    if (!rawName) continue;
    const name = normalizeCompanyName(rawName);
    companyInfoMap.set(name, buildCompanyInfo(row));
  }

  // Preload company map
  const allCompanies = await db.query.clientCompanies.findMany();
  const companyMap = new Map<string, number>();
  for (const co of allCompanies) {
    companyMap.set(co.name, co.id);
    if (co.shortName) companyMap.set(co.shortName, co.id);
  }

  // Preload existing factories
  const allFactories = await db.query.factories.findMany();
  const { existingMap, relaxedMap } = buildFactoryMaps(allFactories as DbFactory[]);

  return sqlite.transaction((): FactoryImportResult => {
    let txInserted = 0;
    let txUpdated = 0;
    let txSkipped = 0;
    const txErrors: string[] = [];
    const txWarnings: string[] = [];

    for (const rawRow of rows) {
      const row = normalizeImportRow(rawRow);
      const rowFactoryName = String(row["工場名"] || row.factoryName || "?").trim() || "?";

      try {
        const rawCompany = String(row["会社名"] || row.companyName || "").trim();
        if (!rawCompany) { txSkipped++; continue; }

        const normalizedCompany = normalizeCompanyName(rawCompany);
        const companyId = resolveOrCreateCompany(
          normalizedCompany,
          rawCompany,
          companyMap,
          companyInfoMap,
        );
        if (!companyId) { txSkipped++; continue; }

        const factoryName = String(row["工場名"] || row.factoryName || "").trim();
        if (!factoryName) { txSkipped++; continue; }

        const factoryData = buildFactoryData(row, companyId);

        // Validation warnings
        const validationWarnings = validateFactory(factoryData);
        if (validationWarnings.length > 0) {
          txWarnings.push(...validationWarnings.map((w) => w.message));
        }

        const department = factoryData.department ?? "";
        const lineName = factoryData.lineName ?? "";

        // Upsert: strict match first, then relaxed
        const key = factoryKey(companyId, factoryName, department, lineName);
        let matchedId = existingMap.get(key);

        if (!matchedId) {
          const rk = relaxedKey(companyId, factoryName, lineName);
          const candidates = relaxedMap.get(rk);
          if (candidates && candidates.length === 1) matchedId = candidates[0];
        }

        if (matchedId) {
          if (mode === "skip") { txSkipped++; continue; }

          // Only update fields with actual values — never overwrite with null/empty
          const { companyId: _c, ...allFields } = factoryData;
          const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };
          for (const [k, v] of Object.entries(allFields)) {
            if (k === "updatedAt" || k === "isActive") continue;
            if (v !== null && v !== undefined && v !== "") {
              updateData[k] = v;
            }
          }
          if (Object.keys(updateData).length > 1) {
            db.update(factories).set(updateData).where(eq(factories.id, matchedId)).run();
          }
          txUpdated++;
        } else {
          db.insert(factories).values(factoryData).run();
          txInserted++;
          existingMap.set(key, -1);
          const rk = relaxedKey(companyId, factoryName, lineName);
          if (!relaxedMap.has(rk)) relaxedMap.set(rk, []);
          relaxedMap.get(rk)!.push(-1);
        }
      } catch (err: unknown) {
        txErrors.push(
          `Row ${rowFactoryName}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Delete factories selected by the user
    let txDeleted = 0;
    for (const id of deleteIds) {
      if (typeof id === "number" && id > 0) {
        const empCount = db.select({ c: count() }).from(employees).where(eq(employees.factoryId, id)).get();
        const conCount = db.select({ c: count() }).from(contracts).where(eq(contracts.factoryId, id)).get();
        if ((empCount?.c ?? 0) > 0 || (conCount?.c ?? 0) > 0) {
          txErrors.push(
            `Factory ID ${id}: 社員(${empCount?.c ?? 0})または契約(${conCount?.c ?? 0})が存在するため削除できません`,
          );
          continue;
        }
        db.delete(factories).where(eq(factories.id, id)).run();
        txDeleted++;
      }
    }

    // Enrich companies with empty fields from Sheet 2
    let txCompaniesUpdated = 0;
    if (companyInfoMap.size > 0) {
      const currentCompanies = db.select().from(clientCompanies).all();
      for (const co of currentCompanies) {
        const info = companyInfoMap.get(co.name);
        if (!info) continue;
        const updates: Record<string, unknown> = {};
        if (!co.address && info.address) updates.address = info.address;
        if (!co.phone && info.phone) updates.phone = info.phone;
        if (!co.representative && info.representative) updates.representative = info.representative;
        if (!co.nameKana && info.nameKana) updates.nameKana = info.nameKana;
        if (!co.shortName && info.shortName) updates.shortName = info.shortName;
        if (Object.keys(updates).length > 0) {
          updates.updatedAt = new Date().toISOString();
          db.update(clientCompanies).set(updates).where(eq(clientCompanies.id, co.id)).run();
          txCompaniesUpdated++;
        }
      }
    }

    db.insert(auditLog)
      .values({
        action: "import",
        entityType: "factory",
        detail:
          `Excel import: ${txInserted} inserted, ${txUpdated} updated, ${txDeleted} deleted, ${txSkipped} skipped, ${txErrors.length} errors` +
          (txCompaniesUpdated > 0 ? `, ${txCompaniesUpdated} companies enriched` : ""),
        userName: "import",
      })
      .run();

    return {
      inserted: txInserted,
      updated: txUpdated,
      skipped: txSkipped,
      deleted: txDeleted,
      errors: txErrors,
      warnings: txWarnings,
      companiesUpdated: txCompaniesUpdated,
    };
  })();
}

// ─── Diff ─────────────────────────────────────────────────────────────────────

export async function diffFactories(
  rows: Record<string, unknown>[],
): Promise<FactoryDiffResult> {
  const allCompanies = await db.query.clientCompanies.findMany();
  const companyMap = new Map<string, number>();
  const companyNameById = new Map<number, string>();
  for (const co of allCompanies) {
    companyMap.set(co.name, co.id);
    if (co.shortName) companyMap.set(co.shortName, co.id);
    companyNameById.set(co.id, co.name);
  }

  const allFactories = await db.query.factories.findMany();
  const { existingMap, relaxedMap } = buildFactoryMaps(allFactories as DbFactory[]);
  const factoryById = new Map<number, DbFactory>();
  for (const f of allFactories) {
    factoryById.set(f.id, f as DbFactory);
  }

  const parseNum = (v: unknown) => {
    const n = parseFloat(String(v));
    return Number.isNaN(n) ? null : n;
  };
  const s = (v: unknown) => {
    const val = String(v || "").trim();
    return val || null;
  };

  const inserts: FactoryDiffInsert[] = [];
  const updates: FactoryDiffUpdate[] = [];
  let unchanged = 0;
  const matchedIds = new Set<number>();
  const excelCompanyIds = new Set<number>();

  for (const rawRow of rows) {
    const row = normalizeImportRow(rawRow);
    const rawCompany = String(row["会社名"] || "").trim();
    if (!rawCompany) continue;

    const normalizedCompany = normalizeCompanyName(rawCompany);
    let companyId = companyMap.get(normalizedCompany) ?? null;
    if (!companyId) {
      for (const [name, id] of companyMap) {
        if (
          name.includes(normalizedCompany) ||
          normalizedCompany.includes(name) ||
          name.includes(rawCompany) ||
          rawCompany.includes(name)
        ) {
          companyId = id;
          break;
        }
      }
    }

    const factoryName = String(row["工場名"] || "").trim();
    if (!factoryName) continue;

    const department = s(row["部署"]);
    const lineName = s(row["ライン名"]);

    let matchedId: number | undefined;
    if (companyId) {
      excelCompanyIds.add(companyId);
      const key = factoryKey(companyId, factoryName, department ?? "", lineName ?? "");
      matchedId = existingMap.get(key);
      if (!matchedId) {
        const rk = relaxedKey(companyId, factoryName, lineName ?? "");
        const candidates = relaxedMap.get(rk);
        if (candidates && candidates.length === 1) matchedId = candidates[0];
      }
    }

    if (matchedId) {
      matchedIds.add(matchedId);
      const existing = factoryById.get(matchedId);
      if (!existing) continue;

      const changes: Record<string, { old: unknown; new: unknown }> = {};
      for (const field of DIFF_FIELDS) {
        const dbVal = existing[field.key];
        let excelVal: unknown;

        if (field.key === "hourlyRate") {
          excelVal = parseNum(row[field.excelKey]);
        } else if (field.key === "breakTime") {
          const raw = row[field.excelKey];
          excelVal = raw != null && raw !== "" ? parseInt(String(raw), 10) : null;
          if (Number.isNaN(excelVal as number)) excelVal = null;
        } else if (field.key === "hasRobotTraining") {
          const raw = row[field.excelKey];
          if (raw == null || raw === "") {
            excelVal = null;
          } else {
            const val = String(raw).trim().toLowerCase();
            excelVal = val === "1" || val === "true" || val === "○";
          }
        } else {
          excelVal = s(row[field.excelKey]);
        }

        const dbNorm = dbVal == null || dbVal === "" ? null : dbVal;
        const exNorm = excelVal == null || excelVal === "" ? null : excelVal;
        if (String(dbNorm ?? "") !== String(exNorm ?? "")) {
          changes[field.label] = { old: dbNorm, new: exNorm };
        }
      }

      if (Object.keys(changes).length > 0) {
        updates.push({
          factoryId: matchedId,
          company: companyId ? (companyNameById.get(companyId) ?? normalizedCompany) : normalizedCompany,
          factory: factoryName,
          dept: department,
          line: lineName,
          changes,
        });
      } else {
        unchanged++;
      }
    } else {
      inserts.push({
        company: companyId ? (companyNameById.get(companyId) ?? normalizedCompany) : normalizedCompany,
        factory: factoryName,
        dept: department,
        line: lineName,
      });
    }
  }

  // Factories in DB but absent from Excel (only for companies present in the Excel)
  const missing: FactoryDiffMissing[] = [];
  for (const f of allFactories) {
    if (excelCompanyIds.has(f.companyId) && !matchedIds.has(f.id)) {
      missing.push({
        factoryId: f.id,
        company: companyNameById.get(f.companyId) ?? "",
        companyId: f.companyId,
        factory: f.factoryName,
        dept: f.department,
        line: f.lineName,
      });
    }
  }

  return { inserts, updates, unchanged, missing, companyErrors: [] };
}