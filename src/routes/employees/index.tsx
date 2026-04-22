import { AnimatedPage } from "@/components/ui/animated";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonTable } from "@/components/ui/skeleton";
import { EmployeeStatusBadge } from "@/components/ui/status-badge";
import type { Employee } from "@/lib/api";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useEmployees, useUpdateEmployee } from "@/lib/hooks/use-employees";
import { cn } from "@/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { differenceInDays } from "date-fns";
import { AlertTriangle, ArrowDown, ArrowUp, Edit2, RotateCcw, Search, Upload, Users } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";

// Variants at module level — outside all components (required pattern)
// Note: virtual scrolling renders rows individually, so each row animates on mount
// rather than using staggerChildren (which requires all children present simultaneously)
const tableRowVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" as const } },
};

const EmployeeImportDialogLazy = lazy(async () => {
  const mod = await import("./-employee-import-dialog");
  return { default: mod.EmployeeImportDialog };
});

const DataCheckTabLazy = lazy(async () => {
  const mod = await import("./-data-check-tab");
  return { default: mod.DataCheckTab };
});

export const Route = createFileRoute("/employees/")({
  component: EmployeesList,
  errorComponent: ({ reset }) => (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <p className="text-lg font-semibold text-destructive">エラーが発生しました</p>
      <Button variant="outline" onClick={reset}>再試行</Button>
    </div>
  ),
});

// ─── Column definitions with flex ratios ───────────────────────────────

interface ColumnDef {
  key: string;
  label: string;
  flex: number;
  minWidth: number;
  align: "left" | "right";
  sortable?: boolean;
  getValue?: (emp: Employee) => string | number | null;
}

type SortDirection = "asc" | "desc";
type SortState = { key: string; direction: SortDirection } | null;

const COLUMNS: ColumnDef[] = [
  { key: "employeeNumber", label: "社員番号", flex: 1, minWidth: 70, align: "left", sortable: true, getValue: (e) => e.employeeNumber },
  { key: "fullName", label: "氏名 / カナ", flex: 2.5, minWidth: 140, align: "left", sortable: true, getValue: (e) => e.fullName },
  { key: "nationality", label: "国籍", flex: 1, minWidth: 60, align: "left", sortable: true, getValue: (e) => e.nationality },
  { key: "hireDate", label: "入社日", flex: 1.3, minWidth: 100, align: "left", sortable: true, getValue: (e) => e.hireDate },
  { key: "hourlyRate", label: "時給", flex: 1.1, minWidth: 80, align: "right", sortable: true, getValue: (e) => e.hourlyRate },
  { key: "billingRate", label: "単価", flex: 1.1, minWidth: 80, align: "right", sortable: true, getValue: (e) => e.billingRate },
  {
    key: "factory",
    label: "派遣先工場",
    flex: 1.8,
    minWidth: 120,
    align: "left",
    sortable: true,
    getValue: (e) => [
      e.company?.shortName || e.company?.name || "",
      e.factory?.factoryName || "",
      e.factory?.department || "",
      e.factory?.lineName || "",
    ].join(" "),
  },
  { key: "clientEmployeeId", label: "派遣先ID", flex: 1, minWidth: 70, align: "left", sortable: true, getValue: (e) => e.clientEmployeeId },
  { key: "status", label: "状態", flex: 0.8, minWidth: 60, align: "left", sortable: true, getValue: (e) => e.status },
];

const STORAGE_KEY = "employee-col-widths";
const TOTAL_FLEX = COLUMNS.reduce((s, c) => s + c.flex, 0);

// ─── Column resize hook ───────────────────────────────────────────────

