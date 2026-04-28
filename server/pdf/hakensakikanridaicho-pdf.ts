/**
 * 派遣先管理台帳 (Dispatch Destination Management Registry)
 *
 * One page per employee. Matches the Excel template layout:
 * gray labels, split rows, 3-row insurance, checkbox block.
 * 教育訓練: auto — 安全衛生教育 on first contract + every 2 years.
 *
 * Font: JP-Mincho (BIZ UD明朝) for formal appearance.
 */
import {
  type Doc,
  UNS,
  parseDate,
  calculateAge,
  ageGroup,
  isIndefiniteEmployment,
  genderText,
  getHireReference,
  formatDateJP,
  getTakaoJigyosho,
} from "./helpers.js";
import type { BaseEmployeeWithDates } from "./types.js";

export interface DaichoEmployee extends BaseEmployeeWithDates {
  isFirstContract?: boolean;
}

export interface DaichoData {
  companyName: string;
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
  supervisorDept: string;
  supervisorName: string;
  supervisorPhone: string;
  commanderDept: string;
  commanderName: string;
  commanderPhone: string;
  // 派遣先責任者 (may differ from 指揮命令者)
  hakensakiManagerDept?: string;
  hakensakiManagerName?: string;
  hakensakiManagerPhone?: string;
  complaintUnsDept: string;
  complaintUnsName: string;
  complaintUnsPhone: string;
  // 派遣元責任者 (separate from 苦情処理担当者)
  managerUnsDept?: string;
  managerUnsName?: string;
  managerUnsPhone?: string;
  managerUnsAddress?: string;
  hasRobotTraining?: boolean;
  employee: DaichoEmployee;
}

// ─── Date format helper: 2025-10-01 → 2025年10月1日 ───

