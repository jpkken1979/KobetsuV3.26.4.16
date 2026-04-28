import { Calendar } from "lucide-react";
import type { Employee } from "@/lib/api";

type EmployeeWithRate = Employee & { displayRate?: number | null };

interface EmployeeCheckRowProps {
  emp: EmployeeWithRate;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  showHireDateAsStart?: boolean;
}

function formatJpDate(iso: string | null | undefined): string {
  if (!iso) return "--";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[0]}/${parts[1]}/${parts[2]}`;
}

export function EmployeeCheckRow({
  emp,
  checked,
  onToggle,
  showHireDateAsStart = false,
}: EmployeeCheckRowProps) {
  const status = emp.status ?? "active";
  const isRetired = status === "inactive";
  const isOnLeave = status === "onLeave";

  return (
    <label className="flex items-center gap-3 cursor-pointer rounded-md px-2 py-1 hover:bg-muted/40 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
        className="h-4 w-4 rounded border-border text-primary"
      />
      <span className={isRetired ? "text-muted-foreground" : ""}>{emp.fullName}</span>
      <span className="text-muted-foreground text-sm">{emp.employeeNumber}</span>
      {isRetired && (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
          退職
        </span>
      )}
      {isOnLeave && (
        <span className="rounded-full bg-[var(--color-status-warning-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-status-warning)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-status-warning)_30%,transparent)]">
          休職
        </span>
      )}
      {showHireDateAsStart && emp.hireDate && (
        <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-[var(--color-status-warning-muted)] px-2 py-0.5 text-[11px] font-mono tabular-nums text-[var(--color-status-warning)]">
          <Calendar className="h-3 w-3" />
          契約開始 {formatJpDate(emp.hireDate)}
        </span>
      )}
      {!showHireDateAsStart && emp.hireDate && (
        <span className="ml-auto font-mono tabular-nums text-[10px] text-muted-foreground/70">
          入社 {formatJpDate(emp.hireDate)}
        </span>
      )}
    </label>
  );
}