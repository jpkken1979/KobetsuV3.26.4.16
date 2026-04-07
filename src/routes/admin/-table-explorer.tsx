import { useState } from "react";
import { useAdminTables } from "@/lib/hooks/use-admin-tables";
import { useAdminRows } from "@/lib/hooks/use-admin-rows";
import { queryKeys } from "@/lib/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import type { AdminColumnMeta, AdminTableMeta } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "motion/react";
import {
  Building2,
  Factory,
  Users,
  FileText,
  Link2,
  Calendar,
  Clock,
  Shield,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  RefreshCw,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Table registry — maps table names to icons and display labels
// ---------------------------------------------------------------------------
const TABLE_REGISTRY: Record<
  string,
  { icon: React.ElementType; label: string }
> = {
  client_companies: { icon: Building2, label: "取引先企業" },
  factories: { icon: Factory, label: "工場・ライン" },
  employees: { icon: Users, label: "社員" },
  contracts: { icon: FileText, label: "個別契約書" },
  contract_employees: { icon: Link2, label: "契約書×社員" },
  factory_calendars: { icon: Calendar, label: "工場カレンダー" },
  shift_templates: { icon: Clock, label: "シフトテンプレート" },
  audit_log: { icon: Shield, label: "監査ログ" },
};

const PAGE_SIZES = [10, 25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function cellClass(value: unknown): string {
  if (value === null || value === undefined)
    return "text-muted-foreground italic";
  return "text-foreground";
}

// ---------------------------------------------------------------------------
// TableCell — single data cell
// ---------------------------------------------------------------------------
function TableCell({ value }: { value: unknown }) {
  return (
    <td
      className="px-3 py-2 text-sm max-w-xs truncate"
      title={formatCell(value)}
    >
      <span className={cellClass(value)}>{formatCell(value)}</span>
    </td>
  );
}

// ---------------------------------------------------------------------------
// SortHeader — sortable column header
// ---------------------------------------------------------------------------
interface SortHeaderProps {
  column: AdminColumnMeta;
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
}

function SortHeader({ column, sortBy, sortDir, onSort }: SortHeaderProps) {
  const isActive = sortBy === column.name;
  const Icon = isActive
    ? sortDir === "asc"
      ? ChevronUp
      : ChevronDown
    : ChevronsUpDown;
  return (
    <th className="px-3 py-2 text-left">
      <button
        className={cn(
          "flex items-center gap-1 text-xs font-semibold uppercase tracking-wider",
          "text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
          isActive && "text-foreground"
        )}
        onClick={() => onSort(column.name)}
        title={`Sort by ${column.name}`}
      >
        {column.name}
        <Icon className="w-3.5 h-3.5" />
        {column.isPrimaryKey && (
          <Badge variant="warning" className="ml-1 text-[10px] px-1.5 py-0">
            PK
          </Badge>
        )}
        {column.isForeignKey && (
          <Badge variant="info" className="ml-0.5 text-[10px] px-1.5 py-0">
            FK
          </Badge>
        )}
      </button>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Skeleton rows for loading state
// ---------------------------------------------------------------------------
function SkeletonRows({ colCount }: { colCount: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-border/50">
          {Array.from({ length: colCount }).map((__, j) => (
            <td key={j} className="px-3 py-2">
              <div
                className="h-3 rounded bg-muted animate-pulse"
                style={{ width: `${40 + ((i * 7 + j * 13) % 60)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function TableExplorer() {
  const qc = useQueryClient();
  void useReducedMotion(); // accessible for future animation enhancements

  const [selectedTable, setSelectedTable] = useState<string>(
    "client_companies"
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");

  const { data: tables, isLoading: tablesLoading } = useAdminTables();

  const { data: rowResult, isLoading: rowsLoading, isFetching } =
    useAdminRows(selectedTable, {
      page,
      pageSize,
      sortBy: sortBy || undefined,
      sortDir,
    });

  const totalPages = rowResult ? Math.ceil(rowResult.total / pageSize) : 0;

  function handleSort(col: string) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(1);
  }

  function handleTableSelect(table: string) {
    setSelectedTable(table);
    setPage(1);
    setSortBy("");
    setSortDir("asc");
    setSearch("");
  }

  function handleRefresh() {
    qc.invalidateQueries({ queryKey: queryKeys.admin.rows(selectedTable) });
  }

  function handlePageSizeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setPageSize(Number(e.target.value) as PageSize);
    setPage(1);
  }

  const filteredRows =
    search.trim().length > 0 && rowResult
      ? rowResult.rows.filter((row) =>
          Object.values(row).some((v) =>
            String(v ?? "").toLowerCase().includes(search.toLowerCase())
          )
        )
      : rowResult?.rows ?? [];

  const columns = rowResult?.columns ?? [];

  return (
    <div className="flex flex-row gap-4 min-h-[600px]">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 space-y-1">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tables ({tables?.length ?? 0})
        </div>

        {tablesLoading ? (
          <div className="space-y-1 px-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-9 rounded-md bg-muted/50 animate-pulse"
              />
            ))}
          </div>
        ) : (
          tables?.map((table: AdminTableMeta) => {
            const reg = TABLE_REGISTRY[table.name];
            const Icon = reg?.icon ?? Database;
            const label = reg?.label ?? table.name;
            const isActive = selectedTable === table.name;
            return (
              <button
                key={table.name}
                onClick={() => handleTableSelect(table.name)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                  isActive
                    ? "bg-background shadow-sm text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{label}</span>
                </span>
                <Badge
                  variant="secondary"
                  className="ml-2 text-[10px] px-1.5 py-0 flex-shrink-0"
                >
                  {table.count.toLocaleString()}
                </Badge>
              </button>
            );
          })
        )}
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto min-w-0">
        <div className="space-y-3">
          {/* Header row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {(() => {
                const reg = TABLE_REGISTRY[selectedTable];
                const Icon = reg?.icon ?? Database;
                return <Icon className="w-5 h-5 text-muted-foreground" />;
              })()}
              <h2 className="text-base font-semibold">
                {TABLE_REGISTRY[selectedTable]?.label ?? selectedTable}
              </h2>
              <Badge variant="secondary">{selectedTable}</Badge>
              {rowResult && (
                <span className="text-sm text-muted-foreground">
                  ({rowResult.total.toLocaleString()} rows)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-8 h-8 w-48 text-sm"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              {/* Page size — native <select> styled to match design */}
              <Select
                className="h-8 w-20 text-sm"
                value={String(pageSize)}
                onChange={handlePageSizeChange}
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={String(size)}>
                    {size}
                  </option>
                ))}
              </Select>

              {/* Refresh */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={handleRefresh}
                disabled={isFetching}
              >
                <RefreshCw
                  className={cn(
                    "w-3.5 h-3.5",
                    isFetching && "animate-spin"
                  )}
                />
                Refresh
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-b border-border sticky top-0 z-10">
                  <tr>
                    {rowsLoading ? (
                      <th className="px-3 py-2 text-left">
                        <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                      </th>
                    ) : (
                      columns.map((col) => (
                        <SortHeader
                          key={col.name}
                          column={col}
                          sortBy={sortBy}
                          sortDir={sortDir}
                          onSort={handleSort}
                        />
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rowsLoading ? (
                    <SkeletonRows colCount={columns.length || 5} />
                  ) : filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length || 1}
                        className="px-3 py-12 text-center text-muted-foreground"
                      >
                        No rows found
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        {Object.entries(row).map(([key, value]) => (
                          <TableCell key={key} value={value} />
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!rowsLoading && rowResult && rowResult.total > 0 && (
              <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/20">
                <span className="text-xs text-muted-foreground">
                  {((page - 1) * pageSize + 1).toLocaleString()}
                  {" – "}
                  {Math.min(page * pageSize, rowResult.total).toLocaleString()}
                  {" of "}
                  {rowResult.total.toLocaleString()}
                </span>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => setPage(1)}
                    disabled={page <= 1}
                  >
                    ⟪
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    ←
                  </Button>

                  <span className="px-2 text-xs text-muted-foreground">
                    {page} / {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    →
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => setPage(totalPages)}
                    disabled={page >= totalPages}
                  >
                    ⟫
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
