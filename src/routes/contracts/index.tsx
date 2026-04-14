import { AnimatedPage } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { ContractStatusBadge } from "@/components/ui/status-badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { api, downloadZip, type Contract } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    createFileRoute,
    Link,
} from "@tanstack/react-router";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    useReactTable,
    type ColumnDef,
    type SortingState,
} from "@tanstack/react-table";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Building2, Calendar, CheckSquare, ChevronRight, Eye, EyeOff, FileText, FolderOpen, History, Package, Plus, Search, Trash2, Users, Zap } from "lucide-react";
import { Fragment, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { TableSkeleton } from "./-contracts-skeleton";
import { contractColumns } from "./-contracts-columns";
import { ExpiryDateDisplay, EmployeeNames } from "./-contracts-helpers";
import { SetOptionsModal, type SetOptions } from "./-set-options-modal";

// Variants at module level — outside all components (required pattern)
const tableBodyVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

const tableRowVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: "easeOut" as const } },
};

export const Route = createFileRoute("/contracts/")(
  {
    component: ContractsList,
    errorComponent: ({ reset }) => (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-lg font-semibold text-destructive">エラーが発生しました</p>
        <Button variant="outline" onClick={reset}>再試行</Button>
      </div>
    ),
  }
);

/* ── ContractGroup interface ── */
interface ContractGroup {
  key: string; // factoryId as string
  companyName: string;
  factoryName: string;
  department: string;
  lineName: string;
  contracts: Contract[];
  totalEmployees: number;
}

