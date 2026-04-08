// Handlers for individual employee document generation
// POST /api/documents/keiyakusho/:employeeNumber — 契約書 (labor contract)
// POST /api/documents/shugyojoken/:employeeNumber — 就業条件明示書
import type { Context } from "hono";
import { z } from "zod";
import path from "node:path";

const individualDocBodySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD").optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD").optional(),
});
import { db } from "../db/index.js";
import { employees, auditLog } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { generateKeiyakushoPDF, type KeiyakushoData } from "../pdf/keiyakusho-pdf.js";
import { generateShugyoJokenMeijishoPDF, type ShugyoJokenData } from "../pdf/shugyojoken-pdf.js";
import { toLocalDateStr } from "../services/contract-dates.js";
import { sanitizeFilename } from "../services/document-files.js";
import {
  createDoc,
  createDocLandscape,
  writeToFile,
  ROUDOU_OUTPUT_DIR,
} from "../services/document-generation.js";

export async function handleKeiyakusho(c: Context) {
  const employeeNumber = (c.req.param("employeeNumber") ?? "").trim();

  // Find employee by 社員番号
  const employee = await db.query.employees.findFirst({
    where: eq(employees.employeeNumber, employeeNumber),
    with: { company: true, factory: true },
  });

  if (!employee) {
    return c.json({ error: `社員番号「${employeeNumber}」が見つかりません` }, 404);
  }

  if (!employee.factory) {
    return c.json({ error: `社員番号「${employeeNumber}」に配属先（工場）が設定されていません` }, 400);
  }

  // Optionally accept startDate/endDate from body, otherwise auto-generate
  const bodyParsed = individualDocBodySchema.safeParse(await c.req.json().catch(() => ({})));
  const bodyData = bodyParsed.success ? bodyParsed.data : {};
  const startDate: string = bodyData.startDate || toLocalDateStr(new Date());
  let endDate: string = bodyData.endDate || "";

  // Auto-set endDate to 3 months from startDate if not provided
  if (!endDate) {
    const [sy, sm, sd] = startDate.split("-").map(Number);
    const start = new Date(sy, sm - 1, sd);
    start.setMonth(start.getMonth() + 3);
    start.setDate(start.getDate() - 1);
    endDate = toLocalDateStr(start);
  }

  const factory = employee.factory;
  const company = employee.company;

  const keiyakushoData: KeiyakushoData = {
    companyName: company?.name || "",
    companyAddress: company?.address || "",
    companyPhone: company?.phone || "",
    factoryName: factory.factoryName,
    factoryAddress: factory.address || company?.address || "",
    factoryPhone: factory.phone || company?.phone || "",
    department: factory.department || "",
    lineName: factory.lineName || "",
    conflictDate: factory.conflictDate || "",
    contractDate: toLocalDateStr(new Date()),
    startDate,
    endDate,
    jobDescription: factory.jobDescription || "",
    workHours: factory.workHours || "",
    workHoursDay: factory.workHoursDay || "",
    workHoursNight: factory.workHoursNight || "",
    breakTime: factory.breakTime ? `${factory.breakTime}分` : "",
    breakTimeDay: factory.breakTimeDay || "",
    breakTimeNight: factory.breakTimeNight || "",
    overtimeHours: factory.overtimeHours || "",
    calendar: factory.calendar || "",
    closingDay: factory.closingDayText || (factory.closingDay ? `${factory.closingDay}日` : ""),
    paymentDay: factory.paymentDayText || (factory.paymentDay ? `${factory.paymentDay}日` : ""),
    hourlyRate: employee.billingRate ?? employee.hourlyRate ?? factory.hourlyRate ?? 0,
    shiftPattern: factory.shiftPattern || "通常",
    supervisorDept: factory.supervisorDept || "",
    supervisorName: factory.supervisorName || "",
    supervisorPhone: factory.supervisorPhone || "",
    hakensakiManagerDept: factory.hakensakiManagerDept || factory.supervisorDept || "",
    hakensakiManagerName: factory.hakensakiManagerName || factory.supervisorName || "",
    hakensakiManagerPhone: factory.hakensakiManagerPhone || factory.supervisorPhone || "",
    managerUnsDept: factory.managerUnsDept || "",
    managerUnsName: factory.managerUnsName || "",
    managerUnsPhone: factory.managerUnsPhone || "",
    complaintUnsDept: factory.complaintUnsDept || "",
    complaintUnsName: factory.complaintUnsName || "",
    complaintUnsPhone: factory.complaintUnsPhone || "",
    complaintClientDept: factory.complaintClientDept || "",
    complaintClientName: factory.complaintClientName || "",
    complaintClientPhone: factory.complaintClientPhone || "",
    employee: {
      employeeNumber: employee.employeeNumber,
      fullName: employee.fullName,
      katakanaName: employee.katakanaName || "",
      gender: employee.gender,
      birthDate: employee.birthDate,
      nationality: employee.nationality,
      address: employee.address,
      postalCode: employee.postalCode,
      actualHireDate: employee.actualHireDate,
      hireDate: employee.hireDate,
      hourlyRate: employee.hourlyRate,
      billingRate: employee.billingRate,
      visaExpiry: employee.visaExpiry,
      visaType: employee.visaType,
    },
  };

  try {
    const doc = createDocLandscape();
    generateKeiyakushoPDF(doc, keiyakushoData);

    const timestamp = toLocalDateStr(new Date());
    const empLabel = sanitizeFilename(employee.katakanaName || employee.fullName);
    const filename = `契約書_${empLabel}_${employee.employeeNumber}_${timestamp}.pdf`;
    await writeToFile(doc, path.join(ROUDOU_OUTPUT_DIR, filename));

    db.insert(auditLog).values({
      action: "export",
      entityType: "document",
      entityId: employee.id,
      detail: `契約書PDF生成: 社員番号${employeeNumber} (${employee.fullName})`,
      userName: "system",
    }).run();

    return c.json({
      success: true,
      employeeNumber,
      employeeName: employee.fullName,
      company: company?.name,
      factory: `${factory.factoryName} ${factory.department || ""} ${factory.lineName || ""}`.trim(),
      filename,
      path: `/api/documents/download/${encodeURIComponent(filename)}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `PDF生成に失敗しました: ${message}` }, 500);
  }
}

export async function handleShugyojoken(c: Context) {
  const employeeNumber = (c.req.param("employeeNumber") ?? "").trim();

  const employee = await db.query.employees.findFirst({
    where: eq(employees.employeeNumber, employeeNumber),
    with: { company: true, factory: true },
  });

  if (!employee) {
    return c.json({ error: `社員番号「${employeeNumber}」が見つかりません` }, 404);
  }

  if (!employee.factory) {
    return c.json({ error: `社員番号「${employeeNumber}」に配属先（工場）が設定されていません` }, 400);
  }

  const bodyParsed2 = individualDocBodySchema.safeParse(await c.req.json().catch(() => ({})));
  const bodyData2 = bodyParsed2.success ? bodyParsed2.data : {};
  const startDate: string = bodyData2.startDate || toLocalDateStr(new Date());
  let endDate: string = bodyData2.endDate || "";

  if (!endDate) {
    const [sy, sm, sd] = startDate.split("-").map(Number);
    const start = new Date(sy, sm - 1, sd);
    start.setMonth(start.getMonth() + 3);
    start.setDate(start.getDate() - 1);
    endDate = toLocalDateStr(start);
  }

  const factory = employee.factory;
  const company = employee.company;

  const shugyoData: ShugyoJokenData = {
    companyName: company?.name || "",
    companyAddress: company?.address || "",
    companyPhone: company?.phone || "",
    factoryName: factory.factoryName,
    factoryAddress: factory.address || company?.address || "",
    department: factory.department || "",
    lineName: factory.lineName || "",
    conflictDate: factory.conflictDate || "",
    contractDate: toLocalDateStr(new Date()),
    startDate,
    endDate,
    jobDescription: factory.jobDescription || "",
    workHours: factory.workHours || "",
    breakTime: [factory.breakTimeDay, factory.breakTimeNight].filter(Boolean).join("\n")
      || (factory.breakTime ? `${factory.breakTime}分` : ""),
    overtimeHours: factory.overtimeHours || "",
    hourlyRate: employee.billingRate ?? employee.hourlyRate ?? factory.hourlyRate ?? 0,
    closingDay: factory.closingDayText || (factory.closingDay ? `${factory.closingDay}日` : ""),
    paymentDay: factory.paymentDayText || (factory.paymentDay ? `${factory.paymentDay}日` : ""),
    supervisorDept: factory.supervisorDept || "",
    supervisorName: factory.supervisorName || "",
    supervisorPhone: factory.supervisorPhone || "",
    complaintClientDept: factory.complaintClientDept || "",
    complaintClientName: factory.complaintClientName || "",
    complaintClientPhone: factory.complaintClientPhone || "",
    complaintUnsDept: factory.complaintUnsDept || "",
    complaintUnsName: factory.complaintUnsName || "",
    complaintUnsPhone: factory.complaintUnsPhone || "",
    calendar: factory.calendar || "",
    employee: {
      fullName: employee.fullName,
      katakanaName: employee.katakanaName || "",
      gender: employee.gender,
      birthDate: employee.birthDate,
      actualHireDate: employee.actualHireDate,
      hireDate: employee.hireDate,
      hourlyRate: employee.hourlyRate,
    },
  };

  try {
    const doc = createDoc();
    generateShugyoJokenMeijishoPDF(doc, shugyoData);

    const timestamp = toLocalDateStr(new Date());
    const empLabel = sanitizeFilename(employee.katakanaName || employee.fullName);
    const filename = `就業条件明示書_${empLabel}_${employee.employeeNumber}_${timestamp}.pdf`;
    await writeToFile(doc, path.join(ROUDOU_OUTPUT_DIR, filename));

    db.insert(auditLog).values({
      action: "export",
      entityType: "document",
      entityId: employee.id,
      detail: `就業条件明示書PDF生成: 社員番号${employeeNumber} (${employee.fullName})`,
      userName: "system",
    }).run();

    return c.json({
      success: true,
      employeeNumber,
      employeeName: employee.fullName,
      company: company?.name,
      factory: `${factory.factoryName} ${factory.department || ""} ${factory.lineName || ""}`.trim(),
      filename,
      path: `/api/documents/download/${encodeURIComponent(filename)}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `PDF生成に失敗しました: ${message}` }, 500);
  }
}
