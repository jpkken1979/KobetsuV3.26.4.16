import { AnimatedPage } from "@/components/ui/animated";
import { PageHeader } from "@/components/ui/page-header";
import type { EmployeeDiffResult, ImportResult } from "@/lib/api";
import { api } from "@/lib/api";
import { loadExcelWorkbook } from "@/lib/excel/workbook-loader";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  COLUMN_MAPPINGS,
  MAX_IMPORT_FILE_SIZE,
  MAX_IMPORT_ROWS,
  sanitizeParsedRows,
  worksheetToRecords,
} from "./-import-helpers";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  FileSpreadsheet,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Table2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

const EMPLOYEE_LEDGER_SHEET = "DBGenzaiX";

function normalizeSheetName(name: string): string {
  return name.trim().toLowerCase();
}

export function ImportPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [sheetName, setSheetName] = useState(EMPLOYEE_LEDGER_SHEET);
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null);
  const parsedDataRef = useRef<Record<string, unknown>[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"upsert" | "skip">("upsert");
  const [dragOver, setDragOver] = useState(false);
  const [showMappings, setShowMappings] = useState(false);
  const [diffResult, setDiffResult] = useState<EmployeeDiffResult | null>(null);
  const [diffing, setDiffing] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const [expandedUpdates, setExpandedUpdates] = useState<Set<string>>(new Set());

  const parseFile = useCallback(
    async (selected: File) => {
      setFile(selected);
      setResult(null);
      setError(null);
      setPreview(null);

      try {
        if (selected.size > MAX_IMPORT_FILE_SIZE) {
          setError("ファイルサイズが大きすぎます（上限: 10MB）");
          return;
        }

        const workbook = await loadExcelWorkbook(selected);

        const availableSheets = workbook.worksheets.map((ws) => ws.name);
        const requestedSheet = sheetName.trim() || EMPLOYEE_LEDGER_SHEET;
        const normalizedRequestedSheet = normalizeSheetName(requestedSheet);
        const matchedSheet =
          workbook.worksheets.find(
            (ws) => normalizeSheetName(ws.name) === normalizedRequestedSheet,
          ) ?? null;

        if (!matchedSheet) {
          setError(
            `シート「${requestedSheet}」が見つかりません。利用可能: ${availableSheets.join(", ")}`,
          );
          return;
        }

        const jsonData = worksheetToRecords(matchedSheet);

        if (jsonData.length === 0) {
          setError("データが空です");
          return;
        }
        if (jsonData.length > MAX_IMPORT_ROWS) {
          setError(`行数が多すぎます（上限: ${MAX_IMPORT_ROWS.toLocaleString()} 行）`);
          return;
        }

        const sanitizedData = sanitizeParsedRows(jsonData);
        if (sanitizedData.length === 0) {
          setError("有効な列が見つかりませんでした");
          return;
        }

        const cols = Object.keys(sanitizedData[0] as object);
        setColumns(cols);
        setPreview(sanitizedData.slice(0, 10));
        parsedDataRef.current = sanitizedData;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(`ファイルの読み込みに失敗しました: ${message}`);
      }
    },
    [sheetName],
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0];
      if (!selected) return;
      await parseFile(selected);
    },
    [parseFile],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const selected = e.dataTransfer.files?.[0];
      if (!selected) return;
      if (!selected.name.match(/\.(xlsx|xlsm|xls)$/i)) {
        setError("Excelファイル（.xlsx, .xlsm, .xls）を選択してください");
        return;
      }
      await parseFile(selected);
    },
    [parseFile],
  );

  const handleDiff = useCallback(async () => {
    const parsedData = parsedDataRef.current;
    if (!parsedData || !Array.isArray(parsedData)) return;

    setDiffing(true);
    setError(null);
    setDiffResult(null);
    setExpandedUpdates(new Set());

    try {
      const data = await api.diffEmployees({ data: parsedData });
      setDiffResult(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`変更チェックに失敗しました: ${message}`);
    } finally {
      setDiffing(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!file) return;

    const parsedData = parsedDataRef.current;
    if (!parsedData || !Array.isArray(parsedData)) {
      setError("データが読み込まれていません");
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const data = await api.importEmployees({ data: parsedData, mode });

      setResult(data);
      toast.success("インポート完了", {
        description: `${data.summary?.inserted || 0}件追加、${data.summary?.updated || 0}件更新`,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.invalidateAll });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`インポートに失敗しました: ${message}`);
      toast.error("インポートに失敗しました");
    } finally {
      setImporting(false);
    }
  }, [file, mode, queryClient]);

  const resetFile = () => {
    setFile(null);
    setPreview(null);
    setColumns([]);
    setResult(null);
    setError(null);
    setDiffResult(null);
    setExpandedUpdates(new Set());
    parsedDataRef.current = null;
  };

  const totalRows = parsedDataRef.current?.length ?? 0;

  return (
    <AnimatedPage className="space-y-6">
      <PageHeader
        title="データインポート"
        tag="DATA_IMPORT"
        subtitle={`社員台帳Excelの「${sheetName}」シートから社員データを一括インポート`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <div className="rounded-md bg-primary/10 p-1">
                <Table2 className="h-3.5 w-3.5 text-primary" />
              </div>
              インポート設定
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="sheet-name" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  シート名
                </label>
                <input
                  id="sheet-name"
                  type="text"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  className="w-full rounded-lg border border-input/80 bg-background px-3 py-2 text-sm shadow-xs transition-all focus:border-primary/30 focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
                  placeholder="DBGenzaiX"
                />
                <p className="mt-1 text-[11px] text-muted-foreground/60">Excelファイル内のシート名を入力</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  重複時の動作
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { value: "upsert", label: "上書き更新", desc: "社員番号で照合して更新" },
                    { value: "skip", label: "スキップ", desc: "既存データは変更しない" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMode(opt.value as "upsert" | "skip")}
                      className={cn(
                        "flex items-start gap-2.5 rounded-lg border p-3 text-left text-sm transition-all",
                        mode === opt.value
                          ? "border-primary/30 bg-primary/[0.04] ring-1 ring-primary/15"
                          : "border-border/60 hover:border-border hover:bg-muted/20",
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          mode === opt.value ? "border-primary" : "border-border",
                        )}
                      >
                        {mode === opt.value && <div className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{opt.label}</p>
                        <p className="text-[11px] text-muted-foreground/70">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
            <button
              onClick={() => setShowMappings(!showMappings)}
              className="flex w-full items-center justify-between p-4 text-sm font-semibold"
            >
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-muted p-1">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                列マッピング一覧
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium text-muted-foreground transition-colors",
                  showMappings ? "text-primary" : "",
                )}
              >
                {showMappings ? "閉じる" : "表示"}
              </span>
            </button>
            <AnimatePresence>
              {showMappings && (
                <motion.div
                  {...(shouldReduceMotion
                    ? {}
                    : {
                        initial: { height: 0, opacity: 0 },
                        animate: { height: "auto", opacity: 1 },
                        exit: { height: 0, opacity: 0 },
                      })}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border/40 p-4">
                    <div className="space-y-1.5">
                      {COLUMN_MAPPINGS.map((m) => (
                        <div key={m.excel} className="flex items-start gap-2 text-xs">
                          <span className="shrink-0 rounded bg-[var(--color-status-warning-muted)] px-1.5 py-0.5 font-mono font-semibold text-[var(--color-status-warning)]">
                            {m.excel}
                          </span>
                          <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/40" />
                          <span className="shrink-0 rounded bg-[var(--color-status-info-muted)] px-1.5 py-0.5 font-mono text-[var(--color-status-info)]">
                            {m.db}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60">{m.note}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Excelファイル選択</h2>
              {file && (
                <button
                  onClick={resetFile}
                  aria-label="リセット"
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                  クリア
                </button>
              )}
            </div>

            <label
              htmlFor="excel-file"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                "flex flex-col items-center justify-center rounded-[var(--radius-xl)] border-2 border-dashed p-12 text-center transition-all cursor-pointer",
                dragOver
                  ? "border-primary/30 bg-primary/5 dark:shadow-[0_0_30px_rgba(155,167,255,0.08)]"
                  : file
                    ? "border-[color-mix(in_srgb,var(--color-status-ok)_25%,transparent)] bg-[var(--color-status-ok-muted)]"
                    : "border-border hover:border-primary/40 hover:bg-primary/5",
              )}
            >
              {file ? (
                <>
                  <div className="rounded-2xl bg-[var(--color-status-ok-muted)] p-4">
                    <FileSpreadsheet className="h-9 w-9 text-[var(--color-status-ok)]" />
                  </div>
                  <p className="mt-3 font-semibold text-[var(--color-status-ok)]">{file.name}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{(file.size / 1024).toFixed(1)} KB</span>
                    <span>·</span>
                    <span className="font-medium text-[var(--color-status-ok)]">
                      {totalRows.toLocaleString()} 行読み込み済み
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <span className="mb-4 text-4xl">📥</span>
                  <p className="font-semibold text-foreground">Excelファイルをドロップ</p>
                  <p className="mt-1 text-xs text-muted-foreground">または クリックして選択</p>
                </>
              )}
              <input
                id="excel-file"
                type="file"
                accept=".xlsx,.xlsm,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                {...(shouldReduceMotion
                  ? {}
                  : {
                      initial: { opacity: 0, y: -8 },
                      animate: { opacity: 1, y: 0 },
                      exit: { opacity: 0 },
                    })}
                role="alert"
                aria-live="polite"
                className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--color-status-error)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-status-error)_15%,transparent)] p-4"
              >
                <div className="rounded-lg bg-[var(--color-status-error-muted)] p-1.5">
                  <AlertCircle className="h-4 w-4 text-[var(--color-status-error)]" />
                </div>
                <p className="text-sm text-[var(--color-status-error)]">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {preview && (
              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                animate={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
                className="rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)]"
              >
                <div className="flex items-center justify-between border-b border-border/40 px-4 py-4">
                  <div>
                    <h2 className="text-sm font-semibold">データプレビュー</h2>
                    <p className="text-xs text-muted-foreground">
                      先頭10行を表示 — 合計 {totalRows.toLocaleString()} 行
                    </p>
                  </div>
                  <span className="rounded-full bg-muted/80 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                    {columns.length} 列
                  </span>
                </div>

                <div className="overflow-auto p-1">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/30">
                        {columns.slice(0, 12).map((col) => (
                          <th
                            key={col}
                            scope="col"
                            className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground"
                          >
                            {col}
                          </th>
                        ))}
                        {columns.length > 12 && (
                          <th scope="col" className="px-3 py-2 text-muted-foreground/60">
                            +{columns.length - 12}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr
                          key={i}
                          className={cn(
                            "border-b border-border/30 last:border-0 transition-colors hover:bg-cyan-500/5",
                            i % 2 === 1 && "bg-muted/[0.03]",
                          )}
                        >
                          {columns.slice(0, 12).map((col) => (
                            <td
                              key={col}
                              className="max-w-[120px] truncate whitespace-nowrap px-3 py-1.5 text-[11px]"
                            >
                              {String(row[col] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between border-t border-border/40 px-4 py-4">
                  <p className="text-xs text-muted-foreground">
                    モード: <span className="font-semibold text-foreground">{mode === "upsert" ? "上書き更新" : "スキップ"}</span>
                  </p>
                  <button
                    onClick={handleDiff}
                    disabled={diffing || importing}
                    className="btn-press inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {diffing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        チェック中...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4" />
                        変更をチェック
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {diffResult && !result && (
              <motion.div
                {...(shouldReduceMotion
                  ? {}
                  : {
                      initial: { opacity: 0, y: 12 },
                      animate: { opacity: 1, y: 0 },
                    })}
                className="space-y-4"
              >
                <div className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
                  <h2 className="mb-4 text-sm font-semibold">変更検出サマリー</h2>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      { label: "新規追加", value: diffResult.inserts.length, color: "text-[var(--color-status-ok)]", border: "border-[color-mix(in_srgb,var(--color-status-ok)_25%,transparent)]" },
                      { label: "更新", value: diffResult.updates.length, color: "text-[var(--color-status-warning)]", border: "border-[color-mix(in_srgb,var(--color-status-warning)_25%,transparent)]" },
                      { label: "変更なし", value: diffResult.unchanged, color: "text-muted-foreground", border: "border-border/60" },
                      { label: "スキップ", value: diffResult.skipped, color: "text-muted-foreground", border: "border-border/60" },
                    ].map((stat) => (
                      <div key={stat.label} className={cn("rounded-xl border p-3 text-center", stat.border)}>
                        <p className={cn("text-2xl font-bold tabular-nums", stat.color)}>{stat.value}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {diffResult.errors.length > 0 && (
                    <div className="mt-3 rounded-lg bg-[var(--color-status-error-muted)] p-3">
                      <p className="mb-1 text-xs font-semibold text-[var(--color-status-error)]">エラー ({diffResult.errors.length}件):</p>
                      {diffResult.errors.map((err, i) => (
                        <p key={i} className="text-[11px] text-[var(--color-status-error)]">{err}</p>
                      ))}
                    </div>
                  )}

                  {/* Affected companies and factories */}
                  {(() => {
                    const allEntries = [...diffResult.inserts, ...diffResult.updates];
                    const companyMap = new Map<string, { count: number; factories: Set<string> }>();
                    for (const e of allEntries) {
                      if (!e.company) continue;
                      if (!companyMap.has(e.company)) {
                        companyMap.set(e.company, { count: 0, factories: new Set() });
                      }
                      const entry = companyMap.get(e.company)!;
                      entry.count++;
                      if (e.factory) entry.factories.add(e.factory);
                    }
                    if (companyMap.size === 0) return null;
                    return (
                      <div className="mt-4 rounded-xl border border-[color-mix(in_srgb,var(--color-status-info)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-status-info)_15%,transparent)] p-4">
                        <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--color-status-info)]">
                          <span className="rounded bg-[var(--color-status-info-muted)] px-1.5 py-0.5">{companyMap.size}</span>
                          派遣先（企業）がインポートに関与
                        </h3>
                        <div className="space-y-2">
                          {[...companyMap.entries()].sort((a, b) => b[1].count - a[1].count).map(([company, data]) => (
                            <div key={company} className="flex items-start gap-3">
                              <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-status-info)]" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-foreground">{company}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {data.count}名
                                  {data.factories.size > 0 && ` · ${[...data.factories].join(", ")}`}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {diffResult.inserts.length > 0 && (
                  <details open className="rounded-xl border border-[color-mix(in_srgb,var(--color-status-ok)_25%,transparent)] bg-card shadow-[var(--shadow-card)]">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--color-status-ok)]">
                      新規追加 ({diffResult.inserts.length}名)
                    </summary>
                    <div className="border-t border-[color-mix(in_srgb,var(--color-status-ok)_25%,transparent)] p-1">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/40 bg-[color-mix(in_srgb,var(--color-status-ok)_15%,transparent)]">
                            <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">社員№</th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">氏名</th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">派遣先</th>
                            <th className="px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">工場</th>
                          </tr>
                        </thead>
                        <tbody>
                          {diffResult.inserts.map((ins) => (
                            <tr key={ins.employeeNumber} className="border-b border-border/20 last:border-0">
                              <td className="px-3 py-1.5 font-mono text-[var(--color-status-ok)]">{ins.employeeNumber}</td>
                              <td className="px-3 py-1.5">{ins.fullName}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{ins.company ?? "—"}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{ins.factory ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}

                {diffResult.updates.length > 0 && (
                  <details open className="rounded-xl border border-[color-mix(in_srgb,var(--color-status-warning)_25%,transparent)] bg-card shadow-[var(--shadow-card)]">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--color-status-warning)]">
                      更新 ({diffResult.updates.length}名)
                    </summary>
                    <div className="border-t border-[color-mix(in_srgb,var(--color-status-warning)_25%,transparent)]">
                      {diffResult.updates.map((upd) => {
                        const isExpanded = expandedUpdates.has(upd.employeeNumber);
                        return (
                          <div key={upd.employeeNumber} className="border-b border-border/20 last:border-0">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedUpdates((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(upd.employeeNumber)) next.delete(upd.employeeNumber);
                                  else next.add(upd.employeeNumber);
                                  return next;
                                })
                              }
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs transition-colors hover:bg-[color-mix(in_srgb,var(--color-status-warning)_15%,transparent)]"
                            >
                              <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-[var(--color-status-warning)] transition-transform", isExpanded && "rotate-90")} />
                              <span className="font-mono font-semibold text-[var(--color-status-warning)]">{upd.employeeNumber}</span>
                              <span className="font-medium">{upd.fullName}</span>
                              <span className="ml-auto rounded-full bg-[var(--color-status-warning-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-status-warning)]">
                                {Object.keys(upd.changes).length}項目
                              </span>
                            </button>
                            {isExpanded && (
                              <div className="bg-[color-mix(in_srgb,var(--color-status-warning)_15%,transparent)] px-4 pb-3">
                                <div className="grid gap-1.5">
                                  {Object.entries(upd.changes).map(([field, change]) => (
                                    <div key={field} className="flex items-center gap-2 text-[11px]">
                                      <span className="w-28 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">{field}</span>
                                      <span className="truncate text-[var(--color-status-error)] line-through">{String(change.old ?? "—")}</span>
                                      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                                      <span className="truncate font-medium text-[var(--color-status-ok)]">{String(change.new ?? "—")}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}

                {diffResult.inserts.length === 0 && diffResult.updates.length === 0 && (
                  <div className="rounded-xl border border-border/60 bg-card p-8 text-center shadow-[var(--shadow-card)]">
                    <Check className="mx-auto h-8 w-8 text-muted-foreground/40" />
                    <p className="mt-2 text-sm font-medium text-muted-foreground">変更はありません</p>
                    <p className="text-xs text-muted-foreground/60">ExcelデータはすべてDBと一致しています</p>
                  </div>
                )}

                {(diffResult.inserts.length > 0 || diffResult.updates.length > 0) && (
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => {
                        setDiffResult(null);
                        setExpandedUpdates(new Set());
                      }}
                      className="rounded-xl border border-border/60 px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={importing}
                      className="btn-press inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          インポート中...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          {diffResult.inserts.length > 0 && `${diffResult.inserts.length}件追加`}
                          {diffResult.inserts.length > 0 && diffResult.updates.length > 0 && " + "}
                          {diffResult.updates.length > 0 && `${diffResult.updates.length}件更新`}
                          {" "}を実行
                        </>
                      )}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {result && (
              <motion.div
                initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                animate={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
                className="rounded-xl border border-[color-mix(in_srgb,var(--color-status-ok)_25%,transparent)] bg-[color-mix(in_srgb,var(--color-status-ok)_15%,transparent)] p-4"
              >
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-xl bg-[var(--color-status-ok-muted)] p-2.5">
                    <Check className="h-5 w-5 text-[var(--color-status-ok)]" />
                  </div>
                  <div>
                    <h2 className="font-bold text-[var(--color-status-ok)]">インポート完了</h2>
                    <p className="text-xs text-[var(--color-status-ok)]/60">処理が正常に完了しました</p>
                  </div>
                  <button
                    onClick={resetFile}
                    aria-label="新規インポート"
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-status-ok-muted)] px-3 py-1.5 text-xs font-medium text-[var(--color-status-ok)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-status-ok)_25%,transparent)]"
                  >
                    <RefreshCw className="h-3 w-3" />
                    新規インポート
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {[
                    { label: "合計", value: result.summary.total, color: "text-foreground", bg: "bg-white dark:bg-card" },
                    { label: "新規追加", value: result.summary.inserted, color: "text-[var(--color-status-ok)]", bg: "bg-white dark:bg-card" },
                    { label: "更新", value: result.summary.updated, color: "text-[var(--color-status-info)]", bg: "bg-white dark:bg-card" },
                    { label: "スキップ", value: result.summary.skipped, color: "text-muted-foreground", bg: "bg-white dark:bg-card" },
                    { label: "エラー", value: result.summary.errors, color: result.summary.errors > 0 ? "text-[var(--color-status-error)]" : "text-muted-foreground", bg: "bg-white dark:bg-card" },
                  ].map((stat) => (
                    <div key={stat.label} className={cn("rounded-xl p-3.5 text-center shadow-xs", stat.bg)}>
                      <p className={cn("text-2xl font-bold tabular-nums leading-none", stat.color)}>{stat.value}</p>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {result.errors.length > 0 && (
                  <div className="mt-4 max-h-40 overflow-y-auto rounded-lg bg-[var(--color-status-error-muted)] p-3">
                    <p className="mb-2 text-xs font-semibold text-[var(--color-status-error)]">エラー詳細:</p>
                    {result.errors.map((err, i) => (
                      <p key={i} className="text-[11px] text-[var(--color-status-error)]">{err}</p>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AnimatedPage>
  );
}

