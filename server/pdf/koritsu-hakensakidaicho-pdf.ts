/**
 * コーリツ 派遣先管理台帳 (Client-side Management Registry — Koritsu variant)
 *
 * GRID-BASED LAYOUT matching Excel template コーリツ個別契約セット等26年1月3月末.xlsm
 * Sheet: 派遣先管理台帳
 * 55 columns × 77 rows, A4 portrait
 *
 * Border spec from spec-daicho.json — per-side borders
 *
 * Key differences from standard hakensakikanridaicho-pdf.ts:
 * - Grid-based (vs flow-based), matching Koritsu Excel exactly
 * - Insurance section is vertical (健保/厚年/雇用) with 有/無/理由/提出予定
 * - 製造業務専門 labels for both 派遣先責任者 and 派遣元責任者
 * - 教育訓練 and 苦情対応 sections with explicit grid
 * - 派遣元責任者 uses UNS defaults
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
} from "./helpers.js";
import type { CellOpts } from "./types.js";
import type { BaseEmployeeWithDates } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── DATA INTERFACE ──────────────────────────────────────────────────

export interface KoritsuDaichoEmployee extends BaseEmployeeWithDates {
  isFirstContract?: boolean;
}

export interface KoritsuDaichoData {
  companyName: string;
  factoryName: string;
  factoryAddress: string;
  factoryPhone: string;
  department: string;
  lineName: string;
  contractNumber: string;
  contractDate: string;
  startDate: string;
  endDate: string;
  jobDescription: string;

  // People
  hakensakiManagerDept: string;
  hakensakiManagerTitle: string;
  hakensakiManagerName: string;
  hakensakiManagerPhone: string;

  // 派遣元 (defaults to UNS)
  managerUnsAddress?: string;
  managerUnsDept?: string;
  managerUnsName?: string;
  managerUnsPhone?: string;

  employees: KoritsuDaichoEmployee[];
}

// ─── GRID SYSTEM ─────────────────────────────────────────────────────

const PH = 841.89;
const ML = 20;
const MT = 10;
const MB = 20;
const TW = 555;

// Column widths from Excel (55 columns)
const COL_CW = [
  1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 2, 2, 1.625,
  1.625, 1.625, 1.625, 0.875, 2, 1.625, 1.625, 1.625, 1.625, 1.625,
  2.125, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625,
  1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625,
  1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625,
  1.625, 1.625, 1.625, 1.625, 2.125,
];
const CW_SUM = COL_CW.reduce((a, b) => a + b, 0);

const CX: number[] = [];
let _cx = ML;
for (const w of COL_CW) { CX.push(_cx); _cx += (w / CW_SUM) * TW; }
CX.push(ML + TW);

const cx = (c: number) => CX[c];
const cw = (s: number, e: number) => CX[e + 1] - CX[s];

// Row heights (77 rows)
const ROW_HT = [
  0,
  10,                             // 1: spacer (reduced from 18.75)
  8,                              // 2: spacer (reduced from 15)
  9, 9.75, 9.75,                  // 3-5: title area
  6, 6, 6,                        // 6-8: spacer (reduced from 9.75)
  9.75, 9.75,                     // 9-10: intro text
  9.75, 9.75,                     // 11-12: 氏名 (3-row merge in Excel)
  10.5,                           // 13: 氏名 cont (reduced from 15)
  9.75, 9.75,                     // 14-15: 性別/60才
  13.5, 13.5,                     // 16-17: 雇用保険
  13.5, 13.5,                     // 18-19: 健康保険
  13.5, 13.5,                     // 20-21: 厚生年金
  9, 9, 9,                        // 22-24: 派遣先事業所名称
  9, 9, 9,                        // 25-27: 事業所所在地 + 組織単位
  9.75, 9.75, 9.75,               // 28-30: 所属部署
  9.75, 9.75, 9.75,               // 31-33: 業務内容 + 雇用期間
  9.75, 9.75, 9.75,               // 34-36: 責任の程度
  9.75, 9.75, 9.75,               // 37-39: 派遣期間 + 限定
  9.75, 9.75, 9.75,               // 40-42: 製造業務専門派遣先責任者
  9.75, 9.75, 9.75,               // 43-45: 派遣元事業所名称
  9.75, 9.75, 9.75,               // 46-48: 派遣元所在地
  10.5, 10.5, 10.5,               // 49-51: 製造業務専門派遣元責任者
  9, 9, 9,                        // 52-54: 就業日 + 就業状況
  12,                             // 55: 教育訓練 (reduced from 15)
  12, 12, 12,                     // 56-58: 教育訓練 content (reduced from 15)
  12,                             // 59: 苦情header (reduced from 15)
  9, 9, 9, 9, 9, 9,              // 60-65: 苦情 応対者1
  9, 9, 9, 9, 9, 9,              // 66-71: 苦情 応対者2
  9, 9, 9, 9, 9,                 // 72-76: 苦情 応対者3
  9.75,                           // 77: footer
];

const TOTAL_RH = ROW_HT.reduce((a, b) => a + b, 0);
const AVAIL_H = PH - MT - MB;
const YS = AVAIL_H / TOTAL_RH;

const RY: number[] = [0];
let _ry = MT;
for (let i = 1; i < ROW_HT.length; i++) {
  RY.push(_ry);
  _ry += ROW_HT[i] * YS;
}
RY.push(_ry);

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
  doc.text(text, x + pad, ty, { width: tw, align, lineBreak: wrap });
  doc.restore();
}

// ─── DATE FORMATTING ────────────────────────────────────────────────


// ─── MAIN GENERATOR (one page per employee) ──────────────────────────

export function generateKoritsuDaichoPDF(doc: Doc, data: KoritsuDaichoData): void {
  const mgr = UNS.defaultManager;

  // Register Koritsu-specific fonts
  const fontDir = path.join(__dirname, "fonts");
  const gothicPath = path.join(fontDir, "MSGothic.ttf");
  const pminchoPath = path.join(fontDir, "MSPMincho.ttf");
  if (fs.existsSync(gothicPath)) doc.registerFont("Gothic", gothicPath);
  if (fs.existsSync(pminchoPath)) doc.registerFont("PMincho", pminchoPath);
  doc.font("Gothic");

  for (let ei = 0; ei < data.employees.length; ei++) {
    if (ei > 0) doc.addPage();
    const emp = data.employees[ei];

    const deptLine = `${data.factoryName} ${data.department} ${data.lineName}`.trim();
    const kanaName = emp.katakanaName || emp.fullName;
    const hireRef = getHireReference(emp.actualHireDate || null, emp.hireDate || null);
    const age = calculateAge(emp.birthDate || null, data.startDate);
    const isIndefEmp = isIndefiniteEmployment(hireRef, data.endDate);

    // ═══ ROWS 3-5: Title (no borders) ═══
    cell(doc, 3, 16, 5, 36, "派  遣  先  管  理  台  帳", 15, { align: "center", font: "PMincho" });
    cell(doc, 4, 43, 5, 46, "契約 No.", 7, { align: "right" });
    cell(doc, 4, 47, 5, 54, data.contractNumber, 8);

    // ═══ ROWS 9-10: Intro (single line, no borders) ═══
    cell(doc, 9, 2, 10, 54, `${formatDateJP(data.contractDate)} に締結した労働者派遣契約（契約 No.${data.contractNumber}）に基づき、下記のものを派遣致します。就業条件は個別契約書の条件と相違ありません。`, 7.5);

    // ═══ ROWS 11-13: 派遣労働者の氏名 ═══
    cell(doc, 11, 2, 13, 12, "派遣労働者の氏名", 7, { align: "center", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 11, 13, 13, 13, "", 0, { bT: true, bB: true, bL: true }); // spacer column N
    cell(doc, 11, 14, 13, 54, kanaName, 9, { bT: true, bB: true, bR: true });

    // ═══ ROWS 14-15: 性別 / 60才 ═══
    cell(doc, 14, 2, 15, 12, "性  別\n60才以上か否かの別", 6, { align: "center", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 14, 14, 15, 23, emp.gender === "男" || emp.gender === "male" ? "男性" : "女性", 8, { align: "center", bT: true });
    const is60 = age >= 60;
    cell(doc, 14, 24, 15, 54, `   　　　${is60 ? "☑" : "□"}60才以上       ${is60 ? "□" : "☑"} 60才未満`, 8, { bT: true, bB: true, bR: true });

    // ═══ ROWS 16-21: Insurance ═══
    // Row 16-17: header left + 雇用保険
    cell(doc, 16, 2, 17, 12, " 社会保険・雇用保険の被", 7, { align: "center", bT: true, bL: true, bR: true });
    cell(doc, 16, 13, 17, 19, " 雇用保険：", 8, { bT: true, bL: true });
    cell(doc, 16, 20, 17, 23, "☑ 有", 8, { bT: true });
    cell(doc, 16, 24, 17, 29, "無の理由：", 6, { bT: true });
    cell(doc, 16, 38, 17, 54, "提出予定：", 6, { bT: true, bR: true });

    // Row 18-19: cont left + 健康保険
    cell(doc, 18, 2, 19, 12, " 保険者資格取得届の提出", 7, { align: "center", bL: true, bR: true });
    cell(doc, 18, 13, 19, 19, " 健康保険：", 8, { bT: true, bL: true });
    cell(doc, 18, 20, 19, 23, "☑ 有", 8, { bT: true });
    cell(doc, 18, 24, 19, 29, "無の理由：", 6, { bT: true });
    cell(doc, 18, 30, 19, 37, "", 0, { bT: true }); // border filler
    cell(doc, 18, 38, 19, 54, "提出予定：", 6, { bT: true, bR: true });

    // Row 20-21: cont left + 厚生年金
    cell(doc, 20, 2, 21, 12, " の有無", 7, { align: "center", bB: true, bL: true, bR: true });
    cell(doc, 20, 13, 21, 19, " 厚生年金保険：", 8, { bT: true, bL: true, bB: true });
    cell(doc, 20, 20, 21, 23, "☑ 有", 8, { bT: true, bB: true });
    cell(doc, 20, 24, 21, 29, "無の理由：", 6, { bT: true, bB: true });
    cell(doc, 20, 30, 21, 37, "", 0, { bT: true, bB: true }); // border filler
    cell(doc, 20, 38, 21, 54, "提出予定：", 6, { bT: true, bR: true, bB: true });

    // ═══ ROWS 22-24: 派遣先事業所名称 ═══
    cell(doc, 22, 2, 24, 12, "派遣先の事業所名称", 8, { align: "center", bB: true, bL: true, bR: true });
    cell(doc, 22, 13, 24, 13, "", 0, { bT: true, bB: true, bL: true }); // spacer
    cell(doc, 22, 14, 24, 54, data.companyName, 8, { bT: true, bB: true, bR: true });

    // ═══ ROWS 25-27: 事業所所在地 + 組織単位 ═══
    cell(doc, 25, 2, 27, 12, "事業所の所在地", 8, { align: "center", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 25, 13, 27, 13, "", 0, { bT: true, bB: true, bL: true }); // spacer
    cell(doc, 25, 14, 27, 34, data.factoryAddress || "愛知県刈谷市小垣江町本郷下33番地3", 8, { bT: true });
    cell(doc, 25, 35, 27, 41, " 組織単位", 8, { align: "center", bL: true });
    cell(doc, 25, 42, 27, 54, `${data.factoryName} ${data.department}(課長)`, 8, { bL: true, bR: true, bB: true });

    // ═══ ROWS 28-30: 所属部署 ═══
    cell(doc, 28, 2, 30, 12, "所　属　部　署", 8, { align: "center", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 28, 13, 30, 13, "", 0, { bT: true, bB: true, bL: true }); // spacer
    cell(doc, 28, 14, 30, 40, deptLine, 8, { bT: true, bB: true });
    cell(doc, 28, 41, 30, 44, "TEL", 8, { align: "center", bT: true, bB: true });
    cell(doc, 28, 45, 30, 54, data.factoryPhone, 8, { bT: true, bB: true, bR: true });

    // ═══ ROWS 31-33: 業務内容 + 雇用期間 ═══
    cell(doc, 31, 2, 33, 12, "業　務　内　容", 8, { align: "center", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 31, 13, 33, 13, "", 0, { bT: true, bB: true, bL: true }); // spacer
    cell(doc, 31, 14, 33, 38, data.jobDescription, 8, { bT: true, bB: true });
    cell(doc, 31, 39, 33, 45, "雇用期間の有無", 6, { align: "center", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 31, 46, 33, 54,
      `${isIndefEmp ? "□" : "☑"} 有期雇用\n${isIndefEmp ? "☑" : "□"} 無期雇用`, 7, { bT: true, bB: true, bL: true, bR: true });

    // ═══ ROWS 34-36: 責任の程度 ═══
    cell(doc, 34, 2, 36, 12, "業務に伴う責任の程度", 6, { align: "center", bB: true, bL: true, bR: true });
    cell(doc, 34, 13, 36, 13, "", 0, { bL: true }); // spacer, left only
    cell(doc, 34, 14, 36, 54, "☑ 付与される権限なし／□ 付与される権限あり（詳細：　　　　　　　　　　　　　　　　）", 8, { bB: true, bR: true });

    // ═══ ROWS 37-39: 派遣期間 + 限定 ═══
    cell(doc, 37, 2, 39, 12, "派　遣　期　間", 8, { align: "center", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 37, 13, 39, 13, "", 0, { bT: true, bB: true, bL: true }); // spacer
    cell(doc, 37, 14, 39, 20, formatDateJP(data.startDate), 8, { bT: true, bB: true });
    cell(doc, 37, 21, 39, 21, "～", 7, { align: "center", bT: true, bB: true });
    cell(doc, 37, 22, 39, 29, formatDateJP(data.endDate), 8, { bT: true, bB: true });
    cell(doc, 37, 30, 37, 54, "□無期雇用派遣労働者に限定／☑無期雇用派遣労働者に限定なし", 5, { bT: true, bL: true, bR: true });
    cell(doc, 38, 30, 38, 54, "□60歳以上に限定／☑60歳以上に限定なし", 5, { bL: true, bR: true });
    cell(doc, 39, 30, 39, 54, "☑協定対象労働者に限定／□協定対象労働者に限定なし", 5, { bB: true, bL: true, bR: true });

    // ═══ ROWS 40-42: 製造業務専門 派遣先責任者 ═══
    cell(doc, 40, 2, 42, 12, "製造業務専門\n派遣先責任者", 6, { align: "center", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 40, 13, 42, 13, "", 0, { bL: true }); // spacer, left only
    cell(doc, 40, 14, 42, 27, `${data.factoryName} ${data.department}`, 8, { bB: true });
    cell(doc, 40, 28, 42, 30, data.hakensakiManagerTitle, 8, { align: "center", bB: true });
    cell(doc, 40, 32, 42, 40, data.hakensakiManagerName, 8, { bB: true });
    cell(doc, 40, 41, 42, 44, "TEL", 8, { align: "center", bB: true });
    cell(doc, 40, 45, 42, 54, data.hakensakiManagerPhone, 8, { bR: true, bB: true });

    // ═══ ROWS 43-45: 派遣元事業所名称 ═══
    const unsCompany = "ユニバーサル企画株式会社";
    const unsAddr = data.managerUnsAddress ?? "愛知県名古屋市東区徳川2丁目18-18";
    const unsLicense = "派23-303669";
    const unsPhone = data.managerUnsPhone ?? "052-938-8840";

    cell(doc, 43, 2, 45, 12, "派遣元の事業所名称", 8, { align: "center", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 43, 13, 45, 54,
      `  ${unsCompany}　　　　　　　　　　　　　　　　　　許可番号　${unsLicense}`, 9, { bT: true, bL: true, bR: true, bB: true });

    // ═══ ROWS 46-48: 派遣元所在地 ═══
    cell(doc, 46, 2, 48, 12, "派遣元の所在地", 8, { align: "center", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 46, 13, 48, 54, ` ${unsAddr}`, 9, { bT: true, bL: true, bR: true, bB: true });

    // ═══ ROWS 49-51: 製造業務専門 派遣元責任者 ═══
    const unsDept = data.managerUnsDept ?? `${mgr.dept}　${mgr.role}`;
    const unsName = data.managerUnsName ?? mgr.name;

    cell(doc, 49, 2, 51, 12, "製造業務専門\n派遣元責任者", 7, { align: "center", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 49, 13, 51, 13, "", 0, { bT: true, bB: true, bL: true }); // spacer
    cell(doc, 49, 14, 51, 25, unsDept, 9, { bT: true, bB: true });
    cell(doc, 49, 26, 51, 40, unsName, 9, { bT: true, bB: true });
    cell(doc, 49, 41, 51, 44, "TEL", 8, { align: "center", bT: true });
    cell(doc, 49, 45, 51, 54, unsPhone, 8, { bT: true, bR: true, bB: true });

    // ═══ ROWS 52-54: 就業日 + 就業状況 ═══
    cell(doc, 52, 2, 54, 12, "就   業   日", 8, { align: "center", bB: true, bL: true, bR: true });
    cell(doc, 52, 14, 54, 30, "派遣先の年間カレンダーによる", 8, { bT: true });
    cell(doc, 52, 31, 54, 37, "就業状況", 8, { align: "center", bT: true, bL: true });
    cell(doc, 52, 38, 54, 54, " 別紙タイムカード通り", 8, { bT: true, bL: true, bR: true, bB: true });

    // ═══ ROW 55: 教育訓練 header ═══
    cell(doc, 55, 2, 55, 54, " 教育訓練を行った日時と内容", 7, { bT: true, bB: true, bL: true, bR: true });

    // ═══ ROWS 56-58: 教育訓練 content (empty boxes) ═══
    cell(doc, 56, 2, 56, 54, "", 7, { bT: true, bB: true, bL: true, bR: true });
    cell(doc, 57, 2, 57, 54, "", 7, { bT: true, bB: true, bL: true, bR: true });
    cell(doc, 58, 2, 58, 54, "", 7, { bT: true, bB: true, bL: true, bR: true });

    // ═══ ROWS 59-76: 苦情対応の状況 ═══
    cell(doc, 59, 2, 76, 4, "苦情対応の状況", 6, { align: "center", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 59, 5, 59, 15, "申出を受けた日", 7, { align: "center", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 59, 16, 59, 54, "苦情内容、処理状況、備考", 7, { align: "center", bT: true, bB: true, bR: true });

    // 申出① + 応対者1 (rows 60-65)
    cell(doc, 60, 5, 65, 7, "申出\n①", 6, { align: "center", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 60, 8, 65, 15, "応対者１", 7, { bT: true, bB: true, bR: true });
    cell(doc, 60, 16, 62, 54, "", 7, { bT: true, bB: true, bR: true });
    cell(doc, 63, 16, 65, 54, "", 7, { bT: true, bB: true, bR: true });

    // 申出② + 応対者2 (rows 66-71)
    cell(doc, 66, 5, 71, 7, "申出\n②", 6, { align: "center", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 66, 8, 71, 15, "応対者２", 7, { bT: true, bB: true, bR: true });
    cell(doc, 66, 16, 68, 54, "", 7, { bT: true, bB: true, bR: true });
    cell(doc, 69, 16, 71, 54, "", 7, { bT: true, bB: true, bR: true });

    // 申出③ + 応対者3 (rows 72-76)
    cell(doc, 72, 5, 76, 7, "申出\n③", 6, { align: "center", bT: true, bB: true, bL: true, bR: true });
    cell(doc, 72, 8, 76, 15, "応対者３", 7, { bT: true, bB: true, bR: true });
    cell(doc, 72, 16, 74, 54, "", 7, { bT: true, bB: true, bR: true });
    cell(doc, 75, 16, 76, 54, "", 7, { bT: true, bB: true, bR: true });

    // ═══ ROW 77: Footer ═══
    cell(doc, 77, 3, 77, 16, "【労働者派遣終了後３年間保存】", 7, { bT: true });
  }

  // Restore default font for bundle compatibility
  doc.font("JP");
}
