import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve("data/kobetsu.db");
const db = new Database(dbPath);

console.log("Starting migration...");

// Get current schema
type FactoryColumn = { name: string };
const columns = db.prepare("PRAGMA table_info(factories)").all() as FactoryColumn[];
const columnNames = columns.map((c) => c.name);

console.log("Current factories columns:", columnNames);

// Add missing columns if they don't exist
const columnsToAdd = [
  { name: "shift_pattern", sql: 'ALTER TABLE factories ADD COLUMN shift_pattern TEXT' },
  { name: "work_hours_day", sql: 'ALTER TABLE factories ADD COLUMN work_hours_day TEXT' },
  { name: "work_hours_night", sql: 'ALTER TABLE factories ADD COLUMN work_hours_night TEXT' },
  { name: "break_time_day", sql: 'ALTER TABLE factories ADD COLUMN break_time_day TEXT' },
  { name: "break_time_night", sql: 'ALTER TABLE factories ADD COLUMN break_time_night TEXT' },
];

for (const col of columnsToAdd) {
  if (!columnNames.includes(col.name)) {
    try {
      db.exec(col.sql);
      console.log(`✓ Added column: ${col.name}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`✗ Failed to add ${col.name}:`, message);
    }
  } else {
    console.log(`- Column ${col.name} already exists`);
  }
}

console.log("Migration complete!");
db.close();
