import { db } from "../db/index.js";
import { contracts } from "../db/schema.js";
import { like, desc } from "drizzle-orm";

/**
 * Genera un número de contrato único: KOB-YYYYMM-XXXX
 * El contador XXXX se auto-incrementa basado en el máximo existente para ese mes.
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
