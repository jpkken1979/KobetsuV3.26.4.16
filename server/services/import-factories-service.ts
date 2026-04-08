// Lógica de negocio para importación de fábricas desde Excel (TBKaisha)
import { db, sqlite } from "../db/index.js";
import { factories, clientCompanies, employees, contracts, auditLog, type NewFactory } from "../db/schema.js";
import { eq, count } from "drizzle-orm";
import {
  normalizeImportRow,
  normalizeCompanyName,
  deriveShortCompanyName,
  normalizeWidth,
} from "./import-utils.js";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface FactoryImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  deleted: number;
  errors: string[];
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

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/** Extrae la N-ésima hora de turno (HH:MM～HH:MM) de un texto como "昼勤：7時00分～15時30分　夜勤：..." */
export function deriveShiftTime(workHoursText: string, index: number): string | null {
  if (!workHoursText) return null;
  const re = /(\d{1,2})[時:](\d{2})分?\s*[～~ー-]\s*(\d{1,2})[時:](\d{2})/g;
  let match;
  let i = 0;
  while ((match = re.exec(workHoursText)) !== null) {
    if (i === index) {
      return `${match[1].padStart(2, "0")}:${match[2]}～${match[3].padStart(2, "0")}:${match[4]}`;
    }
    i++;
  }
  return null;
}

/** Normaliza un valor de fecha (Date object, "2028/12/15", o ISO) a "YYYY-MM-DD". */
function normalizeJpDateString(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split("T")[0];
  const s = String(val).trim();
  if (!s) return null;
  // "2028/12/15" → "2028-12-15"
  const slashMatch = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashMatch) return `${slashMatch[1]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[3].padStart(2, "0")}`;
  return s;
}

/** Genera la clave de coincidencia estricta para una fábrica. */
function factoryKey(cId: number, fn: string, dept: string, ln: string): string {
  return `${cId}|${normalizeWidth(fn || "")}|${normalizeWidth(dept || "")}|${normalizeWidth(ln || "")}`;
}

/** Genera la clave de coincidencia relajada (ignora departamento). */
function relaxedKey(cId: number, fn: string, ln: string): string {
  return `${cId}|${normalizeWidth(fn || "")}|${normalizeWidth(ln || "")}`;
}

type DbFactory = {
  id: number;
  companyId: number;
  factoryName: string;
  department: string | null;
  lineName: string | null;
  [key: string]: unknown;
};

