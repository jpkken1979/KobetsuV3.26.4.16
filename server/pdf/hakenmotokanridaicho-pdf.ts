/**
 * 派遣元管理台帳 (Dispatch Agency Management Registry) — Per-employee document
 *
 * Similar to 派遣先管理台帳 but from UNS's perspective as the dispatch agency.
 * Required by 派遣法第37条. Includes additional dispatch-side fields.
 */
import {
  type Doc,
  LM,
  W,
  RH,
  UNS,
  drawRow,
  labelRow,
  labelRowAuto,
  calculateAge,
  ageGroup,
  isIndefiniteEmployment,
  yen,
  genderText,
  getHireReference,
  formatDateJP,
  parseDate,
  compactTimeFormat,
  adjustToBusinessDay,
  getTakaoJigyosho,
} from "./helpers.js";
import type { BaseEmployeeWithDates } from "./types.js";

export interface HakenmotoDaichoEmployee extends BaseEmployeeWithDates {
  hourlyRate: number | null;     // 時給 = what UNS pays the worker (賃金)
  billingRate?: number | null;   // 単価 = what factory pays UNS (派遣料金)
  nationality: string | null;
}

export interface HakenmotoDaichoData {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  factoryName: string;
  factoryAddress: string;
  factoryPhone: string;
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

  // Supervisors (指揮命令者)
  supervisorDept: string;
  supervisorName: string;
  supervisorPhone: string;

  // 派遣先責任者 (may differ from 指揮命令者)
  hakensakiManagerDept?: string;
  hakensakiManagerName?: string;
  hakensakiManagerPhone?: string;

  complaintClientDept: string;
  complaintClientName: string;
  complaintClientPhone: string;
  complaintUnsDept: string;
  complaintUnsName: string;
  complaintUnsPhone: string;

  // 派遣元責任者 (separate from 苦情処理担当者)
  managerUnsDept?: string;
  managerUnsName?: string;
  managerUnsPhone?: string;

  hasRobotTraining?: boolean;
  employee: HakenmotoDaichoEmployee;
}

// ─── Date format helper: 2025-10-01 → 2025年10月1日 ───

