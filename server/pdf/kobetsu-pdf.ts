/**
 * 個別契約書 (Individual Dispatch Contract) — A4 single-page PDF
 *
 * GRID-BASED LAYOUT matching Excel template 個別契約書TEXPERT2026.1
 * 27 columns (A-AA) × 64 rows, A4 portrait
 */
import { type Doc, UNS, yen, getTakaoJigyosho, formatDateJP, compactTimeFormat } from "./helpers.js";
import type { CellOpts } from "./types.js";
import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";

// Company seal (印鑑) — UNS 実印 PNG tinted to 朱肉 vermilion red at module load
const INKAN_PATH = path.join("server", "pdf", "fonts", "InkanUNS-transparent.png");
const inkanAbsPathInit = path.resolve(INKAN_PATH);
// Top-level await (ESM) — processed once, reused across all PDF generations
const tintedInkanBuffer: Buffer | null = fs.existsSync(inkanAbsPathInit)
  ? await sharp(inkanAbsPathInit).tint({ r: 185, g: 30, b: 40 }).png().toBuffer()
  : null;

// ─── DATA INTERFACE ──────────────────────────────────────────────────

export interface KobetsuData {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  factoryName: string;
  factoryAddress: string;
  factoryPhone?: string;
  department: string;
  lineName: string;
  conflictDate: string;

  supervisorDept: string;
  supervisorName: string;
  supervisorPhone: string;
  complaintClientDept: string;
  complaintClientName: string;
  complaintClientPhone: string;
  complaintUnsDept: string;
  complaintUnsName: string;
  complaintUnsPhone: string;
  managerUnsDept: string;
  managerUnsName: string;
  managerUnsPhone: string;

  // Fix #3: 派遣先責任者 (separate from 指揮命令者)
  hakensakiManagerDept: string;
  hakensakiManagerName: string;
  hakensakiManagerPhone: string;

  jobDescription: string;
  responsibilityLevel: string;
  startDate: string;
  endDate: string;
  employeeCount: number;
  calendar: string;
  workHours: string;
  breakTime: string;
  overtimeOutsideDays: string;
  overtimeHours: string;

  hourlyRate: number;
  timeUnit: string;

  closingDay: string;
  paymentDay: string;
  bankAccount: string;

  contractDate: string;
  isKyoteiTaisho: boolean;
  welfare: string;
}

// ─── GRID SYSTEM ─────────────────────────────────────────────────────
// Maps Excel 27-col × 64-row grid to PDF A4 coordinates.
// Excel: A4 portrait, L=0.59in R=0.31in T=0.16in B=0, scale≈91% to fit.

// A4 dimensions in points
const PH = 841.89;
const ML = 30;   // balanced left margin
const MT = 11;
const MB = 15;   // bottom margin — prevents PDFKit auto-pagination
const TW = 535;  // wider grid, right margin ≈ 30pt (balanced)

// Column character widths: A=4.5 (wider for side label), B=13.5 (wider for 派遣先/派遣元/派遣内容),
// C-Z=11.25 each (compensates total), AA=4.625. Total kept at 292.625.
const COL_CW = [4.5, 13.5, 11.25, 11.25, 11.25, 11.25, 11.25,
  11.25, 11.25, 11.25, 11.25, 11.25, 11.25, 11.25, 11.25, 11.25,
  11.25, 11.25, 11.25, 11.25, 11.25, 11.25, 11.25, 11.25, 11.25,
  11.25, 4.625];
const CW_SUM = 292.625;

// Pre-compute column x-positions (index 0=A ... 26=AA, 27=right edge)
const CX: number[] = [];
let _cx = ML;
for (const w of COL_CW) { CX.push(_cx); _cx += (w / CW_SUM) * TW; }
CX.push(ML + TW);

const cx = (c: number) => CX[c];
const cw = (s: number, e: number) => CX[e + 1] - CX[s];

