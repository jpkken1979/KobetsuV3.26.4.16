import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useCompanies } from "@/lib/hooks/use-companies";
import {
  useNewHiresPreview,
  useNewHiresCreate,
  useBatchGenerateDocuments,
} from "@/lib/hooks/use-contracts";
import { cn } from "@/lib/utils";
import { AnimatedPage } from "@/components/ui/animated";
import {
  Section,
  StatCard,
  CompanySelector,
  BatchPageHeader,
  ResultHeader,
  PdfFilesList,
  SkippedLinesList,
  ResultActions,
  ResultScreen,
  StyledCheckbox,
  ConfirmationModalShell,
  PdfGenerationBanner,
} from "@/components/contract/batch-shared";
import { Badge } from "@/components/ui/badge";
import type {
  NewHiresPreviewResult,
  NewHiresPreviewLine,
  NewHiresPreviewEmployee,
  NewHiresRateGroup,
  NewHiresCreatedContract,
  NewHiresCreateResult,
} from "@/lib/api";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Calendar,
  UserPlus,
  AlertTriangle,
  Users,
  FileText,
  Loader2,
  XCircle,
  Search,
} from "lucide-react";
import { toast } from "sonner";

// NewHiresCreateResult already includes pdfFiles from the API type

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const Route = createFileRoute("/contracts/new-hires")({
  component: NewHiresBatch,
  errorComponent: ({ reset }) => (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <p className="text-lg font-semibold text-destructive">エラーが発生しました</p>
      <Button variant="outline" onClick={reset}>再試行</Button>
    </div>
  ),
  pendingComponent: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

function NewHiresBatch() {
  const { data: companies } = useCompanies();
  const newHiresPreview = useNewHiresPreview();
  const newHiresCreate = useNewHiresCreate();
  const batchGenerateDocs = useBatchGenerateDocuments();

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [hireDateFrom, setHireDateFrom] = useState("");
  const [hireDateTo, setHireDateTo] = useState(
    toLocalDateStr(new Date())
  );
  const [endDateOverride, setEndDateOverride] = useState("");
  const [useEndDateOverride, setUseEndDateOverride] = useState(false);
  const [generateDocs, setGenerateDocs] = useState(true);
  const [preview, setPreview] = useState<NewHiresPreviewResult | null>(null);
  const [excludedEmployees, setExcludedEmployees] = useState<Set<number>>(
    new Set()
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<NewHiresCreateResult | null>(null);

  const handleCompanyChange = useCallback((id: number) => {
    setCompanyId(id);
    setPreview(null);
    setResult(null);
    setExcludedEmployees(new Set());
  }, []);

  const handleSearch = useCallback(async () => {
    if (!companyId || !hireDateFrom) return;

    const data = {
      companyId,
      hireDateFrom,
      hireDateTo,
      endDate: useEndDateOverride && endDateOverride ? endDateOverride : undefined,
    };

    try {
      const res = await newHiresPreview.mutateAsync(data);
      setPreview(res);
      setExcludedEmployees(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "新規入社者の検索に失敗しました");
    }
  }, [
    companyId,
    hireDateFrom,
    hireDateTo,
    useEndDateOverride,
    endDateOverride,
    newHiresPreview,
  ]);

  const toggleEmployee = useCallback((empId: number) => {
    setExcludedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  }, []);

  const activeEmployeeCount = useMemo(() => {
    if (!preview) return 0;
    return preview.totalEmployees - excludedEmployees.size;
  }, [preview, excludedEmployees]);

  const handleConfirmAndCreate = useCallback(async () => {
    if (!companyId || !hireDateFrom) return;
    setShowConfirm(false);

    const data = {
      companyId,
      hireDateFrom,
      hireDateTo,
      endDate: useEndDateOverride && endDateOverride ? endDateOverride : undefined,
      generateDocs,
    };

    try {
      const res = await newHiresCreate.mutateAsync(data) as unknown as NewHiresCreateResult;

      if (generateDocs && res.contractIds?.length > 0) {
        const pdfResult = await batchGenerateDocs.mutateAsync(res.contractIds);
        setResult({ ...res, pdfFiles: pdfResult.files } as NewHiresCreateResult);
      } else {
        setResult(res);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "新規入社一括作成に失敗しました");
    }
  }, [
    companyId,
    hireDateFrom,
    hireDateTo,
    useEndDateOverride,
    endDateOverride,
    generateDocs,
    newHiresCreate,
    batchGenerateDocs,
  ]);

  const canSearch = companyId && hireDateFrom;
  const canCreate =
    preview &&
    preview.totalEmployees > 0 &&
    !newHiresCreate.isPending &&
    !newHiresPreview.isPending;

  // ─── Results Screen ───────────────────────────────────────────────
  if (result) {
    return (
      <ResultScreen>
        <ResultHeader title="新規入社一括作成完了" created={result.created} skipped={result.skipped} />

        {/* Created contracts */}
        {result.contracts?.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border/60 bg-card shadow-[var(--shadow-card)]">
            <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
              <h3 className="text-sm font-semibold">作成された契約</h3>
            </div>
            <div className="divide-y divide-border/40">
              {result.contracts.map((c: NewHiresCreatedContract) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <span className="font-medium text-primary">
                      {c.contractNumber}
                    </span>
                    <span className="ml-3 text-sm text-muted-foreground">
                      {c.factoryName} {c.department} {c.lineName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-xs text-muted-foreground mono-tabular">
                      {c.startDate} ~ {c.endDate}
                    </span>
                    <span className="mono-tabular">
                      ¥{c.hourlyRate?.toLocaleString()}/h
                    </span>
                    <Badge variant="info" size="sm">{c.employeeCount}名</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Employee details per contract */}
        {result.contracts?.some((c: NewHiresCreatedContract) => c.employees?.length > 0) && (
          <div className="overflow-hidden rounded-lg border border-border/60 bg-card shadow-[var(--shadow-card)]">
            <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
              <h3 className="text-sm font-semibold">
                社員別の個別開始日
              </h3>
            </div>
            <div className="divide-y divide-border/40">
              {result.contracts.map((c: NewHiresCreatedContract) =>
                c.employees?.map((emp: { id: number; fullName: string; individualStartDate: string }) => (
                  <div
                    key={`${c.id}-${emp.id}`}
                    className="flex items-center justify-between px-4 py-2"
                  >
                    <span className="text-sm">{emp.fullName}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      開始: {emp.individualStartDate}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {(result.pdfFiles?.length ?? 0) > 0 && (
          <PdfFilesList files={result.pdfFiles!} />
        )}

        {result.skippedDetails?.length > 0 && (
          <SkippedLinesList items={result.skippedDetails} />
        )}

        <ResultActions onReset={() => { setResult(null); setPreview(null); }} />
      </ResultScreen>
    );
  }

  return (
    <AnimatedPage className="space-y-6">
      {/* Confirmation Modal */}
      {preview && (
        <ConfirmationModalShell
          open={showConfirm}
          onClose={() => setShowConfirm(false)}
          title="新規入社一括作成の確認"
          subtitle={`入社日 ${preview.hireDateFrom} ～ ${preview.hireDateTo} の新規入社者の契約を作成します`}
          stats={[
            { label: "契約", value: preview.totalContracts },
            { label: "社員", value: activeEmployeeCount },
            { label: "ライン", value: preview.lines?.length || 0 },
          ]}
          isPending={newHiresCreate.isPending || batchGenerateDocs.isPending}
          totalContracts={preview.totalContracts}
          onConfirm={handleConfirmAndCreate}
        >
          {generateDocs && <PdfGenerationBanner />}
        </ConfirmationModalShell>
      )}

      {/* Header */}
      <BatchPageHeader
        title="新規入社一括作成"
        description="入社日で新規入社者を検出し、個別契約書・通知書・管理台帳を一括作成します"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          {/* Step 1: Company */}
          <CompanySelector
            companies={companies}
            selectedId={companyId}
            onChange={handleCompanyChange}
          />

          {/* Step 2: Date Range */}
          {companyId && (
            <Section icon={Calendar} title="入社日の範囲" step={2}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    入社日 (から)
                  </label>
                  <input
                    type="date"
                    value={hireDateFrom}
                    onChange={(e) => setHireDateFrom(e.target.value)}
                    className="w-full rounded-lg border border-input/80 bg-background px-3 py-2.5 text-sm shadow-xs transition-all focus:border-primary/30 focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    入社日 (まで)
                  </label>
                  <input
                    type="date"
                    value={hireDateTo}
                    onChange={(e) => setHireDateTo(e.target.value)}
                    className="w-full rounded-lg border border-input/80 bg-background px-3 py-2.5 text-sm shadow-xs transition-all focus:border-primary/30 focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              <p className="mt-2 text-xs text-primary/70 dark:text-primary/60">
                この期間に入社 (actualHireDate / hireDate)
                した社員を自動検出します
              </p>

              {/* End date override */}
              <div className="mt-4 border-t border-border/40 pt-4">
                <StyledCheckbox
                  checked={useEndDateOverride}
                  onChange={setUseEndDateOverride}
                  label="終了日を手動で設定"
                  description="未チェックの場合、各工場の抵触日/契約期間設定で自動計算"
                />
                {useEndDateOverride && (
                  <input
                    type="date"
                    value={endDateOverride}
                    onChange={(e) => setEndDateOverride(e.target.value)}
                    className="mt-3 w-full rounded-lg border border-input/80 bg-background px-3 py-2.5 text-sm shadow-xs transition-all focus:border-primary/30 focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
                  />
                )}
              </div>

              {/* PDF option */}
              <div className="mt-4 border-t border-border/40 pt-4">
                <StyledCheckbox
                  checked={generateDocs}
                  onChange={setGenerateDocs}
                  label="PDFも生成"
                  description="個別契約書+通知書・派遣先管理台帳・派遣元管理台帳"
                />
              </div>

              {/* Search button */}
              <Button
                className="mt-4 w-full"
                onClick={handleSearch}
                disabled={!canSearch || newHiresPreview.isPending}
              >
                {newHiresPreview.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    検索中...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    新規入社者を検索
                  </>
                )}
              </Button>
            </Section>
          )}
        </div>

        {/* Right column: Preview / Results */}
        <div className="space-y-4">
          {preview && preview.lines?.length > 0 ? (
            <div className="sticky top-6 space-y-4">
              {/* Summary */}
              <div className="rounded-lg border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
                <h3 className="mb-4 text-sm font-semibold">
                  検出結果: <span className="mono-tabular">{preview.hireDateFrom} ～ {preview.hireDateTo}</span>
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard
                    label="契約数"
                    value={preview.totalContracts}
                    icon={FileText}
                  />
                  <StatCard
                    label="新規入社"
                    value={preview.totalEmployees}
                    icon={UserPlus}
                  />
                  <StatCard
                    label="ライン"
                    value={preview.lines.length}
                    icon={Users}
                  />
                </div>
              </div>

              {/* Employee detail per line */}
              <div className="rounded-lg border border-border/60 bg-card shadow-[var(--shadow-card)]">
                <div className="border-b border-border/60 px-4 py-3">
                  <h3 className="text-sm font-semibold">
                    ライン別・社員別詳細
                  </h3>
                </div>
                <div className="max-h-[500px] divide-y divide-border/40 overflow-y-auto">
                  {preview.lines.map((line: NewHiresPreviewLine) => (
                    <div key={line.factoryId} className="px-4 py-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="max-w-[200px] truncate text-sm font-semibold">
                          {line.factoryName}{" "}
                          {line.lineName || line.department}
                        </span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="tabular-nums text-muted-foreground">
                            ~{line.effectiveEndDate}
                          </span>
                          {line.conflictDate && (
                            <span
                              className="text-[var(--color-status-warning)]"
                              title="抵触日"
                            >
                              抵触{line.conflictDate}
                            </span>
                          )}
                        </div>
                      </div>

                      {line.rateGroups.map((rg: NewHiresRateGroup) => (
                        <div key={rg.rate} className="hover-lift mb-2 rounded-md border border-border bg-card p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="mono-tabular text-xs font-bold text-[var(--color-status-info)]">¥{rg.rate.toLocaleString()}/h</span>
                            <Badge variant="info">{rg.employees.length}名</Badge>
                          </div>
                          <ul className="space-y-1">
                            {rg.employees.map((emp: NewHiresPreviewEmployee) => {
                              const isExcluded = excludedEmployees.has(emp.id);
                              const visaExpired =
                                emp.visaExpiry &&
                                emp.visaExpiry <
                                  toLocalDateStr(new Date());
                              return (
                                <li key={emp.id}>
                                  <button
                                    onClick={() => toggleEmployee(emp.id)}
                                    className={cn(
                                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-all",
                                      isExcluded
                                        ? "bg-[var(--color-status-error-muted)] opacity-50"
                                        : "hover:bg-muted/40"
                                    )}
                                  >
<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary dark:shadow-[0_0_4px_rgba(155,167,255,0.7)]" />
                                    <span className={cn("flex-1 truncate text-sm text-muted-foreground", isExcluded && "line-through")}>
                                      {emp.fullName}
                                    </span>
                                    <span className="tabular-nums text-muted-foreground">
                                      入社:{emp.effectiveHireDate}
                                    </span>
                                    {visaExpired && (
                                      <span title="ビザ期限切れ">
                                        <AlertTriangle className="h-3 w-3 text-[var(--color-status-error)]" />
                                      </span>
                                    )}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Create button */}
              <Button
                variant="success"
                className="w-full"
                onClick={() => setShowConfirm(true)}
                disabled={!canCreate}
              >
                <UserPlus className="h-4 w-4" />
                <span className="mono-tabular">{preview.totalContracts}</span>件の契約 {generateDocs ? "+ PDF" : ""} を一括作成
              </Button>
            </div>
          ) : preview && preview.lines?.length === 0 ? (
            <EmptyState
              icon={Users}
              title="該当する新規入社者が見つかりません"
              description="入社日の範囲を調整してください"
            />
          ) : companyId ? (
            <EmptyState
              icon={UserPlus}
              title="新規入社者を検索"
              description="入社日を設定して「検索」を押すと新規入社者が表示されます"
            />
          ) : null}

          {/* Skipped lines in preview */}
          {(preview?.skipped?.length ?? 0) > 0 && (
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--color-status-warning)_30%,transparent)] bg-[var(--color-status-warning-muted)] p-4">
              <h3 className="mb-2 text-sm font-semibold text-[var(--color-status-warning)]">
                対象外のライン
              </h3>
              <div className="space-y-1">
                {preview!.skipped!.map((s: { factoryName: string; lineName?: string; reason: string }, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs text-[var(--color-status-warning)]"
                  >
                    <XCircle className="h-3 w-3" />
                    <span>
                      {s.factoryName} {s.lineName}
                    </span>
                    <span className="opacity-80">({s.reason})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AnimatedPage>
  );
}

