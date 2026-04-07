/**
 * コーリツ 派遣先通知書 (Dispatch Notification — Koritsu variant)
 *
 * GRID-BASED LAYOUT matching Excel template コーリツ個別契約セット等26年1月3月末.xlsm
 * Sheet: 派遣先通知書
 * 60 columns × 83 rows, A4 portrait
 *
 * Border spec from spec-tsuchisho.json — per-side borders
 *
 * Only generated for NEW employees (入社日 within current contract period).
 * Includes: 氏名, 性別, 年齢, 雇用期間, 待遇決定方式, 社会保険.
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  type Doc,
  UNS,
  calculateAge,
  isIndefiniteEmployment,
  getHireReference,
  formatDateJP,
  parseDate,
} from "./helpers.js";
import type { CellOpts } from "./types.js";
import type { BaseEmployeeWithDates } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── DATA INTERFACE ──────────────────────────────────────────────────

export interface KoritsuTsuchishoData {
  companyName: string;
  contractNumber: string;
  contractDate: string;
  startDate: string;
  endDate: string;
  managerUnsAddress?: string;

  employees: BaseEmployeeWithDates[];
}

// ─── GRID SYSTEM ─────────────────────────────────────────────────────

const PH = 841.89;
const ML = 20;
const MT = 10;
const MB = 20;
const TW = 540;  // reduced from 555 to leave right margin for printing

// Column widths from Excel (60 columns)
const COL_CW = [
  1.5, 1.5, 1.5, 1.5, 1, 1.5, 1.5, 1.5, 1.5, 1.5,
  1.5, 1.875, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5,
  1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5,
  1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5,
  1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5,
  1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5,
];
const CW_SUM = COL_CW.reduce((a, b) => a + b, 0);

const CX: number[] = [];
let _cx = ML;
for (const w of COL_CW) { CX.push(_cx); _cx += (w / CW_SUM) * TW; }
CX.push(ML + TW);

const cx = (c: number) => CX[c];
const cw = (s: number, e: number) => CX[e + 1] - CX[s];

// Row heights (83 rows)
const ROW_HT = [
  0,
  5, 5, 5, 9, 9, 9, 9, 5, 5, 5,     // 1-10 (rows 1-3,8-10 reduced from 9 to 5)
  5, 5, 9, 9, 9, 9,                   // 11-16 (rows 11-12 reduced from 9 to 5)
  13.5, 13.5, 13.5, 13.5, 13.5,       // 17-21: UNS info
  9, 9, 9, 9, 9,                      // 22-26: intro
  9, 9,                                // 27-28
  10.5,                                // 29
  9, 9, 9, 9, 9,                      // 30-34: 氏名
  9, 9, 9, 9,                         // 35-38: 性別
  9, 9, 9, 9, 9,                      // 39-43: 年齢
  9, 9, 9, 9, 9,                      // 44-48: 雇用期間
  9, 9, 9, 9, 9,                      // 49-53: 待遇決定方式
  9, 9, 9, 9, 9, 9, 9, 9, 9,         // 54-62: 健康保険
  9, 9, 9, 9, 9, 9, 9, 9, 9,         // 63-71: 厚生年金
  9, 9, 9, 9, 9, 9, 9, 9,            // 72-79: 雇用保険
  9, 9, 9, 9,                         // 80-83: 確認書類
];

const TOTAL_RH = ROW_HT.reduce((a, b) => a + b, 0);
const AVAIL_H = PH - MT - MB;
const YS = AVAIL_H / TOTAL_RH;

const RY: number[] = [0];
let _ry2 = MT;
for (let i = 1; i < ROW_HT.length; i++) {
  RY.push(_ry2);
  _ry2 += ROW_HT[i] * YS;
}
RY.push(_ry2);

const ry = (r: number) => RY[r];
const rh = (s: number, e: number) => RY[e + 1] - RY[s];

// ─── CELL DRAWING (per-side borders) ────────────────────────────────

function cell(
  doc: Doc,
  r1: number, c1: number, r2: number, c2: number,
  text: string, fs: number = 7, opts: CellOpts = {}
) {
  const x = cx(c1), y = ry(r1), w = cw(c1, c2), h = rh(r1, r2);
  const { align = "left", valign = "center", wrap = true, bT, bB, bL, bR, bW = 0.14, font } = opts;
  if (font) doc.font(font);
  const pad = 2;

  // Per-side hair borders — 0.14pt black, round cap/join (matches reference PDF)
  doc.strokeColor("#000").lineWidth(bW).lineJoin("round").lineCap("round");
  if (bT) doc.moveTo(x, y).lineTo(x + w, y).stroke();
  if (bB) doc.moveTo(x, y + h).lineTo(x + w, y + h).stroke();
  if (bL) doc.moveTo(x, y).lineTo(x, y + h).stroke();
  if (bR) doc.moveTo(x + w, y).lineTo(x + w, y + h).stroke();

  if (!text) return;

  const tw = w - pad * 2;
  let size = fs;
  const minSize = 3;
  while (size > minSize) {
    doc.fontSize(size);
    const th = doc.heightOfString(text, { width: tw });
    if (th <= h - pad) break;
    size -= 0.5;
  }

  doc.fontSize(size).fillColor("#000");
  const th = doc.heightOfString(text, { width: tw });
  const ty = valign === "top" ? y + pad : y + Math.max((h - th) / 2, pad);

  doc.save();
  doc.rect(x, y, w, h).clip();
  if (opts.bg === "bold") {
    // Simulate bold: fill + thin stroke
    doc.fillColor("#000").strokeColor("#000").lineWidth(0.3);
    (doc as unknown as { addContent: (s: string) => void }).addContent("2 Tr"); // fill+stroke mode
    doc.text(text, x + pad, ty, { width: tw, align, lineBreak: wrap });
    (doc as unknown as { addContent: (s: string) => void }).addContent("0 Tr"); // reset to fill
  } else {
    doc.text(text, x + pad, ty, { width: tw, align, lineBreak: wrap });
  }
  doc.restore();
}

// ─── DATE FORMATTING ────────────────────────────────────────────────


// ─── MAIN GENERATOR (one page per employee) ──────────────────────────

export function generateKoritsuTsuchishoPDF(doc: Doc, data: KoritsuTsuchishoData): void {
  // Register Koritsu-specific fonts
  const fontDir = path.join(__dirname, "fonts");
  const gothicPath = path.join(fontDir, "MSGothic.ttf");
  const minchoPath = path.join(fontDir, "MSMincho.ttf");
  if (fs.existsSync(gothicPath)) doc.registerFont("Gothic", gothicPath);
  if (fs.existsSync(minchoPath)) doc.registerFont("Mincho", minchoPath);
  doc.font("Gothic");

  for (let ei = 0; ei < data.employees.length; ei++) {
    if (ei > 0) doc.addPage();
    const emp = data.employees[ei];

    const kanaName = emp.katakanaName || emp.fullName;
    const hireRef = getHireReference(emp.actualHireDate || null, emp.hireDate || null);
    const age = calculateAge(emp.birthDate || null, data.startDate);
    const isIndefEmp = isIndefiniteEmployment(hireRef, data.endDate);
    const isMale = emp.gender === "男" || emp.gender === "male";

    // ═══ ROWS 4-6: Title (no borders) ═══
    cell(doc, 4, 16, 6, 44, "派　遣　先　通　知　書", 16, { align: "center", font: "Mincho" });

    // ═══ ROW 6: Contract number (right-aligned) ═══
    cell(doc, 6, 49, 6, 59, data.contractNumber, 8);

    // ═══ ROW 7: Date (right-aligned, same start col) ═══
    cell(doc, 7, 49, 7, 59, formatDateJP(data.contractDate), 8);

    // ═══ ROWS 13-15: 宛名 (no borders) ═══
    cell(doc, 13, 4, 15, 20, `${data.companyName}　御中`, 11);

    // ═══ ROWS 17-21: UNS info (no borders) ═══
    const unsAddr = data.managerUnsAddress ?? "愛知県名古屋市東区徳川2丁目18-18";
    const unsCompanyName = UNS.name;
    const unsRepresentative = "中山　雅和";
    const unsLicense = "(派）23-303669";

    cell(doc, 17, 32, 18, 38, "（所在地）", 9, { align: "right" });
    cell(doc, 17, 39, 18, 59, unsAddr, 9);
    cell(doc, 19, 32, 19, 38, "（事業所名）", 9, { align: "right" });
    cell(doc, 19, 39, 19, 59, unsCompanyName, 9);
    cell(doc, 20, 32, 20, 38, "（代表者名）", 9, { align: "right" });
    cell(doc, 20, 39, 20, 59, unsRepresentative, 9);
    cell(doc, 21, 32, 21, 38, "（許可番号）", 9, { align: "right" });
    cell(doc, 21, 39, 21, 59, unsLicense, 9);

    // ═══ ROWS 26-27: Intro (no borders) ═══
    cell(doc, 26, 4, 27, 59, `${formatDateJP(data.contractDate)} に締結した労働者派遣契約（契約 №. ${data.contractNumber}）に基づき下記の者を派遣致します。`, 9);

    // ═══ ROWS 29-33: 氏名 ═══
    cell(doc, 29, 4, 33, 15, "氏名", 10, { align: "center", bg: "bold", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 29, 16, 33, 59, kanaName, 10, { bT: true, bB: true, bR: true });

    // ═══ ROWS 34-38: 性別 ═══
    cell(doc, 34, 4, 38, 15, "性別", 10, { align: "center", bg: "bold", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 34, 16, 38, 59, isMale ? "男性" : "女性", 10, { bT: true, bB: true, bR: true });

    // ═══ ROWS 39-43: 年齢 ═══
    cell(doc, 39, 4, 43, 15, "年齢に関する項目", 9, { align: "center", bg: "bold", bT: true, bB: true, bL: true, bR: true });
    const is60 = age >= 60;
    const is45 = age >= 45 && age < 60;
    const is18to44 = age >= 18 && age < 45;
    const is18u = age < 18;
    cell(doc, 39, 16, 43, 37,
      `${is60 ? "☑" : "□"} 60才以上　${is45 ? "☑" : "□"} 45才以上～60才未満`, 9, { bT: true, bB: true });
    cell(doc, 39, 38, 43, 59,
      `${is18to44 ? "☑" : "□"} 18才以上～45才未満　${is18u ? "☑" : "□"} 18才未満\n（　${age}才）`, 8, { bT: true, bB: true, bR: true });

    // ═══ ROWS 44-48: 雇用期間 ═══
    const startD = parseDate(data.startDate);
    const endD = parseDate(data.endDate);
    const durationMonths = (endD.getFullYear() - startD.getFullYear()) * 12
      + (endD.getMonth() - startD.getMonth())
      + (endD.getDate() > startD.getDate() ? 1 : 0);
    const durationText = durationMonths > 0 ? `${durationMonths}ヶ月契約` : "契約";

    cell(doc, 44, 4, 48, 15, "雇用期間", 10, { align: "center", bg: "bold", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 44, 16, 48, 59,
      `${isIndefEmp ? "☑" : "□"} 無期雇用　　${isIndefEmp ? "□" : "☑"} 有期雇用　（${durationText}）`, 9, { bT: true, bB: true, bR: true });

    // ═══ ROWS 49-53: 待遇決定方式 ═══
    cell(doc, 49, 4, 53, 15, "待遇決定方式", 9, { align: "center", bg: "bold", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 49, 16, 53, 59,
      "☑ 協定対象派遣労働者　　 □ 協定対象派遣労働者ではない\n　　（労使協定方式）　　    　（派遣先均等・均衡方式）", 8, { bT: true, bB: true, bR: true });

    // ═══ ROWS 54-83: 社会保険 section ═══
    cell(doc, 54, 4, 83, 4, "", 0, { bT: true, bB: true, bL: true });
    cell(doc, 54, 5, 83, 15,
      "労働・社会保険の\n被　保険者資格取\n得届の提出の有無\n及び確認資料", 8, { align: "center", bg: "bold", wrap: true, bT: true, bB: true, bR: true });

    // ── 健康保険 (R54-62) ──
    cell(doc, 54, 16, 62, 24, "健康保険", 10, { align: "center", bT: true, bB: true, bR: true });
    cell(doc, 54, 25, 62, 31, "☑ 有", 10, { bT: true, bB: true, bR: true });
    cell(doc, 54, 32, 57, 59, "無の理由：", 9, { bT: true, bB: true, bR: true });
    cell(doc, 58, 32, 62, 59, "提出予定：", 9, { bT: true, bB: true, bR: true });

    // ── 厚生年金 (R63-71) ──
    cell(doc, 63, 16, 71, 24, "厚生年金保険", 10, { align: "center", bT: true, bB: true, bR: true });
    cell(doc, 63, 25, 71, 31, "☑ 有", 10, { bT: true, bB: true, bR: true });
    cell(doc, 63, 32, 66, 59, "無の理由：", 9, { bT: true, bB: true, bR: true });
    cell(doc, 67, 32, 71, 59, "提出予定：", 9, { bT: true, bB: true, bR: true });

    // ── 雇用保険 (R72-79) ──
    cell(doc, 72, 16, 79, 24, "雇用保険", 10, { align: "center", bT: true, bB: true, bR: true });
    cell(doc, 72, 25, 79, 31, "☑ 有", 10, { bT: true, bB: true, bR: true });
    cell(doc, 72, 32, 75, 59, "無の理由：", 9, { bT: true, bB: true, bR: true });
    cell(doc, 76, 32, 79, 59, "提出予定：", 9, { bT: true, bB: true, bR: true });

    // ── 確認書類 (R80-83) ──
    cell(doc, 80, 16, 83, 24, "確認書類", 10, { align: "center", bT: true, bB: true, bR: true });
    cell(doc, 80, 25, 83, 59, "（　被保険者証の写は後日送付予定）", 10, { bT: true, bB: true, bR: true });
  }

  // Restore default font for bundle compatibility
  doc.font("JP");
}
