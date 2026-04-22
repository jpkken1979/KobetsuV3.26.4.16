/**
 * Business validation rules for factory import.
 * Validates completeness and warns about missing required fields.
 */

import type { NewFactory } from "../../db/schema.js";

/** Warning messages for missing required fields. */
export interface ValidationWarning {
  factoryName: string;
  field: string;
  message: string;
}

/** Runs validation against a single factory record. */
export function validateFactory(
  factoryData: NewFactory,
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const fn = factoryData.factoryName || "?";

  if (!factoryData.supervisorName) {
    warnings.push({ factoryName: fn, field: "supervisorName", message: `${fn}: 指揮命令者氏名が未入力です` });
  }
  if (!factoryData.hakensakiManagerName) {
    warnings.push({ factoryName: fn, field: "hakensakiManagerName", message: `${fn}: 派遣先責任者氏名が未入力です` });
  }
  if (!factoryData.address) {
    warnings.push({ factoryName: fn, field: "address", message: `${fn}: 住所が未入力です` });
  }
  if (!factoryData.workHours) {
    warnings.push({ factoryName: fn, field: "workHours", message: `${fn}: 就業時間が未入力です` });
  }
  if (!factoryData.conflictDate) {
    warnings.push({ factoryName: fn, field: "conflictDate", message: `${fn}: 抵触日が未設定です` });
  }
  if (!factoryData.hourlyRate) {
    warnings.push({ factoryName: fn, field: "hourlyRate", message: `${fn}: 単価が未設定です` });
  }
  if (!factoryData.managerUnsName) {
    warnings.push({ factoryName: fn, field: "managerUnsName", message: `${fn}: 派遣元責任者氏名が未入力です` });
  }
  if (!factoryData.managerUnsPhone) {
    warnings.push({ factoryName: fn, field: "managerUnsPhone", message: `${fn}: 派遣元責任者TELが未入力です` });
  }

  return warnings;
}

/** Checks if a factory can be safely deleted (no employees or contracts). */
export interface DeletionCheck {
  factoryId: number;
  employeeCount: number;
  contractCount: number;
  deletable: boolean;
  reason?: string;
}

/** Maps DIFF_FIELDS used by the diff function. */
export interface DiffFieldSpec {
  key: string;
  excelKey: string;
  label: string;
}

/** Fields compared in the diff display (DB vs Excel). */
export const DIFF_FIELDS: DiffFieldSpec[] = [
  { key: "department", excelKey: "部署", label: "部署" },
  { key: "lineName", excelKey: "ライン名", label: "ライン名" },
  { key: "address", excelKey: "住所", label: "住所" },
  { key: "phone", excelKey: "TEL", label: "TEL" },
  { key: "hakensakiManagerDept", excelKey: "派遣先責任者部署", label: "派遣先責任者 部署" },
  { key: "hakensakiManagerName", excelKey: "派遣先責任者氏名", label: "派遣先責任者 氏名" },
  { key: "hakensakiManagerPhone", excelKey: "派遣先責任者TEL", label: "派遣先責任者 TEL" },
  { key: "hakensakiManagerRole", excelKey: "派遣先責任者役職", label: "派遣先責任者 役職" },
  { key: "supervisorDept", excelKey: "指揮命令者部署", label: "指揮命令者 部署" },
  { key: "supervisorName", excelKey: "指揮命令者氏名", label: "指揮命令者 氏名" },
  { key: "supervisorPhone", excelKey: "指揮命令者TEL", label: "指揮命令者 TEL" },
  { key: "supervisorRole", excelKey: "指揮命令者役職", label: "指揮命令者 役職" },
  { key: "complaintClientDept", excelKey: "苦情処理(派遣先)部署", label: "苦情処理(派遣先) 部署" },
  { key: "complaintClientName", excelKey: "苦情処理(派遣先)氏名", label: "苦情処理(派遣先) 氏名" },
  { key: "complaintClientPhone", excelKey: "苦情処理(派遣先)TEL", label: "苦情処理(派遣先) TEL" },
  { key: "complaintUnsDept", excelKey: "苦情処理(派遣元)部署", label: "苦情処理(派遣元) 部署" },
  { key: "complaintUnsName", excelKey: "苦情処理(派遣元)氏名", label: "苦情処理(派遣元) 氏名" },
  { key: "complaintUnsPhone", excelKey: "苦情処理(派遣元)TEL", label: "苦情処理(派遣元) TEL" },
  { key: "complaintUnsAddress", excelKey: "苦情処理(派遣元)所在地", label: "苦情処理(派遣元) 所在地" },
  { key: "managerUnsDept", excelKey: "派遣元責任者部署", label: "派遣元責任者 部署" },
  { key: "managerUnsName", excelKey: "派遣元責任者氏名", label: "派遣元責任者 氏名" },
  { key: "managerUnsPhone", excelKey: "派遣元責任者TEL", label: "派遣元責任者 TEL" },
  { key: "managerUnsAddress", excelKey: "派遣元責任者所在地", label: "派遣元責任者 所在地" },
  { key: "jobDescription", excelKey: "内容量", label: "内容量" },
  { key: "shiftPattern", excelKey: "シフト", label: "シフト" },
  { key: "workHours", excelKey: "就業時間", label: "就業時間" },
  { key: "workHoursDay", excelKey: "昼勤時間", label: "昼勤時間" },
  { key: "workHoursNight", excelKey: "夜勤時間", label: "夜勤時間" },
  { key: "breakTimeDay", excelKey: "休憩時間", label: "休憩時間" },
  { key: "breakTimeNight", excelKey: "夜勤休憩", label: "夜勤休憩" },
  { key: "breakTime", excelKey: "休憩(分)", label: "休憩(分)" },
  { key: "overtimeHours", excelKey: "時間外", label: "時間外" },
  { key: "overtimeOutsideDays", excelKey: "就業日外労働", label: "就業日外労働" },
  { key: "workDays", excelKey: "就業日", label: "就業日" },
  { key: "hourlyRate", excelKey: "単価", label: "単価" },
  { key: "conflictDate", excelKey: "抵触日", label: "抵触日" },
  { key: "contractPeriod", excelKey: "契約期間", label: "契約期間" },
  { key: "calendar", excelKey: "カレンダー", label: "カレンダー" },
  { key: "closingDayText", excelKey: "締め日テキスト", label: "締め日テキスト" },
  { key: "paymentDayText", excelKey: "支払日テキスト", label: "支払日テキスト" },
  { key: "bankAccount", excelKey: "銀行口座", label: "銀行口座" },
  { key: "timeUnit", excelKey: "時間単位", label: "時間単位" },
  { key: "explainerName", excelKey: "説明者", label: "説明者" },
  { key: "hasRobotTraining", excelKey: "産業用ロボット特別教育", label: "産業用ロボット特別教育" },
];