export function generateHakensakiKanriDaichoPDF(doc: Doc, data: DaichoData): void {
  const emp = data.employee;
  if (!emp) return;

  // ─── Use Mincho font for formal document ───
  doc.font("JP-Mincho");

  // ─── Layout ───
  const ML = 30;
  const TW = 535;
  const RH = 18;
  const LW = 115;
  const VW = TW - LW;
  const VX = ML + LW;

  // ─── Calculations ───
  const hireRef = getHireReference(emp.actualHireDate, emp.hireDate);
  const isInfinite = hireRef ? isIndefiniteEmployment(hireRef, data.endDate) : false;
  const age = emp.birthDate ? calculateAge(emp.birthDate, data.endDate) : 0;
  const ageGrp = ageGroup(age);
  const is60plus = ageGrp === "60歳以上";
  const gender = genderText(emp.gender);



  // ─── Drawing helpers (gray labels only, no colors) ───
  const lbl = (x: number, y: number, w: number, h: number, text: string, fs = 6.5) => {
    doc.lineWidth(0.4).rect(x, y, w, h).stroke();
    doc.save().fillColor("#f5f5f5").rect(x + 0.2, y + 0.2, w - 0.4, h - 0.4).fill().restore();
    doc.fontSize(fs).fillColor("#000");
    const th = doc.heightOfString(text, { width: w - 4 });
    doc.text(text, x + 2, y + Math.max((h - th) / 2, 1), { width: w - 4, align: "center" });
  };

  const val = (x: number, y: number, w: number, h: number, text: string, fs = 7) => {
    doc.lineWidth(0.4).rect(x, y, w, h).stroke();
    doc.fontSize(fs).fillColor("#000");
    const th = doc.heightOfString(text || "", { width: w - 6 });
    doc.text(text || "", x + 3, y + Math.max((h - th) / 2, 1), { width: w - 6 });
  };

  // Auto-shrink val: shrinks font size until text fits the cell height
  const valFit = (x: number, y: number, w: number, h: number, text: string, maxFs = 7) => {
    doc.lineWidth(0.4).rect(x, y, w, h).stroke();
    let fs = maxFs;
    while (fs > 4) {
      doc.fontSize(fs);
      const th = doc.heightOfString(text || "", { width: w - 6 });
      if (th <= h - 2) break;
      fs -= 0.5;
    }
    doc.fontSize(fs).fillColor("#000");
    doc.text(text || "", x + 3, y + 2, { width: w - 6 });
  };

  const fullRow = (y: number, h: number, label: string, value: string, lFs = 6.5, vFs = 7) => {
    lbl(ML, y, LW, h, label, lFs);
    val(VX, y, VW, h, value, vFs);
  };

  // Split row: label | value | right-label | right-value
  const splitRow = (y: number, h: number, label: string, value: string,
    rLbl: string, rVal: string, mainW: number, rLblW: number, lFs = 6.5) => {
    const rValW = VW - mainW - rLblW;
    lbl(ML, y, LW, h, label, lFs);
    val(VX, y, mainW, h, value);
    lbl(VX + mainW, y, rLblW, h, rLbl, 6);
    val(VX + mainW + rLblW, y, rValW, h, rVal, 6.5);
  };

  // ─── Content ───
  let y = 30;

  // ═══ Title ═══
  doc.fontSize(14).fillColor("#000").text("派遣先管理台帳", ML, y, { width: TW, align: "center" });
  y += 32;

  // ═══ Subtitle (with Japanese date format) ═══
  const subtitleDate = formatDateJP(data.contractDate || data.startDate);
  doc.fontSize(7).fillColor("#000").text(
    `${subtitleDate}に締結した労働者派遣個別契約に基づき、下記の者を派遣致します。就業条件は前記の契約書の条件に同じとする。`,
    ML, y, { width: TW }
  );
  y += 22;

  // ═══ 派遣労働者の氏名 ═══
  fullRow(y, RH, "派遣労働者の氏名", emp.katakanaName || emp.fullName);
  y += RH;

  // ═══ 性別 / 60才以上か否かの別 ═══
  lbl(ML, y, LW, RH, "性別/60才以上か否かの別", 5.5);
  val(VX, y, VW, RH,
    `${gender}　　${is60plus ? "☑" : "□"}60才以上　${is60plus ? "□" : "☑"}60才未満　　（${ageGrp}）`);
  y += RH;

  // ═══ 社会保険 (3 rows spanning label) ═══
  const insH = RH * 3;
  lbl(ML, y, LW, insH, "社会保険・雇用保険の\n被保険者資格取得届\nの有無", 5.5);
  const insNames = ["雇用保険", "健康保険", "厚生年金保険"];
  insNames.forEach((name, i) => {
    val(VX, y + i * RH, VW, RH,
      `${name}：　☑ 有　□ 無　　無の理由：　　　　　　　提出予定：`, 7);
  });
  y += insH;

  // ═══ 派遣先の事業所名称 ═══
  // Use same 高雄 logic as hakenmoto — companyName + jigyosho
  const jigyosho = getTakaoJigyosho(data.companyName, data.factoryAddress);
  const jigyoshoNameText = jigyosho
    ? [data.companyName, jigyosho].filter(Boolean).join("　")
    : data.companyName;
  fullRow(y, RH, "派遣先の事業所名称", jigyoshoNameText);
  y += RH;

  // ═══ 事業所の所在地 + 組織単位 (split) ═══
  const soshikiText = [jigyosho, data.factoryName, data.department]
    .filter(Boolean)
    .join("　");
  splitRow(y, RH, "事業所の所在地", data.factoryAddress,
    "組織単位", soshikiText, 250, 55);
  y += RH;

  // ═══ 所属部署 + 電話番号 (split right) ═══
  const jigyoshoPrefix = jigyosho ? `${jigyosho}　` : "";
  const shozokuText = `${jigyoshoPrefix}${data.factoryName}　${data.department}`;
  splitRow(y, RH, "所 属 部 署", shozokuText,
    "電話番号", data.factoryPhone, 280, 55);
  y += RH;

  // ═══ 業務内容 + 雇用期間の有無 (split, auto-shrink) ═══
  const jobRowH = 34;
  const jobW = 230;
  const empLW = 75;
  const empVW = VW - jobW - empLW;
  lbl(ML, y, LW, jobRowH, "業 務 内 容");
  valFit(VX, y, jobW, jobRowH, data.jobDescription);
  lbl(VX + jobW, y, empLW, jobRowH, "雇用期間の有無", 5.5);
  const empX = VX + jobW + empLW;
  doc.lineWidth(0.4).rect(empX, y, empVW, jobRowH).stroke();
  doc.fontSize(7).fillColor("#000");
  // Draw checkbox and label in fixed columns so both lines align identically.
  const boxX = empX + 3;
  const textX = empX + 15;
  const line1Y = y + 6;
  const line2Y = y + 18;
  doc.text(isInfinite ? "□" : "☑", boxX, line1Y, { lineBreak: false });
  doc.text("有期雇用", textX, line1Y, { lineBreak: false });
  doc.text(isInfinite ? "☑" : "□", boxX, line2Y, { lineBreak: false });
  doc.text("無期雇用", textX, line2Y, { lineBreak: false });
  y += jobRowH;

  // ═══ 業務に伴う責任の程度 ═══
  fullRow(y, RH, "業務に伴う責任の程度",
    "☑付与される権限なし / □付与される権限あり（詳細：　　　）");
  y += RH;

  // ═══ 派遣期間 + checkbox block — label merges vertically across both rows ═══
  const cbLineH = 15;
  const cbH = cbLineH * 3;
  const periodTotalH = RH + cbH;

  // Label cell spans full height (date row + checkbox rows)
  lbl(ML, y, LW, periodTotalH, "派 遣 期 間");

  // Date value (top portion only)
  val(VX, y, VW, RH, `${formatDateJP(data.startDate)}　～　${formatDateJP(data.endDate)}`);
  y += RH;

  // Checkbox content (bottom portion)
  doc.lineWidth(0.4).rect(VX, y, VW, cbH).stroke();
  doc.fontSize(6.5).fillColor("#000");
  const cbX = VX + 4;
  const cbW = VW - 8;
  doc.text(`${isInfinite ? "☑" : "□"}無期雇用派遣労働者に限定／${isInfinite ? "□" : "☑"}無期雇用派遣労働者に限定なし`,
    cbX, y + 3, { width: cbW });
  doc.text(`${is60plus ? "☑" : "□"}60歳以上に限定／${is60plus ? "□" : "☑"}60歳以上に限定なし`,
    cbX, y + 3 + cbLineH, { width: cbW });
  doc.text("☑協定対象労働者に限定／□協定対象労働者に限定なし",
    cbX, y + 3 + cbLineH * 2, { width: cbW });
  y += cbH;

  // ═══ 製造業務専門 / 派遣先責任者 + 電話番号 (split right) ═══
  const hmDept = data.hakensakiManagerDept ?? "";
  const hmName = data.hakensakiManagerName ?? "";
  const hmPhone = data.hakensakiManagerPhone ?? "";
  splitRow(y, RH, "製造業務専門\n派遣先責任者", `${hmDept}　${hmName}`,
    "電話番号", hmPhone, 280, 55, 5.5);
  y += RH;

  // ═══ 派遣元の事業所名称 + 許可番号 (split right) ═══
  splitRow(y, RH, "派遣元の事業所名称", UNS.name,
    "許可番号", UNS.licenseNumber, 200, 55);
  y += RH;

  // ═══ 派遣元の所在地 ═══
  fullRow(y, RH, "派遣元の所在地", data.managerUnsAddress || UNS.address);
  y += RH;

  // ═══ 製造業務専門 / 派遣元責任者 + 電話番号 (split right) ═══
  const mgr = UNS.defaultManager;
  const motoText = `${data.managerUnsDept || mgr.dept}　${data.managerUnsName || `${mgr.role}　${mgr.name}`}`;
  splitRow(y, RH, "製造業務専門\n派遣元責任者", motoText,
    "電話番号", data.managerUnsPhone || mgr.phone, 280, 55, 5.5);
  y += RH;

  // ═══ 就業日 + 就業状況 (split) ═══
  splitRow(y, RH, "就 業 日", "派遣先の年間カレンダーによる",
    "就業状況", "別紙タイムカード通り", 250, 55);
  y += RH;

  y += 6;

  // ═══ 教育訓練を行った日時と内容 ═══
  doc.lineWidth(0.4).rect(ML, y, TW, RH).stroke();
  doc.fontSize(7).fillColor("#000").text("教育訓練を行った日時と内容", ML + 3, y + (RH - 7) / 2, { width: TW - 6 });
  y += RH;

  // Auto-fill training content: date = employee's FIRST day of work, not contract start
  const trainingLines: string[] = [];
  const trainDate = hireRef || data.startDate; // actualHireDate ?? hireDate ?? startDate

  // 安全衛生教育 — ALWAYS mandatory per 労働安全衛生法 第59条
  trainingLines.push(`${formatDateJP(trainDate)}　安全衛生教育`);

  // 産業用ロボット特別教育 — optional, day after first work day
  if (data.hasRobotTraining) {
    const hire = parseDate(trainDate);
    const nextDay = new Date(hire.getTime() + 86400000);
    const nextStr = `${nextDay.getFullYear()}年${nextDay.getMonth() + 1}月${nextDay.getDate()}日`;
    trainingLines.push(`${nextStr}　産業用ロボット特別教育`);
  }

  const trainH = RH * 2.5;
  doc.lineWidth(0.4).rect(ML, y, TW, trainH).stroke();
  if (trainingLines.length > 0) {
    doc.fontSize(7).fillColor("#000");
    trainingLines.forEach((line, i) => {
      doc.text(line, ML + 5, y + 4 + i * 12, { width: TW - 10 });
    });
  }
  y += trainH;

  y += 6;

  // ═══ 苦情申出の状況 ═══
  const kujoLW = 55;
  const kujoPairH = RH * 2;
  const kujoHeaderH = RH;
  const kujoTotalH = kujoHeaderH + kujoPairH * 3;

  lbl(ML, y, kujoLW, kujoTotalH, "苦情申出\nの状況", 6);

  const kx = ML + kujoLW;
  const kw = TW - kujoLW;
  const dateW = 80;
  const contentW = kw - dateW;

  lbl(kx, y, dateW, kujoHeaderH, "申出受付日", 6);
  lbl(kx + dateW, y, contentW, kujoHeaderH, "苦情内容、処理状況、備考　等", 6);
  y += kujoHeaderH;

  for (let i = 1; i <= 3; i++) {
    const halfH = kujoPairH / 2;
    doc.lineWidth(0.4);
    doc.rect(kx, y, dateW, kujoPairH).stroke();
    doc.rect(kx + dateW, y, contentW, kujoPairH).stroke();
    doc.fontSize(6).fillColor("#000").text("申出", kx + 3, y + 3, { width: 25 });
    doc.fontSize(6).fillColor("#000").text(`紛議${i}`, kx + 3, y + halfH + 3, { width: 35 });
    doc.moveTo(kx, y + halfH).lineTo(kx + kw, y + halfH).stroke();
    y += kujoPairH;
  }

  y += 8;

  // ═══ Footer ═══
  doc.fontSize(6).fillColor("#666").text("【教育訓練記録：毎２年更新】", ML, y, { width: TW });
  // 派遣先ID — discreto, right-aligned en el pie
  if (emp.clientEmployeeId) {
    doc.fontSize(5.5).fillColor("#aaa")
      .text(emp.clientEmployeeId, ML, y, { width: TW, align: "right", lineBreak: false });
    doc.fillColor("#000");
  }

  // ─── Restore default font for next page ───
  doc.font("JP");
}
