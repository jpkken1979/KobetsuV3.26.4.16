/**
 * Contract Manager — Admin Tab 4 Orchestrator.
 * Manages state, queries, mutations, and coordinates with ContractTable component.
 */

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckSquare,
  Edit3,
  FileText,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ContractStatusBadge } from "@/components/ui/status-badge";
import { api, type Contract } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { ContractTable, type ContractRow } from "./-contract-table";

/* ── Constants ─────────────────────────────────────────────────────────── */
type PageSize = 10 | 25 | 50 | 100;

const STATUS_OPTIONS = [
  { value: "all", label: "全て" },
  { value: "active", label: "有効" },
  { value: "draft", label: "下書き" },
  { value: "expired", label: "期限切れ" },
  { value: "cancelled", label: "取消済み" },
  { value: "renewed", label: "更新済み" },
] as const;

/* ── Column definitions ──────────────────────────────────────────────── */
function buildColumns(
  onDelete: (c: ContractRow) => void,
  onRenew: (c: ContractRow) => void,
): ColumnDef<ContractRow>[] {
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
          aria-label={`Seleccionar ${row.original.contractNumber}`}
          className="h-4 w-4 rounded border-border/60 text-primary accent-primary cursor-pointer"
        />
      ),
      size: 40,
    },
    {
      accessorKey: "contractNumber",
      header: "契約番号",
      cell: ({ row }) => (
        <Link
          to="/contracts/$contractId"
          params={{ contractId: String(row.original.id) }}
          className="font-mono text-xs font-semibold text-primary hover:underline hover:underline-offset-2"
        >
          {row.original.contractNumber}
        </Link>
      ),
      size: 180,
    },
    {
      accessorKey: "companyName",
      header: "派遣先",
      cell: ({ getValue }) => (
        <span className="text-sm font-medium truncate max-w-[200px] block">
          {(getValue() as string) || "—"}
        </span>
      ),
      size: 200,
    },
    {
      accessorKey: "factoryName",
      header: "工場・ライン",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground truncate max-w-[180px] block">
          {row.original.factoryName || "—"}
        </span>
      ),
      size: 180,
    },
    {
      accessorKey: "startDate",
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting()}
          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          開始日
          {column.getIsSorted() === "asc" ? (
            <ArrowUp className="h-3 w-3 text-primary" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="h-3 w-3 text-muted-foreground/30" />
          )}
        </button>
      ),
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? (
          <span className="font-mono text-sm tabular-nums">
            {new Date(v).toLocaleDateString("ja-JP")}
          </span>
        ) : (
          "—"
        );
      },
      size: 110,
    },
    {
      accessorKey: "endDate",
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting()}
          className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          終了日
          {column.getIsSorted() === "asc" ? (
            <ArrowUp className="h-3 w-3 text-primary" />
          ) : column.getIsSorted() === "desc" ? (
            <ArrowDown className="h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="h-3 w-3 text-muted-foreground/30" />
          )}
        </button>
      ),
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? (
          <span className="font-mono text-sm tabular-nums">
            {new Date(v).toLocaleDateString("ja-JP")}
          </span>
        ) : (
          "—"
        );
      },
      size: 110,
    },
    {
      accessorKey: "status",
      header: "状態",
      cell: ({ getValue }) => (
        <ContractStatusBadge status={getValue() as string} />
      ),
      size: 100,
    },
    {
      accessorKey: "employeeCount",
      header: "社員数",
      cell: ({ getValue }) => {
        const count = getValue() as number;
        return count > 0 ? (
          <Badge variant="secondary">{count}名</Badge>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        );
      },
      size: 80,
    },
    {
      accessorKey: "hourlyRate",
      header: "時給",
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return v != null ? (
          <span className="font-mono text-sm">¥{v.toLocaleString("ja-JP")}</span>
        ) : (
          "—"
        );
      },
      size: 90,
    },
    {
      id: "actions",
      enableSorting: false,
      header: "操作",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex items-center gap-1">
            {/* PDF */}
            <Link
              to="/documents"
              search={{ contractId: c.id }}
              aria-label="PDF生成"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card transition-all hover:border-cyan-500/40 hover:bg-cyan-500/10"
            >
              <FileText className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            </Link>
            {/* Edit */}
            <Link
              to="/contracts/$contractId"
              params={{ contractId: String(c.id) }}
              aria-label="編集"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card transition-all hover:border-primary/40 hover:bg-primary/10"
            >
              <Edit3 className="h-4 w-4" />
            </Link>
            {/* Renew */}
            <button
              onClick={() => onRenew(c)}
              aria-label="更新"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card transition-all hover:border-amber-500/40 hover:bg-amber-500/10"
            >
              <RefreshCw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </button>
            {/* Delete */}
            <button
              onClick={() => onDelete(c)}
              aria-label="削除"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card transition-all hover:border-red-500/40 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </button>
          </div>
        );
      },
      size: 160,
    },
  ];
}

