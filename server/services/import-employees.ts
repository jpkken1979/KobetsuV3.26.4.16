// Lógica de negocio para importación de empleados desde Excel
import { db, sqlite } from "../db/index.js";
import { employees, clientCompanies, auditLog } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { resolveDispatch } from "./dispatch-mapping.js";
import { buildFactoryLookup, resolveFactoryAssignment } from "./import-assignment.js";
import {
  normalizeImportRow,
  normalizeCompanyName,
  deriveShortCompanyName,
  excelSerialToDate,
  parseRate,
  normalizePlacement,
} from "./import-utils.js";
import { parseHaizokusaki } from "./koritsu-pdf-parser.js";
import { createAutoBackup } from "./backup.js";

// Todos los encabezados de columna que el importador de empleados reconoce
export const EMPLOYEE_KNOWN_HEADERS = new Set([
  "社員№", "社員番号", "社員No", "employeeNumber",
  "氏名", "fullName",
  "カナ", "フリガナ", "katakanaName",
  "現在", "status",
  "派遣先", "companyName",
  "性別", "gender",
  "国籍", "nationality",
  "住所", "address", "アパート", "ｱﾊﾟｰﾄ", "apartment",
  "配属先", "department", "配属ライン", "ライン", "lineName",
  "派遣先ID", "clientEmployeeId",
  "時給", "hourlyRate", "請求単価", "単価", "基本給", "billingRate",
  "入社日", "hireDate", "現入社", "配属日", "actualHireDate",
  "ビザ期限", "visaExpiry", "ビザ種類", "visaType",
  "〒", "郵便番号", "postalCode",
  "生年月日", "birthDate",
  "備考", "notes",
]);

export interface EmployeeImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface CompanyImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// Claves que siempre se sincronizan, incluso si el valor es null
const ALWAYS_SYNC_KEYS = new Set([
  "updatedAt", "employeeNumber", "companyId", "factoryId", "clientEmployeeId", "status",
]);

/**
 * Resuelve el companyId a partir del nombre de despacho crudo, usando
 * el mapa de empresas precargado. Devuelve { companyId, resolvedFactoryName }.
 */
function resolveCompanyFromDispatch(
  rawDispatch: string,
  companyMap: Map<string, number>,
): { companyId: number | null; resolvedFactoryName: string | null } {
  if (!rawDispatch) return { companyId: null, resolvedFactoryName: null };

  const resolution = resolveDispatch(rawDispatch);
  const fullCompanyName = resolution.companyName;
  const resolvedFactoryName = resolution.factoryName;

  let companyId = companyMap.get(fullCompanyName) ?? null;

  if (!companyId) {
    for (const [name, id] of companyMap) {
      if (
        name.includes(fullCompanyName) ||
        fullCompanyName.includes(name) ||
        name.includes(rawDispatch) ||
        rawDispatch.includes(name)
      ) {
        companyId = id;
        break;
      }
    }
  }

  return { companyId, resolvedFactoryName };
}

/**
 * Normaliza la nacionalidad convirtiendo katakana de media anchura a completa.
 */
function normalizeNationality(raw: string): string {
  return raw
    .replace(/ﾍﾞﾄﾅﾑ/g, "ベトナム")
    .replace(/ﾌｨﾘﾋﾟﾝ/g, "フィリピン")
    .replace(/ｲﾝﾄﾞﾈｼｱ/g, "インドネシア")
    .replace(/ﾐｬﾝﾏｰ/g, "ミャンマー")
    .replace(/ﾗｵｽ/g, "ラオス")
    .replace(/ﾌﾞﾗｼﾞﾙ/g, "ブラジル")
    .replace(/ﾍﾟﾙｰ/g, "ペルー");
}

/**
 * Construye el objeto de datos de empleado a partir de una fila normalizada.
 * Centraliza toda la lógica de parseo de campos para evitar duplicación entre
 * el endpoint de importación y el endpoint de diff.
 */
