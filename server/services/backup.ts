import path from "node:path";
import fs from "node:fs";

const DATA_DIR = path.resolve("data");
const BACKUP_PREFIX = "kobetsu-auto-";
const BACKUP_SUFFIX = ".db";

/** Crea un backup de kobetsu.db y rota los más antiguos, conservando los últimos BACKUP_KEEP_COUNT. */
export async function createAutoBackup(): Promise<string> {
  const dbPath = path.join(DATA_DIR, "kobetsu.db");
  if (!fs.existsSync(dbPath)) return "";

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupName = `${BACKUP_PREFIX}${timestamp}${BACKUP_SUFFIX}`;
  const backupPath = path.join(DATA_DIR, backupName);

  const { sqlite } = await import("../db/index.js");
  await sqlite.backup(backupPath);

  // Rotación: conserva solo los últimos N backups automáticos
  rotateBackups();

  return backupName;
}

/** Elimina backups automáticos más antiguos, conservando los últimos BACKUP_KEEP_COUNT. */
function rotateBackups(): void {
  const keep = Math.max(1, Number(process.env.BACKUP_KEEP_COUNT ?? 10));

  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.startsWith(BACKUP_PREFIX) && f.endsWith(BACKUP_SUFFIX))
    .sort(); // ISO timestamp → orden lexicográfico = cronológico

  const toDelete = files.slice(0, Math.max(0, files.length - keep));
  for (const f of toDelete) {
    try {
      fs.unlinkSync(path.join(DATA_DIR, f));
    } catch {
      // No bloquear si un archivo ya fue eliminado externamente
    }
  }
}
