import { useCallback, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useContractWizard, calculateEndDate } from "@/lib/hooks/use-contract-wizard";
import { useEmployeesByFactory } from "@/lib/hooks/use-employees";
import { useFactoryCascade } from "@/lib/hooks/use-factories";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useCreateContract } from "@/lib/hooks/use-contracts";
import { queryKeys } from "@/lib/query-keys";
import { AnimatedPage } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Building2, Factory as FactoryIcon, Layers, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Factory } from "@/lib/api";

export const Route = createFileRoute("/contracts/new")({
  component: NewContractWizard,
  errorComponent: ({ reset }) => (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <p className="text-lg font-semibold text-destructive">エラーが発生しました</p>
      <Button variant="outline" onClick={reset}>再試行</Button>
    </div>
  ),
});

function NewContractWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const wizard = useContractWizard();
  const { state } = wizard;
  const create = useCreateContract();

  // Local cascade selection state (factoryId goes to wizard on line selection)
  const [selectedFactoryName, setSelectedFactoryName] = useState("");
  const [selectedDeptName, setSelectedDeptName] = useState("");

  // Data
  const { data: companies } = useCompanies();
  const { data: cascade, isLoading: isCascadeLoading } = useFactoryCascade(state.companyId ?? 0);
  const { data: employees } = useEmployeesByFactory(state.factoryId ?? 0);

  // Derived
  const selectedCompany = useMemo(
    () => companies?.find((c) => c.id === state.companyId),
    [companies, state.companyId]
  );

  const factoryNames = useMemo(() => {
    if (!cascade?.grouped) return [];
    return Object.keys(cascade.grouped);
  }, [cascade]);

  const departments = useMemo(() => {
    if (!cascade?.grouped || !selectedFactoryName) return [];
    return Object.keys(cascade.grouped[selectedFactoryName] ?? {});
  }, [cascade, selectedFactoryName]);

  const lines = useMemo(() => {
    if (!cascade?.grouped || !selectedFactoryName || !selectedDeptName) return [];
    return cascade.grouped[selectedFactoryName]?.[selectedDeptName] ?? [];
  }, [cascade, selectedFactoryName, selectedDeptName]);

  const selectedLine = useMemo(
    () => lines.find((f) => f.id === state.factoryId),
    [lines, state.factoryId]
  );

  // Handlers for cascade
  const handleCompanySelect = useCallback((companyId: number) => {
    setSelectedFactoryName("");
    setSelectedDeptName("");
    wizard.setCompany(companyId);
  }, [wizard]);

  const handleFactorySelect = useCallback((name: string) => {
    setSelectedDeptName("");
    setSelectedFactoryName(name);
  }, []);

  const handleDeptSelect = useCallback((dept: string) => {
    setSelectedDeptName(dept);
  }, []);

  const handleLineSelect = useCallback((factory: Factory) => {
    wizard.setFactory(factory.id, {
      contractPeriod: factory.contractPeriod ?? undefined,
      conflictDate: factory.conflictDate ?? undefined,
    });
  }, [wizard]);

  // Auto-fill endDate when startDate/period changes
  const handleStartDateChange = useCallback(
    (startDate: string) => {
      wizard.setStartDate(startDate);
      if (startDate && !state.endDateOverride) {
        const conflictDate = selectedLine?.conflictDate ? new Date(selectedLine.conflictDate) : null;
        const calculated = calculateEndDate(new Date(startDate), state.period, conflictDate);
        wizard.setEndDate(calculated.toISOString().split("T")[0], false);
      }
    },
    [wizard, state.period, state.endDateOverride, selectedLine]
  );

  const handlePeriodChange = useCallback(
    (period: string) => {
      wizard.setPeriod(period);
      if (state.startDate && !state.endDateOverride) {
        const conflictDate = selectedLine?.conflictDate ? new Date(selectedLine.conflictDate) : null;
        const calculated = calculateEndDate(new Date(state.startDate), period, conflictDate);
        wizard.setEndDate(calculated.toISOString().split("T")[0], false);
      }
    },
    [wizard, state.startDate, state.endDateOverride, selectedLine]
  );

  // Group employees by displayRate for preview
  const employeesByRate = useMemo(() => {
    if (!employees) return [];
    const groups = new Map<number, typeof employees>();
    for (const emp of employees) {
      const rate = emp.displayRate ?? 0;
      if (!groups.has(rate)) groups.set(rate, []);
      groups.get(rate)!.push(emp);
    }
    return Array.from(groups.entries()).sort((a, b) => b[0] - a[0]);
  }, [employees]);

  const handleSubmit = useCallback(async () => {
    if (!state.factoryId || !state.startDate || !state.endDate || state.employeeIds.length === 0) {
      toast.error("すべての項目を入力してください");
      return;
    }
    try {
      // Create one contract per rate group
      for (const [rate, emps] of employeesByRate) {
        await create.mutateAsync({
          factoryId: state.factoryId!,
          startDate: state.startDate,
          endDate: state.endDate,
          employeeAssignments: emps.map((e) => ({ employeeId: e.id, hourlyRate: rate })),
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.invalidateAll });
      toast.success("契約を作成しました");
      wizard.reset();
      navigate({ to: "/contracts" });
    } catch {
      // error handled by hook
    }
  }, [state, employeesByRate, create, queryClient, navigate, wizard]);

  const canProceedStep1 = state.factoryId && state.startDate && state.endDate;

  return (
    <AnimatedPage className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/contracts" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">新規契約作成</h1>
      </div>

      {/* Step indicator */}
      <div className="flex gap-4">
        {[1, 2].map((step) => (
          <div
            key={step}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold",
              state.step === step
                ? "bg-primary text-primary-foreground"
                : state.step > step
                ? "bg-green-500/20 text-green-600"
                : "bg-muted text-muted-foreground"
            )}
          >
            {state.step > step ? <Check className="h-4 w-4" /> : step}
            {step === 1 ? "派遣先・期間" : "社員選択"}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {state.step === 1 && (
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold">派遣先を選択</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                企業 → 工場 → 配属先 → ライン の順に選択してください
              </p>
            </div>

            {/* Breadcrumb */}
            {(state.companyId || selectedFactoryName || selectedDeptName || state.factoryId) && (
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                {selectedCompany && (
                  <span className="rounded-md bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/25 dark:bg-primary/15 dark:text-primary/90 dark:ring-primary/25">
                    {selectedCompany.name}
                  </span>
                )}
                {selectedFactoryName && (
                  <>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                    <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary/80 ring-1 ring-inset ring-primary/20 dark:bg-primary/10 dark:text-primary/70 dark:ring-primary/20">
                      {selectedFactoryName}
                    </span>
                  </>
                )}
                {selectedDeptName && (
                  <>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                    <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border">
                      {selectedDeptName}
                    </span>
                  </>
                )}
                {state.factoryId && (
                  <>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                    <span className="rounded-md bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-700">
                      {lines.find((l) => l.id === state.factoryId)?.lineName ?? "選択済"}
                    </span>
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4" role="group" aria-label="派遣先選択">
              {/* Column 1: Company */}
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                  派遣先企業
                </div>
                <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-xl border border-border/60 p-2 shadow-xs" aria-label="企業一覧">
                  {companies?.map((company) => (
                    <button
                      key={company.id}
                      onClick={() => handleCompanySelect(company.id)}
                      aria-pressed={state.companyId === company.id}
                      className={cn(
                        "w-full rounded-lg px-3 py-2 text-left text-sm transition-all",
                        state.companyId === company.id
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "hover:bg-muted/60"
                      )}
                    >
                      <span className="font-medium">{company.name}</span>
                      <span className="ml-1.5 text-xs opacity-60">({company.factories?.length ?? 0})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Column 2: Factory */}
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <FactoryIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  工場名
                </div>
                <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-xl border border-border/60 p-2 shadow-xs" aria-label="工場一覧">
                  {state.companyId && isCascadeLoading ? (
                    <div className="space-y-2 p-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="skeleton h-9 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : factoryNames.length > 0 ? (
                    factoryNames.map((name) => (
                      <button
                        key={name}
                        onClick={() => handleFactorySelect(name)}
                        aria-pressed={selectedFactoryName === name}
                        className={cn(
                          "w-full rounded-lg px-3 py-2 text-left text-sm transition-all",
                          selectedFactoryName === name
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "hover:bg-muted/60"
                        )}
                      >
                        {name}
                      </button>
                    ))
                  ) : (
                    <div className="flex flex-col items-center py-6 text-center">
                      <FactoryIcon className="mb-1 h-6 w-6 text-muted-foreground/20" aria-hidden="true" />
                      <p className="text-xs text-muted-foreground/60">企業を選択</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Column 3: Department */}
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                  配属先
                </div>
                <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-xl border border-border/60 p-2 shadow-xs" aria-label="配属先一覧">
                  {departments.length > 0 ? (
                    departments.map((dept) => (
                      <button
                        key={dept}
                        onClick={() => handleDeptSelect(dept)}
                        aria-pressed={selectedDeptName === dept}
                        className={cn(
                          "w-full rounded-lg px-3 py-2 text-left text-sm transition-all",
                          selectedDeptName === dept
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "hover:bg-muted/60"
                        )}
                      >
                        {dept}
                      </button>
                    ))
                  ) : (
                    <div className="flex flex-col items-center py-6 text-center">
                      <Layers className="mb-1 h-6 w-6 text-muted-foreground/20" aria-hidden="true" />
                      <p className="text-xs text-muted-foreground/60">
                        {selectedFactoryName ? "配属先がありません" : "工場を選択"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Column 4: Line */}
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                  ライン
                </div>
                <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-xl border border-border/60 p-2 shadow-xs" aria-label="ライン一覧">
                  {lines.length > 0 ? (
                    lines.map((line) => (
                      <button
                        key={line.id}
                        onClick={() => handleLineSelect(line)}
                        aria-pressed={state.factoryId === line.id}
                        className={cn(
                          "w-full rounded-lg px-3 py-2 text-left text-sm transition-all",
                          state.factoryId === line.id
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "hover:bg-muted/60"
                        )}
                      >
                        <span>{line.lineName || "デフォルト"}</span>
                        {line.hourlyRate && (
                          <span className="ml-2 text-xs opacity-60">¥{line.hourlyRate}/h</span>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="flex flex-col items-center py-6 text-center">
                      <Layers className="mb-1 h-6 w-6 text-muted-foreground/20" aria-hidden="true" />
                      <p className="text-xs text-muted-foreground/60">
                        {selectedDeptName ? "ラインがありません" : "配属先を選択"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Auto-fill confirmation */}
            {selectedLine && (
              <div className="rounded-xl border border-green-200/60 bg-green-50/50 p-4 dark:border-green-800/40 dark:bg-green-950/30">
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                  工場データから自動入力しました
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-green-700 dark:text-green-400/80">
                  <span>時給: ¥{selectedLine.hourlyRate ?? 0}/h</span>
                  <span>残業: ¥{Math.round((selectedLine.hourlyRate ?? 0) * 1.25)}/h</span>
                  <span>指揮命令者: {selectedLine.supervisorName || "未設定"}</span>
                  <span>業務内容: {(selectedLine.jobDescription ?? "").slice(0, 20) || "未設定"}</span>
                  <span>抵触日: {selectedLine.conflictDate || "未設定"}</span>
                  <span>契約期間: {selectedLine.contractPeriod === "teishokubi" ? "抵触日まで" : selectedLine.contractPeriod || "未設定"}</span>
                </div>
              </div>
            )}
          </Card>

          {/* Contract period */}
          {state.factoryId && (
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-semibold">契約期間</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">開始日</label>
                  <input
                    type="date"
                    value={state.startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="mt-1 w-full rounded border border-border bg-background px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">期間</label>
                  <select
                    value={state.period}
                    onChange={(e) => handlePeriodChange(e.target.value)}
                    className="mt-1 w-full rounded border border-border bg-background px-3 py-2"
                  >
                    <option value="1month">1ヶ月</option>
                    <option value="2months">2ヶ月</option>
                    <option value="3months">3ヶ月</option>
                    <option value="6months">6ヶ月</option>
                    <option value="1year">1年</option>
                    <option value="teishokubi">抵触日まで</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">終了日</label>
                <input
                  type="date"
                  value={state.endDate}
                  onChange={(e) => wizard.setEndDate(e.target.value, true)}
                  className="mt-1 w-full rounded border border-border bg-background px-3 py-2"
                />
              </div>
              {selectedLine?.conflictDate && state.endDate > selectedLine.conflictDate && (
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  終了日が抵触日を超えています
                </div>
              )}
            </Card>
          )}

          <div className="flex justify-end">
            <Button onClick={() => wizard.setStep(2)} disabled={!canProceedStep1}>
              次へ <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {state.step === 2 && (
        <div className="space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">派遣社員を選択</h2>
            {employeesByRate.length === 0 ? (
              <p className="text-muted-foreground">この工場に社員が存在しません</p>
            ) : (
              <div className="space-y-4">
                {employeesByRate.map(([rate, emps]) => (
                  <div key={rate} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">¥{rate.toLocaleString()} / 時間 ({emps.length}名)</span>
                    </div>
                    <div className="space-y-2">
                      {emps.map((emp) => (
                        <label key={emp.id} className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={state.employeeIds.includes(emp.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                wizard.setEmployeeIds([...state.employeeIds, emp.id]);
                              } else {
                                wizard.setEmployeeIds(state.employeeIds.filter((id) => id !== emp.id));
                              }
                            }}
                            className="h-4 w-4 rounded border-border text-primary"
                          />
                          <span>{emp.fullName}</span>
                          <span className="text-muted-foreground text-sm">{emp.employeeNumber}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {employeesByRate.length > 1 && (
            <div className="flex items-center gap-2 text-amber-600 text-sm">
              <AlertTriangle className="h-4 w-4" />
              複数の単価が選択されています — {employeesByRate.length}件の契約が作成されます
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => wizard.setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />戻る
            </Button>
            <Button onClick={handleSubmit} disabled={state.employeeIds.length === 0 || create.isPending}>
              {create.isPending ? "作成中..." : `契約を作成 (${state.employeeIds.length}名)`}
            </Button>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
