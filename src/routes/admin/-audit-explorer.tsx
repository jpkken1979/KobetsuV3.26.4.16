import { useAdminRows } from "@/lib/hooks/use-admin-rows";
import { queryKeys } from "@/lib/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatedPage } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AuditActionBadge } from "@/components/ui/status-badge";
import type { AuditLogEntry } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "motion/react";
import {
  Shield,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";
import { useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PAGE_SIZES = [10, 25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];

const ENTITY_LABELS: Record<string, string> = {
  contract: "契約",
  employee: "社員",
  company: "企業",
  factory: "工場",
  calendar: "カレンダー",
  document: "書類",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  } as Intl.DateTimeFormatOptions);
}

function formatDetails(detail: unknown): string {
  if (!detail) return "—";
  if (typeof detail === "object") {
    try {
      return JSON.stringify(detail);
    } catch {
      return String(detail);
    }
  }
  return String(detail);
}

function parseAuditRow(
  row: Record<string, unknown>
): Omit<AuditLogEntry, "id"> & { id: number } {
  return {
    id: Number(row.id) || 0,
    timestamp: String(row.timestamp ?? ""),
    action: String(row.action ?? ""),
    entityType: String(row.entityType ?? ""),
    entityId: row.entityId != null ? Number(row.entityId) || null : null,
    userName: row.userName != null ? String(row.userName) : null,
    detail: row.detail != null ? String(row.detail) : null,
    operationId: row.operationId != null ? String(row.operationId) : null,
  };
}

// ---------------------------------------------------------------------------
// SortHeader
// ---------------------------------------------------------------------------
interface SortHeaderProps {
  label: string;
  colKey: string;
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (col: string) => void;
}

function SortHeader({ label, colKey, sortBy, sortDir, onSort }: SortHeaderProps) {
  const isActive = sortBy === colKey;
  const Icon = isActive
    ? sortDir === "asc"
      ? ChevronUp
      : ChevronDown
    : ChevronsUpDown;
  return (
    <th className="px-3 py-2 text-left">
      <button
        className={cn(
          "flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider",
          "text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
          isActive && "text-foreground"
        )}
        onClick={() => onSort(colKey)}
        title={`Sort by ${label}`}
      >
        {label}
        <Icon className="w-3 h-3" />
      </button>
    </th>
  );
}