function useColumnResize() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widths, setWidths] = useState<number[]>([]);
  const resizingRef = useRef<{ index: number; startX: number; startWidth: number } | null>(null);

  // Calculate widths from container size + flex ratios (or restore from localStorage)
  const recalculate = useCallback(() => {
    if (!containerRef.current) return;
    const totalWidth = containerRef.current.clientWidth;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as number[];
        if (parsed.length === COLUMNS.length) {
          // Scale saved widths to current container width
          const savedTotal = parsed.reduce((s, w) => s + w, 0);
          const scale = totalWidth / savedTotal;
          setWidths(parsed.map((w, i) => Math.max(COLUMNS[i].minWidth, Math.round(w * scale))));
          return;
        }
      } catch { /* ignore */ }
    }
    setWidths(COLUMNS.map((c) => Math.max(c.minWidth, Math.round((c.flex / TOTAL_FLEX) * totalWidth))));
  }, []);

  useEffect(() => {
    recalculate();
    const ro = new ResizeObserver(() => {
      // Only auto-recalculate if no custom widths saved
      if (!localStorage.getItem(STORAGE_KEY)) recalculate();
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [recalculate]);

  const startResize = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const originalCursor = document.body.style.cursor;
    const originalUserSelect = document.body.style.userSelect;
    resizingRef.current = { index, startX: e.clientX, startWidth: widths[index] };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const newWidth = Math.max(COLUMNS[resizingRef.current.index].minWidth, resizingRef.current.startWidth + delta);
      setWidths((prev) => {
        const next = [...prev];
        next[resizingRef.current!.index] = newWidth;
        return next;
      });
    };

    const onMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;
      // Persist
      setWidths((prev) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prev));
        return prev;
      });
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [widths]);

  const resetWidths = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    recalculate();
  }, [recalculate]);

  return { containerRef, widths, startResize, resetWidths };
}

// ─── Skeleton (using shared SkeletonTable) ────────────────────────────

function TableSkeleton() {
  return <SkeletonTable rows={10} columns={9} />;
}

// ─── Editable cells ────────────────────────────────────────────────────

function EditableRate({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (val: number) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value?.toString() ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    const num = parseFloat(tempValue);
    if (!isNaN(num) && num !== value) {
      onSave(num);
    } else {
      setTempValue(value?.toString() ?? "");
    }
    setIsEditing(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleBlur();
    if (e.key === "Escape") {
      setTempValue(value?.toString() ?? "");
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        className="w-full rounded border border-primary/40 bg-background px-2 py-1 text-right text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKey}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      aria-label={value ? `時給を編集: ${value}` : "時給を設定"}
      className={cn(
        "group flex w-full items-center justify-end gap-1.5 rounded px-2 py-1 transition-colors hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/20",
        !value && "text-muted-foreground italic text-xs text-right"
      )}
    >
      <span className="font-mono">{value ? `¥${value.toLocaleString()}` : "未設定"}</span>
      <Edit2 className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-40" aria-hidden="true" />
    </button>
  );
}

function EditableText({
  value,
  onSave,
  type = "text",
  placeholder = "未設定",
}: {
  value: string | null;
  onSave: (val: string) => void;
  type?: "text" | "date";
  placeholder?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      if (type !== "date") inputRef.current?.select();
    }
  }, [isEditing, type]);

  const handleBlur = () => {
    if (tempValue !== (value ?? "")) {
      onSave(tempValue);
    } else {
      setTempValue(value ?? "");
    }
    setIsEditing(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleBlur();
    if (e.key === "Escape") {
      setTempValue(value ?? "");
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type={type}
        className="w-full rounded border border-primary/40 bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKey}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setTempValue(value ?? "");
        setIsEditing(true);
      }}
      aria-label={value ? `${placeholder}を編集: ${value}` : `${placeholder}を設定`}
      className={cn(
        "group flex w-full items-center gap-1 rounded px-2 py-1 text-left transition-colors hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/20",
        !value && "text-muted-foreground/40 italic text-[10px]"
      )}
    >
      <span className="text-xs truncate">{value || placeholder}</span>
      <Edit2 className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-40" aria-hidden="true" />
    </button>
  );
}

// ─── Avatar & Visa Badge helpers ──────────────────────────────────────

