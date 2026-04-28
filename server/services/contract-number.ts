import { db } from "../db/index.js";
import { contracts } from "../db/schema.js";
import { like, desc } from "drizzle-orm";

/**
 * Genera un número de contrato único: KOB-YYYYMM-XXXX
 * El contador XXXX se auto-incrementa basado en el máximo existente para ese mes.
 *
 * INVARIANTE CRÍTICO (B-2, audit 2026-04-28):
 *   Toda llamada a esta función debe estar envuelta en `sqlite.transaction(() => ...)`
 *   junto con el INSERT que la consume. better-sqlite3 serializa transactions
 *   en un único proceso, garantizando que el SELECT max + INSERT son atómicos.
 *
 *   Si en el futuro se escala a múltiples procesos o se inserta fuera de
 *   transacción, se requiere un schema con sequence dedicada (p.ej. tabla
 *   `contract_counters` con UPDATE atómico) para evitar colisiones en el
 *   índice único de `contracts.contract_number`.
 *
 *   Llamadores actuales auditados (todos dentro de transaction):
 *     - server/routes/contracts.ts (POST /contracts)
 *     - server/services/batch-contracts/write.ts (5 call sites)
 *     - server/routes/documents-generate-batch-ids.ts
 */
export function generateContractNumber(startDate: string): string {
  // Parse as local date to avoid UTC timezone offset issues
  const [y, m] = startDate.split("-").map(Number);
  const year = y;
  const month = String(m).padStart(2, "0");
  const prefix = `KOB-${year}${month}`;

  // Find the latest contract number for this month
  const latest = db
    .select({ contractNumber: contracts.contractNumber })
    .from(contracts)
    .where(like(contracts.contractNumber, `${prefix}-%`))
    .orderBy(desc(contracts.contractNumber))
    .limit(1)
    .get();

  let nextSeq = 1;
  if (latest) {
    const lastSeq = parseInt(latest.contractNumber.split("-")[2] ?? "0", 10);
    nextSeq = Number.isNaN(lastSeq) ? 1 : lastSeq + 1;
  }

  return `${prefix}-${String(nextSeq).padStart(4, "0")}`;
}
