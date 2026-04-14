import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileSpreadsheet,
  Search,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api, type DiffResult, type ImportResult } from "@/lib/api";
import { loadExcelWorkbook } from "@/lib/excel/workbook-loader";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import {
  inferCompanyImportKind,
  parseCompanySheet,
  type CompanyImportKind,
} from "./-import-utils";

interface ImportModalProps {
  onClose: () => void;
}

export function ImportModal({ onClose }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("TBKaisha");
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([]);
  const [importKind, setImportKind] = useState<CompanyImportKind>("factories");
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [deleteSelected, setDeleteSelected] = useState<Set<number>>(new Set());
  const [expandedUpdates, setExpandedUpdates] = useState<Set<number>>(new Set());
  const [companySheetData, setCompanySheetData] = useState<Record<string, unknown>[]>([]);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const loadSheet = useCallback(
    async (selectedFile: File, nextSheetName: string) => {
      const workbook = await loadExcelWorkbook(selectedFile);
      const worksheet = workbook.getWorksheet(nextSheetName);
      const rows = worksheet ? parseCompanySheet(worksheet) : [];

      // Validar que la hoja tiene headers reconocibles
      const EXPECTED_HEADERS = ["工場名", "部署", "派遣先責任者氏名", "指揮命令者氏名", "会社名"];
      const firstRow = rows[0] ?? {};
      const keys = Object.keys(firstRow);
      const hasValidHeaders = EXPECTED_HEADERS.some((h) => keys.includes(h));
      if (rows.length > 0 && !hasValidHeaders) {
        setSheetError(`このシート (${nextSheetName}) はインポートに対応していません。企業データシートを選択してください。`);
        setParsedRows([]);
        return;
      }
      setSheetError(null);

      setParsedRows(rows);
      setImportKind(inferCompanyImportKind(nextSheetName, rows));

      // Also try to read Sheet 2 (企業情報) for company enrichment during factory import
      const companySheet =
        workbook.getWorksheet("企業情報") ??
        workbook.worksheets.find((ws) => ws.name.includes("企業情報"));
      if (companySheet && companySheet.name !== nextSheetName) {
        setCompanySheetData(parseCompanySheet(companySheet));
      } else {
        setCompanySheetData([]);
      }
    },
    [],
  );

  const handleFileSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const nextFile = event.target.files?.[0];
      if (!nextFile) {
        return;
      }

      setFile(nextFile);
      setResult(null);
      setDiff(null);

      const workbook = await loadExcelWorkbook(nextFile);
      const nextSheetNames = workbook.worksheets.map((worksheet) => worksheet.name);
      const defaultSheet =
        nextSheetNames.find((sheetName) => sheetName.includes("TBKaisha")) ??
        nextSheetNames.find((sheetName) => sheetName.includes("企業データ")) ??
        nextSheetNames[0];

      setSheetNames(nextSheetNames);
      setSelectedSheet(defaultSheet);
      await loadSheet(nextFile, defaultSheet);
    },
    [loadSheet],
  );

  const handleSheetChange = useCallback(
    async (sheetName: string) => {
      setSelectedSheet(sheetName);
      setDiff(null);
      setResult(null);
      if (!file) {
        return;
      }

      await loadSheet(file, sheetName);
    },
    [file, loadSheet],
  );

  const handleCheckDiff = useCallback(async () => {
    if (importKind !== "factories" || parsedRows.length === 0) {
      return;
    }

    setDiffLoading(true);
    setResult(null);
    try {
      const nextDiff = await api.diffFactories({ data: parsedRows });
      setDiff(nextDiff);
      setDeleteSelected(new Set());
      setExpandedUpdates(new Set());
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "差分確認に失敗しました");
    } finally {
      setDiffLoading(false);
    }
  }, [importKind, parsedRows]);

  const handleImport = useCallback(async () => {
    if (parsedRows.length === 0) {
      return;
    }

    setImporting(true);
    try {
      const nextResult =
        importKind === "companies"
          ? await api.importCompanies({ data: parsedRows })
          : await api.importFactories({
              data: parsedRows,
              deleteIds: [...deleteSelected],
              companyData: companySheetData.length > 0 ? companySheetData : undefined,
            });

      setResult(nextResult);
      setDiff(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.factories.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });

      if (nextResult.success) {
        const summaryParts = [
          `${nextResult.summary.inserted}件追加`,
          `${nextResult.summary.updated}件更新`,
        ];
        if (nextResult.summary.deleted > 0) {
          summaryParts.push(`${nextResult.summary.deleted}件削除`);
        }
        if (nextResult.summary.skipped > 0) {
          summaryParts.push(`${nextResult.summary.skipped}件スキップ`);
        }
        if (nextResult.summary.companiesUpdated && nextResult.summary.companiesUpdated > 0) {
          summaryParts.push(`${nextResult.summary.companiesUpdated}社の企業情報補完`);
        }

        // Toast principal con resumen
        toast.success(`インポート完了: ${summaryParts.join(", ")}`);

        // Advertencia si hay warnings o errores no críticos
        if ((nextResult.summary.warnings ?? 0) > 0) {
          toast.warning(
            `⚠️ ${nextResult.summary.warnings}件のデータに問題があります。詳細を確認してください。`,
            { duration: 6000 },
          );
        }
        if ((nextResult.summary.errors ?? 0) > 0) {
          toast.error(
            `❌ ${nextResult.summary.errors}件のエラーがあります。詳細を確認してください。`,
            { duration: 6000 },
          );
        }
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "インポートに失敗しました");
    } finally {
      setImporting(false);
    }
  }, [companySheetData, deleteSelected, importKind, parsedRows, queryClient]);

  const toggleDelete = useCallback((factoryId: number) => {
    setDeleteSelected((previous) => {
      const next = new Set(previous);
      if (next.has(factoryId)) {
        next.delete(factoryId);
      } else {
        next.add(factoryId);
      }
      return next;
    });
  }, []);

  const toggleAllDelete = useCallback(() => {
    if (!diff) {
      return;
    }

    if (deleteSelected.size === diff.missing.length) {
      setDeleteSelected(new Set());
      return;
    }

    setDeleteSelected(new Set(diff.missing.map((missingRow) => missingRow.factoryId)));
  }, [deleteSelected.size, diff]);

  const toggleExpand = useCallback((factoryId: number) => {
    setExpandedUpdates((previous) => {
      const next = new Set(previous);
      if (next.has(factoryId)) {
        next.delete(factoryId);
      } else {
        next.add(factoryId);
      }
      return next;
    });
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
            <div>
              <h2 className="text-lg font-bold">Excel取込</h2>
              <p className="text-xs text-muted-foreground">
                工場データ / 企業情報 をExcelからインポート
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border/60 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
            >
              <Upload className="h-4 w-4" />
              ファイルを選択
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
            />
            {file && (
              <span className="text-sm text-foreground/80">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </span>
            )}
            {sheetNames.length > 1 && (
              <select
                value={selectedSheet}
                onChange={(event) => handleSheetChange(event.target.value)}
                className="rounded-lg border border-border/60 bg-card px-3 py-1.5 text-sm"
              >
                {sheetNames.map((sheetName) => (
                  <option key={sheetName} value={sheetName}>
                    {sheetName}
                  </option>
                ))}
              </select>
            )}
            {sheetError && (
              <p className="text-sm text-red-500 mt-1">{sheetError}</p>
            )}
            {parsedRows.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {parsedRows.length}行検出
              </span>
            )}
          </div>

          {importKind === "factories" && parsedRows.length > 0 && !diff && !result && (
            <button
              onClick={handleCheckDiff}
              disabled={diffLoading}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-40"
            >
              {diffLoading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                  差分確認中...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  差分を確認
                </>
              )}
            </button>
          )}

          {importKind === "companies" && parsedRows.length > 0 && !result && (
            <div className="rounded-lg border border-primary/20 bg-primary/[0.05] px-4 py-3 text-xs text-primary/70">
              企業情報シートを検出しました。差分確認なしで会社マスタを追加/更新します。
            </div>
          )}

          {importKind === "factories" && diff && !result && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 rounded-lg border border-border/40 bg-muted/10 px-4 py-3">
                <span className="flex items-center gap-1.5 text-xs font-bold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  新規追加: <span className="text-emerald-500">{diff.inserts.length}</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs font-bold">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  更新: <span className="text-amber-500">{diff.updates.length}</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs font-bold">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
                  変更なし: <span className="text-muted-foreground">{diff.unchanged}</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs font-bold">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  DBのみ: <span className="text-red-500">{diff.missing.length}</span>
                </span>
                {diff.companyErrors.length > 0 && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-red-400">
                    <AlertTriangle className="h-3 w-3" />
                    未登録企業: {diff.companyErrors.join(", ")}
                  </span>
                )}
              </div>

              {diff.inserts.length > 0 && (
                <details open className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.03]">
                  <summary className="cursor-pointer px-4 py-2.5 text-xs font-bold text-emerald-400">
                    新規追加 ({diff.inserts.length}件) — Excelにあり、DBにない
                  </summary>
                  <div className="border-t border-emerald-500/20 px-4 py-2">
                    {diff.inserts.map((insert, index) => (
                      <div key={index} className="flex gap-2 py-1 text-[11px]">
                        <span className="font-bold text-emerald-400">+</span>
                        <span className="text-foreground/80">{insert.company}</span>
                        <span className="text-muted-foreground">→</span>
                        <span>{insert.factory}</span>
                        {insert.dept && (
                          <span className="text-muted-foreground">| {insert.dept}</span>
                        )}
                        {insert.line && (
                          <span className="text-muted-foreground">| {insert.line}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {diff.updates.length > 0 && (
                <details open className="rounded-lg border border-amber-500/30 bg-amber-500/[0.03]">
                  <summary className="cursor-pointer px-4 py-2.5 text-xs font-bold text-amber-400">
                    更新 ({diff.updates.length}件) — 変更されたフィールドあり
                  </summary>
                  <div className="space-y-1 border-t border-amber-500/20 px-4 py-2">
                    {diff.updates.map((update) => (
                      <div key={update.factoryId}>
                        <button
                          onClick={() => toggleExpand(update.factoryId)}
                          className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-[11px] hover:bg-amber-500/5"
                        >
                          <span className="font-bold text-amber-400">~</span>
                          <span className="font-medium text-foreground/80">
                            {update.company}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span>{update.factory}</span>
                          {update.line && (
                            <span className="text-muted-foreground">| {update.line}</span>
                          )}
                          <span className="ml-auto text-[10px] text-amber-400/60">
                            {Object.keys(update.changes).length}項目
                          </span>
                          <ChevronRight
                            className={cn(
                              "h-3 w-3 text-muted-foreground transition-transform",
                              expandedUpdates.has(update.factoryId) && "rotate-90",
                            )}
                          />
                        </button>
                        {expandedUpdates.has(update.factoryId) && (
                          <div className="mb-2 ml-6 space-y-0.5 rounded border border-border/30 bg-muted/10 px-3 py-2">
                            {Object.entries(update.changes).map(([field, change]) => (
                              <div key={field} className="flex gap-2 text-[10px]">
                                <span className="min-w-[140px] shrink-0 font-medium text-muted-foreground">
                                  {field}
                                </span>
                                <span className="text-red-400/70 line-through">
                                  {String(change.old ?? "空")}
                                </span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-emerald-400">
                                  {String(change.new ?? "空")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {diff.missing.length > 0 && (
                <details open className="rounded-lg border border-red-500/30 bg-red-500/[0.03]">
                  <summary className="cursor-pointer px-4 py-2.5 text-xs font-bold text-red-400">
                    DBのみ ({diff.missing.length}件) — Excelにない工場（削除可能）
                  </summary>
                  <div className="border-t border-red-500/20 px-4 py-2">
                    <label className="mb-2 flex cursor-pointer items-center gap-2 text-[11px] font-bold text-red-400/80">
                      <input
                        type="checkbox"
                        checked={
                          deleteSelected.size === diff.missing.length &&
                          diff.missing.length > 0
                        }
                        onChange={toggleAllDelete}
                        className="accent-red-500"
                      />
                      すべて選択して削除
                    </label>
                    {diff.missing.map((missing) => (
                      <label
                        key={missing.factoryId}
                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[11px] hover:bg-red-500/5"
                      >
                        <input
                          type="checkbox"
                          checked={deleteSelected.has(missing.factoryId)}
                          onChange={() => toggleDelete(missing.factoryId)}
                          className="accent-red-500"
                        />
                        <span className="font-bold text-red-400">-</span>
                        <span className="text-foreground/80">{missing.company}</span>
                        <span className="text-muted-foreground">→</span>
                        <span>{missing.factory}</span>
                        {missing.dept && (
                          <span className="text-muted-foreground">| {missing.dept}</span>
                        )}
                        {missing.line && (
                          <span className="text-muted-foreground">| {missing.line}</span>
                        )}
                      </label>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}

          {result && (
            <div
              className={cn(
                "rounded-lg border p-4 text-sm",
                result.success
                  ? "border-emerald-500/30 bg-emerald-500/[0.05]"
                  : "border-red-500/30 bg-red-500/[0.05]",
              )}
            >
              {result.success ? (
                <>
                  <div className="flex items-center gap-2 font-bold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    インポート完了
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs">
                    <span>
                      合計: <b>{result.summary.total}</b>
                    </span>
                    <span>
                      追加: <b className="text-emerald-400">{result.summary.inserted}</b>
                    </span>
                    <span>
                      更新: <b className="text-amber-400">{result.summary.updated}</b>
                    </span>
                    {result.summary.deleted > 0 && (
                      <span>
                        削除: <b className="text-red-400">{result.summary.deleted}</b>
                      </span>
                    )}
                    <span>
                      スキップ: <b className="text-muted-foreground">{result.summary.skipped}</b>
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 font-bold text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  エラーが発生しました
                </div>
              )}
              {result.warnings && result.warnings.length > 0 && (
                <details className="mt-2" open>
                  <summary className="cursor-pointer text-xs font-bold text-amber-400 hover:text-amber-300">
                    ⚠️ {result.warnings.length}件の警告 — データに問題があります
                  </summary>
                  <div className="mt-2 space-y-1 rounded border border-amber-500/20 bg-amber-500/[0.03] p-3">
                    {result.warnings.map((warning, index) => (
                      <p key={index} className="text-xs text-amber-300">
                        {warning}
                      </p>
                    ))}
                  </div>
                </details>
              )}

              {result.errors && result.errors.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-bold text-red-400 hover:text-red-300">
                    ❌ {result.errors.length}件のエラー
                  </summary>
                  <div className="mt-2 space-y-1 rounded border border-red-500/20 bg-red-500/[0.03] p-3">
                    {result.errors.map((error, index) => (
                      <p key={index} className="text-xs text-red-300">
                        {error}
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 px-6 py-4">
          <div className="text-xs text-muted-foreground">
            {diff && !result && deleteSelected.size > 0 && (
              <span className="font-bold text-red-400">
                {deleteSelected.size}件の工場を削除します
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-border/60 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50"
            >
              閉じる
            </button>
            {((importKind === "factories" && diff && !result) ||
              (importKind === "companies" && !result && parsedRows.length > 0)) && (
              <button
                onClick={handleImport}
                disabled={importing || !!sheetError}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-all",
                  importing
                    ? "cursor-not-allowed bg-muted-foreground/30"
                    : "bg-emerald-500 shadow-sm hover:bg-emerald-600 active:scale-95",
                )}
              >
                {importing ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                    インポート中...
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    インポート実行
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
