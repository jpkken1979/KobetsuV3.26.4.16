/**
 * 契約書 (Labor Contract / 労働契約書兼就業条件明示書)
 *
 * GRID-BASED LAYOUT matching Excel template sheet "契約書"
 * Landscape A4 (841.89 × 595.28pt). Two halves:
 *   Left  (cols A-I) = No.1 — 労働契約書 (personal info + work conditions)
 *   Right (cols K-R) = No.2 — 就業条件明示書 (dispatch conditions + signature)
 * Column J is a separator gap.
 *
 * Font: JP-Mincho (BIZ UD明朝) for formal document.
 */
import {
  type Doc,
  UNS,
  isIndefiniteEmployment,
  genderText,
  getHireReference,
  getTakaoJigyosho,
  formatDateJP,
  compactTimeFormat,
} from "./helpers.js";
import type { BaseEmployeeWithRate, CellOpts } from "./types.js";

// ─── DATA INTERFACES ──────────────────────────────────────────────────

export interface KeiyakushoEmployee extends BaseEmployeeWithRate {
  employeeNumber: string;
  romajiName?: string | null;
  nationality: string | null;
  address: string | null;
  postalCode: string | null;
  billingRate: number | null;
  visaExpiry: string | null;
  visaType: string | null;
}

export interface KeiyakushoData {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  factoryName: string;
  factoryAddress: string;
  factoryPhone: string;
  department: string;
  lineName: string;
  conflictDate: string;
  startDate: string;
  endDate: string;
  contractDate: string;
  jobDescription: string;
  workHours: string;
  workHoursDay: string;
  workHoursNight: string;
  breakTime: string;
  breakTimeDay: string;
  breakTimeNight: string;
  overtimeHours: string;
  calendar: string;
  closingDay: string;
  paymentDay: string;
  hourlyRate: number;
  shiftPattern: string;

  // 指揮命令者
  supervisorDept: string;
  supervisorName: string;
  supervisorPhone: string;

  // 派遣先責任者
  hakensakiManagerDept: string;
  hakensakiManagerName: string;
  hakensakiManagerPhone: string;

  // 派遣元責任者 (UNS manager per factory)
  managerUnsDept?: string;
  managerUnsName?: string;
  managerUnsPhone?: string;

  // 苦情処理 (UNS side)
  complaintUnsDept: string;
  complaintUnsName: string;
  complaintUnsPhone: string;

  // 苦情処理 (Client side)
  complaintClientDept: string;
  complaintClientName: string;
  complaintClientPhone: string;

  employee: KeiyakushoEmployee;
}

// ─── Date format: 2025-10-01 → 2025年10月1日 ─────────────────────────

// fmtDate alias for backward compat within this file
const fmtDate = formatDateJP;

// ─── GRID SYSTEM ──────────────────────────────────────────────────────
// Landscape A4: 841.89 × 595.28pt
// 18 columns (A-R), rows 2-54 (row 1 is Excel metadata, skipped)

const ML = 10;   // left/right margin
const MT = 6;    // top margin

// Column widths in Excel pixels (A=0 through R=17)
const COL_PX = [101, 49, 21, 64, 88, 88, 88, 112, 195, 26, 41, 83, 21, 120, 115, 125, 88, 237];
const TOTAL_PX = 1662;
const TW = 841.89 - ML * 2;  // usable width ≈ 822pt

// Pre-compute column X positions (0=A … 17=R, 18=right edge)
const CX: number[] = [];
{ let x = ML; for (const w of COL_PX) { CX.push(x); x += (w / TOTAL_PX) * TW; } CX.push(x); }

// Row heights indexed by Excel row number
const RH_LIST: number[] = [
  0,       // 0: unused
  0,       // 1: skipped (Excel metadata)
  14.25,   // 2
  15,      // 3
  18.75, 18.75, 18.75, 18.75, 18.75, 18.75,  // 4-9
  17.1, 17.1, 17.1, 17.1, 17.1, 17.1, 17.1, 17.1,  // 10-17
  15, 15,  // 18-19
  17.1, 17.1, 17.1, 17.1, 17.1, 17.1,  // 20-25
  15,      // 26
  17.25, 17.25, 17.25, 17.25,  // 27-30
  15, 15, 15, 15, 15, 15, 15, 15, 15, 15,  // 31-40
  12.95, 12.95, 12.95,  // 41-43
  15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15,  // 44-54
];
const TOTAL_RH = RH_LIST.slice(2).reduce((a, b) => a + b, 0);
const AVAIL_H = 595.28 - MT - 4;  // 4pt bottom margin
const YS = AVAIL_H / TOTAL_RH;

