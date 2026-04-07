import type { Cell, Worksheet } from "exceljs";

export const COLUMN_MAPPINGS = [
  { excel: "現在", db: "status", note: "在職中→active / 退社→inactive" },
  { excel: "社員№", db: "employeeNumber", note: "一意キー（照合用）" },
  { excel: "派遣先ID", db: "clientEmployeeId", note: "派遣先が付与した社員ID" },
  { excel: "派遣先", db: "companyId", note: "会社名→ID自動解決" },
  { excel: "配属先＋配属ライン", db: "factoryId", note: "工場・ライン→ID自動解決" },
  { excel: "氏名", db: "fullName", note: "漢字フルネーム" },
  { excel: "カナ", db: "katakanaName", note: "カタカナ読み" },
  { excel: "性別", db: "gender", note: "男→male / 女→female" },
  { excel: "国籍", db: "nationality", note: "半角→全角カナ自動変換" },
  { excel: "生年月日", db: "birthDate", note: "Excelシリアル→日付変換" },
  { excel: "時給", db: "hourlyRate", note: "UNS→社員支払い時給" },
  { excel: "請求単価", db: "billingRate", note: "派遣先→UNS請求単価" },
  { excel: "ビザ期限", db: "visaExpiry", note: "Excelシリアル→日付変換" },
  { excel: "ビザ種類", db: "visaType", note: "在留資格" },
  { excel: "〒", db: "postalCode", note: "郵便番号" },
  { excel: "住所＋ｱﾊﾟｰﾄ", db: "address", note: "住所を結合" },
  { excel: "入社日", db: "hireDate", note: "Excelシリアル→日付変換" },
  { excel: "現入社", db: "actualHireDate", note: "配属日（Excelシリアル→日付変換）" },
] as const;

export const BLOCKED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_IMPORT_ROWS = 20000;

export function sanitizeParsedRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((rawRow) => {
    const sanitized = Object.create(null) as Record<string, unknown>;
    for (const [rawKey, rawValue] of Object.entries(rawRow)) {
      const key = String(rawKey).trim();
      if (!key || BLOCKED_KEYS.has(key)) continue;
      sanitized[key] = rawValue;
    }
    return sanitized;
  });
}

export function readCellValue(cell: Cell): string {
  const v = cell.value;

  if (v !== null && typeof v === "object" && "formula" in v) {
    const result = (v as { formula: unknown; result?: unknown }).result;
    if (result instanceof Date) {
      return isoFromDate(result);
    }
    return String(result ?? cell.text ?? "").trim();
  }

  if (v instanceof Date) {
    return isoFromDate(v);
  }

  return String(cell.text ?? "").trim();
}

export function isoFromDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function worksheetToRecords(sheet: Worksheet): Record<string, unknown>[] {
  const headerRow = sheet.getRow(1);
  const maxCols = Math.max(headerRow.cellCount, headerRow.actualCellCount);
  if (maxCols === 0) return [];

  const headers: string[] = [];
  for (let col = 1; col <= maxCols; col++) {
    const header = String(headerRow.getCell(col).text ?? "").trim();
    headers.push(header);
  }

  const rows: Record<string, unknown>[] = [];
  const lastRow = sheet.rowCount;
  for (let rowNum = 2; rowNum <= lastRow; rowNum++) {
    const row = sheet.getRow(rowNum);
    const record: Record<string, unknown> = Object.create(null);
    let hasValue = false;

    for (let col = 1; col <= maxCols; col++) {
      const key = headers[col - 1];
      if (!key || BLOCKED_KEYS.has(key)) continue;
      const value = readCellValue(row.getCell(col));
      record[key] = value;
      if (value !== "") hasValue = true;
    }

    if (hasValue) rows.push(record);
  }

  return rows;
}