// Row heights from Excel (1-indexed, points)
const RH_LIST: number[] = [
  0,      // placeholder index 0
  29.25,  // 1  title
  17.25,  // 2  intro
  13.5,   // 3  intro cont
  15.75, 15.75, 15.75, 15.75, 15.75, 15.75,  // 4-9 派遣先
  15.75, 15.75,  // 10-11 派遣元
  13.5, 13.5,    // 12-13 協定
  18.75,         // 14 責任の程度
  28,            // 15 業務内容 (taller for multiline content)
  15.75,         // 16 派遣期間
  15.75,         // 17 就業日
  12, 12, 12, 12,    // 18-21 就業時間 (9→12: more room for 9-shift factories)
  12, 12, 12, 12,    // 22-25 休憩時間 (9→12: more room for break details)
  15.75,         // 26 就業日外労働
  13.5, 8.25,    // 27-28 時間外労働
  13.5, 13.5, 13.5,  // 29-31 派遣料金
  15, 13.5,      // 32-33 支払い
  20.25, 11.25,  // 34-35 安全・衛生
  24.75,         // 36 便宜供与
  9.75, 15, 15, 34.5,  // 37-40 苦情処理
  10.5, 16,      // 41-42 契約解除(1) — reduced from 18
  11.5, 11.5,    // 43-44 契約解除(2) — reduced from 13.5
  11.5, 11.5, 11.5, 11.5, 11.5, 11.5, 8,  // 45-51 契約解除(3) — reduced
  11.5, 11.5,    // 52-53 契約解除(4) — reduced
  13.5, 13.5,    // 54-55 紛争防止
  13.5, 13.5,    // 56-57 無期雇用
  15,            // 58 署名文
  14.25,         // 59 契約日
  13.5, 13.5, 13.5, 13.5, 13.5,  // 60-64 署名
];

const TOTAL_RH = RH_LIST.reduce((a, b) => a + b, 0);
const AVAIL_H = PH - MT - MB;
const YS = AVAIL_H / TOTAL_RH;

// Pre-compute row y-positions (1-indexed)
const RY: number[] = [0];
let _ry = MT;
for (let i = 1; i < RH_LIST.length; i++) {
  RY.push(_ry);
  _ry += RH_LIST[i] * YS;
}
RY.push(_ry);

const ry = (r: number) => RY[r];
const rh = (s: number, e: number) => RY[e + 1] - RY[s];

// ─── CELL DRAWING ────────────────────────────────────────────────────

function cell(
  doc: Doc,
  r1: number, c1: number, r2: number, c2: number,
  text: string, fs: number = 7, opts: CellOpts = {}
) {
  const x = cx(c1), y = ry(r1), w = cw(c1, c2), h = rh(r1, r2);
  const { align = "left", valign = "center", wrap = true, noBorder = false } = opts;
  const pad = 2;

  // Draw cell border
  if (!noBorder) doc.lineWidth(0.4).rect(x, y, w, h).stroke();

  if (!text) return;

  const tw = w - pad * 2; // text area width

  // ── Auto-fit: shrink font until text fits cell height ──
  let size = fs;
  const minSize = 3;
  while (size > minSize) {
    doc.fontSize(size);
    const th = doc.heightOfString(text, { width: tw });
    if (th <= h - pad) break;
    size -= 0.5;
  }

  doc.fontSize(size).fillColor("#000");

  // Measure final text height for vertical centering
  const th = doc.heightOfString(text, { width: tw });
  const ty = valign === "top" ? y + pad : y + Math.max((h - th) / 2, pad);

  // ── Clip to cell bounds (safety net) ──
  doc.save();
  doc.rect(x, y, w, h).clip();

  doc.text(text, x + pad, ty, {
    width: tw,
    align,
    lineBreak: wrap,
  });

  // Faux bold: redraw with slight offset for weight simulation
  if (opts.bold) {
    doc.text(text, x + pad + 0.3, ty, {
      width: tw,
      align,
      lineBreak: wrap,
    });
  }

  doc.restore();
}

