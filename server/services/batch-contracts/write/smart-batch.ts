/**
 * Smart-Batch: ejecuta creación a partir de líneas pre-clasificadas
 * (continuation / midHires / future-skip). Reusa `executeByLineCreate`
 * para cada factory para mantener atomicidad y la lógica de agrupación
 * por (rate, startDate, endDate).
 */
import type {
  SmartBatchLine,
  SmartBatchEmployee,
  HiresCreateResult,
} from "../types.js";
import { executeByLineCreate } from "./by-line.js";

export interface SmartBatchCreateResult {
  contracts: HiresCreateResult[];
  contractIds: number[];
  perFactory: Array<{
    factoryId: number;
    factoryName: string | null;
    continuationCount: number;
    midHireCount: number;
    contractsCreated: number;
  }>;
}

/**
 * Toma el resultado de analyzeSmartBatch y crea los contratos correspondientes.
 * Para cada SmartBatchLine, agrupa los empleados elegibles (continuation + midHires)
 * por su contractStartDate individual y delega a executeByLineCreate para reusar
 * la lógica de agrupación por (rate, startDate, endDate) y la transacción atómica.
 *
 * future-skip se ignora silenciosamente — ya quedó visible en el preview.
 */
export function executeSmartBatch(
  lines: SmartBatchLine[],
): SmartBatchCreateResult {
  const allContracts: HiresCreateResult[] = [];
  const allContractIds: number[] = [];
  const perFactory: SmartBatchCreateResult["perFactory"] = [];

  for (const line of lines) {
    const eligible: SmartBatchEmployee[] = [...line.continuation, ...line.midHires];
    if (eligible.length === 0) continue;

    const empInputs = eligible.map((e) => ({
      employeeId: e.id,
      startDate: e.contractStartDate,
      endDate: e.contractEndDate,
    }));

    const result = executeByLineCreate({
      companyId: line.factory.companyId,
      factoryId: line.factory.id,
      employees: empInputs,
    });

    allContracts.push(...result.contracts);
    allContractIds.push(...result.contracts.map((c) => c.id));
    perFactory.push({
      factoryId: line.factory.id,
      factoryName: line.factory.factoryName,
      continuationCount: line.continuation.length,
      midHireCount: line.midHires.length,
      contractsCreated: result.contracts.length,
    });
  }

  return { contracts: allContracts, contractIds: allContractIds, perFactory };
}
