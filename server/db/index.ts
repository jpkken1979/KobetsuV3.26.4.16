import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isVitest = process.env.VITEST === "true" || process.env.VITEST === "1";

// Allow tests (and any deploy) to point at a separate file via DATABASE_PATH.
// In Vitest we default to data/kobetsu.test.db so runs never wipe the working DB.
const defaultDbFile = isVitest ? "data/kobetsu.test.db" : "data/kobetsu.db";
const requestedDbPath = process.env.DATABASE_PATH || defaultDbFile;
const dbPath = path.isAbsolute(requestedDbPath)
  ? requestedDbPath
  : path.resolve(__dirname, "../..", requestedDbPath);
const migrationsFolder = path.resolve(__dirname, "migrations");

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("cache_size = -20000");
sqlite.pragma("synchronous = NORMAL");
sqlite.pragma("temp_store = MEMORY");

export const db = drizzle(sqlite, { schema });

function collectErrorMessages(error: unknown): string[] {
  const messages: string[] = [];
  let cursor: unknown = error;
  let depth = 0;

  while (cursor && depth < 8) {
    if (cursor instanceof Error) {
      messages.push(cursor.message || "");
      cursor = (cursor as { cause?: unknown }).cause;
      depth += 1;
      continue;
    }

    messages.push(String(cursor));
    break;
  }

  return messages;
}

function isLegacyMigrationConflict(error: unknown): boolean {
  const haystack = collectErrorMessages(error).join("\n").toLowerCase();
  return (
    haystack.includes("already exists") ||
    haystack.includes("duplicate column name")
  );
}

// In tests we seed the DB before running vitest. Skipping migrations here avoids
// worker race conditions when multiple files import the DB in parallel.
if (!isVitest) {
  try {
    migrate(db, { migrationsFolder });
  } catch (error) {
    if (!isLegacyMigrationConflict(error)) {
      throw error;
    }
    console.warn("[db] migrate skipped: legacy schema already applied");
  }
}

export { sqlite };
export type DB = typeof db;
