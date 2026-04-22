import { useContractFormStore } from "@/stores/contract-form";
import { useCallback, useEffect, useMemo } from "react";
import { Calendar, ArrowRight, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PERIOD_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";

/**
 * Subtract N business days (skip Sat/Sun) -- mirrors server logic.
 */
function subtractBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) remaining--;
  }
  return result;
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Calculate end date based on start date and contract period.
 * "teishokubi" → use conflictDate directly.
 * Others → last day of the target month, capped by conflictDate.
 */
function calcEndDateFromPeriod(startDate: string, period: string, conflictDate?: string): string {
  // 抵触日まで: end date = conflictDate itself
  if (period === "teishokubi") {
    if (conflictDate) return conflictDate;
    // Fallback if no conflictDate set: end of next month
    const start = new Date(startDate);
    return formatDateStr(new Date(start.getFullYear(), start.getMonth() + 2, 0));
  }

  const start = new Date(startDate);
  let monthsToAdd = 1;
  if (period === "3months") monthsToAdd = 3;
  else if (period === "6months") monthsToAdd = 6;
  else if (period === "1year") monthsToAdd = 12;

  // End of the month that is N months from start
  const endOfMonth = new Date(
    start.getFullYear(),
    start.getMonth() + monthsToAdd,
    0
  );
  return formatDateStr(endOfMonth);
}

