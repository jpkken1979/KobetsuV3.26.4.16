// Koritsu Excel import endpoints — parse and apply supervisor/commander data
import { Hono } from "hono";
import { z } from "zod";
import { db, sqlite } from "../db/index.js";
import { factories, employees, clientCompanies, auditLog } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { normalizeWidth } from "../services/import-utils.js";
import { parseKoritsuExcelWorkbook, type KoritsuExcelFactory } from "../services/koritsu-excel-parser.js";

export const importKoritsuRouter = new Hono();

// ─── Fields that we compare and may update ─────────────────────────────────

const COMPARE_FIELDS: Array<{
  parsed: keyof KoritsuExcelFactory;
  db: string;
  label: string;
}> = [
  { parsed: "hakensakiManagerName", db: "hakensakiManagerName", label: "派遣先責任者 氏名" },
  { parsed: "hakensakiManagerDept", db: "hakensakiManagerDept", label: "派遣先責任者 部署" },
  { parsed: "hakensakiManagerRole", db: "hakensakiManagerRole", label: "派遣先責任者 役職" },
  { parsed: "supervisorName", db: "supervisorName", label: "指揮命令者 氏名" },
  { parsed: "supervisorDept", db: "supervisorDept", label: "指揮命令者 部署" },
  { parsed: "supervisorRole", db: "supervisorRole", label: "指揮命令者 役職" },
  { parsed: "phone", db: "supervisorPhone", label: "指揮命令者 TEL" },
  { parsed: "conflictDate", db: "conflictDate", label: "抵触日" },
  { parsed: "jobDescription", db: "jobDescription", label: "業務内容" },
  { parsed: "address", db: "address", label: "就業場所住所" },
];

// ─── POST /import/koritsu/parse ─────────────────────────────────────────────