const AVATAR_TOKENS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
];

function EmployeeAvatar({ name }: { name: string }) {
  const idx = (name.codePointAt(0) ?? 0) % AVATAR_TOKENS.length;
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
      style={{
        background: `linear-gradient(135deg, ${AVATAR_TOKENS[idx]}, color-mix(in srgb, ${AVATAR_TOKENS[idx]} 75%, black))`,
      }}
    >
      {name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function VisaBadge({ expiryDate }: { expiryDate: string | null | undefined }) {
  if (!expiryDate) return null;
  const daysLeft = differenceInDays(new Date(expiryDate), new Date());
  const variant =
    daysLeft < 30 ? "alert" : daysLeft < 90 ? "warning" : "active";
  return <Badge variant={variant}>{expiryDate}</Badge>;
}

// ─── Main Component ────────────────────────────────────────────────────

function EmployeesList() {
  const shouldReduceMotion = useReducedMotion();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [activeOnly, setActiveOnly] = useState(true);
  const [activeTab, setActiveTab] = useState<"list" | "import" | "datacheck">("list");
  const [importOpen, setImportOpen] = useState(false);
  const {
    data: employees,
    isLoading,
    isError,
    error,
    refetch,
  } = useEmployees({
    search: debouncedSearch || undefined,
    status: activeOnly ? "active" : undefined,
  });
  const updateMutation = useUpdateEmployee();
  const { containerRef, widths, startResize, resetWidths } = useColumnResize();

  const handleUpdateRate = (id: number, field: "hourlyRate" | "billingRate", value: number) => {
    updateMutation.mutate({ id, data: { [field]: value } });
  };

  const handleUpdateText = (id: number, field: string, value: string) => {
    updateMutation.mutate({ id, data: { [field]: value || null } });
  };

  const hasCustomWidths = !!localStorage.getItem(STORAGE_KEY);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [sort, setSort] = useState<SortState>(null);

  const handleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (prev?.key === key) {
        return prev.direction === "asc" ? { key, direction: "desc" } : null;
      }
      return { key, direction: "asc" };
    });
  }, []);

  // Filter out system placeholder employee, then sort
  const filteredEmployees = useMemo(() => {
    const filtered = employees?.filter((e: Employee) => e.employeeNumber !== "0") ?? [];
    if (!sort) return filtered;

    const col = COLUMNS.find((c) => c.key === sort.key);
    if (!col?.getValue) return filtered;

    return [...filtered].sort((a, b) => {
      const aVal = col.getValue!(a);
      const bVal = col.getValue!(b);
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = typeof aVal === "number" && typeof bVal === "number"
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal), "ja");
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [employees, sort]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!focusedCell) return;
    
    // Don't intercept if an input is active
    if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
      if (e.key === "Escape") {
        (document.activeElement as HTMLElement).blur();
        tableRef.current?.focus();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setFocusedCell(p => p ? { ...p, row: Math.min(p.row + 1, filteredEmployees.length - 1) } : null);
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedCell(p => p ? { ...p, row: Math.max(p.row - 1, 0) } : null);
        break;
      case "ArrowRight":
        e.preventDefault();
        setFocusedCell(p => p ? { ...p, col: Math.min(p.col + 1, COLUMNS.length - 1) } : null);
        break;
      case "ArrowLeft":
        e.preventDefault();
        setFocusedCell(p => p ? { ...p, col: Math.max(p.col - 1, 0) } : null);
        break;
      case "Enter":
      {
        e.preventDefault();
        // Trigger click on the focused cell's action button
        const cell = tableRef.current?.querySelector(`[data-row="${focusedCell.row}"][data-col="${focusedCell.col}"] button`);
        (cell as HTMLElement | null)?.click();
        break;
      }
      case " ":
      {
        e.preventDefault();
        const emp = filteredEmployees[focusedCell.row];
        if (emp) {
          setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(emp.id)) next.delete(emp.id);
            else next.add(emp.id);
            return next;
          });
        }
        break;
      }
      case "/":
      {
        const searchInput = document.querySelector('input[type="search"]');
        if (searchInput) {
          e.preventDefault();
          (searchInput as HTMLInputElement).focus();
        }
        break;
      }
    }
  }, [focusedCell, filteredEmployees.length]);

  // Virtual scrolling
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const ROW_HEIGHT = 44;
  const rowVirtualizer = useVirtualizer({
    count: filteredEmployees.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <AnimatedPage className="space-y-4">
      {/* Header */}
      <PageHeader
        title="派遣社員一覧"
        tag="EMPLOYEE REGISTRY"
        subtitle={`在籍 ${employees?.filter((e: Employee) => e.status === 'active' && e.employeeNumber !== '0').length ?? 0} / 合計 ${filteredEmployees.length} 名`}
      >
        {hasCustomWidths && (
          <Button variant="outline" size="sm" onClick={resetWidths}>
            <RotateCcw className="h-3 w-3" />
            列幅リセット
          </Button>
        )}
      </PageHeader>

      {/* Tabs */}
      <div className="border-b border-border/60">
        <nav className="flex gap-1" role="tablist">
          {([
            { key: "list", label: "一覧" },
            { key: "import", label: "インポート" },
            { key: "datacheck", label: "データチェック" },
          ] as const).map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={activeTab === t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                "focus-premium relative -mb-px px-4 py-2.5 text-sm font-medium transition-colors",
                "border-b-2",
                activeTab === t.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab: List */}
      {activeTab === "list" && (
        <div>
          <div className="flex items-center gap-3">
            <div className="relative max-w-md flex-1">
              <Input
                icon={Search}
                type="search"
                placeholder="名前・カナ・社員番号で検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                suffix={search ? `${filteredEmployees.length}件` : undefined}
                aria-label="社員検索"
              />
            </div>
            <button
              onClick={() => setActiveOnly(!activeOnly)}
              className={cn(
                "focus-premium flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-all cursor-pointer",
                activeOnly
                  ? "border-[color-mix(in_srgb,var(--color-status-ok)_45%,transparent)] bg-[var(--color-status-ok-muted)] text-[var(--color-status-ok)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-status-ok)_20%,transparent),0_4px_12px_-4px_color-mix(in_srgb,var(--color-status-ok)_25%,transparent)]"
                  : "border-border/60 bg-card text-muted-foreground hover:border-[color-mix(in_srgb,var(--color-primary)_35%,var(--color-border))] hover:bg-card/90",
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  activeOnly ? "live-dot text-[var(--color-status-ok)]" : "bg-muted-foreground/30",
                )}
              />
              {activeOnly ? "在籍のみ" : "全員表示"}
            </button>
          </div>

          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            <EmptyState
              icon={AlertTriangle}
              title="社員一覧の取得に失敗しました"
              description={error instanceof Error ? error.message : "時間をおいて再度お試しください。"}
            >
              <Button variant="outline" onClick={() => void refetch()}>
                再試行
              </Button>
            </EmptyState>
          ) : filteredEmployees.length > 0 ? (
            <div
              ref={containerRef}
              className="overflow-hidden rounded-lg border border-border/60 bg-card/80 shadow-[var(--shadow-card)] backdrop-blur-sm"
            >
              <div ref={scrollContainerRef} className="overflow-auto max-h-[calc(100vh-240px)]">
                  <table 
                    ref={tableRef}
                    tabIndex={0}
                    onKeyDown={handleKeyDown}
                    className="w-full border-collapse outline-none focus:ring-1 focus:ring-primary/20" 
                    style={{ tableLayout: "fixed" }}
                  >
                  {widths.length > 0 && (
                    <colgroup>
                      {widths.map((w, i) => (
                        <col key={i} style={{ width: w }} />
                      ))}
                    </colgroup>
                  )}
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-border/80 bg-card/95 backdrop-blur-sm shadow-[0_1px_0_var(--color-border)]">
                      {COLUMNS.map((col, i) => (
                        <th
                          key={col.key}
                          scope="col"
                          className={cn(
                            "relative select-none px-3 py-2.5 text-xs font-semibold uppercase tracking-widest border-b border-border",
                            col.align === "right" ? "text-right" : "text-left",
                            col.key === "billingRate"
                              ? "text-primary bg-primary/[0.04] border-x border-primary/10"
                              : "text-muted-foreground",
                            col.sortable && "cursor-pointer hover:text-foreground/70 transition-colors"
                          )}
                          onClick={col.sortable ? () => handleSort(col.key) : undefined}
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            {sort?.key === col.key && (
                              sort.direction === "asc"
                                ? <ArrowUp className="h-3 w-3 text-primary" />
                                : <ArrowDown className="h-3 w-3 text-primary" />
                            )}
                          </span>
                          <div
                            className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-primary/30 active:bg-primary/50"
                            onMouseDown={(e) => { e.stopPropagation(); startResize(i, e); }}
                            onDoubleClick={(e) => { e.stopPropagation(); resetWidths(); }}
                          />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowVirtualizer.getVirtualItems().length > 0 && rowVirtualizer.getVirtualItems()[0].start > 0 && (
                      <tr><td colSpan={COLUMNS.length} style={{ height: rowVirtualizer.getVirtualItems()[0].start, padding: 0, border: 0 }} /></tr>
                    )}
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const emp = filteredEmployees[virtualRow.index];
                      return (
                        <motion.tr
                          key={emp.id}
                          data-index={virtualRow.index}
                          variants={tableRowVariants}
                          initial={shouldReduceMotion ? false : "hidden"}
                          animate="visible"
                          onClick={() => setFocusedCell(p => (p?.row === virtualRow.index ? p : { row: virtualRow.index, col: p?.col ?? 1 }))}
                          className={cn(
                            "group border-b border-border/50 last:border-0 transition-colors duration-150",
                            "hover:bg-primary/5",
                            focusedCell?.row === virtualRow.index ? "bg-primary/10" : virtualRow.index % 2 === 1 ? "bg-muted/[0.03] dark:bg-muted/[0.02]" : ""
                          )}
                          style={{ height: "var(--row-height, 44px)" }}
                        >
                          {COLUMNS.map((col, colIndex) => {
                            const isFocused = focusedCell?.row === virtualRow.index && focusedCell?.col === colIndex;
                            return (
                              <td 
                                key={col.key}
                                data-row={virtualRow.index}
                                data-col={colIndex}
                                className={cn(
                                  "overflow-hidden px-3 py-[var(--table-cell-py, 0.65rem)] transition-all",
                                  isFocused && "ring-2 ring-inset ring-primary/40 bg-primary/15",
                                  col.align === "right" ? "text-right" : "text-left",
                                  col.key === "billingRate" && "bg-primary/[0.02] border-x border-primary/[0.06]"
                                )}
                              >
                                {col.key === "employeeNumber" && (
                                  <span className="text-xs font-mono text-muted-foreground/60">{emp.employeeNumber}</span>
                                )}
                                {col.key === "fullName" && (
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <EmployeeAvatar name={emp.fullName ?? "?"} />
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                      <span className="font-medium text-foreground truncate">{emp.fullName}</span>
                                      <span className="text-[9px] text-muted-foreground/50 font-medium uppercase tracking-tighter truncate">{emp.katakanaName}</span>
                                      {emp.visaExpiry && <VisaBadge expiryDate={emp.visaExpiry} />}
                                    </div>
                                  </div>
                                )}
                                {col.key === "nationality" && (
                                  <span className="text-xs font-semibold text-muted-foreground/80">{emp.nationality ?? "--"}</span>
                                )}
                                {col.key === "hireDate" && (
                                  <EditableText
                                    value={emp.hireDate}
                                    type="date"
                                    onSave={(val) => handleUpdateText(emp.id, "hireDate", val)}
                                    placeholder="未設定"
                                  />
                                )}
                                {col.key === "hourlyRate" && (
                                  <EditableRate
                                    value={emp.hourlyRate}
                                    onSave={(val) => handleUpdateRate(emp.id, "hourlyRate", val)}
                                  />
                                )}
                                {col.key === "billingRate" && (
                                  <EditableRate
                                    value={emp.billingRate}
                                    onSave={(val) => handleUpdateRate(emp.id, "billingRate", val)}
                                  />
                                )}
                                {col.key === "factory" && (
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-sm text-muted-foreground truncate font-medium">{emp.company?.shortName || emp.company?.name || "--"}</span>
                                    <span className="text-[10px] text-muted-foreground/45 truncate">{emp.factory?.factoryName || "--"}</span>
                                  </div>
                                )}
                                {col.key === "clientEmployeeId" && (
                                  <EditableText
                                    value={emp.clientEmployeeId}
                                    onSave={(val) => handleUpdateText(emp.id, "clientEmployeeId", val)}
                                    placeholder="未設定"
                                  />
                                )}
                                {col.key === "status" && (
                                  <EmployeeStatusBadge status={emp.status} />
                                )}
                              </td>
                            );
                          })}
                        </motion.tr>
                      );
                    })}
                    {rowVirtualizer.getVirtualItems().length > 0 && (
                      <tr><td colSpan={COLUMNS.length} style={{ height: rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end), padding: 0, border: 0 }} /></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title={search ? "検索結果がありません" : "社員が見つかりません"}
              description={search ? `"${search}" に一致する社員はいません。` : "別のキーワードを試すか、Excelからインポートしてください。"}
            >
              {search ? (
                <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                  検索をクリア
                </Button>
              ) : (
                <Link to="/import">
                  <Button size="sm">
                    Excelからインポート
                  </Button>
                </Link>
              )}
            </EmptyState>
          )}
        </div>
      )}

      {/* Tab: Import */}
      {activeTab === "import" && (
        <div className="flex justify-end">
          <Button onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />インポート
          </Button>
        </div>
      )}

      {/* Tab: Data Check */}
      {activeTab === "datacheck" && (
        <Suspense fallback={<TableSkeleton />}>
          <DataCheckTabLazy />
        </Suspense>
      )}

      {importOpen && (
        <Suspense fallback={null}>
          <EmployeeImportDialogLazy open={importOpen} onClose={() => setImportOpen(false)} />
        </Suspense>
      )}

      {/* Floating Action HUD */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 80, x: "-50%", opacity: 0 }}
            animate={{ y: 0, x: "-50%", opacity: 1 }}
            exit={{ y: 80, x: "-50%", opacity: 0 }}
            className={cn(
              "fixed bottom-8 left-1/2 z-50 flex items-center gap-5 rounded-lg border bg-card/90 px-5 py-2.5 backdrop-blur-xl",
              "border-[color-mix(in_srgb,var(--color-primary)_40%,var(--color-border))]",
              "shadow-[0_16px_40px_-8px_color-mix(in_srgb,var(--color-primary)_30%,transparent),0_0_0_1px_color-mix(in_srgb,var(--color-primary)_22%,transparent)]",
            )}
          >
            <div className="flex items-center gap-2 border-r border-border/60 pr-5">
              <span className="mono-tabular flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[0.6875rem] font-bold text-primary-foreground">
                {selectedIds.size}
              </span>
              <span className="text-sm font-semibold tracking-tight text-foreground">選択中</span>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline">
                CSVエクスポート
              </Button>
              <Button size="sm" variant="destructive">
                一括削除...
              </Button>
              <div className="mx-1 h-4 w-px bg-border/60" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              >
                解除
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </AnimatedPage>
  );
}
