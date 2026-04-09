import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import type { MidHiresPreviewLine, MidHiresRateGroup, MidHiresPreviewEmployee } from "@/lib/api-types";

interface Props {
  lines: MidHiresPreviewLine[];
  skipped: Array<{ factoryName: string; lineName?: string; reason: string }>;
  conflictDateOverrides: Record<string, string>;
  onConflictDateOverride: (factoryId: string, date: string) => void;
  excludedFactoryIds: Set<number>;
  onToggleFactory: (factoryId: number) => void;
  totalContracts: number;
  totalEmployees: number;
}

export function MidHiresPreview({
  lines,
  skipped,
  conflictDateOverrides,
  onConflictDateOverride,
  excludedFactoryIds,
  onToggleFactory,
  totalContracts,
  totalEmployees,
}: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(lines.map((l) => [l.factoryId, true]))
  );

  const toggleExpand = (factoryId: number) =>
    setExpanded((prev) => ({ ...prev, [factoryId]: !prev[factoryId] }));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-2 text-sm">
        <span className="text-muted-foreground">
          対象:{" "}
          <span className="font-semibold text-foreground">{totalEmployees}名</span>
          {" · "}
          <span className="font-semibold text-foreground">{totalContracts}件</span>
          の契約
        </span>
        <span className="text-xs text-muted-foreground">{lines.length}ライン</span>
      </div>

      {/* Factory/line cards */}
      <div className="space-y-2">
        {lines.map((line) => {
          const isExcluded = excludedFactoryIds.has(line.factoryId);
          const effectiveDate =
            conflictDateOverrides[String(line.factoryId)] ?? line.effectiveConflictDate;
          const isOpen = expanded[line.factoryId] ?? true;
          const label = [line.factoryName, line.department, line.lineName]
            .filter(Boolean)
            .join(" › ");

          return (
            <div
              key={line.factoryId}
              className={cn(
                "overflow-hidden rounded-xl border border-border/60 bg-card transition-opacity",
                isExcluded && "opacity-40"
              )}
            >
              {/* Card header */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                {/* Checkbox de inclusión */}
                <button
                  type="button"
                  onClick={() => onToggleFactory(line.factoryId)}
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                    !isExcluded
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/60 bg-background"
                  )}
                  aria-label={isExcluded ? "含める" : "除外する"}
                >
                  {!isExcluded && (
                    <svg className="h-2.5 w-2.5" viewBox="0 0 10 8" fill="none">
                      <path
                        d="M1 4L3.5 6.5L9 1.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>

                {/* Expand toggle + label */}
                <button
                  type="button"
                  onClick={() => toggleExpand(line.factoryId)}
                  className="flex flex-1 items-center gap-1.5 text-left"
                >
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate text-sm font-medium">{label}</span>
                </button>

                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {line.totalEmployees}名
                </Badge>

                {/* 抵触日 editable inline */}
                <div className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                  <span>抵触日:</span>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) =>
                      onConflictDateOverride(String(line.factoryId), e.target.value)
                    }
                    onClick={(e) => e.stopPropagation()}
                    className="h-6 w-32 rounded border border-input/50 bg-background px-1.5 text-[10px] focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/10"
                  />
                </div>
              </div>

              {/* Expanded: period info + employees */}
              {isOpen && (
                <div className="border-t border-border/40 px-3 pb-3 pt-2">
                  <p className="mb-2 text-[10px] text-muted-foreground">
                    検索期間: <span className="font-medium tabular-nums">{line.periodStart}</span>
                    {" 〜 今日 → 契約終了: "}
                    <span className="font-medium tabular-nums">{line.contractEndDate}</span>
                  </p>

                  <div className="space-y-2">
                    {line.rateGroups.map((rg: MidHiresRateGroup) => (
                      <div
                        key={rg.rate}
                        className="rounded-lg border border-border/40 bg-muted/20 p-2"
                      >
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-blue-400">
                            ¥{rg.rate.toLocaleString()}/h
                          </span>
                          <Badge variant="info" className="text-[10px]">
                            {rg.employees.length}名
                          </Badge>
                        </div>
                        <ul className="space-y-0.5">
                          {rg.employees.map((emp: MidHiresPreviewEmployee) => {
                            const visaExpired = emp.visaExpiry && emp.visaExpiry < today;
                            return (
                              <li
                                key={emp.id}
                                className="flex items-center gap-2 rounded px-1.5 py-1 text-xs"
                              >
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                                <span className="flex-1 truncate text-muted-foreground">
                                  {emp.fullName ?? `ID:${emp.id}`}
                                </span>
                                <span className="tabular-nums text-[10px] text-cyan-400">
                                  入社: {emp.effectiveHireDate}
                                </span>
                                <span className="tabular-nums text-[10px] text-muted-foreground/60">
                                  → {emp.effectiveHireDate} 〜 {line.contractEndDate}
                                </span>
                                {visaExpired && (
                                  <span title="ビザ期限切れ">
                                    <AlertTriangle className="h-3 w-3 text-red-500" />
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Skipped lines */}
      {skipped.length > 0 && (
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 dark:border-amber-800/40 dark:bg-amber-950/30">
          <p className="mb-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
            対象外のライン
          </p>
          <div className="space-y-0.5">
            {skipped.map((s, i) => (
              <p key={i} className="text-xs text-amber-700 dark:text-amber-400">
                {s.factoryName}
                {s.lineName ? ` › ${s.lineName}` : ""}
                <span className="ml-1 text-amber-500">({s.reason})</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
