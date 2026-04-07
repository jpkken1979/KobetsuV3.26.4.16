// Helper functions that build PDF data objects from common data + contract info.
// Extracted from documents-generate.ts to reduce route file size.

import type { KobetsuData } from "../pdf/kobetsu-pdf.js";
import type { TsuchishoData } from "../pdf/tsuchisho-pdf.js";
import type { DaichoData } from "../pdf/hakensakikanridaicho-pdf.js";
import type { HakenmotoDaichoData } from "../pdf/hakenmotokanridaicho-pdf.js";
import type { KoritsuKobetsuData } from "../pdf/koritsu-kobetsu-pdf.js";
import type { KoritsuDaichoData } from "../pdf/koritsu-hakensakidaicho-pdf.js";
import type { KoritsuTsuchishoData } from "../pdf/koritsu-tsuchisho-pdf.js";
import type { PDFEmployeeData } from "./employee-mapper.js";
import type { buildCommonData, getContractData } from "./document-generation.js";

/** The return type of buildCommonData */
export type CommonData = ReturnType<typeof buildCommonData>;

/** The full contract record with relations (from getContractData) */
type ContractWithRelations = NonNullable<Awaited<ReturnType<typeof getContractData>>>;

// ─── Koritsu data builders ──────────────────────────────────────────

/** Build KoritsuKobetsuData from common data + contract metadata */
export function buildKoritsuKobetsuData(
  common: CommonData,
  contract: ContractWithRelations,
  empList: PDFEmployeeData[],
): KoritsuKobetsuData {
  return {
    companyName: common.companyName,
    companyAddress: common.companyAddress,
    companyPhone: common.companyPhone,
    factoryName: common.factoryName,
    factoryAddress: common.factoryAddress,
    factoryPhone: common.factoryPhone,
    department: common.department,
    lineName: common.lineName,
    commanderDept: common.supervisorDept,
    commanderName: common.supervisorName,
    commanderTitle: common.supervisorRole,
    commanderPhone: common.supervisorPhone,
    hakensakiManagerDept: common.hakensakiManagerDept,
    hakensakiManagerTitle: common.hakensakiManagerRole,
    hakensakiManagerName: common.hakensakiManagerName,
    hakensakiManagerPhone: common.hakensakiManagerPhone,
    managerUnsAddress: common.managerUnsAddress,
    managerUnsDept: common.managerUnsDept,
    managerUnsTitle: "",
    managerUnsName: common.managerUnsName,
    managerUnsPhone: common.managerUnsPhone,
    complaintClientDept: common.complaintClientDept,
    complaintClientTitle: "",
    complaintClientName: common.complaintClientName,
    complaintClientPhone: common.complaintClientPhone,
    complaintUnsDept: common.complaintUnsDept,
    complaintUnsTitle: "",
    complaintUnsName: common.complaintUnsName,
    complaintUnsPhone: common.complaintUnsPhone,
    contractNumber: contract.contractNumber,
    jobDescription: common.jobDescription,
    startDate: common.startDate,
    endDate: common.endDate,
    conflictDate: common.conflictDate,
    contractDate: common.contractDate,
    employeeCount: empList.length,
    hourlyRate: common.hourlyRate,
    closingDay: common.closingDay,
    paymentDay: common.paymentDay,
  };
}

/** Build KoritsuTsuchishoData from common data + contract */
export function buildKoritsuTsuchishoData(
  common: CommonData,
  contract: ContractWithRelations,
  empList: PDFEmployeeData[],
): KoritsuTsuchishoData {
  return {
    companyName: common.companyName,
    contractNumber: contract.contractNumber,
    contractDate: common.contractDate,
    startDate: common.startDate,
    endDate: common.endDate,
    managerUnsAddress: common.managerUnsAddress,
    employees: empList,
  };
}

/** Build KoritsuDaichoData for a single employee (generates one page per call) */
export function buildKoritsuDaichoData(
  common: CommonData,
  contract: ContractWithRelations,
  empList: PDFEmployeeData[],
  currentEmp: PDFEmployeeData,
): KoritsuDaichoData {
  return {
    companyName: common.companyName,
    factoryName: common.factoryName,
    factoryAddress: common.factoryAddress,
    factoryPhone: common.factoryPhone,
    department: common.department,
    lineName: common.lineName,
    contractNumber: contract.contractNumber,
    contractDate: common.contractDate,
    startDate: common.startDate,
    endDate: common.endDate,
    jobDescription: common.jobDescription,
    hakensakiManagerDept: common.hakensakiManagerDept,
    hakensakiManagerTitle: common.hakensakiManagerRole,
    hakensakiManagerName: common.hakensakiManagerName,
    hakensakiManagerPhone: common.hakensakiManagerPhone,
    managerUnsAddress: common.managerUnsAddress,
    managerUnsDept: common.managerUnsDept,
    managerUnsName: common.managerUnsName,
    managerUnsPhone: common.managerUnsPhone,
    employees: empList.map((e) => ({
      ...e,
      isFirstContract: Boolean(currentEmp === e),
    })),
  };
}

// ─── Standard data builders ─────────────────────────────────────────

/** Build KobetsuData for standard (non-Koritsu) companies */
export function buildStandardKobetsuData(
  common: CommonData,
  contract: ContractWithRelations,
  empList: PDFEmployeeData[],
): KobetsuData {
  return {
    ...common,
    employeeCount: empList.length,
    responsibilityLevel: contract.responsibilityLevel || "",
    overtimeOutsideDays: contract.factory.overtimeOutsideDays || "1ヶ月に2日の範囲内で命ずることがある。",
    isKyoteiTaisho: contract.isKyoteiTaisho !== false,
    welfare: contract.welfare || "",
  };
}

/** Build TsuchishoData for standard companies */
export function buildStandardTsuchishoData(
  common: CommonData,
  empList: PDFEmployeeData[],
): TsuchishoData {
  return {
    companyName: common.companyName,
    contractDate: common.contractDate,
    startDate: common.startDate,
    endDate: common.endDate,
    employees: empList,
  };
}

/** Build DaichoData for a single employee (standard 派遣先管理台帳) */
export function buildStandardDaichoData(
  common: CommonData,
  emp: PDFEmployeeData,
): DaichoData {
  return {
    ...common,
    commanderDept: common.supervisorDept,
    commanderName: common.supervisorName,
    commanderPhone: common.supervisorPhone,
    hakensakiManagerDept: common.hakensakiManagerDept,
    hakensakiManagerName: common.hakensakiManagerName,
    hakensakiManagerPhone: common.hakensakiManagerPhone,
    employee: emp,
  };
}

/** Build HakenmotoDaichoData for a single employee (派遣元管理台帳) */
export function buildHakenmotoDaichoData(
  common: CommonData,
  emp: PDFEmployeeData,
): HakenmotoDaichoData {
  return {
    ...common,
    employee: emp,
  };
}
