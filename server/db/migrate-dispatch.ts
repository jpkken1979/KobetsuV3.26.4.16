/**
 * Migration: Resolve companyId and factoryId for all employees
 *
 * The original seed script used simple `includes` matching which failed
 * for abbreviated dispatch names like "高雄工業 岡山" vs "高雄工業株式会社".
 *
 * This script uses resolveDispatch() from dispatch-mapping.ts (same as
 * the import endpoint) to correctly resolve company + factory IDs.
 *
 * Run: npx tsx server/db/migrate-dispatch.ts
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../../data/kobetsu.db");
const seedPath = path.resolve(__dirname, "../../data/seed/employees.json");

// Import dispatch mapping (inline copy to avoid module resolution issues in standalone script)
interface DispatchResolution {
  companyName: string;
  factoryName: string | null;
  verified: boolean;
}

const DISPATCH_MAP: Record<string, DispatchResolution> = {
  "高雄工業 本社": { companyName: "高雄工業株式会社", factoryName: "本社工場", verified: true },
  "高雄工業 海南第一": { companyName: "高雄工業株式会社", factoryName: "海南第一工場", verified: true },
  "高雄工業 海南第二": { companyName: "高雄工業株式会社", factoryName: "海南第二工場", verified: true },
  "高雄工業 静岡": { companyName: "高雄工業株式会社", factoryName: "第一工場", verified: true },
  "高雄工業 岡山": { companyName: "高雄工業株式会社", factoryName: "HUB工場", verified: true },
  "加藤木材工業 本社": { companyName: "加藤木材工業株式会社", factoryName: "本社工場", verified: true },
  "加藤木材工業 春日井": { companyName: "加藤木材工業株式会社", factoryName: "春日井工場", verified: true },
  "瑞陵精機": { companyName: "瑞陵精機株式会社", factoryName: "恵那工場", verified: true },
  "川原鉄工所": { companyName: "株式会社川原鉄工所", factoryName: "本社工場", verified: true },
  "六甲電子": { companyName: "六甲電子株式会社", factoryName: "本社工場", verified: true },
  "オーツカ": { companyName: "株式会社オーツカ", factoryName: "関ケ原工場", verified: true },
  "ピーエムアイ": { companyName: "ピーエムアイ有限会社", factoryName: "本社工場", verified: true },
  "三幸技研": { companyName: "三幸技研株式会社", factoryName: "本社工場", verified: true },
  "アサヒフォージ": { companyName: "アサヒフォージ株式会社", factoryName: "真庭工場", verified: true },
  "ユアサ工機 本社": { companyName: "ユアサ工機株式会社", factoryName: "本社工場", verified: true },
  "ユアサ工機 新城": { companyName: "ユアサ工機株式会社", factoryName: "新城工場", verified: true },
  "ユアサ工機 御津": { companyName: "ユアサ工機株式会社", factoryName: null, verified: false },
  "美鈴工業 本社": { companyName: "株式会社美鈴工業", factoryName: "本社工場", verified: true },
  "美鈴工業 本庄": { companyName: "株式会社美鈴工業", factoryName: null, verified: false },
  "セイビテック": { companyName: "セイビテック株式会社", factoryName: null, verified: false },
  "ﾃｨｰｹｰｴﾝｼﾞﾆｱﾘﾝｸﾞ": { companyName: "ﾃｨｰｹｰｴﾝｼﾞﾆｱﾘﾝｸﾞ株式会社", factoryName: "海南第二工場", verified: true },
  "ﾌｪﾆﾃｯｸｾﾐｺﾝﾀﾞｸﾀｰ 鹿児島": { companyName: "フェニテックセミコンダクター(株)", factoryName: "鹿児島工場", verified: true },
  "ﾌｪﾆﾃｯｸｾﾐｺﾝﾀﾞｸﾀｰ 岡山": { companyName: "フェニテックセミコンダクター(株)", factoryName: null, verified: false },
  // Companies added to DB by this migration
  "PATEC": { companyName: "PATEC株式会社", factoryName: null, verified: true },
  "コーリツ 本社": { companyName: "コーリツ株式会社", factoryName: "本社", verified: true },
  "コーリツ 州の崎": { companyName: "コーリツ株式会社", factoryName: "州の埼工場", verified: true },
  "コーリツ 亀崎": { companyName: "コーリツ株式会社", factoryName: "亀崎", verified: true },
  "コーリツ 乙川": { companyName: "コーリツ株式会社", factoryName: "乙川", verified: true },
  "プレテック": { companyName: "プレテック株式会社", factoryName: null, verified: true },
  "ワーク 志紀": { companyName: "ワーク株式会社", factoryName: "志紀", verified: true },
  "ワーク 堺": { companyName: "ワーク株式会社", factoryName: "堺", verified: true },
  "ワーク 岡山": { companyName: "ワーク株式会社", factoryName: "岡山", verified: true },
};

function resolveDispatch(hakensaki: string): DispatchResolution {
  const trimmed = hakensaki.trim();
  if (DISPATCH_MAP[trimmed]) return DISPATCH_MAP[trimmed];
  for (const [key, resolution] of Object.entries(DISPATCH_MAP)) {
    if (trimmed.startsWith(key) || key.startsWith(trimmed)) return resolution;
  }
  const parts = trimmed.split(/\s+/);
  return { companyName: parts[0], factoryName: parts.length > 1 ? parts.slice(1).join(" ") : null, verified: false };
}

// ─── Main migration ───

console.log("[migrate-dispatch] Starting company/factory resolution...");
console.log(`[migrate-dispatch] DB: ${dbPath}`);

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

type DbCompany = { id: number; name: string; short_name: string | null };
type DbFactory = {
  id: number;
  company_id: number;
  factory_name: string | null;
  department: string | null;
  line_name: string | null;
};
type DbEmployee = {
  id: number;
  employee_number: string;
  company_id: number | null;
  factory_id: number | null;
};
type MigrationStats = {
  total: number;
  withCompany: number;
  withFactory: number;
};

// Load companies
const companies = db.prepare("SELECT id, name, short_name FROM client_companies").all() as DbCompany[];
const companyMap = new Map<string, number>();
for (const co of companies) {
  companyMap.set(co.name, co.id);
  if (co.short_name) companyMap.set(co.short_name, co.id);
}
console.log(`[migrate-dispatch] Loaded ${companies.length} companies (${companyMap.size} keys)`);

// Load factories
const allFactories = db
  .prepare("SELECT id, company_id, factory_name, department, line_name FROM factories")
  .all() as DbFactory[];
const factoryLookup = new Map<string, number>();
for (const f of allFactories) {
  // Key: companyId|factoryName
  factoryLookup.set(`${f.company_id}|${f.factory_name}`, f.id);
  // Key: companyId|department|lineName
  factoryLookup.set(`${f.company_id}|${f.department || ""}|${f.line_name || ""}`, f.id);
  // Key: companyId||lineName
  if (f.line_name) factoryLookup.set(`${f.company_id}||${f.line_name}`, f.id);
}
console.log(`[migrate-dispatch] Loaded ${allFactories.length} factories (${factoryLookup.size} keys)`);

// Load seed employees JSON for original companyName
interface SeedEmployee {
  employeeNumber: string;
  companyName?: string;
}
const seedEmployees: SeedEmployee[] = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
const seedMap = new Map<string, string>();
for (const e of seedEmployees) {
  if (e.companyName) seedMap.set(e.employeeNumber, e.companyName);
}
console.log(`[migrate-dispatch] Loaded ${seedEmployees.length} seed records, ${seedMap.size} with companyName`);

// Update each employee
const updateStmt = db.prepare("UPDATE employees SET company_id = ?, factory_id = ?, updated_at = datetime('now') WHERE employee_number = ?");

let resolved = 0;
let resolvedFactory = 0;
let unresolved = 0;
const unresolvedNames = new Map<string, number>();

const allEmployees = db
  .prepare("SELECT id, employee_number, company_id, factory_id FROM employees")
  .all() as DbEmployee[];

const transaction = db.transaction(() => {
  for (const emp of allEmployees) {
    const rawDispatch = seedMap.get(emp.employee_number);
    if (!rawDispatch) {
      unresolved++;
      continue;
    }

    // Use dispatch-mapping to resolve
    const resolution = resolveDispatch(rawDispatch);
    const fullCompanyName = resolution.companyName;

    // Resolve companyId
    let companyId: number | null = companyMap.get(fullCompanyName) ?? null;

    // Fallback: partial match
    if (!companyId) {
      for (const [name, id] of companyMap) {
        if (name.includes(fullCompanyName) || fullCompanyName.includes(name) ||
            name.includes(rawDispatch) || rawDispatch.includes(name)) {
          companyId = id;
          break;
        }
      }
    }

    if (!companyId) {
      unresolvedNames.set(rawDispatch, (unresolvedNames.get(rawDispatch) || 0) + 1);
      unresolved++;
      continue;
    }

    // Resolve factoryId
    let factoryId: number | null = null;

    // Strategy 1: companyId|factoryName from dispatch mapping
    if (resolution.factoryName) {
      factoryId = factoryLookup.get(`${companyId}|${resolution.factoryName}`) ?? null;
    }

    // Strategy 2: find any factory for this company
    if (!factoryId) {
      const anyFactory = allFactories.find((f) => f.company_id === companyId);
      if (anyFactory) factoryId = anyFactory.id;
    }

    // Update
    updateStmt.run(companyId, factoryId, emp.employee_number);
    resolved++;
    if (factoryId) resolvedFactory++;
  }
});

transaction();

console.log("\n[migrate-dispatch] ═══ Results ═══");
console.log(`  ✓ Company resolved: ${resolved}/${allEmployees.length}`);
console.log(`  ✓ Factory resolved: ${resolvedFactory}/${allEmployees.length}`);
console.log(`  ✗ Unresolved: ${unresolved}`);

if (unresolvedNames.size > 0) {
  console.log("\n[migrate-dispatch] Unresolved dispatch names:");
  for (const [name, count] of [...unresolvedNames.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${count.toString().padStart(3)}x  ${name}`);
  }
}

// Verify
const afterStats = db.prepare(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN company_id IS NOT NULL THEN 1 ELSE 0 END) as withCompany,
    SUM(CASE WHEN factory_id IS NOT NULL THEN 1 ELSE 0 END) as withFactory
  FROM employees
`).get() as MigrationStats;

console.log("\n[migrate-dispatch] ═══ After migration ═══");
console.log(`  Total employees: ${afterStats.total}`);
console.log(`  With company_id: ${afterStats.withCompany} (${((afterStats.withCompany / afterStats.total) * 100).toFixed(1)}%)`);
console.log(`  With factory_id: ${afterStats.withFactory} (${((afterStats.withFactory / afterStats.total) * 100).toFixed(1)}%)`);

db.close();
console.log("\n[migrate-dispatch] Done!");
