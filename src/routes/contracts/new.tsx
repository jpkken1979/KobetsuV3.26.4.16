import { useCallback, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useContractWizard, calculateEndDate } from "@/lib/hooks/use-contract-wizard";
import { calculateContractDates } from "@/lib/contract-dates";
import { useEmployeesByFactory } from "@/lib/hooks/use-employees";
import { useFactoryCascade } from "@/lib/hooks/use-factories";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useCreateContract } from "@/lib/hooks/use-contracts";
import { queryKeys } from "@/lib/query-keys";
import { AnimatedPage } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Building2,
  Factory as FactoryIcon,
  Layers,
  ChevronRight,
  Users,
  UserPlus,
  Calendar,
  Search,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, AlertTriangle } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { api, type Factory, type Employee } from "@/lib/api";

type EmployeeWithRate = Employee & { displayRate?: number | null };

function formatJpDate(iso: string | null | undefined): string {
  if (!iso) return "--";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[0]}/${parts[1]}/${parts[2]}`;
}

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

  // Fecha de 抵触日 efectiva: usa el override si está activo, sino la de la fábrica
  const effectiveConflictStr = useMemo(
    () => (state.useConflictDateOverride && state.conflictDateOverride
      ? state.conflictDateOverride
      : selectedLine?.conflictDate ?? null),
    [state.useConflictDateOverride, state.conflictDateOverride, selectedLine]
  );
  const effectiveConflict = useMemo(
    () => (effectiveConflictStr ? new Date(effectiveConflictStr) : null),
    [effectiveConflictStr]
  );

  // Auto-fill endDate when startDate/period changes
  const handleStartDateChange = useCallback(
    (startDate: string) => {
      wizard.setStartDate(startDate);
      if (startDate && !state.endDateOverride) {
        const calculated = calculateEndDate(new Date(startDate), state.period, effectiveConflict);
        wizard.setEndDate(calculated.toISOString().split("T")[0], false);
      }
    },
    [wizard, state.period, state.endDateOverride, effectiveConflict]
  );

  const handlePeriodChange = useCallback(
    (period: string) => {
      wizard.setPeriod(period);
      if (state.startDate && !state.endDateOverride) {
        const calculated = calculateEndDate(new Date(state.startDate), period, effectiveConflict);
        wizard.setEndDate(calculated.toISOString().split("T")[0], false);
      }
    },
    [wizard, state.startDate, state.endDateOverride, effectiveConflict]
  );

  // Step 2 state: search + status filters + retired query
  const [search, setSearch] = useState("");
  const [showActive, setShowActive] = useState(true);
  const [showOnLeave, setShowOnLeave] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Lazy query: retired employees of the same company (factoryId=null after resignation)
  const { data: retiredEmployees, isLoading: isRetiredLoading } = useQuery({
    queryKey: queryKeys.employees.all({ companyId: state.companyId ?? undefined, status: "inactive" }),
    queryFn: () => api.getEmployees({ companyId: state.companyId ?? undefined, status: "inactive" }),
    enabled: showInactive && !!state.companyId,
  });

  // Merge main + retired (dedup by id)
  const allEmployees = useMemo<EmployeeWithRate[]>(() => {
    const main = (employees || []) as EmployeeWithRate[];
    const retired = (retiredEmployees || []) as EmployeeWithRate[];
    const mainIds = new Set(main.map((e) => e.id));
    const retiredDedup = retired
      .filter((e) => !mainIds.has(e.id))
      .map((e) => ({ ...e, displayRate: e.billingRate ?? e.hourlyRate }));
    return [...main, ...retiredDedup];
  }, [employees, retiredEmployees]);

  // Filter by status checkboxes
  const statusFiltered = useMemo(() => {
    return allEmployees.filter((emp) => {
      const s = emp.status ?? "active";
      if (s === "active") return showActive;
      if (s === "onLeave") return showOnLeave;
      if (s === "inactive") return showInactive;
      return true;
    });
  }, [allEmployees, showActive, showOnLeave, showInactive]);

  // Apply search
  const searchFiltered = useMemo(() => {
    if (!search) return statusFiltered;
    const s = search.toLowerCase();
    return statusFiltered.filter(
      (e) =>
        e.fullName?.toLowerCase().includes(s) ||
        e.katakanaName?.toLowerCase().includes(s) ||
        e.employeeNumber?.includes(s)
    );
  }, [statusFiltered, search]);

  // Split into existing (hireDate < contract.startDate) vs new hires (within contract period)
  const { existingEmployees, newHireEmployees } = useMemo(() => {
    const existing: EmployeeWithRate[] = [];
    const newHires: EmployeeWithRate[] = [];
    const contractStart = state.startDate || "";
    const contractEnd = state.endDate || "";

    for (const emp of searchFiltered) {
      const hire = emp.hireDate;
      if (!contractStart || !hire) {
        existing.push(emp);
        continue;
      }
      if (hire < contractStart) {
        existing.push(emp);
      } else if (!contractEnd || hire <= contractEnd) {
        newHires.push(emp);
      }
      // else: hireDate > contractEnd → excluded silently
    }
    return { existingEmployees: existing, newHireEmployees: newHires };
  }, [searchFiltered, state.startDate, state.endDate]);

  // Effective startDate per employee
  const getEffectiveStartDate = useCallback(
    (emp: EmployeeWithRate): string => {
      const cs = state.startDate || "";
      if (!cs) return cs;
      const hire = emp.hireDate;
      if (!hire || hire < cs) return cs;
      return hire;
    },
    [state.startDate]
  );

  // Group employees by rate within each section (for visual display)
  type RateGroup = { rate: number; emps: EmployeeWithRate[] };
  const groupByRate = useCallback((emps: EmployeeWithRate[]): RateGroup[] => {
    const groups = new Map<number, EmployeeWithRate[]>();
    for (const emp of emps) {
      const rate = emp.displayRate ?? emp.billingRate ?? emp.hourlyRate ?? 0;
      if (!groups.has(rate)) groups.set(rate, []);
      groups.get(rate)!.push(emp);
    }
    return Array.from(groups.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([rate, emps]) => ({ rate, emps }));
  }, []);

  const existingByRate = useMemo(() => groupByRate(existingEmployees), [existingEmployees, groupByRate]);
  const newHiresByRate = useMemo(() => groupByRate(newHireEmployees), [newHireEmployees, groupByRate]);

  // For contract creation: group selected employees by (rate, effectiveStartDate)
  type ContractGroup = {
    rate: number;
    startDate: string;
    contractDate: string;
    notificationDate: string;
    emps: EmployeeWithRate[];
    kind: "existing" | "newhire";
  };
  const selectedGroups = useMemo(() => {
    if (!state.startDate) return new Map<string, ContractGroup>();
    const groups = new Map<string, ContractGroup>();
    const selectedSet = new Set(state.employeeIds);
    const empMap = new Map(allEmployees.map((e) => [e.id, e]));

    for (const id of state.employeeIds) {
      const emp = empMap.get(id);
      if (!emp) continue;
      if (!selectedSet.has(emp.id)) continue;
      const rate = emp.displayRate ?? emp.billingRate ?? emp.hourlyRate ?? 0;
      const startDate = getEffectiveStartDate(emp);
      const key = `${rate}__${startDate}`;
      if (!groups.has(key)) {
        const isNewHire = !!state.startDate && startDate !== state.startDate;
        let contractDate = "";
        let notificationDate = "";
        if (startDate) {
          const calc = calculateContractDates(startDate);
          contractDate = calc.contractDate;
          notificationDate = calc.notificationDate;
        }
        groups.set(key, {
          rate,
          startDate,
          contractDate,
          notificationDate,
          emps: [],
          kind: isNewHire ? "newhire" : "existing",
        });
      }
      groups.get(key)!.emps.push(emp);
    }

    return new Map(
      [...groups.entries()].sort(([, a], [, b]) => {
        if (a.kind !== b.kind) return a.kind === "existing" ? -1 : 1;
        if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
        return b.rate - a.rate;
      })
    );
  }, [state.employeeIds, state.startDate, allEmployees, getEffectiveStartDate]);

  const toggleEmployee = useCallback(
    (empId: number, checked: boolean) => {
      if (checked) {
        wizard.setEmployeeIds([...state.employeeIds, empId]);
      } else {
        wizard.setEmployeeIds(state.employeeIds.filter((id) => id !== empId));
      }
    },
    [wizard, state.employeeIds]
  );

  const toggleAllInGroup = useCallback(
    (emps: EmployeeWithRate[]) => {
      const ids = emps.map((e) => e.id);
      const allSelected = ids.every((id) => state.employeeIds.includes(id));
      if (allSelected) {
        wizard.setEmployeeIds(state.employeeIds.filter((id) => !ids.includes(id)));
      } else {
        wizard.setEmployeeIds([...new Set([...state.employeeIds, ...ids])]);
      }
    },
    [wizard, state.employeeIds]
  );

  const handleSubmit = useCallback(async () => {
    if (
      !state.companyId ||
      !state.factoryId ||
      !state.startDate ||
      !state.endDate ||
      state.employeeIds.length === 0
    ) {
      toast.error("すべての項目を入力してください");
      return;
    }
    if (selectedGroups.size === 0) return;
    try {
      for (const [, group] of selectedGroups) {
        await create.mutateAsync({
          companyId: state.companyId,
          factoryId: state.factoryId,
          startDate: group.startDate,
          endDate: state.endDate,
          contractDate: group.contractDate,
          notificationDate: group.notificationDate,
          conflictDateOverride: state.useConflictDateOverride ? state.conflictDateOverride : null,
          employeeAssignments: group.emps.map((e) => ({ employeeId: e.id, hourlyRate: group.rate })),
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.invalidateAll });
      toast.success(
        selectedGroups.size > 1
          ? `${selectedGroups.size}件の契約書を作成しました`
          : "契約を作成しました"
      );
      wizard.reset();
      navigate({ to: "/contracts" });
    } catch {
      // error handled by hook
    }
  }, [state, selectedGroups, create, queryClient, navigate, wizard]);

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
      <div className="flex gap-3">
        {[
          { id: 1, label: "派遣先・期間" },
          { id: 2, label: "社員選択" },
        ].map((s, i, arr) => {
          const isCompleted = state.step > s.id;
          const isCurrent = state.step === s.id;
          return (
            <div key={s.id} className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
                    isCompleted
                      ? "bg-gradient-to-br from-[var(--gradient-accent-from)] to-[var(--gradient-accent-to)] text-foreground"
                      : isCurrent
                      ? "bg-primary text-primary-foreground"
                      : "border-2 border-border text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : s.id}
                </div>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    isCurrent ? "text-foreground" : isCompleted ? "text-primary/70" : "text-muted-foreground"
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < arr.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-8 transition-all duration-500",
                    isCompleted
                      ? "bg-gradient-to-r from-[var(--gradient-accent-from)] to-[var(--gradient-accent-to)]"
                      : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
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
                    <span className="rounded-md bg-[var(--color-status-ok-muted)] px-2.5 py-1 text-xs font-medium text-[var(--color-status-ok)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-status-ok)_25%,transparent)]">
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
                <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-border/60 p-2 shadow-xs" aria-label="企業一覧">
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
                <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-border/60 p-2 shadow-xs" aria-label="工場一覧">
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
                <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-border/60 p-2 shadow-xs" aria-label="配属先一覧">
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
                <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-border/60 p-2 shadow-xs" aria-label="ライン一覧">
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
              <div className="rounded-md border border-[color-mix(in_srgb,var(--color-status-ok)_25%,transparent)] bg-[var(--color-status-ok-muted)] p-4">
                <p className="text-sm font-semibold text-[var(--color-status-ok)]">
                  工場データから自動入力しました
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--color-status-ok)]">
                  <span>時給: ¥{selectedLine.hourlyRate ?? 0}/h</span>
                  <span>残業: ¥{Math.round((selectedLine.hourlyRate ?? 0) * 1.25)}/h</span>
                  <span>指揮命令者: {selectedLine.supervisorName || "未設定"}</span>
                  <span>業務内容: {(selectedLine.jobDescription ?? "").slice(0, 20) || "未設定"}</span>
                  <span>抵触日 (工場設定): {selectedLine.conflictDate || "未設定"}</span>
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
                  <label className="mb-1.5 block text-xs font-semibold text-foreground/80">開始日</label>
                  <input
                    type="date"
                    value={state.startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full rounded-md border border-input/80 bg-background px-3 py-2.5 text-sm shadow-xs transition-all focus:border-primary/30 focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-foreground/80">期間</label>
                  <select
                    value={state.period}
                    onChange={(e) => handlePeriodChange(e.target.value)}
                    className="w-full rounded-md border border-input/80 bg-background px-3 py-2.5 text-sm shadow-xs transition-all focus:border-primary/30 focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
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
                <label className="mb-1.5 block text-xs font-semibold text-foreground/80">終了日</label>
                <input
                  type="date"
                  value={state.endDate}
                  onChange={(e) => wizard.setEndDate(e.target.value, true)}
                  className="w-full rounded-md border border-input/80 bg-background px-3 py-2.5 text-sm shadow-xs transition-all focus:border-primary/30 focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.useConflictDateOverride}
                    onChange={(e) => wizard.setUseConflictDateOverride(e.target.checked)}
                    className="rounded"
                  />
                  別の抵触日を使用する
                </label>
                {state.useConflictDateOverride && (
                  <input
                    type="date"
                    value={state.conflictDateOverride ?? ""}
                    onChange={(e) => wizard.setConflictDateOverride(e.target.value || null)}
                    className="border rounded px-2 py-1 text-sm w-40"
                  />
                )}
              </div>
              {effectiveConflictStr && state.endDate > effectiveConflictStr && (
                <div className="rounded-md border border-[color-mix(in_srgb,var(--color-status-warning)_25%,transparent)] bg-[var(--color-status-warning-muted)] p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--color-status-warning)]" />
                    <p className="text-sm font-semibold text-[var(--color-status-warning)]">終了日が抵触日を超えています</p>
                  </div>
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
            <div>
              <h2 className="text-lg font-semibold">派遣社員を選択</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                既存社員と契約期間中に入社する新規入社を分けて表示します。
                新規入社は各社員の入社日が契約開始日になります。
              </p>
            </div>

            {/* Search + status filters */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="名前・カナ・社員番号で検索..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="社員検索"
                  className="w-full rounded-lg border border-border/80 bg-background px-3 py-2.5 pl-10 text-sm shadow-xs transition-all placeholder:text-muted-foreground/60 focus:border-primary/30 focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {state.employeeIds.length} 名
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  状態
                </span>
                <label className="flex cursor-pointer items-center gap-1.5 hover:text-foreground transition-colors">
                  <input
                    type="checkbox"
                    checked={showActive}
                    onChange={(e) => setShowActive(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  <span className="rounded-full bg-[var(--color-status-ok-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-status-ok)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-status-ok)_25%,transparent)]">
                    在職中
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 hover:text-foreground transition-colors">
                  <input
                    type="checkbox"
                    checked={showOnLeave}
                    onChange={(e) => setShowOnLeave(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  <span className="rounded-full bg-[var(--color-status-warning-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-status-warning)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-status-warning)_25%,transparent)]">
                    休職中
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-1.5 hover:text-foreground transition-colors">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
                    退職者
                  </span>
                </label>
              </div>
            </div>

            {/* Empty state */}
            {existingEmployees.length === 0 && newHireEmployees.length === 0 && !isRetiredLoading && (
              <div className="flex flex-col items-center py-10 text-center">
                <User className="mb-2 h-8 w-8 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">社員が見つかりません</p>
                {!showActive && !showOnLeave && !showInactive && (
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    少なくとも1つの状態フィルタを有効にしてください
                  </p>
                )}
              </div>
            )}

            {/* Section 1: Existing employees (grouped by rate) */}
            {existingByRate.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary/70" />
                  <h3 className="text-sm font-semibold text-primary/80">
                    既存社員 ({existingEmployees.length}名)
                  </h3>
                  {state.startDate && (
                    <span className="text-xs text-muted-foreground">
                      契約開始 {formatJpDate(state.startDate)}
                    </span>
                  )}
                </div>
                {existingByRate.map(({ rate, emps }) => {
                  const allSelected = emps.every((e) => state.employeeIds.includes(e.id));
                  return (
                    <div key={`ex-${rate}`} className="border border-border/60 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">
                          ¥{rate.toLocaleString()} / 時間 ({emps.length}名)
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleAllInGroup(emps)}
                          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                          {allSelected ? "すべて解除" : "すべて選択"}
                        </button>
                      </div>
                      <div className="space-y-2">
                        {emps.map((emp) => (
                          <EmployeeCheckRow
                            key={emp.id}
                            emp={emp}
                            checked={state.employeeIds.includes(emp.id)}
                            onToggle={(checked) => toggleEmployee(emp.id, checked)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Section 2: New hires (grouped by rate, each row shows its hireDate as start) */}
            {newHiresByRate.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-[var(--color-status-warning)]" />
                  <h3 className="text-sm font-semibold text-[var(--color-status-warning)]">
                    新規入社 ({newHireEmployees.length}名)
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    契約開始は各社員の入社日
                  </span>
                </div>
                {newHiresByRate.map(({ rate, emps }) => {
                  const allSelected = emps.every((e) => state.employeeIds.includes(e.id));
                  return (
                    <div
                      key={`nh-${rate}`}
                      className="border border-[color-mix(in_srgb,var(--color-status-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-status-warning)_4%,transparent)] rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">
                          ¥{rate.toLocaleString()} / 時間 ({emps.length}名)
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleAllInGroup(emps)}
                          className="text-xs font-medium text-[var(--color-status-warning)] hover:opacity-80 transition-colors"
                        >
                          {allSelected ? "すべて解除" : "すべて選択"}
                        </button>
                      </div>
                      <div className="space-y-2">
                        {emps.map((emp) => (
                          <EmployeeCheckRow
                            key={emp.id}
                            emp={emp}
                            checked={state.employeeIds.includes(emp.id)}
                            onToggle={(checked) => toggleEmployee(emp.id, checked)}
                            showHireDateAsStart
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Split preview */}
          {selectedGroups.size > 1 && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-xl border border-[color-mix(in_srgb,var(--color-status-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-status-warning)_8%,transparent)] p-4"
            >
              <div className="mb-3 flex items-center gap-2.5">
                <div className="rounded-lg bg-[color-mix(in_srgb,var(--color-status-warning)_15%,transparent)] p-1.5">
                  <AlertTriangle className="h-4 w-4 text-[var(--color-status-warning)]" />
                </div>
                <span className="text-sm font-semibold text-[var(--color-status-warning)]">
                  単価・開始日が異なるため {selectedGroups.size} 件の契約書に分割されます
                </span>
              </div>
              <div className="space-y-2">
                {Array.from(selectedGroups.entries()).map(([key, group]) => (
                  <div key={key} className="rounded-lg bg-white p-3 text-sm shadow-xs dark:bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-violet-400 tabular-nums">
                          ¥{group.rate.toLocaleString()}/h
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-mono tabular-nums text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatJpDate(group.startDate)}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
                            group.kind === "existing"
                              ? "bg-primary/10 text-primary ring-primary/20 dark:bg-primary/15 dark:text-primary/90 dark:ring-primary/30"
                              : "bg-[var(--color-status-warning-muted)] text-[var(--color-status-warning)] ring-[color-mix(in_srgb,var(--color-status-warning)_25%,transparent)]"
                          )}
                        >
                          {group.kind === "existing" ? "既存社員" : "新規入社"}
                        </span>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20 dark:bg-primary/15 dark:text-primary/90 dark:ring-primary/30">
                        {group.emps.length} 名
                      </span>
                    </div>
                    <p className="mt-1.5 truncate text-xs text-muted-foreground">
                      {group.emps.map((e) => e.fullName).join("、")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => wizard.setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />戻る
            </Button>
            <Button onClick={handleSubmit} disabled={state.employeeIds.length === 0 || create.isPending}>
              {create.isPending
                ? "作成中..."
                : selectedGroups.size > 1
                ? `${selectedGroups.size} 件の契約書を作成`
                : `契約を作成 (${state.employeeIds.length}名)`}
            </Button>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}

function EmployeeCheckRow({
  emp,
  checked,
  onToggle,
  showHireDateAsStart = false,
}: {
  emp: EmployeeWithRate;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  showHireDateAsStart?: boolean;
}) {
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
      <span className={cn(isRetired && "text-muted-foreground")}>{emp.fullName}</span>
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