// ---------------------------------------------------------------------------
// SkeletonRows
// ---------------------------------------------------------------------------
function SkeletonRows({ colCount = 7 }: { colCount?: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-border/40">
          {Array.from({ length: colCount }).map((__, j) => (
            <td key={j} className="px-3 py-2">
              <div
                className="h-3 rounded bg-muted animate-pulse"
                style={{ width: `${30 + ((i * 7 + j * 11) % 60)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// AuditExplorer
// ---------------------------------------------------------------------------
export function AuditExplorer() {
  const prefersReduced = useReducedMotion();
  void prefersReduced; // available for animation extensions

  const qc = useQueryClient();

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [search, setSearch] = useState("");

  // Pagination / sort
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [sortBy, setSortBy] = useState("timestamp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: rowResult, isLoading, isFetching } = useAdminRows("audit_log", {
    page,
    pageSize,
    sortBy,
    sortDir,
  });

  const totalPages = rowResult ? Math.ceil(rowResult.total / pageSize) : 0;

  // Parse raw rows into AuditLogEntry[]
  const auditRows = useMemo<AuditLogEntry[]>(() => {
    if (!rowResult?.rows) return [];
    return rowResult.rows.map((r) => parseAuditRow(r as Record<string, unknown>));
  }, [rowResult]);

  // Client-side filters on top of server sort/page
  const filteredRows = useMemo(() => {
    let rows = auditRows;

    if (actionFilter) {
      rows = rows.filter((r) => r.action === actionFilter);
    }
    if (entityFilter) {
      rows = rows.filter((r) => r.entityType === entityFilter);
    }
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      rows = rows.filter((r) => {
        const t = new Date(r.timestamp).getTime();
        return !isNaN(from) && !isNaN(t) && t >= from;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo + "T23:59:59").getTime();
      rows = rows.filter((r) => {
        const t = new Date(r.timestamp).getTime();
        return !isNaN(to) && !isNaN(t) && t <= to;
      });
    }
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      rows = rows.filter((r) =>
        (r.userName ?? "").toLowerCase().includes(q)
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        [r.action, r.entityType, r.entityId, r.detail, r.userName, r.timestamp]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    return rows;
  }, [auditRows, actionFilter, entityFilter, dateFrom, dateTo, userSearch, search]);

  function handleSort(col: string) {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(1);
  }

  function handleRefresh() {
    qc.invalidateQueries({ queryKey: queryKeys.admin.rows("audit_log") });
  }

  function handlePageSizeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setPageSize(Number(e.target.value) as PageSize);
    setPage(1);
  }

  function handleFilterChange() {
    setPage(1);
  }

  const displayedRows = filteredRows;

  return (
    <AnimatedPage>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium">Audit Log</span>
            <span className="text-xs text-muted-foreground">Admin Audit Explorer</span>
            {rowResult && (
              <span className="text-xs text-muted-foreground">
                ({rowResult.total.toLocaleString()} rows)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-8 h-8 w-44 text-sm"
                placeholder="Search..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                aria-label="Audit log search"
              />
            </div>

            <Select
              className="h-8 w-20 text-sm"
              value={String(pageSize)}
              onChange={handlePageSizeChange}
              aria-label="Page size"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={String(size)}>
                  {size}
                </option>
              ))}
            </Select>

            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={handleRefresh}
              disabled={isFetching}
            >
              <RefreshCw
                className={cn("w-3.5 h-3.5", isFetching && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 px-4 py-3">
          <Filter className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />

          {/* Action filter */}
          <Select
            className="h-8 w-28 text-sm"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              handleFilterChange();
            }}
            aria-label="Filter by action"
          >
            <option value="">全操作</option>
            <option value="create">作成</option>
            <option value="update">更新</option>
            <option value="delete">削除</option>
            <option value="export">出力</option>
            <option value="import">取込</option>
          </Select>

          {/* Entity type filter */}
          <Select
            className="h-8 w-28 text-sm"
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              handleFilterChange();
            }}
            aria-label="Filter by entity type"
          >
            <option value="">全エンティティ</option>
            <option value="contract">契約</option>
            <option value="employee">社員</option>
            <option value="company">企業</option>
            <option value="factory">工場</option>
            <option value="calendar">カレンダー</option>
            <option value="document">書類</option>
          </Select>

          {/* Date range */}
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              className="h-8 w-36 text-sm"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                handleFilterChange();
              }}
              aria-label="Date from"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              type="date"
              className="h-8 w-36 text-sm"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                handleFilterChange();
              }}
              aria-label="Date to"
            />
          </div>

          {/* User name search */}
          <Input
            className="h-8 w-36 text-sm"
            placeholder="ユーザー名..."
            value={userSearch}
            onChange={(e) => {
              setUserSearch(e.target.value);
              handleFilterChange();
            }}
            aria-label="Filter by user name"
          />

          {/* Result count */}
          <span className="ml-auto rounded-full bg-muted/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {displayedRows.length}件
          </span>
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border sticky top-0 z-10">
                <tr>
                  <SortHeader label="ID" colKey="id" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="日時" colKey="timestamp" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="操作" colKey="action" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="対象" colKey="entityType" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader label="Entity ID" colKey="entityId" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">詳細</th>
                  <SortHeader label="ユーザー" colKey="userName" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <SkeletonRows colCount={7} />
                ) : displayedRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-muted-foreground text-sm"
                    >
                      ログが見つかりません
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((log, i) => (
                    <tr
                      key={log.id}
                      className={cn(
                        "border-b border-border/40 last:border-0 transition-colors hover:bg-muted/30",
                        i % 2 === 1 && "bg-muted/10"
                      )}
                    >
                      <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">
                        {log.id}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-muted-foreground">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="px-3 py-2">
                        <AuditActionBadge action={log.action} />
                      </td>
                      <td className="px-3 py-2 text-xs font-medium">
                        {ENTITY_LABELS[log.entityType] || log.entityType || "—"}
                      </td>
                      <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">
                        {log.entityId ?? "—"}
                      </td>
                      <td
                        className="max-w-xs truncate px-3 py-2 text-xs text-muted-foreground"
                        title={log.detail ?? undefined}
                      >
                        {formatDetails(log.detail)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {log.userName ?? "system"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!isLoading && rowResult && rowResult.total > 0 && (
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
    </AnimatedPage>
  );
}
