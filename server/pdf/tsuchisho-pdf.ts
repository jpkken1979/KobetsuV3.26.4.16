/**
 * 派遣先通知書 (Dispatch Notification) — Multi-page PDF
 *
 * Lists all employees dispatched under a contract.
 * One row per employee with insurance status and employment type.
 * Ported from PruebaKobetsu (main.js:680-781).
 */
import {
  type Doc,
  UNS,
  calculateAge,
  ageGroup,
  isIndefiniteEmployment,
  genderText,
  getHireReference,
} from "./helpers.js";
import type { BaseEmployeeWithDates } from "./types.js";

export type TsuchishoEmployee = BaseEmployeeWithDates;

export interface TsuchishoData {
  companyName: string;
  contractDate: string;
  startDate: string;
  endDate: string;
  employees: TsuchishoEmployee[];
}

export function generateTsuchishoPDF(doc: Doc, data: TsuchishoData): void {
  const LM = 30;
  const RM = 565;
  const W = RM - LM;

  // ── Title ──
  doc.fontSize(16).text("派遣先通知書", LM, 30, { width: W, align: "center" });

  // ── Recipient ──
  doc.fontSize(10).text(`${data.companyName}　御中`, LM, 55);

  // ── Sender (right-aligned) ──
  doc.fontSize(8);
  doc.text(UNS.name, 350, 55, { width: 200, align: "right" });
  doc.text(UNS.address.replace("〒", ""), 350, 67, { width: 200, align: "right" });
  doc.text(`許可番号　${UNS.licenseNumber}`, 350, 79, { width: 200, align: "right" });

  // ── Reference ──
  doc.fontSize(8).text(
    `${data.contractDate}付の労働者派遣個別契約に基づき以下の者を派遣します。`,
    LM,
    100,
    { width: W }
  );

  let y = 118;

  // ── Table columns ──
  const cols = [
    { x: LM, w: 25, label: "No" },
    { x: LM + 25, w: 120, label: "氏名" },
    { x: LM + 145, w: 30, label: "性別" },
    { x: LM + 175, w: 60, label: "年齢" },
    { x: LM + 235, w: 45, label: "雇用保険" },
    { x: LM + 280, w: 45, label: "健康保険" },
    { x: LM + 325, w: 55, label: "厚生年金保険" },
    { x: LM + 380, w: 65, label: "雇用期間" },
    { x: LM + 445, w: W - 445, label: "待遇決定方式" },
  ];

  const RH = 16;
  doc.lineWidth(0.5);

  // ── Header row ──
  for (const col of cols) {
    doc.rect(col.x, y, col.w, RH).stroke();
    doc.fontSize(6).fillColor("#000").text(col.label, col.x, y + 4, {
      width: col.w,
      align: "center",
    });
  }
  y += RH;

  // ── Employee rows ──
  if (data.employees && data.employees.length > 0) {
    data.employees.forEach((emp, idx) => {
      if (y > 760) {
        doc.addPage();
        y = 30;
        // Re-draw column headers on new page
        for (const col of cols) {
          doc.rect(col.x, y, col.w, RH).stroke();
          doc.fontSize(6).fillColor("#000").text(col.label, col.x, y + 4, {
            width: col.w,
            align: "center",
          });
        }
        y += RH;
      }

      const hireRef = getHireReference(emp.actualHireDate, emp.hireDate);
      const empType =
        hireRef && isIndefiniteEmployment(hireRef, data.endDate)
          ? "無期雇用"
          : "有期雇用(3月)";

      const age = emp.birthDate ? calculateAge(emp.birthDate, data.endDate) : 0;
      const ageGrp = ageGroup(age);

      const gender = genderText(emp.gender);

      const values = [
        `${idx + 1}`,
        emp.katakanaName || emp.fullName,
        gender,
        ageGrp,
        "加入",
        "加入",
        "加入",
        empType,
        "協定対象派遣労働者(労使協定式方式)",
      ];

      for (let i = 0; i < cols.length; i++) {
        doc.rect(cols[i].x, y, cols[i].w, RH).stroke();
        const basefs = i === 1 ? 7 : i === 3 || i === 7 || i === 8 ? 5.5 : 6;
        const minFs = i === 1 ? 5 : 3.5;
        const align = i === 0 ? "center" : i <= 1 ? "left" : "center";
        const pad = align === "left" ? 3 : 0;
        const px = cols[i].x + pad;
        const maxW = cols[i].w - pad - 2;
        // Auto-shrink: reduce font until text fits in one line
        let fs = basefs;
        doc.fontSize(fs);
        while (fs > minFs && doc.widthOfString(values[i]) > maxW) {
          fs -= 0.3;
          doc.fontSize(fs);
        }
        const th = doc.heightOfString(values[i], { width: maxW });
        const ty = y + Math.max((RH - th) / 2, 1);
        // Clip 氏名 column to prevent Vietnamese names from overflowing
        if (i === 1) {
          doc.save();
          doc.rect(cols[i].x, y, cols[i].w, RH).clip();
        }
        doc
          .fillColor("#000")
          .text(values[i], px, ty, {
            width: maxW,
            align,
            lineBreak: false,
          });
        if (i === 1) {
          doc.restore();
        }
      }
      // 派遣先ID in right margin of each employee row
      if (emp.clientEmployeeId) {
        doc.fontSize(5).fillColor("#555")
          .text(emp.clientEmployeeId, RM + 2, y + (RH - 5) / 2, { width: 28, align: "left", lineBreak: false });
        doc.fillColor("#000");
      }
      y += RH;
    });
  }

  // ── Empty rows to fill page ──
  const filledRows = data.employees ? data.employees.length : 0;
  const emptyRows = Math.max(0, 20 - filledRows);
  for (let r = 0; r < emptyRows && y < 720; r++) {
    for (const col of cols) {
      doc.rect(col.x, y, col.w, RH).stroke();
    }
    y += RH;
  }

  // ── Footer ──
  y += 15;
  doc.fontSize(7).fillColor("#000").text("以上", LM, y);
}
