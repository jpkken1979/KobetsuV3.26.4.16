import { Hono } from "hono";
import { db, sqlite } from "../db/index.js";
import { employees, auditLog, clientCompanies } from "../db/schema.js";
import { eq, like, or, and, count, type SQL } from "drizzle-orm";
import { z } from "zod";
import { createEmployeeSchema, updateEmployeeSchema } from "../validation.js";
import { createAutoBackup } from "../services/backup.js";
import { escapeLike, parseIdParam } from "../services/db-utils.js";
import { normalizeImportRow } from "../services/import-utils.js";
import { detectTakaoReEntries, type TakaoEntry } from "../services/takao-detection.js";

export const employeesRouter = new Hono();

const VALID_EMPLOYEE_STATUSES = ["active", "inactive", "onLeave"] as const;

// GET /api/employees — list with optional filters
employeesRouter.get("/", async (c) => {
  try {
    const companyId = c.req.query("companyId");
    const factoryId = c.req.query("factoryId");
    const status = c.req.query("status");
    const search = c.req.query("search");

    if (status && !VALID_EMPLOYEE_STATUSES.includes(status as typeof VALID_EMPLOYEE_STATUSES[number])) {
      return c.json({ error: `Invalid status. Allowed: ${VALID_EMPLOYEE_STATUSES.join(", ")}` }, 400);
    }

    const conditions: (SQL | undefined)[] = [
      companyId ? eq(employees.companyId, Number(companyId)) : undefined,
      factoryId ? eq(employees.factoryId, Number(factoryId)) : undefined,
      status ? eq(employees.status, status as "active" | "inactive" | "onLeave") : undefined,
      search
        ? or(
            like(employees.fullName, `%${escapeLike(search)}%`),
            like(employees.katakanaName, `%${escapeLike(search)}%`),
            like(employees.employeeNumber, `%${escapeLike(search)}%`)
          )
        : undefined,
    ];

    const validConditions = conditions.filter((c): c is SQL => c !== undefined);

    // Pagination with defaults
    const rawLimit = Number(c.req.query("limit")) || 0;
    const rawOffset = Number(c.req.query("offset")) || 0;
    const limit = rawLimit > 0 ? Math.min(rawLimit, 2000) : 500;
    const offset = rawOffset > 0 ? rawOffset : undefined;

    const results = await db.query.employees.findMany({
      where: validConditions.length > 0 ? and(...validConditions) : undefined,
      orderBy: (t, { asc }) => [asc(t.fullName)],
      with: { company: true, factory: true },
      limit,
      ...(offset ? { offset } : {}),
    });

    return c.json(results);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Operation failed";
    return c.json({ error: message }, 500);
  }
});

// POST /api/employees/purge — hard delete all employees (destructive)
const purgeSchema = z.object({ confirm: z.literal("DELETE") });

employeesRouter.post("/purge", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = purgeSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: "Body must contain { confirm: \"DELETE\" }" }, 400);

    const total = db.select({ c: count() }).from(employees).get()?.c ?? 0;
    if (total === 0) {
      return c.json({ success: true, deleted: 0, backup: null });
    }

    const backup = await createAutoBackup();
    db.delete(employees).run();

    db.insert(auditLog).values({
      action: "delete",
      entityType: "employee",
      entityId: null,
      detail: `Purged all employees: ${total} records`,
      userName: "system",
    }).run();

    return c.json({ success: true, deleted: total, backup });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to purge employees";
    return c.json({ error: message }, 500);
  }
});

// GET /api/employees/completeness — R24 completeness matrix
employeesRouter.get("/completeness", async (c) => {
  try {
    const emps = await db.query.employees.findMany({
      with: { factory: { with: { company: true } } },
    });

    const REQUIRED_EMPLOYEE = ["fullName", "employeeNumber", "hireDate", "hourlyRate", "billingRate"];
    const REQUIRED_FACTORY = ["supervisorName", "supervisorPhone", "workHours", "conflictDate"];

    const rows = emps.map((emp) => {
      const missingEmployee: string[] = [];
      for (const f of REQUIRED_EMPLOYEE) {
        if (!emp[f as keyof typeof emp]) missingEmployee.push(f);
      }
      const missingFactory: string[] = [];
      if (emp.factory) {
        for (const f of REQUIRED_FACTORY) {
          if (!emp.factory[f as keyof typeof emp.factory]) missingFactory.push(f);
        }
      }

      const totalMissing = missingEmployee.length + missingFactory.length;
      const level = totalMissing === 0 ? "green" : totalMissing <= 2 ? "yellow" : "red";

      return {
        employeeId: emp.id,
        employeeNumber: emp.employeeNumber,
        fullName: emp.fullName,
        factoryName: emp.factory?.factoryName ?? null,
        companyName: emp.factory?.company?.name ?? null,
        level,
        missingEmployee,
        missingFactory,
      };
    });

    return c.json(rows);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Operation failed" }, 500);
  }
});

