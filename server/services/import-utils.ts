// Shared parsing utilities for Excel import endpoints

export const BLOCKED_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function normalizeImportRow(rawRow: Record<string, unknown>): Record<string, unknown> {
  const normalized = Object.create(null) as Record<string, unknown>;
  for (const [rawKey, rawValue] of Object.entries(rawRow)) {
    const key = String(rawKey).trim();
    if (!key || BLOCKED_OBJECT_KEYS.has(key)) continue;
    normalized[key] = typeof rawValue === "string" ? rawValue.trim() : rawValue;
  }
  return normalized;
}

export const COMPANY_NAME_ALIASES: Record<string, string> = {
  "フェニテックセミコンダクター(株)": "フェニテックセミコンダクター株式会社",
  "ﾃｨｰｹｰｴﾝｼﾞﾆｱﾘﾝｸﾞ株式会社": "TKE株式会社",
  "ティーケーエンジニアリング株式会社": "TKE株式会社",
};

export function normalizeCompanyName(rawName: string): string {
  const trimmed = rawName.trim();
  return COMPANY_NAME_ALIASES[trimmed] ?? trimmed;
}

export function deriveShortCompanyName(fullName: string): string | null {
  const normalized = fullName
    .replace(/^株式会社/, "")
    .replace(/株式会社$/, "")
    .replace(/^\(株\)/, "")
    .replace(/\(株\)$/, "")
    .trim();
  return normalized || null;
}

/**
 * Convert Excel serial date number to ISO date string (YYYY-MM-DD).
 * Excel serial: days since 1900-01-01 (with the Lotus 1-2-3 leap year bug).
 *
 * Handles:
 *  - JS Date objects (returned directly by ExcelJS for date cells)
 *  - ISO strings: "2022-04-05"
 *  - Slash-separated: "2022/04/05" or "2022/4/5"
 *  - Japanese era strings: "令和4年4月5日", "R4.4.5", "H15/03/20"
 *  - Excel serial numbers (numeric)
 */
export function excelSerialToDate(serial: unknown): string | null {
  // JS Date object (ExcelJS resolves date cells to Date when using cell.value)
  if (serial instanceof Date) {
    if (Number.isNaN(serial.getTime())) return null;
    const y = serial.getUTCFullYear();
    const m = String(serial.getUTCMonth() + 1).padStart(2, "0");
    const d = String(serial.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // If it already looks like a date string, return it
  if (typeof serial === "string") {
    const value = serial.trim();
    if (!value) return null;

    // ISO / slash formats: 2022-04-05 or 2022/4/5
    if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}/.test(value)) {
      const parts = value.replace(/\//g, "-").split("-");
      const y = parts[0];
      const m = parts[1].padStart(2, "0");
      const d = (parts[2] ?? "01").split("T")[0].padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    // Japanese era: 令和4年4月5日 or R4.4.5 or H15/03/20
    const ERA_OFFSETS: Record<string, number> = {
      R: 2018,
      令: 2018,
      令和: 2018,
      H: 1988,
      平: 1988,
      平成: 1988,
      S: 1925,
      昭: 1925,
      昭和: 1925,
      T: 1911,
      大: 1911,
      大正: 1911,
      M: 1867,
      明: 1867,
      明治: 1867,
    };
    const eraMatch = value.match(
      /^(令和|平成|昭和|大正|明治|[令平昭大明RHSTMrhstm])(\d{1,2})[年./](\d{1,2})[月./](\d{1,2})[日]?/,
    );
    if (eraMatch) {
      const eraKey = eraMatch[1].toUpperCase();
      const offset = ERA_OFFSETS[eraKey] ?? ERA_OFFSETS[eraMatch[1]];
      if (offset !== undefined) {
        const year = offset + Number(eraMatch[2]);
        const month = String(Number(eraMatch[3])).padStart(2, "0");
        const day = String(Number(eraMatch[4])).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    }
  }

  const num = Number(serial);
  if (!num || Number.isNaN(num) || num < 1) return null;

  // Guard absurdly large serials that can yield invalid date ranges
  if (num > 3000000) {
    return null;
  }

  // Excel epoch: 1900-01-01 = serial 1, but Excel wrongly treats 1900 as leap year
  const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Dec 30, 1899
  const ms = excelEpoch.getTime() + num * 86400000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parse a rate value that could be a number, currency string, or empty.
 */
export function parseRate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).replace(/[¥￥,、\s]/g, "");
  const v = parseFloat(str);
  return Number.isNaN(v) || v <= 0 ? null : v;
}

/**
 * Normalize full-width alphanumeric to half-width for consistent matching.
 * ０-９ → 0-9, Ａ-Ｚ → A-Z, ａ-ｚ → a-z, full-width space → half-width
 */
export function normalizeWidth(s: string): string {
  return s
    .replace(/[\uff10-\uff19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\uff21-\uff3a]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\uff41-\uff5a]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ");
}

export function normalizePlacement(value: unknown): string {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized === "0" || normalized === "-" || normalized === "ー") {
    return "";
  }
  return normalized;
}