function ContractsList() {
  const queryClient = useQueryClient();
  const [showCancelled, setShowCancelled] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const {
    data: contracts,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.contracts.all({ showCancelled }),
    queryFn: () => api.getContracts({ showCancelled }),
  });

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmAction, setConfirmAction] = useState<"delete" | "purge" | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleOne = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (!contracts) return;
    setSelected((prev) =>
      prev.size === contracts.length
        ? new Set()
        : new Set(contracts.map((c: Contract) => c.id))
    );
  }, [contracts]);

  const toggleGroupSelect = useCallback((group: ContractGroup) => {
    const groupIds = group.contracts.map((c) => c.id);
    const allGroupSelected = groupIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allGroupSelected) {
        groupIds.forEach((id) => next.delete(id));
      } else {
        groupIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [selected]);

  const toggleCollapse = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const allSelected = contracts && contracts.length > 0 && selected.size === contracts.length;

  // Bulk delete mutation
  const bulkDelete = useMutation({
    mutationFn: (ids: number[]) => api.bulkDeleteContracts(ids),
    onSuccess: (data: { success: boolean; deleted: number }) => {
      toast.success(`${data.deleted}件の契約を削除しました`);
      setSelected(new Set());
      setConfirmAction(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.invalidateAll });
    },
    onError: () => {
      toast.error("削除に失敗しました");
      setConfirmAction(null);
    },
  });

  const handleBulkDelete = useCallback(() => {
    if (selected.size === 0) return;
    setConfirmAction("delete");
  }, [selected]);

  // Purge (hard delete) mutation
  const purge = useMutation({
    mutationFn: (ids: number[]) => api.purgeContracts(ids),
    onSuccess: (data) => {
      toast.success(`${data.purged}件の契約を完全削除しました`);
      setSelected(new Set());
      setConfirmAction(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.invalidateAll });
    },
    onError: () => {
      toast.error("完全削除に失敗しました");
      setConfirmAction(null);
    },
  });

  const handlePurge = useCallback(() => {
    if (selected.size === 0) return;
    setConfirmAction("purge");
  }, [selected]);

  /* ── TanStack Table instance (flat contract list) ── */
  const flatContracts = useMemo(() => contracts ?? [], [contracts]);

  const table = useReactTable({
    data: flatContracts,
    columns: contractColumns as unknown as ColumnDef<Contract>[],
    state: { sorting: sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const contract = row.original as Contract;
      const search = filterValue.toLowerCase();
      return (
        (contract.contractNumber?.toLowerCase() ?? "").includes(search) ||
        (contract.company?.name?.toLowerCase() ?? "").includes(search) ||
        (contract.factory?.factoryName?.toLowerCase() ?? "").includes(search)
      );
    },
  });

  /* ── Group contracts by factoryId ── */
  const groupedContracts = useMemo<ContractGroup[]>(() => {
    const rows = table.getRowModel().rows;
    const groups = new Map<number, ContractGroup>();

    for (const row of rows) {
      const c = row.original as Contract;
      const fid = c.factoryId ?? 0;
      if (!groups.has(fid)) {
        groups.set(fid, {
          key: String(fid),
          companyName: c.company?.name ?? "--",
          factoryName: c.factory?.factoryName ?? "--",
          department: c.factory?.department ?? "",
          lineName: c.factory?.lineName ?? "",
          contracts: [],
          totalEmployees: 0,
        });
      }
      const g = groups.get(fid)!;
      g.contracts.push(c);
      g.totalEmployees += c.employees?.length ?? 0;
    }

    return [...groups.values()];
  }, [table]);

  /* ── SET generation with options modal ── */
  const [setModalGroup, setSetModalGroup] = useState<ContractGroup | null>(null);

  const executeSetGeneration = useCallback(async (group: ContractGroup, options: SetOptions) => {
    setSetModalGroup(null);
    const contractIds = group.contracts.map((c) => c.id);
    toast.loading("SET生成中...", { id: "set-gen" });
    try {
      const result = await api.generateSet(contractIds, options.kobetsuCopies);
      let successFiles = result.files.filter((f) => f.filename);
      // Filter by user's output format choices
      if (!options.includeSeparate) {
        successFiles = successFiles.filter((f) => f.type === "allInOne");
      }
      if (!options.includeAllInOne) {
        successFiles = successFiles.filter((f) => f.type !== "allInOne");
      }
      toast.success(`${successFiles.length}件のPDFを生成しました`, { id: "set-gen" });
      if (successFiles.length > 0) {
        const filenames = successFiles.map((f) => f.filename);
        const parts = [group.companyName, group.factoryName, group.department, group.lineName]
          .filter(Boolean)
          .join("_");
        const zipName = `SET_${parts}.zip`;
        await downloadZip(filenames, zipName);
      }
    } catch {
      toast.error("SET生成に失敗しました", { id: "set-gen" });
    }
  }, []);

  // Computed summary stats
  const summary = useMemo(() => ({
    total: contracts?.length ?? 0,
    active: contracts?.filter((c: Contract) => c.status === "active").length ?? 0,
    expiring: contracts?.filter((c: Contract) => {
      if (!c.endDate) return false;
      const days = Math.ceil((new Date(c.endDate).getTime() - Date.now()) / 86400000);
      return days >= 0 && days <= 30;
    }).length ?? 0,
  }), [contracts]);

  return (
    <AnimatedPage className="space-y-6">
      {/* Header */}
      <PageHeader
        title="個別契約書一覧"
        tag="CONTRACT_REGISTRY"
        subtitle={`${summary.total}件${summary.active > 0 ? ` · 有効 ${summary.active}` : ""}${summary.expiring > 0 ? ` · 期限間近 ${summary.expiring}` : ""}`}
      >
        {/* Link to history */}
        <Link
          to="/history"
          className="text-xs text-muted-foreground hover:text-foreground border border-border/60 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5 transition-colors"
        >
          <History className="h-3 w-3" />
          履歴
        </Link>
        {/* Filter pill: toggle cancelled */}
        <button
          onClick={() => { setShowCancelled((v) => !v); setSelected(new Set()); }}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold transition-all inline-flex items-center gap-1.5",
            showCancelled
              ? "bg-primary text-primary-foreground dark:shadow-[0_0_12px_rgba(139,92,246,0.4)]"
              : "border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}
        >
          {showCancelled ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          取消済み{showCancelled ? "表示中" : "を表示"}
        </button>
        <Link to="/contracts/batch">
          <Button variant="success">
            <Zap className="h-4 w-4" />
            一括作成
          </Button>
        </Link>
        <Link to="/contracts/mid-hires">
          <Button variant="outline">
            <Users className="h-4 w-4" />
            途中入社
          </Button>
        </Link>
        <Link to="/contracts/new">
          <Button>
            <Plus className="h-4 w-4" />
            新規作成
          </Button>
        </Link>
      </PageHeader>

      {/* Search input */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="契約番号 · 派遣先 · 工場名で検索..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="pl-9 h-9 bg-card"
          aria-label="契約一覧を検索"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="契約一覧の取得に失敗しました"
          description={error instanceof Error ? error.message : "時間をおいて再度お試しください。"}
        >
          <Button variant="outline" onClick={() => void refetch()}>
            再試行
          </Button>
        </EmptyState>
      ) : contracts && contracts.length > 0 ? (
        <>
        <div className="space-y-3 md:hidden">
          {groupedContracts.map((group) => (
            <div key={`mobile-${group.key}`} className="rounded-2xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{group.companyName}</p>
                  <p className="text-xs text-muted-foreground">
                    {[group.factoryName, group.department, group.lineName].filter(Boolean).join(" / ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleCollapse(group.key)}
                  className="rounded-lg border border-border/60 px-2 py-1 text-xs text-muted-foreground"
                >
                  {collapsed.has(group.key) ? "展開" : "折りたたむ"}
                </button>
              </div>

              {!collapsed.has(group.key) && (
                <div className="space-y-3">
                  {group.contracts.map((c: Contract) => {
                    const isSelected = selected.has(c.id);
                    return (
                      <div
                        key={`mobile-contract-${c.id}`}
                        className={cn(
                          "rounded-xl border border-border/50 p-3",
                          isSelected && "border-primary/40 bg-primary/[0.04]",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <label className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleOne(c.id)}
                              aria-label={`${c.contractNumber}を選択`}
                              className="mt-0.5 h-4 w-4 rounded border-border/60 text-primary accent-primary"
                            />
                            <div className="min-w-0">
                              <Link
                                to="/contracts/$contractId"
                                params={{ contractId: String(c.id) }}
                                className="font-mono text-xs font-semibold text-primary hover:underline"
                              >
                                {c.contractNumber}
                              </Link>
                              <div className="mt-1">
                                <ContractStatusBadge status={c.status} />
                              </div>
                            </div>
                          </label>
                          <div className="flex gap-1.5">
                            <Link
                              to="/contracts/$contractId"
                              params={{ contractId: String(c.id) }}
                              aria-label="詳細を見る"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card transition-all hover:border-primary/40 hover:bg-primary/10"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            <Link
                              to="/contracts/$contractId"
                              params={{ contractId: String(c.id) }}
                              aria-label="PDF生成"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card transition-all hover:border-cyan-500/40 hover:bg-cyan-500/10"
                            >
                              <FileText className="h-4 w-4" />
                            </Link>
                          </div>
                        </div>

                        <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                          <p>{c.company?.name ?? "--"}</p>
                          <p>
                            {[c.factory?.factoryName, c.factory?.department, c.factory?.lineName]
                              .filter(Boolean)
                              .join(" / ") || "--"}
                          </p>
                          <div className="font-mono">
                            <ExpiryDateDisplay startDate={c.startDate} endDate={c.endDate} />
                          </div>
                          <EmployeeNames employees={c.employees} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3 }}
          className="hidden overflow-hidden rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)] md:block"
        >
          <div className="max-h-[calc(100vh-220px)] overflow-auto">
            <table className="w-full min-w-[700px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-card/95 backdrop-blur-sm shadow-[0_1px_0_var(--color-border)]">
                  <th scope="col" className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={allSelected ?? false}
                      onChange={toggleAll}
                      aria-label="全て選択"
                      className="h-4 w-4 rounded border-border/60 text-primary accent-primary cursor-pointer"
                    />
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground border-b border-border">
                    <button
                      onClick={() => table.getColumn("contractNumber")?.toggleSorting()}
                      className="inline-flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
                      aria-label="契約番号でソート"
                    >
                      契約番号
                      {table.getColumn("contractNumber")?.getIsSorted() === "asc"
                        ? <ArrowUp className="h-3 w-3 text-primary" />
                        : table.getColumn("contractNumber")?.getIsSorted() === "desc"
                        ? <ArrowDown className="h-3 w-3 text-primary" />
                        : <ArrowUpDown className="h-3 w-3 text-muted-foreground/30" />
                      }
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground border-b border-border">
                    <span className="flex items-center gap-1.5"><Building2 className="h-3 w-3" aria-hidden="true" />派遣先</span>
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground border-b border-border">
                    状態
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground border-b border-border">
                    <button
                      onClick={() => table.getColumn("endDate")?.toggleSorting()}
                      className="inline-flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
                      aria-label="契約期間でソート"
                    >
                      <Calendar className="h-3 w-3" aria-hidden="true" />契約期間
                      {table.getColumn("endDate")?.getIsSorted() === "asc"
                        ? <ArrowUp className="h-3 w-3 text-primary" />
                        : table.getColumn("endDate")?.getIsSorted() === "desc"
                        ? <ArrowDown className="h-3 w-3 text-primary" />
                        : <ArrowUpDown className="h-3 w-3 text-muted-foreground/30" />
                      }
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground border-b border-border">
                    操作
                  </th>
                </tr>
              </thead>
              <motion.tbody
                variants={tableBodyVariants}
                initial={shouldReduceMotion ? false : "hidden"}
                animate="visible"
              >
                {groupedContracts.map((group) => {
                  const isGroupCollapsed = collapsed.has(group.key);
                  const groupIds = group.contracts.map((c) => c.id);
                  const allGroupSelected = groupIds.length > 0 && groupIds.every((id) => selected.has(id));
                  const someGroupSelected = groupIds.some((id) => selected.has(id));

                  return (
                    <Fragment key={group.key}>
                      {/* ── Group header row ── */}
                      <motion.tr
                        key={`group-${group.key}`}
                        variants={tableRowVariants}
                        className="bg-muted/30 border-b border-border/80 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleCollapse(group.key)}
                      >

                        <td className="w-10 px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={allGroupSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someGroupSelected && !allGroupSelected;
                            }}
                            onChange={(e) => { e.stopPropagation(); toggleGroupSelect(group); }}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`${group.companyName}グループを選択`}
                            className="h-4 w-4 rounded border-border/60 text-primary accent-primary cursor-pointer"
                          />
                        </td>
                        <td colSpan={5} className="px-4 py-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <ChevronRight
                                className={cn(
                                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                                  !isGroupCollapsed && "rotate-90"
                                )}
                              />
                              <FolderOpen className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                              <span className="font-semibold text-sm text-foreground">
                                {group.companyName}
                              </span>
                              {(group.factoryName !== "--" || group.department || group.lineName) && (
                                <span className="text-xs text-muted-foreground/70 truncate max-w-[360px]">
                                  {group.factoryName}
                                  {group.department ? ` / ${group.department}` : ""}
                                  {group.lineName ? ` / ${group.lineName}` : ""}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground/70 tabular-nums">
                                {group.contracts.length}件 · {group.totalEmployees}名
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs gap-1.5 hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSetModalGroup(group);
                                }}
                              >
                                <Package className="h-3.5 w-3.5" aria-hidden="true" />
                                SET生成
                              </Button>
                            </div>
                          </div>
                        </td>
                      </motion.tr>

                      {/* ── Contract rows (hidden when collapsed) ── */}
                      {!isGroupCollapsed && group.contracts.map((c: Contract) => {
                        const isSelected = selected.has(c.id);
                        return (
                          <motion.tr
                            key={c.id}
                            variants={tableRowVariants}
                            className={cn(
                              "group border-b border-border/50 transition-colors hover:bg-primary/5",
                              isSelected ? "bg-primary/[0.06] dark:bg-primary/[0.08]" : ""
                            )}
                          >
                            <td className="w-10 px-3 py-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleOne(c.id)}
                                aria-label={`${c.contractNumber}を選択`}
                                className="h-4 w-4 rounded border-border/60 text-primary accent-primary cursor-pointer"
                              />
                            </td>
                            <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">
                              <Link
                                to="/contracts/$contractId" params={{ contractId: String(c.id) }}
                                className="transition-all hover:text-primary/70 hover:underline hover:underline-offset-2"
                              >
                                {c.contractNumber}
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-medium text-foreground/90 truncate max-w-[280px]">
                                  {c.company?.name ?? "--"}
                                </span>
                                {c.factory?.factoryName && (
                                  <span className="text-[10px] text-muted-foreground/50 truncate max-w-[280px]">
                                    {c.factory.factoryName} {c.factory.department || ""} {c.factory.lineName || ""}
                                  </span>
                                )}
                                <EmployeeNames employees={c.employees} />
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <ContractStatusBadge status={c.status} />
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground/70 tabular-nums font-mono">
                              <ExpiryDateDisplay startDate={c.startDate} endDate={c.endDate} />
                            </td>
                            <td className="px-4 py-3">
                              <TooltipProvider>
                                <div className="flex gap-1.5 opacity-80 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Link
                                        to="/contracts/$contractId"
                                        params={{ contractId: String(c.id) }}
                                        aria-label="詳細を見る"
                                        className="h-7 w-7 rounded-lg border border-border bg-card flex items-center justify-center transition-all hover:border-primary/40 hover:bg-primary/10"
                                      >
                                        <Eye className="h-4 w-4" aria-hidden="true" />
                                      </Link>
                                    </TooltipTrigger>
                                    <TooltipContent>詳細を見る</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Link
                                        to="/contracts/$contractId"
                                        params={{ contractId: String(c.id) }}
                                        aria-label="PDF生成"
                                        className="h-7 w-7 rounded-lg border border-border bg-card flex items-center justify-center transition-all hover:border-cyan-500/40 hover:bg-cyan-500/10"
                                      >
                                        <FileText className="h-4 w-4" aria-hidden="true" />
                                      </Link>
                                    </TooltipTrigger>
                                    <TooltipContent>PDF生成</TooltipContent>
                                  </Tooltip>
                                </div>
                              </TooltipProvider>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </motion.tbody>
            </table>
          </div>
        </motion.div>
        </>
      ) : (
        <EmptyState
          icon={FileText}
          title="契約がありません"
          description="「新規作成」から最初の契約を作成しましょう"
        >
          <Link to="/contracts/new">
            <Button>
              <Plus className="h-4 w-4" />
              新規作成
            </Button>
          </Link>
        </EmptyState>
      )}

      {/* ── Floating bulk action bar ── */}
      <div
        role="region"
        aria-live="polite"
        aria-label="一括操作"
      >
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              {...(shouldReduceMotion
                ? {}
                : {
                    initial: { opacity: 0, y: 40 },
                    animate: { opacity: 1, y: 0 },
                    exit: { opacity: 0, y: 40 },
                    transition: { type: "spring", stiffness: 400, damping: 30 },
                  })}
              className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
            >
              <div className="animate-in flex items-center gap-3 rounded-[var(--radius-lg)] border border-primary/30 bg-primary/10 px-4 py-2.5 backdrop-blur-xl shadow-2xl shadow-black/20">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">{selected.size}件選択中</span>
                </div>

                <div className="h-5 w-px bg-border/40" />

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                >
                  選択解除
                </Button>

                {showCancelled ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handlePurge}
                    disabled={purge.isPending}
                    className="inline-flex items-center gap-1.5"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {purge.isPending ? "削除中..." : "完全削除"}
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={bulkDelete.isPending}
                    className="inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {bulkDelete.isPending ? "取消中..." : "一括取消"}
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirmAction === "delete"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => bulkDelete.mutate([...selected])}
        title={`${selected.size}件の契約を取消しますか？`}
        description="選択した契約のステータスが「取消済み」に変更されます。後から完全削除することもできます。"
        confirmLabel="取消する"
        variant="destructive"
        isPending={bulkDelete.isPending}
      />
      <ConfirmDialog
        open={confirmAction === "purge"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => purge.mutate([...selected])}
        title={`${selected.size}件の契約を完全削除しますか？`}
        description="この操作は元に戻せません。契約データは永久に削除されます。"
        confirmLabel="完全削除"
        variant="destructive"
        isPending={purge.isPending}
      />
      {/* SET options modal */}
      <AnimatePresence>
        {setModalGroup && (
          <SetOptionsModal
            companyName={setModalGroup.companyName}
            factoryInfo={`${setModalGroup.factoryName} / ${setModalGroup.department} / ${setModalGroup.lineName}`}
            contractCount={setModalGroup.contracts.length}
            employeeCount={setModalGroup.totalEmployees}
            onGenerate={(options) => executeSetGeneration(setModalGroup, options)}
            onClose={() => setSetModalGroup(null)}
          />
        )}
      </AnimatePresence>
    </AnimatedPage>
  );
}


