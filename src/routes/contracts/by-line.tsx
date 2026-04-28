import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AnimatedPage } from "@/components/ui/animated";
import {
  Section,
  StatCard,
  CompanySelector,
  BatchPageHeader,
  ResultHeader,
  PdfFilesList,
  ResultActions,
  ResultScreen,
  StyledCheckbox,
} from "@/components/contract/batch-shared";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useDashboardStats } from "@/lib/hooks/use-dashboard-stats";
import { useFactoryCascade } from "@/lib/hooks/use-factories";
import { useEmployees } from "@/lib/hooks/use-employees";
import {
  useByLineBatchCreate,
  useBatchGenerateDocuments,
} from "@/lib/hooks/use-contracts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Factory as FactoryIcon,
  Calendar,
  Users,
  FileText,
  Check,
  Zap,
  Loader2,
} from "lucide-react";
import type {
  Factory as ApiFactory,
  Employee,
  ByLineBatchResult,
} from "@/lib/api";

export const Route = createFileRoute("/contracts/by-line")({
  component: ByLinePage,
});

type EmpKind = "old" | "new-in-range" | "future-skip";

interface EmpRow {
  selected: boolean;
  startDate: string;
  endDate: string;
  startDirty: boolean;
  endDirty: boolean;
  kind: EmpKind;
}

