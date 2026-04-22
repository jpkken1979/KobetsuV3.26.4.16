import { useState, useCallback, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useUpdateEmployee } from "@/lib/hooks/use-employees";
import { useUpdateFactory } from "@/lib/hooks/use-factories";
import { queryKeys } from "@/lib/query-keys";
import { COMPLETENESS_CONFIG, FIELD_LABELS } from "./-completeness";
import type { DataCheckEmployee } from "@/lib/api-types";
import { AlertCircle, ArrowUp, ArrowDown, ArrowUpDown, X } from "lucide-react";

// ─── Column Definition ──────────────────────────────────────────────

interface ColumnDef {
  key: string;
  label: string;
  width: number;
  group: string;
  /** "employee" | "factory" | "readonly" */
  target: "employee" | "factory" | "readonly";
  /** DB field name for PATCH (defaults to key) */
  field?: string;
  format?: (val: unknown) => string;
}

const COLUMN_GROUPS: { group: string; label: string; colorClass: string }[] = [
  { group: "status", label: "", colorClass: "bg-transparent" },
  { group: "id", label: "ID", colorClass: "bg-blue-500/10 dark:bg-blue-500/15" },
  { group: "personal", label: "個人情報", colorClass: "bg-blue-500/10 dark:bg-blue-500/15" },
  { group: "assignment", label: "配属先", colorClass: "bg-cyan-500/10 dark:bg-cyan-500/15" },
  { group: "conflict", label: "抵触日", colorClass: "bg-orange-500/10 dark:bg-orange-500/15" },
  { group: "supervisor", label: "指揮命令者", colorClass: "bg-emerald-500/10 dark:bg-emerald-500/15" },
  { group: "hakensaki", label: "派遣先責任者", colorClass: "bg-teal-500/10 dark:bg-teal-500/15" },
  { group: "complaintClient", label: "苦情処理(派遣先)", colorClass: "bg-amber-500/10 dark:bg-amber-500/15" },
  { group: "complaintUns", label: "苦情処理(派遣元)", colorClass: "bg-rose-500/10 dark:bg-rose-500/15" },
  { group: "managerUns", label: "派遣元責任者", colorClass: "bg-blue-500/10 dark:bg-blue-500/15" },
  { group: "work", label: "就業条件", colorClass: "bg-sky-500/10 dark:bg-sky-500/15" },
];

