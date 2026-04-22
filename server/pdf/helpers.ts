/**
 * PDF Drawing Helpers — Shared primitives for all document generators.
 *
 * Ported from PruebaKobetsu Electron app (main.js).
 * All measurements in PDF points (1pt = 1/72 inch).
 * A4 = 595.28 x 841.89 pt.
 */
import PDFDocument from "pdfkit";

export type Doc = InstanceType<typeof PDFDocument>;

// ─── Layout constants ────────────────────────────────────────────────

/** A4 usable width with 20pt margins */
export const LM = 20;
export const W = 555;

/** Standard row/section heights */
export const RH = 12;
export const SH = 10;
export const TALL_H = 16;

// ─── UNS Company defaults ───────────────────────────────────────────

export const UNS = {
  name: "ユニバーサル企画株式会社",
  address: "〒461-0025 愛知県名古屋市東区徳川2-18-18",
  representative: "代表取締役　中山　雅和",
  licenseNumber: "派　23-303669",
  phone: "052-938-8840",
  defaultManager: {
    dept: "営業部",
    role: "取締役 部長",
    name: "中山　欣英",
    phone: "052-938-8840",
  },
};

// ─── Cell options ───────────────────────────────────────────────────

interface CellOpts {
  bg?: string;
  align?: "left" | "center" | "right";
  wrap?: boolean;
  fontSize?: number;
}

// ─── C() — Generic bordered cell with text ──────────────────────────

export function C(
  doc: Doc,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  fs?: number,
  opts?: CellOpts
) {
  const o = opts || {};
  doc.lineWidth(0.4);
  doc.rect(x, y, w, h).stroke();

  if (o.bg) {
    doc
      .save()
      .fillColor(o.bg)
      .rect(x + 0.2, y + 0.2, w - 0.4, h - 0.4)
      .fill()
      .restore();
  }

  const size = fs || 6;
  doc.fontSize(size).fillColor("#000");
  const p = 2;
  const ty = y + (h - size) / 2;

  if (o.align === "center") {
    doc.text(text || "", x, ty, { width: w, align: "center", lineBreak: false });
  } else {
    doc.text(text || "", x + p, ty, {
      width: w - p * 2,
      lineBreak: o.wrap || false,
    });
  }
}

// ─── L() — Label cell (gray background, 5.5pt default) ─────────────

export function L(
  doc: Doc,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  fs?: number
) {
  C(doc, x, y, w, h, text, fs || 5.5, { bg: "#e8e8e8" });
}

// ─── V() — Value cell (no background, 6pt default) ─────────────────

export function V(
  doc: Doc,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  fs?: number
) {
  C(doc, x, y, w, h, text, fs || 6, {});
}

// ─── personRow() — 9-cell person layout ─────────────────────────────

const PL = 105;
const PsL = 14;
const PvW = [84, 56, 100, 154];

export function personRow(
  doc: Doc,
  y: number,
  mainLabel: string,
  dept: string,
  role: string,
  name: string,
  phone: string
) {
  let x = LM;
  L(doc, x, y, PL, RH, mainLabel, 4.5);
  x += PL;
  L(doc, x, y, PsL, RH, "部署", 4.5);
  x += PsL;
  V(doc, x, y, PvW[0], RH, dept, 5.5);
  x += PvW[0];
  L(doc, x, y, PsL, RH, "役職", 4.5);
  x += PsL;
  V(doc, x, y, PvW[1], RH, role, 5.5);
  x += PvW[1];
  L(doc, x, y, PsL, RH, "氏名", 4.5);
  x += PsL;
  V(doc, x, y, PvW[2], RH, name, 5.5);
  x += PvW[2];
  L(doc, x, y, PsL, RH, "TEL", 4.5);
  x += PsL;
  V(doc, x, y, PvW[3], RH, phone, 5.5);
}

// ─── legalRow() — Dynamic-height legal text row ─────────────────────

const lFS = 4.5;
const lLW = 85;
const lVW = W - lLW;

export function legalRow(
  doc: Doc,
  y: number,
  title: string,
  text: string
): number {
  doc.fontSize(lFS);
  const th = doc.heightOfString(text, { width: lVW - 4 });
  const h = Math.max(th + 4, 10);
  L(doc, LM, y, lLW, h, title, 5);
  doc.lineWidth(0.4).rect(LM + lLW, y, lVW, h).stroke();
  doc.fontSize(lFS).fillColor("#000").text(text, LM + lLW + 2, y + 2, { width: lVW - 4 });
  return y + h;
}

// ─── Section header ─────────────────────────────────────────────────

export function sectionHeader(doc: Doc, y: number, title: string): number {
  C(doc, LM, y, W, SH, title, 7, { bg: "#d0d0e8", align: "center" });
  return y + SH;
}

