import { useState, useCallback } from "react";
import { Download, Upload, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { loadExcelWorkbook } from "@/lib/excel/workbook-loader";
import { useMutation } from "@tanstack/react-query";
import type { DiffResult } from "@/lib/api-types";

export function FactoryImportTab() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<DiffResult | null>(null);

  const previewMu = useMutation({
    mutationFn: (rows: Record<string, unknown>[]) =>
      api.post<DiffResult>("/import/factories/diff", { data: rows }),
  });

  const applyMu = useMutation({
    mutationFn: (rows: Record<string, unknown>[]) =>
      api.post("/import/factories", { data: rows, mode: "upsert" }),
  });

  const downloadTemplate = () => {
    window.open("/api/import/factories/template", "_blank");
  };

  const parseExcelRows = async (f: File): Promise<Record<string, unknown>[]> => {
    const workbook = await loadExcelWorkbook(f);
    const ws = workbook.getWorksheet(1);
    if (!ws) return [];
    const headers: string[] = [];
    ws.getRow(1).eachCell((cell) => {
      headers.push(String(cell.text ?? "").trim());
    });
    const rows: Record<string, unknown>[] = [];
    ws.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const obj: Record<string, unknown> = {};
      row.eachCell((cell, col) => {
        obj[headers[col - 1]] = cell.text;
      });
      rows.push(obj);
    });
    return rows;
  };

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      setFile(f);
      const rows = await parseExcelRows(f);
      const result = await previewMu.mutateAsync(rows);
      setPreview(result);
    },
    [previewMu],
  );

  const handleApply = async () => {
    if (!file) return;
    const rows = await parseExcelRows(file);
    await applyMu.mutateAsync(rows);
    setPreview(null);
    setFile(null);
  };

  const updatesWithChanges =
    preview?.updates.filter((u) => u.changes && Object.keys(u.changes).length > 0) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-2" />
          テンプレート
        </Button>
        <Button variant="outline" onClick={() => document.getElementById("factory-import-input")?.click()}>
          <Upload className="h-4 w-4 mr-2" />
          CSV/Excel
        </Button>
        <input
          id="factory-import-input"
          type="file"
          accept=".xlsx,.csv"
          className="sr-only"
          onChange={handleFile}
        />
      </div>

      {preview && (
        <Card className="p-4 space-y-4">
          <div className="flex gap-4 text-sm">
            <Badge variant="default">{preview.inserts.length} 新規</Badge>
            <Badge variant="secondary">{preview.updates.length} 更新</Badge>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {updatesWithChanges.map((diff, i) => (
              <div key={i} className="text-sm border p-2 rounded">
                <span className="font-medium">{diff.factory}</span>
                {diff.changes && Object.keys(diff.changes).length > 0 && (
                  <AlertTriangle className="h-3 w-3 text-yellow-500 inline ml-2" />
                )}
                {Object.entries(diff.changes ?? {}).map(([field, change], j) => (
                  <div key={j} className="text-xs text-muted-foreground ml-4">
                    {field}: {String((change as { old: unknown }).old ?? "空")} → {String((change as { new: unknown }).new)}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPreview(null)}>
              キャンセル
            </Button>
            <Button onClick={handleApply} disabled={applyMu.isPending}>
              インポート実行
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
