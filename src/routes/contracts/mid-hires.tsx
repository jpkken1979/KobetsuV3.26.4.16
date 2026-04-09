import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { useCompanies } from "@/lib/hooks/use-companies";
import {
  useMidHiresPreview,
  useMidHiresCreate,
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
import type {
  MidHiresPreviewResult,
  MidHiresCreatedContract,
  MidHiresCreateResult,
  Factory,
} from "@/lib/api";
import { MidHiresPreview } from "./-mid-hires-preview";
import { EmptyState } from "@/components/ui/empty-state";
import {
  UserPlus,
  Users,
  FileText,
  Loader2,
  Search,
  Building2,
  CalendarDays,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/contracts/mid-hires")({
  component: MidHiresBatch,
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

function MidHiresBatch() {
  const { data: companies } = useCompanies();
  const midHiresPreview = useMidHiresPreview();
  const midHiresCreate = useMidHiresCreate();
  const batchGenerateDocs = useBatchGenerateDocuments();

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [selectedFactoryIds, setSelectedFactoryIds] = useState<Set<number>>(new Set());
  const [conflictDateInput, setConflictDateInput] = useState("");
  const [contractPeriodInput, setContractPeriodInput] = useState(12);
  const [conflictDateOverrides, setConflictDateOverrides] = useState<Record<string, string>>({});
  const [startDateOverride, setStartDateOverride] = useState<string | undefined>(undefined);
  const [generateDocs, setGenerateDocs] = useState(true);
  const [preview, setPreview] = useState<MidHiresPreviewResult | null>(null);
  const [excludedFactoryIds, setExcludedFactoryIds] = useState<Set<number>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<MidHiresCreateResult | null>(null);

  // Factories of the selected company
  const selectedCompany = useMemo(
    () => companies?.find((c) => c.id === companyId) ?? null,
    [companies, companyId]
  );
  const availableFactories: Factory[] = useMemo(
    () => selectedCompany?.factories ?? [],
    [selectedCompany]
  );

  useEffect(() => {
    if (selectedCompany) {
      setConflictDateInput(selectedCompany.conflictDate ?? "");
      setContractPeriodInput(selectedCompany.contractPeriod ?? 12);
      setConflictDateOverrides({});
      setStartDateOverride(undefined);
    }
  }, [selectedCompany]);

  const periodStartDisplay = useMemo(() => {
    if (!conflictDateInput || !contractPeriodInput) return null;
    const d = new Date(conflictDateInput + "T00:00:00");
    d.setMonth(d.getMonth() - contractPeriodInput);
    return d.toISOString().split("T")[0];
  }, [conflictDateInput, contractPeriodInput]);

  const handleCompanyChange = useCallback((id: number) => {
    setCompanyId(id);
    setSelectedFactoryIds(new Set());
    setPreview(null);
    setResult(null);
    setExcludedFactoryIds(new Set());
  }, []);

  const toggleFactory = useCallback((id: number) => {
    setSelectedFactoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPreview(null);
  }, []);

  const toggleAllFactories = useCallback(() => {
    setSelectedFactoryIds((prev) => {
      if (prev.size === availableFactories.length) return new Set();
      return new Set(availableFactories.map((f) => f.id));
    });
    setPreview(null);
  }, [availableFactories]);

  const handleToggleFactory = useCallback((factoryId: number) => {
    setExcludedFactoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(factoryId)) next.delete(factoryId);
      else next.add(factoryId);
      return next;
    });
  }, []);

  const handleConflictDateOverride = useCallback((factoryId: string, date: string) => {
    setConflictDateOverrides((prev) => ({ ...prev, [factoryId]: date }));
  }, []);

  const activeEmployeeCount = useMemo(() => {
    if (!preview) return 0;
    const includedLines = preview.lines?.filter((l) => !excludedFactoryIds.has(l.factoryId)) ?? [];
    return includedLines.reduce((sum, l) => sum + l.totalEmployees, 0);
  }, [preview, excludedFactoryIds]);

  const activeContractCount = useMemo(() => {
    if (!preview) return 0;
    const includedLines = preview.lines?.filter((l) => !excludedFactoryIds.has(l.factoryId)) ?? [];
    return includedLines.reduce((sum, l) => sum + l.totalContracts, 0);
  }, [preview, excludedFactoryIds]);

  const handleSearch = useCallback(async () => {
    if (!companyId || !conflictDateInput) return;
    try {
      const factoryIds = selectedFactoryIds.size > 0 ? Array.from(selectedFactoryIds) : undefined;
      const res = await midHiresPreview.mutateAsync({
        companyId,
        factoryIds,
        conflictDateOverrides: Object.keys(conflictDateOverrides).length > 0 ? conflictDateOverrides : undefined,
        startDateOverride,
      });
      setPreview(res);
      setExcludedFactoryIds(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "途中入社者の検索に失敗しました");
    }
  }, [companyId, selectedFactoryIds, conflictDateInput, conflictDateOverrides, startDateOverride, midHiresPreview]);

  const handleConfirmAndCreate = useCallback(async () => {
    if (!companyId || !conflictDateInput) return;
    setShowConfirm(false);

    try {
      const includedFactoryIds = (selectedFactoryIds.size > 0
        ? Array.from(selectedFactoryIds)
        : (preview?.lines?.map((l) => l.factoryId) ?? [])
      ).filter((id) => !excludedFactoryIds.has(id));

      const res = await midHiresCreate.mutateAsync({
        companyId,
        factoryIds: includedFactoryIds.length > 0 ? includedFactoryIds : undefined,
        conflictDateOverrides: Object.keys(conflictDateOverrides).length > 0 ? conflictDateOverrides : undefined,
        startDateOverride,
        generateDocs,
      }) as unknown as MidHiresCreateResult;

      if (generateDocs && res.contractIds?.length > 0) {
        const pdfResult = await batchGenerateDocs.mutateAsync(res.contractIds);
        setResult({ ...res, pdfFiles: pdfResult.files } as MidHiresCreateResult);
      } else {
        setResult(res);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "途中入社一括作成に失敗しました");
    }
  }, [companyId, selectedFactoryIds, conflictDateInput, conflictDateOverrides, startDateOverride, generateDocs, midHiresCreate, batchGenerateDocs, preview, excludedFactoryIds]);

  const canSearch = !!companyId && !!conflictDateInput;
  const canCreate =
    preview &&
    activeContractCount > 0 &&
    !midHiresCreate.isPending &&
    !midHiresPreview.isPending;

  // ─── Results Screen ───────────────────────────────────────────────
  if (result) {
    return (
      <ResultScreen>
        <ResultHeader title="途中入社一括作成完了" created={result.created} skipped={result.skipped} />

        {result.contracts?.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
            <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
              <h3 className="text-sm font-semibold">作成された契約</h3>
            </div>
            <div className="divide-y divide-border/40">
              {result.contracts.map((c: MidHiresCreatedContract) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="font-medium text-primary">{c.contractNumber}</span>
                    <span className="ml-3 text-sm text-muted-foreground">
                      {c.factoryName} {c.department} {c.lineName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-xs text-muted-foreground">
                      {c.startDate} ~ {c.endDate}
                    </span>
                    <span className="font-mono text-xs font-bold text-blue-400">
                      ¥{c.hourlyRate?.toLocaleString()}/h
                    </span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20 dark:bg-primary/15 dark:text-primary/90 dark:ring-primary/30">
                      {c.employeeCount}名
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.contracts?.some((c: MidHiresCreatedContract) => c.employees?.length > 0) && (
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
            <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
              <h3 className="text-sm font-semibold">社員別の個別開始日</h3>
            </div>
            <div className="divide-y divide-border/40">
              {result.contracts.map((c: MidHiresCreatedContract) =>
                c.employees?.map((emp: { id: number; fullName: string | null; individualStartDate: string }) => (
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

        {(result.pdfFiles?.length ?? 0) > 0 && <PdfFilesList files={result.pdfFiles!} />}

        {result.skippedDetails?.length > 0 && <SkippedLinesList items={result.skippedDetails} />}

        <ResultActions onReset={() => { setResult(null); setPreview(null); }} />
      </ResultScreen>
    );
  }

  const allSelected = availableFactories.length > 0 && selectedFactoryIds.size === availableFactories.length;

  return (
    <AnimatedPage className="space-y-6">
      {/* Confirmation Modal */}
      {preview && (
        <ConfirmationModalShell
          open={showConfirm}
          onClose={() => setShowConfirm(false)}
          title="途中入社一括作成の確認"
          subtitle={`抵触日 ${conflictDateInput}${periodStartDisplay ? `（${periodStartDisplay}以降入社）` : ""}の社員の契約を一括作成します`}
          stats={[
            { label: "契約", value: preview.totalContracts },
            { label: "対象社員", value: activeEmployeeCount },
            { label: "ライン", value: preview.lines?.length || 0 },
          ]}
          isPending={midHiresCreate.isPending || batchGenerateDocs.isPending}
          totalContracts={preview.totalContracts}
          onConfirm={handleConfirmAndCreate}
        >
          {generateDocs && <PdfGenerationBanner />}
        </ConfirmationModalShell>
      )}

      {/* Header */}
      <BatchPageHeader
        title="途中入社一括作成"
        description="指定期間に入社した社員を検出し、個別契約書・通知書・管理台帳を一括作成します"
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          {/* Step 1: Company */}
          <CompanySelector
            companies={companies}
            selectedId={companyId}
            onChange={handleCompanyChange}
          />

          {/* Step 2: Factory selection */}
          {companyId && (
            <Section icon={Building2} title="工場・ラインの選択" step={2}>
              <p className="mb-3 text-xs text-primary/70 dark:text-primary/60">
                対象の工場・ラインを選択してください。未選択の場合は全工場が対象になります。
              </p>

              {availableFactories.length === 0 ? (
                <p className="text-xs text-muted-foreground">工場が登録されていません</p>
              ) : (
                <>
                  {/* Select all toggle */}
                  <button
                    type="button"
                    onClick={toggleAllFactories}
                    className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80"
                  >
                    {allSelected ? (
                      <CheckSquare className="h-3.5 w-3.5" />
                    ) : (
                      <Square className="h-3.5 w-3.5" />
                    )}
                    {allSelected ? "全選択解除" : "全て選択"}
                  </button>

                  <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                    {availableFactories.map((factory) => {
                      const checked = selectedFactoryIds.has(factory.id);
                      return (
                        <button
                          key={factory.id}
                          type="button"
                          onClick={() => toggleFactory(factory.id)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all",
                            checked
                              ? "border-primary/30 bg-primary/[0.06] text-foreground ring-1 ring-primary/20"
                              : "border-transparent hover:border-border/60 hover:bg-muted/20 text-muted-foreground"
                          )}
                        >
                          <div className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                            checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border/60 bg-background"
                          )}>
                            {checked && (
                              <svg className="h-2.5 w-2.5" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4L3.5 6.5L9 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span className="flex-1 truncate font-medium">
                            {factory.factoryName}
                          </span>
                          {factory.department && (
                            <span className="shrink-0 text-[10px] text-muted-foreground/60">
                              {factory.department}
                            </span>
                          )}
                          {factory.lineName && (
                            <span className="shrink-0 text-[10px] text-muted-foreground/50">
                              {factory.lineName}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {selectedFactoryIds.size > 0 && (
                    <p className="mt-2 text-xs text-primary/70">
                      {selectedFactoryIds.size}ライン選択中
                    </p>
                  )}
                </>
              )}
            </Section>
          )}

          {/* Step 3: 抵触日 + período */}
          {companyId && (
            <Section icon={CalendarDays} title="契約期間の設定" step={3}>
              <p className="mb-3 text-xs text-primary/70 dark:text-primary/60">
                会社の抵触日と契約期間を設定してください。入社日が検索対象期間内の社員が対象になります。
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="conflict-date-input" className="mb-1 block text-[11px] font-medium text-muted-foreground">
                    抵触日（会社）
                  </label>
                  <input
                    id="conflict-date-input"
                    type="date"
                    value={conflictDateInput}
                    onChange={(e) => { setConflictDateInput(e.target.value); setPreview(null); }}
                    className="w-full rounded-lg border border-input/60 bg-background px-3 py-2 text-sm focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/10"
                  />
                </div>
                <div>
                  <label htmlFor="contract-period-input" className="mb-1 block text-[11px] font-medium text-muted-foreground">
                    契約期間（ヶ月）
                  </label>
                  <input
                    id="contract-period-input"
                    type="number"
                    min={1}
                    max={60}
                    value={contractPeriodInput}
                    onChange={(e) => { setContractPeriodInput(Number(e.target.value)); setPreview(null); }}
                    className="w-full rounded-lg border border-input/60 bg-background px-3 py-2 text-sm focus:border-primary/30 focus:outline-none focus:ring-1 focus:ring-primary/10"
                  />
                </div>
              </div>
              {periodStartDisplay && (
                <div className="mt-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">検索対象期間：</span>
                  <span className="font-medium tabular-nums">{periodStartDisplay}</span>
                  <span className="text-muted-foreground"> 〜 今日</span>
                </div>
              )}
              {!conflictDateInput && (
                <p className="mt-2 text-xs text-amber-500">
                  抵触日が設定されていません。企業設定で抵触日を登録してください。
                </p>
              )}
            </Section>
          )}

          {/* Step 4: Options + Search */}
          {companyId && (
            <Section icon={Search} title="検索・作成オプション" step={4}>
              {/* PDF option */}
              <StyledCheckbox
                checked={generateDocs}
                onChange={setGenerateDocs}
                label="PDFも生成"
                description="個別契約書+通知書・派遣先管理台帳・派遣元管理台帳"
              />

              {/* Search button */}
              <button
                onClick={handleSearch}
                disabled={!canSearch || midHiresPreview.isPending}
                className={cn(
                  "btn-press mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all",
                  canSearch && !midHiresPreview.isPending
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-xl"
                    : "cursor-not-allowed bg-muted text-muted-foreground"
                )}
              >
                {midHiresPreview.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    検索中...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    途中入社者を検索
                  </>
                )}
              </button>
            </Section>
          )}
        </div>

        {/* Right column: Preview */}
        <div className="space-y-4">
          {preview && preview.lines?.length > 0 ? (
            <div className="sticky top-6 space-y-4">
              {/* Summary */}
              <div className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
                <h3 className="mb-3 text-sm font-semibold">検出結果</h3>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="契約数" value={activeContractCount} icon={FileText} />
                  <StatCard label="途中入社" value={activeEmployeeCount} icon={UserPlus} />
                  <StatCard label="ライン" value={preview.lines.length} icon={Users} />
                </div>
              </div>

              {/* Grouped preview component */}
              <MidHiresPreview
                lines={preview.lines}
                skipped={preview.skipped ?? []}
                conflictDateOverrides={conflictDateOverrides}
                onConflictDateOverride={handleConflictDateOverride}
                excludedFactoryIds={excludedFactoryIds}
                onToggleFactory={handleToggleFactory}
                totalContracts={activeContractCount}
                totalEmployees={activeEmployeeCount}
              />

              {/* Create button */}
              <button
                onClick={() => setShowConfirm(true)}
                disabled={!canCreate}
                className={cn(
                  "btn-press flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all",
                  canCreate
                    ? "bg-green-600 text-white shadow-lg shadow-green-600/20 hover:bg-green-700 hover:shadow-xl"
                    : "cursor-not-allowed bg-muted text-muted-foreground"
                )}
              >
                <UserPlus className="h-4 w-4" />
                {activeContractCount}件の契約 {generateDocs ? "+ PDF" : ""} を一括作成
              </button>
            </div>
          ) : preview && preview.lines?.length === 0 ? (
            <EmptyState
              icon={Users}
              title="途中入社者が見つかりません"
              description="選択した期間内に入社した社員が見つかりませんでした"
            />
          ) : companyId && conflictDateInput ? (
            <EmptyState
              icon={Search}
              title="途中入社者を検索"
              description="「途中入社者を検索」を押すと自動検出結果が表示されます"
            />
          ) : null}
        </div>
      </div>
    </AnimatedPage>
  );
}
