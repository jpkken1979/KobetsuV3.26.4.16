import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { companiesRouter } from "./routes/companies.js";
import { factoriesRouter } from "./routes/factories.js";
import { employeesRouter } from "./routes/employees.js";
import { contractsRouter } from "./routes/contracts.js";
import { contractsBatchRouter } from "./routes/contracts-batch.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { calendarsRouter } from "./routes/calendars.js";
import { importRouter } from "./routes/import.js";
import { importFactoriesRouter } from "./routes/import-factories.js";
import { importKoritsuRouter } from "./routes/import-koritsu.js";
import { documentsRouter } from "./routes/documents.js";
import { documentsGenerateRouter } from "./routes/documents-generate.js";
import { shiftTemplatesRouter } from "./routes/shift-templates.js";
import { dataCheckRouter } from "./routes/data-check.js";
import { adminTablesRouter } from "./routes/admin-tables.js";
import { adminSqlRouter } from "./routes/admin-sql.js";
import { adminRowsRouter } from "./routes/admin-rows.js";
import { adminCrudRouter } from "./routes/admin-crud.js";
import { adminBackupRouter } from "./routes/admin-backup.js";
import { adminStatsRouter } from "./routes/admin-stats.js";
import { adminResetRouter } from "./routes/admin-reset.js";
import { pdfVersionsRouter } from "./routes/pdf-versions.js";
import { factoryYearlyConfigRouter } from "./routes/factory-yearly-config.js";
import { companyYearlyConfigRouter } from "./routes/company-yearly-config.js";
import { bodyLimit } from "hono/body-limit";
import { adminGuardMiddleware, securityHeadersMiddleware } from "./middleware/security.js";
import { createAutoBackup } from "./services/backup.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = new Hono();
const api = new Hono().basePath("/api");
const serverStartedAt = Date.now();
const port = Number(process.env.PORT ?? 8026);
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:3026";

app.use("*", logger());
api.use("*", logger());
api.use(
  "*",
  cors({
    origin: frontendOrigin,
    allowHeaders: ["Content-Type", "x-admin-token"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);
api.use("*", bodyLimit({ maxSize: 10 * 1024 * 1024 })); // 10MB max
api.use("*", securityHeadersMiddleware);
api.use("*", adminGuardMiddleware);

app.get("/", (c) => c.redirect("/api/health", 302));

// Health check with DB verification
api.get("/health", async (c) => {
  const dbPath = path.resolve("data/kobetsu.db");
  const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
  const uptime = Math.floor((Date.now() - serverStartedAt) / 1000);

  let dbOk: boolean;
  try {
    const { sqlite: sqliteDb } = await import("./db/index.js");
    const result = sqliteDb.prepare("SELECT 1 AS ok").get() as { ok: number } | undefined;
    dbOk = result?.ok === 1;
  } catch {
    dbOk = false;
  }

  return c.json({
    status: dbOk ? "ok" : "degraded",
    version: "26.3.31",
    name: "個別契約書管理システム",
    port,
    uptime,
    dbSize,
    dbConnected: dbOk,
  });
});

// Backup endpoint
api.post("/backup", async (c) => {
  const dbPath = path.resolve("data/kobetsu.db");
  if (!fs.existsSync(dbPath)) {
    return c.json({ error: "Database file not found" }, 404);
  }

  const backupName = await createAutoBackup();
  const timestamp = new Date().toISOString();
  return c.json({ filename: backupName, timestamp });
});

// Routes
api.route("/companies", companiesRouter);
api.route("/factories", factoriesRouter);
api.route("/employees", employeesRouter);
api.route("/contracts", contractsRouter);
api.route("/contracts", contractsBatchRouter);
api.route("/dashboard", dashboardRouter);
api.route("/calendars", calendarsRouter);
api.route("/import", importRouter);
api.route("/import", importFactoriesRouter);
api.route("/import", importKoritsuRouter);
api.route("/documents", documentsRouter);
api.route("/documents", documentsGenerateRouter);
api.route("/shift-templates", shiftTemplatesRouter);
api.route("/data-check", dataCheckRouter);
api.route("/admin/tables", adminTablesRouter);
api.route("/admin/sql", adminSqlRouter);
api.route("/admin/rows", adminRowsRouter);
api.route("/admin/crud", adminCrudRouter);
api.route("/admin/stats", adminStatsRouter);
api.route("/admin/backup", adminBackupRouter);
api.route("/admin/reset-all", adminResetRouter);
api.route("/pdf-versions", pdfVersionsRouter);
api.route("/factory-yearly-config", factoryYearlyConfigRouter);
api.route("/company-yearly-config", companyYearlyConfigRouter);

app.route("/", api);

// Only bind to a real port when running as the entry point (not when imported by tests)
const isEntryPoint =
  process.argv[1] &&
  (process.argv[1] === fileURLToPath(import.meta.url) ||
    // tsx / ts-node rewrites the path — also match by filename without extension
    process.argv[1].replace(/\.[jt]s$/, "") === fileURLToPath(import.meta.url).replace(/\.[jt]s$/, ""));

if (isEntryPoint) {
  console.log(`[個別契約書API] Server running on http://localhost:${port}`);

  const server = serve({ fetch: app.fetch, port });

  // Backup periódico con rotación automática.
  // Intervalo configurable via BACKUP_INTERVAL_HOURS (default: 24h).
  // Jitter inicial 0-30min para evitar thundering herd en reinicios simultáneos.
  {
    const intervalMs = Math.max(1, Number(process.env.BACKUP_INTERVAL_HOURS ?? 24)) * 60 * 60 * 1000;
    const jitterMs = Math.floor(Math.random() * 30 * 60 * 1000);
    setTimeout(() => {
      createAutoBackup().catch((err: unknown) => console.error("[backup] Error en backup periódico:", err));
      setInterval(
        () => createAutoBackup().catch((err: unknown) => console.error("[backup] Error en backup periódico:", err)),
        intervalMs,
      );
    }, jitterMs);
    console.log(`[backup] Backup automático programado cada ${process.env.BACKUP_INTERVAL_HOURS ?? 24}h (primer backup en ~${Math.round(jitterMs / 60000)}min)`);
  }

  server.on("error", async (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      try {
        const { execFileSync } = await import("node:child_process");
        const out = execFileSync("netstat", ["-ano"], { encoding: "utf-8" });
        const line = out.split("\n").find((l) => l.includes(`:${port}`) && l.includes("LISTENING"));
        const pid = line?.trim().split(/\s+/).pop();
        if (pid) {
          console.error(`\n❌ Puerto ${port} ocupado por PID ${pid}. Ejecuta:\n`);
          console.error(`   taskkill /PID ${pid} /F\n`);
        } else {
          console.error(`\n❌ Puerto ${port} ocupado. Ejecuta: netstat -ano | findstr ${port}\n`);
        }
      } catch {
        console.error(`\n❌ Puerto ${port} ocupado. Ejecuta: netstat -ano | findstr ${port}\n`);
      }
      process.exit(1);
    }
    throw err;
  });
}

export default app;
export type AppType = typeof app;