const COLUMNS: ColumnDef[] = [
  // Status
  { key: "_dot", label: "", width: 40, group: "status", target: "readonly" },
  // ID
  { key: "employeeNumber", label: "社員№", width: 90, group: "id", target: "readonly" },
  { key: "clientEmployeeId", label: "派遣先ID", width: 90, group: "id", target: "employee" },
  // Personal
  { key: "fullName", label: "氏名", width: 140, group: "personal", target: "employee" },
  { key: "katakanaName", label: "カナ", width: 140, group: "personal", target: "employee" },
  { key: "nationality", label: "国籍", width: 80, group: "personal", target: "employee" },
  { key: "gender", label: "性別", width: 60, group: "personal", target: "employee" },
  { key: "birthDate", label: "生年月日", width: 100, group: "personal", target: "employee" },
  { key: "actualHireDate", label: "入社日", width: 100, group: "personal", target: "employee", field: "actualHireDate" },
  { key: "billingRate", label: "単価", width: 80, group: "personal", target: "employee", format: (v) => v != null ? `¥${Number(v).toLocaleString("ja-JP")}` : "" },
  { key: "hourlyRate", label: "時給", width: 80, group: "personal", target: "employee", format: (v) => v != null ? `¥${Number(v).toLocaleString("ja-JP")}` : "" },
  // Assignment
  { key: "company.name", label: "派遣先", width: 160, group: "assignment", target: "readonly" },
  { key: "factory.factoryName", label: "工場", width: 120, group: "assignment", target: "readonly" },
  { key: "factory.department", label: "課", width: 80, group: "assignment", target: "readonly" },
  { key: "factory.lineName", label: "ライン", width: 80, group: "assignment", target: "readonly" },
  { key: "address", label: "住所", width: 200, group: "assignment", target: "employee" },
  { key: "phone", label: "TEL", width: 120, group: "assignment", target: "factory", field: "phone" },
  // Conflict
  { key: "conflictDate", label: "抵触日", width: 100, group: "conflict", target: "factory", field: "conflictDate" },
  // Supervisor (指揮命令者)
  { key: "supervisorDept", label: "部署", width: 120, group: "supervisor", target: "factory", field: "supervisorDept" },
  { key: "supervisorName", label: "氏名", width: 100, group: "supervisor", target: "factory", field: "supervisorName" },
  { key: "supervisorPhone", label: "TEL", width: 120, group: "supervisor", target: "factory", field: "supervisorPhone" },
  // 派遣先責任者
  { key: "hakensakiManagerDept", label: "部署", width: 120, group: "hakensaki", target: "factory", field: "hakensakiManagerDept" },
  { key: "hakensakiManagerName", label: "氏名", width: 100, group: "hakensaki", target: "factory", field: "hakensakiManagerName" },
  { key: "hakensakiManagerPhone", label: "TEL", width: 120, group: "hakensaki", target: "factory", field: "hakensakiManagerPhone" },
  // 苦情処理(派遣先)
  { key: "complaintClientDept", label: "部署", width: 120, group: "complaintClient", target: "factory", field: "complaintClientDept" },
  { key: "complaintClientName", label: "氏名", width: 100, group: "complaintClient", target: "factory", field: "complaintClientName" },
  { key: "complaintClientPhone", label: "TEL", width: 120, group: "complaintClient", target: "factory", field: "complaintClientPhone" },
  // 苦情処理(派遣元)
  { key: "complaintUnsDept", label: "部署", width: 120, group: "complaintUns", target: "factory", field: "complaintUnsDept" },
  { key: "complaintUnsName", label: "氏名", width: 100, group: "complaintUns", target: "factory", field: "complaintUnsName" },
  { key: "complaintUnsPhone", label: "TEL", width: 120, group: "complaintUns", target: "factory", field: "complaintUnsPhone" },
  // 派遣元責任者
  { key: "managerUnsDept", label: "部署", width: 120, group: "managerUns", target: "factory", field: "managerUnsDept" },
  { key: "managerUnsName", label: "氏名", width: 100, group: "managerUns", target: "factory", field: "managerUnsName" },
  { key: "managerUnsPhone", label: "TEL", width: 120, group: "managerUns", target: "factory", field: "managerUnsPhone" },
  // Work conditions
  { key: "workHours", label: "就業時間", width: 200, group: "work", target: "readonly" },
  { key: "breakTimeDay", label: "休憩", width: 100, group: "work", target: "readonly" },
  { key: "jobDescription", label: "業務内容", width: 200, group: "work", target: "factory", field: "jobDescription" },
  { key: "closingDayText", label: "締日", width: 100, group: "work", target: "factory", field: "closingDayText" },
  { key: "paymentDayText", label: "支払日", width: 100, group: "work", target: "factory", field: "paymentDayText" },
];

// Columns that are always shown regardless of showAllColumns mode
const ALWAYS_SHOW_KEYS = new Set([
  "_dot",
  "employeeNumber",
  "clientEmployeeId",
  "fullName",
  "company.name",
  "factory.factoryName",
  "factory.department",
  "factory.lineName",
]);

// ─── Row tint classes ────────────────────────────────────────────────

const ROW_TINT: Record<string, string> = {
  green: "bg-green-500/[0.03] dark:bg-green-500/[0.04]",
  yellow: "bg-amber-500/[0.03] dark:bg-amber-500/[0.04]",
  red: "bg-red-500/[0.03] dark:bg-red-500/[0.04]",
  gray: "bg-gray-500/[0.02] dark:bg-gray-500/[0.03]",
};

// ─── Helpers ─────────────────────────────────────────────────────────