/** Person row: label + outer border only, text distributed at column positions */
function personRow(
  doc: Doc, row: number,
  label: string, dept: string, name: string, phone: string
) {
  cell(doc, row, 2, row, 6, label, 7.5, { align: "center" });
  // Single outer border for content area
  doc.lineWidth(0.4).rect(cx(7), ry(row), cw(7, 26), rh(row, row)).stroke();
  // Distributed text — no internal borders
  cell(doc, row, 7, row, 8, "部署", 7.5, { align: "center", noBorder: true });
  cell(doc, row, 9, row, 13, dept, 8, { noBorder: true });
  cell(doc, row, 14, row, 15, "役職", 7.5, { align: "center", noBorder: true });
  cell(doc, row, 16, row, 22, name, 8, { noBorder: true });
  cell(doc, row, 23, row, 23, "TEL", 7.5, { noBorder: true });
  cell(doc, row, 24, row, 26, phone, 8, { noBorder: true });
}

/** Legal text row: label(C-G) merged across multiple rows | value(H-AA) merged */
function legalBlock(
  doc: Doc,
  r1: number, r2l: number, r2v: number, c2v: number,
  label: string, text: string, labelFs: number = 7.5, textFs: number = 7
) {
  cell(doc, r1, 2, r2l, 6, label, labelFs, { align: "center", wrap: true });
  cell(doc, r1, 7, r2v, c2v, text, textFs, { valign: "top", wrap: true });
}

// ─── STATIC LEGAL TEXT ───────────────────────────────────────────────

const ANZEN = "派遣先及び派遣元事業主は、労働者派遣法第４４条から第４７条の２までの規定により課された各法令を順守し、自己に課された法令上の責任を負う。なお、派遣就業中の安全及び衛生については、派遣先の安全衛生に関する規定を適用することとし、その他については、派遣元の安全衛生に関する規定を適用する。";

const BENGI = "派遣先は、派遣労働者に対して利用の機会を与える給食施設、休憩室、及び更衣室については、本契約に基づく労働者派遣に係る派遣労働者に対しても、利用の機会を与えるように配慮しなければならないこととする。";

const KUJO = "(1)派遣元事業主における苦情処理担当者が苦情の申し出を受けたときは、ただちに製造業務専門派遣元責任者へ連絡することとし、当該派遣元責任者が中心となって、誠意をもって、遅滞なく、当該苦情の適切迅速な処理を図ることとし、その結果について必ず派遣労働者に通知することとする。\n(2)派遣先における苦情処理担当者が苦情の申し出を受けたときは、ただちに製造業務専門派遣先責任者へ連絡することとし、当該派遣先責任者が中心となって、誠意をもって、遅滞なく、当該苦情の適切かつ迅速な処理を図ることとし、その結果については必ず派遣労働者に通知することとする。\n(3)派遣先及び派遣元事業主は、自らでその解決が容易であり、即時に処理した苦情の他は、相互に遅滞なく通知するとともに、密接に連絡調整を行いつつ、その解決を図ることとする。";

const KAIJO_1 = "（１）労働者派遣契約の解除の事前申し入れ\u3000派遣先は、専ら派遣先に起因する事由により、労働者派遣契約の契約期間が満了する前の解除を行おうとする場合には、派遣元の合意を得ることはもとより、あらかじめ相当の猶予期間をもって派遣元に解除の申し入れを行うこととする。";

const KAIJO_2 = "（２）就業機会の確保\u3000派遣元事業主及び派遣先は、労働者派遣契約の契約期間が満了する前に派遣労働者の責に帰すべき事由によらない労働者派遣契約の解除を行った場合には、派遣先の関連会社での就業をあっせんする等により、当該労働者派遣契約に係る派遣労働者の新たな就業機会の確保を図ることとする。";

