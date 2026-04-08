/**
 * Employee Table — Table display with columns, sorting, pagination.
 * Extracted from -employee-manager.tsx for maintainability.
 */

import { useMemo, useState } from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  AlertTriangle,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Edit3,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { addDays, isBefore, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Employee } from "@/lib/api";

/* ── Constants ─────────────────────────────────────────────────────────── */
const PAGE_SIZES = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

const STATUS_OPTIONS = [
  { value: "all", label: "全て" },
  { value: "active", label: "有効" },
  { value: "inactive", label: "無効" },
] as const;

const VISA_OPTIONS = [
  { value: "all", label: "全て" },
  { value: "valid", label: "有効" },
  { value: "expiring", label: "期限迫る（30日）" },
  { value: "expired", label: "期限切れ" },
] as const;

/* ── Row type ──────────────────────────────────────────────────────────── */
export interface EmployeeRow {
  id: number;
  employeeNumber: string;
  fullName: string;
  nationality: string | null;
  companyName: string;
  factoryName: string;
  hourlyRate: number | null;
  billingRate: number | null;
  status: string;
  visaExpiry: string | null;
  _raw: Employee;
}

/* ── Sort header helper ──────────────────────────────────────────────── */
function SortHeader({
  column,
  label,
}: {
  column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: () => void };
  label: string;
}) {
  return (
    <button
      onClick={() => column.toggleSorting()}
      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
    >
      {label}
      {column.getIsSorted() === "asc" ? (
        <ArrowUp className="h-3 w-3 text-primary" />
      ) : column.getIsSorted() === "desc" ? (
        <ArrowDown className="h-3 w-3 text-primary" />
      ) : (
        <ArrowUpDown className="h-3 w-3 text-muted-foreground/30" />
      )}
    </button>
  );
}

/* ── Column definitions ──────────────────────────────────────────────── */
function buildColumns(
  onEdit: (r: EmployeeRow) => void,
  onDelete: (r: EmployeeRow) => void,
): ColumnDef<EmployeeRow>[] {
  return [
    {
      id: "select",
      enableSorting: false,
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          aria-label="Seleccionar todos"
          className="h-4 w-4 rounded border-border/60 text-primary accent-primary cursor-pointer"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          aria-label={`Seleccionar ${row.original.fullName}`}
          className="h-4 w-4 rounded border-border/60 text-primary accent-primary cursor-pointer"
        />
      ),
      size: 40,
    },
    {
      accessorKey: "employeeNumber",
      header: ({ column }) => (
        <SortHeader column={column} label="社員番号" />
      ),
      cell: ({ getValue }) => (
        <span className="font-mono text-xs font-semibold text-primary">
          {(getValue() as string) || "—"}
        </span>
      ),
      size: 130,
    },
    {
      accessorKey: "fullName",
      header: ({ column }) => (
        <SortHeader column={column} label="氏名" />
      ),
      cell: ({ getValue }) => (
        <span className="text-sm font-medium truncate max-w-[160px] block">
          {(getValue() as string) || "—"}
        </span>
      ),
      size: 160,
    },
    {
      accessorKey: "nationality",
      header: ({ column }) => (
        <SortHeader column={column} label="国籍" />
      ),
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? (
          <span className="text-sm truncate max-w-[100px] block">{v}</span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        );
      },
      size: 100,
    },
    {
      accessorKey: "companyName",
      header: ({ column }) => (
        <SortHeader column={column} label="派遣先" />
      ),
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground truncate max-w-[180px] block">
          {(getValue() as string) || "—"}
        </span>
      ),
      size: 180,
    },
    {
      accessorKey: "factoryName",
      header: ({ column }) => (
        <SortHeader column={column} label="工場・ライン" />
      ),
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground truncate max-w-[160px] block">
          {(getValue() as string) || "—"}
        </span>
      ),
      size: 160,
    },
    {
      accessorKey: "hourlyRate",
      header: ({ column }) => (
        <SortHeader column={column} label="時給" />
      ),
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return v != null ? (
          <span className="font-mono text-sm">¥{v.toLocaleString("ja-JP")}</span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        );
      },
      size: 90,
    },
    {
      accessorKey: "billingRate",
      header: ({ column }) => (
        <SortHeader column={column} label="単価" />
      ),
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return v != null ? (
          <span className="font-mono text-sm">¥{v.toLocaleString("ja-JP")}</span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        );
      },
      size: 90,
    },
    {
      accessorKey: "status",
      header: "状態",
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return (
          <Badge
            variant={
              v === "active"
                ? "success"
                : v === "inactive"
                  ? "destructive"
                  : "secondary"
            }
          >
            {v === "active" ? "有効" : v === "inactive" ? "無効" : v}
          </Badge>
        );
      },
      size: 80,
    },
    {
      accessorKey: "visaExpiry",
      header: ({ column }) => (
        <SortHeader column={column} label="VISA期限" />
      ),
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        if (!v) return <span className="text-muted-foreground text-sm">—</span>;
        const date = parseISO(v);
        const now = new Date();
        const thirtyDaysLater = addDays(now, 30);
        const isExpired = isBefore(date, now);
        const isExpiring = !isExpired && isBefore(date, thirtyDaysLater);
        return (
          <div className="flex items-center gap-1.5">
            {isExpired && (
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
            )}
            {isExpiring && !isExpired && (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
            )}
            <span
              className={`font-mono text-sm ${
                isExpired
                  ? "text-red-500"
                  : isExpiring
                    ? "text-amber-500"
                    : "text-muted-foreground"
              }`}
            >
              {new Date(v).toLocaleDateString("ja-JP")}
            </span>
          </div>
        );
      },
      size: 120,
    },
    {
      id: "actions",
      enableSorting: false,
      header: "操作",
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(r)}
              aria-label="編集"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card transition-all hover:border-primary/40 hover:bg-primary/10"
            >
              <Edit3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(r)}
              aria-label="削除"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card transition-all hover:border-red-500/40 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          </div>
        );
      },
      size: 80,
    },
  ];
}

