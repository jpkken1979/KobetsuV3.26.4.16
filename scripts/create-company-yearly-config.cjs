// Script: crea la tabla company_yearly_config en SQLite
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(process.cwd(), 'data/kobetsu.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS company_yearly_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL REFERENCES client_companies(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    kyujitsu_text TEXT,
    kyuukashori TEXT,
    hakensaki_manager_name TEXT,
    hakensaki_manager_dept TEXT,
    hakensaki_manager_role TEXT,
    hakensaki_manager_phone TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(company_id, fiscal_year)
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_cyc_company ON company_yearly_config(company_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_cyc_fiscal_year ON company_yearly_config(fiscal_year)`);

console.log('company_yearly_config table created successfully');
db.close();
