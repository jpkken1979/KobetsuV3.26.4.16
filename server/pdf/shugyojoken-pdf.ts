/**
 * 就業条件明示書 (Employment Conditions Notification) — Per-employee document
 *
 * Document that must be given to each dispatched worker before assignment.
 * Contains work conditions, wages, insurance details, and complaint procedures.
 * Based on 労働者派遣法 requirements.
 */
import {
  type Doc,
  LM,
  W,
  RH,
  UNS,
  drawRow,
  labelRowAuto,
  isIndefiniteEmployment,
  yen,
  getHireReference,
  checkPageBreak,
  formatDateJP,
  compactTimeFormat,
} from "./helpers.js";
import type { BaseEmployee } from "./types.js";

export interface ShugyoJokenEmployee extends BaseEmployee {
  hourlyRate: number | null;
}

export interface ShugyoJokenData {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  factoryName: string;
  factoryAddress: string;
  department: string;
  lineName: string;
  contractDate: string;
  startDate: string;
  endDate: string;
  jobDescription: string;
  calendar: string;
  workHours: string;
  breakTime: string;
  overtimeHours: string;
  hourlyRate: number;
  conflictDate: string;
  closingDay: string;
  paymentDay: string;

  // Supervisors
  supervisorDept: string;
  supervisorName: string;
  supervisorPhone: string;
  complaintClientDept: string;
  complaintClientName: string;
  complaintClientPhone: string;
  complaintUnsDept: string;
  complaintUnsName: string;
  complaintUnsPhone: string;

  employee: ShugyoJokenEmployee;
}