function getCellValue(emp: DataCheckEmployee, key: string): string {
  // Special composite keys
  if (key === "_dot") return "";
  if (key === "company.name") return emp.company?.name ?? "(未配属)";
  if (key === "factory.factoryName") return emp.factory?.factoryName ?? "(未配属)";
  if (key === "factory.department") return emp.factory?.department ?? "";
  if (key === "factory.lineName") return emp.factory?.lineName ?? "";
  // Factory fields (for display)
  if (key === "phone" || key === "conflictDate" || key.startsWith("supervisor") ||
      key.startsWith("hakensaki") || key.startsWith("complaint") ||
      key.startsWith("managerUns") || key === "workHours" || key === "breakTimeDay" ||
      key === "jobDescription" || key === "closingDayText" || key === "paymentDayText") {
    const factory = emp.factory;
    if (!factory) return "";
    const val = String((factory as unknown as Record<string, unknown>)[key] ?? "");
    return val;
  }
  // Employee fields
  const val = (emp as unknown as Record<string, unknown>)[key];
  return val != null ? String(val) : "";
}

// ─── Editable Cell ───────────────────────────────────────────────────

function EditableCell({
  value,
  onSave,
  width,
  format,
}: {
  value: string;
  onSave: (val: string) => void;
  width: number;
  format?: (val: unknown) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleStart = useCallback(() => {
    setDraft(value);
    setEditing(true);
  }, [value]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    if (draft !== value) {
      onSave(draft);
    }
  }, [draft, value, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        (e.target as HTMLInputElement).blur();
      } else if (e.key === "Escape") {
        setDraft(value);
        setEditing(false);
      }
    },
    [value]
  );

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="h-full w-full border-0 bg-primary/10 px-2 text-xs text-foreground outline-none ring-1 ring-primary/40 rounded"
        style={{ width }}
      />
    );
  }

  const display = format ? format(value || null) : value;

  return (
    <div
      onClick={handleStart}
      className="flex h-full cursor-pointer items-center truncate px-2 text-xs hover:bg-muted/40 rounded"
      title={display || undefined}
    >
      {display || <span className="text-muted-foreground/30">-</span>}
    </div>
  );
}

// ─── Missing Fields Tooltip ──────────────────────────────────────────

