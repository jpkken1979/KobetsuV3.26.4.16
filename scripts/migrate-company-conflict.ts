import Database from "better-sqlite3";

const db = new Database("data/kobetsu.db");

try {
  db.exec(`ALTER TABLE client_companies ADD COLUMN conflict_date TEXT`);
  console.log("Added conflict_date column");
} catch (e: unknown) {
  if (e instanceof Error && e.message.includes("duplicate column name")) {
    console.log("conflict_date already exists, skipping");
  } else throw e;
}

try {
  db.exec(`ALTER TABLE client_companies ADD COLUMN contract_period INTEGER`);
  console.log("Added contract_period column");
} catch (e: unknown) {
  if (e instanceof Error && e.message.includes("duplicate column name")) {
    console.log("contract_period already exists, skipping");
  } else throw e;
}

console.log("Migration complete.");
db.close();