const KAIJO_3 = "（３）損害賠償等に係る適切な措置\u3000派遣先は、派遣先の責に帰すべき事由により労働者派遣契約の契約期間が満了する前に労働者派遣契約の解除を行おうとする場合には、派遣労働者の新たな就業機会の確保を図ることとし、これができないときには、少なくとも当該労働者派遣契約の解除に伴い派遣元事業主が当該労働者派遣に係る派遣労働者を休業させること等を余儀なくされたことにより生じた損害の賠償を行わなければならないこととする。例えば、派遣元事業主が当該派遣労働者を休業させる場合は、休業手当に相当する額以上の額について、派遣元事業主がやむを得ない事由により当該派遣労働者を解雇する場合は、派遣先による解除の申し入れが相当の猶予期間をもって行われなかったことにより派遣元事業主が解雇の予告をしないときは、３０日分以上、当該予告をした日から解雇の日までの期間が３０日に満たないときは当該解雇の日の３０日前の日から当該予告の日までの日数分以上の賃金に相当する額以上の額について、損害の賠償を行わなければならないこととする。その他派遣先は派遣元事業主と十分に協議した上で適切な善後処理方策を講ずることとする。また、派遣元事業主及び派遣先の双方の責に帰すべき事由がある場合には、派遣元事業主及び派遣先のそれぞれの責に帰すべき部分の割合についても十分に考慮することとする。";

const KAIJO_4 = "（４）労働者派遣契約の解除の理由の明示\u3000派遣先は、労働者派遣契約の契約期間が満了する前に労働者派遣契約の解除を行おうとする場合であって派遣元事業主から請求があったときは、労働者派遣契約の解除を行った理由を派遣元事業主に対してあきらかにすることとする。";

const FUNSO = "派遣先が派遣終了後に、当該派遣労働者を雇用する場合、その雇用意思を事前に派遣元へ示すこととする。";

const MUKI = "無期雇用又は６０歳以上に限定しない。";

// ─── DATE FORMATTING ────────────────────────────────────────────────

/** Strip postal code (〒xxx-xxxx or 〒xxxxxxx) from address */
function stripPostalCode(addr: string): string {
  if (!addr) return "";
  return addr.replace(/〒?\s*\d{3}-?\d{4}\s*/g, "").trim();
}

/** Convert "YYYY-MM-DD" → "YYYY年MM月DD日" */

// ─── MULTI-SHIFT LAYOUT ─────────────────────────────────────────────
// Smart adaptive layout: measures text against available space, then picks
// the best combination of columns + font size + text format.
// Strategy: try simplest layout first, progressively degrade until it fits.

function renderMultiShift(doc: Doc, text: string, r1: number, r2: number) {
  const lines = text.split("\n").filter(Boolean);
  if (lines.length === 0) {
    cell(doc, r1, 7, r2, 26, "", 8);
    return;
  }

  // ≤2 shifts: single cell — always fits
  if (lines.length <= 2) {
    cell(doc, r1, 7, r2, 26, text, 8, { valign: "center", wrap: true });
    return;
  }

  // 3+ shifts: try progressively denser layouts until one fits
  const x = cx(7), y = ry(r1), w = cw(7, 26), h = rh(r1, r2);
  // Compact times: "7時00分" → "7:00"
  const compactLines = lines.map(l => compactTimeFormat(l));
  // Strip redundant "　合計XX分" suffix (the parenthetical duration is kept)
  const trimmedLines = compactLines.map(l => l.replace(/\s*合計\d+分$/, ""));

  // Layout attempts: keep full detail, just shrink font progressively
  // For 7+ shifts, skip 2-col (looks unbalanced) — go straight to 3-col
  const use3col = lines.length >= 7;
  const attempts: { lines: string[]; cols: number; fs: number }[] = use3col ? [
    { lines: trimmedLines, cols: 3, fs: 6.5 },
    { lines: trimmedLines, cols: 3, fs: 6 },
    { lines: trimmedLines, cols: 3, fs: 5.5 },
    { lines: trimmedLines, cols: 3, fs: 5 },
    { lines: trimmedLines, cols: 3, fs: 4.5 },
    { lines: trimmedLines, cols: 3, fs: 4 },
  ] : [
    { lines, cols: 2, fs: 7.5 },
    { lines: compactLines, cols: 2, fs: 7.5 },
    { lines: trimmedLines, cols: 2, fs: 7.5 },
    { lines: trimmedLines, cols: 3, fs: 7 },
    { lines: trimmedLines, cols: 2, fs: 6.5 },
    { lines: trimmedLines, cols: 3, fs: 6.5 },
    { lines: trimmedLines, cols: 3, fs: 6 },
    { lines: trimmedLines, cols: 3, fs: 5.5 },
    { lines: trimmedLines, cols: 3, fs: 5 },
    { lines: trimmedLines, cols: 3, fs: 4.5 },
  ];

  for (const attempt of attempts) {
    if (tryColumnLayout(doc, attempt.lines, x, y, w, h, attempt.cols, attempt.fs)) return;
  }

  // Final fallback: 3-col forced at 4pt
  tryColumnLayout(doc, trimmedLines, x, y, w, h, 3, 4, true);
}