function calcEndDate(startDate: string, months: number): string {
  if (!startDate) return "";
  const s = new Date(startDate);
  const end = new Date(s.getFullYear(), s.getMonth() + months, 0);
  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, "0");
  const d = String(end.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function effectiveRate(emp: Employee, factory: ApiFactory | null): number {
  return emp.billingRate ?? emp.hourlyRate ?? factory?.hourlyRate ?? 0;
}

function effectiveHireDate(emp: Employee): string | null {
  return emp.actualHireDate || emp.hireDate || null;
}

/**
 * Clasifica al empleado según su 配属日 vs el rango global del contrato:
 *  - old: 入社済み antes del rango → usa globalStart como individual_start
 *  - new-in-range: entró dentro del rango → usa su 入社日 como individual_start
 *  - future-skip: entrará después del rango → mostrado en UI pero NO se imprime
 */
function classifyEmployee(emp: Employee, globalStart: string, globalEnd: string): EmpKind {
  const hd = effectiveHireDate(emp);
  if (!hd || !globalStart || !globalEnd) return "old";
  if (hd < globalStart) return "old";
  if (hd <= globalEnd) return "new-in-range";
  return "future-skip";
}

function autoStartDate(emp: Employee, kind: EmpKind, globalStart: string): string {
  if (kind === "old") return globalStart;
  return effectiveHireDate(emp) || globalStart;
}

function ByLinePage() {
  const { data: companies } = useCompanies();
  const { data: dashboardStats } = useDashboardStats();
  const byLineCreate = useByLineBatchCreate();
  const batchGenerateDocs = useBatchGenerateDocuments();

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [factoryId, setFactoryId] = useState<number | null>(null);
  const [globalStart, setGlobalStart] = useState("");
  const [globalEnd, setGlobalEnd] = useState("");
  const [generatePdf, setGeneratePdf] = useState(false);
  const [empRows, setEmpRows] = useState<Map<number, EmpRow>>(new Map());
  const [result, setResult] = useState<ByLineBatchResult | null>(null);

  const { data: cascade } = useFactoryCascade(companyId ?? 0);
  const { data: employees } = useEmployees({
    factoryId: factoryId ?? undefined,
    status: "active",
  });

  const flatFactories = useMemo(() => cascade?.flat || [], [cascade]);
  const grouped = useMemo(() => cascade?.grouped || {}, [cascade]);
  const selectedFactory = useMemo(
    () => flatFactories.find((f) => f.id === factoryId) ?? null,
    [flatFactories, factoryId],
  );

  // Inicializar empRows cuando cambian los empleados (factoría) — aplica clasificación inicial.
  useEffect(() => {
    if (!employees) return;
    setEmpRows((prev) => {
      const next = new Map<number, EmpRow>();
      for (const emp of employees) {
        const existing = prev.get(emp.id);
        if (existing) {
          next.set(emp.id, existing);
          continue;
        }
        const kind = classifyEmployee(emp, globalStart, globalEnd);
        next.set(emp.id, {
          selected: kind !== "future-skip",
          startDate: autoStartDate(emp, kind, globalStart),
          endDate: globalEnd,
          startDirty: false,
          endDirty: false,
          kind,
        });
      }
      return next;
    });
  }, [employees, globalStart, globalEnd]);

  // Cuando cambia el default global, re-clasifica + pisa filas no-dirty.
  const handleGlobalStartChange = useCallback(
    (v: string) => {
      setGlobalStart(v);
      setEmpRows((prev) => {
        if (!employees) return prev;
        const next = new Map(prev);
        for (const emp of employees) {
          const row = next.get(emp.id);
          if (!row) continue;
          const kind = classifyEmployee(emp, v, globalEnd);
          next.set(emp.id, {
            ...row,
            kind,
            startDate: row.startDirty ? row.startDate : autoStartDate(emp, kind, v),
            // Auto-deselect 未配属, auto-select continuo/nuevo (pero respeta toggle manual via startDirty)
            selected: row.startDirty ? row.selected : kind !== "future-skip",
          });
        }
        return next;
      });
    },
    [employees, globalEnd],
  );

  const handleGlobalEndChange = useCallback(
    (v: string) => {
      setGlobalEnd(v);
      setEmpRows((prev) => {
        if (!employees) return prev;
        const next = new Map(prev);
        for (const emp of employees) {
          const row = next.get(emp.id);
          if (!row) continue;
          const kind = classifyEmployee(emp, globalStart, v);
          next.set(emp.id, {
            ...row,
            kind,
            endDate: row.endDirty ? row.endDate : v,
            startDate: row.startDirty ? row.startDate : autoStartDate(emp, kind, globalStart),
            selected: row.startDirty ? row.selected : kind !== "future-skip",
          });
        }
        return next;
      });
    },
    [employees, globalStart],
  );

  const applyPreset = useCallback((months: number) => {
    if (!globalStart) return;
    handleGlobalEndChange(calcEndDate(globalStart, months));
  }, [globalStart, handleGlobalEndChange]);

  const updateRow = useCallback(
    (id: number, patch: Partial<EmpRow>) => {
      setEmpRows((prev) => {
        const next = new Map(prev);
        const cur = next.get(id);
        if (!cur) return prev;
        next.set(id, { ...cur, ...patch });
        return next;
      });
    },
    [],
  );

  const toggleAll = useCallback((checked: boolean) => {
    setEmpRows((prev) => {
      const next = new Map(prev);
      for (const [id, row] of next) {
        next.set(id, { ...row, selected: checked });
      }
      return next;
    });
  }, []);

  // Cambio de selección de empresa/factory => reset
  const handleCompanyChange = useCallback((id: number) => {
    setCompanyId(id);
    setFactoryId(null);
    setEmpRows(new Map());
    setResult(null);
  }, []);

  const handleFactoryChange = useCallback((id: number) => {
    setFactoryId(id);
    setEmpRows(new Map());
    setResult(null);
  }, []);

  // Preview agrupado client-side
  const preview = useMemo(() => {
    if (!employees || !selectedFactory) {
      return { selectedCount: 0, groups: [] as { rate: number; startDate: string; endDate: string; count: number }[] };
    }
    const groupMap = new Map<string, { rate: number; startDate: string; endDate: string; count: number }>();
    let selectedCount = 0;
    for (const emp of employees) {
      const row = empRows.get(emp.id);
      if (!row?.selected) continue;
      if (!row.startDate || !row.endDate) continue;
      selectedCount += 1;
      const rate = effectiveRate(emp, selectedFactory);
      if (!rate) continue;
      const key = `${rate}|${row.startDate}|${row.endDate}`;
      const existing = groupMap.get(key);
      if (existing) existing.count += 1;
      else groupMap.set(key, { rate, startDate: row.startDate, endDate: row.endDate, count: 1 });
    }
    const groups = Array.from(groupMap.values()).sort(
      (a, b) => b.count - a.count || b.rate - a.rate,
    );
    return { selectedCount, groups };
  }, [employees, empRows, selectedFactory]);

  const handleSubmit = useCallback(async () => {
    if (!companyId || !factoryId || !employees) return;

    const payload = {
      companyId,
      factoryId,
      employees: employees
        .filter((emp) => empRows.get(emp.id)?.selected)
        .map((emp) => {
          const row = empRows.get(emp.id)!;
          return {
            employeeId: emp.id,
            startDate: row.startDate,
            endDate: row.endDate,
          };
        }),
      generatePdf,
    };

    if (payload.employees.length === 0) {
      toast.error("社員を1名以上選択してください");
      return;
    }

    const invalid = payload.employees.find(
      (e) => !e.startDate || !e.endDate || e.startDate > e.endDate,
    );
    if (invalid) {
      toast.error("社員ID " + invalid.employeeId + " の日付が無効です");
      return;
    }

    try {
      const res = await byLineCreate.mutateAsync(payload);
      if (generatePdf && res.contractIds.length > 0) {
        const pdfRes = await batchGenerateDocs.mutateAsync(res.contractIds);
        setResult({ ...res, pdfFiles: pdfRes.files });
      } else {
        setResult(res);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "作成に失敗しました");
    }
  }, [companyId, factoryId, employees, empRows, generatePdf, byLineCreate, batchGenerateDocs]);

  const allSelected =
    employees && employees.length > 0 &&
    employees.every((e) => empRows.get(e.id)?.selected);
  const noneSelected =
    employees && employees.length > 0 &&
    employees.every((e) => !empRows.get(e.id)?.selected);

  // ─── Result screen ───────────────────────────────────────────────
  if (result) {
    return (
      <ResultScreen>
        <ResultHeader title="ライン個別作成完了" created={result.created} skipped={0} />

        {result.contracts.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border/60 bg-card shadow-[var(--shadow-card)]">
            <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
              <h3 className="text-sm font-semibold">作成された契約</h3>
            </div>
            <div className="divide-y divide-border/40">
              {result.contracts.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="font-medium text-primary">{c.contractNumber}</span>
                    <span className="ml-3 text-sm text-muted-foreground">
                      {c.factoryName} {c.department} {c.lineName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-xs text-muted-foreground mono-tabular">
                      {c.startDate} ~ {c.endDate}
                    </span>
                    <span className="mono-tabular">¥{c.hourlyRate.toLocaleString()}/h</span>
                    <Badge variant="info" size="sm">{c.employeeCount}名</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(result.pdfFiles?.length ?? 0) > 0 && (
          <PdfFilesList files={result.pdfFiles!} label="生成されたZIP" />
        )}

        <ResultActions onReset={() => setResult(null)} />
      </ResultScreen>
    );
  }

  return (
    <AnimatedPage className="space-y-6">
      <BatchPageHeader
        title="ラインで個別選択"
        description="1ラインの社員を個別に選択し、開始日/終了日も社員ごとに指定できます"
        icon={Users}
        badge="BY LINE"
        breadcrumb={["契約", "ライン個別"]}
        stats={[
          { label: "派遣先", value: dashboardStats?.companies ?? 0 },
          { label: "工場ライン", value: dashboardStats?.factories ?? 0 },
          { label: "稼働契約", value: dashboardStats?.activeContracts ?? 0 },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* Step 1 — company */}
          <CompanySelector
            companies={companies}
            selectedId={companyId}
            onChange={handleCompanyChange}
          />

          {/* Step 2 — factory/line picker (radio único) */}
          {companyId && (
            <Section icon={FactoryIcon} title="ライン選択" step={2}>
              {flatFactories.length === 0 ? (
                <EmptyState
                  icon={FactoryIcon}
                  title="工場が登録されていません"
                  description="この企業には工場・ラインが登録されていません"
                />
              ) : (
                <div className="max-h-[360px] space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
                  {Object.entries(grouped).map(([factoryName, depts]) => (
                    <div key={factoryName}>
                      <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                        {factoryName}
                      </p>
                      {Object.entries(depts as Record<string, ApiFactory[]>).map(([dept, lines]) => (
                        <div key={dept}>
                          {dept && (
                            <p className="px-3 pb-0.5 pt-1 text-[10px] text-muted-foreground/40">
                              {dept}
                            </p>
                          )}
                          {lines.map((line) => {
                            const isSelected = factoryId === line.id;
                            return (
                              <button
                                key={line.id}
                                onClick={() => handleFactoryChange(line.id)}
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all",
                                  isSelected
                                    ? "bg-primary/6 ring-1 ring-primary/20"
                                    : "hover:bg-muted/40",
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all",
                                    isSelected
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border/80",
                                  )}
                                >
                                  {isSelected && <Check className="h-2.5 w-2.5" />}
                                </div>
                                <span className="flex-1 truncate">
                                  {line.lineName || line.department || "--"}
                                </span>
                                {line.hourlyRate && (
                                  <span className="tabular-nums text-xs text-muted-foreground">
                                    ¥{line.hourlyRate.toLocaleString()}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* Step 3 — defaults globales */}
          {factoryId && (
            <Section icon={Calendar} title="既定の契約期間" step={3}>
              <p className="mb-3 text-xs text-muted-foreground">
                ここで設定した日付は未編集の社員行に自動で適用されます。個別に編集した行は維持されます。
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">開始日</label>
                  <input
                    type="date"
                    value={globalStart}
                    onChange={(e) => handleGlobalStartChange(e.target.value)}
                    className="w-full rounded-lg border border-input/80 bg-background px-3 py-2.5 text-sm shadow-xs transition-all focus:border-primary/30 focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">終了日</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={globalEnd}
                      onChange={(e) => handleGlobalEndChange(e.target.value)}
                      className="flex-1 rounded-lg border border-input/80 bg-background px-3 py-2.5 text-sm shadow-xs transition-all focus:border-primary/30 focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
                    />
                    <div className="flex gap-1">
                      {([
                        { label: "1月", months: 1 },
                        { label: "3月", months: 3 },
                        { label: "6月", months: 6 },
                        { label: "1年", months: 12 },
                      ] as const).map(({ label, months }) => (
                        <button
                          key={months}
                          type="button"
                          disabled={!globalStart}
                          onClick={() => applyPreset(months)}
                          className={cn(
                            "rounded-md border px-2.5 py-2 text-xs font-medium transition-all",
                            !globalStart
                              ? "cursor-not-allowed border-input/40 text-muted-foreground/40"
                              : "cursor-pointer border-input/60 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-border/40 pt-4">
                <StyledCheckbox
                  checked={generatePdf}
                  onChange={setGeneratePdf}
                  label="PDFも生成"
                  description="個別契約書+通知書・派遣先管理台帳・派遣元管理台帳の3つのPDFを生成"
                />
              </div>
            </Section>
          )}

          {/* Step 4 — empleado picker */}
          {factoryId && (
            <Section icon={Users} title="社員選択" step={4}>
              {!employees || employees.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="社員がいません"
                  description="このラインに在籍中の社員が登録されていません"
                />
              ) : (
                <>
                  <label className="mb-3 flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-2.5">
                    <div
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded border transition-all",
                        allSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : noneSelected
                            ? "border-border/80"
                            : "border-primary/60 bg-primary/30",
                      )}
                    >
                      {allSelected && <Check className="h-3 w-3" />}
                    </div>
                    <input
                      type="checkbox"
                      checked={!!allSelected}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="sr-only"
                    />
                    <span className="text-sm font-semibold">全員選択</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {preview.selectedCount}/{employees.length}名
                    </span>
                  </label>

                  <div className="max-h-[460px] divide-y divide-border/40 overflow-y-auto rounded-xl border border-border/60">
                    {employees.map((emp) => {
                      const row = empRows.get(emp.id);
                      if (!row) return null;
                      const rate = effectiveRate(emp, selectedFactory);
                      const hireDate = effectiveHireDate(emp);
                      const kindBadge =
                        row.kind === "new-in-range" ? (
                          <Badge variant="success" size="sm">新規 {hireDate}</Badge>
                        ) : row.kind === "future-skip" ? (
                          <Badge variant="warning" size="sm">未配属 {hireDate}</Badge>
                        ) : null;
                      return (
                        <div
                          key={emp.id}
                          className={cn(
                            "grid grid-cols-[24px_1fr_auto_auto_auto_auto] items-center gap-3 px-3 py-2 text-sm transition-colors",
                            row.selected ? "bg-primary/[0.03]" : "opacity-60",
                            row.kind === "future-skip" && "bg-amber-500/[0.05]",
                          )}
                        >
                          <button
                            onClick={() => updateRow(emp.id, { selected: !row.selected, startDirty: true })}
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded border transition-all",
                              row.selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border/80",
                            )}
                          >
                            {row.selected && <Check className="h-3 w-3" />}
                          </button>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {emp.fullName}
                              {emp.katakanaName && (
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                  {emp.katakanaName}
                                </span>
                              )}
                            </p>
                            <p className="truncate text-[10px] text-muted-foreground/70">
                              {emp.employeeNumber}
                            </p>
                          </div>
                          <div className="min-w-0">{kindBadge}</div>
                          <span className="mono-tabular text-xs text-[var(--color-status-info)]">
                            ¥{rate.toLocaleString()}
                          </span>
                          <input
                            type="date"
                            value={row.startDate}
                            disabled={!row.selected}
                            onChange={(e) =>
                              updateRow(emp.id, {
                                startDate: e.target.value,
                                startDirty: true,
                              })
                            }
                            className={cn(
                              "rounded-md border border-input/70 bg-background px-2 py-1 text-xs",
                              row.startDirty && "border-primary/50",
                            )}
                          />
                          <input
                            type="date"
                            value={row.endDate}
                            disabled={!row.selected}
                            onChange={(e) =>
                              updateRow(emp.id, {
                                endDate: e.target.value,
                                endDirty: true,
                              })
                            }
                            className={cn(
                              "rounded-md border border-input/70 bg-background px-2 py-1 text-xs",
                              row.endDirty && "border-primary/50",
                            )}
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </Section>
          )}
        </div>

        {/* Right column — preview */}
        <div className="space-y-4">
          {factoryId && preview.selectedCount > 0 ? (
            <div className="sticky top-6 space-y-4">
              <div className="rounded-lg border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
                <h3 className="mb-4 text-sm font-semibold">作成プレビュー</h3>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="契約数" value={preview.groups.length} icon={FileText} />
                  <StatCard label="社員数" value={preview.selectedCount} icon={Users} />
                  <StatCard label="ライン" value={1} icon={FactoryIcon} />
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-card shadow-[var(--shadow-card)]">
                <div className="border-b border-border/60 px-4 py-3">
                  <h3 className="text-sm font-semibold">グループ別詳細</h3>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    料金・期間が同一の社員はまとめて1契約になります
                  </p>
                </div>
                <div className="max-h-[360px] divide-y divide-border/40 overflow-y-auto">
                  {preview.groups.map((g, idx) => (
                    <div key={idx} className="px-4 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="mono-tabular text-xs font-bold text-[var(--color-status-info)]">
                          ¥{g.rate.toLocaleString()}/h
                        </span>
                        <Badge variant="info" size="sm">{g.count}名</Badge>
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground mono-tabular">
                        {g.startDate} ~ {g.endDate}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant="success"
                className="w-full"
                onClick={handleSubmit}
                disabled={
                  byLineCreate.isPending ||
                  batchGenerateDocs.isPending ||
                  preview.groups.length === 0
                }
              >
                {byLineCreate.isPending || batchGenerateDocs.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    作成中...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    <span className="mono-tabular">{preview.groups.length}</span>件の契約を一括作成
                  </>
                )}
              </Button>
            </div>
          ) : factoryId ? (
            <EmptyState
              icon={Zap}
              title="プレビュー待機中"
              description="社員を選択すると契約グループが表示されます"
            />
          ) : null}
        </div>
      </div>
    </AnimatedPage>
  );
}