// Pre-compute row Y positions (index = Excel row number)
const RY: number[] = [0, 0]; // placeholders for row 0 and 1
{ let y = MT; for (let i = 2; i <= 54; i++) { RY.push(y); y += RH_LIST[i] * YS; } RY.push(y); }

// Column indices (0-based)
const _A = 0, _B = 1, _C = 2, _D = 3, _E = 4, _F = 5, _G = 6, _I = 8;
const _K = 10, _L = 11, _M = 12, _N = 13, _O = 14, _P = 15, _Q = 16, _R = 17;

// Accessors
const cx = (c: number) => CX[c];
const cw = (s: number, e: number) => CX[e + 1] - CX[s];
const ry = (r: number) => RY[r];
const rh = (s: number, e: number) => RY[e + 1] - RY[s];

// ─── CELL DRAWING ────────────────────────────────────────────────────

const LBG = "#f0f0f0"; // label background

function cell(
  doc: Doc,
  r1: number, c1: number, r2: number, c2: number,
  text: string, fs: number = 6, opts: CellOpts = {}
) {
  const x = cx(c1), y = ry(r1), w = cw(c1, c2), h = rh(r1, r2);
  const { align = "left", valign = "center", wrap = true, noBorder = false, bg } = opts;
  const pad = 1.5;

  if (!noBorder) doc.lineWidth(0.3).rect(x, y, w, h).stroke();

  if (bg) {
    doc.save().fillColor(bg).rect(x + 0.2, y + 0.2, w - 0.4, h - 0.4).fill().restore();
  }

  if (!text) return;

  const tw = w - pad * 2;

  // Auto-shrink font until text fits cell height
  let size = fs;
  while (size > 3) {
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

// ─── MAIN GENERATOR ─────────────────────────────────────────────────
// Cell mapping verified against Excel merges from parse-keiyakusho.cjs

export function generateKeiyakushoPDF(doc: Doc, data: KeiyakushoData): void {
  const emp = data.employee;
  if (!emp) return;

  doc.font("JP-Mincho");

  const hireRef = getHireReference(emp.actualHireDate, emp.hireDate);
  const isInfinite = hireRef ? isIndefiniteEmployment(hireRef, data.endDate) : false;
  const gender = genderText(emp.gender);
  const empRate = emp.hourlyRate ?? data.hourlyRate ?? 0;
  const billingRate = emp.billingRate ?? emp.hourlyRate ?? data.hourlyRate ?? 0;

  // UNS manager (派遣元責任者) — separate from complaint handler
  const unsMgr = UNS.defaultManager;
  const mDept = data.managerUnsDept || unsMgr.dept;
  const mName = data.managerUnsName || `${unsMgr.role}　${unsMgr.name}`;
  const mPhone = data.managerUnsPhone || unsMgr.phone;

  // UNS complaint handler (苦情処理担当者)
  const uDept = data.complaintUnsDept || unsMgr.dept;
  const uName = data.complaintUnsName || `${unsMgr.role}　${unsMgr.name}`;
  const uPhone = data.complaintUnsPhone || unsMgr.phone;

  // Compose shift/break text — split by shift for grid rows
  const dayShift = data.workHoursDay || data.workHours || "";
  const nightShift = data.workHoursNight || "";
  const dayBreak = data.breakTimeDay || data.breakTime || "";
  const nightBreak = data.breakTimeNight || "";
  const hasNight = !!nightShift;

  // 派遣先責任者 (fallback to supervisor)
  const hmDept = data.hakensakiManagerDept || data.supervisorDept;
  const hmName = data.hakensakiManagerName || data.supervisorName;
  const hmPhone = data.hakensakiManagerPhone || data.supervisorPhone || data.companyPhone;

  // ═══════════════════════════════════════════════════════════════════
  //  LEFT HALF (No.1) — 労働契約書
  //  Merges: A-B = labels, C = spacer (R15+), D-I = values
  // ═══════════════════════════════════════════════════════════════════

  // ── Title (R2:R3, A:I) ──
  cell(doc, 2, _A, 3, _I,
    "労　働　契　約　書　兼　就　業　条　件　明　示　書     No.1", 8,
    { align: "center" });

  // ── R4: フリガナ  A4:B4 | C4:I4 ──
  cell(doc, 4, _A, 4, _B, "フ  リ  ガ  ナ", 5.5, { bg: LBG, align: "center" });
  cell(doc, 4, _C, 4, _I, emp.katakanaName || "");

  // ── R5: 氏名  A5:B5 | C5:I5 (romaji preferred) ──
  cell(doc, 5, _A, 5, _B, "氏　　　   名", 5.5, { bg: LBG, align: "center" });
  cell(doc, 5, _C, 5, _I, emp.romajiName || emp.fullName);

  // ── R6: 現住所  A6:B6 | C6:I6 ──
  cell(doc, 6, _A, 6, _B, "現 　住 　所", 5.5, { bg: LBG, align: "center" });
  cell(doc, 6, _C, 6, _I, emp.address || "");

  // ── R7: 生年月日  A7:B7 | C7:F7 | G7:I7(empty) ──
  cell(doc, 7, _A, 7, _B, "生 年 月 日", 5.5, { bg: LBG, align: "center" });
  cell(doc, 7, _C, 7, _F, fmtDate(emp.birthDate));
  cell(doc, 7, _G, 7, _I, "");

  // ── R8: 性別  A8:B8 | C8:E8 | F8:I8(empty) ──
  cell(doc, 8, _A, 8, _B, "性   　　　別", 5.5, { bg: LBG, align: "center" });
  cell(doc, 8, _C, 8, _E, gender);
  cell(doc, 8, _F, 8, _I, "");

  // ── R9: intro text  A9:E9(empty) | F9:I9 ──
  cell(doc, 9, _A, 9, _E, "");
  cell(doc, 9, _F, 9, _I, "次の条件で労働派遣行います。", 5.5, { align: "right" });

  // ── R10:R11: 雇用期間  A:B | C:E | F | G:H | I(empty) ──
  cell(doc, 10, _A, 11, _B, "雇用期間", 5.5, { bg: LBG, align: "center" });
  if (isInfinite) {
    cell(doc, 10, _C, 11, _I, "無期", 14);
  } else {
    cell(doc, 10, _C, 11, _E, fmtDate(data.startDate), 5.5);
    cell(doc, 10, _F, 11, _F, "～", 5.5, { align: "center" });
    cell(doc, 10, _G, 11, _I, fmtDate(data.endDate), 5.5);
  }

  // ── R12:R14: 就業場所  A12:B14 label ──
  cell(doc, 12, _A, 14, _B, "就業場所", 5.5, { bg: LBG, align: "center" });
  // R12: 事業所  C12:D12 | E12:F12 | G12 | H12 | I12
  cell(doc, 12, _C, 12, _D, "事 業 所：", 5, { bg: LBG });
  const jigyosho = getTakaoJigyosho(data.companyName, data.factoryAddress || data.companyAddress);
  const shugyoName = jigyosho
    ? [data.companyName, jigyosho].filter(Boolean).join("　")
    : [data.companyName, data.factoryName, data.department].filter(Boolean).join("　");
  cell(doc, 12, _E, 12, _I, shugyoName, 4.5);
  // R13: 所在地  C13:D13 | E13:I13
  cell(doc, 13, _C, 13, _D, "所 在 地：", 5, { bg: LBG });
  cell(doc, 13, _E, 13, _I, data.factoryAddress || data.companyAddress);
  // R14: 電話番号  C14:D14 | E14:I14
  cell(doc, 14, _C, 14, _D, "電 話 番 号：", 5, { bg: LBG });
  cell(doc, 14, _E, 14, _I, data.factoryPhone || data.companyPhone, 5);

  // ── R15:R17: 組織単位/責任/業務  C15:C17 vertical spacer ──
  cell(doc, 15, _C, 17, _C, "");
  cell(doc, 15, _A, 15, _B, "組織単位", 5.5, { bg: LBG, align: "center" });
  const soshikiText = jigyosho
    ? [jigyosho, data.factoryName, data.department].filter(Boolean).join("　")
    : data.department || "";
  cell(doc, 15, _D, 15, _I, soshikiText);
  cell(doc, 16, _A, 16, _B, "業務に伴う責任の程度", 4, { bg: LBG, align: "center" });
  cell(doc, 16, _D, 16, _I, "役職なし（付与される権限なし）", 5.5);
  cell(doc, 17, _A, 17, _B, "従事すべき業務内容", 4, { bg: LBG, align: "center" });
  cell(doc, 17, _D, 17, _I, data.jobDescription);

  // ── R18:R24: 就業時間/休憩  A18:B24 label ──
  cell(doc, 18, _A, 24, _B, "就業時間\n休憩時間", 5, { bg: LBG, align: "center" });
  // C18:C24 merged vertical spacer
  cell(doc, 18, _C, 24, _C, "");

  // Smart shift rendering: detect 3+ shifts from workHours field
  const shiftLines = (data.workHours || "").split("\n").filter(Boolean);
  const breakLines = (data.breakTime || "").split("\n").filter(Boolean);
  const totalShifts = Math.max(
    shiftLines.length,
    // Also count from full-width space separated format: "A勤務：... 　B勤務：..."
    (data.workHours || "").split(/[　\s]+/).filter(s => /[：～]/.test(s)).length
  );

  if (totalShifts > 2) {
    // 3+ shifts: use compact format across R18-R22 (5 available rows)
    // Pair shift+break on same row to keep them visually connected
    const compactShifts = shiftLines.map(l => compactTimeFormat(l));
    const compactBreaks = breakLines.map(l => compactTimeFormat(l));
    const rows = [18, 19, 20, 21, 22]; // 5 available rows

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (i < compactShifts.length) {
        // Show shift name as label, shift + break time as value
        const shiftNameMatch = compactShifts[i].match(/^([^：]+)：/);
        const shiftLabel = shiftNameMatch ? shiftNameMatch[1] : `${i + 1}直`;
        const breakForShift = i < compactBreaks.length ? `　休憩${compactBreaks[i].replace(/^[^：]+：/, "")}` : "";
        const fs = compactShifts[i].length + breakForShift.length > 40 ? 4.5 : 5;
        cell(doc, row, _D, row, _D, shiftLabel, 4.5, { bg: LBG, align: "center" });
        cell(doc, row, _E, row, _I, `${compactShifts[i]}${breakForShift}`, fs);
      } else {
        cell(doc, row, _D, row, _D, "");
        cell(doc, row, _E, row, _I, "");
      }
    }
  } else {
    // ≤2 shifts: original day/night layout
    cell(doc, 18, _D, 18, _D, "昼　勤", 5, { bg: LBG, align: "center" });
    cell(doc, 18, _E, 18, _I, dayShift ? `昼勤：${dayShift}` : "", 5);
    cell(doc, 19, _D, 19, _D, "休　憩", 5, { bg: LBG, align: "center" });
    cell(doc, 19, _E, 19, _I, dayBreak ? `昼勤：${dayBreak}` : "", 5);
    cell(doc, 20, _D, 20, _D, hasNight ? "夜　勤" : "", 5, hasNight ? { bg: LBG, align: "center" } : {});
    cell(doc, 20, _E, 20, _I, hasNight ? `夜勤：${nightShift}` : "", 5);
    cell(doc, 21, _D, 21, _D, hasNight ? "休　憩" : "", 5, hasNight ? { bg: LBG, align: "center" } : {});
    cell(doc, 21, _E, 21, _I, hasNight ? `夜勤：${nightBreak}` : "", 5);
    cell(doc, 22, _D, 22, _D, ""); cell(doc, 22, _E, 22, _I, "");
  }
  // R23-24: flexibility text  D23:I23, D24:I24
  cell(doc, 23, _D, 23, _I, "業務の都合により、就業時間の変更並びに短縮をすることがある。", 5);
  cell(doc, 24, _D, 24, _I, "業務の都合により、休日を他の日に振り替えることがある。", 5);

  // ── R25:R26: 休日  A25:B26 | C25:C26 spacer | D25:I26 ──
  cell(doc, 25, _A, 26, _B, "休日", 5.5, { bg: LBG, align: "center" });
  cell(doc, 25, _C, 26, _C, "");
  cell(doc, 25, _D, 26, _I,
    data.calendar || "土曜日・日曜日・年末年始・GW・夏季休暇", 5);

  // ── R27:R28: 休暇  A27:B28 | C27:C28 | D27:I28 ──
  cell(doc, 27, _A, 28, _B, "休暇", 5.5, { bg: LBG, align: "center" });
  cell(doc, 27, _C, 28, _C, "");
  cell(doc, 27, _D, 28, _I, "年次有給休暇　労働基準法通り", 5.5);

  // ── R29:R34: 賃金  A29:B34 | C29:C34 spacer ──
  cell(doc, 29, _A, 34, _B, "賃金", 5.5, { bg: LBG, align: "center" });
  cell(doc, 29, _C, 34, _C, "");
  cell(doc, 29, _D, 29, _I, `１．基本給　　時給　　¥${empRate.toLocaleString("ja-JP")}　／Ｈ`, 5.5);
  cell(doc, 30, _D, 30, _I, "２．時間外手当及び休日出勤 ・・・・労働基準法の規定による手当", 5);
  cell(doc, 31, _D, 31, _I, "３．深夜手当 ・・・・労働基準法の規定による手当　（22：00～5：00の実働に対し25％増し）", 5);
  cell(doc, 32, _D, 32, _I, `４．賃金締切及び支払日・・・・${data.closingDay || "当月１５日"}締切　　${data.paymentDay || "翌月１５日"}支払日`, 5);
  cell(doc, 33, _D, 33, _I, "５．賃金支払時の控除 ・・・・法定控除及び労使協定の締結による控除費目", 5);
  cell(doc, 34, _D, 34, _I, "６. 月６０時間以内（ ２５）％　　月６０時間超 （ ５０）％", 5);

  // ── R35:R38: 退職  A35:B38 | C35:C38 spacer ──
  cell(doc, 35, _A, 38, _B, "退職に関する事項", 4.5, { bg: LBG, align: "center" });
  cell(doc, 35, _C, 38, _C, "");
  cell(doc, 35, _D, 35, _I, "・解雇の事由及び手続　就業規則第32条、第34条に記載", 5);
  cell(doc, 36, _D, 36, _I, "・会社の名誉と信用を失墜するような行為をしたとき。", 5);
  cell(doc, 37, _D, 37, _I, "・身勝手な行為や素行不良等により職場の秩序、風紀を乱したとき。", 5);
  cell(doc, 38, _D, 38, _I, "・退職を希望する時は、必ず30日前に申し出ること。", 5);

  // ── R39:R44: その他  A39:B44 | C39:C44 spacer ──
  cell(doc, 39, _A, 44, _B, "その他", 5.5, { bg: LBG, align: "center" });
  cell(doc, 39, _C, 44, _C, "");
  cell(doc, 39, _D, 39, _I, "・社会保険の加入（　☑有　・□無　)", 5);
  cell(doc, 40, _D, 40, _I, "・雇用保険の加入（　☑有　・□無　）", 5);
  cell(doc, 41, _D, 43, _I,
    "・その他（守秘義務　派遣業務遂行中に、知り得た技術上または営業上の機密を派遣中はもちろん派遣終了後も開示、漏洩もしくは使用してはならない。違反した場合は、損害賠償請求をすることがある。）", 4.5);
  cell(doc, 44, _D, 44, _I, "・本書記載事項以外の労働条件は、当社就業規則による。", 5);

  // ── R45:R54: 更新の有無  A45:B54 | C45:C54 spacer ──
  cell(doc, 45, _A, 54, _B, "更新の有無", 5, { bg: LBG, align: "center" });
  cell(doc, 45, _C, 54, _C, "");
  cell(doc, 45, _D, 45, _I, "１．更新の有無", 5.5);
  cell(doc, 46, _D, 46, _I,
    `　　「${isInfinite ? "□" : "☑"}更新する場合があり得る　・　${isInfinite ? "☑" : "□"}契約の更新はしない」`, 5);
  cell(doc, 47, _D, 47, _I, "２．契約の更新は、次のいずれかにより判断する。", 5.5);
  cell(doc, 48, _D, 48, _I, "　・契約期間満了時の業務量", 5);
  cell(doc, 49, _D, 49, _I, "　・勤務成績、態度", 5);
  cell(doc, 50, _D, 50, _I, "　・会社の経営状況", 5);
  cell(doc, 51, _D, 51, _I, "　・能力", 5);
  cell(doc, 52, _D, 52, _I, "　・従事している業務の進捗状況", 5);
  cell(doc, 53, _D, 53, _I,
    "　・その他（　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　　）", 5);
  cell(doc, 54, _D, 54, _I,
    `３．${isInfinite ? "□" : "☑"}期間の定めあり、${isInfinite ? "☑" : "□"}期間の定めなし`, 5.5);

  // ═══════════════════════════════════════════════════════════════════
  //  RIGHT HALF (No.2) — 就業条件明示書
  //  Merges: K-L = labels, M = spacer (R7+), N-R = values
  //  Column M is a spacer (21px) matching C on left half.
  // ═══════════════════════════════════════════════════════════════════

  // ── Title (R2:R3, K:R) ──
  cell(doc, 2, _K, 3, _R,
    "労　働　契　約　書　兼　就　業　条　件　明　示　書     No.2", 8,
    { align: "center" });

  // ── R5: name + 殿  K5:N5 | O5 | P5:R5(empty) ──
  cell(doc, 5, _K, 5, _N, emp.katakanaName || emp.fullName, 6);
  cell(doc, 5, _O, 5, _O, "殿", 6);
  cell(doc, 5, _P, 5, _R, "");

  // ── M column spacers (vertical strips matching label row spans) ──
  cell(doc, 7, _M, 8, _M, "");
  cell(doc, 9, _M, 9, _M, "");
  cell(doc, 10, _M, 11, _M, "");
  cell(doc, 12, _M, 13, _M, "");
  cell(doc, 14, _M, 15, _M, "");
  cell(doc, 16, _M, 17, _M, "");
  cell(doc, 18, _M, 28, _M, "");
  cell(doc, 29, _M, 29, _M, "");
  cell(doc, 30, _M, 33, _M, "");
  cell(doc, 34, _M, 40, _M, "");
  cell(doc, 41, _M, 42, _M, "");
  cell(doc, 43, _M, 44, _M, "");
  cell(doc, 45, _M, 47, _M, "");
  cell(doc, 48, _M, 48, _M, "");

  // ── R7:R8: 協定対象  K7:L8 label ──
  cell(doc, 7, _K, 8, _L,
    "派遣労働者を協定対象\n労働者に限定するか\n否かの別", 3.5,
    { bg: LBG, align: "center" });
  // R7: N7:O7 | P7:R7(empty)
  cell(doc, 7, _N, 7, _O, "□協定対象派遣労働者ではない", 5);
  cell(doc, 7, _P, 7, _R, "");
  // R8: N8:P8(text overflow) | Q8:R8(date)
  cell(doc, 8, _N, 8, _P,
    "☑協定対象派遣労働者である　　当該協定の有期期間の終了日", 4.5);
  cell(doc, 8, _Q, 8, _R, fmtDate(data.endDate), 5);

  // ── R9: 派遣期間  K9:L9 | N9(start) | O9(～) | P9:R9(end) ──
  cell(doc, 9, _K, 9, _L, "　派遣期間　", 5.5, { bg: LBG, align: "center" });
  cell(doc, 9, _N, 9, _N, fmtDate(data.startDate), 5.5);
  cell(doc, 9, _O, 9, _O, "～", 5.5, { align: "center" });
  cell(doc, 9, _P, 9, _R, fmtDate(data.endDate), 5.5);

  // ── R10:R11: 派遣先の抵触日  K10:L11 | N10:O11 | P10:R11(empty) ──
  cell(doc, 10, _K, 11, _L, "派遣先の抵触日", 5, { bg: LBG, align: "center" });
  cell(doc, 10, _N, 11, _O, fmtDate(data.conflictDate), 5.5, { align: "center" });
  cell(doc, 10, _P, 11, _R, "");

  // ── R12:R13: 組織（個人）抵触日  K12:L13 | N12:O13 | P12:R13 ──
  cell(doc, 12, _K, 13, _L, "組織（個人）抵触日", 4.5, { bg: LBG, align: "center" });
  cell(doc, 12, _N, 13, _O,
    isInfinite ? "無期雇用" : fmtDate(data.conflictDate), 5);
  cell(doc, 12, _P, 13, _R,
    "なお、派遣先の事業所における派遣可能期間の延長について、当該手続を適正に行っていない場合や派遣労働者個人単位の期間制限の抵触日を超えて労働者派遣の役務の提供を受けた場合は、派遣先は労働契約の申込みをしたものとみなされます。",
    3.5, { valign: "top" });

  // ── R14:R15: 派遣元責任者  K14:L15 | N14:P15 | Q14:R15 ──
  cell(doc, 14, _K, 15, _L, "派遣元責任者", 5, { bg: LBG, align: "center" });
  cell(doc, 14, _N, 15, _P, `${mDept} ${mName}`, 5);
  cell(doc, 14, _Q, 15, _R, `電話番号：　${mPhone}`, 5);

  // ── R16:R17: 派遣先責任者  K16:L17 | N16:P17 | Q16:R17 ──
  cell(doc, 16, _K, 17, _L, "派遣先責任者", 5, { bg: LBG, align: "center" });
  cell(doc, 16, _N, 17, _P, `${hmDept} ${hmName}`, 5);
  cell(doc, 16, _Q, 17, _R, `電話番号：　${hmPhone}`, 5);

  // ── R18:R28: 苦情の処理  K18:L28 label ──
  cell(doc, 18, _K, 28, _L,
    "苦情の処理及び\n申出先、苦情処理\n方法、連携体制等",
    3.5, { bg: LBG, align: "center" });
  // R18:R19 派遣元  N18:N19 | O18:P19 | Q18:R19
  cell(doc, 18, _N, 19, _N, "派遣元", 5, { bg: LBG, align: "center" });
  cell(doc, 18, _O, 19, _P, `${uDept} ${uName}`, 5);
  cell(doc, 18, _Q, 19, _R, `電話番号：　${uPhone}`, 5);
  // R20:R21 派遣先  N20:N21 | O20:P21 | Q20:R21
  cell(doc, 20, _N, 21, _N, "派遣先　　", 5, { bg: LBG, align: "center" });
  cell(doc, 20, _O, 21, _P,
    `${data.complaintClientDept || ""} ${data.complaintClientName || ""}`, 5);
  cell(doc, 20, _Q, 21, _R,
    `電話番号：　${data.complaintClientPhone || ""}`, 5);
  // R22:R28 procedure text  N22:R28
  cell(doc, 22, _N, 28, _R,
    `①派遣元における上記の者が苦情の申し出を受けたときは、ただちに派遣元責任者の${mName}へ連絡することとし、当該派遣元責任者が中心となって、誠意をもって、遅滞なく、当該苦情の適切、迅速な処理を図ることとする。\n②苦情処理を行うに際しては派遣元と派遣先との密接な連携のもとに誠意をもって対応し解決を図る。`,
    4, { valign: "top" });

  // ── R29: 指揮命令者  K29:L29 | N29:R29 ──
  cell(doc, 29, _K, 29, _L, "指揮命令者", 5, { bg: LBG, align: "center" });
  cell(doc, 29, _N, 29, _R,
    `${data.supervisorDept}  ${data.supervisorName}`, 5);

  // ── R30:R33: 時間外労働  K30:L33 | N30:R30 | N31:R31 | N32:R33 ──
  cell(doc, 30, _K, 33, _L,
    "時間外労働\n及び\n休日労働", 4.5, { bg: LBG, align: "center" });
  cell(doc, 30, _N, 30, _R,
    `時間外労働〔①□無 ・ ②☑有（　${data.overtimeHours || "１日5時間，1ヶ月42時間，1年320時間"}　）〕`, 4.5);
  cell(doc, 31, _N, 31, _R,
    "※但し,特別条項により1ヶ月80時間迄、1年720時間迄延長できる。申請は年6回迄とする。", 4.5);
  cell(doc, 32, _N, 33, _R,
    "休日労働〔①□無 ・ ②☑有 ※但し1か月2回の範囲で命ずることができることとする〕", 4.5);

  // ── R34:R40: 派遣契約解除  K34:L40 | N34:R40 ──
  cell(doc, 34, _K, 40, _L,
    "派遣契約解除の\n場合の措置", 4, { bg: LBG, align: "center" });
  cell(doc, 34, _N, 40, _R,
    "労働者の責に帰すべき事由によらない労働者派遣契約の解除が行われた場合には、派遣先と連携して他の派遣先をあっせんする等により新たな就業機会の確保を図ることとする。また、当該派遣元事業主は、当該労働者を解雇しようとするときは、労働基準法等に基づく責任を果たすこととする。",
    4, { valign: "top" });

  // ── R41:R42: 安全・衛生  K41:L42 | N41:R42 ──
  cell(doc, 41, _K, 42, _L, "安全・衛生", 5, { bg: LBG, align: "center" });
  cell(doc, 41, _N, 42, _R,
    "派遣先は労働者派遣法第４４条から第４７条までの規定により自己に課せられた責任を負う。\n（但し業務上の事由による災害の場合は派遣元にて手続きを行う。）",
    4, { valign: "top" });

  // ── R43:R44: 福利厚生  K43:L44 | N43:R44 ──
  cell(doc, 43, _K, 44, _L, "福利厚生施設等", 4.5, { bg: LBG, align: "center" });
  cell(doc, 43, _N, 44, _R,
    "☑食堂、☑駐車場、☑更衣室、□シャワー室、制服（□有償・☑無償）〔その他　　　　　　　〕", 4.5);

  // ── R45:R47: 紛争防止  K45:L47 | N45:R47 ──
  cell(doc, 45, _K, 47, _L,
    "派遣先が派遣労働者を\n雇用する場合の紛争\n防止措置",
    3.5, { bg: LBG, align: "center" });
  cell(doc, 45, _N, 47, _R,
    "労働者派遣の役務の提供終了後、当該派遣労働者を派遣先が雇用する場合には、手数料として派遣先は、派遣元事業主に支払うものとする。金額については甲乙協議の上決定することとする。",
    4, { valign: "top" });

  // ── R48: 備考  K48:L48 | N48:R48 ──
  cell(doc, 48, _K, 48, _L, "備考", 5.5, { bg: LBG, align: "center" });
  cell(doc, 48, _N, 48, _R,
    `当該労働者に係る労働者派遣に関する料金の額：${billingRate.toLocaleString("ja-JP")}円/時　（事業所平均）`, 4.5);

  // ── R49:R54: Signature area (no M spacer pattern here) ──
  // R49: L49:N49(date)
  cell(doc, 49, _K, 49, _K, "");
  cell(doc, 49, _L, 49, _N, fmtDate(data.contractDate || data.startDate), 5.5);
  cell(doc, 49, _O, 49, _R, "");
  // R50: L50(使用者) | P50(労働者)
  cell(doc, 50, _K, 50, _K, "");
  cell(doc, 50, _L, 50, _L, "使用者", 5.5);
  cell(doc, 50, _M, 50, _O, "");
  cell(doc, 50, _P, 50, _P, "労働者", 5.5);
  cell(doc, 50, _Q, 50, _R, "");
  // R51: L51:O51(address) | P51(サイン)
  cell(doc, 51, _K, 51, _K, "");
  cell(doc, 51, _L, 51, _O, UNS.address.replace("〒", ""), 5);
  cell(doc, 51, _P, 51, _P, "サイン（受領）", 4.5);
  cell(doc, 51, _Q, 51, _R, "");
  // R52: L52:N52(UNS name)
  cell(doc, 52, _K, 52, _K, "");
  cell(doc, 52, _L, 52, _N, UNS.name, 5);
  cell(doc, 52, _O, 52, _R, "");
  // R53: L53:N53(representative)
  cell(doc, 53, _K, 53, _K, "");
  cell(doc, 53, _L, 53, _N, `代表取締役　　${UNS.representative.replace("代表取締役　", "")}`, 5);
  cell(doc, 53, _O, 53, _R, `電話番号：${unsMgr.phone}`, 5);
  // R54: L54:N54(empty) | P54:R54(説明者)
  cell(doc, 54, _K, 54, _K, "");
  cell(doc, 54, _L, 54, _N, "");
  cell(doc, 54, _O, 54, _O, "");
  cell(doc, 54, _P, 54, _R, `就業者名：${emp.katakanaName || emp.fullName}`, 5);

  // ─── Restore default font for next page ───
  doc.font("JP");
}
