import { Hono } from "hono";
import { z } from "zod";
import { db, sqlite } from "../db/index.js";
import { employees, factories, auditLog } from "../db/schema.js";
import { eq, and, type SQL } from "drizzle-orm";
import { calcCompleteness, getMissingFields } from "../services/completeness.js";
import { normalizeImportRow } from "../services/import-utils.js";

export const dataCheckRouter = new Hono();

dataCheckRouter.get("/", async (c) => {
  try {
    const companyId = c.req.query("companyId");
    const conditions: (SQL | undefined)[] = [
      eq(employees.status, "active"),
      companyId ? eq(employees.companyId, Number(companyId)) : undefined,
    ];
    const validConditions = conditions.filter((c): c is SQL => c !== undefined);

    const allResults = await db.query.employees.findMany({
      where: and(...validConditions),
      orderBy: (t, { asc }) => [asc(t.fullName)],
      with: { company: true, factory: true },
    });

    // Filter out junk rows (employeeNumber "0", fullName "0", etc.)
    const results = allResults.filter((emp) =>
      emp.fullName && emp.fullName !== "0" &&
      emp.employeeNumber && emp.employeeNumber !== "0"
    );

    const stats = { green: 0, yellow: 0, red: 0, gray: 0, total: results.length };

    const enriched = results.map((emp) => {
      const completeness = calcCompleteness(
        emp as unknown as Record<string, unknown>,
        emp.factory as unknown as Record<string, unknown> | null,
      );
      const { missingEmployee, missingFactory } = getMissingFields(
        emp as unknown as Record<string, unknown>,
        emp.factory as unknown as Record<string, unknown> | null,
      );
      stats[completeness]++;
      return { ...emp, completeness, missingEmployee, missingFactory };
    });

    return c.json({ employees: enriched, stats });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load data check";
    return c.json({ error: message }, 500);
  }
});

// ─── Export ──────────────────────────────────────────────────────────

