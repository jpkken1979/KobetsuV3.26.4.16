/**
 * Contract Table — Reusable table component for contract listings.
 * Displays columns with sorting, pagination, row selection, and bulk action indicators.
 */

import { useReducedMotion } from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { Contract } from "@/lib/api-types";
import type { ColumnDef, SortingState, OnChangeFn } from "@tanstack/react-table";
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel } from "@tanstack/react-table";

/* ── Constants ─────────────────────────────────────────────────────────── */
const PAGE_SIZES = [10, 25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];

/* ── Row type ──────────────────────────────────────────────────────────── */
export interface ContractRow {
  id: number;
  contractNumber: string;
  companyName: string;
  factoryName: string;
  startDate: string;
  endDate: string;
  status: string;
  employeeCount: number;
  hourlyRate: number | null;
  _raw: Contract;
}

/* ── Props ─────────────────────────────────────────────────────────────── */
interface ContractTableProps {
  rows: ContractRow[];
  isLoading: boolean;
  selectedIds: Set<number>;
  sorting: SortingState;
  globalFilter: string;
  page: number;
  pageSize: PageSize;
  columns: ColumnDef<ContractRow>[];
  onSelectAll: () => void;
  onRowSelect: (row: ContractRow, checked: boolean) => void;
  onSortingChange: OnChangeFn<SortingState>;
  onGlobalFilterChange: (filter: string) => void;
  onPaginationChange: (updater: { pageIndex: number; pageSize: PageSize }) => void;
}

/* ── Component ─────────────────────────────────────────────────────────── */
export function ContractTable({
  rows,
  isLoading,
  selectedIds,
  sorting,
  globalFilter,
  page,
  pageSize,
  columns,
  onSelectAll,
  onRowSelect,
  onSortingChange,
  onGlobalFilterChange,
  onPaginationChange,
}: ContractTableProps) {
  useReducedMotion();

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      globalFilter,
      pagination: { pageIndex: page - 1, pageSize },
    },
    onSortingChange,
    onGlobalFilterChange,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex: page - 1, pageSize })
          : updater;
      onPaginationChange({ pageIndex: next.pageIndex, pageSize: next.pageSize as PageSize });
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const r = row.original;
      const q = filterValue.toLowerCase();
      return (
        r.contractNumber.toLowerCase().includes(q) ||
        r.companyName.toLowerCase().includes(q) ||
        r.factoryName.toLowerCase().includes(q)
      );
    },
  });

  const pageCount = table.getPageCount();

  function handlePageSizeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = Number(e.target.value) as PageSize;
    onPaginationChange({ pageIndex: 0, pageSize: next });
  }

  return (
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
                  {Array.from({ length: 9 }).map((__, j) => (
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
                <td colSpan={10} className="px-4 py-16 text-center text-muted-foreground">
                  契約が見つかりません
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
                      onChange={(e) => onRowSelect(row.original, e.target.checked)}
                      aria-label={`${row.original.contractNumber}を選択`}
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

      {/* ── Pagination ────────────────────────────────────────────── */}
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
              onChange={handlePageSizeChange}
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
                onPaginationChange({ pageIndex: 0, pageSize });
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
                onPaginationChange({ pageIndex: page - 2, pageSize });
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
                onPaginationChange({ pageIndex: page, pageSize });
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
                onPaginationChange({ pageIndex: pageCount - 1, pageSize });
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
  );
}