export function buildEmployeeData(
  row: Record<string, unknown>,
  companyMap: Map<string, number>,
  allFactories: ReturnType<typeof buildFactoryLookup> extends Map<string, number>
    ? Array<{ id: number; companyId: number; factoryName: string; department: string | null; lineName: string | null }>
    : never,
  factoryLookup: Map<string, number>,
) {
  const rawStatus = String(row.status || row["現在"] || "").trim();
  const status: "active" | "inactive" | "onLeave" =
    rawStatus === "退社" ? "inactive" : rawStatus === "待機中" ? "onLeave" : "active";

  const rawDispatch = String(row.companyName || row["派遣先"] || "").trim();
  const { companyId, resolvedFactoryName } = resolveCompanyFromDispatch(rawDispatch, companyMap);

  const rawGender = String(row.gender || row["性別"] || "").trim();
  const gender =
    rawGender === "男" ? "male"
    : rawGender === "女" ? "female"
    : rawGender === "male" || rawGender === "female" ? rawGender
    : null;

  const nationality = normalizeNationality(
    String(row.nationality || row["国籍"] || "").trim(),
  );

  const address = [
    row.address || row["住所"] || "",
    row.apartment || row["アパート"] || row["ｱﾊﾟｰﾄ"] || "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  let dept = normalizePlacement(row.department || row["配属先"]);
  let line = normalizePlacement(row.lineName || row["配属ライン"] || row["ライン"]);
  let effectiveFactoryName = resolvedFactoryName;

  const composite = parseHaizokusaki(dept);
  if (composite) {
    effectiveFactoryName = composite.factoryName;
    dept = composite.department;
    line = composite.lineName;
  }

  const factoryId = resolveFactoryAssignment({
    companyId,
    department: dept,
    lineName: line,
    resolvedFactoryName: effectiveFactoryName,
    allFactories,
    factoryLookup,
  });

  const rawClientEmployeeId = String(row.clientEmployeeId || row["派遣先ID"] || "").trim();
  const clientEmployeeId =
    !rawClientEmployeeId || rawClientEmployeeId === "0" ? null : rawClientEmployeeId;

  const parsedHireDate = excelSerialToDate(row.hireDate || row["入社日"]);
  const parsedActualHireDate = excelSerialToDate(
    row.actualHireDate || row["配属日"] || row["現入社"],
  );

  return {
    status,
    companyId,
    gender: gender as "male" | "female" | "other" | null,
    nationality: nationality || null,
    address: address || null,
    factoryId,
    clientEmployeeId,
    katakanaName: String(row.katakanaName || row["フリガナ"] || row["カナ"] || "").trim() || null,
    birthDate: excelSerialToDate(row.birthDate || row["生年月日"]),
    hourlyRate: parseRate(row.hourlyRate ?? row["時給"]),
    billingRate: parseRate(row.billingRate ?? row["請求単価"] ?? row["単価"] ?? row["基本給"]),
    visaExpiry: excelSerialToDate(row.visaExpiry || row["ビザ期限"]),
    visaType: String(row.visaType || row["ビザ種類"] || "").trim() || null,
    postalCode: String(row.postalCode || row["郵便番号"] || row["〒"] || "").trim() || null,
    hireDate: parsedHireDate,
    actualHireDate: parsedActualHireDate || parsedHireDate,
  };
}

// Tipo del array de fábricas que usa buildFactoryLookup
type FactoryLookupEntry = {
  id: number;
  companyId: number;
  factoryName: string;
  department: string | null;
  lineName: string | null;
};

/**
 * Importa empleados desde filas de Excel ya parseadas.
 * Realiza upsert atómico dentro de una transacción SQLite.
 */
export async function importEmployees(
  rows: Record<string, unknown>[],
  mode: "upsert" | "skip",
): Promise<{ result: EmployeeImportResult; unrecognizedHeaders: string[] }> {
  await createAutoBackup();

  // Precarga el mapa empresa nombre → id
  const allCompanies = await db.query.clientCompanies.findMany();
  const companyMap = new Map<string, number>();
  for (const co of allCompanies) {
    companyMap.set(co.name, co.id);
    if (co.shortName) companyMap.set(co.shortName, co.id);
  }

  // Precarga el lookup de fábricas
  const allFactories: FactoryLookupEntry[] = await db.query.factories.findMany();
  const factoryLookup = buildFactoryLookup(allFactories);

  // Precarga empleados existentes para evitar queries por fila dentro de la transacción
  const existingEmployeeList = await db.query.employees.findMany({
    columns: { id: true, employeeNumber: true },
  });
  const existingEmployeeMap = new Map<string, number>(
    existingEmployeeList.map((e) => [e.employeeNumber, e.id]),
  );

  // Detecta encabezados no reconocidos a partir de la primera fila
  let unrecognizedHeaders: string[] = [];
  if (rows.length > 0) {
    const firstRow = normalizeImportRow(rows[0]);
    unrecognizedHeaders = Object.keys(firstRow).filter(
      (h) => !EMPLOYEE_KNOWN_HEADERS.has(h),
    );
  }

  const result = sqlite.transaction((): EmployeeImportResult => {
    let txInserted = 0;
    let txUpdated = 0;
    let txSkipped = 0;
    const txErrors: string[] = [];

    for (const rawRow of rows) {
      const row = normalizeImportRow(rawRow);

      try {
        const employeeNumber = String(
          row.employeeNumber || row["社員番号"] || row["社員№"] || row["社員No"] || "",
        ).trim();
        if (!employeeNumber) { txSkipped++; continue; }

        const fullName = String(row.fullName || row["氏名"] || "").trim();
        if (!fullName) { txSkipped++; continue; }

        const parsed = buildEmployeeData(row, companyMap, allFactories, factoryLookup);

        const employeeData = {
          employeeNumber,
          fullName,
          ...parsed,
          updatedAt: new Date().toISOString(),
        };

        const existingId = existingEmployeeMap.get(employeeNumber);

        if (existingId !== undefined) {
          if (mode === "skip") { txSkipped++; continue; }

          // Solo sobreescribe campos que tienen valores no-null en el Excel
          const updateData: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(employeeData)) {
            if (ALWAYS_SYNC_KEYS.has(key)) {
              updateData[key] = value;
            } else if (value !== null) {
              updateData[key] = value;
            }
          }
          db.update(employees).set(updateData).where(eq(employees.id, existingId)).run();
          txUpdated++;
        } else {
          db.insert(employees).values(employeeData).run();
          // Registra el número para detectar duplicados dentro del mismo import
          existingEmployeeMap.set(employeeNumber, -1);
          txInserted++;
        }
      } catch (err: unknown) {
        txErrors.push(
          `Row ${row.employeeNumber || "?"}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    db.insert(auditLog)
      .values({
        action: "import",
        entityType: "employee",
        detail: `Excel import: ${txInserted} inserted, ${txUpdated} updated, ${txSkipped} skipped, ${txErrors.length} errors`,
        userName: "import",
      })
      .run();

    return { inserted: txInserted, updated: txUpdated, skipped: txSkipped, errors: txErrors };
  })();

  return { result, unrecognizedHeaders };
}

/**
 * Importa empresas (企業情報) desde filas de Excel ya parseadas.
 */
export async function importCompanies(
  rows: Record<string, unknown>[],
  mode: "upsert" | "skip",
): Promise<CompanyImportResult> {
  const existingCompanies = await db.query.clientCompanies.findMany();
  const companyByName = new Map(existingCompanies.map((co) => [co.name, co]));

  return sqlite.transaction((): CompanyImportResult => {
    let txInserted = 0;
    let txUpdated = 0;
    let txSkipped = 0;
    const txErrors: string[] = [];

    for (const rawRow of rows) {
      const row = normalizeImportRow(rawRow);

      try {
        const rawName = String(row["会社名"] || row.name || "").trim();
        if (!rawName) { txSkipped++; continue; }
        const name = normalizeCompanyName(rawName);

        const nameKana = String(row["会社名カナ"] || row.nameKana || "").trim() || null;
        const shortName =
          String(row["略称"] || row.shortName || "").trim() || deriveShortCompanyName(name);
        const address = String(row["住所"] || row.address || "").trim() || null;
        const phone = String(row["TEL"] || row.phone || "").trim() || null;
        const representative = String(row["代表者"] || row.representative || "").trim() || null;
        const rawActive = String(row["有効"] || row.isActive || "").trim().toLowerCase();
        const isActive =
          rawActive === "0" || rawActive === "false" || rawActive === "無効" ? false : true;

        const payload = {
          name,
          nameKana,
          shortName,
          address,
          phone,
          representative,
          isActive,
          updatedAt: new Date().toISOString(),
        };

        const existing = companyByName.get(name);

        if (existing) {
          if (mode === "skip") { txSkipped++; continue; }
          db.update(clientCompanies).set(payload).where(eq(clientCompanies.id, existing.id)).run();
          txUpdated++;
        } else {
          db.insert(clientCompanies).values(payload).run();
          txInserted++;
          companyByName.set(name, { ...payload, id: -1 } as typeof existingCompanies[0]);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        txErrors.push(`会社「${String(row["会社名"] || row.name || "?")}」: ${message}`);
      }
    }

    db.insert(auditLog)
      .values({
        action: "import",
        entityType: "company",
        detail: `Company import: ${txInserted} inserted, ${txUpdated} updated, ${txSkipped} skipped, ${txErrors.length} errors`,
        userName: "import",
      })
      .run();

    return { inserted: txInserted, updated: txUpdated, skipped: txSkipped, errors: txErrors };
  })();
}

// Claves que siempre se sincronizan en el diff (mismo conjunto que en el import)
export const DIFF_ALWAYS_SYNC_KEYS = new Set([
  "companyId", "factoryId", "clientEmployeeId", "status",
]);

// Claves que se comparan en el diff
export const DIFF_COMPARE_KEYS = [
  "fullName", "katakanaName", "gender", "nationality", "birthDate",
  "hourlyRate", "billingRate", "visaExpiry", "visaType", "postalCode",
  "address", "hireDate", "actualHireDate", "clientEmployeeId",
  "companyId", "factoryId", "status",
] as const;

export type DiffCompareKey = (typeof DIFF_COMPARE_KEYS)[number];