dataCheckRouter.post("/export", async (c) => {
  try {
    const results = await db.query.employees.findMany({
      where: eq(employees.status, "active"),
      orderBy: (t, { asc }) => [asc(t.fullName)],
      with: { company: true, factory: true },
    });

    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "JP個別契約書 v26.3.31";
    workbook.created = new Date();

    // ── Column definitions with group colors ──
    const cols: { header: string; key: string; group: string; width: number }[] = [
      // employee
      { header: "社員№", key: "employeeNumber", group: "employee", width: 12 },
      { header: "派遣先ID", key: "clientEmployeeId", group: "employee", width: 12 },
      { header: "氏名", key: "fullName", group: "employee", width: 18 },
      { header: "カナ", key: "katakanaName", group: "employee", width: 18 },
      { header: "国籍", key: "nationality", group: "employee", width: 10 },
      { header: "性別", key: "gender", group: "employee", width: 8 },
      { header: "生年月日", key: "birthDate", group: "employee", width: 14 },
      { header: "入社日", key: "hireDate", group: "employee", width: 14 },
      { header: "単価", key: "billingRate", group: "employee", width: 10 },
      { header: "時給", key: "hourlyRate", group: "employee", width: 10 },
      // factory
      { header: "派遣先", key: "companyName", group: "factory", width: 24 },
      { header: "工場", key: "factoryName", group: "factory", width: 18 },
      { header: "課", key: "department", group: "factory", width: 14 },
      { header: "ライン", key: "lineName", group: "factory", width: 14 },
      { header: "住所", key: "address", group: "factory", width: 34 },
      { header: "TEL", key: "phone", group: "factory", width: 16 },
      { header: "抵触日", key: "conflictDate", group: "factory", width: 14 },
      // supervisor
      { header: "指揮命令者部署", key: "supervisorDept", group: "supervisor", width: 16 },
      { header: "指揮命令者氏名", key: "supervisorName", group: "supervisor", width: 16 },
      { header: "指揮命令者TEL", key: "supervisorPhone", group: "supervisor", width: 16 },
      // hakensakiManager
      { header: "派遣先責任者部署", key: "hakensakiManagerDept", group: "hakensakiManager", width: 16 },
      { header: "派遣先責任者氏名", key: "hakensakiManagerName", group: "hakensakiManager", width: 16 },
      { header: "派遣先責任者TEL", key: "hakensakiManagerPhone", group: "hakensakiManager", width: 16 },
      // complaintClient
      { header: "苦情処理派遣先部署", key: "complaintClientDept", group: "complaintClient", width: 18 },
      { header: "苦情処理派遣先氏名", key: "complaintClientName", group: "complaintClient", width: 18 },
      { header: "苦情処理派遣先TEL", key: "complaintClientPhone", group: "complaintClient", width: 18 },
      // complaintUns
      { header: "苦情処理派遣元部署", key: "complaintUnsDept", group: "complaintUns", width: 18 },
      { header: "苦情処理派遣元氏名", key: "complaintUnsName", group: "complaintUns", width: 18 },
      { header: "苦情処理派遣元TEL", key: "complaintUnsPhone", group: "complaintUns", width: 18 },
      // managerUns
      { header: "派遣元責任者部署", key: "managerUnsDept", group: "managerUns", width: 16 },
      { header: "派遣元責任者氏名", key: "managerUnsName", group: "managerUns", width: 16 },
      { header: "派遣元責任者TEL", key: "managerUnsPhone", group: "managerUns", width: 16 },
      // work
      { header: "就業時間", key: "workHours", group: "work", width: 20 },
      { header: "休憩", key: "breakTimeDay", group: "work", width: 20 },
      { header: "業務内容", key: "jobDescription", group: "work", width: 30 },
      { header: "締日", key: "closingDayText", group: "work", width: 14 },
      { header: "支払日", key: "paymentDayText", group: "work", width: 14 },
    ];

    const groupColors: Record<string, { fill: string; text: string; label: string }> = {
      employee:         { fill: "E8F0FE", text: "1A73E8", label: "社員情報" },
      factory:          { fill: "E6F4EA", text: "137333", label: "派遣先情報" },
      supervisor:       { fill: "FEF7E0", text: "B06000", label: "指揮命令者" },
      hakensakiManager: { fill: "FCE8E6", text: "C5221F", label: "派遣先責任者" },
      complaintClient:  { fill: "F3E8FD", text: "7627BB", label: "苦情処理(派遣先)" },
      complaintUns:     { fill: "E0F2F1", text: "00796B", label: "苦情処理(派遣元)" },
      managerUns:       { fill: "E8EAF6", text: "283593", label: "派遣元責任者" },
      work:             { fill: "FFF3E0", text: "E65100", label: "勤務条件" },
    };

    const ws = workbook.addWorksheet("データ確認", {
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
    const headerRow = ws.addRow(cols.map((col) => col.header));
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
    let dataRowIdx = 0;
    for (const emp of results) {
      const f = emp.factory;
      const values = [
        emp.employeeNumber, emp.clientEmployeeId,
        emp.fullName, emp.katakanaName, emp.nationality, emp.gender,
        emp.birthDate, emp.actualHireDate || emp.hireDate,
        emp.billingRate, emp.hourlyRate,
        emp.company?.name, f?.factoryName, f?.department, f?.lineName,
        f?.address, f?.phone, f?.conflictDate,
        f?.supervisorDept, f?.supervisorName, f?.supervisorPhone,
        f?.hakensakiManagerDept, f?.hakensakiManagerName, f?.hakensakiManagerPhone,
        f?.complaintClientDept, f?.complaintClientName, f?.complaintClientPhone,
        f?.complaintUnsDept, f?.complaintUnsName, f?.complaintUnsPhone,
        f?.managerUnsDept, f?.managerUnsName, f?.managerUnsPhone,
        f?.workHours, f?.breakTimeDay, f?.jobDescription,
        f?.closingDayText, f?.paymentDayText,
      ];

      const row = ws.addRow(values);
      row.height = 20;
      const bg = dataRowIdx % 2 === 0 ? "FFFFFFFF" : "FFF8F9FA";
      const thinBorder = { style: "thin" as const, color: { argb: "FFE0E0E0" } };

      cols.forEach((col, i) => {
        const cell = row.getCell(i + 1);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.font = { name: "Meiryo UI", size: 10, color: { argb: "FF333333" } };
        cell.alignment = {
          horizontal: (col.key === "billingRate" || col.key === "hourlyRate") ? "right" : "left",
          vertical: "middle",
          wrapText: true,
        };
        cell.border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
      });
      dataRowIdx++;
    }

    const path = await import("node:path");
    const exportDir = path.resolve("DataTotal");
    const fs = await import("node:fs");
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const filename = `データ確認一覧_${ts}.xlsx`;
    const filepath = path.join(exportDir, filename);
    await workbook.xlsx.writeFile(filepath);

    db.insert(auditLog).values({
      action: "export",
      entityType: "data-check",
      detail: `Exported data check: ${results.length} employees to ${filename}`,
      userName: "system",
    }).run();

    // path relativo al export dir — evita filtrar la ruta absoluta del FS
    // del servidor en la respuesta (M-1, audit 2026-04-28).
    return c.json({ success: true, filename, path: `./DataTotal/${filename}`, count: results.length });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Export failed" }, 500);
  }
});

// ─── Import ──────────────────────────────────────────────────────────

const dataCheckImportSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(5000),
});

