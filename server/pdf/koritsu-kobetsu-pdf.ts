/**
 * コーリツ 個別契約書 (Individual Dispatch Contract — Koritsu variant)
 *
 * GRID-BASED LAYOUT matching Excel template コーリツ個別契約セット等26年1月3月末.xlsm
 * Sheet: 労働者派遣個別契約書
 * 56 columns (A-BD) × 81 rows, A4 portrait
 *
 * Border spec from spec-kobetsu.json — per-side "hair" borders only,
 * NOT full-box rectangles. This matches the Excel template exactly.
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { type Doc, UNS, formatDateJP } from "./helpers.js";
import type { CellOpts } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── DATA INTERFACE ──────────────────────────────────────────────────

export interface KoritsuKobetsuData {
  // Company/factory
  companyName: string;
  companyAddress: string;
  companyPhone: string;

  factoryName: string;
  factoryAddress: string;
  factoryPhone: string;
  department: string;
  lineName: string;

  // People
  commanderDept: string;
  commanderName: string;
  commanderTitle: string;
  commanderPhone: string;

  hakensakiManagerDept: string;
  hakensakiManagerTitle: string;
  hakensakiManagerName: string;
  hakensakiManagerPhone: string;

  managerUnsAddress?: string;
  managerUnsDept?: string;
  managerUnsTitle?: string;
  managerUnsName?: string;
  managerUnsPhone?: string;

  complaintClientDept: string;
  complaintClientTitle: string;
  complaintClientName: string;
  complaintClientPhone: string;

  complaintUnsDept?: string;
  complaintUnsTitle?: string;
  complaintUnsName?: string;
  complaintUnsPhone?: string;

  // Contract details
  contractNumber: string;
  jobDescription: string;
  startDate: string;
  endDate: string;
  conflictDate: string;
  contractDate: string;
  employeeCount: number;

  hourlyRate: number;

  // Payment
  closingDay: string;
  paymentDay: string;
}

// ─── GRID SYSTEM ─────────────────────────────────────────────────────

// Page dimensions matched to reference PDF (8210142.pdf)
// PW=595.28, PH=841.89 (A4 portrait)

const COL_CW = [
  1.75, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625,
  1.125,
  1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625,
  1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625,
  1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625,
  1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625, 1.625,
  1.625, 1.625, 1.625,
  1.375, 1.625,
];
// X-axis: computed to match reference grid exactly
// Reference: cx(2)=36.54, cx(11)=123.08, cx(55)=559.86
const CW_2_54 = COL_CW.slice(2, 55).reduce((a, b) => a + b, 0);
const XS = 523.32 / CW_2_54; // reference grid width / col widths sum
const ML = 36.54 - (COL_CW[0] + COL_CW[1]) * XS;

const CX: number[] = [];
let _cx = ML;
for (const w of COL_CW) { CX.push(_cx); _cx += w * XS; }
CX.push(_cx);

const cx = (c: number) => CX[c];
const cw = (s: number, e: number) => CX[e + 1] - CX[s];

const ROW_HT = [
  0,
  8, 8,           // rows 1-2: reduced from 18.75 to fit A4 print
  10.5, 10.5,
  6.75,
  10.5,
  10.5,
  10.5,
  10.5, 10.5,
  10.5, 10.5,
  10.5, 10.5,
  10.5, 10.5,
  10.5, 10.5,
  10.5,
  10.5,
  10.5,
  10.5,
  10.5,
  10.5,
  10.5, 10.5, 10.5,
  10.5, 10.5, 10.5,
  9, 9, 9, 9, 9, 9, 9,
  10.5,
  10.5, 10.5, 10.5, 10.5, 10.5, 10.5,
  10.5,
  9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9,
  10.5, 10.5,
  10.5, 10.5, 10.5,
  10.5, 10.5, 10.5, 10.5,
  10.5, 10.5, 10.5, 10.5,
  9.75,
  9.75,
  10.5,
  10.5,
  10.5,
];

// Y-axis: scale all rows to fit A4 with margins
const PH = 841.89;
const PAGE_MT = 10;  // top margin
const PAGE_MB = 20;  // bottom margin (enough for printer)
const TOTAL_RH = ROW_HT.reduce((a, b) => a + b, 0);
const YS = (PH - PAGE_MT - PAGE_MB) / TOTAL_RH;
const MT = PAGE_MT;

const RY: number[] = [0];
let _ry = MT;
for (let i = 1; i < ROW_HT.length; i++) {
  RY.push(_ry);
  _ry += ROW_HT[i] * YS;
}
RY.push(_ry);

const ry = (r: number) => RY[r];
const rh = (s: number, e: number) => RY[e + 1] - RY[s];

// ─── CELL DRAWING (spec-accurate per-side borders) ──────────────────

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

  // Auto-size: if fs <= 0, calculate optimal size from cell height
  // Max readable size ≈ cell height × 0.72 (accounts for line-height)
  // Then shrink until text fits both height and width
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

// ─── STATIC LEGAL TEXT ───────────────────────────────────────────────

// INTRO_TEXT is now a template literal inside the generator function (needs data.companyName)

const ANZEN_1 = "（派遣労働者の危険又は健康障害を防止する為の措置に関する事項）";
const ANZEN_2 = "　  派遣先は、派遣労働者の労働安全衛生法で定められた有害業務に従事させる場合は、安全装置の設置、保護具の支給等を行う。";
const ANZEN_3 = "（換気、採光、照明等の作業環境管理に関する事項）";
const ANZEN_4 = "派遣先は、派遣労働者の作業環境について、労働安全衛生法で定められた基準を順守し、作業環境測定を実施する。";
const ANZEN_5 = "（安全衛生教育に関する事項）";
const ANZEN_6 = "  派遣元は、雇入れ時及び危険有害業務に従事させる場合は、業務上必要な安全衛生教育を行う。派遣先は、作業内容を変更する際は";
const ANZEN_7 = "　業務に従事させる前に、業務上必要な安全衛生に関する教育を行う。";

const KAIJO_LINES = [
  "（労働者派遣契約の解除の事前の申入れ）",
  "派遣先は、専ら派遣先に起因する事由により、労働者派遣契約の契約期間が満了する前の解除を行おうとする場合には、派遣元の合意を得る",
  "　ことはもとより、あらかじめ相当の猶予期間をもって派遣元に解除の申し入れを行うこととする。",
  "（就業機会の確保）",
  "    派遣元および派遣先は、労働者派遣契約の契約期間が満了する前に派遣労働者の責に帰すべき事由によらない労働者派遣契約の解除を行った",
  "  場合には、派遣先の関連会社での就業を斡旋し、又は、派遣元において他の派遣先を確保する等により、当該労働者派遣契約に係る派遣労働者",
  "　の新たな就業機会の確保を図ることとする。",
  "（損害賠償等に係る適切な措置）",
  "　派遣先は、派遣先の責に帰すべき事由により労働者派遣契約の契約期間が満了する前に労働者派遣契約の解除を行おうとする場合には、派遣",
  "    労働者の新たな就業機会の確保を図ることとし、これができないときには、派遣元に生じた損害の賠償を下記のように行う。",
  "　１　休業させる時は休業手当相当額以上",
  "  ２　やむを得ず解雇するときは、相当の猶予期間なく中途解除の申入れを行ったことにより派遣元が解雇予告を行わない場合は30日分以上、",
  "    解雇予告日から解雇日まで30日に満たない場合は解雇の30日前から解雇予告日までの日数分の賃金相当額以上、その他派遣元に生じた損害",
  "  　分に協議した上で適切な善後処理方策を講ずることとする。また、派遣元及び派遣先双方の責に帰すべき事由がある場合には派遣元及び派遣",
  "  　先のそれぞれの責に帰すべき部分の割合についても十分に考慮することとする。",
  "（労働者派遣契約の解除の理由の明示）",
  "      派遣先は、労働者派遣契約の契約期間が満了する前に労働者派遣契約の解除を行おうとする場合であって、派遣元から請求があった時は、",
  "    労働者派遣契約の解除を行った理由を派遣元に対し書面にて明らかにすることとする。",
];

const KUJO_LINES = [
  "１  派遣元における担当派遣元責任者が苦情の申出を受けた時は、直ちに派遣元責任者へ連絡する事とし、当該派遣元責任者が中心となり誠意を",
  "   もって遅滞なく、当該苦情の適切かつ迅速な処理を図る事とし、その結果について必ず派遣労働者に通知する事とする。",
  "２　派遣元および派遣先は、自らでその解決が容易であり、即時に処理した苦情の他は、相互に遅滞なく、通知するとともに、その結果について",
  "　必ず派遣労働者に通知する事とする。",
];

// ─── DATE FORMATTING ────────────────────────────────────────────────


// ─── MAIN GENERATOR ─────────────────────────────────────────────────

export function generateKoritsuKobetsuPDF(doc: Doc, data: KoritsuKobetsuData): void {
  const rate = data.hourlyRate;
  const mgr = UNS.defaultManager;

  // Register Koritsu-specific fonts (MS Gothic for title, Century for data)
  const fontDir = path.join(__dirname, "fonts");
  const gothicPath = path.join(fontDir, "MSGothic.ttf");
  const centuryPath = path.join(fontDir, "CenturySchoolbook.ttf");
  if (fs.existsSync(gothicPath)) doc.registerFont("Gothic", gothicPath);
  if (fs.existsSync(centuryPath)) doc.registerFont("Century", centuryPath);

  // Set Gothic as default font for entire document
  doc.font("Gothic");

  const deptLine = `${data.factoryName} ${data.department} ${data.lineName}`.trim();
  const introText = `派遣元：ユニバーサル企画株式会社は、派遣先：${data.companyName}に対し、以下の条件の下に労働者派遣を行うものとする。`;

  // ═══ GRID OVERLAY — EXACT clone of reference PDF (8210142.pdf page 1) ═══
  // Reference: 0 G (black), 0.14 w, 0 J (butt cap), 0 j (miter join)
  // 26 lines total: 3 vertical + 22 full-width H + 1 partial H
  const hairW = 0.14;
  doc.strokeColor("#000").lineWidth(hairW);

  const L = cx(2);    // left edge = 36.54
  const M = cx(11);   // label/value separator = ~123.08
  const R = cx(55);   // right edge = ~559.86
  const TOP = ry(9);  // grid top — table starts at row 9 (intro text is above)
  const BOT = ry(76); // grid bottom = 775.98

  // 20 full-width H-lines (L → R) — draws at ry(r+1) = bottom of row r
  // Lines ONLY between sections — NO internal lines within merged-label sections
  // Each value N draws a line at ry(N+1) = bottom of row N
  const fullH = [
    10, 12, 14,             // between 派遣先事業所/就業場所/指揮命令者 (merged 2-row sections)
    16, 18,                 // between 派遣先責任者(R15-16) and 派遣元責任者(R17-18) — no internal lines
    19, 20, 21, 22, 23, 24, // 組織単位 through 就業日 (all single-row)
    27,                     // bottom of 就業・休憩時間 (R25-27, no internal lines)
    30,                     // bottom of 休日・時間外労働 (R28-30, no internal lines)
    37, 38,                 // bottom of 安全衛生 (R31-37) + bottom of 福利厚生 (R38)
    44, 45,                 // bottom of 派遣料金 (R39-44) + bottom of 支払条件 (R45)
    63,                     // bottom of 就業条件措置 (R46-63, no internal lines)
    65,                     // bottom of 紛争防止措置 (R64-65)
    68,                     // bottom of 派遣労働者の限定 (R66-68)
    // 苦情の申出先(R69-72) + 処理方法(R73-76) = one section, no internal line
  ];
  doc.moveTo(L, TOP).lineTo(R, TOP).stroke(); // top border at ry(8)
  for (const r of fullH) {
    doc.moveTo(L, ry(r + 1)).lineTo(R, ry(r + 1)).stroke();
  }
  doc.moveTo(L, BOT).lineTo(R, BOT).stroke(); // bottom border at ry(76)

  // 1 partial H-line: bottom of row 28, M → R
  doc.moveTo(M, ry(29)).lineTo(R, ry(29)).stroke();

  // 3 vertical lines (full height TOP → BOT)
  doc.moveTo(L, TOP).lineTo(L, BOT).stroke();
  doc.moveTo(M, TOP).lineTo(M, BOT).stroke();
  doc.moveTo(R, TOP).lineTo(R, BOT).stroke();

  // ═══ ROW 2: 【派遣先控】 ═══
  cell(doc, 2, 2, 2, 8, "【派遣先控】", 6.5);

  // ═══ ROWS 3-4: Title ═══
  cell(doc, 3, 21, 4, 36, "労働者派遣個別契約書", 14, { align: "center", font: "Gothic" });

  // ═══ ROW 4: 個別契約番号 (right-aligned, aligned with 締結日) ═══
  cell(doc, 4, 44, 4, 50, "個別契約番号：", 7.5, { align: "right" });
  cell(doc, 4, 51, 4, 54, data.contractNumber, 7.5);

  // ═══ ROW 6: 締結日 ═══
  cell(doc, 6, 43, 6, 47, "締結日:", 7.5, { align: "right" });
  cell(doc, 6, 48, 6, 53, formatDateJP(data.contractDate), 7.5);

  // ═══ ROW 8: Intro text — D8:BC8 ═══
  cell(doc, 8, 3, 8, 54, introText, 7.5, {});

  // ═══ ROWS 9-10: 派遣先事業所 ═══
  cell(doc, 9, 2, 10, 10, "派遣先事業所", 7.5, { align: "center" });
  cell(doc, 9, 11, 9, 14, "（名称）", 7.5, { align: "center" });
  cell(doc, 9, 15, 9, 54, data.companyName, 7.5, {});
  cell(doc, 10, 11, 10, 14, "（住所）", 7.5, { align: "center" });
  cell(doc, 10, 15, 10, 28, data.companyAddress, 7.5, {});
  cell(doc, 10, 39, 10, 41, "(TEL)", 7.5, { align: "center" });
  cell(doc, 10, 42, 10, 54, data.companyPhone, 7.5); // text overflow (no border)

  // ═══ ROWS 11-12: 就業場所 ═══
  cell(doc, 11, 2, 12, 10, "就 業 場 所", 7.5, { align: "center" });
  cell(doc, 11, 11, 11, 14, "（名称）", 7.5, { align: "center" });
  cell(doc, 11, 15, 11, 28, data.companyName, 7.5, {});
  cell(doc, 12, 11, 12, 14, "（住所）", 7.5, { align: "center" });
  cell(doc, 12, 15, 12, 27, data.factoryAddress, 7.5, {});
  cell(doc, 12, 28, 12, 30, "(部署)", 7.5, { align: "center" });
  cell(doc, 12, 31, 12, 41, deptLine, 7.5, {});
  cell(doc, 12, 42, 12, 44, "(TEL)", 7.5, { align: "center" });
  cell(doc, 12, 45, 12, 54, data.factoryPhone, 7.5); // text overflow (no border)

  // ═══ ROWS 13-14: 指揮命令者 ═══
  cell(doc, 13, 2, 14, 10, "指揮命令者", 7.5, { align: "center" });
  cell(doc, 13, 11, 13, 14, "（部署）", 7.5, { align: "center" });
  cell(doc, 13, 15, 13, 54, deptLine, 7.5, {});
  cell(doc, 14, 11, 14, 14, "（役職）", 7.5, { align: "center" });
  cell(doc, 14, 15, 14, 23, data.commanderTitle, 7.5, {});
  cell(doc, 14, 24, 14, 26, "(氏名）", 7.5, { align: "center" });
  cell(doc, 14, 27, 14, 38, data.commanderName, 7.5, {});
  cell(doc, 14, 39, 14, 41, "(TEL)", 7.5, { align: "center" });
  cell(doc, 14, 42, 14, 54, data.commanderPhone, 7.5); // text overflow (no border)

  // ═══ ROWS 15-16: 派遣先責任者 + （製造業務専門） ═══
  cell(doc, 15, 2, 15, 10, "派遣先責任者", 7.5, { align: "center" });
  cell(doc, 15, 11, 15, 14, "（部署）", 7.5, { align: "center" });
  cell(doc, 15, 15, 15, 23, `${data.factoryName} ${data.department}`, 7.5, {});
  // Border fillers: spec has 3 separate cells Y15:AA15, AB15:AP15, AQ15:AR15
  cell(doc, 15, 24, 15, 26, "", 7.5, {});
  cell(doc, 15, 27, 15, 41, "", 7.5, {});
  cell(doc, 15, 42, 15, 43, "", 7.5, {});

  cell(doc, 16, 2, 16, 10, "（製造業務専門）", 7.5, { align: "center" });
  cell(doc, 16, 11, 16, 14, "（役職）", 7.5, { align: "center" });
  cell(doc, 16, 15, 16, 23, data.hakensakiManagerTitle, 7.5, {});
  cell(doc, 16, 24, 16, 26, "(氏名）", 7.5, { align: "center" });
  cell(doc, 16, 27, 16, 38, data.hakensakiManagerName, 7.5, {});
  cell(doc, 16, 39, 16, 41, "(TEL)", 7.5, { align: "center" });
  cell(doc, 16, 42, 16, 54, data.hakensakiManagerPhone, 7.5); // text overflow (no border)

  // ═══ ROWS 17-18: 派遣元責任者 + （製造業務専門） ═══
  const unsAddr = data.managerUnsAddress ?? "愛知県名古屋市東区徳川2丁目18-18";
  const unsDept = data.managerUnsDept ?? `${mgr.dept}　${mgr.role}`;
  const unsName = data.managerUnsName ?? mgr.name;
  const unsPhone = data.managerUnsPhone ?? mgr.phone;

  cell(doc, 17, 2, 17, 10, "派遣元責任者", 7.5, { align: "center" });
  cell(doc, 17, 11, 17, 14, "（名称）", 7.5, { align: "center" });
  cell(doc, 17, 15, 17, 24, UNS.name, 7.5, {});
  cell(doc, 17, 25, 17, 27, "（住所）", 7.5, { align: "center" });
  cell(doc, 17, 28, 17, 43, unsAddr, 7.5, {});
  cell(doc, 17, 44, 17, 46, "(TEL)", 7.5, { align: "center" });
  cell(doc, 17, 47, 17, 54, unsPhone, 7.5, {});

  cell(doc, 18, 2, 18, 10, "（製造業務専門）", 7.5, { align: "center" });
  cell(doc, 18, 11, 18, 14, "（役職）", 7.5, { align: "center" });
  cell(doc, 18, 15, 18, 24, unsDept, 7.5, {});
  cell(doc, 18, 25, 18, 27, "（氏名）", 7.5, { align: "center" });
  cell(doc, 18, 28, 18, 43, unsName, 7.5, {});

  // ═══ ROW 19: 組織単位 ═══
  cell(doc, 19, 2, 19, 10, "組 織 単 位", 7.5, { align: "center" });
  cell(doc, 19, 12, 19, 54, `${data.factoryName} ${data.department} (課長)`, 7.5, {});

  // ═══ ROW 20: 業務内容 ═══
  cell(doc, 20, 2, 20, 10, "業 務 内 容", 7.5, { align: "center" });
  cell(doc, 20, 12, 20, 36, data.jobDescription, 7.5, {});
  cell(doc, 20, 37, 20, 42, "派遣人数", 7.5, { align: "center" });
  cell(doc, 20, 43, 20, 54, `${data.employeeCount}人`, 7.5, { align: "center" }); // Excel uses fullwidth １ but NotoSansJP renders fine

  // ═══ ROW 21: 責任の程度 ═══
  cell(doc, 21, 2, 21, 10, "業務に伴う責任の程度", 7.5, { align: "center" });
  cell(doc, 21, 12, 21, 54, "☑付与される権限なし／□付与される権限あり（詳細：　　　　　　　　　　　　　　　　　　）", 7.5, {});

  // ═══ ROW 22: 派遣期間 ═══
  cell(doc, 22, 2, 22, 10, "派 遣 期 間", 7.5, { align: "center" });
  cell(doc, 22, 12, 22, 18, formatDateJP(data.startDate), 7.5, { align: "center" });
  cell(doc, 22, 19, 22, 19, "～", 7.5, { align: "center" });
  cell(doc, 22, 20, 22, 26, formatDateJP(data.endDate), 7.5, { align: "center" });

  // ═══ ROW 23: 事業所単位の抵触日 ═══
  cell(doc, 23, 2, 23, 10, "事業所単位の抵触日", 7.5, { align: "center" });
  cell(doc, 23, 12, 23, 18, formatDateJP(data.conflictDate), 7.5, { align: "center" });

  // ═══ ROW 24: 就業日、休日 ═══
  cell(doc, 24, 2, 24, 10, "就業日、休日", 7.5, { align: "center" });
  cell(doc, 24, 12, 24, 54, "派遣先の年間カレンダーによる　・年間休日120日＜3組2交替：169日＞　", 7.5, {});

  // ═══ ROWS 25-27: 就業・休憩時間 ═══
  cell(doc, 25, 2, 27, 10, "就業・休憩時間", 7.5, { align: "center" });
  cell(doc, 25, 11, 25, 54,
    "  【通常勤務 】（就業時間）昼勤 8:00～16:45、夜勤 20:00～4:45 ・ （休憩時間）昼勤 12:00～12:45 ・ 夜勤 0:00～0:45", 7.5, {});
  cell(doc, 26, 11, 26, 54,
    "　【3組2交替】（就業時間）昼勤 8:00～19:00、 ・ （休憩時間）昼勤 12:00～12:45、16:45～17:00", 7.5);
  cell(doc, 27, 11, 27, 54,
    "　【　  〃  　】（　 〃   ）夜勤 20:00～7:00、 ・ （　 〃   ）夜勤  0:00～0:45、　4:45～5:00", 7.5, {});

  // ═══ ROWS 28-30: 休日・時間外労働 ═══
  cell(doc, 28, 2, 30, 10, "休日・時間外労働", 7.5, { align: "center" });
  cell(doc, 28, 11, 28, 54,
    "　【 通常勤務 】　1日　7時間　1ヶ月　42　時間　1年　320　時間　但し、派遣元の36協定を遵守する", 7.5, {});
  cell(doc, 29, 11, 29, 54,
    "　【3組2交替】　1日　5時間　1ヶ月　42　時間　1年　320　時間　但し、派遣元の36協定を遵守する", 7.5);
  cell(doc, 30, 11, 30, 54,
    "   特別条項　｜ 【通常勤務】1ヶ月　80　時間　1年　720　時間、【3組2交替】1ヶ月　50　時間　1年　552　時間", 7.5, {});

  // ═══ ROWS 31-37: 安全衛生 ═══
  cell(doc, 31, 2, 37, 10, "安 全 衛 生", 6, { align: "center" });
  cell(doc, 31, 12, 31, 54, ANZEN_1, 7.5, {});
  cell(doc, 32, 12, 32, 54, ANZEN_2, 7.5);
  cell(doc, 33, 12, 33, 54, ANZEN_3, 7.5);
  cell(doc, 34, 12, 34, 54, ANZEN_4, 7.5);
  cell(doc, 35, 12, 35, 54, ANZEN_5, 7.5);
  cell(doc, 36, 12, 36, 54, ANZEN_6, 7.5);
  cell(doc, 37, 12, 37, 54, ANZEN_7, 7.5, {});

  // ═══ ROW 38: 福利厚生 ═══
  cell(doc, 38, 2, 38, 10, "福 利 厚 生", 7.5, { align: "center" });
  cell(doc, 38, 11, 38, 54, " （利用可能施設・設備）社員食堂、更衣室、休憩室", 7.5, {});

  // ═══ ROWS 39-44: 派遣料金 ═══
  cell(doc, 39, 2, 44, 10, "派 遣 料 金", 7.5, { align: "center" });

  // Row 39: 基本料金 (top borders)
  cell(doc, 39, 12, 39, 24, "基本料金（1時間当り、以下同じ)", 7.5, {});
  cell(doc, 39, 26, 39, 29, `${rate.toLocaleString("ja-JP")}`, 7.5, { align: "right" });
  cell(doc, 39, 30, 39, 30, "円", 7.5);
  cell(doc, 39, 37, 39, 42, "交通費", 7.5, { align: "center" });
  cell(doc, 39, 43, 39, 44, "円", 7.5, {});

  // Row 40: 時間外割増
  cell(doc, 40, 12, 40, 22, "時間外／法定外休日割増料金", 7.5);
  cell(doc, 40, 23, 40, 25, "(25%)", 7.5, { align: "center" });
  cell(doc, 40, 26, 40, 29, `${Math.floor(rate * 0.25).toLocaleString("ja-JP")}`, 7.5, { align: "right" });
  cell(doc, 40, 30, 40, 30, "円", 7.5);
  cell(doc, 40, 37, 40, 42, "日額", 7.5, { align: "center" });
  cell(doc, 40, 43, 40, 44, "円", 7.5);

  // Row 41: 法定休日割増
  cell(doc, 41, 12, 41, 22, "法定休日割増料金", 7.5);
  cell(doc, 41, 23, 41, 25, "(35%)", 7.5, { align: "center" });
  cell(doc, 41, 26, 41, 29, `${Math.floor(rate * 0.35).toLocaleString("ja-JP")}`, 7.5, { align: "right" });
  cell(doc, 41, 30, 41, 30, "円", 7.5);
  cell(doc, 41, 37, 41, 42, "その他", 7.5, { align: "center" });
  cell(doc, 41, 43, 41, 44, "円", 7.5);

  // Row 42: 深夜割増
  cell(doc, 42, 12, 42, 22, "深夜割増料金", 7.5);
  cell(doc, 42, 23, 42, 25, "(25%)", 7.5, { align: "center" });
  cell(doc, 42, 26, 42, 29, `${Math.floor(rate * 0.25).toLocaleString("ja-JP")}`, 7.5, { align: "right" });
  cell(doc, 42, 30, 42, 30, "円", 7.5);

  // Row 43: 60h超
  cell(doc, 43, 12, 43, 35, `時間外／所定休日＜60時間超＞割増料金（50%）${Math.floor(rate * 0.50).toLocaleString("ja-JP")} 円`, 7.5);

  // Row 44: Note (bottom border)
  cell(doc, 44, 12, 44, 54, "※時間外／法定外休日割増料金、法定休日割増料金、深夜割増料金の各割増料金は、基本料金に上乗せして請求される料金。", 7.5, {});

  // ═══ ROW 45: 支払条件 ═══
  cell(doc, 45, 2, 45, 10, "支 払 条 件", 7.5, { align: "center" });
  cell(doc, 45, 12, 45, 54, `（締日）　${data.closingDay}　　　　　（支払日）　${data.paymentDay}`, 7.5, {});

  // ═══ ROWS 46-63: 就業条件確保のための措置 ═══
  cell(doc, 46, 2, 63, 2, "", 7.5, {});
  cell(doc, 46, 3, 63, 10, "派遣労働者の就業条件の確保のための措置", 6.5, { align: "center", wrap: true });
  // First line: top border
  cell(doc, 46, 12, 46, 54, KAIJO_LINES[0], 7.5, {});
  // Middle lines: no borders
  for (let i = 1; i < KAIJO_LINES.length - 1; i++) {
    cell(doc, 46 + i, 12, 46 + i, 54, KAIJO_LINES[i], 7.5);
  }
  // Last line (row 63): bottom border
  cell(doc, 63, 12, 63, 54, KAIJO_LINES[KAIJO_LINES.length - 1], 7.5, {});

  // ═══ ROWS 64-65: 紛争防止措置 ═══
  cell(doc, 64, 2, 65, 10, "派遣先が派遣勤労者を雇用する場合の紛争防止措置", 5, { align: "center", wrap: true });
  cell(doc, 64, 12, 64, 54, "労勤者派遣の役務の提供の終了後、当該派遣労勤者を派遣先が雇用する場合には、職業紹介を経由して行う事として、", 7.5, {});
  cell(doc, 65, 12, 65, 54, "手数料に関しては別途定めるものとする。", 7.5, {});

  // ═══ ROWS 66-68: 派遣労働者の限定 ═══
  cell(doc, 66, 2, 68, 10, "派遣労勤者の限定", 7.5, { align: "center" });
  cell(doc, 66, 12, 66, 54, "□無期雇用派遣労働者に限定／☑無期雇用派遣労働者に限定なし", 7.5, {});
  cell(doc, 67, 12, 67, 54, "□60歳以上に限定／☑60歳以上に限定なし", 7.5);
  cell(doc, 68, 12, 68, 54, "☑協定対象労働者に限定／□協定対象労働者に限定なし", 7.5, {});

  // ═══ ROWS 69-76: 苦情の申出先、処理方法・連携体制 (one section) ═══
  cell(doc, 69, 2, 76, 10, "苦情の申出先、\n処理方法・連携体制", 6, { align: "center", wrap: true });

  cell(doc, 69, 12, 69, 22, "・苦情の申出を受ける者", 7.5, {});

  // Row 70: 派遣先 complaint (no borders)
  cell(doc, 70, 13, 70, 19, " 派遣先（部署）", 7.5);
  cell(doc, 70, 20, 70, 26, data.complaintClientDept, 7.5);
  cell(doc, 70, 28, 70, 30, "（役職）", 7.5, { align: "center" });
  cell(doc, 70, 32, 70, 33, data.complaintClientTitle, 7.5);
  cell(doc, 70, 35, 70, 37, "(氏名）", 7.5, { align: "center" });
  cell(doc, 70, 38, 70, 43, data.complaintClientName, 7.5);
  cell(doc, 70, 45, 70, 47, "(TEL)", 7.5, { align: "center" });
  cell(doc, 70, 48, 70, 53, data.complaintClientPhone, 7.5);

  // Row 71: 派遣元 complaint (no borders)
  const cUnsDept = data.complaintUnsDept ?? "営業部 営業課";
  const cUnsTitle = data.complaintUnsTitle ?? "部長";
  const cUnsName = data.complaintUnsName ?? mgr.name;
  const cUnsPhone = data.complaintUnsPhone ?? mgr.phone;

  cell(doc, 71, 13, 71, 19, " 派遣元（部署）", 7.5);
  cell(doc, 71, 20, 71, 26, cUnsDept, 7.5);
  cell(doc, 71, 28, 71, 30, "（役職）", 7.5, { align: "center" });
  cell(doc, 71, 32, 71, 33, cUnsTitle, 7.5);
  cell(doc, 71, 35, 71, 37, "(氏名）", 7.5, { align: "center" });
  cell(doc, 71, 38, 71, 43, cUnsName, 7.5);
  cell(doc, 71, 45, 71, 47, "(TEL)", 7.5, { align: "center" });
  cell(doc, 71, 48, 71, 53, cUnsPhone, 7.5);

  // Row 72: sub-header (no borders)
  cell(doc, 72, 12, 72, 22, "・苦情処理方法、連携体制等", 7.5);

  // ═══ ROWS 73-76: 処理方法・連携体制 (data rows — label merged above) ═══
  cell(doc, 73, 12, 76, 54, KUJO_LINES.join("\n"), 6, { valign: "top" });

  // ═══ ROW 77: ＜派遣元＞ ═══
  cell(doc, 77, 33, 77, 37, "＜派遣元＞", 7.5, { align: "center" });

  // ═══ ROW 78: 許可番号 ═══
  cell(doc, 78, 34, 78, 54, `労働者派遣許可番号　${UNS.licenseNumber}`, 7.5);

  // ═══ ROW 79: 所在地 ═══
  cell(doc, 79, 34, 79, 38, "所  在 地", 7.5);
  cell(doc, 79, 39, 79, 54, "愛知県名古屋市東区徳川2丁目18-18", 7.5);

  // ═══ ROW 80: 事業所名 ═══
  cell(doc, 80, 34, 80, 38, "事業所名", 7.5);
  cell(doc, 80, 39, 80, 54, "ユニバーサル企画　株式会社", 7.5);

  // ═══ ROW 81: 代表者名 ═══
  cell(doc, 81, 34, 81, 38, "代表者名", 7.5);
  cell(doc, 81, 39, 81, 54, "代表取締役　中山　雅和", 7.5);

  // Restore default font for bundle compatibility
  doc.font("JP");
}