/** Try rendering lines in N columns. Returns true if text fits without overflow.
 *  Uses balanced distribution: splits lines so columns have equal or near-equal
 *  counts, with the first column(s) getting fewer items (shorter lines first). */
function tryColumnLayout(
  doc: Doc, lines: string[],
  x: number, y: number, totalW: number, totalH: number,
  cols: number, fontSize: number, force = false
): boolean {
  const pad = 2;
  // Balanced distribution: first columns get floor, last get ceil
  // e.g. 9 lines / 2 cols → [4, 5] instead of [5, 4]
  const base = Math.floor(lines.length / cols);
  const extra = lines.length % cols;
  const colSizes: number[] = [];
  for (let c = 0; c < cols; c++) {
    colSizes.push(base + (c >= cols - extra ? 1 : 0));
  }

  // Build column slices
  const colSlices: string[][] = [];
  let offset = 0;
  for (let c = 0; c < cols; c++) {
    colSlices.push(lines.slice(offset, offset + colSizes[c]));
    offset += colSizes[c];
  }

  // Measure: find tallest column — reject if ANY single line wraps
  doc.fontSize(fontSize);
  let maxColH = 0;
  const colW = totalW / cols;
  const usableW = colW - pad * 2;
  for (let c = 0; c < cols; c++) {
    if (!colSlices[c].length) continue;
    // Check each line individually: if it wraps, this layout doesn't fit
    if (!force) {
      for (const singleLine of colSlices[c]) {
        const lineH = doc.heightOfString(singleLine, { width: usableW });
        const singleLineH = doc.heightOfString("X", { width: usableW });
        if (lineH > singleLineH * 1.3) return false; // line wraps → reject
      }
    }
    const colText = colSlices[c].join("\n");
    const th = doc.heightOfString(colText, { width: usableW });
    maxColH = Math.max(maxColH, th);
  }

  if (maxColH > totalH - pad && !force) return false;

  // Draw outer border
  doc.lineWidth(0.4).rect(x, y, totalW, totalH).stroke();

  // Render each column
  for (let c = 0; c < cols; c++) {
    if (!colSlices[c].length) continue;
    const colText = colSlices[c].join("\n");
    const colX = x + c * colW;

    doc.save();
    doc.rect(colX, y, colW, totalH).clip();

    doc.fontSize(fontSize).fillColor("#000");
    const th = doc.heightOfString(colText, { width: colW - pad * 2 });
    const ty = y + Math.max((totalH - th) / 2, pad);
    doc.text(colText, colX + pad, ty, { width: colW - pad * 2 });

    doc.restore();
  }

  return true;
}

// ─── MAIN GENERATOR ─────────────────────────────────────────────────

