import { AnimatedPage } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  Table2,
  Upload,
  Users,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import {
  CollapsibleSection,
  FactoryGroupTable,
  ImportResultDetail,
  KoritsuDirectEditTable,
  type ApplyResultWithDiff,
  type DiffFactory,
  type ParseResponse,
} from "./-koritsu-components";

export const Route = createFileRoute("/companies/koritsu")({
  component: KoritsuImportPage,
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

// ─── Main Page Component ────────────────────────────────────────────────

function KoritsuImportPage() {
  const shouldReduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const [tabMode, setTabMode] = useState<"excel" | "edit">("excel");
  const [pageState, setPageState] = useState<"upload" | "preview" | "result">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ParseResponse | null>(null);
  const [result, setResult] = useState<ApplyResultWithDiff | null>(null);

  // ─── Upload & Parse ─────────────────────────────────────────────

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (!selected) return;
      if (!selected.name.match(/\.xlsx?$|\.xlsm$/i)) {
        setError("Excelファイル（.xlsx / .xlsm）を選択してください");
        return;
      }
      setFile(selected);
      setError(null);
    },
    []
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const selected = e.dataTransfer.files?.[0];
    if (!selected) return;
    if (!selected.name.match(/\.xlsx?$|\.xlsm$/i)) {
      setError("Excelファイル（.xlsx / .xlsm）を選択してください");
      return;
    }
    setFile(selected);
    setError(null);
  }, []);

  const handleParse = useCallback(async () => {
    if (!file) return;
    setParsing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/koritsu/parse", {
        method: "POST",
        headers: {},
        body: formData,
      });

      if (!res.ok) {
        const errBody = (await res.json()) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }

      const parsed = (await res.json()) as ParseResponse;
      setData(parsed);
      setPageState("preview");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`Excel解析に失敗しました: ${message}`);
      toast.error("Excel解析に失敗しました");
    } finally {
      setParsing(false);
    }
  }, [file]);

  // ─── Apply (save to DB) ─────────────────────────────────────────

  const handleApply = useCallback(async () => {
    if (!data) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/import/koritsu/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: data.companyId,
          factories: data.diff,
          addresses: data.parsed.addresses,
          complaint: data.parsed.complaint,
          uns: (data.parsed as Record<string, unknown>).uns,
          workConditions: (data.parsed as Record<string, unknown>).workConditions,
        }),
      });

      if (!res.ok) {
        const errBody = (await res.json()) as { error?: string };
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }

      const applyResult = (await res.json()) as ApplyResultWithDiff;
      const unchangedCount = data.diff.filter((d) => d.status === "unchanged").length;
      setResult({ ...applyResult, diff: data.diff, unchanged: unchangedCount });
      setPageState("result");

      toast.success("保存完了", {
        description: `${applyResult.inserted}件追加、${applyResult.updated}件更新`,
      });

      // Invalidate relevant caches
      queryClient.invalidateQueries({
        queryKey: queryKeys.factories.invalidateAll,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.companies.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees.invalidateAll,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.invalidateAll,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.contracts.invalidateAll,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`保存に失敗しました: ${message}`);
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [data, queryClient]);

  // ─── Reset ──────────────────────────────────────────────────────

  const resetAll = useCallback(() => {
    setFile(null);
    setData(null);
    setResult(null);
    setError(null);
    setPageState("upload");
  }, []);

  const goBackToUpload = useCallback(() => {
    setData(null);
    setError(null);
    setPageState("upload");
  }, []);

  // ─── Group diff items by factory name ───────────────────────────

  const factoryGroups = data
    ? Array.from(
        data.diff.reduce((map, item) => {
          const key = item.factoryName;
          const arr = map.get(key) ?? [];
          arr.push(item);
          map.set(key, arr);
          return map;
        }, new Map<string, DiffFactory[]>())
      )
    : [];

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <AnimatedPage className="space-y-6">
      <PageHeader
        title="コーリツ 派遣先責任者インポート"
        tag="KORITSU_IMPORT"
        subtitle="Excelから派遣先責任者・指揮命令者データを取込"
      />

      {/* ─── Tab switcher ─── */}
      <div className="flex gap-1 rounded-xl border border-border/60 bg-muted/30 p-1 w-fit">
        <button
          type="button"
          onClick={() => setTabMode("excel")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
            tabMode === "excel"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Excelインポート
        </button>
        <button
          type="button"
          onClick={() => setTabMode("edit")}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
            tabMode === "edit"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Pencil className="h-4 w-4" />
          直接編集
        </button>
      </div>

      {/* ─── Direct edit mode ─── */}
      {tabMode === "edit" && (
        <div>
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground shadow-[var(--shadow-card)]">
            <Table2 className="h-4 w-4 shrink-0 text-primary" />
            <span>
              派遣先責任者・指揮命令者・抵触日を直接編集できます。行の <strong className="text-foreground">編集</strong> ボタンをクリックして修正し、<strong className="text-foreground">保存</strong> してください。
            </span>
          </div>
          <KoritsuDirectEditTable />
        </div>
      )}

      {/* ─── Excel import mode ─── */}
      {tabMode === "excel" && (
      <AnimatePresence mode="wait">
        {/* ═══ State 1: Upload ═══ */}
        {pageState === "upload" && (
          <motion.div
            key="upload"
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
            className="space-y-4"
          >
            <div className="mx-auto max-w-2xl">
              <div className="rounded-xl border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                  <div className="rounded-md bg-primary/10 p-1">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
                  </div>
                  Excelファイル選択
                </h2>

                {/* Drop zone */}
                <label
                  htmlFor="koritsu-excel-file"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-[var(--radius-xl)] border-2 border-dashed p-12 text-center transition-all cursor-pointer",
                    dragOver
                      ? "border-cyan-400 bg-cyan-500/5 dark:shadow-[0_0_30px_rgba(0,245,212,0.08)]"
                      : file
                        ? "border-green-300/60 bg-green-50/30 dark:border-green-800/40 dark:bg-green-950/20"
                        : "border-border hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  {file ? (
                    <>
                      <div className="rounded-2xl bg-green-100 p-4 dark:bg-green-900/30">
                        <FileSpreadsheet className="h-9 w-9 text-green-600 dark:text-green-400" />
                      </div>
                      <p className="mt-3 font-semibold text-green-700 dark:text-green-400">
                        {file.name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="rounded-2xl bg-muted/50 p-4">
                        <Upload className="h-9 w-9 text-muted-foreground/60" />
                      </div>
                      <p className="mt-3 font-semibold text-foreground">
                        Excelファイルをドロップ
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        または クリックして選択（.xlsx / .xlsm）
                      </p>
                    </>
                  )}
                  <input
                    id="koritsu-excel-file"
                    type="file"
                    accept=".xlsx,.xlsm"
                    onChange={handleFileSelect}
                    className="hidden"
                    aria-required="true"
                  />
                </label>

                {/* Parse button */}
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleParse}
                    disabled={!file || parsing}
                    className="btn-press inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {parsing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        解析中...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="h-4 w-4" />
                        Excelを解析
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
                  animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                  role="alert"
                  aria-live="polite"
                  className="mx-auto max-w-2xl flex items-start gap-3 rounded-xl border border-red-200/60 bg-red-50/50 p-4 dark:border-red-800/40 dark:bg-red-950/30"
                >
                  <div className="rounded-lg bg-red-100 p-1.5 dark:bg-red-900/50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  </div>
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {error}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ═══ State 2: Preview ═══ */}
        {pageState === "preview" && data && (
          <motion.div
            key="preview"
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
            className="space-y-4"
          >
            {/* Summary bar */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Period badge */}
              <span className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary">
                {data.parsed.period
                  ? `【${data.parsed.period}】`
                  : "期間不明"}
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {data.summary.inserts > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    新規 {data.summary.inserts}件
                  </span>
                )}
                {data.summary.updates > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    更新 {data.summary.updates}件
                  </span>
                )}
                {data.summary.unchanged > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
                    変更なし {data.summary.unchanged}件
                  </span>
                )}
                {data.summary.unassignedEmployees > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    <Users className="h-3 w-3" />
                    未配属 {data.summary.unassignedEmployees}名
                  </span>
                )}
              </div>

              <span className="ml-auto text-xs text-muted-foreground">
                合計社員: {data.summary.totalEmployees}名
              </span>
            </div>

            {/* Factory group tables */}
            {factoryGroups.map(([factoryName, items]) => (
              <FactoryGroupTable
                key={factoryName}
                factoryName={factoryName}
                address={data.parsed.addresses[factoryName] ?? null}
                items={items}
              />
            ))}

            {/* Collapsible extras */}
            <div className="space-y-3">
              {/* Unassigned employees */}
              {data.unassigned.length > 0 && (
                <CollapsibleSection
                  title="未配属社員"
                  icon={
                    <Users className="h-4 w-4 text-red-500 dark:text-red-400" />
                  }
                  badge={
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {data.unassigned.length}名
                    </span>
                  }
                  defaultOpen
                >
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 md:grid-cols-3">
                    {data.unassigned
                      .filter((e) => e.status === "active")
                      .map((emp) => (
                        <div
                          key={emp.id}
                          className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2"
                        >
                          <span className="text-xs font-mono text-muted-foreground">
                            {emp.employeeNumber}
                          </span>
                          <span className="text-xs font-medium text-foreground">
                            {emp.fullName}
                          </span>
                        </div>
                      ))}
                  </div>
                  {data.unassigned.filter((e) => e.status !== "active").length >
                    0 && (
                    <p className="mt-2 text-[11px] text-muted-foreground/60">
                      退社済み:{" "}
                      {data.unassigned.filter((e) => e.status !== "active")
                        .length}
                      名（非表示）
                    </p>
                  )}
                </CollapsibleSection>
              )}

              {/* Complaint handler */}
              {data.parsed.complaint.name && (
                <CollapsibleSection
                  title="苦情申出先"
                  icon={
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  }
                >
                  <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    <div>
                      <p className="text-[10px] text-muted-foreground">氏名</p>
                      <p className="font-medium text-foreground">
                        {data.parsed.complaint.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">部署</p>
                      <p className="font-medium text-foreground">
                        {data.parsed.complaint.dept}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">電話</p>
                      <p className="font-medium text-foreground">
                        {data.parsed.complaint.phone}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">FAX</p>
                      <p className="font-medium text-foreground">
                        {data.parsed.complaint.fax}
                      </p>
                    </div>
                  </div>
                </CollapsibleSection>
              )}

              {/* Addresses */}
              {Object.keys(data.parsed.addresses).length > 0 && (
                <CollapsibleSection
                  title="住所一覧"
                  icon={
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  }
                  badge={
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {Object.keys(data.parsed.addresses).length}件
                    </span>
                  }
                >
                  <div className="space-y-2">
                    {Object.entries(data.parsed.addresses).map(
                      ([factory, addr]) => (
                        <div
                          key={factory}
                          className="flex items-start gap-3 rounded-lg bg-muted/20 px-3 py-2"
                        >
                          <span className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            {factory}
                          </span>
                          <span className="text-xs text-foreground">
                            {addr}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Overtime */}
              {(data.parsed.overtime.regular ||
                data.parsed.overtime.threeShift) && (
                <CollapsibleSection
                  title="時間外労働"
                  icon={
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  }
                >
                  <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        通常勤務
                      </p>
                      <p className="font-medium text-foreground">
                        {data.parsed.overtime.regular || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        3交替勤務
                      </p>
                      <p className="font-medium text-foreground">
                        {data.parsed.overtime.threeShift || "—"}
                      </p>
                    </div>
                  </div>
                </CollapsibleSection>
              )}
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
                  animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                  role="alert"
                  aria-live="polite"
                  className="flex items-start gap-3 rounded-xl border border-red-200/60 bg-red-50/50 p-4 dark:border-red-800/40 dark:bg-red-950/30"
                >
                  <div className="rounded-lg bg-red-100 p-1.5 dark:bg-red-900/50">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  </div>
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {error}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={goBackToUpload}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                やり直す
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={
                  saving ||
                  (data.summary.inserts === 0 && data.summary.updates === 0)
                }
                className="btn-press inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    保存
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══ State 3: Result ═══ */}
        {pageState === "result" && result && (
          <ResultView result={result} onReset={resetAll} />
        )}
      </AnimatePresence>
      )}
    </AnimatedPage>
  );
}

// ─── Result View ───────────────────────────────────────────────────

function ResultView({
  result,
  onReset,
}: {
  result: ApplyResultWithDiff;
  onReset: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [showDetail, setShowDetail] = useState(false);
  const changedCount = result.diff.filter((d) => d.status !== "unchanged").length;

  return (
    <motion.div
      key="result"
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
      className="space-y-4"
    >
      {/* Summary card */}
      <div className="mx-auto max-w-2xl rounded-xl border border-green-200/60 bg-green-50/50 p-6 dark:border-green-800/40 dark:bg-green-950/30">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-green-100 p-2.5 dark:bg-green-900/50">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-green-800 dark:text-green-300">
              保存完了
            </h2>
            <p className="text-xs text-green-700/60 dark:text-green-400/60">
              派遣先責任者データが正常に更新されました
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "追加", value: result.inserted, color: "text-green-600" },
            { label: "更新", value: result.updated, color: "text-blue-600" },
            { label: "変更なし", value: result.unchanged, color: "text-muted-foreground" },
            { label: "合計", value: result.total, color: "text-foreground" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-white p-3.5 text-center shadow-xs dark:bg-card"
            >
              <p className={cn("text-2xl font-bold tabular-nums leading-none", stat.color)}>
                {stat.value}
              </p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={onReset}
            className="btn-press inline-flex items-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-green-700 hover:shadow-md"
          >
            <RefreshCw className="h-4 w-4" />
            閉じる
          </button>
        </div>
      </div>

      {/* Detail toggle */}
      {changedCount > 0 && (
        <div className="rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted/30"
          >
            {showDetail ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span>変更詳細</span>
            <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {changedCount}件
            </span>
          </button>
          <AnimatePresence>
            {showDetail && (
              <motion.div
                initial={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                animate={shouldReduceMotion ? undefined : { height: "auto", opacity: 1 }}
                exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="border-t border-border/40">
                  <ImportResultDetail diff={result.diff} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
