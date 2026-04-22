import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Contract } from "@/lib/api";

/* ── Expiry date display with urgency coloring ── */
export function ExpiryDateDisplay({ startDate, endDate }: { startDate?: string; endDate?: string }) {
  if (!startDate || !endDate) return <span className="text-muted-foreground/30">--</span>;

  const daysLeft = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
  const urgency =
    daysLeft < 0
      ? "text-muted-foreground"
      : daysLeft <= 7
      ? "text-[var(--color-status-error)] font-bold"
      : daysLeft <= 30
      ? "text-[var(--color-status-warning)] font-bold"
      : "text-muted-foreground/70";

  return (
    <span className={cn("mono-tabular transition-colors", urgency)}>
      {startDate} ~ {endDate}
      {daysLeft >= 0 && daysLeft <= 30 && (
        <span className="ml-2 text-[10px]">({daysLeft}日)</span>
      )}
    </span>
  );
}

/* ── Employee names (inline, truncated) ── */
export function EmployeeNames({ employees }: { employees?: Contract["employees"] }) {
  if (!employees || employees.length === 0) return null;
  const names = employees
    .map((ce) => {
      if ("employee" in ce && ce.employee) {
        return (ce.employee as { fullName?: string }).fullName;
      }
      return "fullName" in ce ? (ce as { fullName?: string }).fullName : undefined;
    })
    .filter(Boolean) as string[];
  if (names.length === 0) return null;

  const MAX = 4;
  const shown = names.slice(0, MAX);
  const extra = names.length - MAX;

  return (
    <span className="mt-0.5 flex items-center gap-1">
      <Users className="h-3 w-3 shrink-0 text-primary/40" />
      <span className="max-w-[320px] truncate text-[10px] text-primary/60">
        {shown.join("、")}
        {extra > 0 && <span className="text-muted-foreground/40"> +{extra}名</span>}
      </span>
    </span>
  );
}
