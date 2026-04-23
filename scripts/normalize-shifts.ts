/**
 * One-shot: normalize workHours + breakTimeDay + breakTimeNight across all factories.
 *
 *   npx tsx scripts/normalize-shifts.ts         # dry-run, shows diffs
 *   npx tsx scripts/normalize-shifts.ts --apply # writes changes
 *
 * Creates a timestamped backup of data/kobetsu.db before writing.
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { normalizeWorkHoursString, normalizeBreakTimeString } from "../server/services/shift-sort.js";

const DB_PATH = path.resolve("data/kobetsu.db");
const APPLY = process.argv.includes("--apply");

interface FactoryRow {
  id: number;
  factory_name: string | null;
  department: string | null;
  line_name: string | null;
  work_hours: string | null;
  break_time_day: string | null;
  break_time_night: string | null;
  company_name: string;
}

function backupDb(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dest = path.resolve(`data/kobetsu.backup-pre-shift-normalize-${ts}.db`);
  fs.copyFileSync(DB_PATH, dest);
  return dest;
}

function main(): void {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`DB not found at ${DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  const rows = db
    .prepare(
      `SELECT f.id, f.factory_name, f.department, f.line_name,
              f.work_hours, f.break_time_day, f.break_time_night,
              c.name AS company_name
       FROM factories f
       JOIN client_companies c ON f.company_id = c.id
       ORDER BY c.name, f.factory_name, f.line_name`,
    )
    .all() as FactoryRow[];

  let takaoDiffs = 0;
  let totalChanged = 0;
  const changed: Array<{
    row: FactoryRow;
    wh: { before: string | null; after: string };
    bd: { before: string | null; after: string };
    bn: { before: string | null; after: string };
  }> = [];

  for (const row of rows) {
    const whNew = normalizeWorkHoursString(row.work_hours);
    const bdNew = normalizeBreakTimeString(row.break_time_day);
    const bnNew = normalizeBreakTimeString(row.break_time_night);

    const whChanged = (row.work_hours ?? "") !== whNew;
    const bdChanged = (row.break_time_day ?? "") !== bdNew;
    const bnChanged = (row.break_time_night ?? "") !== bnNew;

    if (!whChanged && !bdChanged && !bnChanged) continue;

    totalChanged++;
    if (row.company_name.includes("高雄")) takaoDiffs++;

    changed.push({
      row,
      wh: { before: row.work_hours, after: whNew },
      bd: { before: row.break_time_day, after: bdNew },
      bn: { before: row.break_time_night, after: bnNew },
    });
  }

  const total = rows.length;
  console.log(`Factories scanned: ${total}`);
  console.log(`Factories with shift changes: ${totalChanged}`);
  console.log(`  - 高雄 factories changed: ${takaoDiffs}`);

  // Show first 5 diffs + any 高雄 diff
  const takaoChanges = changed.filter((c) => c.row.company_name.includes("高雄"));
  const sample = [...takaoChanges.slice(0, 3), ...changed.filter((c) => !c.row.company_name.includes("高雄")).slice(0, 5)];
  if (sample.length) {
    console.log("\n--- Sample diffs ---");
    for (const c of sample) {
      console.log(`\n[${c.row.id}] ${c.row.company_name} / ${c.row.factory_name} / ${c.row.line_name}`);
      if (c.wh.before !== c.wh.after) {
        console.log("  WH before:", (c.wh.before ?? "").slice(0, 180));
        console.log("  WH after :", c.wh.after.slice(0, 180));
      }
      if (c.bd.before !== c.bd.after) {
        console.log("  BD before:", (c.bd.before ?? "").replace(/\n/g, " | ").slice(0, 180));
        console.log("  BD after :", c.bd.after.replace(/\n/g, " | ").slice(0, 180));
      }
      if (c.bn.before !== c.bn.after) {
        console.log("  BN before:", (c.bn.before ?? "").replace(/\n/g, " | ").slice(0, 180));
        console.log("  BN after :", c.bn.after.replace(/\n/g, " | ").slice(0, 180));
      }
    }
  }

  if (!APPLY) {
    console.log("\n[DRY RUN] Re-run with --apply to write changes.");
    db.close();
    return;
  }

  const backupPath = backupDb();
  console.log(`\nBackup saved to ${backupPath}`);

  const update = db.prepare(
    `UPDATE factories SET work_hours = ?, break_time_day = ?, break_time_night = ? WHERE id = ?`,
  );
  const tx = db.transaction((list: typeof changed) => {
    for (const c of list) {
      update.run(c.wh.after, c.bd.after, c.bn.after, c.row.id);
    }
  });
  tx(changed);
  console.log(`Updated ${changed.length} rows.`);
  db.close();
}

main();