/* ── Table component props ─────────────────────────────────────────── */
export interface EmployeeTableProps {
  rows: EmployeeRow[];
  isLoading: boolean;
  isFetching: boolean;
  onEdit: (row: EmployeeRow) => void;
  onDelete: (row: EmployeeRow) => void;
  selectedIds: Set<number>;
  onSelectRow: (row: EmployeeRow, checked: boolean) => void;
  onSelectAll: () => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  companyFilter: string;
  onCompanyFilterChange: (value: string) => void;
  nationalitySearch: string;
  onNationalitySearchChange: (value: string) => void;
  visaFilter: string;
  onVisaFilterChange: (value: string) => void;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  onExportExcel: () => void;
  companies: Array<{ id: number; name: string }> | undefined;
  page: number;
  onPageChange: (page: number) => void;
  pageSize: PageSize;
  onPageSizeChange: (size: PageSize) => void;
}

/* ── Table component ───────────────────────────────────────────────── */
export function EmployeeTable({
  rows,
  isLoading,
  isFetching,
  onEdit,
  onDelete,
  selectedIds,
  onSelectRow,
  onSelectAll,
  statusFilter,
  onStatusFilterChange,
  companyFilter,
  onCompanyFilterChange,
  nationalitySearch,
  onNationalitySearchChange,
  visaFilter,
  onVisaFilterChange,
  globalFilter,
  onGlobalFilterChange,
  onExportExcel,
  companies,
  page,
  onPageChange,
  pageSize,
  onPageSizeChange,
}: EmployeeTableProps) {
  const [sortingState, setSortingState] = useState<SortingState>([]);

  const columns = useMemo(
    () =>
      buildColumns(
        (r) => onEdit(r),
        (r) => onDelete(r),
      ),
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting: sortingState,
      globalFilter,
      pagination: { pageIndex: page - 1, pageSize },
    },
    onSortingChange: setSortingState,
    onGlobalFilterChange,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex: page - 1, pageSize })
          : updater;
      onPageChange(next.pageIndex + 1);
      onPageSizeChange(next.pageSize as PageSize);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const r = row.original;
      const q = filterValue.toLowerCase();
      return (
        r.employeeNumber.toLowerCase().includes(q) ||
        r.fullName.toLowerCase().includes(q) ||
        (r.nationality ?? "").toLowerCase().includes(q) ||
        r.companyName.toLowerCase().includes(q) ||
        r.factoryName.toLowerCase().includes(q)
      );
    },
  });

  const pageCount = table.getPageCount();

  return (
    <>
      {/* ── Filter bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">状態</label>
          <Select
            className="h-8 w-32"
            value={statusFilter}
            onChange={(e) => {
              onStatusFilterChange(e.target.value);
              onPageChange(1);
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">派遣先</label>
          <Select
            className="h-8 w-44"
            value={companyFilter}
            onChange={(e) => {
              onCompanyFilterChange(e.target.value);
              onPageChange(1);
            }}
          >
            <option value="all">全て</option>
            {companies?.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">国籍</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="h-8 w-32 pl-8 text-sm"
              placeholder="国籍で検索..."
              value={nationalitySearch}
              onChange={(e) => {
                onNationalitySearchChange(e.target.value);
                onPageChange(1);
              }}
              aria-label="国籍で検索"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">VISA期限</label>
          <Select
            className="h-8 w-44"
            value={visaFilter}
            onChange={(e) => {
              onVisaFilterChange(e.target.value);
              onPageChange(1);
            }}
          >
            {VISA_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <label className="text-xs font-medium text-muted-foreground">全文検索</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="h-8 pl-8 text-sm"
              placeholder="社員番号 · 氏名 · 国籍で検索..."
              value={globalFilter}
              onChange={(e) => {
                onGlobalFilterChange(e.target.value);
                onPageChange(1);
              }}
              aria-label="社員一覧を検索"
            />
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 self-end"
          onClick={onExportExcel}
          aria-label="Excelにエクスポート"
        >
          <Download className="h-3.5 w-3.5" />
          Excel
        </Button>

        <div className="flex items-center gap-2 self-end pb-0.5">
          <span className="text-xs text-muted-foreground">{rows.length}件</span>
          {isFetching && (
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="px-3 py-2.5 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === rows.length && rows.length > 0}
                    ref={(el) => {
                      if (el)
                        el.indeterminate =
                          selectedIds.size > 0 && selectedIds.size < rows.length;
                    }}
                    onChange={onSelectAll}
                    aria-label="全て選択"
                    className="h-4 w-4 rounded border-border/60 text-primary accent-primary cursor-pointer"
                  />
                </th>
                {table.getHeaderGroups()[0].headers.map((header) => {
                  if (header.id === "select") return null;
                  return (
                    <th
                      key={header.id}
                      className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
                      {header.isPlaceholder
                        ? null
                        : header.column.getCanSort()
                          ? (
                            <button
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                            >
                              {header.column.getIsSorted() === "asc" ? (
                                <ArrowUp className="h-3 w-3 text-primary" />
                              ) : header.column.getIsSorted() === "desc" ? (
                                <ArrowDown className="h-3 w-3 text-primary" />
                              ) : (
                                <ArrowUpDown className="h-3 w-3 text-muted-foreground/30" />
                              )}
                              {typeof header.column.columnDef.header === "string"
                                ? header.column.columnDef.header
                                : null}
                            </button>
                          )
                          : typeof header.column.columnDef.header === "string"
                            ? header.column.columnDef.header
                            : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-3 py-3">
                      <div className="h-4 w-4 rounded bg-muted animate-pulse" />
                    </td>
                    {Array.from({ length: 11 }).map((__, j) => (
                      <td key={j} className="px-3 py-3">
                        <div
                          className="h-3 rounded bg-muted animate-pulse"
                          style={{ width: `${40 + ((i * 7 + j * 13) % 60)}%` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-16 text-center text-muted-foreground">
                    社員が見つかりません
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors group"
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.original.id)}
                        onChange={(e) => onSelectRow(row.original, e.target.checked)}
                        aria-label={`${row.original.fullName}を選択`}
                        className="h-4 w-4 rounded border-border/60 text-primary accent-primary cursor-pointer"
                      />
                    </td>
                    {row.getVisibleCells().map((cell) => {
                      if (cell.column.id === "select") return null;
                      return (
                        <td key={cell.id} className="px-3 py-3">
                          {cell.getValue() != null ? String(cell.getValue()) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && rows.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20 gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {((page - 1) * pageSize + 1).toLocaleString()}
                {" – "}
                {Math.min(page * pageSize, rows.length).toLocaleString()}
                {" / "}
                {rows.length.toLocaleString()}件
              </span>
              <Select
                className="h-7 w-20 text-xs"
                value={String(pageSize)}
                onChange={(e) => {
                  onPageSizeChange(Number(e.target.value) as PageSize);
                  onPageChange(1);
                }}
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={String(size)}>
                    {size}件/頁
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => {
                  onPageChange(1);
                  table.setPageIndex(0);
                }}
                disabled={page <= 1}
                aria-label="最初ページ"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => {
                  onPageChange(page - 1);
                  table.previousPage();
                }}
                disabled={page <= 1}
                aria-label="前ページ"
              >
                ‹
              </Button>
              <span className="px-2 text-xs text-muted-foreground tabular-nums">
                {page} / {Math.max(1, pageCount)}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => {
                  onPageChange(page + 1);
                  table.nextPage();
                }}
                disabled={page >= pageCount}
                aria-label="次ページ"
              >
                ›
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={() => {
                  onPageChange(pageCount);
                  table.setPageIndex(pageCount - 1);
                }}
                disabled={page >= pageCount}
                aria-label="最終ページ"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