/** Construye los mapas de lookup a partir de un array de fábricas. */
function buildFactoryMaps(allFactories: DbFactory[]): {
  existingMap: Map<string, number>;
  relaxedMap: Map<string, number[]>;
} {
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

/** Resuelve o crea el companyId para una fila de fábrica, actualizando los mapas. */
function resolveOrCreateCompany(
  normalizedCompany: string,
  rawCompany: string,
  companyMap: Map<string, number>,
  companyInfoMap: Map<string, { address: string | null; phone: string | null; representative: string | null; nameKana: string | null; shortName: string | null }>,
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
    // Crea la empresa usando datos de Sheet 2 si están disponibles
    const companyInfo = companyInfoMap.get(normalizedCompany);
    const created = db.insert(clientCompanies).values({
      name: normalizedCompany,
      shortName: companyInfo?.shortName || deriveShortCompanyName(normalizedCompany),
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

/** Parsea una fila normalizada en un objeto NewFactory. */
function buildFactoryData(
  row: Record<string, unknown>,
  companyId: number,
): NewFactory {
  const parseNum = (v: unknown) => {
    const n = parseFloat(String(v));
    return Number.isNaN(n) ? null : n;
  };
  const parseIntVal = (v: unknown) => {
    const n = parseInt(String(v), 10);
    return Number.isNaN(n) ? null : n;
  };
  const workHoursRaw = String(row["就業時間"] || row.workHours || "").trim();

  return {
    companyId,
    factoryName: String(row["工場名"] || row.factoryName || "").trim(),
    department: String(row["部署"] || row.department || "").trim() || null,
    lineName: String(row["ライン名"] || row.lineName || "").trim() || null,
    address: String(row["住所"] || row.address || "").trim() || null,
    phone: String(row["TEL"] || row.phone || "").trim() || null,
    supervisorDept: String(row["指揮命令者部署"] || row.supervisorDept || "").trim() || null,
    supervisorName: String(row["指揮命令者氏名"] || row.supervisorName || "").trim() || null,
    supervisorPhone: String(row["指揮命令者TEL"] || row.supervisorPhone || "").trim() || null,
    supervisorRole: String(row["指揮命令者役職"] || row.supervisorRole || "").trim() || null,
    complaintClientDept: String(row["苦情処理(派遣先)部署"] || row.complaintClientDept || "").trim() || null,
    complaintClientName: String(row["苦情処理(派遣先)氏名"] || row.complaintClientName || "").trim() || null,
    complaintClientPhone: String(row["苦情処理(派遣先)TEL"] || row.complaintClientPhone || "").trim() || null,
    complaintUnsDept: String(row["苦情処理(派遣元)部署"] || row.complaintUnsDept || "").trim() || null,
    complaintUnsName: String(row["苦情処理(派遣元)氏名"] || row.complaintUnsName || "").trim() || null,
    complaintUnsPhone: String(row["苦情処理(派遣元)TEL"] || row.complaintUnsPhone || "").trim() || null,
    complaintUnsAddress: String(row["苦情処理(派遣元)所在地"] || row.complaintUnsAddress || "").trim() || null,
    managerUnsDept: String(row["派遣元責任者部署"] || row.managerUnsDept || "").trim() || null,
    managerUnsName: String(row["派遣元責任者氏名"] || row.managerUnsName || "").trim() || null,
    managerUnsPhone: String(row["派遣元責任者TEL"] || row.managerUnsPhone || "").trim() || null,
    managerUnsAddress: String(row["派遣元責任者所在地"] || row.managerUnsAddress || "").trim() || null,
    hakensakiManagerDept: String(row["派遣先責任者部署"] || row.hakensakiManagerDept || "").trim() || null,
    hakensakiManagerName: String(row["派遣先責任者氏名"] || row.hakensakiManagerName || "").trim() || null,
    hakensakiManagerPhone: String(row["派遣先責任者TEL"] || row.hakensakiManagerPhone || "").trim() || null,
    hakensakiManagerRole: String(row["派遣先責任者役職"] || row.hakensakiManagerRole || "").trim() || null,
    jobDescription: String(row["仕事内容"] || row.jobDescription || "").trim() || null,
    shiftPattern: String(row["シフト"] || row.shiftPattern || "").trim() || null,
    workHours: workHoursRaw || null,
    workHoursDay:
      String(row["昼勤時間"] || row.workHoursDay || "").trim() ||
      deriveShiftTime(workHoursRaw, 0) ||
      null,
    workHoursNight:
      String(row["夜勤時間"] || row.workHoursNight || "").trim() ||
      deriveShiftTime(workHoursRaw, 1) ||
      null,
    breakTimeDay: String(row["休憩時間"] || row.breakTimeDay || "").trim() || null,
    breakTimeNight: String(row["夜勤休憩"] || row.breakTimeNight || "").trim() || null,
    breakTime: parseIntVal(row["休憩(分)"] ?? row.breakTime),
    overtimeHours: String(row["時間外"] || row.overtimeHours || "").trim() || null,
    overtimeOutsideDays: String(row["就業日外労働"] || row.overtimeOutsideDays || "").trim() || null,
    workDays: String(row["就業日"] || row.workDays || "").trim() || null,
    hourlyRate: parseNum(row["単価"] ?? row.hourlyRate),
    conflictDate: normalizeJpDateString(row["抵触日"] ?? row.conflictDate),
    contractPeriod: String(row["契約期間"] || row.contractPeriod || "").trim() || null,
    calendar: String(row["カレンダー"] || row.calendar || "").trim() || null,
    closingDay: parseIntVal(row["締め日"] ?? row.closingDay),
    closingDayText: String(row["締め日テキスト"] || row.closingDayText || "").trim() || null,
    paymentDay: parseIntVal(row["支払日"] ?? row.paymentDay),
    paymentDayText: String(row["支払日テキスト"] || row.paymentDayText || "").trim() || null,
    bankAccount: String(row["銀行口座"] || row.bankAccount || "").trim() || null,
    timeUnit: String(row["時間単位"] || row.timeUnit || "").trim() || null,
    workerClosingDay: String(row["作業者締め日"] || row.workerClosingDay || "").trim() || null,
    workerPaymentDay: String(row["作業者支払日"] || row.workerPaymentDay || "").trim() || null,
    workerCalendar: String(row["作業者カレンダー"] || row.workerCalendar || "").trim() || null,
    agreementPeriodEnd: String(row["当該協定期間"] || row.agreementPeriodEnd || "").trim() || null,
    explainerName: String(row["説明者"] || row.explainerName || "").trim() || null,
    hasRobotTraining: (() => {
      const raw = row["産業用ロボット特別教育"] ?? row.hasRobotTraining;
      if (raw == null || raw === "") return null;
      const val = String(raw).trim().toLowerCase();
      return val === "1" || val === "true" || val === "○";
    })(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Función principal de importación
// ---------------------------------------------------------------------------

/**
 * Importa fábricas desde filas de Excel ya parseadas (TBKaisha).
 * Realiza upsert atómico con soporte para eliminación de fábricas y enriquecimiento de empresas.
 */
export async function importFactories(
  rows: Record<string, unknown>[],
  mode: "upsert" | "skip",
  deleteIds: number[],
  rawCompanyData: Record<string, unknown>[],
): Promise<FactoryImportResult> {
  // Construye el mapa de info de empresas desde Sheet 2 (企業情報)
  const companyInfoMap = new Map<string, {
    address: string | null;
    phone: string | null;
    representative: string | null;
    nameKana: string | null;
    shortName: string | null;
  }>();

  for (const rawRow of rawCompanyData) {
    const row = normalizeImportRow(rawRow);
    const rawName = String(row["会社名"] || row.name || "").trim();
    if (!rawName) continue;
    const name = normalizeCompanyName(rawName);
    companyInfoMap.set(name, {
      address: String(row["住所"] || row.address || "").trim() || null,
      phone: String(row["TEL"] || row.phone || "").trim() || null,
      representative: String(row["代表者"] || row.representative || "").trim() || null,
      nameKana: String(row["会社名カナ"] || row.nameKana || "").trim() || null,
      shortName: String(row["略称"] || row.shortName || "").trim() || null,
    });
  }

  // Precarga mapa empresa nombre → id
  const allCompanies = await db.query.clientCompanies.findMany();
  const companyMap = new Map<string, number>();
  for (const co of allCompanies) {
    companyMap.set(co.name, co.id);
    if (co.shortName) companyMap.set(co.shortName, co.id);
  }

  // Precarga fábricas existentes
  const allFactories = await db.query.factories.findMany();
  const { existingMap, relaxedMap } = buildFactoryMaps(allFactories as DbFactory[]);

  return sqlite.transaction((): FactoryImportResult => {
    let txInserted = 0;
    let txUpdated = 0;
    let txSkipped = 0;
    const txErrors: string[] = [];

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
        const department = factoryData.department ?? "";
        const lineName = factoryData.lineName ?? "";

        // Upsert: coincidencia estricta primero, luego relajada
        const key = factoryKey(companyId, factoryName, department, lineName);
        let matchedId = existingMap.get(key);

        if (!matchedId) {
          const rk = relaxedKey(companyId, factoryName, lineName);
          const candidates = relaxedMap.get(rk);
          if (candidates && candidates.length === 1) matchedId = candidates[0];
        }

        if (matchedId) {
          if (mode === "skip") { txSkipped++; continue; }

          // Solo actualiza campos con valores reales — nunca sobreescribe con null/vacío
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

    // Elimina las fábricas seleccionadas por el usuario (dentro de la misma transacción)
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

    // Enriquece empresas con campos vacíos usando datos de Sheet 2
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
      companiesUpdated: txCompaniesUpdated,
    };
  })();
}

// ---------------------------------------------------------------------------
// Campos para diff display
// ---------------------------------------------------------------------------

export const DIFF_FIELDS: { key: string; excelKey: string; label: string }[] = [
  { key: "department", excelKey: "部署", label: "部署" },
  { key: "lineName", excelKey: "ライン名", label: "ライン名" },
  { key: "address", excelKey: "住所", label: "住所" },
  { key: "phone", excelKey: "TEL", label: "TEL" },
  { key: "hakensakiManagerDept", excelKey: "派遣先責任者部署", label: "派遣先責任者 部署" },
  { key: "hakensakiManagerName", excelKey: "派遣先責任者氏名", label: "派遣先責任者 氏名" },
  { key: "hakensakiManagerPhone", excelKey: "派遣先責任者TEL", label: "派遣先責任者 TEL" },
  { key: "hakensakiManagerRole", excelKey: "派遣先責任者役職", label: "派遣先責任者 役職" },
  { key: "supervisorDept", excelKey: "指揮命令者部署", label: "指揮命令者 部署" },
  { key: "supervisorName", excelKey: "指揮命令者氏名", label: "指揮命令者 氏名" },
  { key: "supervisorPhone", excelKey: "指揮命令者TEL", label: "指揮命令者 TEL" },
  { key: "supervisorRole", excelKey: "指揮命令者役職", label: "指揮命令者 役職" },
  { key: "complaintClientDept", excelKey: "苦情処理(派遣先)部署", label: "苦情処理(派遣先) 部署" },
  { key: "complaintClientName", excelKey: "苦情処理(派遣先)氏名", label: "苦情処理(派遣先) 氏名" },
  { key: "complaintClientPhone", excelKey: "苦情処理(派遣先)TEL", label: "苦情処理(派遣先) TEL" },
  { key: "complaintUnsDept", excelKey: "苦情処理(派遣元)部署", label: "苦情処理(派遣元) 部署" },
  { key: "complaintUnsName", excelKey: "苦情処理(派遣元)氏名", label: "苦情処理(派遣元) 氏名" },
  { key: "complaintUnsPhone", excelKey: "苦情処理(派遣元)TEL", label: "苦情処理(派遣元) TEL" },
  { key: "complaintUnsAddress", excelKey: "苦情処理(派遣元)所在地", label: "苦情処理(派遣元) 所在地" },
  { key: "managerUnsDept", excelKey: "派遣元責任者部署", label: "派遣元責任者 部署" },
  { key: "managerUnsName", excelKey: "派遣元責任者氏名", label: "派遣元責任者 氏名" },
  { key: "managerUnsPhone", excelKey: "派遣元責任者TEL", label: "派遣元責任者 TEL" },
  { key: "managerUnsAddress", excelKey: "派遣元責任者所在地", label: "派遣元責任者 所在地" },
  { key: "jobDescription", excelKey: "仕事内容", label: "仕事内容" },
  { key: "shiftPattern", excelKey: "シフト", label: "シフト" },
  { key: "workHours", excelKey: "就業時間", label: "就業時間" },
  { key: "workHoursDay", excelKey: "昼勤時間", label: "昼勤時間" },
  { key: "workHoursNight", excelKey: "夜勤時間", label: "夜勤時間" },
  { key: "breakTimeDay", excelKey: "休憩時間", label: "休憩時間" },
  { key: "breakTimeNight", excelKey: "夜勤休憩", label: "夜勤休憩" },
  { key: "breakTime", excelKey: "休憩(分)", label: "休憩(分)" },
  { key: "overtimeHours", excelKey: "時間外", label: "時間外" },
  { key: "overtimeOutsideDays", excelKey: "就業日外労働", label: "就業日外労働" },
  { key: "workDays", excelKey: "就業日", label: "就業日" },
  { key: "hourlyRate", excelKey: "単価", label: "単価" },
  { key: "conflictDate", excelKey: "抵触日", label: "抵触日" },
  { key: "contractPeriod", excelKey: "契約期間", label: "契約期間" },
  { key: "calendar", excelKey: "カレンダー", label: "カレンダー" },
  { key: "closingDayText", excelKey: "締め日テキスト", label: "締め日テキスト" },
  { key: "paymentDayText", excelKey: "支払日テキスト", label: "支払日テキスト" },
  { key: "bankAccount", excelKey: "銀行口座", label: "銀行口座" },
  { key: "timeUnit", excelKey: "時間単位", label: "時間単位" },
  { key: "explainerName", excelKey: "説明者", label: "説明者" },
  { key: "hasRobotTraining", excelKey: "産業用ロボット特別教育", label: "産業用ロボット特別教育" },
];

// ---------------------------------------------------------------------------
// Función de diff
// ---------------------------------------------------------------------------

/**
 * Compara datos de Excel contra la DB sin importar.
 * Retorna inserts, updates (con cambios campo a campo) y fábricas presentes
 * en DB pero ausentes en el Excel.
 */
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
  const companyErrors: string[] = [];

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

  // Fábricas presentes en DB pero ausentes en el Excel (solo para empresas del Excel)
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

  return { inserts, updates, unchanged, missing, companyErrors };
}
