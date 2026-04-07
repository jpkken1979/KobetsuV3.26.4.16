import type { ComponentType } from "react";
import { Building2, Clock, CreditCard, MapPin, Users } from "lucide-react";

export const AVATAR_COLORS = [
  { bg: "bg-blue-500", ring: "ring-blue-500/20", glow: "shadow-blue-500/10" },
  { bg: "bg-blue-500", ring: "ring-blue-500/20", glow: "shadow-blue-500/10" },
  { bg: "bg-emerald-500", ring: "ring-emerald-500/20", glow: "shadow-emerald-500/10" },
  { bg: "bg-amber-500", ring: "ring-amber-500/20", glow: "shadow-amber-500/10" },
  { bg: "bg-rose-500", ring: "ring-rose-500/20", glow: "shadow-rose-500/10" },
  { bg: "bg-cyan-500", ring: "ring-cyan-500/20", glow: "shadow-cyan-500/10" },
  { bg: "bg-orange-500", ring: "ring-orange-500/20", glow: "shadow-orange-500/10" },
  { bg: "bg-teal-500", ring: "ring-teal-500/20", glow: "shadow-teal-500/10" },
  { bg: "bg-cyan-500", ring: "ring-cyan-500/20", glow: "shadow-cyan-500/10" },
  { bg: "bg-pink-500", ring: "ring-pink-500/20", glow: "shadow-pink-500/10" },
  { bg: "bg-lime-600", ring: "ring-lime-600/20", glow: "shadow-lime-600/10" },
  { bg: "bg-fuchsia-500", ring: "ring-fuchsia-500/20", glow: "shadow-fuchsia-500/10" },
  { bg: "bg-sky-500", ring: "ring-sky-500/20", glow: "shadow-sky-500/10" },
  { bg: "bg-red-500", ring: "ring-red-500/20", glow: "shadow-red-500/10" },
];

export const INPUT_CLS =
  "w-full rounded-lg border border-input/80 bg-background px-3 py-2 text-sm shadow-xs transition-all focus:border-primary/30 focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10";
export const INPUT_SM_CLS =
  "w-full rounded-lg border border-input/80 bg-background px-2 py-1.5 text-xs shadow-xs transition-all focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10";

export type WizardStep = "identity" | "location" | "work" | "personnel" | "contract";

export const WIZARD_STEPS: { id: WizardStep; label: string; labelShort: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "identity", label: "識別", labelShort: "識別", icon: Building2 },
  { id: "location", label: "所在地・仕事", labelShort: "所在地", icon: MapPin },
  { id: "work", label: "勤務条件", labelShort: "勤務", icon: Clock },
  { id: "personnel", label: "担当者", labelShort: "担当者", icon: Users },
  { id: "contract", label: "契約・支払", labelShort: "契約", icon: CreditCard },
];

export interface PersonnelRole {
  label: string;
  nameKey: string;
  deptKey: string;
  phoneKey: string;
}

export const CLIENT_ROLES: PersonnelRole[] = [
  { label: "派遣先責任者", nameKey: "hakensakiManagerName", deptKey: "hakensakiManagerDept", phoneKey: "hakensakiManagerPhone" },
  { label: "指揮命令者", nameKey: "supervisorName", deptKey: "supervisorDept", phoneKey: "supervisorPhone" },
  { label: "苦情処理", nameKey: "complaintClientName", deptKey: "complaintClientDept", phoneKey: "complaintClientPhone" },
];

export const UNS_ROLES: PersonnelRole[] = [
  { label: "派遣元責任者", nameKey: "managerUnsName", deptKey: "managerUnsDept", phoneKey: "managerUnsPhone" },
  { label: "苦情処理", nameKey: "complaintUnsName", deptKey: "complaintUnsDept", phoneKey: "complaintUnsPhone" },
];

export const BULK_FIELDS = [
  { key: "address", label: "住所", type: "text" },
  { key: "phone", label: "電話番号", type: "text" },
  { key: "conflictDate", label: "抵触日", type: "date" },
  { key: "contractPeriod", label: "契約期間", type: "select" },
  { key: "calendar", label: "カレンダー", type: "textarea" },
  { key: "closingDayText", label: "締め日", type: "text" },
  { key: "paymentDayText", label: "支払日", type: "text" },
  { key: "supervisorName", label: "指揮命令者（氏名）", type: "text" },
  { key: "supervisorDept", label: "指揮命令者（部署）", type: "text" },
  { key: "supervisorPhone", label: "指揮命令者（電話）", type: "text" },
] as const;

export type FormValue = string | number | boolean | null | undefined;

export function getCompanyInitial(name: string): string {
  return name.charAt(0);
}

export function getConflictDateStatus(
  conflictDate: string | null,
  warningDays: number,
): {
  tone: "normal" | "warning" | "expired";
  label: string;
} {
  if (!conflictDate) {
    return { tone: "normal", label: "未設定" };
  }

  const target = new Date(`${conflictDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) {
    return { tone: "warning", label: "日付確認" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { tone: "expired", label: "期限切れ" };
  if (diffDays <= warningDays) return { tone: "warning", label: "注意" };
  return { tone: "normal", label: "正常" };
}

export function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  span,
}: {
  label: string;
  value: FormValue;
  onChange: (val: string | number | null) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  span?: number;
}) {
  return (
    <div className={span === 2 ? "md:col-span-2" : span === 3 ? "md:col-span-3" : ""}>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        type={type}
        value={typeof value === "boolean" ? "" : (value ?? "")}
        onChange={(e) =>
          onChange(type === "number" ? (e.target.value ? Number(e.target.value) : null) : e.target.value || null)
        }
        className={INPUT_CLS}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
  placeholder = "未設定",
}: {
  label: string;
  value: FormValue;
  onChange: (val: string | number | null) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <select
        value={typeof value === "boolean" ? "" : (value ?? "")}
        onChange={(e) => onChange(e.target.value || null)}
        className={INPUT_CLS}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
