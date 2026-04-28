import { Hono } from "hono";
import { z } from "zod";
import { db, sqlite } from "../db/index.js";
import { buildAuditDetail } from "../services/audit-context.js";
import {
  contractEmployees,
  pdfVersions,
  contracts,
  factoryCalendars,
  employees,
  shiftTemplates,
  factories,
  clientCompanies,
  auditLog,
} from "../db/schema.js";
import { count } from "drizzle-orm";

export const adminResetRouter = new Hono();

const resetSchema = z.object({ confirm: z.literal("RESET") });

adminResetRouter.post("/", async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "Confirmación inválida" }, 400);
  }

  const parsed = resetSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: "Confirmación inválida" }, 400);
  }

  try {
    // Contar y borrar en una sola transacción atómica (evita race conditions)
    const deletedCounts = {
      contractEmployees: 0,
      pdfVersions: 0,
      contracts: 0,
      factoryCalendars: 0,
      employees: 0,
      shiftTemplates: 0,
      factories: 0,
      clientCompanies: 0,
    };

    sqlite.transaction(() => {
      // Contar antes de borrar (dentro de la transacción)
      const [ceResult] = db.select({ n: count() }).from(contractEmployees).all();
      const [pvResult] = db.select({ n: count() }).from(pdfVersions).all();
      const [cResult] = db.select({ n: count() }).from(contracts).all();
      const [fcResult] = db.select({ n: count() }).from(factoryCalendars).all();
      const [empResult] = db.select({ n: count() }).from(employees).all();
      const [stResult] = db.select({ n: count() }).from(shiftTemplates).all();
      const [fResult] = db.select({ n: count() }).from(factories).all();
      const [ccResult] = db.select({ n: count() }).from(clientCompanies).all();

      deletedCounts.contractEmployees = ceResult?.n ?? 0;
      deletedCounts.pdfVersions = pvResult?.n ?? 0;
      deletedCounts.contracts = cResult?.n ?? 0;
      deletedCounts.factoryCalendars = fcResult?.n ?? 0;
      deletedCounts.employees = empResult?.n ?? 0;
      deletedCounts.shiftTemplates = stResult?.n ?? 0;
      deletedCounts.factories = fResult?.n ?? 0;
      deletedCounts.clientCompanies = ccResult?.n ?? 0;

      // Borrar en orden: hijos antes que padres (FK integrity)
      db.delete(contractEmployees).run();
      db.delete(pdfVersions).run();
      db.delete(contracts).run();
      db.delete(factoryCalendars).run();
      db.delete(employees).run();
      db.delete(shiftTemplates).run();
      db.delete(factories).run();
      db.delete(clientCompanies).run();
    })();

    // Registrar en audit_log (post-transacción) con IP+UA para forensics.
    db.insert(auditLog)
      .values({
        action: "delete",
        entityType: "ALL_TABLES",
        entityId: null,
        detail: buildAuditDetail(c, "Admin reset-all", deletedCounts),
        userName: "admin",
      })
      .run();

    return c.json({ success: true, deleted: deletedCounts });
  } catch (err: unknown) {
    console.error("[admin-reset] Transaction failed:", err);
    return c.json({ error: "Reset failed" }, 500);
  }
});
