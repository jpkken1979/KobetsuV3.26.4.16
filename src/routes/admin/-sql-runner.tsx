import { useState, useEffect } from "react";
import { useAdminSql } from "@/lib/hooks/use-admin-sql";
import type { AdminSqlResult } from "@/lib/api-types";
import { Play, AlertCircle, Clock, Rows3, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useReducedMotion } from "motion/react";

const PRESETS = [
  "SELECT * FROM employees LIMIT 50",
  "SELECT * FROM contracts LIMIT 50",
  "SELECT * FROM factories LIMIT 50",
  "SELECT * FROM audit_log ORDER BY id DESC LIMIT 50",
];

const HISTORY_KEY = "admin-sql-history";
const MAX_HISTORY = 10;

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function persistHistory(history: string[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // ignore quota errors
  }
}

export function SqlRunner() {
  const prefersReduced = useReducedMotion();

  const [query, setQuery] = useState("SELECT * FROM employees LIMIT 50");
  const [result, setResult] = useState<AdminSqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>(loadHistory);

  const { mutateAsync: executeSql, isPending: isExecuting } = useAdminSql();

  // Append successful query to history — safe in useEffect to avoid render-loop
  useEffect(() => {
    if (!result || !query.trim()) return;
    setHistory((prev) => {
      if (prev[0] === query) return prev; // already at top
      const updated = [query, ...prev.filter((q) => q !== query)].slice(
        0,
        MAX_HISTORY
      );
      persistHistory(updated);
      return updated;
    });
  }, [result, query]);

  async function handleExecute() {
    if (!query.trim() || isExecuting) return;
    setError(null);
    setResult(null);

    try {
      const data = await executeSql(query.trim());
      setResult(data as AdminSqlResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function handlePreset(sql: string) {
    setQuery(sql);
    setResult(null);
    setError(null);
  }

  function handleHistoryClick(sql: string) {
    setQuery(sql);
    setResult(null);
    setError(null);
  }

  function handleClearHistory() {
    setHistory([]);
    persistHistory([]);
  }

  const isDisabled = isExecuting || !query.trim();

  return (
    <div className="space-y-4">
      {/* SQL textarea */}
      <Textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="SELECT * FROM employees LIMIT 50"
        className={cn(
          "font-mono text-sm min-h-[120px] w-full resize-y",
          prefersReduced ? "" : "transition-colors"
        )}
      />

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={handleExecute}
          disabled={isDisabled}
          className={cn(prefersReduced ? "" : "transition-all")}
        >
          {isExecuting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          <span className="ml-1.5">Execute</span>
        </Button>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <Button
              key={preset}
              variant="ghost"
              size="sm"
              onClick={() => handlePreset(preset)}
              className={cn(
                "font-mono text-xs h-7 px-2",
                prefersReduced ? "" : "transition-colors"
              )}
            >
              {preset.split(" ")[2]}
            </Button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription className="font-mono text-sm">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Result stats */}
      {result && (
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="font-mono text-xs">
            <Rows3 className="w-3 h-3 mr-1" />
            {result.rowCount} row{result.rowCount !== 1 ? "s" : ""}
          </Badge>
          <Badge variant="secondary" className="font-mono text-xs">
            <Clock className="w-3 h-3 mr-1" />
            {result.time}ms
          </Badge>
          <Badge variant="outline" className="font-mono text-xs">
            {result.columns.length} col{result.columns.length !== 1 ? "s" : ""}
          </Badge>
        </div>
      )}

      {/* Results table */}
      {result && result.rows.length > 0 && (
        <div className="border rounded-md overflow-auto max-h-[480px]">
          <Table>
            <TableHeader>
              <TableRow>
                {result.columns.map((col) => (
                  <TableHead
                    key={col}
                    className="font-mono text-xs whitespace-nowrap bg-muted/50"
                  >
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row, i) => (
                <TableRow key={i}>
                  {result.columns.map((col) => (
                    <TableCell
                      key={col}
                      className="font-mono text-xs whitespace-nowrap max-w-[200px] truncate"
                    >
                      {formatCell(row[col])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Empty result */}
      {result && result.rows.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Query returned 0 rows.
        </p>
      )}

      {/* Query history */}
      {history.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              History
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearHistory}
              className={cn(
                "h-7 text-xs text-muted-foreground hover:text-destructive",
                prefersReduced ? "" : "transition-colors"
              )}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clear
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            {history.slice(0, MAX_HISTORY).map((h, i) => (
              <button
                key={i}
                onClick={() => handleHistoryClick(h)}
                className={cn(
                  "text-left font-mono text-xs text-muted-foreground",
                  "hover:text-foreground px-2 py-1 rounded",
                  "bg-muted/30 hover:bg-muted truncate max-w-full",
                  prefersReduced ? "" : "transition-colors"
                )}
                title={h}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