export function generateKobetsuPDF(doc: Doc, data: KobetsuData): void {
  const rate = data.hourlyRate;
  const mgr = UNS.defaultManager;

  // ═══ ROW 1: Title — no border ═══
  cell(doc, 1, 0, 1, 26, "人材派遣個別契約書", 13, { align: "center", noBorder: true });

  // ═══ ROWS 2-3: Intro text — no border ═══
  const intro = `${data.companyName}（以下、「甲」という）とユニバーサル企画株式会社（以下、「乙」という）間で締結された労働者派遣基本契約書に従い、次の派遣要件に基づき労働者派遣契約書を締結する。`;
  cell(doc, 2, 0, 3, 26, intro, 8.5, { wrap: true, noBorder: true });

  // ═══ ROWS 4-9: 派遣先 ═══
  cell(doc, 4, 0, 9, 1, "派遣先", 8, { align: "center", wrap: true });

  // Row 4: 派遣先事業所 — outer border only, text distributed
  cell(doc, 4, 2, 4, 6, "派遣先事業所", 7.5, { align: "center" });
  doc.lineWidth(0.4).rect(cx(7), ry(4), cw(7, 26), rh(4, 4)).stroke();
  cell(doc, 4, 7, 4, 7, "名称", 7.5, { align: "center", noBorder: true });
  cell(doc, 4, 8, 4, 13, data.companyName, 8, { noBorder: true });
  cell(doc, 4, 14, 4, 15, "所在地", 7.5, { align: "center", noBorder: true });
  cell(doc, 4, 16, 4, 22, stripPostalCode(data.companyAddress), 8, { noBorder: true });
  cell(doc, 4, 23, 4, 23, "TEL", 7.5, { noBorder: true });
  cell(doc, 4, 24, 4, 26, data.companyPhone, 8, { noBorder: true });

  // Row 5: 就業場所 — outer border only, text distributed
  cell(doc, 5, 2, 5, 6, "就業場所", 7.5, { align: "center" });
  doc.lineWidth(0.4).rect(cx(7), ry(5), cw(7, 26), rh(5, 5)).stroke();
  cell(doc, 5, 7, 5, 7, "名称", 7.5, { align: "center", noBorder: true });
  const jigyosho = getTakaoJigyosho(data.companyName, data.factoryAddress);
  const shugyoName = jigyosho
    ? [data.companyName, jigyosho].filter(Boolean).join("　")
    : [data.companyName, data.factoryName].filter(Boolean).join("　");
  cell(doc, 5, 8, 5, 13, shugyoName, 8, { noBorder: true });
  cell(doc, 5, 14, 5, 15, "所在地", 7.5, { align: "center", noBorder: true });
  cell(doc, 5, 16, 5, 22, stripPostalCode(data.factoryAddress), 8, { noBorder: true });
  cell(doc, 5, 23, 5, 23, "TEL", 7.5, { noBorder: true });
  cell(doc, 5, 24, 5, 26, data.factoryPhone || data.companyPhone, 8, { noBorder: true });

  // Row 6: 組織単位 + 抵触日 (only 抵触日 has its own border)
  cell(doc, 6, 2, 6, 6, "組織単位", 7.5, { align: "center" });
  const soshikiText = jigyosho
    ? [jigyosho, data.factoryName, data.department].filter(Boolean).join("　")
    : data.department || "";
  cell(doc, 6, 7, 6, 13, soshikiText, 8, { align: "center" });
  cell(doc, 6, 14, 6, 15, "抵触日", 7.5, { align: "center" });
  cell(doc, 6, 16, 6, 26, formatDateJP(data.conflictDate), 8);

  // Rows 7-9: Person rows (派遣先 side)
  personRow(doc, 7, "指揮命令者", data.supervisorDept, data.supervisorName, data.supervisorPhone);
  personRow(doc, 8, "製造業務専門派遣先責任者", data.hakensakiManagerDept, data.hakensakiManagerName, data.hakensakiManagerPhone);
  personRow(doc, 9, "苦情処理担当者", data.complaintClientDept, data.complaintClientName, data.complaintClientPhone);

  // ═══ ROWS 10-11: 派遣元 ═══
  cell(doc, 10, 0, 11, 1, "派遣元", 8, { align: "center", wrap: true });

  personRow(doc, 10, "製造業務専門派遣元責任者",
    data.managerUnsDept || mgr.dept, data.managerUnsName || `${mgr.role}　${mgr.name}`, data.managerUnsPhone || mgr.phone);
  personRow(doc, 11, "苦情処理担当者",
    data.complaintUnsDept || mgr.dept, data.complaintUnsName || `${mgr.role}　${mgr.name}`, data.complaintUnsPhone || mgr.phone);

  // ═══ ROWS 12-57: 派遣内容 (side label — forced 2-line split: 派遣 / 内容) ═══
  cell(doc, 12, 0, 57, 1, "派遣\n内容", 8, { align: "center", wrap: true });

  // --- Rows 12-13: 協定対象 (checkboxes hardcoded: siempre primera opcion) ---
  cell(doc, 12, 2, 13, 6, "派遣労働者を協定対象労働者に限定するか否か", 7.5, { align: "center", wrap: true });
  cell(doc, 12, 7, 13, 26,
    "☑ 協定対象派遣労働者に限定　　　□ 限定なし", 8);

  // --- Row 14: 責任の程度 checkboxes (hardcoded: siempre 権限なし marcado) ---
  cell(doc, 14, 2, 14, 6, "派遣労働者の責任の程度", 7.5, { align: "center", wrap: true });
  cell(doc, 14, 7, 14, 26,
    "☑ 付与される権限なし　　　□ 付与される権限あり", 8);

  // --- Row 15: 業務内容 ---
  cell(doc, 15, 2, 15, 6, "業務内容", 7.5, { align: "center" });
  cell(doc, 15, 7, 15, 26, data.jobDescription, 8);

  // --- Row 16: 派遣期間 ---
  cell(doc, 16, 2, 16, 6, "派遣期間", 7.5, { align: "center" });
  cell(doc, 16, 7, 16, 20, `${formatDateJP(data.startDate)}　～　${formatDateJP(data.endDate)}`, 8, { align: "center" });
  cell(doc, 16, 21, 16, 26, `人数　${data.employeeCount}名`, 8, { align: "center" });

  // --- Row 17: 就業日 ---
  cell(doc, 17, 2, 17, 6, "就業日", 7.5, { align: "center" });
  cell(doc, 17, 7, 17, 26, data.calendar, 8);

  // --- Rows 18-21: 就業時間 (smart layout: 2-column for 3+ shifts) ---
  cell(doc, 18, 2, 21, 6, "就業時間", 7.5, { align: "center", wrap: true });
  renderMultiShift(doc, data.workHours, 18, 21);

  // --- Rows 22-25: 休憩時間 (smart layout: 2-column for 3+ shifts) ---
  cell(doc, 22, 2, 25, 6, "休憩時間", 7.5, { align: "center", wrap: true });
  renderMultiShift(doc, data.breakTime, 22, 25);

  // --- Row 26: 就業日外労働 ---
  cell(doc, 26, 2, 26, 6, "就業日外労働", 7.5, { align: "center" });
  cell(doc, 26, 7, 26, 26, data.overtimeOutsideDays, 8);

  // --- Rows 27-28: 時間外労働 ---
  cell(doc, 27, 2, 28, 6, "時間外労働", 7.5, { align: "center", wrap: true });
  cell(doc, 27, 7, 28, 26, data.overtimeHours, 8, { wrap: true });

  // --- Rows 29-31: 派遣料金 ---
  cell(doc, 29, 2, 31, 6, "派遣料金", 7.5, { align: "center", wrap: true });

  // Row 29: all rates in one cell — no internal borders
  cell(doc, 29, 7, 29, 26,
    `基本 ${yen(rate)}　　　残業(125%) ${yen(rate * 1.25)}　　　深夜(125%) ${yen(rate * 1.25)}`, 8);

  // Row 30: holiday + 60h surcharge in one cell
  cell(doc, 30, 7, 30, 26,
    `休日(135%) ${yen(rate * 1.35)}　　＜60時間超＞ 割増料金（150%） ${yen(rate * 1.50)}`, 8);

  // Row 31: time unit in one cell
  cell(doc, 31, 7, 31, 26,
    `労働時間の計算は　${data.timeUnit || "15"}　分単位で計算する。`, 8);

  // --- Rows 32-33: 支払い条件 ---
  cell(doc, 32, 2, 33, 6, "支払い条件", 7.5, { align: "center", wrap: true });

  // Row 32: all payment terms in one cell — no internal borders
  cell(doc, 32, 7, 32, 26,
    `締日　${data.closingDay}　　支払日　${data.paymentDay}　　支払方法　銀行振込`, 8);

  // Row 33: 振込先 | account
  cell(doc, 33, 7, 33, 8, "振込先", 7.5, { align: "center" });
  cell(doc, 33, 9, 33, 26, data.bankAccount, 8);

  // --- Rows 34-35: 安全・衛生 ---
  legalBlock(doc, 34, 35, 35, 26, "安全・衛生", ANZEN, 7.5, 7);

  // --- Row 36: 便宜供与 ---
  legalBlock(doc, 36, 36, 36, 26, "便宜供与", BENGI, 7.5, 7);

  // --- Rows 37-40: 苦情処理方法 ---
  legalBlock(doc, 37, 40, 40, 26, "苦情処理方法", KUJO, 7.5, 6.5);

  // --- Rows 41-53: 契約解除措置 ---
  cell(doc, 41, 2, 53, 6,
    "労働者派遣契約の契約の解除に当たって講ずる派遣労働者の雇用の安定を図るための措置",
    7.5, { align: "center", wrap: true });

  // (1)~(4) merged into single cell — no internal borders
  const kaijoAll = [KAIJO_1, KAIJO_2, KAIJO_3, KAIJO_4].join("\n");
  cell(doc, 41, 7, 53, 26, kaijoAll, 6.5, { valign: "top", wrap: true });

  // --- Rows 54-55: 紛争防止措置 ---
  legalBlock(doc, 54, 55, 55, 26, "派遣先が派遣労働者を雇用する場合の紛争防止措置", FUNSO, 7.5, 7);

  // --- Rows 56-57: 無期雇用限定 ---
  legalBlock(doc, 56, 57, 57, 26,
    "派遣労働者を無期雇用派遣労働者又は６０歳以上の者に限定するか否かの別", MUKI, 7.5, 7);

  // ═══ ROW 58: Signature text ═══
  cell(doc, 58, 0, 58, 26,
    "上記契約の証として本書２通を作成し、甲乙記名押印のうえ、各１通を保有する。", 8, { noBorder: true });

  // ═══ ROW 59: Contract date ═══
  cell(doc, 59, 0, 59, 8, formatDateJP(data.contractDate), 11, { align: "left", noBorder: true });

  // ═══ ROWS 59-63: Signatures — (甲) left half, (乙) right half (shifted up ~0.5cm) ═══
  // (甲) — cols 0-12 (row 60: below contract date in row 59, same size as 乙)
  try { doc.font("JP-Mincho"); } catch { /* stay on JP */ }
  cell(doc, 60, 0, 60, 12, "（甲）", 10, { noBorder: true, bold: true });
  doc.font("JP");

  // (乙) — cols 15-26 (BIZ UD Mincho for formal appearance, shifted ~1cm right)
  try { doc.font("JP-Mincho"); } catch { /* stay on JP */ }
  cell(doc, 59, 15, 59, 26, "（乙）", 10, { noBorder: true, bold: true });
  cell(doc, 60, 15, 60, 26, UNS.address, 10, { noBorder: true, bold: true });
  cell(doc, 61, 15, 61, 26, UNS.name, 12, { noBorder: true, bold: true });
  cell(doc, 62, 15, 62, 26, UNS.representative, 10, { noBorder: true, bold: true });
  cell(doc, 63, 15, 63, 26, `許可番号　${UNS.licenseNumber}`, 10, { noBorder: true, bold: true });
  doc.font("JP");

  // ═══ 印鑑 (Company seal) — positioned per reference scan ═══
  // Reference: center over 許可番号 area, shifted up with (乙) block
  if (tintedInkanBuffer) {
    const sealSize = 66.1; // ~23.3mm
    const centerX = cx(20) + 14;
    const centerY = ry(63) - 3;
    // Human-like randomness: visible rotation + position shift (real hand-stamped feel)
    const rotation = (Math.random() - 0.5) * 24;  // ±12 degrees
    const offsetX = (Math.random() - 0.5) * 16;   // ±8pt horizontal
    const offsetY = (Math.random() - 0.5) * 16;   // ±8pt vertical
    const opacityJitter = 0.60 + Math.random() * 0.30; // 0.60～0.90

    doc.save();
    doc.opacity(opacityJitter);
    doc.translate(centerX + offsetX, centerY + offsetY);
    doc.rotate(rotation, { origin: [0, 0] });
    doc.image(tintedInkanBuffer, -sealSize / 2, -sealSize / 2, { width: sealSize, height: sealSize });
    doc.restore();
  }
}
