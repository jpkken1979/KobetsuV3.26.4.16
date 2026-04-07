/**
 * Migration: Update factory and company addresses with verified real data from web research.
 * Run: npx tsx server/db/migrate-addresses.ts
 */
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve("data/kobetsu.db");
const db = new Database(dbPath);

console.log("Starting address migration...\n");

// ── 1. Update company shortNames ──
const companyShortNames: Record<string, string> = {
  "高雄工業株式会社": "高雄工業",
  "加藤木材工業株式会社": "加藤木材工業",
  "瑞陵精機株式会社": "瑞陵精機",
  "株式会社川原鉄工所": "川原鉄工所",
  "六甲電子株式会社": "六甲電子",
  "株式会社オーツカ": "オーツカ",
  "ピーエムアイ有限会社": "ピーエムアイ",
  "三幸技研株式会社": "三幸技研",
  "アサヒフォージ株式会社": "アサヒフォージ",
  "ユアサ工機株式会社": "ユアサ工機",
  "株式会社美鈴工業": "美鈴工業",
  "セイビテック株式会社": "セイビテック",
};

const updateShortName = db.prepare(
  "UPDATE client_companies SET short_name = ? WHERE name = ? AND (short_name IS NULL OR short_name = '')"
);

let companyUpdates = 0;
for (const [name, shortName] of Object.entries(companyShortNames)) {
  const result = updateShortName.run(shortName, name);
  if (result.changes > 0) {
    console.log(`  Company shortName: ${name} -> ${shortName}`);
    companyUpdates++;
  }
}
console.log(`Updated ${companyUpdates} company shortNames\n`);

// ── 2. Update factory addresses with real data ──
interface FactoryAddress {
  address: string;
  phone?: string;
}

const factoryAddresses: Record<string, FactoryAddress> = {
  // 高雄工業
  "高雄工業株式会社|本社工場": {
    address: "〒498-0066 愛知県弥富市楠三丁目13番地2",
    phone: "0567-68-8110",
  },
  "高雄工業株式会社|海南第一工場": {
    address: "〒490-1402 愛知県弥富市五斗山三丁目22番地",
    phone: "0567-56-6681",
  },
  "高雄工業株式会社|海南第二工場": {
    address: "〒490-1402 愛知県弥富市五斗山三丁目22番地",
    phone: "0567-56-6681",
  },
  "高雄工業株式会社|第一工場": {
    address: "〒437-0066 静岡県袋井市山科2315番地1",
    phone: "0538-48-5080",
  },
  "高雄工業株式会社|第二工場": {
    address: "〒437-0066 静岡県袋井市山科2315番地1",
    phone: "0538-48-5080",
  },
  "高雄工業株式会社|CVJ工場": {
    address: "〒709-2105 岡山県岡山市北区御津伊田1028番19",
    phone: "086-724-5330",
  },
  "高雄工業株式会社|HUB工場": {
    address: "〒709-2105 岡山県岡山市北区御津伊田1028番19",
    phone: "086-724-5330",
  },
  // 加藤木材工業
  "加藤木材工業株式会社|本社工場": {
    address: "〒486-0902 愛知県春日井市新開町字平渕6",
    phone: "(0568)36-2931",
  },
  "加藤木材工業株式会社|春日井工場": {
    address: "〒486-0801 愛知県春日井市上田楽町川原先2466-1",
    phone: "(0568)82-0005",
  },
  // Otros
  "株式会社オーツカ|関ケ原工場": {
    address: "〒503-1543 岐阜県不破郡関ヶ原町大字今須3200番地",
    phone: "(0584)43-5121",
  },
  "ユアサ工機株式会社|新城工場": {
    address: "〒709-2121 岡山県岡山市北区御津矢原450-2",
    phone: "086-724-9337",
  },
  "アサヒフォージ株式会社|真庭工場": {
    address: "〒719-3121 岡山県真庭市上河内3828-9",
    phone: "0867-42-8786",
  },
};

// Get all factories with their company names
type FactoryRow = {
  id: number;
  factory_name: string;
  address: string | null;
  phone: string | null;
  company_name: string;
};

const allFactories = db
  .prepare(
    `SELECT f.id, f.factory_name, f.address, f.phone, c.name as company_name
     FROM factories f
     JOIN client_companies c ON f.company_id = c.id`
  )
  .all() as FactoryRow[];

const updateFactory = db.prepare(
  "UPDATE factories SET address = ?, phone = COALESCE(phone, ?) WHERE id = ?"
);

let factoryUpdates = 0;
for (const f of allFactories) {
  const key = `${f.company_name}|${f.factory_name}`;
  if (factoryAddresses[key]) {
    const real = factoryAddresses[key];
    updateFactory.run(real.address, real.phone || null, f.id);
    factoryUpdates++;
  }
}
console.log(`Updated ${factoryUpdates} factory addresses\n`);

console.log("Address migration complete!");
db.close();