importKoritsuRouter.post("/koritsu/parse", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body["file"];

    if (!file || !(file instanceof File)) {
      return c.json({ error: "Excelファイルが必要です (field name: 'file')" }, 400);
    }

    // Validate file extension (.xlsx or .xlsm)
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".xlsx") && !ext.endsWith(".xlsm")) {
      return c.json({ error: "Excelファイル (.xlsx / .xlsm) を選択してください" }, 400);
    }

    // File size limit (20MB)
    if (file.size > 20 * 1024 * 1024) {
      return c.json({ error: "ファイルが大きすぎます (最大20MB)" }, 413);
    }

    // Read Excel with ExcelJS
    const ExcelJS = (await import("exceljs")).default;
    const arrayBuffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(arrayBuffer);

    // Verify the main sheet exists
    const mainSheet = wb.worksheets.find((s) => s.name.includes("派遣先責任者"));
    if (!mainSheet) {
      return c.json({
        error: `シート「派遣先責任者」が見つかりません。シート一覧: ${wb.worksheets.map((s) => s.name).join(", ")}`,
      }, 400);
    }

    // Parse the optional date parameter
    const targetDate = c.req.query("date") ?? undefined;

    // Parse the full workbook (reads 派遣先責任者, 派遣元, 労働者派遣個別契約書)
    const parsed = parseKoritsuExcelWorkbook(wb, targetDate);

    if (parsed.factories.length === 0) {
      return c.json({ error: "工場・責任者データが見つかりません" }, 400);
    }

    // Find コーリツ company in DB
    const koritsuCompany = await db.query.clientCompanies.findFirst({
      where: (co, { like }) => like(co.name, "%コーリツ%"),
    });

    if (!koritsuCompany) {
      return c.json({ error: "コーリツ株式会社 not found in database" }, 404);
    }

    const companyId = koritsuCompany.id;

    // Load existing factories for this company
    const existingFactories = await db.query.factories.findMany({
      where: eq(factories.companyId, companyId),
    });

    // Load active employees for this company
    const companyEmployees = await db
      .select({
        id: employees.id,
        employeeNumber: employees.employeeNumber,
        fullName: employees.fullName,
        factoryId: employees.factoryId,
        status: employees.status,
      })
      .from(employees)
      .where(eq(employees.companyId, companyId));

    // Group employees by factoryId
    const employeesByFactory = new Map<number, typeof companyEmployees>();
    const unassignedEmployees: typeof companyEmployees = [];
    for (const emp of companyEmployees) {
      if (emp.factoryId != null) {
        const list = employeesByFactory.get(emp.factoryId) ?? [];
        list.push(emp);
        employeesByFactory.set(emp.factoryId, list);
      } else {
        unassignedEmployees.push(emp);
      }
    }

    // Build factory matching key
    const factoryKey = (fn: string, dept: string, ln: string) =>
      `${normalizeWidth(fn)}|${normalizeWidth(dept)}|${normalizeWidth(ln)}`;

    const existingByKey = new Map<string, (typeof existingFactories)[0]>();
    for (const f of existingFactories) {
      existingByKey.set(
        factoryKey(f.factoryName, f.department ?? "", f.lineName ?? ""),
        f,
      );
    }

    // Build diff
    const diff: Array<{
      factoryName: string;
      department: string;
      lineName: string | null;
      hakensakiManagerName: string | null;
      hakensakiManagerDept: string | null;
      hakensakiManagerRole: string | null;
      supervisorName: string | null;
      supervisorDept: string | null;
      supervisorRole: string | null;
      phone: string | null;
      address: string | null;
      conflictDate: string | null;
      jobDescription: string | null;
      existingId: number | null;
      status: "insert" | "update" | "unchanged";
      changes: Record<string, { old: string | null; new: string | null }>;
      employees: Array<{ id: number; employeeNumber: string; fullName: string; status: string }>;
    }> = [];

    let inserts = 0;
    let updates = 0;
    let unchanged = 0;

    for (const pf of parsed.factories) {
      const key = factoryKey(pf.factoryName, pf.department, pf.lineName ?? "");
      const existing = existingByKey.get(key);

      // Build changes object
      const changes: Record<string, { old: string | null; new: string | null }> = {};

      if (existing) {
        for (const field of COMPARE_FIELDS) {
          const oldVal = (existing as Record<string, unknown>)[field.db] as string | null ?? null;
          const newVal = pf[field.parsed] ?? null;

          const oldNorm = oldVal == null || oldVal === "" ? null : oldVal;
          const newNorm = newVal == null || newVal === "" ? null : newVal;

          if (oldNorm !== newNorm) {
            changes[field.label] = { old: oldNorm, new: newNorm };
          }
        }

        // Check phone → hakensakiManagerPhone mapping too
        const existingHakensakiPhone = existing.hakensakiManagerPhone ?? null;
        const parsedPhone = pf.phone ?? null;
        if ((existingHakensakiPhone ?? "") !== (parsedPhone ?? "")) {
          changes["派遣先責任者 TEL (共通)"] = { old: existingHakensakiPhone, new: parsedPhone };
        }

        // Check factory own phone
        const existingFactoryPhone = existing.phone ?? null;
        if (parsedPhone && (existingFactoryPhone ?? "") !== (parsedPhone ?? "")) {
          changes["工場電話番号"] = { old: existingFactoryPhone, new: parsedPhone };
        }

        // Check complaint client (派遣先)
        const globalChecks: Array<{ label: string; db: string; val: string | null }> = [
          { label: "苦情処理(派遣先) 氏名", db: "complaintClientName", val: parsed.complaint.name },
          { label: "苦情処理(派遣先) 部署", db: "complaintClientDept", val: parsed.complaint.dept },
          { label: "苦情処理(派遣先) TEL", db: "complaintClientPhone", val: parsed.complaint.phone },
          // UNS manager
          { label: "派遣元責任者 氏名", db: "managerUnsName", val: parsed.uns.managerName },
          { label: "派遣元責任者 部署", db: "managerUnsDept", val: parsed.uns.managerDept },
          { label: "派遣元責任者 TEL", db: "managerUnsPhone", val: parsed.uns.managerPhone },
          { label: "派遣元責任者 住所", db: "managerUnsAddress", val: parsed.uns.managerAddress },
          // UNS complaint
          { label: "苦情処理(UNS) 氏名", db: "complaintUnsName", val: parsed.uns.complaintName },
          { label: "苦情処理(UNS) 部署", db: "complaintUnsDept", val: parsed.uns.complaintDept },
          { label: "苦情処理(UNS) TEL", db: "complaintUnsPhone", val: parsed.uns.complaintPhone ?? null },
          // Work conditions
          { label: "就業日", db: "workDays", val: parsed.workConditions.workDays },
          { label: "就業時間", db: "workHours", val: parsed.workConditions.workHours },
          { label: "休憩時間", db: "breakTimeDay", val: parsed.workConditions.breakTime },
          { label: "時間外労働", db: "overtimeHours", val: parsed.workConditions.overtimeHours },
        ];
        for (const check of globalChecks) {
          if (check.val) {
            const oldVal = (existing as Record<string, unknown>)[check.db] as string | null ?? null;
            if ((oldVal ?? "") !== (check.val ?? "")) {
              changes[check.label] = { old: oldVal, new: check.val };
            }
          }
        }
      }

      const status = existing
        ? Object.keys(changes).length > 0
          ? "update"
          : "unchanged"
        : "insert";

      if (status === "insert") inserts++;
      else if (status === "update") updates++;
      else unchanged++;

      const factoryEmployees = existing
        ? (employeesByFactory.get(existing.id) ?? []).map((e) => ({
            id: e.id,
            employeeNumber: e.employeeNumber,
            fullName: e.fullName,
            status: e.status,
          }))
        : [];

      diff.push({
        factoryName: pf.factoryName,
        department: pf.department,
        lineName: pf.lineName,
        hakensakiManagerName: pf.hakensakiManagerName,
        hakensakiManagerDept: pf.hakensakiManagerDept,
        hakensakiManagerRole: pf.hakensakiManagerRole,
        supervisorName: pf.supervisorName,
        supervisorDept: pf.supervisorDept,
        supervisorRole: pf.supervisorRole,
        phone: pf.phone,
        address: pf.address,
        conflictDate: pf.conflictDate,
        jobDescription: pf.jobDescription,
        existingId: existing?.id ?? null,
        status,
        changes,
        employees: factoryEmployees,
      });
    }

    const totalEmployees = companyEmployees.length;
    const unassigned = unassignedEmployees.map((e) => ({
      id: e.id,
      employeeNumber: e.employeeNumber,
      fullName: e.fullName,
      status: e.status,
    }));

    return c.json({
      parsed,
      companyId,
      diff,
      unassigned,
      summary: {
        inserts,
        updates,
        unchanged,
        totalEmployees,
        unassignedEmployees: unassigned.length,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Excelの解析に失敗しました: ${message}` }, 500);
  }
});

// ─── POST /import/koritsu/apply ─────────────────────────────────────────────

const applySchema = z.object({
  companyId: z.number().int().positive(),
  factories: z.array(
    z.object({
      existingId: z.number().int().positive().nullable(),
      factoryName: z.string().min(1),
      department: z.string().min(1),
      lineName: z.string().nullable(),
      hakensakiManagerName: z.string().nullable(),
      hakensakiManagerDept: z.string().nullable(),
      hakensakiManagerRole: z.string().nullable().optional(),
      supervisorName: z.string().nullable(),
      supervisorDept: z.string().nullable(),
      supervisorRole: z.string().nullable().optional(),
      phone: z.string().nullable(),
      address: z.string().nullable().optional(),
      conflictDate: z.string().nullable().optional(),
      jobDescription: z.string().nullable().optional(),
    }),
  ),
  addresses: z.record(z.string(), z.string()).default({}),
  complaint: z
    .object({
      name: z.string().nullable(),
      dept: z.string().nullable(),
      phone: z.string().nullable(),
    })
    .default({ name: null, dept: null, phone: null }),
  uns: z.object({
    managerName: z.string().nullable(),
    managerDept: z.string().nullable(),
    managerPhone: z.string().nullable(),
    managerAddress: z.string().nullable(),
    complaintName: z.string().nullable(),
    complaintDept: z.string().nullable(),
    complaintPhone: z.string().nullable().optional(),
  }).default({ managerName: null, managerDept: null, managerPhone: null, managerAddress: null, complaintName: null, complaintDept: null, complaintPhone: null }),
  workConditions: z.object({
    workDays: z.string().nullable(),
    workHours: z.string().nullable(),
    breakTime: z.string().nullable(),
    overtimeHours: z.string().nullable(),
  }).default({ workDays: null, workHours: null, breakTime: null, overtimeHours: null }),
});

importKoritsuRouter.post("/koritsu/apply", async (c) => {
  try {
    const raw = await c.req.json().catch(() => null);
    if (!raw) return c.json({ error: "Invalid JSON body" }, 400);

    const parsed = applySchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0].message }, 400);
    }

    const { companyId, factories: factoryList, addresses, complaint, uns, workConditions } = parsed.data;

    const company = await db.query.clientCompanies.findFirst({
      where: eq(clientCompanies.id, companyId),
    });
    if (!company) {
      return c.json({ error: `Company ID ${companyId} not found` }, 404);
    }

    const { inserted, updated } = sqlite.transaction(() => {
      let txInserted = 0;
      let txUpdated = 0;

      for (const f of factoryList) {
        const updateData: Record<string, unknown> = {};

        // Per-line fields (派遣先責任者 / 指揮命令者)
        if (f.hakensakiManagerName != null) updateData.hakensakiManagerName = f.hakensakiManagerName;
        if (f.hakensakiManagerDept != null) updateData.hakensakiManagerDept = f.hakensakiManagerDept;
        if (f.hakensakiManagerRole != null) updateData.hakensakiManagerRole = f.hakensakiManagerRole;
        if (f.supervisorName != null) updateData.supervisorName = f.supervisorName;
        if (f.supervisorDept != null) updateData.supervisorDept = f.supervisorDept;
        if (f.supervisorRole != null) updateData.supervisorRole = f.supervisorRole;
        if (f.phone != null) {
          updateData.supervisorPhone = f.phone;
          updateData.hakensakiManagerPhone = f.phone;
          updateData.phone = f.phone;
        }
        if (f.conflictDate) updateData.conflictDate = f.conflictDate;
        if (f.jobDescription) updateData.jobDescription = f.jobDescription;
        if (f.address) updateData.address = f.address;

        // Global: complaint handler (派遣先)
        if (complaint.name != null) updateData.complaintClientName = complaint.name;
        if (complaint.dept != null) updateData.complaintClientDept = complaint.dept;
        if (complaint.phone != null) updateData.complaintClientPhone = complaint.phone;

        // Global: UNS manager (派遣元責任者)
        if (uns.managerName != null) updateData.managerUnsName = uns.managerName;
        if (uns.managerDept != null) updateData.managerUnsDept = uns.managerDept;
        if (uns.managerPhone != null) updateData.managerUnsPhone = uns.managerPhone;
        if (uns.managerAddress != null) updateData.managerUnsAddress = uns.managerAddress;

        // Global: UNS complaint handler
        if (uns.complaintName != null) updateData.complaintUnsName = uns.complaintName;
        if (uns.complaintDept != null) updateData.complaintUnsDept = uns.complaintDept;
        if (uns.complaintPhone != null) updateData.complaintUnsPhone = uns.complaintPhone;

        // Global: work conditions
        if (workConditions.workDays != null) updateData.workDays = workConditions.workDays;
        if (workConditions.workHours != null) updateData.workHours = workConditions.workHours;
        if (workConditions.breakTime != null) updateData.breakTimeDay = workConditions.breakTime;
        if (workConditions.overtimeHours != null) updateData.overtimeHours = workConditions.overtimeHours;

        // Address fallback from global map
        const addrFallback = addresses[f.factoryName];
        if (!updateData.address && addrFallback) updateData.address = addrFallback;

        updateData.updatedAt = new Date().toISOString();

        if (f.existingId != null) {
          db.update(factories)
            .set(updateData)
            .where(and(eq(factories.id, f.existingId), eq(factories.companyId, companyId)))
            .run();
          txUpdated++;
        } else {
          db.insert(factories)
            .values({
              companyId,
              factoryName: f.factoryName,
              department: f.department,
              lineName: f.lineName,
              ...updateData,
            })
            .run();
          txInserted++;
        }
      }

      db.insert(auditLog)
        .values({
          action: "import",
          entityType: "factory",
          detail: `Koritsu Excel import: ${txInserted} inserted, ${txUpdated} updated (company: ${company.name})`,
          userName: "import",
        })
        .run();

      return { inserted: txInserted, updated: txUpdated };
    })();

    return c.json({
      success: true,
      inserted,
      updated,
      total: inserted + updated,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Failed to apply changes: ${message}` }, 500);
  }
});
