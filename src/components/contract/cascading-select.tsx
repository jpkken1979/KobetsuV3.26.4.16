import { useCallback, useMemo } from "react";
import { useContractFormStore } from "@/stores/contract-form";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useFactoryCascade } from "@/lib/hooks/use-factories";
import { Building2, Factory as FactoryIcon, Layers, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Factory } from "@/lib/api";

const RESET_LINE_DEPENDENT_FIELDS = {
  factoryId: null,
  startDate: "",
  endDate: "",
  contractDate: "",
  notificationDate: "",
  workDays: "",
  workStartTime: "",
  workEndTime: "",
  breakMinutes: 0,
  jobDescription: "",
  overtimeMax: "",
  supervisorName: "",
  supervisorDept: "",
  supervisorPhone: "",
  complaintHandlerClient: "",
  complaintHandlerUns: "",
  hakenmotoManager: "",
  hourlyRate: 0,
  overtimeRate: 0,
  nightShiftRate: 0,
  holidayRate: 0,
  employeeIds: [] as number[],
  factoryConflictDate: "",
  factoryContractPeriod: "",
  notes: "",
};

function CascadeSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton h-9 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function CascadingSelect() {
  const { data, updateField, updateFields, nextStep } =
    useContractFormStore();
  const { data: companies } = useCompanies();
  const { data: cascade, isLoading: isCascadeLoading } = useFactoryCascade(data.companyId ?? 0);

  const selectedFactory = data.selectedFactoryName;
  const selectedDept = data.selectedDeptName;

  const factoryNames = useMemo(() => {
    if (!cascade?.grouped) return [];
    return Object.keys(cascade.grouped);
  }, [cascade]);

  const departments = useMemo(() => {
    if (!cascade?.grouped || !selectedFactory) return [];
    return Object.keys(cascade.grouped[selectedFactory] || {});
  }, [cascade, selectedFactory]);

  const lines = useMemo(() => {
    if (!cascade?.grouped || !selectedFactory || !selectedDept) return [];
    return cascade.grouped[selectedFactory]?.[selectedDept] || [];
  }, [cascade, selectedFactory, selectedDept]);

  const handleCompanySelect = useCallback(
    (companyId: number) => {
      updateFields({
        companyId,
        selectedFactoryName: "",
        selectedDeptName: "",
        ...RESET_LINE_DEPENDENT_FIELDS,
      });
    },
    [updateFields]
  );

  const handleFactorySelect = useCallback((factoryName: string) => {
    updateFields({
      selectedFactoryName: factoryName,
      selectedDeptName: "",
      ...RESET_LINE_DEPENDENT_FIELDS,
    });
  }, [updateFields]);

  const handleDeptSelect = useCallback((dept: string) => {
    updateFields({
      selectedDeptName: dept,
      ...RESET_LINE_DEPENDENT_FIELDS,
    });
  }, [updateFields]);

  const handleLineSelect = useCallback(
    (factory: Factory) => {
      updateField("factoryId", factory.id);

      updateFields({
        jobDescription: factory.jobDescription || "",
        workDays: factory.workDays || "",
        breakMinutes: factory.breakTime || 60,
        overtimeMax: factory.overtimeHours || "",
        supervisorName: factory.supervisorName || "",
        supervisorDept: factory.supervisorDept || "",
        supervisorPhone: factory.supervisorPhone || "",
        complaintHandlerClient: factory.complaintClientName || "",
        complaintHandlerUns: factory.complaintUnsName || "",
        hakenmotoManager: factory.managerUnsName || "",
        hourlyRate: factory.hourlyRate ?? 0,
        overtimeRate: factory.hourlyRate
          ? Math.round(factory.hourlyRate * 1.25)
          : 0,
        nightShiftRate: factory.hourlyRate
          ? Math.round(factory.hourlyRate * 1.25)
          : 0,
        holidayRate: factory.hourlyRate
          ? Math.round(factory.hourlyRate * 1.35)
          : 0,
        factoryConflictDate: factory.conflictDate || "",
        factoryContractPeriod: factory.contractPeriod || (factory.conflictDate ? "teishokubi" : ""),
      });

      if (factory.workHoursDay) {
        const [dayStart, dayEnd] = factory.workHoursDay.split("～");
        if (dayStart && dayEnd) {
          updateFields({
            workStartTime: dayStart.trim(),
            workEndTime: dayEnd.trim(),
          });
        }
      }
    },
    [updateField, updateFields]
  );

  const selectedCompany = companies?.find(
    (c) => c.id === data.companyId
  );

  const canProceed = data.companyId && data.factoryId;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">派遣先を選択</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          企業 → 工場 → 配属先 → ライン の順に選択してください
        </p>
      </div>

      {/* Breadcrumb of current selection */}
      {(data.companyId || selectedFactory || selectedDept || data.factoryId) && (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          {selectedCompany && (
            <span className="rounded-md bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/25 dark:bg-primary/15 dark:text-primary/90 dark:ring-primary/25">
              {selectedCompany.name}
            </span>
          )}
          {selectedFactory && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
              <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary/80 ring-1 ring-inset ring-primary/20 dark:bg-primary/10 dark:text-primary/70 dark:ring-primary/20">
                {selectedFactory}
              </span>
            </>
          )}
          {selectedDept && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
              <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border">
                {selectedDept}
              </span>
            </>
          )}
          {data.factoryId && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
              <span className="rounded-md bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-700">
                {lines.find((l) => l.id === data.factoryId)?.lineName ??
                  "選択済"}
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
                aria-pressed={data.companyId === company.id}
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-left text-sm transition-all",
                  data.companyId === company.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-muted/60"
                )}
              >
                <span className="font-medium">{company.name}</span>
                <span className="ml-1.5 text-xs opacity-60">
                  ({company.factories?.length ?? 0})
                </span>
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
            {data.companyId && isCascadeLoading ? (
              <CascadeSkeleton />
            ) : factoryNames.length > 0 ? (
              factoryNames.map((name) => (
                <button
                  key={name}
                  onClick={() => handleFactorySelect(name)}
                  aria-pressed={selectedFactory === name}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm transition-all",
                    selectedFactory === name
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
                <p className="text-xs text-muted-foreground/60">
                  企業を選択
                </p>
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
                  aria-pressed={selectedDept === dept}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm transition-all",
                    selectedDept === dept
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
                  {selectedFactory
                    ? "配属先がありません"
                    : "工場を選択"}
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
                  aria-pressed={data.factoryId === line.id}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm transition-all",
                    data.factoryId === line.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-muted/60"
                  )}
                >
                  <span>{line.lineName || "デフォルト"}</span>
                  {line.hourlyRate && (
                    <span className="ml-2 text-xs opacity-60">
                      ¥{line.hourlyRate}/h
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <Layers className="mb-1 h-6 w-6 text-muted-foreground/20" aria-hidden="true" />
                <p className="text-xs text-muted-foreground/60">
                  {selectedDept
                    ? "ラインがありません"
                    : "配属先を選択"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Auto-fill confirmation */}
      {data.factoryId && (
        <div className="rounded-xl border border-green-200/60 bg-green-50/50 p-4 dark:border-green-800/40 dark:bg-green-950/30">
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">
            工場データから自動入力しました
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-green-700 dark:text-green-400/80">
            <span>時給: ¥{data.hourlyRate}/h</span>
            <span>残業: ¥{data.overtimeRate}/h</span>
            <span>指揮命令者: {data.supervisorName || "未設定"}</span>
            <span>業務内容: {data.jobDescription?.slice(0, 30) || "未設定"}...</span>
            <span>抵触日: {data.factoryConflictDate || "未設定"}</span>
            <span>契約期間: {data.factoryContractPeriod === "teishokubi" ? "抵触日まで" : data.factoryContractPeriod === "1month" ? "毎月" : data.factoryContractPeriod === "3months" ? "3ヶ月毎" : data.factoryContractPeriod === "6months" ? "6ヶ月毎" : data.factoryContractPeriod === "1year" ? "1年" : "未設定"}</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-end pt-2">
        <Button
          size="lg"
          onClick={nextStep}
          disabled={!canProceed}
        >
          次へ: 契約期間
        </Button>
      </div>
    </div>
  );
}
