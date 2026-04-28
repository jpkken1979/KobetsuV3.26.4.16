/**
 * Factory Excel export route.
 */
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { auditLog } from "../../db/schema.js";
import fs from "node:fs";
import path from "node:path";

const factoriesRouter = new Hono();

// POST /api/factories/export-excel — Generate Excel and save to disk
const EXPORT_DIR = process.env.EXPORT_DIR ?? path.resolve("DataTotal");

factoriesRouter.post("/export-excel", async (c) => {
  try {
    const allFactories = await db.query.factories.findMany({
      with: { company: true },
      orderBy: (t, { asc }) => [asc(t.factoryName), asc(t.department), asc(t.lineName)],
    });
    const allCompanies = await db.query.clientCompanies.findMany();
    const allFactoryYearlyConfigs = await db.query.factoryYearlyConfig.findMany({
      with: {
        factory: {
          with: {
            company: true,
          },
        },
      },
      orderBy: (t, { asc, desc }) => [asc(t.factoryId), desc(t.fiscalYear), asc(t.id)],
    });
    const allCompanyYearlyConfigs = await db.query.companyYearlyConfig.findMany({
      with: {
        company: true,
      },
      orderBy: (t, { asc, desc }) => [asc(t.companyId), desc(t.fiscalYear), asc(t.id)],
    });

    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "JP個別契約書 v26.3.31";
    workbook.created = new Date();

    // Sheet 0: README — quick instructions for manual editing
    const readmeSheet = workbook.addWorksheet("README", {
      views: [{ state: "frozen" as const, xSplit: 0, ySplit: 1 }],
    });
    readmeSheet.columns = [
      { width: 22 },
      { width: 88 },
    ];
    readmeSheet.mergeCells("A1:B1");
    const readmeTitle = readmeSheet.getCell("A1");
    readmeTitle.value = "Excel export guide";
    readmeTitle.font = { name: "Meiryo UI", size: 12, bold: true, color: { argb: "FF1A73E8" } };
    readmeTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6E4FD" } };
    readmeTitle.alignment = { horizontal: "center", vertical: "middle" };
    readmeTitle.border = {
      top: { style: "thin", color: { argb: "FFD1D5DB" } },
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
      left: { style: "thin", color: { argb: "FFD1D5DB" } },
      right: { style: "thin", color: { argb: "FFD1D5DB" } },
    };

    const readmeRows = [
      ["用途", "このブックは企業・工場の基本情報と年度設定を、手で編集しやすい形で出力します。"],
      ["編集の順番", "まず README を確認し、次に 年度設定_工場 / 年度設定_企業 を直してください。最後に 企業データ一覧 を確認すると安心です。"],
      ["年度の意味", "年度は 10/01 〜 翌年 09/30 の区切りです。例えば 2024 は 2024/10/01 〜 2025/09/30 を表します。"],
      ["工場年度設定", "各工場ごとの就業日テキスト、休日テキスト、休暇処理、指揮命令者、派遣先責任者を1行ずつ管理します。"],
      ["企業年度設定", "企業共通で使う休日テキスト、休暇処理、派遣先責任者の既定値をまとめます。"],
      ["優先順位", "PDF生成時は 工場年度設定 > 企業年度設定 > 工場の固定値 の順で反映されます。"],
      ["注意", "列を削除せず、値だけ編集してください。年度列は数値のまま残してください。"],
    ];
    readmeRows.forEach((row, index) => {
      const excelRow = readmeSheet.addRow(row);
      excelRow.height = index === 0 ? 22 : 30;
      excelRow.eachCell((cell, colNumber) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 === 0 ? "FFFFFFFF" : "FFF8F9FA" } };
        cell.font = {
          name: "Meiryo UI",
          size: colNumber === 1 ? 10 : 9,
          bold: colNumber === 1,
          color: { argb: "FF333333" },
        };
        cell.alignment = {
          vertical: "middle",
          wrapText: true,
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE0E0E0" } },
          bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
          left: { style: "thin", color: { argb: "FFE0E0E0" } },
          right: { style: "thin", color: { argb: "FFE0E0E0" } },
        };
      });
    });
    readmeSheet.getColumn(1).alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    readmeSheet.getColumn(2).alignment = { horizontal: "left", vertical: "middle", wrapText: true };

    // ── Column definitions with group colors ──
    const cols: { header: string; key: string; group: string; width: number }[] = [
      // basic
      { header: "会社名", key: "companyName", group: "basic", width: 30 },
      { header: "工場名", key: "factoryName", group: "basic", width: 18 },
      { header: "部署", key: "department", group: "basic", width: 14 },
      { header: "ライン名", key: "lineName", group: "basic", width: 16 },
      { header: "住所", key: "address", group: "basic", width: 38 },
      { header: "TEL", key: "phone", group: "basic", width: 16 },
      // hakensakiManager — short headers: parser prepends group name "派遣先責任者"
      { header: "氏名", key: "hakensakiManagerName", group: "hakensakiManager", width: 16 },
      { header: "部署", key: "hakensakiManagerDept", group: "hakensakiManager", width: 16 },
      { header: "TEL", key: "hakensakiManagerPhone", group: "hakensakiManager", width: 16 },
      { header: "役職", key: "hakensakiManagerRole", group: "hakensakiManager", width: 12 },
      // supervisor — parser prepends "指揮命令者"
      { header: "氏名", key: "supervisorName", group: "supervisor", width: 16 },
      { header: "部署", key: "supervisorDept", group: "supervisor", width: 16 },
      { header: "TEL", key: "supervisorPhone", group: "supervisor", width: 16 },
      { header: "役職", key: "supervisorRole", group: "supervisor", width: 12 },
      // complaintClient — parser prepends "苦情処理(派遣先)"
      { header: "氏名", key: "complaintClientName", group: "complaintClient", width: 16 },
      { header: "部署", key: "complaintClientDept", group: "complaintClient", width: 16 },
      { header: "TEL", key: "complaintClientPhone", group: "complaintClient", width: 16 },
      // complaintUns — parser prepends "苦情処理(派遣元)"
      { header: "氏名", key: "complaintUnsName", group: "complaintUns", width: 16 },
      { header: "部署", key: "complaintUnsDept", group: "complaintUns", width: 16 },
      { header: "TEL", key: "complaintUnsPhone", group: "complaintUns", width: 16 },
      { header: "所在地", key: "complaintUnsAddress", group: "complaintUns", width: 30 },
      // managerUns — parser prepends "派遣元責任者"
      { header: "氏名", key: "managerUnsName", group: "managerUns", width: 16 },
      { header: "部署", key: "managerUnsDept", group: "managerUns", width: 16 },
      { header: "TEL", key: "managerUnsPhone", group: "managerUns", width: 16 },
      { header: "所在地", key: "managerUnsAddress", group: "managerUns", width: 30 },
      // work
      { header: "単価", key: "hourlyRate", group: "work", width: 10 },
      { header: "仕事内容", key: "jobDescription", group: "work", width: 34 },
      { header: "シフト", key: "shiftPattern", group: "work", width: 14 },
      { header: "就業時間", key: "workHours", group: "work", width: 20 },
      { header: "昼勤時間", key: "workHoursDay", group: "work", width: 16 },
      { header: "夜勤時間", key: "workHoursNight", group: "work", width: 16 },
      { header: "休憩時間", key: "breakTimeDay", group: "work", width: 30 },
      { header: "休憩(分)", key: "breakTime", group: "work", width: 10 },
      { header: "夜勤休憩", key: "breakTimeNight", group: "work", width: 20 },
      { header: "時間外", key: "overtimeHours", group: "work", width: 14 },
      { header: "就業日外労働", key: "overtimeOutsideDays", group: "work", width: 18 },
      { header: "就業日", key: "workDays", group: "work", width: 14 },
      // contract
      { header: "抵触日", key: "conflictDate", group: "contract", width: 14 },
      { header: "契約期間", key: "contractPeriod", group: "contract", width: 14 },
      { header: "締め日テキスト", key: "closingDayText", group: "contract", width: 14 },
      { header: "支払日テキスト", key: "paymentDayText", group: "contract", width: 14 },
      { header: "カレンダー", key: "calendar", group: "contract", width: 14 },
      { header: "銀行口座", key: "bankAccount", group: "contract", width: 20 },
      { header: "時間単位", key: "timeUnit", group: "contract", width: 12 },
      // worker
      { header: "作業者締め日", key: "workerClosingDay", group: "worker", width: 14 },
      { header: "作業者支払日", key: "workerPaymentDay", group: "worker", width: 14 },
      { header: "作業者カレンダー", key: "workerCalendar", group: "worker", width: 14 },
      // legal
      { header: "当該協定期間", key: "agreementPeriodEnd", group: "legal", width: 14 },
      { header: "説明者", key: "explainerName", group: "legal", width: 14 },
      { header: "産業用ロボット特別教育", key: "hasRobotTraining", group: "legal", width: 20 },
    ];

    const groupColors: Record<string, { fill: string; text: string; label: string }> = {
      basic:            { fill: "E8F0FE", text: "1A73E8", label: "基本情報" },
      supervisor:       { fill: "E6F4EA", text: "137333", label: "指揮命令者" },
      hakensakiManager: { fill: "FEF7E0", text: "B06000", label: "派遣先責任者" },
      complaintClient:  { fill: "FCE8E6", text: "C5221F", label: "苦情処理(派遣先)" },
      complaintUns:     { fill: "F3E8FD", text: "7627BB", label: "苦情処理(派遣元)" },
      managerUns:       { fill: "E0F2F1", text: "00796B", label: "派遣元責任者" },
      work:             { fill: "FFF3E0", text: "E65100", label: "勤務条件" },
      contract:         { fill: "E8EAF6", text: "283593", label: "契約・支払" },
      worker:           { fill: "E0F7FA", text: "00838F", label: "作業者" },
      legal:            { fill: "EFEBE9", text: "4E342E", label: "法定" },
    };

    // Sheet 1: Factory data
    const ws = workbook.addWorksheet("企業データ一覧", {
      views: [{ state: "frozen" as const, xSplit: 1, ySplit: 2 }],
    });

    // Set column widths and default font for all columns
    cols.forEach((col, i) => {
      const column = ws.getColumn(i + 1);
      column.width = col.width;
      column.font = { name: "Meiryo UI", size: 10 };
      column.alignment = { vertical: "middle", wrapText: true };
    });

    // ── Row 1: Group header bar (merged, pastel fill + colored text) ──
    const groupSpans: { group: string; start: number; end: number }[] = [];
    let curGroup = cols[0].group;
    let spanStart = 0;
    for (let i = 1; i <= cols.length; i++) {
      if (i === cols.length || cols[i].group !== curGroup) {
        groupSpans.push({ group: curGroup, start: spanStart + 1, end: i });
        if (i < cols.length) { curGroup = cols[i].group; spanStart = i; }
      }
    }

    ws.addRow(cols.map(() => ""));
    ws.getRow(1).height = 26;
    for (const span of groupSpans) {
      const gc = groupColors[span.group];
      if (span.end > span.start) ws.mergeCells(1, span.start, 1, span.end);
      const cell = ws.getCell(1, span.start);
      cell.value = gc?.label ?? span.group;
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${gc?.fill ?? "F3F4F6"}` } };
      cell.font = { name: "Meiryo UI", size: 10, bold: true, color: { argb: `FF${gc?.text ?? "333333"}` } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        bottom: { style: "thin", color: { argb: `FF${gc?.text ?? "999999"}` } },
      };
    }

    // ── Row 2: Column sub-headers (same fill as group, bold dark text) ──
    const headerRow = ws.addRow(cols.map((c) => c.header));
    headerRow.height = 24;
    cols.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      const gc = groupColors[col.group];
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${gc?.fill ?? "F3F4F6"}` } };
      cell.font = { name: "Meiryo UI", size: 10, bold: true, color: { argb: "FF1F2937" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        bottom: { style: "medium", color: { argb: `FF${gc?.text ?? "999999"}` } },
        top: { style: "thin", color: { argb: "FFD1D5DB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });

    // Auto filter on row 2
    ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: cols.length } };

    // ── Data rows with alternating colors and thin borders ──
    const companyPalette = ["1A73E8", "137333", "B06000", "C5221F", "7627BB", "00796B", "E65100", "283593", "00838F", "4E342E"];
    const companyColorMap = new Map<string, number>();
    let colorIdx = 0;
    const sortedFactories = [...allFactories].sort((a, b) => {
      const ca = a.company?.name ?? "";
      const cb = b.company?.name ?? "";
      if (ca !== cb) return ca.localeCompare(cb);
      if (a.factoryName !== b.factoryName) return a.factoryName.localeCompare(b.factoryName);
      return (a.department ?? "").localeCompare(b.department ?? "");
    });

    let prevCompany = "";
    let dataRowIdx = 0;
    for (const f of sortedFactories) {
      const companyName = f.company?.name ?? "";
      const isNewCompany = companyName !== prevCompany;
      prevCompany = companyName;

      if (!companyColorMap.has(companyName)) {
        companyColorMap.set(companyName, colorIdx % companyPalette.length);
        colorIdx++;
      }
      const companyHex = companyPalette[companyColorMap.get(companyName)!];

      const values = [
        companyName, f.factoryName, f.department ?? "", f.lineName ?? "",
        f.address ?? "", f.phone ?? "",
        f.hakensakiManagerName ?? "", f.hakensakiManagerDept ?? "", f.hakensakiManagerPhone ?? "", f.hakensakiManagerRole ?? "",
        f.supervisorName ?? "", f.supervisorDept ?? "", f.supervisorPhone ?? "", f.supervisorRole ?? "",
        f.complaintClientName ?? "", f.complaintClientDept ?? "", f.complaintClientPhone ?? "",
        f.complaintUnsName ?? "", f.complaintUnsDept ?? "", f.complaintUnsPhone ?? "", f.complaintUnsAddress ?? "",
        f.managerUnsName ?? "", f.managerUnsDept ?? "", f.managerUnsPhone ?? "", f.managerUnsAddress ?? "",
        f.hourlyRate ?? "", f.jobDescription ?? "",
        f.shiftPattern ?? "", f.workHours ?? "", f.workHoursDay ?? "", f.workHoursNight ?? "",
        f.breakTimeDay ?? "", f.breakTime ?? "", f.breakTimeNight ?? "",
        f.overtimeHours ?? "", f.overtimeOutsideDays ?? "", f.workDays ?? "",
        f.conflictDate ?? "", f.contractPeriod ?? "",
        f.closingDayText ?? "", f.paymentDayText ?? "", f.calendar ?? "",
        f.bankAccount ?? "", f.timeUnit ?? "",
        f.workerClosingDay ?? "", f.workerPaymentDay ?? "", f.workerCalendar ?? "",
        f.agreementPeriodEnd ?? "", f.explainerName ?? "", f.hasRobotTraining ? "1" : "",
      ];

      const row = ws.addRow(values);
      row.height = 20;
      const bg = dataRowIdx % 2 === 0 ? "FFFFFFFF" : "FFF8F9FA";
      const thinBorder = { style: "thin" as const, color: { argb: "FFE0E0E0" } };

      cols.forEach((col, i) => {
        const cell = row.getCell(i + 1);
        const isCompanyCell = col.key === "companyName";
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.font = {
          name: "Meiryo UI", size: 10,
          bold: isCompanyCell,
          color: isCompanyCell ? { argb: `FF${companyHex}` } : { argb: "FF333333" },
        };
        cell.alignment = {
          horizontal: col.key === "hourlyRate" ? "right" : "left",
          vertical: "middle",
          wrapText: true,
        };
        cell.border = {
          top: thinBorder,
          bottom: thinBorder,
          left: thinBorder,
          right: thinBorder,
          ...(isNewCompany ? { top: { style: "medium" as const, color: { argb: `FF${companyHex}` } } } : {}),
        };
      });
      dataRowIdx++;
    }

    // Sheet 2: Company info — styled to match Sheet 1
    const ws2 = workbook.addWorksheet("企業情報", {
      views: [{ state: "frozen" as const, xSplit: 1, ySplit: 1 }],
    });
    const companyHeaders = ["会社名", "会社名カナ", "略称", "住所", "TEL", "代表者", "有効"];
    const companyColWidths = [34, 26, 16, 42, 18, 18, 10];

    // Set column defaults
    companyColWidths.forEach((w, i) => {
      const column = ws2.getColumn(i + 1);
      column.width = w;
      column.font = { name: "Meiryo UI", size: 10 };
      column.alignment = { vertical: "middle", wrapText: true };
    });

    // Header row with distinct color
    const companyHeaderRow = ws2.addRow(companyHeaders);
    companyHeaderRow.height = 26;
    companyHeaders.forEach((_h, i) => {
      const cell = companyHeaderRow.getCell(i + 1);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F0FE" } };
      cell.font = { name: "Meiryo UI", size: 10, bold: true, color: { argb: "FF1A73E8" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        bottom: { style: "medium", color: { argb: "FF1A73E8" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });

    // Auto filter on header
    ws2.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: companyHeaders.length } };

    // Data rows with alternating colors
    const sortedCompanies = allCompanies.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    sortedCompanies.forEach((co, idx) => {
      const row = ws2.addRow([co.name ?? "", co.nameKana ?? "", co.shortName ?? "", co.address ?? "", co.phone ?? "", co.representative ?? "", co.isActive ? "1" : "0"]);
      row.height = 20;
      const bg = idx % 2 === 0 ? "FFFFFFFF" : "FFF8F9FA";
      const thinBorder = { style: "thin" as const, color: { argb: "FFE0E0E0" } };
      companyHeaders.forEach((_h, i) => {
        const cell = row.getCell(i + 1);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.font = { name: "Meiryo UI", size: 10, color: { argb: "FF333333" } };
        cell.alignment = { vertical: "middle", wrapText: true };
        cell.border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
      });
    });

    // Sheet 3: Factory yearly config — easy to edit by fiscal year
    const ws3 = workbook.addWorksheet("年度設定_工場", {
      views: [{ state: "frozen" as const, xSplit: 0, ySplit: 1 }],
    });
    const factoryYearlyHeaders = [
      "会社名",
      "工場名",
      "部署",
      "ライン名",
      "年度",
      "対象期間",
      "就業日テキスト",
      "休日テキスト",
      "休暇処理",
      "指揮命令者部署",
      "指揮命令者氏名",
      "指揮命令者役職",
      "指揮命令者TEL",
      "派遣先責任者部署",
      "派遣先責任者氏名",
      "派遣先責任者役職",
      "派遣先責任者TEL",
      "更新日",
    ];
    const factoryYearlyWidths = [24, 20, 14, 16, 10, 18, 28, 28, 18, 18, 18, 14, 16, 18, 18, 14, 16, 20];
    ws3.columns = factoryYearlyWidths.map((width) => ({ width }));
    const ws3Header = ws3.addRow(factoryYearlyHeaders);
    ws3Header.height = 24;
    factoryYearlyHeaders.forEach((_header, i) => {
      const cell = ws3Header.getCell(i + 1);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6E4FD" } };
      cell.font = { name: "Meiryo UI", size: 9, bold: true, color: { argb: "FF1A73E8" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "medium", color: { argb: "FF1A73E8" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });
    ws3.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: factoryYearlyHeaders.length } };
    allFactoryYearlyConfigs.forEach((config, index) => {
      const row = ws3.addRow([
        config.factory?.company?.name ?? "",
        config.factory?.factoryName ?? "",
        config.factory?.department ?? "",
        config.factory?.lineName ?? "",
        config.fiscalYear,
        `${config.fiscalYear}/10/01 〜 ${config.fiscalYear + 1}/09/30`,
        config.sagyobiText ?? "",
        config.kyujitsuText ?? "",
        config.kyuukashori ?? "",
        config.supervisorDept ?? "",
        config.supervisorName ?? "",
        config.supervisorRole ?? "",
        config.supervisorPhone ?? "",
        config.hakensakiManagerDept ?? "",
        config.hakensakiManagerName ?? "",
        config.hakensakiManagerRole ?? "",
        config.hakensakiManagerPhone ?? "",
        config.updatedAt ?? "",
      ]);
      row.height = 20;
      const bg = index % 2 === 0 ? "FFFFFFFF" : "FFF8F9FA";
      const thinBorder = { style: "thin" as const, color: { argb: "FFE0E0E0" } };
      factoryYearlyHeaders.forEach((_header, i) => {
        const cell = row.getCell(i + 1);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.font = { name: "Meiryo UI", size: 9, color: { argb: "FF333333" } };
        cell.alignment = {
          horizontal: i === 4 ? "center" : "left",
          vertical: "middle",
          wrapText: true,
        };
        cell.border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
      });
    });

    // Sheet 4: Company yearly config — shared defaults by fiscal year
    const ws4 = workbook.addWorksheet("年度設定_企業", {
      views: [{ state: "frozen" as const, xSplit: 0, ySplit: 1 }],
    });
    const companyYearlyHeaders = [
      "会社名",
      "年度",
      "対象期間",
      "休日テキスト",
      "休暇処理",
      "派遣先責任者部署",
      "派遣先責任者氏名",
      "派遣先責任者役職",
      "派遣先責任者TEL",
      "更新日",
    ];
    const companyYearlyWidths = [24, 10, 18, 28, 18, 18, 18, 14, 16, 20];
    ws4.columns = companyYearlyWidths.map((width) => ({ width }));
    const ws4Header = ws4.addRow(companyYearlyHeaders);
    ws4Header.height = 24;
    companyYearlyHeaders.forEach((_header, i) => {
      const cell = ws4Header.getCell(i + 1);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD6E4FD" } };
      cell.font = { name: "Meiryo UI", size: 9, bold: true, color: { argb: "FF1A73E8" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "medium", color: { argb: "FF1A73E8" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });
    ws4.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: companyYearlyHeaders.length } };
    allCompanyYearlyConfigs.forEach((config, index) => {
      const row = ws4.addRow([
        config.company?.name ?? "",
        config.fiscalYear,
        `${config.fiscalYear}/10/01 〜 ${config.fiscalYear + 1}/09/30`,
        config.kyujitsuText ?? "",
        config.kyuukashori ?? "",
        config.hakensakiManagerDept ?? "",
        config.hakensakiManagerName ?? "",
        config.hakensakiManagerRole ?? "",
        config.hakensakiManagerPhone ?? "",
        config.updatedAt ?? "",
      ]);
      row.height = 20;
      const bg = index % 2 === 0 ? "FFFFFFFF" : "FFF8F9FA";
      const thinBorder = { style: "thin" as const, color: { argb: "FFE0E0E0" } };
      companyYearlyHeaders.forEach((_header, i) => {
        const cell = row.getCell(i + 1);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.font = { name: "Meiryo UI", size: 9, color: { argb: "FF333333" } };
        cell.alignment = {
          horizontal: i === 1 ? "center" : "left",
          vertical: "middle",
          wrapText: true,
        };
        cell.border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
      });
    });

    // Save to disk
    if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const filename = `企業データ一覧_${ts}.xlsx`;
    const filepath = path.join(EXPORT_DIR, filename);
    await workbook.xlsx.writeFile(filepath);

    db.insert(auditLog).values({
      action: "export",
      entityType: "factory",
      entityId: null,
      detail: `Excel出力: ${allFactories.length}工場 / ${allCompanies.length}企業 / ${allFactoryYearlyConfigs.length}工場年度設定 / ${allCompanyYearlyConfigs.length}企業年度設定 → ${filename}`,
      userName: "system",
    }).run();

    return c.json({
      success: true,
      filename,
      // path relativo al export dir — evita filtrar la ruta absoluta del FS
      // del servidor en la respuesta (M-1, audit 2026-04-28).
      path: `./DataTotal/${filename}`,
      factoryCount: allFactories.length,
      companyCount: allCompanies.length,
      factoryYearlyConfigCount: allFactoryYearlyConfigs.length,
      companyYearlyConfigCount: allCompanyYearlyConfigs.length,
    });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Excel export failed" }, 500);
  }
});

export { factoriesRouter };