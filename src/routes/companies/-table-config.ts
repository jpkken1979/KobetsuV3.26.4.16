import { type Factory } from "@/lib/api";
import { appendTeiji } from "@/lib/teiji-utils";

export type CompanyTableCellType = "text" | "number" | "date";

export interface CompanyTableColumn {
  key: string;
  label: string;
  group: string;
  width: number;
  type?: CompanyTableCellType;
  readOnly?: boolean;
  getter: (factory: Factory) => string;
}

export interface CompanyTableColumnGroup {
  label: string;
  color: string;
  headerBg: string;
}

export const COLUMN_GROUPS: Record<string, CompanyTableColumnGroup> = {
  basic: {
    label: "基本情報",
    color: "bg-blue-500/15 text-blue-700 border border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300",
    headerBg: "bg-blue-500/[0.07]",
  },
  hakensakiManager: {
    label: "派遣先責任者",
    color: "bg-indigo-500/15 text-indigo-700 border border-indigo-500/30 dark:bg-indigo-500/20 dark:text-indigo-300",
    headerBg: "bg-indigo-500/[0.07]",
  },
  supervisor: {
    label: "指揮命令者",
    color: "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300",
    headerBg: "bg-emerald-500/[0.07]",
  },
  complaintClient: {
    label: "苦情処理(派遣先)",
    color: "bg-amber-500/15 text-amber-700 border border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300",
    headerBg: "bg-amber-500/[0.07]",
  },
  complaintUns: {
    label: "苦情処理(派遣元)",
    color: "bg-orange-500/15 text-orange-700 border border-orange-500/30 dark:bg-orange-500/20 dark:text-orange-300",
    headerBg: "bg-orange-500/[0.07]",
  },
  managerUns: {
    label: "派遣元責任者",
    color: "bg-purple-500/15 text-purple-700 border border-purple-500/30 dark:bg-purple-500/20 dark:text-purple-300",
    headerBg: "bg-purple-500/[0.07]",
  },
  work: {
    label: "業務・勤務",
    color: "bg-teal-500/15 text-teal-700 border border-teal-500/30 dark:bg-teal-500/20 dark:text-teal-300",
    headerBg: "bg-teal-500/[0.07]",
  },
  contract: {
    label: "契約・支払い",
    color: "bg-rose-500/15 text-rose-700 border border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-300",
    headerBg: "bg-rose-500/[0.07]",
  },
  worker: {
    label: "作業者向け",
    color: "bg-cyan-500/15 text-cyan-700 border border-cyan-500/30 dark:bg-cyan-500/20 dark:text-cyan-300",
    headerBg: "bg-cyan-500/[0.07]",
  },
  legal: {
    label: "法令・協定",
    color: "bg-slate-500/15 text-slate-700 border border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-300",
    headerBg: "bg-slate-500/[0.07]",
  },
};

export const COMPANY_PALETTE = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#a855f7",
  "#ef4444",
  "#06b6d4",
  "#f97316",
  "#14b8a6",
  "#ec4899",
  "#84cc16",
  "#6366f1",
  "#d946ef",
  "#0ea5e9",
  "#f472b6",
];