// GET /api/employees/import/template — downloadable Excel template (R20)
employeesRouter.get("/import/template", async (c) => {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("従業員マスタ");

  const headers = [
    "社員番号", "派遣先ID", "氏名", "カナ", "性別", "国籍",
    "生年月日", "ステータス", "入社日", "時給", "請求単価",
    "ビザ期限", "ビザ種別", "郵便番号", "住所",
  ];
  ws.addRow(headers);

  // Example row
  ws.addRow([
    "EMP001", "", "Nguyen Van A", "グエン バン エイ", "male", "Vietnam",
    "1995-01-15", "active", "2024-04-01", "1100", "1400",
    "2027-04-01", "特定活動", "700-0001", "岡山県岡山市1-2-3",
  ]);

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } };

  for (let i = 1; i <= headers.length; i++) {
    ws.getColumn(i).width = Math.max(headers[i - 1].length * 2, 12);
  }

  const buffer = await wb.xlsx.writeBuffer();
  c.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  c.header("Content-Disposition", "attachment; filename=employee-template.xlsx");
  return c.body(buffer as ArrayBuffer);
});

// POST /api/employees/import — import with Takao detection (R11)
employeesRouter.post("/import", async (c) => {
  try {
    const body = await c.req.json<{ rows: Record<string, unknown>[] }>();
    const { rows } = body;

    const employeesToInsert: unknown[] = [];
    const takaoEntries: TakaoEntry[] = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const row = normalizeImportRow(raw);

      const employeeNumber = String(row["社員番号"] ?? "").trim();
      const fullName = String(row["氏名"] ?? "").trim();
      if (!employeeNumber || !fullName) continue;

      const empData = {
        employeeNumber,
        fullName,
        clientEmployeeId: row["派遣先ID"] ? String(row["派遣先ID"]).trim() : null,
        companyId: row["派遣先ID"] && Number(row["派遣先ID"]) !== 0 ? Number(row["派遣先ID"]) : null,
        factoryId: null,
        katakanaName: row["カナ"] ? String(row["カナ"]).trim() : null,
        gender: row["性別"] ? String(row["性別"]).trim() : null,
        nationality: row["国籍"] ? String(row["国籍"]).trim() : null,
        birthDate: row["生年月日"] ? String(row["生年月日"]).trim() : null,
        status: row["ステータス"] ? String(row["ステータス"]).trim() : "active",
        hireDate: row["入社日"] ? String(row["入社日"]).trim() : null,
        hourlyRate: row["時給"] ? Number(row["時給"]) : null,
        billingRate: row["請求単価"] ? Number(row["請求単価"]) : null,
        visaExpiry: row["ビザ期限"] ? String(row["ビザ期限"]).trim() : null,
        visaType: row["ビザ種別"] ? String(row["ビザ種別"]).trim() : null,
        postalCode: row["郵便番号"] ? String(row["郵便番号"]).trim() : null,
        address: row["住所"] ? String(row["住所"]).trim() : null,
      };

      employeesToInsert.push(empData);

      // Collect for Takao detection
      if (empData.companyId) {
        const company = await db.query.clientCompanies.findFirst({
          where: eq(clientCompanies.id, empData.companyId as number),
        });
        if (company) {
          takaoEntries.push({
            employeeNumber,
            companyName: company.name,
            fullName,
            hireDate: empData.hireDate ?? "",
            exitDate: row["離職日"] ? String(row["離職日"]).trim() : null,
            factoryName: null,
          });
        }
      }
    }

    // Takao detection
    const reEntries = detectTakaoReEntries(takaoEntries);

    // Upsert employees
    sqlite.transaction(() => {
      for (const emp of employeesToInsert) {
        db.insert(employees).values(emp as typeof employees.$inferInsert).run();
      }
    })();

    await db.insert(auditLog).values({
      action: "import",
      entityType: "employee",
      detail: `従業員インポート: ${employeesToInsert.length}件, 再就職(${reEntries.length}件)`,
    }).run();

    return c.json({ created: employeesToInsert.length, reEntries }, 201);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Operation failed" }, 500);
  }
});

// GET /api/employees/:id
employeesRouter.get("/:id", async (c) => {
  try {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, id),
      with: { company: true, factory: true, contractAssignments: true },
    });
    if (!employee) return c.json({ error: "Employee not found" }, 404);
    return c.json(employee);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Operation failed";
    return c.json({ error: message }, 500);
  }
});

// POST /api/employees
employeesRouter.post("/", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = createEmployeeSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    const body = parsed.data;
    const result = db.insert(employees).values(body).returning().get();

    db.insert(auditLog).values({
      action: "create",
      entityType: "employee",
      entityId: result.id,
      detail: `Created employee: ${result.fullName} (${result.employeeNumber})`,
      userName: "system",
    }).run();

    return c.json(result, 201);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to create employee" }, 500);
  }
});

// PUT /api/employees/:id
employeesRouter.put("/:id", async (c) => {
  try {
    const id = parseIdParam(c.req.param("id"));
    if (!id) return c.json({ error: "Invalid ID" }, 400);
    const raw = await c.req.json();
    const parsed = updateEmployeeSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    const body = parsed.data;
    const result = db
      .update(employees)
      .set({ ...body, updatedAt: new Date().toISOString() })
      .where(eq(employees.id, id))
      .returning()
      .get();
    if (!result) return c.json({ error: "Employee not found" }, 404);

    db.insert(auditLog).values({
      action: "update",
      entityType: "employee",
      entityId: id,
      detail: `Updated employee: ${result.fullName} (${result.employeeNumber})`,
      userName: "system",
    }).run();

    return c.json(result);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Failed to update employee" }, 500);
  }
});
