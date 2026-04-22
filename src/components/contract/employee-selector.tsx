import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useContractFormStore } from "@/stores/contract-form";
import { useEmployees } from "@/lib/hooks/use-employees";
import { useCreateContract } from "@/lib/hooks/use-contracts";
import { cn } from "@/lib/utils";
import { Search, User, AlertTriangle, Check, Loader2, History } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Textarea } from "@/components/ui/textarea";
import { api, type Employee } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function EmployeeSelector() {
  const { data, updateField, prevStep, reset } = useContractFormStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const createContract = useCreateContract();

  const {
    data: employees,
    isLoading: isEmployeesLoading,
    isError: isEmployeesError,
    error: employeesError,
    refetch: refetchEmployees,
  } = useEmployees({
    factoryId: data.factoryId ?? undefined,
  });

  // Secondary query: retired employees of the same company (factoryId=null after resignation)
  // Only fires when the toggle is ON
  const {
    data: retiredEmployees,
    isLoading: isRetiredLoading,
    isError: isRetiredError,
    error: retiredError,
    refetch: refetchRetired,
  } = useQuery({
    queryKey: queryKeys.employees.all({ companyId: data.companyId ?? undefined, status: "inactive" }),
    queryFn: () => api.getEmployees({ companyId: data.companyId ?? undefined, status: "inactive" }),
    enabled: includeInactive && !!data.companyId,
  });

  // Merge both lists for selected-employee lookup (avoid duplicates)
  const allKnownEmployees = useMemo(() => {
    const mainIds = new Set((employees || []).map((e) => e.id));
    const retired = (retiredEmployees || []).filter((e) => !mainIds.has(e.id));
    return [...(employees || []), ...retired];
  }, [employees, retiredEmployees]);

  const filteredEmployees = useMemo(() => {
    const availableEmployees = employees || [];
    if (!search) return availableEmployees;
    const s = search.toLowerCase();
    return availableEmployees.filter(
      (e) =>
        e.fullName?.toLowerCase().includes(s) ||
        e.katakanaName?.toLowerCase().includes(s) ||
        e.employeeNumber?.includes(s)
    );
  }, [employees, search]);

  // Retired list (deduplicated from main list, filtered by search)
  const filteredRetired = useMemo(() => {
    const mainIds = new Set((employees || []).map((e) => e.id));
    const unique = (retiredEmployees || []).filter((e) => !mainIds.has(e.id));
    if (!search) return unique;
    const s = search.toLowerCase();
    return unique.filter(
      (e) =>
        e.fullName?.toLowerCase().includes(s) ||
        e.katakanaName?.toLowerCase().includes(s) ||
        e.employeeNumber?.includes(s)
    );
  }, [retiredEmployees, employees, search]);

  const toggleEmployee = useCallback(
    (empId: number) => {
      const target = allKnownEmployees.find((employee) => employee.id === empId);
      if (!target) return;
      const isAssignable = (target.factoryId ?? null) === (data.factoryId ?? null);
      if (!isAssignable && !data.employeeIds.includes(empId)) {
        toast.error("この社員は選択中の工場・ラインに未配属のため選択できません");
        return;
      }
      const current = data.employeeIds;
      const next = current.includes(empId)
        ? current.filter((id) => id !== empId)
        : [...current, empId];
      updateField("employeeIds", next);
    },
    [allKnownEmployees, data.employeeIds, data.factoryId, updateField]
  );

  const selectedEmployees = useMemo(() => {
    const employeesById = new Map(allKnownEmployees.map((e) => [e.id, e]));
    return data.employeeIds
      .map((employeeId) => employeesById.get(employeeId))
      .filter((employee): employee is Employee => employee !== undefined);
  }, [data.employeeIds, allKnownEmployees]);

  const selectedByRate = useMemo(() => {
    const groups = new Map<number, Employee[]>();
    const seenIds = new Set<number>();
    for (const emp of selectedEmployees) {
      if (seenIds.has(emp.id)) continue;
      seenIds.add(emp.id);
      const rate = emp.billingRate ?? emp.hourlyRate ?? data.hourlyRate;
      if (!groups.has(rate)) groups.set(rate, []);
      groups.get(rate)!.push(emp);
    }
    return groups;
  }, [selectedEmployees, data.hourlyRate]);

  const allFilteredSelected = filteredEmployees.length > 0 &&
    filteredEmployees.every(e => data.employeeIds.includes(e.id));

  const handleToggleAll = useCallback(() => {
    const allIds = filteredEmployees.map(e => e.id);
    if (allFilteredSelected) {
      updateField("employeeIds", data.employeeIds.filter(id => !allIds.includes(id)));
    } else {
      const merged = [...new Set([...data.employeeIds, ...allIds])];
      updateField("employeeIds", merged);
    }
  }, [filteredEmployees, data.employeeIds, allFilteredSelected, updateField]);

  function getEmploymentType(hireDate: string | null): {
    label: string;
    color: string;
  } {
    if (!hireDate) return { label: "不明", color: "bg-muted text-muted-foreground ring-border" };
    const years =
      (Date.now() - new Date(hireDate).getTime()) /
      (365.25 * 24 * 60 * 60 * 1000);
    if (years > 3)
      return {
        label: "無期雇用",
        color: "bg-primary/10 text-primary ring-primary/20 dark:bg-primary/15 dark:text-primary/90 dark:ring-primary/30",
      };
    return {
      label: "有期雇用",
      color: "bg-[var(--color-status-warning-muted)] text-[var(--color-status-warning)] ring-[color-mix(in_srgb,var(--color-status-warning)_25%,transparent)]",
    };
  }

  const handleSubmit = useCallback(async () => {
    if (selectedByRate.size === 0) return;

    const errors: string[] = [];
    const created: string[] = [];

    for (const [rate, emps] of selectedByRate) {
      try {
        const result = await createContract.mutateAsync({
          __silent: true,
          companyId: data.companyId,
          factoryId: data.factoryId,
          startDate: data.startDate,
          endDate: data.endDate,
          contractDate: data.contractDate,
          notificationDate: data.notificationDate,
          workDays: data.workDays,
          workStartTime: data.workStartTime,
          workEndTime: data.workEndTime,
          breakMinutes: data.breakMinutes,
          jobDescription: data.jobDescription,
          responsibilityLevel: data.responsibilityLevel,
          overtimeMax: data.overtimeMax,
          supervisorName: data.supervisorName,
          supervisorDept: data.supervisorDept,
          supervisorPhone: data.supervisorPhone,
          complaintHandlerClient: data.complaintHandlerClient,
          complaintHandlerUns: data.complaintHandlerUns,
          hakenmotoManager: data.hakenmotoManager,
          safetyMeasures: data.safetyMeasures,
          terminationMeasures: data.terminationMeasures,
          welfare: data.welfare,
          isKyoteiTaisho: data.isKyoteiTaisho,
          hourlyRate: rate,
          overtimeRate: Math.round(rate * 1.25),
          nightShiftRate: Math.round(rate * 1.25),
          holidayRate: Math.round(rate * 1.35),
          notes: data.notes,
          employeeAssignments: emps.map((e) => ({
            employeeId: e.id,
            hourlyRate: e.billingRate ?? e.hourlyRate ?? rate,
          })),
        });
        created.push(result.contractNumber ?? `¥${rate.toLocaleString()}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "エラー";
        errors.push(`¥${rate.toLocaleString()}: ${msg}`);
      }
    }

    if (errors.length > 0 && created.length > 0) {
      toast.warning(`${created.length}件作成済、${errors.length}件失敗`, {
        description: errors.join("\n"),
      });
    } else if (errors.length > 0) {
      toast.error("契約作成に失敗しました", { description: errors[0] });
      return;
    }

    if (created.length > 0) {
      toast.success(`${created.length}件の契約を作成しました`, {
        description: selectedByRate.size > 1 ? "単価グループごとに分割して作成しました" : created[0],
      });
      reset();
      navigate({ to: "/contracts" });
    }
  }, [selectedByRate, data, createContract, reset, navigate]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">派遣社員の選択</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          この工場・ラインに明示的に配属されている社員のみ選択できます。
          単価が異なる社員は自動的に別の契約書に分割されます。
        </p>
      </div>

      {/* Search + toggle */}
      <div className="space-y-2">
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
            {selectedEmployees.length} 名
          </span>
        </div>
        {/* Toggle: include retired employees (for retroactive contracts) */}
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-primary"
          />
          <History className="h-3 w-3" />
          元従業員を含む（遡及契約用）
        </label>
      </div>

      {/* Employee list */}
      <div className="max-h-80 space-y-0.5 overflow-y-auto rounded-lg border border-border/60 p-2 shadow-[var(--shadow-card)]">
        {isEmployeesLoading && (
          <div className="flex flex-col items-center py-10 text-center">
            <Loader2 className="mb-2 h-7 w-7 animate-spin text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">社員一覧を読み込み中...</p>
          </div>
        )}

        {isEmployeesError && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-red-500">
              社員一覧の取得に失敗しました
              {employeesError instanceof Error ? `: ${employeesError.message}` : ""}
            </p>
            <Button size="sm" variant="outline" onClick={() => void refetchEmployees()}>
              再試行
            </Button>
          </div>
        )}

        {filteredEmployees.length > 0 && (
          <div className="flex items-center justify-between px-3 pb-1 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              この工場・ラインの社員
            </p>
            <button
              onClick={handleToggleAll}
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {allFilteredSelected ? "すべて解除" : "すべて選択"}
            </button>
          </div>
        )}
        {!isEmployeesLoading && !isEmployeesError && filteredEmployees.map((emp) => (
          <EmployeeRow
            key={emp.id}
            employee={emp}
            isSelected={data.employeeIds.includes(emp.id)}
            contractRate={data.hourlyRate}
            onToggle={() => toggleEmployee(emp.id)}
            getEmploymentType={getEmploymentType}
          />
        ))}

        {!isEmployeesLoading && !isEmployeesError && filteredEmployees.length === 0 && !includeInactive && (
          <div className="flex flex-col items-center py-10 text-center">
            <User className="mb-2 h-8 w-8 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">社員が見つかりません</p>
          </div>
        )}

        {/* Retired employees section — only when toggle is ON */}
        {includeInactive && filteredRetired.length > 0 && (
          <>
            <div className="flex items-center justify-between px-3 pb-1 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/80">
                退職済み・元従業員
              </p>
              <span className="text-[10px] text-muted-foreground">{filteredRetired.length} 名</span>
            </div>
            {filteredRetired.map((emp) => (
              <EmployeeRow
                key={emp.id}
                employee={emp}
                isSelected={data.employeeIds.includes(emp.id)}
                contractRate={data.hourlyRate}
                onToggle={() => toggleEmployee(emp.id)}
                getEmploymentType={getEmploymentType}
                isRetired
                isDisabled={(emp.factoryId ?? null) !== (data.factoryId ?? null)}
              />
            ))}
          </>
        )}

        {includeInactive && isRetiredLoading && (
          <div className="flex flex-col items-center py-6 text-center">
            <Loader2 className="mb-2 h-6 w-6 animate-spin text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">元従業員を読み込み中...</p>
          </div>
        )}

        {includeInactive && isRetiredError && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-xs text-red-500">
              元従業員の取得に失敗しました
              {retiredError instanceof Error ? `: ${retiredError.message}` : ""}
            </p>
            <Button size="sm" variant="outline" onClick={() => void refetchRetired()}>
              再試行
            </Button>
          </div>
        )}

        {includeInactive &&
          !isEmployeesLoading &&
          !isEmployeesError &&
          !isRetiredLoading &&
          !isRetiredError &&
          filteredEmployees.length === 0 &&
          filteredRetired.length === 0 && (
          <div className="flex flex-col items-center py-10 text-center">
            <User className="mb-2 h-8 w-8 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">社員が見つかりません</p>
          </div>
        )}
      </div>

      {/* Contract split preview */}
      {selectedByRate.size > 1 && (
        <div role="alert" aria-live="polite" className="rounded-xl border border-[color-mix(in_srgb,var(--color-status-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-status-warning)_8%,transparent)] p-4">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="rounded-lg bg-[color-mix(in_srgb,var(--color-status-warning)_15%,transparent)] p-1.5">
              <AlertTriangle className="h-4 w-4 text-[var(--color-status-warning)]" />
            </div>
            <span className="text-sm font-semibold text-[var(--color-status-warning)]">
              単価が異なるため {selectedByRate.size} 件の契約書に分割されます
            </span>
          </div>
          <div className="space-y-2">
            {Array.from(selectedByRate.entries()).map(([rate, emps]) => (
              <div
                key={rate}
                className="rounded-lg bg-white p-3 text-sm shadow-xs dark:bg-card"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-violet-400 tabular-nums">
                    ¥{rate.toLocaleString()}/h
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      残業 ¥{Math.round(rate * 1.25).toLocaleString()} ・ 休日 ¥{Math.round(rate * 1.35).toLocaleString()}
                    </span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20 dark:bg-primary/15 dark:text-primary/90 dark:ring-primary/30">
                      {emps.length} 名
                    </span>
                  </div>
                </div>
                <p className="mt-1.5 truncate text-xs text-muted-foreground">
                  {emps.map((e) => e.fullName).join("、")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label htmlFor="contract-notes" className="mb-1.5 block text-sm font-medium">備考</label>
        <Textarea
          id="contract-notes"
          value={data.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-input/80 bg-background px-3 py-2.5 text-sm shadow-xs transition-all placeholder:text-muted-foreground/50 focus:border-primary/30 focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
          placeholder="任意のメモ..."
        />
      </div>

      {/* Navigation + Submit */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" size="lg" onClick={prevStep}>
          戻る
        </Button>
        <Button
          size="lg"
          onClick={selectedByRate.size > 1 ? () => setShowConfirm(true) : handleSubmit}
          disabled={selectedEmployees.length === 0 || createContract.isPending}
          className={cn(
            selectedEmployees.length > 0 && !createContract.isPending
              ? "bg-[var(--color-status-ok)] text-white hover:bg-[color-mix(in_srgb,var(--color-status-ok)_85%,black)] shadow-sm shadow-[color-mix(in_srgb,var(--color-status-ok)_30%,transparent)]"
              : ""
          )}
        >
          {createContract.isPending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              作成中...
            </span>
          ) : selectedByRate.size > 1 ? (
            `${selectedByRate.size} 件の契約書を作成`
          ) : (
            "契約書を作成"
          )}
        </Button>
      </div>

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title={`${selectedByRate.size} 件の契約書を作成`}
        description={`単価が異なるため ${selectedByRate.size} 件に分割されます。続けてよろしいですか？`}
        confirmLabel="作成する"
        onConfirm={() => { setShowConfirm(false); void handleSubmit(); }}
      />
    </div>
  );
}

function EmployeeRow({
  employee,
  isSelected,
  contractRate,
  onToggle,
  getEmploymentType,
  isRetired = false,
  isDisabled = false,
}: {
  employee: Employee;
  isSelected: boolean;
  contractRate: number;
  onToggle: () => void;
  getEmploymentType: (d: string | null) => { label: string; color: string };
  isRetired?: boolean;
  isDisabled?: boolean;
}) {
  const empRate = employee.billingRate ?? employee.hourlyRate ?? contractRate;
  const isDifferentRate = empRate !== contractRate && contractRate > 0;
  const employment = getEmploymentType(employee.hireDate);

  return (
    <button
      onClick={onToggle}
      disabled={isDisabled}
      aria-pressed={isSelected}
      aria-label={`${employee.fullName} (${employee.employeeNumber}) を${isSelected ? "解除" : "選択"}${isDisabled ? "不可" : ""}`}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all",
        isDisabled && "cursor-not-allowed opacity-60",
        isSelected
          ? "bg-primary/6 ring-1 ring-primary/20"
          : "hover:bg-muted/40"
      )}
    >
      <div
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all",
          isSelected
            ? "border-violet-500 bg-primary text-primary-foreground shadow-sm"
            : "border-border/80"
        )}
      >
        {isSelected && <Check className="h-3 w-3" />}
      </div>

      <User className="h-4 w-4 shrink-0 text-muted-foreground/50" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-medium", isRetired ? "text-muted-foreground" : "text-foreground")}>
            {employee.fullName}
          </span>
          <span className="text-xs text-muted-foreground/60">
            {employee.employeeNumber}
          </span>
          {isRetired && (
            <span className="rounded-full bg-[var(--color-status-warning-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-status-warning)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--color-status-warning)_30%,transparent)]">
              退職済み
            </span>
          )}
          {isDisabled && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              配属不一致
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{employee.nationality || "--"}</span>
          <span className="text-muted-foreground/30">|</span>
          <span className={cn("rounded-full px-1.5 py-0.5 ring-1 ring-inset", employment.color)}>
            {employment.label}
          </span>
        </div>
      </div>

      <div className="text-right">
        <span
          className={cn(
            "mono-tabular text-sm font-semibold",
            isDifferentRate ? "text-[var(--color-status-warning)]" : ""
          )}
        >
          ¥{empRate?.toLocaleString()}
        </span>
        {isDifferentRate && (
          <p className="text-[10px] text-[var(--color-status-warning)]">契約と異なる単価</p>
        )}
      </div>
    </button>
  );
}
