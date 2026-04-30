import { useState, useMemo, useCallback } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useDashboardStats } from "@/lib/hooks/use-dashboard-stats";
import { useFactoryCascade } from "@/lib/hooks/use-factories";
import { useEmployees } from "@/lib/hooks/use-employees";
import {
  useBatchCreateContracts,
  useBatchPreviewContracts,
  useBatchGenerateDocuments,
} from "@/lib/hooks/use-contracts";
import { cn } from "@/lib/utils";
import { AnimatedPage } from "@/components/ui/animated";
import { PERIOD_LABELS } from "@/lib/constants";
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
  BatchErrorView,
} from "@/components/contract/batch-shared";
import { Badge } from "@/components/ui/badge";
import { buildLocalBatchPreview } from "./-batch-preview";
import { toast } from "sonner";
import type {
  Factory as ApiFactory,
  BatchCreateResult,
  BatchPreviewResult,
  BatchPreviewRateGroup,
  BatchPreviewDuplicate,
} from "@/lib/api";

type BatchResult = BatchCreateResult;
type BatchContractSummary = { id: number; contractNumber: string; factoryName?: string; department?: string | null; lineName?: string | null; endDate: string; hourlyRate?: number | null; employees?: number };

import { EmptyState } from "@/components/ui/empty-state";
import {
  Factory,
  Calendar,
  Zap,
  Check,
  ChevronRight,
  AlertTriangle,
  Users,
  FileText,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/contracts/batch")({
  component: BatchCreate,
  errorComponent: ({ error, reset }) => (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <BatchErrorView error={error} reset={reset} />
    </div>
  ),
  pendingComponent: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

function BatchCreate() {
  const { data: companies } = useCompanies();
  const { data: dashboardStats } = useDashboardStats();
  const batchCreate = useBatchCreateContracts();
  const batchPreview = useBatchPreviewContracts();
  const batchGenerateDocs = useBatchGenerateDocuments();

  const [tab, setTab] = useState("normal");
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [selectAll, setSelectAll] = useState(true);
  const [selectedFactoryIds, setSelectedFactoryIds] = useState<Set<number>>(new Set());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [generatePdf, setGeneratePdf] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [serverPreview, setServerPreview] = useState<BatchPreviewResult | null>(null);

  const { data: cascade } = useFactoryCascade(companyId ?? 0);
  const { data: allEmployees } = useEmployees({
    companyId: companyId ?? undefined,
    status: "active",
  });

  const flatFactories = useMemo(() => cascade?.flat || [], [cascade]);

  const employeesByFactory = useMemo(() => {
    const map = new Map<number, NonNullable<typeof allEmployees>>();
    for (const emp of allEmployees || []) {
      if (!emp.factoryId) continue;
      if (!map.has(emp.factoryId)) map.set(emp.factoryId, []);
      map.get(emp.factoryId)!.push(emp);
    }
    return map;
  }, [allEmployees]);

  const grouped = useMemo(() => cascade?.grouped || {}, [cascade]);

  const effectiveFactoryIds = useMemo(() => {
    if (selectAll) return flatFactories.map((f: ApiFactory) => f.id);
    return Array.from(selectedFactoryIds);
  }, [selectAll, selectedFactoryIds, flatFactories]);

  const preview = useMemo(() => {
    return buildLocalBatchPreview({
      companyId,
      effectiveFactoryIds,
      startDate,
      endDate,
      flatFactories,
      employeesByFactory,
    });
  }, [companyId, effectiveFactoryIds, startDate, endDate, flatFactories, employeesByFactory]);

  const toggleFactory = useCallback(
    (factoryId: number) => {
      setSelectedFactoryIds((prev) => {
        const next = new Set(prev);
        if (next.has(factoryId)) next.delete(factoryId);
        else next.add(factoryId);
        return next;
      });
      setSelectAll(false);
    },
    []
  );

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectAll(checked);
      if (checked) {
        setSelectedFactoryIds(new Set(flatFactories.map((f: ApiFactory) => f.id)));
      } else {
        setSelectedFactoryIds(new Set());
      }
    },
    [flatFactories]
  );

  const handleCompanyChange = useCallback((id: number) => {
    setCompanyId(id);
    setSelectAll(true);
    setSelectedFactoryIds(new Set());
    setResult(null);
    setServerPreview(null);
  }, []);

  // #1 + #2: Clicking the button triggers server-side preview + confirmation modal
  const handlePreviewAndConfirm = useCallback(async () => {
    if (!companyId || !startDate) return;

    const data = {
      companyId,
      factoryIds: selectAll ? undefined : Array.from(selectedFactoryIds),
      startDate,
      endDate: endDate || undefined,
    };

    try {
      const preview = await batchPreview.mutateAsync(data);
      setServerPreview(preview);
      setShowConfirm(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "プレビューの取得に失敗しました");
    }
  }, [companyId, startDate, endDate, selectAll, selectedFactoryIds, batchPreview]);

  // #1: Actual creation after confirmation
  const handleConfirmedSubmit = useCallback(async () => {
    if (!companyId || !startDate) return;
    setShowConfirm(false);

    const data = {
      companyId,
      factoryIds: selectAll ? undefined : Array.from(selectedFactoryIds),
      startDate,
      endDate: endDate || undefined,
      generatePdf,
    };

    try {
      const res = await batchCreate.mutateAsync(data);

      // #4: Auto-generate PDFs if requested
      if (generatePdf && res.contractIds?.length > 0) {
        const pdfResult = await batchGenerateDocs.mutateAsync(res.contractIds);
        setResult({ ...res, pdfFiles: pdfResult.files });
      } else {
        setResult(res);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "一括作成に失敗しました");
    }
  }, [companyId, startDate, endDate, selectAll, selectedFactoryIds, generatePdf, batchCreate, batchGenerateDocs]);

  const canSubmit =
    companyId &&
    startDate &&
    effectiveFactoryIds.length > 0 &&
    !batchCreate.isPending &&
    !batchPreview.isPending;

  // ─── Results Screen ───────────────────────────────────────────────
  if (result) {
    return (
      <ResultScreen>
        <ResultHeader title="一括作成完了" created={result.created} skipped={result.skipped} />

        {/* Created contracts */}
        {result.contracts?.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border/60 bg-card shadow-[var(--shadow-card)]">
            <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
              <h3 className="text-sm font-semibold">作成された契約</h3>
            </div>
            <div className="divide-y divide-border/40">
              {(result.contracts as BatchContractSummary[]).map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <span className="font-medium text-primary">{c.contractNumber}</span>
                    <span className="ml-3 text-sm text-muted-foreground">
                      {c.factoryName} {c.department} {c.lineName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-xs text-muted-foreground mono-tabular">{c.endDate}</span>
                    <span className="mono-tabular">¥{c.hourlyRate?.toLocaleString()}/h</span>
                    <Badge variant="info" size="sm">{c.employees}名</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(result.pdfFiles?.length ?? 0) > 0 && (
          <PdfFilesList files={result.pdfFiles!} label="生成されたZIP" />
        )}

        {(result.skippedDetails?.length ?? 0) > 0 && (
          <SkippedLinesList items={result.skippedDetails!} />
        )}

        <ResultActions onReset={() => { setResult(null); setServerPreview(null); }} />
      </ResultScreen>
    );
  }

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
      <TabsList>
        <TabsTrigger value="normal">一括作成</TabsTrigger>
        <TabsTrigger value="mid">途中入社</TabsTrigger>
        <TabsTrigger value="new">新入社</TabsTrigger>
      </TabsList>

      <TabsContent value="normal">
        <AnimatedPage className="space-y-6">
          {/* #1: Confirmation Modal */}
      {showConfirm && serverPreview && (
        <BatchConfirmationModal
          preview={serverPreview}
          generatePdf={generatePdf}
          onConfirm={handleConfirmedSubmit}
          onCancel={() => setShowConfirm(false)}
          isPending={batchCreate.isPending || batchGenerateDocs.isPending}
        />
      )}

      {/* Header */}
      <BatchPageHeader
        title="一括作成"
        description="企業を選択して、全ライン・社員の契約を一括で作成します"
        icon={Zap}
        badge="BULK CREATE"
        breadcrumb={["契約", "一括作成"]}
        stats={[
          { label: "派遣先", value: dashboardStats?.companies ?? 0 },
          { label: "工場ライン", value: dashboardStats?.factories ?? 0 },
          { label: "稼働契約", value: dashboardStats?.activeContracts ?? 0 },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* Step 1: Company */}
          <CompanySelector
            companies={companies}
            selectedId={companyId}
            onChange={handleCompanyChange}
          />

          {/* Step 2: Factories */}
          {companyId && (
            <Section icon={Factory} title="工場・ライン選択" step={2}>
              {flatFactories.length === 0 ? (
                <EmptyState
                  icon={Factory}
                  title="工場が登録されていません"
                  description="この企業には工場・ラインが登録されていません。企業管理ページから追加してください"
                />
              ) : (
              <>
              <label className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
                <div
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded border transition-all",
                    selectAll
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/80"
                  )}
                >
                  {selectAll && <Check className="h-3 w-3" />}
                </div>
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="sr-only"
                />
                <div>
                  <span className="text-sm font-semibold">全部 (zenbu)</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {flatFactories.length}ライン
                  </span>
                </div>
              </label>

              <div className="mt-3 max-h-[400px] space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
                {Object.entries(grouped).map(([factoryName, depts]: [string, Record<string, ApiFactory[]>]) => (
                  <div key={factoryName}>
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {factoryName}
                    </p>
                    {Object.entries(depts).map(([dept, lines]: [string, ApiFactory[]]) => (
                      <div key={dept}>
                        {dept && (
                          <p className="px-3 pb-0.5 pt-1 text-[10px] text-muted-foreground/40">
                            {dept}
                          </p>
                        )}
                        {lines.map((line: ApiFactory) => {
                          const empCount = employeesByFactory.get(line.id)?.length || 0;
                          const isSelected = selectAll || selectedFactoryIds.has(line.id);

                          return (
                            <button
                              key={line.id}
                              onClick={() => toggleFactory(line.id)}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all",
                                isSelected
                                  ? "bg-primary/6 ring-1 ring-primary/20"
                                  : "hover:bg-muted/40"
                              )}
                            >
                              <div
                                className={cn(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all",
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border/80"
                                )}
                              >
                                {isSelected && <Check className="h-2.5 w-2.5" />}
                              </div>
                              <span className="flex-1 truncate">
                                {line.lineName || line.department || "--"}
                              </span>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {line.contractPeriod && (
                                  <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] text-primary ring-1 ring-inset ring-primary/20 dark:bg-primary/15 dark:text-primary/80 dark:ring-primary/30">
                                    {PERIOD_LABELS[line.contractPeriod ?? ""] || line.contractPeriod}
                                  </span>
                                )}
                                {line.hourlyRate && (
                                  <span className="tabular-nums">¥{line.hourlyRate.toLocaleString()}</span>
                                )}
                                <Badge
                                  variant={empCount > 0 ? "info" : "secondary"}
                                  size="sm"
                                >
                                  {empCount}名
                                </Badge>
                                {line.conflictDate && (
                                  <span className="text-[10px] text-[var(--color-status-warning)]" title="抵触日">
                                    ~{line.conflictDate}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              </>
              )}
            </Section>
          )}

          {/* Step 3: Dates */}
          {companyId && (
            <Section icon={Calendar} title="契約期間" step={3}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">開始日</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-input/80 bg-background px-3 py-2.5 text-sm shadow-xs transition-all focus:border-primary/30 focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    終了日
                    <span className="ml-1 text-xs text-muted-foreground">(省略可 — 各ラインの設定で自動計算)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
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
                          disabled={!startDate}
                          onClick={() => {
                            if (!startDate) return;
                            const s = new Date(startDate);
                            const end = new Date(s.getFullYear(), s.getMonth() + months, 0);
                            const y = end.getFullYear();
                            const m = String(end.getMonth() + 1).padStart(2, "0");
                            const d = String(end.getDate()).padStart(2, "0");
                            setEndDate(`${y}-${m}-${d}`);
                          }}
                          className={cn(
                            "rounded-md border px-2.5 py-2 text-xs font-medium transition-all",
                            !startDate
                              ? "cursor-not-allowed border-input/40 text-muted-foreground/40"
                              : "cursor-pointer border-input/60 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {startDate && endDate && startDate > endDate && (
                <p className="mt-2 text-sm text-red-500">開始日は終了日より前にしてください</p>
              )}
              {startDate && !endDate && (
                <p className="mt-2 text-xs text-primary/70 dark:text-primary/60">
                  各ラインの contractPeriod / 抵触日 設定から終了日を自動計算します
                </p>
              )}

              {/* #4: PDF generation option */}
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
        </div>

        {/* Right column: Preview */}
        <div className="space-y-4">
          {preview && preview.lines.length > 0 ? (
            <div className="sticky top-6 space-y-4">
              {/* Summary */}
              <div className="rounded-lg border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
                <h3 className="mb-4 text-sm font-semibold">作成プレビュー</h3>
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="契約数" value={preview.totalContracts} icon={FileText} />
                  <StatCard label="社員数" value={preview.totalEmployees} icon={Users} />
                  <StatCard label="ライン" value={preview.lines.filter((l) => (l.contracts ?? 0) > 0).length} icon={Factory} />
                </div>
              </div>

              {/* Line detail */}
              <div className="rounded-lg border border-border/60 bg-card shadow-[var(--shadow-card)]">
                <div className="border-b border-border/60 px-4 py-3">
                  <h3 className="text-sm font-semibold">ライン別詳細</h3>
                </div>
                <div className="max-h-[400px] divide-y divide-border/40 overflow-y-auto">
                  {preview.lines.map((line) => (
                    <div key={line.factoryId} className="px-4 py-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate max-w-[180px]">
                          {line.lineName || line.department || line.factoryName}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {line.employees === 0 ? (
                            <span className="text-xs text-muted-foreground/50">社員なし</span>
                          ) : (
                            <>
                              <span className="text-xs tabular-nums text-muted-foreground">{line.employees}名</span>
                              <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
                              <span className="text-xs font-medium tabular-nums">{line.contracts}件</span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* #3: Show per-line endDate */}
                      {line.effectiveEndDate && line.contractPeriod && (
                        <p className="mt-0.5 text-[10px] text-primary/60">
                          {PERIOD_LABELS[line.contractPeriod ?? ""] || line.contractPeriod} → {line.effectiveEndDate}
                        </p>
                      )}
                      {line.rates && line.rates.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {line.rates.map((r: { rate: number; count: number }) => (
                            <div key={r.rate} className="hover-lift rounded-[var(--radius-lg)] border border-border bg-card p-3">
                              <div className="flex items-center justify-between">
                                <span className="mono-tabular text-xs font-bold text-[var(--color-status-info)]">¥{r.rate.toLocaleString()}/h</span>
                                <Badge variant="info">{r.count}名</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {line.capped && (
                        <p className="mt-0.5 text-[10px] text-[var(--color-status-warning)]">
                          抵触日 {line.conflictDate} で制限
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Conflict date warning */}
              {preview.lines.some((l) => l.capped) && (
                <div className="flex items-start gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--color-status-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-status-warning)_8%,transparent)] p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-status-warning)]" />
                  <p className="text-xs text-[var(--color-status-warning)]">
                    一部のラインは抵触日により終了日が制限されます
                  </p>
                </div>
              )}

              {/* Submit button — opens confirmation modal */}
              <Button
                variant="success"
                className="w-full"
                onClick={handlePreviewAndConfirm}
                disabled={!canSubmit}
              >
                {batchPreview.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    確認中...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    <span className="mono-tabular">{preview.totalContracts}</span>件の契約を一括作成
                  </>
                )}
              </Button>
            </div>
          ) : companyId ? (
            <EmptyState
              icon={Zap}
              title="プレビュー待機中"
              description="工場と開始日を選択するとプレビューが表示されます"
            >
              <Link to="/employees">
                <Button variant="outline" size="sm">
                  社員をインポートする
                </Button>
              </Link>
            </EmptyState>
          ) : null}
        </div>
      </div>
        </AnimatedPage>
      </TabsContent>

      <TabsContent value="mid" className="space-y-4">
        <Card variant="default" className="p-6">
          <p className="text-muted-foreground mb-4">
            既に存在する契約期間中に途中入社した社員のために契約を作成します。
          </p>
          <Link to="/contracts/mid-hires">
            <Button>途中入社タブを開く</Button>
          </Link>
        </Card>
      </TabsContent>

      <TabsContent value="new" className="space-y-4">
        <Card variant="default" className="p-6">
          <p className="text-muted-foreground mb-4">
            新たに雇用した社員の契約を作成します。
          </p>
          <Link to="/contracts/new-hires">
            <Button>新入社タブを開く</Button>
          </Link>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

// ─── #1: Confirmation Modal ────────────────────────────────────────

function BatchConfirmationModal({
  preview,
  generatePdf,
  onConfirm,
  onCancel,
  isPending,
}: {
  preview: BatchPreviewResult;
  generatePdf: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <ConfirmationModalShell
      open={true}
      onClose={onCancel}
      title="一括作成の確認"
      subtitle="以下の内容で契約を作成します。確認してください。"
      stats={[
        { label: "契約", value: preview.totalContracts },
        { label: "社員", value: preview.totalEmployees },
        { label: "ライン", value: preview.lines?.length || 0 },
      ]}
      isPending={isPending}
      totalContracts={preview.totalContracts}
      onConfirm={onConfirm}
    >
        {/* #5: Duplicate warnings */}
        {(preview.totalDuplicates ?? 0) > 0 && (
          <div className="mb-4 rounded-xl border border-[color-mix(in_srgb,var(--color-status-error)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-status-error)_8%,transparent)] p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-[var(--color-status-error)]" />
              <span className="text-sm font-semibold text-[var(--color-status-error)]">
                既存契約との重複あり ({preview.totalDuplicates}件)
              </span>
            </div>
            <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
              {preview.lines
                ?.filter((l) => (l.duplicates?.length ?? 0) > 0)
                .map((l) => (
                  <div key={l.factoryId} className="text-xs text-[var(--color-status-error)]">
                    <span className="font-medium">{l.factoryName} {l.lineName}</span>
                    {l.duplicates!.map((d: BatchPreviewDuplicate) => (
                      <div key={d.id} className="ml-3 text-[var(--color-status-error)]">
                        {d.contractNumber} ({d.startDate} ~ {d.endDate}) {d.employeeCount}名
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Line details */}
        <div className="mb-4 max-h-[200px] divide-y divide-border/40 overflow-y-auto rounded-md border border-border/40">
          {preview.lines?.map((l) => (
            <div key={l.factoryId} className="px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {l.factoryName} {l.lineName || l.department}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {l.totalEmployees}名 → {l.totalContracts}件
                </span>
              </div>
              {l.autoCalculated && (
                <p className="text-[10px] text-primary/60">
                  {PERIOD_LABELS[l.contractPeriod ?? ""]} → ~{l.effectiveEndDate}
                </p>
              )}
              {l.rateGroups?.map((rg: BatchPreviewRateGroup) => (
                <span key={rg.rate} className="mr-1 inline-block rounded bg-muted/50 px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                  ¥{rg.rate.toLocaleString()} x{rg.count}
                </span>
              ))}
            </div>
          ))}
        </div>

        {generatePdf && <PdfGenerationBanner />}
    </ConfirmationModalShell>
  );
}

