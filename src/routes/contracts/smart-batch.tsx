import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createFileRoute } from "@tanstack/react-router";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useDashboardStats } from "@/lib/hooks/use-dashboard-stats";
import {
  useSmartBatchPreview,
  useSmartBatchCreate,
  useBatchGenerateDocuments,
} from "@/lib/hooks/use-contracts";
import { cn } from "@/lib/utils";
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
  SmartBatchPreviewResult,
  SmartBatchCreateResult,
  Factory,
} from "@/lib/api";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Users,
  UserPlus,
  UserCheck,
  AlertTriangle,
  FileText,
  Loader2,
  Search,
  Building2,
  CalendarDays,
  Layers,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/contracts/smart-batch")({
  component: SmartBatchPage,
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

function SmartBatchPage() {
  const { data: companies } = useCompanies();
  const { data: dashboardStats } = useDashboardStats();
  const previewMut = useSmartBatchPreview();
  const createMut = useSmartBatchCreate();
  const batchGenerateDocs = useBatchGenerateDocuments();

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [selectedFactoryIds, setSelectedFactoryIds] = useState<Set<number>>(new Set());
  const [globalStartDate, setGlobalStartDate] = useState("");
  const [globalEndDate, setGlobalEndDate] = useState("");
  const [generateDocs, setGenerateDocs] = useState(true);
  const [groupByLine, setGroupByLine] = useState(false);
  const [preview, setPreview] = useState<SmartBatchPreviewResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<SmartBatchCreateResult | null>(null);

  const selectedCompany = useMemo(
    () => companies?.find((c) => c.id === companyId) ?? null,
    [companies, companyId]
  );
  const availableFactories: Factory[] = useMemo(
    () => selectedCompany?.factories ?? [],
    [selectedCompany]
  );

  const handleCompanyChange = useCallback((id: number) => {
    setCompanyId(id);
    setSelectedFactoryIds(new Set());
    setPreview(null);
    setResult(null);
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

  const canSearch = !!companyId && !!globalStartDate && !!globalEndDate && globalStartDate <= globalEndDate;
  const canCreate =
    !!preview &&
    preview.totals.continuation + preview.totals.midHires > 0 &&
    !createMut.isPending &&
    !previewMut.isPending;

  const handleSearch = useCallback(async () => {
    if (!canSearch || !companyId) return;
    try {
      const factoryIds = selectedFactoryIds.size > 0 ? Array.from(selectedFactoryIds) : undefined;
      const res = await previewMut.mutateAsync({
        companyId,
        factoryIds,
        globalStartDate,
        globalEndDate,
        groupByLine,
      });
      setPreview(res);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "プレビューに失敗しました");
    }
  }, [canSearch, companyId, selectedFactoryIds, globalStartDate, globalEndDate, groupByLine, previewMut]);

  const handleConfirmAndCreate = useCallback(async () => {
    if (!companyId || !preview) return;
    setShowConfirm(false);
    try {
      const factoryIds = selectedFactoryIds.size > 0 ? Array.from(selectedFactoryIds) : undefined;
      const res = await createMut.mutateAsync({
        companyId,
        factoryIds,
        globalStartDate,
        globalEndDate,
        generateDocs,
        groupByLine,
      });

      if (generateDocs && res.contractIds.length > 0) {
        const pdfResult = await batchGenerateDocs.mutateAsync(res.contractIds);
        setResult({ ...res, pdfFiles: pdfResult.files });
      } else {
        setResult(res);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "一括作成に失敗しました");
    }
  }, [companyId, preview, selectedFactoryIds, globalStartDate, globalEndDate, generateDocs, createMut, batchGenerateDocs]);

  // ─── Results Screen ───────────────────────────────────────────────
  if (result) {
    return (
      <ResultScreen>
        <ResultHeader
          title="スマート一括作成完了"
          created={result.created}
          skipped={result.skippedDetails.length}
        />

        <Section icon={Building2} title="工場別作成結果" step={1}>
          <div className="divide-y divide-border/40">
            {result.perFactory.map((f) => (
              <div key={f.factoryId} className="flex items-center justify-between px-4 py-3">
                <div className="font-medium">{f.factoryName ?? `Factory ${f.factoryId}`}</div>
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="outline">継続 {f.continuationCount}</Badge>
                  <Badge variant="outline">途中 {f.midHireCount}</Badge>
                  <span className="font-semibold">{f.contractsCreated}件作成</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {result.pdfFiles && result.pdfFiles.length > 0 && (
          <PdfFilesList files={result.pdfFiles} />
        )}

        {result.skippedDetails.length > 0 && (
          <SkippedLinesList items={result.skippedDetails} />
        )}

        <ResultActions onReset={() => { setResult(null); setPreview(null); }} />
      </ResultScreen>
    );
  }

  // ─── Main Screen ──────────────────────────────────────────────────
  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 py-6">
      <BatchPageHeader
        title="スマート一括作成"
        description="工場全体を一括処理。自動で 継続 / 途中入社者 を分類し、入社日に応じて契約期間を調整します"
        icon={Layers}
        badge="SMART BATCH"
        breadcrumb={["契約", "スマート一括"]}
        stats={dashboardStats ? [
          { label: "総契約", value: dashboardStats.totalContracts ?? 0 },
          { label: "総社員", value: dashboardStats.activeEmployees ?? 0 },
        ] : undefined}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* ── LEFT: Inputs ──────────────────────────────────────────── */}
        <div className="space-y-4">
          <Section icon={Building2} title="派遣先" step={1}>
            <CompanySelector
              companies={companies ?? []}
              selectedId={companyId}
              onChange={handleCompanyChange}
            />
          </Section>

          {selectedCompany && (
            <Section icon={Building2} title="工場 / ライン選択" step={2}>
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>選択: {selectedFactoryIds.size} / {availableFactories.length}</span>
                <button
                  type="button"
                  onClick={toggleAllFactories}
                  className="hover:text-foreground"
                >
                  {selectedFactoryIds.size === availableFactories.length ? "全解除" : "全選択"}
                </button>
              </div>
              {availableFactories.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="工場が登録されていません"
                  description="この派遣先には工場が登録されていません"
                />
              ) : (
                <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  {availableFactories.map((f) => {
                    const checked = selectedFactoryIds.has(f.id);
                    return (
                      <label
                        key={f.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/50",
                          checked && "bg-primary/5 text-primary"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFactory(f.id)}
                          className="h-4 w-4 accent-[var(--color-primary)]"
                        />
                        <span className="flex-1 truncate">
                          {f.factoryName}
                          {f.department && <span className="text-muted-foreground"> / {f.department}</span>}
                          {f.lineName && <span className="text-muted-foreground"> / {f.lineName}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                未選択の場合はこの派遣先の全工場が対象になります
              </p>
            </Section>
          )}

          <Section icon={CalendarDays} title="契約期間" step={3}>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5 text-sm">
                <span className="text-muted-foreground">開始日</span>
                <input
                  type="date"
                  value={globalStartDate}
                  onChange={(e) => { setGlobalStartDate(e.target.value); setPreview(null); }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="text-muted-foreground">終了日</span>
                <input
                  type="date"
                  value={globalEndDate}
                  onChange={(e) => { setGlobalEndDate(e.target.value); setPreview(null); }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              入社日が <span className="font-mono">{globalStartDate || "開始日"}</span> 以前の社員は <strong>継続契約</strong> として、
              開始日〜終了日の間に入社した社員は <strong>途中入社者</strong> として
              入社日から契約を作成します。
            </p>
          </Section>

          <Button
            onClick={handleSearch}
            disabled={!canSearch || previewMut.isPending}
            className="w-full"
          >
            {previewMut.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 検索中...</>
            ) : (
              <><Search className="mr-2 h-4 w-4" /> プレビュー</>
            )}
          </Button>
        </div>

        {/* ── RIGHT: Preview ───────────────────────────────────────── */}
        <div className="space-y-4">
          {!preview ? (
            <Section icon={Users} title="プレビュー" step={4}>
              <EmptyState
                icon={Search}
                title="プレビュー待ち"
                description="左側の条件を入力して「プレビュー」を押してください"
              />
            </Section>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard label="作成予定契約" value={preview.totals.contracts} icon={FileText} />
                <StatCard label="継続" value={preview.totals.continuation} icon={UserCheck} />
                <StatCard label="途中入社者" value={preview.totals.midHires} icon={UserPlus} />
                <StatCard label="未来日入社 (除外)" value={preview.totals.futureSkip} icon={AlertTriangle} />
              </div>

              {preview.lines.length === 0 ? (
                <Section icon={Users} title="対象社員" step={4}>
                  <EmptyState
                    icon={AlertTriangle}
                    title="対象社員がいません"
                    description={preview.skipped.length > 0 ? `${preview.skipped.length}件の工場がスキップされました` : "条件を変更してください"}
                  />
                </Section>
              ) : (
                <Section icon={Building2} title={`工場別内訳 (${preview.lines.length}工場)`} step={4}>
                  <div className="divide-y divide-border/40">
                    {preview.lines.map((line) => (
                      <details key={line.factory.id} className="group px-1 py-3">
                        <summary className="flex cursor-pointer items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
                            <span className="truncate font-medium">{line.factory.factoryName}</span>
                            {line.factory.lineName && (
                              <span className="truncate text-sm text-muted-foreground">/ {line.factory.lineName}</span>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge variant="outline" className="text-emerald-700 dark:text-emerald-300">
                              継続 {line.continuation.length}
                            </Badge>
                            <Badge variant="outline" className="text-amber-700 dark:text-amber-300">
                              途中 {line.midHires.length}
                            </Badge>
                            {line.futureSkip.length > 0 && (
                              <Badge variant="outline" className="text-muted-foreground">
                                除外 {line.futureSkip.length}
                              </Badge>
                            )}
                            <span className="text-sm font-semibold">{line.estimatedContracts}件契約</span>
                          </div>
                        </summary>

                        <div className="mt-3 space-y-3 pl-6 text-sm">
                          {line.continuation.length > 0 && (
                            <div>
                              <div className="mb-1 text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">
                                継続 ({line.continuation.length})
                              </div>
                              <ul className="space-y-0.5 text-muted-foreground">
                                {line.continuation.slice(0, 5).map((e) => (
                                  <li key={e.id}>
                                    {e.fullName ?? e.employeeNumber}{" "}
                                    <span className="font-mono text-xs">入社: {e.effectiveHireDate ?? "未設定"}</span>
                                  </li>
                                ))}
                                {line.continuation.length > 5 && (
                                  <li className="text-xs">…他 {line.continuation.length - 5}名</li>
                                )}
                              </ul>
                            </div>
                          )}
                          {line.midHires.length > 0 && (
                            <div>
                              <div className="mb-1 text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">
                                途中入社者 ({line.midHires.length})
                              </div>
                              <ul className="space-y-0.5 text-muted-foreground">
                                {line.midHires.slice(0, 5).map((e) => (
                                  <li key={e.id}>
                                    {e.fullName ?? e.employeeNumber}{" "}
                                    <span className="font-mono text-xs">{e.contractStartDate} 〜 {e.contractEndDate}</span>
                                  </li>
                                ))}
                                {line.midHires.length > 5 && (
                                  <li className="text-xs">…他 {line.midHires.length - 5}名</li>
                                )}
                              </ul>
                            </div>
                          )}
                          {line.futureSkip.length > 0 && (
                            <div>
                              <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                                未来日入社で除外 ({line.futureSkip.length})
                              </div>
                              <ul className="space-y-0.5 text-muted-foreground">
                                {line.futureSkip.slice(0, 3).map((e) => (
                                  <li key={e.id}>
                                    {e.fullName ?? e.employeeNumber}{" "}
                                    <span className="font-mono text-xs">入社予定: {e.effectiveHireDate}</span>
                                  </li>
                                ))}
                                {line.futureSkip.length > 3 && (
                                  <li className="text-xs">…他 {line.futureSkip.length - 3}名</li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                </Section>
              )}

              {preview.skipped.length > 0 && <SkippedLinesList items={preview.skipped} />}

              <Section icon={FileText} title="作成オプション" step={5}>
                <StyledCheckbox
                  checked={generateDocs}
                  onChange={setGenerateDocs}
                  label="契約作成後にPDFも自動生成する"
                  description="個別契約書 + 通知書 + 派遣先管理台帳 + 派遣元管理台帳"
                />
                <StyledCheckbox
                  checked={groupByLine}
                  onChange={setGroupByLine}
                  label="配和工作場（ライン）ごとに分组"
                  description="同一単価でもラインが異なれば別途契約書を作成します"
                />
              </Section>

              <Button
                onClick={() => setShowConfirm(true)}
                disabled={!canCreate}
                className="w-full"
                size="lg"
              >
                {createMut.isPending || batchGenerateDocs.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 作成中...</>
                ) : (
                  <>
                    <span className="mono-tabular">{preview.totals.contracts}</span>
                    件の契約 {generateDocs ? "+ PDF" : ""} を一括作成
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <ConfirmationModalShell
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="一括作成の確認"
        subtitle={`${globalStartDate} 〜 ${globalEndDate} の契約を作成します`}
        stats={preview ? [
          { label: "継続", value: preview.totals.continuation },
          { label: "途中入社", value: preview.totals.midHires },
          { label: "契約数", value: preview.totals.contracts },
        ] : []}
        isPending={createMut.isPending || batchGenerateDocs.isPending}
        totalContracts={preview?.totals.contracts ?? 0}
        onConfirm={handleConfirmAndCreate}
      >
        {preview && preview.totals.futureSkip > 0 && (
          <p className="mb-3 text-xs text-muted-foreground">
            ※ 未来日入社の {preview.totals.futureSkip}名 は今回の作成から除外されます。
          </p>
        )}
        {generateDocs && <PdfGenerationBanner />}
      </ConfirmationModalShell>
    </div>
  );
}
