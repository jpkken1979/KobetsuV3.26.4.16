import { useState, useCallback } from "react";
import { Upload, Download, AlertTriangle } from "lucide-react";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useImportEmployees } from "@/lib/hooks/use-employees";
import { loadExcelWorkbook } from "@/lib/excel/workbook-loader";
import type { ImportResult, TakaoReEntry } from "@/lib/api-types";
import type { Workbook, Worksheet, Cell, Row } from "exceljs";

interface ImportResponse extends ImportResult {
  reEntries?: TakaoReEntry[];
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const EMPLOYEE_LEDGER_SHEET = "DBGenzaiX";

function normalizeSheetName(name: string): string {
  return name.trim().toLowerCase();
}

function resolveEmployeeSheet(workbook: Workbook): Worksheet | undefined {
  return workbook.worksheets.find(
    (worksheet) =>
      normalizeSheetName(worksheet.name) === normalizeSheetName(EMPLOYEE_LEDGER_SHEET),
  );
}

function parseSheet(ws: Worksheet | undefined): Record<string, unknown>[] {
  if (!ws) return [];
  const rows: Record<string, unknown>[] = [];
  const headers: string[] = [];
  ws.getRow(1).eachCell((cell: Cell, colNum: number) => {
    headers[colNum - 1] = String(cell.text ?? "");
  });
  ws.eachRow((row: Row, rowNum: number) => {
    if (rowNum === 1) return;
    const obj: Record<string, unknown> = {};
    row.eachCell((cell: Cell, colNum: number) => {
      obj[headers[colNum - 1]] = cell.text;
    });
    rows.push(obj);
  });
  return rows;
}

export function EmployeeImportDialog({ open, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const importMu = useImportEmployees();

  const downloadTemplate = () => {
    window.open("/api/employees/import/template", "_blank");
  };

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    setLoading(true);

    try {
      const wb: Workbook = await loadExcelWorkbook(f);
      const ws = resolveEmployeeSheet(wb);
      if (!ws) {
        const availableSheets = wb.worksheets.map((worksheet) => worksheet.name).join(", ");
        throw new Error(
          `シート「${EMPLOYEE_LEDGER_SHEET}」が見つかりません。利用可能: ${availableSheets}`,
        );
      }
      const rows = parseSheet(ws);
      const res = await importMu.mutateAsync(rows);
      setResult(res as ImportResponse);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [importMu]);

  const handleDone = () => {
    setResult(null);
    setFile(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="max-w-md">
        <DialogHeader>
          <DialogTitle>社員インポート</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4" />テンプレート
            </Button>
              <Button variant="default" onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".xlsx,.xlsm,.csv";
              input.onchange = (e) => handleFile(e as unknown as React.ChangeEvent<HTMLInputElement>);
              input.click();
            }} disabled={loading}>
              <Upload className="h-4 w-4" />{loading ? "処理中..." : "Excel選択"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            対象シート: <span className="font-mono">{EMPLOYEE_LEDGER_SHEET}</span>
          </p>

          {file && !result && (
            <p className="text-sm text-muted-foreground">{file.name}</p>
          )}

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          {result && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">インポート完了:</span>
                <Badge>{result.summary.inserted}件作成</Badge>
              </div>
              {(result.reEntries?.length ?? 0) > 0 && (
                <div className="flex items-center gap-2 text-sm text-yellow-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{result.reEntries!.length}件の再入社を検出 (高雄工業)</span>
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="text-xs text-destructive">
                  {result.errors.slice(0, 3).map((e, i) => (
                    <div key={i}>{e}</div>
                  ))}
                </div>
              )}
              <Button onClick={handleDone} className="w-full">
                完了
              </Button>
            </Card>
          )}
        </div>
      </div>
    </Dialog>
  );
}