// ─── drawRow() — Multi-cell row for DAICHO ──────────────────────────

export interface RowCell {
  x: number;
  w: number;
  text?: string;
  fontSize?: number;
  bg?: string;
  align?: "left" | "center" | "right";
}

export function drawRow(doc: Doc, y: number, h: number, cells: RowCell[]) {
  doc.lineWidth(0.5);
  for (const cell of cells) {
    doc.rect(cell.x, y, cell.w, h).stroke();
    if (cell.bg) {
      doc
        .save()
        .fillColor(cell.bg)
        .rect(cell.x + 0.5, y + 0.5, cell.w - 1, h - 1)
        .fill()
        .restore();
    }
    const fs = cell.fontSize || 7;
    doc.fontSize(fs).fillColor("#000");
    if (cell.align === "center") {
      doc.text(cell.text || "", cell.x, y + (h - fs) / 2, {
        width: cell.w,
        align: "center",
      });
    } else {
      doc.text(cell.text || "", cell.x + 3, y + (h - fs) / 2, {
        width: cell.w - 6,
      });
    }
  }
}

// ─── labelRow() — Label+value 2-cell row for DAICHO ─────────────────

export function labelRow(
  doc: Doc,
  y: number,
  h: number,
  label: string,
  value: string,
  lw: number = 140,
  totalW: number = W
) {
  drawRow(doc, y, h, [
    { x: LM, w: lw, text: label, fontSize: 6.5, bg: "#f5f5f5" },
    { x: LM + lw, w: totalW - lw, text: value || "", fontSize: 7 },
  ]);
  return y + h;
}

// ─── labelRowAuto() — Auto-height label+value row ──────────────────

export function labelRowAuto(
  doc: Doc,
  y: number,
  minH: number,
  label: string,
  value: string,
  lw: number = 140,
  totalW: number = W,
  valueFontSize: number = 7
): number {
  const vw = totalW - lw;
  doc.fontSize(valueFontSize);
  const th = doc.heightOfString(value || "", { width: vw - 6 });
  const h = Math.max(minH, th + 6);

  doc.lineWidth(0.5);

  // Label cell (gray bg, vertically centered)
  doc.rect(LM, y, lw, h).stroke();
  doc.save().fillColor("#f5f5f5").rect(LM + 0.5, y + 0.5, lw - 1, h - 1).fill().restore();
  doc.fontSize(6.5).fillColor("#000");
  const lth = doc.heightOfString(label, { width: lw - 6 });
  doc.text(label, LM + 3, y + Math.max((h - lth) / 2, 2), { width: lw - 6 });

  // Value cell (vertically centered)
  doc.rect(LM + lw, y, vw, h).stroke();
  doc.fontSize(valueFontSize).fillColor("#000");
  doc.text(value || "", LM + lw + 3, y + Math.max((h - th) / 2, 2), { width: vw - 6 });

  return y + h;
}

// ─── Date parsing (handles ISO "2025-12-16" and Japanese "2025年12月16日") ──

export function parseDate(s: string | null | undefined): Date {
  if (!s) {
    console.warn("[parseDate] received null/empty — defaulting to today");
    return new Date();
  }
  const jp = s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (jp) return new Date(+jp[1], +jp[2] - 1, +jp[3]);
  // Parse ISO dates as local (not UTC) to avoid timezone shift
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    console.warn(`[parseDate] invalid date string: "${s}" — defaulting to today`);
    return new Date();
  }
  return d;
}

// ─── Age calculation ────────────────────────────────────────────────