export const COLUMNS: CompanyTableColumn[] = [
  { key: "companyName", label: "会社名", group: "basic", width: 200, getter: (factory) => factory.company?.name ?? "" },
  { key: "factoryName", label: "工場名", group: "basic", width: 160, getter: (factory) => factory.factoryName ?? "" },
  { key: "department", label: "部署", group: "basic", width: 140, getter: (factory) => factory.department ?? "" },
  { key: "lineName", label: "ライン名", group: "basic", width: 130, getter: (factory) => factory.lineName ?? "" },
  { key: "address", label: "住所", group: "basic", width: 340, getter: (factory) => factory.address ?? "" },
  { key: "phone", label: "TEL", group: "basic", width: 150, getter: (factory) => factory.phone ?? "" },
  { key: "hakensakiManagerDept", label: "部署", group: "hakensakiManager", width: 130, getter: (factory) => factory.hakensakiManagerDept ?? "" },
  { key: "hakensakiManagerName", label: "氏名", group: "hakensakiManager", width: 140, getter: (factory) => factory.hakensakiManagerName ?? "" },
  { key: "hakensakiManagerPhone", label: "TEL", group: "hakensakiManager", width: 150, getter: (factory) => factory.hakensakiManagerPhone ?? "" },
  { key: "supervisorDept", label: "部署", group: "supervisor", width: 130, getter: (factory) => factory.supervisorDept ?? "" },
  { key: "supervisorName", label: "氏名", group: "supervisor", width: 140, getter: (factory) => factory.supervisorName ?? "" },
  { key: "supervisorPhone", label: "TEL", group: "supervisor", width: 150, getter: (factory) => factory.supervisorPhone ?? "" },
  { key: "complaintClientDept", label: "部署", group: "complaintClient", width: 130, getter: (factory) => factory.complaintClientDept ?? "" },
  { key: "complaintClientName", label: "氏名", group: "complaintClient", width: 140, getter: (factory) => factory.complaintClientName ?? "" },
  { key: "complaintClientPhone", label: "TEL", group: "complaintClient", width: 150, getter: (factory) => factory.complaintClientPhone ?? "" },
  { key: "complaintUnsDept", label: "部署", group: "complaintUns", width: 130, getter: (factory) => factory.complaintUnsDept ?? "" },
  { key: "complaintUnsName", label: "氏名", group: "complaintUns", width: 140, getter: (factory) => factory.complaintUnsName ?? "" },
  { key: "complaintUnsPhone", label: "TEL", group: "complaintUns", width: 150, getter: (factory) => factory.complaintUnsPhone ?? "" },
  { key: "managerUnsDept", label: "部署", group: "managerUns", width: 130, getter: (factory) => factory.managerUnsDept ?? "" },
  { key: "managerUnsName", label: "氏名", group: "managerUns", width: 140, getter: (factory) => factory.managerUnsName ?? "" },
  { key: "managerUnsPhone", label: "TEL", group: "managerUns", width: 150, getter: (factory) => factory.managerUnsPhone ?? "" },
  { key: "jobDescription", label: "仕事内容", group: "work", width: 260, getter: (factory) => factory.jobDescription ?? "" },
  { key: "shiftPattern", label: "シフト", group: "work", width: 130, getter: (factory) => factory.shiftPattern ?? "" },
  { key: "workHours", label: "就業時間", group: "work", width: 300, readOnly: true, getter: (factory) => appendTeiji(factory.workHours ?? "", factory.breakTimeDay) },
  { key: "breakTime", label: "休憩時間", group: "work", width: 300, readOnly: true, getter: (factory) => factory.breakTimeDay || (factory.breakTime ? `${factory.breakTime}分` : "") },
  { key: "overtimeHours", label: "時間外", group: "work", width: 160, getter: (factory) => factory.overtimeHours ?? "" },
  { key: "overtimeOutsideDays", label: "就業日外労働", group: "work", width: 160, getter: (factory) => factory.overtimeOutsideDays ?? "" },
  { key: "workDays", label: "就業日", group: "work", width: 160, getter: (factory) => factory.workDays ?? "" },
  { key: "hourlyRate", label: "単価", group: "work", width: 90, type: "number", getter: (factory) => factory.hourlyRate?.toString() ?? "" },
  { key: "conflictDate", label: "抵触日", group: "contract", width: 130, type: "date", getter: (factory) => factory.conflictDate ?? "" },
  {
    key: "contractPeriod",
    label: "契約期間",
    group: "contract",
    width: 120,
    getter: (factory) => {
      const periodMap: Record<string, string> = {
        teishokubi: "抵触日まで",
        "1month": "毎月",
        "3months": "3ヶ月",
        "6months": "6ヶ月",
        "1year": "1年",
      };
      return (factory.contractPeriod ? periodMap[factory.contractPeriod] : null) ?? factory.contractPeriod ?? "";
    },
  },
  { key: "calendar", label: "カレンダー", group: "contract", width: 200, getter: (factory) => factory.calendar ?? "" },
  { key: "closingDay", label: "締め日", group: "contract", width: 80, type: "number", getter: (factory) => factory.closingDay?.toString() ?? "" },
  { key: "closingDayText", label: "締め日テキスト", group: "contract", width: 120, getter: (factory) => factory.closingDayText ?? "" },
  { key: "paymentDay", label: "支払日", group: "contract", width: 80, type: "number", getter: (factory) => factory.paymentDay?.toString() ?? "" },
  { key: "paymentDayText", label: "支払日テキスト", group: "contract", width: 120, getter: (factory) => factory.paymentDayText ?? "" },
  { key: "bankAccount", label: "銀行口座", group: "contract", width: 280, getter: (factory) => factory.bankAccount ?? "" },
  { key: "timeUnit", label: "時間単位", group: "contract", width: 90, getter: (factory) => factory.timeUnit ?? "" },
  { key: "workerClosingDay", label: "作業者締め日", group: "worker", width: 120, getter: (factory) => factory.workerClosingDay ?? "" },
  { key: "workerPaymentDay", label: "作業者支払日", group: "worker", width: 120, getter: (factory) => factory.workerPaymentDay ?? "" },
  { key: "workerCalendar", label: "作業者カレンダー", group: "worker", width: 160, getter: (factory) => factory.workerCalendar ?? "" },
  { key: "agreementPeriodEnd", label: "当該協定期間", group: "legal", width: 180, getter: (factory) => factory.agreementPeriodEnd ?? "" },
  { key: "explainerName", label: "説明者", group: "legal", width: 130, getter: (factory) => factory.explainerName ?? "" },
];

export const STICKY_WIDTH = 360;
export const TOTAL_SCROLL_WIDTH = COLUMNS.slice(2).reduce(
  (sum, column) => sum + column.width,
  0,
);