export function generateHakenmotoKanriDaichoPDF(doc: Doc, data: HakenmotoDaichoData): void {
  const emp = data.employee;
  if (!emp) return;

  // ─── Use Mincho font for formal document ───
  doc.font("JP-Mincho");

  const LW = 155;
  const hireRef = getHireReference(emp.actualHireDate, emp.hireDate);
  const isInfinite = hireRef ? isIndefiniteEmployment(hireRef, data.endDate) : false;
  const age = emp.birthDate ? calculateAge(emp.birthDate, data.endDate) : 0;
  const ageGrp = ageGroup(age);
  const is60plus = ageGrp === "60歳以上";
  const gender = genderText(emp.gender);

  let y = 25;

  // ── Title ──
  doc.fontSize(13).fillColor("#000").text("派遣元管理台帳", LM, y, { width: W, align: "center" });
  y += 22;

  doc.fontSize(7).text(
    `労働者派遣法第37条の規定に基づく管理台帳`,
    LM, y, { width: W }
  );
  y += 14;

  // ── 派遣元情報 (UNS info) ──
  drawRow(doc, y, RH, [{ x: LM, w: W, text: "派遣元事業主に関する事項", fontSize: 7, bg: "#d0d0e8" }]);
  y += RH;

  y = labelRow(doc, y, RH, "派遣元事業主の名称", UNS.name, LW);
  y = labelRow(doc, y, RH, "許可番号", UNS.licenseNumber, LW);
  y = labelRow(doc, y, RH, "事業所の所在地", UNS.address.replace("〒", ""), LW);
  y += 3;

  // ── 派遣労働者情報 ──
  drawRow(doc, y, RH, [{ x: LM, w: W, text: "派遣労働者に関する事項", fontSize: 7, bg: "#d0d0e8" }]);
  y += RH;

  y = labelRow(doc, y, RH, "派遣労働者の氏名", emp.katakanaName || emp.fullName, LW);

  const sexAgeText = `${gender}　　${is60plus ? "☑60才以上　□60才未満" : "□60才以上　☑60才未満"}　　（${ageGrp}）`;
  y = labelRow(doc, y, RH, "性別・年齢区分", sexAgeText, LW);

  y = labelRow(doc, y, RH, "国籍", emp.nationality || "", LW);

  y = labelRow(doc, y, RH * 1.5, "雇用形態",
    isInfinite ? "☑無期雇用派遣労働者　□有期雇用派遣労働者" : "□無期雇用派遣労働者　☑有期雇用派遣労働者（3ヵ月）", LW);

  y = labelRow(doc, y, RH * 1.5, "社会・労働保険の加入状況",
    "雇用保険：☑加入 □未加入　健康保険：☑加入 □未加入　厚生年金：☑加入 □未加入", LW);
  y += 3;

  // ── 派遣先情報 ──
  drawRow(doc, y, RH, [{ x: LM, w: W, text: "派遣先に関する事項", fontSize: 7, bg: "#d0d0e8" }]);
  y += RH;

  y = labelRow(doc, y, RH, "派遣先の名称", data.companyName, LW);
  // Use same 高雄 logic as kobetsu-pdf for consistent 就業場所/組織単位
  const jigyosho = getTakaoJigyosho(data.companyName, data.factoryAddress);
  // Takao: companyName + jigyosho (like kobetsu 就業場所), Others: factoryName
  const locationName = jigyosho
    ? [data.companyName, jigyosho].filter(Boolean).join("　")
    : data.factoryName;
  y = labelRow(doc, y, RH * 1.5, "事業所の名称・所在地", `${locationName}　${data.factoryAddress}`, LW);
  const soshikiText = [jigyosho, data.factoryName, data.department]
    .filter(Boolean)
    .join("　");
  y = labelRow(doc, y, RH, "組織単位", soshikiText, LW);
  y = labelRow(doc, y, RH, "事業所電話番号", data.factoryPhone || data.companyPhone, LW);
  y += 3;

  // ── 派遣業務情報 ──
  drawRow(doc, y, RH, [{ x: LM, w: W, text: "派遣業務に関する事項", fontSize: 7, bg: "#d0d0e8" }]);
  y += RH;

  // Detect multi-shift for adaptive sizing
  const shiftLineCount = (data.workHours || "").split("\n").filter(Boolean).length;
  const manyShifts = shiftLineCount > 2;
  const workHoursDisplay = manyShifts ? compactTimeFormat(data.workHours) : data.workHours;
  const breakTimeDisplay = manyShifts ? compactTimeFormat(data.breakTime) : data.breakTime;

  // Adaptive heights: shrink fixed sections when shifts need more space
  const jobH = manyShifts ? RH * 1.5 : RH * 2.5;
  const calH = manyShifts ? RH : RH * 2.5;

  y = labelRowAuto(doc, y, jobH, "業務内容", data.jobDescription, LW);
  y = labelRow(doc, y, RH, "業務に伴う責任の程度",
    "□リーダー業務　□副リーダー業務　□一般事務職　□担当者業務", LW);
  y = labelRow(doc, y, RH, "派遣期間", `${formatDateJP(data.startDate)}　～　${formatDateJP(data.endDate)}`, LW);
  y = labelRowAuto(doc, y, calH, "就業日", data.calendar, LW);
  y = labelRowAuto(doc, y, RH, "就業時間", workHoursDisplay, LW);
  y = labelRowAuto(doc, y, RH, "休憩時間", breakTimeDisplay, LW);
  y = labelRowAuto(doc, y, RH, "時間外労働", data.overtimeHours, LW);
  y += 1;

  // ── 派遣料金・賃金 ──
  drawRow(doc, y, RH, [{ x: LM, w: W, text: "派遣料金・賃金に関する事項", fontSize: 7, bg: "#d0d0e8" }]);
  y += RH;

  // Fix #4: 派遣料金 = 単価 (what factory pays), 賃金 = 時給 (what worker gets)
  const billingRate = emp.billingRate ?? emp.hourlyRate ?? data.hourlyRate;   // 単価 for 派遣料金
  const wageRate = emp.hourlyRate ?? data.hourlyRate;       // 時給 for 賃金
  y = labelRow(doc, y, RH, "派遣料金（1時間あたり）", yen(billingRate), LW);
  y = labelRow(doc, y, RH, "派遣労働者の賃金（1時間）", yen(wageRate), LW);
  y = labelRow(doc, y, RH, "待遇決定方式", "☑協定対象派遣労働者（労使協定方式）", LW);
  y += 1;

  // ── 責任者・苦情処理 ──
  // Adaptive row heights: compact for many-shift documents
  const personH = manyShifts ? RH : RH * 1.3;
  const personHWide = manyShifts ? RH * 1.1 : RH * 1.5;
  drawRow(doc, y, RH, [{ x: LM, w: W, text: "責任者・苦情処理に関する事項", fontSize: 7, bg: "#d0d0e8" }]);
  y += RH;

  const unsMgr = UNS.defaultManager;
  y = labelRow(doc, y, personH, "派遣元責任者",
    `${data.managerUnsDept || unsMgr.dept}　${data.managerUnsName || `${unsMgr.role}　${unsMgr.name}`}　TEL:${data.managerUnsPhone || unsMgr.phone}`, LW);
  y = labelRow(doc, y, personHWide, "派遣元苦情処理担当者",
    `${data.complaintUnsDept || unsMgr.dept}　${data.complaintUnsName || `${unsMgr.role}　${unsMgr.name}`}　TEL:${data.complaintUnsPhone || unsMgr.phone}`, LW);
  // Fix: 派遣先責任者 uses hakensakiManager data, NOT supervisor (指揮命令者)
  const hmDept = data.hakensakiManagerDept || data.supervisorDept;
  const hmName = data.hakensakiManagerName || data.supervisorName;
  const hmPhone = data.hakensakiManagerPhone || data.supervisorPhone;
  y = labelRow(doc, y, personH, "派遣先責任者",
    `${hmDept}　${hmName}　TEL:${hmPhone}`, LW);
  y = labelRow(doc, y, personHWide, "派遣先苦情処理担当者",
    `${data.complaintClientDept || ""}　${data.complaintClientName || ""}　TEL:${data.complaintClientPhone || ""}`, LW);
  y += 1;

  // ── 抵触日通知 ──
  drawRow(doc, y, RH, [{ x: LM, w: W, text: "その他", fontSize: 7, bg: "#d0d0e8" }]);
  y += RH;

  y = labelRow(doc, y, RH, "事業所単位の期間制限に抵触する日", formatDateJP(data.conflictDate) || "", LW);
  y = labelRow(doc, y, RH, "派遣契約の契約日", formatDateJP(data.contractDate), LW);
  y += 1;

  // ── 教育訓練 ── (auto-fill: 安全衛生教育 always, ロボット特別教育 optional)
  const trainRows = manyShifts ? 2 : 3;
  const smallRH = manyShifts ? 10 : RH;

  // Build training content: date = employee's FIRST day of work (hire date), not contract start
  const trainingContent: string[] = [];
  const trainDate = hireRef || data.startDate; // actualHireDate ?? hireDate ?? startDate
  trainingContent.push(`${formatDateJP(trainDate)}　安全衛生教育`);
  if (data.hasRobotTraining) {
    const hire = parseDate(trainDate);
    const nextDay = new Date(hire.getTime() + 86400000);
    const nextStr = `${nextDay.getFullYear()}年${nextDay.getMonth() + 1}月${nextDay.getDate()}日`;
    trainingContent.push(`${nextStr}　産業用ロボット特別教育`);
  }

  drawRow(doc, y, smallRH, [{ x: LM, w: W, text: "教育訓練の実施日時・内容", fontSize: 6.5, bg: "#f0f0f0" }]);
  y += smallRH;
  for (let i = 0; i < trainRows; i++) {
    drawRow(doc, y, smallRH, [
      { x: LM, w: 80, text: `訓練${i + 1}:`, fontSize: 6, bg: "#fafafa" },
      { x: LM + 80, w: W - 80, text: i < trainingContent.length ? trainingContent[i] : "", fontSize: 7 },
    ]);
    y += smallRH;
  }
  y += 1;

  // ── キャリアコンサルティング ── (all 4 years with dates from hire year)
  const careerPlan: { text: string; targets: [number, number][]; hours: number }[] = [
    { text: "1年目：基礎業務、安全衛生及び職場適応状況を確認し、習得目標を設定する。", targets: [[4, 26]], hours: 8 },
    { text: "2年目：設備操作、治具交換及びプログラム入力の習得状況を確認し、応用業務への展開を相談する。", targets: [[8, 12]], hours: 8 },
    { text: "3年目：不良対応、製品確認及び工程対応力を確認し、補足教育を設定する。", targets: [[10, 16]], hours: 8 },
    { text: "4年目：指導力、管理能力及びラインマネジメント能力の育成方針を確認する。", targets: [[12, 16], [12, 26]], hours: 16 },
  ];

  // Calculate baseYear for 相談1: the first April (month 4) that is AFTER the hire date.
  // If the employee entered in e.g. October 2025, April 2025 already passed → baseYear = 2026.
  // If the employee entered in January 2025, April 2025 has not passed yet → baseYear = 2025.
  const hireDateRef = parseDate(hireRef || data.startDate);
  const firstTargetMonth = careerPlan[0].targets[0][0]; // = 4 (April)
  const firstTargetDay   = careerPlan[0].targets[0][1]; // = 26
  const firstTargetSameYear = new Date(hireDateRef.getFullYear(), firstTargetMonth - 1, firstTargetDay);
  const baseYear = firstTargetSameYear <= hireDateRef
    ? hireDateRef.getFullYear() + 1   // target month already passed → next year
    : hireDateRef.getFullYear();       // target month not yet passed → same year

  // Build all 4 career consulting lines: each one year apart from baseYear.
  // Only show lines where the scheduled date has already passed (consultation was due).
  // Future consultations leave the row blank — this is a record, not a plan.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const careerLines = careerPlan.map((plan, i) => {
    const yr = baseYear + i;
    const adjustedDates = plan.targets.map(([m, d]) => adjustToBusinessDay(yr, m, d));
    const firstDate = adjustedDates[0];

    // If the first (earliest) target date is still in the future → blank row
    if (firstDate > today) return "";

    const dateTexts = adjustedDates.map(
      (adj) => `${adj.getFullYear()}年${adj.getMonth() + 1}月${adj.getDate()}日`
    );
    return `${dateTexts.join("・")}　${plan.text}（計${plan.hours}時間）`;
  });

  const careerRowH = manyShifts ? 9 : 10;
  drawRow(doc, y, careerRowH, [{ x: LM, w: W, text: "キャリアコンサルティングの実施日時・内容", fontSize: 6, bg: "#f0f0f0" }]);
  y += careerRowH;
  for (let i = 0; i < 4; i++) {
    drawRow(doc, y, careerRowH, [
      { x: LM, w: 42, text: `相談${i + 1}:`, fontSize: 5.5, bg: "#fafafa" },
      { x: LM + 42, w: W - 42, text: careerLines[i], fontSize: 5 },
    ]);
    y += careerRowH;
  }

  // ── 苦情 ──
  y += 1;

  drawRow(doc, y, smallRH, [{ x: LM, w: W, text: "苦情の申出を受けた日時及び内容", fontSize: 6.5, bg: "#f0f0f0" }]);
  y += smallRH;

  const complaintCols = [
    { x: LM, w: 40, label: "" },
    { x: LM + 40, w: 80, label: "苦情申出日" },
    { x: LM + 120, w: 200, label: "苦情内容" },
    { x: LM + 320, w: W - 320, label: "処理状況" },
  ];

  for (const c of complaintCols) {
    doc.rect(c.x, y, c.w, smallRH).stroke();
    doc.fontSize(5.5).fillColor("#000").text(c.label, c.x, y + 3, { width: c.w, align: "center" });
  }
  y += smallRH;

  const complaintRowH = manyShifts ? RH : RH * 1.5;
  for (let i = 1; i <= 3; i++) {
    for (const c of complaintCols) {
      doc.rect(c.x, y, c.w, complaintRowH).stroke();
    }
    doc.fontSize(6).fillColor("#000").text(`申出${i}`, complaintCols[0].x + 3, y + 3, { width: complaintCols[0].w - 6 });
    y += complaintRowH;
  }

  // 派遣元番号 + 派遣先ID — discreto, right-aligned en el pie
  const idRef = [emp.employeeNumber, emp.clientEmployeeId].filter(Boolean).join(" ");
  if (idRef) {
    doc.fontSize(5.5).fillColor("#aaa")
      .text(idRef, LM, y + 4, { width: W, align: "right", lineBreak: false });
    doc.fillColor("#000");
  }

  // ─── Restore default font for next page ───
  doc.font("JP");
}