dataCheckRouter.post("/import", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = dataCheckImportSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);

    const { rows } = parsed.data;
    let empUpdated = 0;
    let facUpdated = 0;
    const errors: string[] = [];

    const factoryUpdates = new Map<number, Record<string, unknown>>();

    sqlite.transaction(() => {
      for (const rawRow of rows) {
        const row = normalizeImportRow(rawRow);
        try {
          const empNumber = String(row["社員№"] || "").trim();
          if (!empNumber) continue;

          const emp = db.select({ id: employees.id, factoryId: employees.factoryId })
            .from(employees)
            .where(eq(employees.employeeNumber, empNumber))
            .get();
          if (!emp) { errors.push(`社員 ${empNumber}: 見つかりません`); continue; }

          const empData: Record<string, unknown> = {};
          if (row["派遣先ID"]) empData.clientEmployeeId = String(row["派遣先ID"]);
          if (row["カナ"]) empData.katakanaName = String(row["カナ"]);
          if (row["国籍"]) empData.nationality = String(row["国籍"]);
          if (row["性別"]) empData.gender = String(row["性別"]) === "男" ? "male" : String(row["性別"]) === "女" ? "female" : String(row["性別"]);
          if (row["生年月日"]) empData.birthDate = String(row["生年月日"]);
          if (row["単価"]) {
            const v = Number(row["単価"]);
            if (!Number.isNaN(v)) empData.billingRate = v;
          }
          if (row["時給"]) {
            const v = Number(row["時給"]);
            if (!Number.isNaN(v)) empData.hourlyRate = v;
          }

          if (Object.keys(empData).length > 0) {
            empData.updatedAt = new Date().toISOString();
            db.update(employees).set(empData).where(eq(employees.id, emp.id)).run();
            empUpdated++;
          }

          if (emp.factoryId) {
            const facData = factoryUpdates.get(emp.factoryId) ?? {};
            if (row["指揮命令者部署"]) facData.supervisorDept = String(row["指揮命令者部署"]);
            if (row["指揮命令者氏名"]) facData.supervisorName = String(row["指揮命令者氏名"]);
            if (row["指揮命令者TEL"]) facData.supervisorPhone = String(row["指揮命令者TEL"]);
            if (row["派遣先責任者部署"]) facData.hakensakiManagerDept = String(row["派遣先責任者部署"]);
            if (row["派遣先責任者氏名"]) facData.hakensakiManagerName = String(row["派遣先責任者氏名"]);
            if (row["派遣先責任者TEL"]) facData.hakensakiManagerPhone = String(row["派遣先責任者TEL"]);
            if (row["苦情処理派遣先部署"]) facData.complaintClientDept = String(row["苦情処理派遣先部署"]);
            if (row["苦情処理派遣先氏名"]) facData.complaintClientName = String(row["苦情処理派遣先氏名"]);
            if (row["苦情処理派遣先TEL"]) facData.complaintClientPhone = String(row["苦情処理派遣先TEL"]);
            if (row["苦情処理派遣元部署"]) facData.complaintUnsDept = String(row["苦情処理派遣元部署"]);
            if (row["苦情処理派遣元氏名"]) facData.complaintUnsName = String(row["苦情処理派遣元氏名"]);
            if (row["苦情処理派遣元TEL"]) facData.complaintUnsPhone = String(row["苦情処理派遣元TEL"]);
            if (row["派遣元責任者部署"]) facData.managerUnsDept = String(row["派遣元責任者部署"]);
            if (row["派遣元責任者氏名"]) facData.managerUnsName = String(row["派遣元責任者氏名"]);
            if (row["派遣元責任者TEL"]) facData.managerUnsPhone = String(row["派遣元責任者TEL"]);
            if (row["抵触日"]) facData.conflictDate = String(row["抵触日"]);
            if (row["業務内容"]) facData.jobDescription = String(row["業務内容"]);
            if (row["締日"]) facData.closingDayText = String(row["締日"]);
            if (row["支払日"]) facData.paymentDayText = String(row["支払日"]);
            if (Object.keys(facData).length > 0) {
              factoryUpdates.set(emp.factoryId, facData);
            }
          }
        } catch (err: unknown) {
          errors.push(`Row ${row["社員№"] || "?"}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      for (const [facId, data] of factoryUpdates) {
        data.updatedAt = new Date().toISOString();
        db.update(factories).set(data).where(eq(factories.id, facId)).run();
        facUpdated++;
      }

      db.insert(auditLog).values({
        action: "import",
        entityType: "data-check",
        detail: `Data check import: ${empUpdated} employees, ${facUpdated} factories updated, ${errors.length} errors`,
        userName: "import",
      }).run();
    })();

    return c.json({
      success: true,
      updated: { employees: empUpdated, factories: facUpdated },
      errors: errors.slice(0, 20),
    });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Import failed" }, 500);
  }
});
