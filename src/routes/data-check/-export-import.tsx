import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { loadExcelWorkbook } from "@/lib/excel/workbook-loader";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

export function ExportImportButtons() {
  const [exporting, setExporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const result = await api.exportDataCheck();
      toast.success(`エクスポート完了: ${result.filename} (${result.count}件)`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "エクスポートに失敗しました");
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleExport}
          disabled={exporting}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
            exporting
              ? "cursor-not-allowed text-muted-foreground/50"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          {exporting ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          エクスポート
        </button>
        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all cursor-pointer hover:text-foreground hover:bg-muted/50"
        >
          <Upload className="h-3.5 w-3.5" />
          インポート
        </button>
      </div>

      {showImportModal && (
        <DataCheckImportModal onClose={() => setShowImportModal(false)} />
      )}
    </>
  );
}

function DataCheckImportModal({ onClose }: { onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    updated: { employees: number; factories: number };
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFileSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;

    setFile(nextFile);
    setResult(null);

    try {
      const workbook = await loadExcelWorkbook(nextFile);
      const ws = workbook.worksheets[0];
      if (!ws) {
        toast.error("シートが見つかりません");
        return;
      }

      const rows: Record<string, unknown>[] = [];
      const headers: string[] = [];
      ws.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value ?? "").trim();
      });

      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const obj: Record<string, unknown> = {};
        let hasValue = false;
        row.eachCell((cell, colNumber) => {
          const key = headers[colNumber];
          if (key) {
            // ExcelJS formula cells: { formula: "...", result: "value" } — extract result
            const raw = cell.value;
            obj[key] = raw && typeof raw === "object" && "formula" in raw
              ? (raw as { formula: string; result?: unknown }).result ?? null
              : raw;
            hasValue = true;
          }
        });
        if (hasValue) rows.push(obj);
      }

      setParsedRows(rows);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "ファイルの読み込みに失敗しました");
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (parsedRows.length === 0) return;

    setImporting(true);
    try {
      const res = await api.importDataCheck({ rows: parsedRows });
      setResult(res);
      queryClient.invalidateQueries({ queryKey: queryKeys.dataCheck.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.factories.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });

      if (res.success) {
        toast.success(
          `インポート完了: 社員${res.updated.employees}件、工場${res.updated.factories}件更新`
        );
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "インポートに失敗しました");
    } finally {
      setImporting(false);
    }
  }, [parsedRows, queryClient]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
            <div>
              <h2 className="text-lg font-bold">データ確認インポート</h2>
              <p className="text-xs text-muted-foreground">
                エクスポートしたExcelを編集して再取込
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
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
            {parsedRows.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {parsedRows.length}行検出
              </span>
            )}
          </div>

          {/* Result */}
          {result && (
            <div
              className={cn(
                "rounded-lg border p-4 text-sm",
                result.success
                  ? "border-emerald-500/30 bg-emerald-500/[0.05]"
                  : "border-red-500/30 bg-red-500/[0.05]"
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
                      社員更新: <b className="text-emerald-400">{result.updated.employees}</b>
                    </span>
                    <span>
                      工場更新: <b className="text-amber-400">{result.updated.factories}</b>
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 font-bold text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  エラーが発生しました
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="mt-2 space-y-1">
                  {result.errors.map((error, i) => (
                    <p key={i} className="text-xs text-red-400">
                      {error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border/60 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border/60 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50"
          >
            閉じる
          </button>
          {parsedRows.length > 0 && !result && (
            <button
              onClick={handleImport}
              disabled={importing}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-all",
                importing
                  ? "cursor-not-allowed bg-muted-foreground/30"
                  : "bg-emerald-500 shadow-sm hover:bg-emerald-600 active:scale-95"
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
  );
}