export function calculateAge(birthDate: string | null | undefined, referenceDate?: string | null): number {
  if (!birthDate) return 0;
  const birth = parseDate(birthDate);
  const ref = referenceDate ? parseDate(referenceDate) : new Date();
  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function ageGroup(age: number): string {
  if (age <= 18) return `18未満(${age})歳`;
  if (age <= 45) return "18以上45歳未満";
  if (age <= 60) return "46以上60歳未満";
  return "60歳以上";
}

// ─── Employment type ────────────────────────────────────────────────

export function isIndefiniteEmployment(
  hireDate: string | null | undefined,
  endDate: string | null | undefined
): boolean {
  if (!hireDate || !endDate) return false;
  const hire = parseDate(hireDate);
  const end = parseDate(endDate);
  const days = (end.getTime() - hire.getTime()) / (1000 * 60 * 60 * 24);
  return days > 1095; // 3 years
}

// ─── Gender text ────────────────────────────────────────────────────

export function genderText(gender: string | null): string {
  return gender === "male" ? "男" : gender === "female" ? "女" : "";
}

// ─── Hire date reference (fallback chain) ────────────────────────────

export function getHireReference(actualHireDate: string | null, hireDate: string | null): string {
  return actualHireDate || hireDate || "";
}

// ─── Page break check ────────────────────────────────────────────────

export function checkPageBreak(doc: Doc, y: number, threshold: number, resetY = 25): number {
  if (y > threshold) {
    doc.addPage();
    return resetY;
  }
  return y;
}

// ─── Japanese national holidays (祝日) ─────────────────────────────────
// Returns all national holidays for a given year.
// Covers fixed + happy monday + equinox dates (2019–2030).

export function getJapaneseHolidays(year: number): Set<string> {
  const holidays = new Set<string>();
  const add = (m: number, d: number) => {
    const dt = new Date(year, m - 1, d);
    holidays.add(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`);
  };

  // Fixed holidays
  add(1, 1);   // 元日
  add(2, 11);  // 建国記念の日
  add(2, 23);  // 天皇誕生日
  add(4, 29);  // 昭和の日
  add(5, 3);   // 憲法記念日
  add(5, 4);   // みどりの日
  add(5, 5);   // こどもの日
  add(8, 11);  // 山の日
  add(11, 3);  // 文化の日
  add(11, 23); // 勤労感謝の日

  // Happy Monday holidays (2nd/3rd Monday)
  const nthMonday = (month: number, n: number) => {
    const first = new Date(year, month - 1, 1);
    const firstDay = first.getDay();
    const firstMon = firstDay === 0 ? 2 : firstDay <= 1 ? (1 - firstDay + 1) : (8 - firstDay + 1);
    return firstMon + (n - 1) * 7;
  };
  add(1, nthMonday(1, 2));   // 成人の日 (2nd Monday of Jan)
  add(7, nthMonday(7, 3));   // 海の日 (3rd Monday of Jul)
  add(9, nthMonday(9, 3));   // 敬老の日 (3rd Monday of Sep)
  add(10, nthMonday(10, 2)); // スポーツの日 (2nd Monday of Oct)

  // 春分の日 calculation based on astronomical data
  const shunbun = (() => {
    // Known dates: 2024=20, 2025=20, 2026=20, 2027=21, 2028=20, 2029=20, 2030=20, 2031=21
    const march21Years = new Set([2027, 2031, 2035, 2039, 2043]);
    return march21Years.has(year) ? 21 : 20;
  })();
  // 秋分の日: shifts between September 22 and 23
  const shubun = (() => {
    const sep23Years = new Set([2024, 2028, 2032, 2036, 2040, 2044]);
    return sep23Years.has(year) ? 23 : 22;
  })();
  add(3, shunbun); // 春分の日
  add(9, shubun);  // 秋分の日

  // 振替休日: if a holiday falls on Sunday, Monday becomes substitute
  for (const h of [...holidays]) {
    const d = new Date(h);
    if (d.getDay() === 0) {
      const sub = new Date(d.getTime() + 86400000);
      holidays.add(`${sub.getFullYear()}-${String(sub.getMonth() + 1).padStart(2, "0")}-${String(sub.getDate()).padStart(2, "0")}`);
    }
  }

  return holidays;
}

/** Adjust a target date to the previous business day (skipping weekends + 祝日). */
export function adjustToBusinessDay(year: number, month: number, day: number): Date {
  const holidays = getJapaneseHolidays(year);
  const date = new Date(year, month - 1, day);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  while (date.getDay() === 0 || date.getDay() === 6 || holidays.has(fmt(date))) {
    date.setDate(date.getDate() - 1);
  }
  return date;
}

// ─── Compact time format for PDFs ────────────────────────────────────
// "7時00分～15時30分" → "7:00～15:30" — saves ~30% horizontal space

export function compactTimeFormat(text: string): string {
  return text.replace(/(\d{1,2})時(\d{2})分?/g, "$1:$2");
}

// ─── Format currency ────────────────────────────────────────────────

export function yen(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "¥0";
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

// ─── Takao jigyosho (事業所) helper ─────────────────────────────────
// 高雄工業 only: derive 事業所 from factory address prefecture

export function getTakaoJigyosho(companyName: string, factoryAddress: string | null | undefined): string {
  if (!companyName.includes("高雄")) return "";
  const addr = factoryAddress || "";
  if (addr.includes("岡山県")) return "岡山事業所";
  if (addr.includes("愛知県")) return "愛知事業所";
  if (addr.includes("静岡県")) return "静岡事業所";
  return "";
}

// ─── Date formatting ────────────────────────────────────────────────
// Unified: ISO date → 日本語 (2026-04-01 → 2026年4月1日)

export function formatDateJP(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const m = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
  return dateStr;
}