/* ── Main component ──────────────────────────────────────────────────── */
export function ContractManager() {
  const shouldReduceMotion = useReducedMotion();
  const qc = useQueryClient();

  /* ── Filters ─────────────────────────────────────────────────────── */
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [companySearch, setCompanySearch] = useState("");
  const [startDateFrom, setStartDateFrom] = useState("");
  const [startDateTo, setStartDateTo] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);

  /* ── Row selection ───────────────────────────────────────────────── */
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmAction, setConfirmAction] = useState<
    | { type: "delete"; row: ContractRow }
    | { type: "bulk-cancel" }
    | { type: "bulk-renew" }
    | { type: "renew"; row: ContractRow }
    | null
  >(null);

  /* ── Query ───────────────────────────────────────────────────────── */
  const params = useMemo(() => {
    const p: { status?: string; showCancelled?: boolean } = {};
    if (statusFilter !== "all") {
      p.status = statusFilter;
    }
    if (statusFilter === "cancelled") {
      p.showCancelled = true;
    }
    return p;
  }, [statusFilter]);

  const { data: contracts, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.contracts.all(params),
    queryFn: () => api.getContracts(params),
  });

  /* ── Mutations ────────────────────────────────────────────────────── */
  const deleteMutation = useCallback(
    async (id: number) => {
      await api.deleteContract(id);
      qc.invalidateQueries({ queryKey: queryKeys.contracts.invalidateAll });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.invalidateAll });
      toast.success("契約を削除しました");
    },
    [qc],
  );

  const cancelMutation = useCallback(
    async (ids: number[]) => {
      await api.bulkDeleteContracts(ids);
      qc.invalidateQueries({ queryKey: queryKeys.contracts.invalidateAll });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.invalidateAll });
      toast.success(`${ids.length}件の契約を取消しました`);
      setSelectedIds(new Set());
      setConfirmAction(null);
    },
    [qc],
  );

  const renewMutation = useCallback(
    async (contract: Contract) => {
      // Renew = create a new draft contract with the previous contract linked
      const newStartDate = contract.endDate
        ? new Date(new Date(contract.endDate).getTime() + 86400000)
            .toISOString()
            .slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const newEndDate = contract.endDate
        ? new Date(new Date(contract.endDate).getTime() + 365 * 86400000)
            .toISOString()
            .slice(0, 10)
        : undefined;
      const payload: Record<string, unknown> = {
        companyId: contract.companyId,
        factoryId: contract.factoryId,
        startDate: newStartDate,
        endDate: newEndDate,
        status: "draft",
        previousContractId: contract.id,
        employeeAssignments:
          contract.employees?.map((e) => ({
            employeeId: "id" in e ? e.id : (e as { employeeId: number }).employeeId,
            hourlyRate: "hourlyRate" in e ? e.hourlyRate : null,
          })) ?? [],
      };
      const result = await api.createContract(payload);
      qc.invalidateQueries({ queryKey: queryKeys.contracts.invalidateAll });
      toast.success("契約を更新しました", {
        description: result?.contractNumber ?? "",
      });
      setConfirmAction(null);
    },
    [qc],
  );

  const bulkRenewMutation = useCallback(
    async (rows: ContractRow[]) => {
      let success = 0;
      for (const r of rows) {
        try {
          await renewMutation(r._raw);
          success++;
        } catch {
          /* skip individual failures */
        }
      }
      toast.success(`${success}/${rows.length}件更新しました`);
      setSelectedIds(new Set());
      setConfirmAction(null);
    },
    [renewMutation],
  );

  /* ── Filter + map raw contracts → table rows ─────────────────────── */
  const rows: ContractRow[] = useMemo(() => {
    if (!contracts) return [];
    return contracts
      .filter((c: Contract) => {
        if (statusFilter !== "all" && statusFilter !== "cancelled" && c.status !== statusFilter)
          return false;
        if (statusFilter === "cancelled" && c.status !== "cancelled") return false;
        if (companySearch) {
          const q = companySearch.toLowerCase();
          if (
            !(c.company?.name ?? "").toLowerCase().includes(q) &&
            !(c.factory?.factoryName ?? "").toLowerCase().includes(q)
          )
            return false;
        }
        if (startDateFrom && c.startDate && c.startDate < startDateFrom) return false;
        if (startDateTo && c.startDate && c.startDate > startDateTo) return false;
        return true;
      })
      .map((c: Contract): ContractRow => ({
        id: c.id,
        contractNumber: c.contractNumber,
        companyName: c.company?.name ?? "—",
        factoryName: c.factory
          ? [c.factory.factoryName, c.factory.department, c.factory.lineName]
              .filter(Boolean)
              .join(" / ")
          : "—",
        startDate: c.startDate,
        endDate: c.endDate,
        status: c.status,
        employeeCount: c.employees?.length ?? 0,
        hourlyRate: c.hourlyRate,
        _raw: c,
      }));
  }, [contracts, statusFilter, companySearch, startDateFrom, startDateTo]);

  /* ── Column definitions ───────────────────────────────────────────– */
  const columns = useMemo(
    () =>
      buildColumns(
        (r) => setConfirmAction({ type: "delete", row: r }),
        (r) => setConfirmAction({ type: "renew", row: r }),
      ),
    [],
  );

  /* ── Handlers ────────────────────────────────────────────────────── */
  function handleSelectAll() {
    if (selectedIds.size === rows.length && rows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  }

  function handleRowSelect(row: ContractRow, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(row.id);
      } else {
        next.delete(row.id);
      }
      return next;
    });
  }

  function handleBulkCancel() {
    if (selectedIds.size === 0) return;
    setConfirmAction({ type: "bulk-cancel" });
  }

  function handleBulkRenew() {
    if (selectedIds.size === 0) return;
    setConfirmAction({ type: "bulk-renew" });
  }

  function handlePaginationChange({
    pageIndex,
    pageSize: newSize,
  }: {
    pageIndex: number;
    pageSize: PageSize;
  }) {
    setPage(pageIndex + 1);
    setPageSize(newSize);
  }

  function confirmAndExecute() {
    if (!confirmAction) return;
    if (confirmAction.type === "delete") {
      void deleteMutation(confirmAction.row.id).then(() => setConfirmAction(null));
    } else if (confirmAction.type === "bulk-cancel") {
      void cancelMutation([...selectedIds]);
    } else if (confirmAction.type === "bulk-renew") {
      void bulkRenewMutation(rows.filter((r) => selectedIds.has(r.id)));
    } else if (confirmAction.type === "renew") {
      void renewMutation(confirmAction.row._raw);
    }
  }

  /* ── Render ────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* ── Filter bar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        {/* Status */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            状態
          </label>
          <Select
            className="h-8 w-32"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Company search */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            派遣先
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="h-8 w-44 pl-8 text-sm"
              placeholder="企業名で検索..."
              value={companySearch}
              onChange={(e) => {
                setCompanySearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {/* Date range */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            開始日（範囲）
          </label>
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              className="h-8 w-36 text-sm"
              value={startDateFrom}
              onChange={(e) => {
                setStartDateFrom(e.target.value);
                setPage(1);
              }}
              aria-label="開始日（開始）"
            />
            <span className="text-muted-foreground text-xs">–</span>
            <Input
              type="date"
              className="h-8 w-36 text-sm"
              value={startDateTo}
              onChange={(e) => {
                setStartDateTo(e.target.value);
                setPage(1);
              }}
              aria-label="開始日（終了）"
            />
          </div>
        </div>

        {/* Global search */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <label className="text-xs font-medium text-muted-foreground">
            全文検索
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="h-8 pl-8 text-sm"
              placeholder="契約番号 · 企業名 · 工場名で検索..."
              value={globalFilter}
              onChange={(e) => {
                setGlobalFilter(e.target.value);
                setPage(1);
              }}
              aria-label="契約一覧を検索"
            />
          </div>
        </div>

        {/* Result count */}
        <div className="flex items-center gap-2 self-end pb-0.5">
          <span className="text-xs text-muted-foreground">
            {rows.length}件
          </span>
          {isFetching && (
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* ── Table component ────────────────────────────────────────── */}
      <ContractTable
        rows={rows}
        isLoading={isLoading}
        selectedIds={selectedIds}
        sorting={sorting}
        globalFilter={globalFilter}
        page={page}
        pageSize={pageSize}
        columns={columns}
        onSelectAll={handleSelectAll}
        onRowSelect={handleRowSelect}
        onSortingChange={setSorting}
        onGlobalFilterChange={setGlobalFilter}
        onPaginationChange={handlePaginationChange}
      />

      {/* ── Bulk action bar ────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            {...(shouldReduceMotion
              ? {}
              : {
                  initial: { opacity: 0, y: 24 },
                  animate: { opacity: 1, y: 0 },
                  exit: { opacity: 0, y: 24 },
                  transition: { type: "spring", stiffness: 400, damping: 30 },
                })}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-5 py-3 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-primary">
                  {selectedIds.size}件選択中
                </span>
              </div>

              <div className="h-5 w-px bg-border/40" />

              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => {
                  setSelectedIds(new Set());
                }}
              >
                <X className="h-3.5 w-3.5" />
                選択解除
              </Button>

              <Button
                variant="destructive"
                size="sm"
                className="h-8 gap-1.5"
                onClick={handleBulkCancel}
              >
                <Trash2 className="h-3.5 w-3.5" />
                一括取消
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                onClick={handleBulkRenew}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                一括更新
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Confirm dialogs ─────────────────────────────────────────── */}
      {confirmAction?.type === "delete" && (
        <ConfirmDialog
          open
          onClose={() => setConfirmAction(null)}
          onConfirm={confirmAndExecute}
          title={`契約 ${confirmAction.row.contractNumber} を削除しますか？`}
          description="この操作は取り消せません。契約データが完全に削除されます。"
          confirmLabel="削除"
          variant="destructive"
        />
      )}
      {confirmAction?.type === "bulk-cancel" && (
        <ConfirmDialog
          open
          onClose={() => setConfirmAction(null)}
          onConfirm={confirmAndExecute}
          title={`${selectedIds.size}件の契約を取消しますか？`}
          description="選択した契約のステータスが「取消済み」に変更されます。"
          confirmLabel="取消"
          variant="destructive"
        />
      )}
      {confirmAction?.type === "bulk-renew" && (
        <ConfirmDialog
          open
          onClose={() => setConfirmAction(null)}
          onConfirm={confirmAndExecute}
          title={`${selectedIds.size}件の契約を更新しますか？`}
          description="各契約の終了日の翌日を開始日として、新しい下書き契約が作成されます。"
          confirmLabel="更新"
          variant="default"
        />
      )}
      {confirmAction?.type === "renew" && (
        <ConfirmDialog
          open
          onClose={() => setConfirmAction(null)}
          onConfirm={confirmAndExecute}
          title={`契約 ${confirmAction.row.contractNumber} を更新しますか？`}
          description="終了日の翌日を開始日として、新しい下書き契約が作成されます。"
          confirmLabel="更新"
          variant="default"
        />
      )}
    </div>
  );
}