function MissingTooltip({
  missingEmployee,
  missingFactory,
}: {
  missingEmployee: string[];
  missingFactory: string[];
}) {
  const allMissing = [
    ...missingEmployee.map((f) => FIELD_LABELS[f] ?? f),
    ...missingFactory.map((f) => FIELD_LABELS[f] ?? f),
  ];
  if (allMissing.length === 0) return null;

  return (
    <div className="group/tip relative">
      <AlertCircle className="h-3 w-3 text-amber-500/70" />
      <div className="pointer-events-none absolute left-6 top-0 z-50 hidden min-w-[160px] rounded-lg border border-border/60 bg-popover px-3 py-2 text-xs shadow-xl group-hover/tip:block">
        <p className="mb-1 font-semibold text-foreground">不足フィールド:</p>
        <ul className="space-y-0.5 text-muted-foreground">
          {allMissing.map((label) => (
            <li key={label}>- {label}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── FlatView Component ──────────────────────────────────────────────

interface FlatViewProps {
  employees: DataCheckEmployee[];
  showAllColumns?: boolean;
}

export function FlatView({ employees, showAllColumns = false }: FlatViewProps) {
  const queryClient = useQueryClient();
  const updateEmployee = useUpdateEmployee();
  const updateFactory = useUpdateFactory();
  const [sortLevels, setSortLevels] = useState<{ key: string; dir: "asc" | "desc" }[]>([]);
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("data-check-col-widths");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const resizeRef = useRef<{ key: string; startX: number; startW: number } | null>(null);

  const getColWidth = useCallback((col: ColumnDef) => colWidths[col.key] ?? col.width, [colWidths]);

  const handleResizeStart = useCallback((e: React.MouseEvent, key: string, currentW: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { key, startX: e.clientX, startW: currentW };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const diff = ev.clientX - resizeRef.current.startX;
      const newW = Math.max(40, resizeRef.current.startW + diff);
      setColWidths((prev) => {
        const next = { ...prev, [resizeRef.current!.key]: newW };
        localStorage.setItem("data-check-col-widths", JSON.stringify(next));
        return next;
      });
    };
    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const handleSort = useCallback((key: string, e: React.MouseEvent) => {
    if (key === "_dot") return;
    setSortLevels((prev) => {
      const idx = prev.findIndex((s) => s.key === key);
      if (idx >= 0) {
        // Already sorted by this — toggle direction or remove on 3rd click
        const current = prev[idx];
        if (current.dir === "asc") {
          return prev.map((s, i) => i === idx ? { ...s, dir: "desc" as const } : s);
        }
        // Remove this sort level
        return prev.filter((_, i) => i !== idx);
      }
      if (e.shiftKey && prev.length > 0) {
        // Shift+Click: add as secondary/tertiary sort (max 3)
        if (prev.length >= 3) return prev;
        return [...prev, { key, dir: "asc" as const }];
      }
      // Normal click: replace all with single sort
      return [{ key, dir: "asc" as const }];
    });
  }, []);

  // Determine which columns to display based on mode
  const visibleColumns = useMemo(() => {
    if (showAllColumns) return COLUMNS;
    return COLUMNS.filter((col) => {
      if (ALWAYS_SHOW_KEYS.has(col.key)) return true;
      return employees.some((emp) => {
        const val = getCellValue(emp, col.key);
        return val === "" || val === null || val === undefined;
      });
    });
  }, [employees, showAllColumns]);

  const NUMERIC_KEYS = new Set(["billingRate", "hourlyRate"]);

  // Multi-level sort
  const sorted = useMemo(() => {
    if (sortLevels.length === 0) return employees;
    return [...employees].sort((a, b) => {
      for (const { key, dir } of sortLevels) {
        const va = getCellValue(a, key);
        const vb = getCellValue(b, key);
        let cmp: number;
        if (NUMERIC_KEYS.has(key)) {
          cmp = (va ? Number(va) : 0) - (vb ? Number(vb) : 0);
        } else {
          cmp = va.localeCompare(vb, "ja");
        }
        if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
      }
      return 0;
    });
  }, [employees, sortLevels]);

  const visibleTotalWidth = visibleColumns.reduce((sum, c) => sum + getColWidth(c), 0);

  const handleSave = useCallback(
    (emp: DataCheckEmployee, col: ColumnDef, val: string) => {
      const field = col.field ?? col.key;
      if (col.target === "employee") {
        // Parse numeric fields
        let parsed: unknown = val;
        if (field === "billingRate" || field === "hourlyRate") {
          const num = parseFloat(val.replace(/[¥,]/g, ""));
          parsed = isNaN(num) ? null : num;
        }
        updateEmployee.mutate(
          { id: emp.id, data: { [field]: parsed } as Record<string, unknown> },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: queryKeys.dataCheck.invalidateAll });
            },
          }
        );
      } else if (col.target === "factory" && emp.factory) {
        updateFactory.mutate(
          { id: emp.factory.id, data: { [field]: val || null } },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: queryKeys.dataCheck.invalidateAll });
            },
          }
        );
      }
    },
    [updateEmployee, updateFactory, queryClient]
  );

  if (employees.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-12 text-center text-muted-foreground shadow-[var(--shadow-card)]">
        <p className="text-sm">条件に一致するデータがありません</p>
      </div>
    );
  }

  // Build group header spans based on visible columns
  const groupSpans = COLUMN_GROUPS.map((g) => {
    const cols = visibleColumns.filter((c) => c.group === g.group);
    const totalW = cols.reduce((s, c) => s + getColWidth(c), 0);
    return { ...g, totalW, colCount: cols.length };
  }).filter((g) => g.colCount > 0);

  // Helper to get column label for sort display
  const getColLabel = useCallback((key: string) => {
    const col = COLUMNS.find((c) => c.key === key);
    if (!col) return key;
    const grp = COLUMN_GROUPS.find((g) => g.group === col.group);
    return grp?.label && col.label ? `${grp.label} ${col.label}` : col.label || key;
  }, []);

  return (
    <div className="space-y-2">
      {/* Sort indicator bar */}
      {sortLevels.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-1.5">
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">並べ替え:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {sortLevels.map((s, i) => (
              <span
                key={s.key}
                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
              >
                {sortLevels.length > 1 && <span className="text-[9px] font-bold">{i + 1}</span>}
                {getColLabel(s.key)}
                {s.dir === "asc" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                <button
                  type="button"
                  onClick={() => setSortLevels((prev) => prev.filter((_, j) => j !== i))}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSortLevels([])}
            className="ml-auto text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            クリア
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)] overflow-auto max-h-[calc(100vh-320px)]">
        <div style={{ minWidth: visibleTotalWidth }}>
          {/* Group Header Row */}
          <div className="flex border-b border-border/40">
            {groupSpans.map((g) => (
              <div
                key={g.group}
                style={{ width: g.totalW }}
                className={cn(
                  "flex-shrink-0 px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 border-r border-border/20 last:border-r-0",
                  g.colorClass
                )}
              >
                {g.label}
              </div>
            ))}
          </div>

          {/* Column Header Row (click=sort, shift+click=multi-sort) */}
          <div className="flex border-b border-border/60 bg-muted/20">
            {visibleColumns.map((col) => {
              const grp = COLUMN_GROUPS.find((g) => g.group === col.group);
              const sortIdx = sortLevels.findIndex((s) => s.key === col.key);
              const isSorted = sortIdx >= 0;
              const sortLevel = isSorted ? sortLevels[sortIdx] : null;
              const isSortable = col.key !== "_dot";
              const w = getColWidth(col);
              return (
                <div
                  key={col.key}
                  style={{ width: w }}
                  className={cn(
                    "relative flex flex-shrink-0 items-center gap-0.5 px-2 py-2 text-[11px] font-semibold text-muted-foreground truncate border-r border-border/10 last:border-r-0 select-none",
                    grp?.colorClass,
                    isSortable && "cursor-pointer hover:text-foreground transition-colors",
                    isSorted && "text-foreground"
                  )}
                  onClick={isSortable ? (e) => handleSort(col.key, e) : undefined}
                  title={isSortable ? "クリック: 並べ替え / Shift+クリック: 複数列で並べ替え" : undefined}
                >
                  {col.label}
                  {isSorted && (
                    <span className="inline-flex items-center gap-px">
                      {sortLevel?.dir === "asc"
                        ? <ArrowUp className="h-3 w-3 shrink-0 text-primary" />
                        : <ArrowDown className="h-3 w-3 shrink-0 text-primary" />}
                      {sortLevels.length > 1 && (
                        <span className="text-[9px] font-bold text-primary">{sortIdx + 1}</span>
                      )}
                    </span>
                  )}
                  {/* Resize handle */}
                  <div
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50"
                    onMouseDown={(e) => handleResizeStart(e, col.key, w)}
                  />
                </div>
              );
            })}
          </div>

          {/* Data Rows */}
          {sorted.map((emp) => (
            <div
              key={emp.id}
              className={cn(
                "flex h-9 border-b border-border/20 transition-colors hover:bg-muted/30 last:border-b-0",
                ROW_TINT[emp.completeness]
              )}
            >
              {visibleColumns.map((col) => {
                // Completeness dot column
                if (col.key === "_dot") {
                  return (
                    <div
                      key={col.key}
                      style={{ width: getColWidth(col) }}
                      className="flex flex-shrink-0 items-center justify-center gap-1"
                    >
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          COMPLETENESS_CONFIG[emp.completeness].dotClass
                        )}
                      />
                      {(emp.missingEmployee.length > 0 ||
                        emp.missingFactory.length > 0) && (
                        <MissingTooltip
                          missingEmployee={emp.missingEmployee}
                          missingFactory={emp.missingFactory}
                        />
                      )}
                    </div>
                  );
                }

                const rawVal = getCellValue(emp, col.key);

                // Read-only cell
                if (col.target === "readonly") {
                  return (
                    <div
                      key={col.key}
                      style={{ width: getColWidth(col) }}
                      className="flex flex-shrink-0 items-center truncate px-2 text-xs text-foreground/80"
                      title={rawVal || undefined}
                    >
                      {rawVal || (
                        <span className="text-muted-foreground/30">-</span>
                      )}
                    </div>
                  );
                }

                // Factory field but no factory assigned — read-only
                if (col.target === "factory" && !emp.factory) {
                  return (
                    <div
                      key={col.key}
                      style={{ width: getColWidth(col) }}
                      className="flex flex-shrink-0 items-center truncate px-2 text-xs text-muted-foreground/30"
                    >
                      -
                    </div>
                  );
                }

                // Editable cell
                return (
                  <div
                    key={col.key}
                    style={{ width: getColWidth(col) }}
                    className="flex-shrink-0"
                  >
                    <EditableCell
                      value={rawVal}
                      onSave={(v) => handleSave(emp, col, v)}
                      width={col.width}
                      format={col.format}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