export function DateCalculator() {
  const { data, updateField, updateFields, nextStep, prevStep } =
    useContractFormStore();

  const conflictDate = data.factoryConflictDate;
  const contractPeriod = data.factoryContractPeriod;

  const datePresets = useMemo(() => {
    const today = new Date();
    const nextMonth1st = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const monthAfter1st = new Date(today.getFullYear(), today.getMonth() + 2, 1);
    return [
      { label: "来月1日", date: formatDateStr(nextMonth1st) },
      { label: "翌々月1日", date: formatDateStr(monthAfter1st) },
    ];
  }, []);

  // End date presets — computed from current startDate (no conflictDate cap)
  const endDatePresets = useMemo(() => {
    if (!data.startDate) return [];
    return [
      { label: "+1ヶ月", period: "1month" },
      { label: "+3ヶ月", period: "3months" },
      { label: "+6ヶ月", period: "6months" },
      { label: "+1年",   period: "1year" },
    ].map(({ label, period }) => ({
      label,
      date: calcEndDateFromPeriod(data.startDate, period),
    }));
  }, [data.startDate]);

  // Check if endDate exceeds conflictDate
  const exceedsConflictDate = useMemo(() => {
    if (!data.endDate || !conflictDate) return false;
    return data.endDate > conflictDate;
  }, [data.endDate, conflictDate]);

  const handleStartDateChange = useCallback(
    (startDate: string) => {
      updateField("startDate", startDate);

      if (startDate) {
        const start = new Date(startDate);
        const contractDateCalc = subtractBusinessDays(start, 2);
        const notificationDate = subtractBusinessDays(start, 3);

        updateFields({
          contractDate: formatDateStr(contractDateCalc),
          notificationDate: formatDateStr(notificationDate),
        });

        // Auto-calculate endDate based on contractPeriod
        let candidateEnd: string;
        if (contractPeriod) {
          candidateEnd = calcEndDateFromPeriod(startDate, contractPeriod, conflictDate);
        } else {
          // Default: end of next month
          candidateEnd = formatDateStr(
            new Date(start.getFullYear(), start.getMonth() + 2, 0)
          );
        }

        // Cap at conflictDate if it exists
        if (conflictDate && candidateEnd > conflictDate) {
          candidateEnd = conflictDate;
        }

        updateField("endDate", candidateEnd);
      }
    },
    [updateField, updateFields, contractPeriod, conflictDate]
  );

  const handleEndDateChange = useCallback(
    (endDate: string) => {
      updateField("endDate", endDate);
    },
    [updateField]
  );

  // Recalculate endDate when factoryContractPeriod or factoryConflictDate changes (e.g. user goes back to Step 1 and picks a different factory)
  useEffect(() => {
    if (data.startDate && data.factoryContractPeriod) {
      let newEnd = calcEndDateFromPeriod(data.startDate, data.factoryContractPeriod, data.factoryConflictDate ?? undefined);
      if (data.factoryConflictDate && newEnd > data.factoryConflictDate) {
        newEnd = data.factoryConflictDate;
      }
      if (newEnd && newEnd !== data.endDate) {
        updateField("endDate", newEnd);
      }
    }
  }, [data.factoryContractPeriod, data.factoryConflictDate]); // intentional: only re-run when factory period/conflict date change

  const canProceed = data.startDate && data.endDate && data.contractDate;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">契約期間の設定</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          開始日を入力すると、契約日と通知日が自動計算されます
        </p>
      </div>

      {/* Date inputs */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="start-date" className="mb-1.5 block text-sm font-medium">
            派遣開始日 <span className="text-destructive">*</span>
          </label>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground/60">クイック選択:</span>
            {datePresets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleStartDateChange(p.date)}
                className="rounded-lg border border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <input
              id="start-date"
              type="date"
              value={data.startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              aria-required="true"
              className="w-full rounded-lg border border-input/80 bg-background px-3 py-2.5 pr-10 text-sm shadow-xs transition-all focus:border-primary/30 focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
            />
            <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
          </div>
        </div>
        <div>
          <label htmlFor="end-date" className="mb-1.5 block text-sm font-medium">
            派遣終了日 <span className="text-destructive">*</span>
          </label>
          {endDatePresets.length > 0 && (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs text-muted-foreground/60">クイック選択:</span>
              {endDatePresets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleEndDateChange(p.date)}
                  className={cn(
                    "rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
                    data.endDate === p.date
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <div className="relative">
            <input
              id="end-date"
              type="date"
              value={data.endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              min={data.startDate}
              aria-required="true"
              aria-invalid={exceedsConflictDate ? "true" : undefined}
              aria-describedby={exceedsConflictDate ? "end-date-error" : undefined}
              className={cn(
                "w-full rounded-lg border bg-background px-3 py-2.5 pr-10 text-sm shadow-xs transition-all focus:shadow-sm focus:outline-none focus:ring-2",
                exceedsConflictDate
                  ? "border-[var(--color-status-error)] focus:border-[var(--color-status-error)] focus:ring-[color-mix(in_srgb,var(--color-status-error)_20%,transparent)]"
                  : "border-input/80 focus:border-primary/30 focus:ring-primary/10"
              )}
            />
            <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
          </div>
        </div>
      </div>

      {/* Factory contract settings info */}
      {(conflictDate || contractPeriod) && (
        <div className="rounded-md border border-[color-mix(in_srgb,var(--color-status-info)_25%,transparent)] bg-[var(--color-status-info-muted)] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-status-info)]">
            <Info className="h-4 w-4" />
            工場の契約設定
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--color-status-info)]">
            {conflictDate && <span>抵触日: {conflictDate}</span>}
            {contractPeriod && <span>契約期間: {PERIOD_LABELS[contractPeriod] || contractPeriod}</span>}
          </div>
        </div>
      )}

      {/* Auto-calculated dates */}
      {data.startDate && (
        <div className="rounded-lg border border-primary/20 bg-primary/[0.06] p-4 dark:bg-primary/[0.08]">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="rounded-md bg-primary/10 p-1.5">
              <Info className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">
              自動計算された日付
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-white p-4 shadow-xs dark:bg-card">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground/60" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  契約締結日
                </span>
              </div>
              <p className="mono-tabular mt-2 text-sm font-semibold text-primary">
                {data.contractDate}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                開始日の2営業日前
              </p>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-xs dark:bg-card">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground/60" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  通知日
                </span>
              </div>
              <p className="mono-tabular mt-2 text-sm font-semibold text-primary">
                {data.notificationDate}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                開始日の3営業日前
              </p>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-xs dark:bg-card">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-muted-foreground/60" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  契約期間
                </span>
              </div>
              <p className="mono-tabular mt-2 text-sm font-semibold text-primary">
                {data.endDate
                  ? `${Math.ceil(
                      (new Date(data.endDate).getTime() -
                        new Date(data.startDate).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )}日間`
                  : "--"}
              </p>
              <p className="mono-tabular mt-1 text-[11px] text-muted-foreground">
                {data.startDate} ~ {data.endDate}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Warning: endDate exceeds conflictDate */}
      {exceedsConflictDate && (
        <div id="end-date-error" role="alert" aria-live="polite" className="rounded-md border border-[color-mix(in_srgb,var(--color-status-error)_25%,transparent)] bg-[var(--color-status-error-muted)] p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--color-status-error)]" />
            <div className="flex-1 text-sm">
              <p className="font-semibold text-[var(--color-status-error)]">終了日が抵触日（{conflictDate}）を超えています</p>
              <p className="mt-0.5 text-[0.6875rem] text-foreground/70">
                派遣法により、抵触日を超える契約は締結できません。終了日を修正してください。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" size="lg" onClick={prevStep}>
          戻る
        </Button>
        <Button
          size="lg"
          onClick={nextStep}
          disabled={!canProceed}
        >
          次へ: 就業条件
        </Button>
      </div>
    </div>
  );
}
