/**
 * Admin Backup Router
 *
 * Provides backup management endpoints for the admin database panel:
 * - List .db files in data/
 * - Create manual backup
 * - Restore from a backup file
 * - Delete a backup file
 * - Export database as SQL dump
 */

import { Hono } from "hono";
import fs from "node:fs";
import path from "node:path";
import { createAutoBackup } from "../services/backup.js";
import { sanitizeErrorMessage } from "../services/error-utils.js";

export const adminBackupRouter = new Hono();

// ─── Types ─────────────────────────────────────────────────────────

interface BackupEntry {
  filename: string;
  path: string;
  size: number;
  createdAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

const DATA_DIR = path.resolve("data");

/**
 * Resuelve un filename a su path absoluto dentro de DATA_DIR rechazando
 * symlinks y traversal. Devuelve null si el path es inválido.
 *
 * Cierra BACK-HIGH-2 (audit 2026-04-29): un atacante con write en data/
 * podía plantar `kobetsu-evil.db -> /etc/passwd` y el restore copiaba el
 * target sobre kobetsu.db. `path.resolve + startsWith` no detectaba
 * symlinks; ahora rechazamos cualquier non-regular file y comparamos
 * realpath contra realpath(DATA_DIR).
 */
function resolveBackupPath(filename: string): string | null {
  const candidate = path.join(DATA_DIR, filename);
  if (!candidate.startsWith(DATA_DIR + path.sep)) return null;
  if (!fs.existsSync(candidate)) return null;

  const lstat = fs.lstatSync(candidate);
  if (!lstat.isFile()) return null; // rechaza symlinks, dirs, devices

  const realDataDir = fs.realpathSync(DATA_DIR);
  const realPath = fs.realpathSync(candidate);
  if (!realPath.startsWith(realDataDir + path.sep)) return null;

  return realPath;
}

/** List all .db files in data/ directory */
function listDbFiles(): BackupEntry[] {
  if (!fs.existsSync(DATA_DIR)) return [];

  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".db"))
    .map((filename) => {
      const filePath = path.join(DATA_DIR, filename);
      const stats = fs.statSync(filePath);
      return {
        filename,
        path: filePath,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ─── Routes ─────────────────────────────────────────────────────────

/**
 * GET /api/admin/backups
 *
 * List all .db files in the data/ directory with metadata.
 */
adminBackupRouter.get("/", async (c) => {
  try {
    const backups = listDbFiles();
    return c.json({ backups });
  } catch (err: unknown) {
    return c.json({ error: `Failed to list backups: ${sanitizeErrorMessage(err)}` }, 500);
  }
});

/**
 * POST /api/admin/backup
 *
 * Create a manual backup of the active database.
 * Reuses createAutoBackup() from server/services/backup.ts
 */
adminBackupRouter.post("/", async (c) => {
  try {
    const dbPath = path.join(DATA_DIR, "kobetsu.db");
    if (!fs.existsSync(dbPath)) {
      return c.json({ error: "Database file not found" }, 404);
    }

    const filename = await createAutoBackup();
    const backups = listDbFiles();

    return c.json({
      success: true,
      filename,
      message: "Backup created successfully",
      backups,
    });
  } catch (err: unknown) {
    return c.json({ error: `Failed to create backup: ${sanitizeErrorMessage(err)}` }, 500);
  }
});

/**
 * POST /api/admin/restore
 *
 * Restore the database from a backup file.
 * Creates an auto-backup of the CURRENT state before restoring.
 * The active connection will not change until server restart.
 */
adminBackupRouter.post("/restore", async (c) => {
  try {
    const body = await c.req.json<{ filename: string }>();
    const { filename } = body ?? {};

    if (!filename || typeof filename !== "string") {
      return c.json({ error: "Missing required field: filename" }, 400);
    }

    // Only allow files matching kobetsu-*.db pattern
    if (!/^kobetsu-.+\.db$/i.test(filename)) {
      return c.json({
        error: "Invalid filename. Only kobetsu-*.db files are allowed for restore.",
      }, 400);
    }

    const backupPath = resolveBackupPath(filename);
    if (!backupPath) {
      return c.json({ error: `Backup file not found or invalid: ${filename}` }, 404);
    }

    const activeDbPath = path.join(DATA_DIR, "kobetsu.db");

    // Create auto-backup BEFORE restoring
    const preBackupFilename = await createAutoBackup();

    // Copy backup file to active DB path
    fs.copyFileSync(backupPath, activeDbPath);

    return c.json({
      success: true,
      message: "Restore complete. Restart the server to apply changes.",
      preBackup: preBackupFilename,
      restoredFrom: filename,
    });
  } catch (err: unknown) {
    return c.json({ error: `Failed to restore backup: ${sanitizeErrorMessage(err)}` }, 500);
  }
});

/**
 * DELETE /api/admin/backup/:filename
 *
 * Delete a specific backup file.
 * Only allows files matching kobetsu-*.db pattern.
 */
adminBackupRouter.delete("/:filename", async (c) => {
  try {
    const filename = c.req.param("filename");

    if (!filename || typeof filename !== "string") {
      return c.json({ error: "Missing filename parameter" }, 400);
    }

    // Security: only allow kobetsu-*.db files
    if (!/^kobetsu-.+\.db$/i.test(filename)) {
      return c.json({
        error: "Invalid filename. Only kobetsu-*.db files can be deleted.",
      }, 400);
    }

    // Prevent deleting the active database
    if (filename === "kobetsu.db") {
      return c.json({ error: "Cannot delete the active database file." }, 400);
    }

    const filePath = resolveBackupPath(filename);
    if (!filePath) {
      return c.json({ error: `Backup file not found or invalid: ${filename}` }, 404);
    }

    fs.unlinkSync(filePath);

    return c.json({ deleted: true, filename });
  } catch (err: unknown) {
    return c.json({ error: `Failed to delete backup: ${sanitizeErrorMessage(err)}` }, 500);
  }
});

/**
 * POST /api/admin/backup/export-sql
 *
 * Export the entire database as an SQL dump using better-sqlite3 .dump()
 * Returns the SQL as a JSON string for the client to download.
 */
adminBackupRouter.post("/export-sql", async (c) => {
  try {
    const dbPath = path.join(DATA_DIR, "kobetsu.db");
    if (!fs.existsSync(dbPath)) {
      return c.json({ error: "Database file not found" }, 404);
    }

    const { sqlite: db } = await import("../db/index.js");

    // Get all table names
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as { name: string }[];

    const lines: string[] = [];
    lines.push("-- SQL Dump generated by JP個別契約書 Admin Panel");
    lines.push(`-- Generated at: ${new Date().toISOString()}`);
    lines.push(`-- Database: ${dbPath}`);
    lines.push("");

    for (const { name: tableName } of tables) {
      // CREATE statement
      const createStmt = db
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
        .get(tableName) as { sql: string } | undefined;

      if (createStmt?.sql) {
        lines.push(createStmt.sql + ";");
        lines.push("");
      }

      // INSERT statements
      const rows = db.prepare(`SELECT * FROM "${tableName}"`).all() as Record<string, unknown>[];

      for (const row of rows) {
        const columns = Object.keys(row);
        const values = columns.map((col) => {
          const val = row[col];
          if (val === null || val === undefined) return "NULL";
          if (typeof val === "number") return String(val);
          if (typeof val === "bigint") return String(val);
          if (typeof val === "boolean") return val ? "1" : "0";
          // BLOBs (Buffer/Uint8Array) → notación X'hex...' que sí soporta sqlite.
          if (val instanceof Uint8Array) {
            return `X'${Buffer.from(val).toString("hex")}'`;
          }
          // Strings: solo escapar comilla simple. NO escapar backslash:
          // sqlite no interpreta \\ como escape — el \\\\ del export anterior
          // se reimportaba como literal \\, corrompiendo los datos
          // (M-2, audit 2026-04-28).
          const escaped = String(val).replace(/'/g, "''");
          return `'${escaped}'`;
        });

        lines.push(
          `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${values.join(", ")});`
        );
      }

      lines.push("");
    }

    return c.json({
      sql: lines.join("\n"),
      filename: `kobetsu-dump-${new Date().toISOString().slice(0, 10)}.sql`,
    });
  } catch (err: unknown) {
    return c.json({ error: `Failed to export SQL: ${sanitizeErrorMessage(err)}` }, 500);
  }
});