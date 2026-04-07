export const COMPLETENESS_CONFIG = {
  green: { label: "準備完了", dotClass: "bg-green-500", badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  yellow: { label: "一部不足", dotClass: "bg-amber-500", badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  red: { label: "データ不足", dotClass: "bg-red-500", badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  gray: { label: "未配属", dotClass: "bg-gray-400", badgeClass: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400" },
} as const;

export type CompletenessLevel = keyof typeof COMPLETENESS_CONFIG;

export const FIELD_LABELS: Record<string, string> = {
  // Employee fields
  fullName: "氏名",
  katakanaName: "カナ",
  nationality: "国籍",
  gender: "性別",
  birthDate: "生年月日",
  hireDate: "入社日",
  "billingRate|hourlyRate": "単価/時給",
  // Factory fields
  address: "住所",
  phone: "TEL",
  jobDescription: "仕事内容",
  supervisorName: "指揮命令者",
  supervisorDept: "指揮命令者部署",
  supervisorPhone: "指揮命令者TEL",
  hakensakiManagerName: "派遣先責任者",
  hakensakiManagerDept: "派遣先責任者部署",
  hakensakiManagerPhone: "派遣先責任者TEL",
  managerUnsName: "派遣元責任者",
  managerUnsDept: "派遣元責任者部署",
  managerUnsPhone: "派遣元責任者TEL",
  complaintClientName: "苦情処理(派遣先)",
  complaintClientDept: "苦情処理(派遣先)部署",
  complaintClientPhone: "苦情処理(派遣先)TEL",
  complaintUnsName: "苦情処理(派遣元)",
  complaintUnsDept: "苦情処理(派遣元)部署",
  complaintUnsPhone: "苦情処理(派遣元)TEL",
  workHours: "就業時間",
  breakTimeDay: "休憩時間",
  conflictDate: "抵触日",
  closingDayText: "締め日",
  paymentDayText: "支払日",
  calendar: "カレンダー",
};