export function generateShugyoJokenMeijishoPDF(doc: Doc, data: ShugyoJokenData): void {
  const emp = data.employee;
  if (!emp) return;

  const LW = 145;
  const hireRef = getHireReference(emp.actualHireDate, emp.hireDate);
  const isInfinite = hireRef ? isIndefiniteEmployment(hireRef, data.endDate) : false;
  const empRate = emp.hourlyRate ?? data.hourlyRate;

  let y = 25;

  // ── Title ──
  doc.fontSize(13).fillColor("#000").text("就業条件明示書", LM, y, { width: W, align: "center" });
  y += 20;

  // ── Employee name ──
  doc.fontSize(9).text(`${emp.katakanaName || emp.fullName}　殿`, LM, y);
  y += 16;

  // ── Date and issuer ──
  doc.fontSize(7).text(`交付日：${formatDateJP(data.contractDate)}`, LM + W - 200, y, { width: 200, align: "right" });
  y += 10;
  doc.fontSize(7).text(`${UNS.name}`, LM + W - 200, y, { width: 200, align: "right" });
  y += 12;

  doc.fontSize(7).text(
    "労働者派遣法第34条の規定に基づき、下記のとおり就業条件を明示します。",
    LM, y, { width: W }
  );
  y += 14;

  // ── 1. 派遣先情報 ──
  drawRow(doc, y, RH, [{ x: LM, w: W, text: "1. 派遣先に関する事項", fontSize: 7, bg: "#d0d0e8" }]);
  y += RH;

  y = labelRowAuto(doc, y, RH, "派遣先の名称", data.companyName, LW);
  y = labelRowAuto(doc, y, RH, "就業場所", `${data.factoryName}　${data.department}　${data.lineName || ""}`, LW);
  y = labelRowAuto(doc, y, RH, "所在地", data.factoryAddress || data.companyAddress, LW);
  y = labelRowAuto(doc, y, RH, "指揮命令者", `${data.supervisorDept}　${data.supervisorName}`, LW);
  y += 3;

  // ── 2. 業務内容 ──
  drawRow(doc, y, RH, [{ x: LM, w: W, text: "2. 業務内容に関する事項", fontSize: 7, bg: "#d0d0e8" }]);
  y += RH;

  y = labelRowAuto(doc, y, RH * 1.5, "業務内容", data.jobDescription, LW);
  y = labelRowAuto(doc, y, RH, "責任の程度", "一般事務職　担当者業務", LW);
  y += 3;

  // ── 3. 派遣期間 ──
  drawRow(doc, y, RH, [{ x: LM, w: W, text: "3. 派遣期間・就業条件", fontSize: 7, bg: "#d0d0e8" }]);
  y += RH;

  y = labelRowAuto(doc, y, RH, "派遣期間", `${data.startDate}　～　${data.endDate}`, LW);
  y = labelRowAuto(doc, y, RH, "就業日", data.calendar, LW);
  // Smart shift formatting: compact times for 3+ shifts to prevent page overflow
  const whLines = (data.workHours || "").split("\n").filter(Boolean);
  const btLines = (data.breakTime || "").split("\n").filter(Boolean);
  const workHoursDisplay = whLines.length > 2 ? compactTimeFormat(data.workHours) : data.workHours;
  const breakTimeDisplay = btLines.length > 2 ? compactTimeFormat(data.breakTime) : data.breakTime;
  y = labelRowAuto(doc, y, RH, "就業時間", workHoursDisplay, LW);
  y = labelRowAuto(doc, y, RH, "休憩時間", breakTimeDisplay, LW);
  y = labelRowAuto(doc, y, RH, "時間外労働", data.overtimeHours, LW);
  y += 3;

  // ── 4. 賃金 ──
  drawRow(doc, y, RH, [{ x: LM, w: W, text: "4. 賃金に関する事項", fontSize: 7, bg: "#d0d0e8" }]);
  y += RH;

  y = labelRowAuto(doc, y, RH, "賃金（時給）", yen(empRate), LW);
  y = labelRowAuto(doc, y, RH, "時間外割増率", "法定時間外25%増　深夜（22:00～5:00）25%増", LW);
  y = labelRowAuto(doc, y, RH, "休日割増率", "法定休日35%増", LW);
  y = labelRowAuto(doc, y, RH, "60時間超割増率", "50%増（中小企業含む）", LW);
  y = labelRowAuto(doc, y, RH, "賃金締切日", data.closingDay, LW);
  y = labelRowAuto(doc, y, RH, "賃金支払日", data.paymentDay, LW);
  y = labelRowAuto(doc, y, RH, "賃金支払方法", "銀行振込", LW);
  y += 3;

  // ── 5. 雇用期間 ──
  drawRow(doc, y, RH, [{ x: LM, w: W, text: "5. 雇用に関する事項", fontSize: 7, bg: "#d0d0e8" }]);
  y += RH;

  y = labelRowAuto(doc, y, RH, "雇用形態",
    isInfinite ? "無期雇用派遣労働者" : "有期雇用派遣労働者（期間：3ヵ月）", LW);
  y = labelRowAuto(doc, y, RH, "待遇決定方式", "協定対象派遣労働者（労使協定方式）", LW);
  y += 3;

  // ── 6. 社会保険 ──
  y = checkPageBreak(doc, y, 620);

  drawRow(doc, y, RH, [{ x: LM, w: W, text: "6. 社会・労働保険の加入状況", fontSize: 7, bg: "#d0d0e8" }]);
  y += RH;

  y = labelRowAuto(doc, y, RH, "雇用保険", "☑加入　□未加入", LW);
  y = labelRowAuto(doc, y, RH, "健康保険", "☑加入　□未加入", LW);
  y = labelRowAuto(doc, y, RH, "厚生年金保険", "☑加入　□未加入", LW);
  y += 3;

  // ── 7. 苦情処理 ──
  drawRow(doc, y, RH, [{ x: LM, w: W, text: "7. 苦情の申出先", fontSize: 7, bg: "#d0d0e8" }]);
  y += RH;

  const unsMgr = UNS.defaultManager;
  y = labelRowAuto(doc, y, RH, "派遣元苦情処理担当者",
    `${data.complaintUnsDept || unsMgr.dept}　${data.complaintUnsName || unsMgr.name}　TEL:${data.complaintUnsPhone || unsMgr.phone}`, LW);
  y = labelRowAuto(doc, y, RH, "派遣先苦情処理担当者",
    `${data.complaintClientDept || ""}　${data.complaintClientName || ""}　TEL:${data.complaintClientPhone || ""}`, LW);
  y += 3;

  // ── 8. 抵触日 ──
  drawRow(doc, y, RH, [{ x: LM, w: W, text: "8. 派遣先の事業所における期間制限", fontSize: 7, bg: "#d0d0e8" }]);
  y += RH;

  y = labelRowAuto(doc, y, RH, "事業所単位の抵触日", formatDateJP(data.conflictDate) || "―", LW);
  y = labelRowAuto(doc, y, RH, "個人単位の期間制限",
    isInfinite ? "適用なし（無期雇用派遣労働者）" : `${formatDateJP(data.startDate)}～${formatDateJP(data.endDate)}（最長3年）`, LW);
  y += 3;

  // ── 9. 契約解除時 ──
  drawRow(doc, y, RH, [{ x: LM, w: W, text: "9. 派遣契約の解除にあたって講ずる措置", fontSize: 7, bg: "#d0d0e8" }]);
  y += RH;

  const kaijo = "派遣先の都合により解除する場合は、30日前予告又は30日分以上の賃金相当額の損害賠償を行う。";
  y = labelRowAuto(doc, y, RH, "解除時措置", kaijo, LW);
  y += 3;

  // ── 10. 休暇等 ──
  y = checkPageBreak(doc, y, 700);

  drawRow(doc, y, RH, [{ x: LM, w: W, text: "10. 休暇等", fontSize: 7, bg: "#d0d0e8" }]);
  y += RH;

  y = labelRowAuto(doc, y, RH, "年次有給休暇", "入社6ヶ月経過後、法定日数付与", LW);
  y = labelRowAuto(doc, y, RH, "その他の休暇", "慶弔休暇、産前産後休業、育児・介護休業（就業規則による）", LW);
  y += 8;

  // ── 確認 ──
  doc.fontSize(7).fillColor("#000").text(
    "上記就業条件を確認し、承諾しました。",
    LM, y, { width: W }
  );
  y += 16;

  doc.fontSize(7).text(`派遣労働者氏名：${emp.katakanaName || emp.fullName}`, LM, y);
  y += 14;
  doc.fontSize(7).text("署名：＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿", LM, y);
  y += 10;
  doc.fontSize(7).text(`日付：${formatDateJP(data.contractDate)}`, LM, y);
}
