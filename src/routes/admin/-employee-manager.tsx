/**
 * Employee Manager — Admin Tab 5.
 * Specialized employee management view with filters, TanStack Table,
 * bulk actions, per-row edit/delete, and Excel export.
 */

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  AlertTriangle,
  CheckSquare,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Edit3,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { addDays, isBefore, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { CrudDialog } from "./-crud-dialog";
import { api } from "@/lib/api";
import type { Employee, Company } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { createExcelWorkbook } from "@/lib/excel/workbook-loader";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useEmployees } from "@/lib/hooks/use-employees";
import { onMutationError } from "@/lib/mutation-helpers";
import { useAdminColumns } from "@/lib/hooks/use-admin-columns";

/* ── Constants ─────────────────────────────────────────────────────────── */
const PAGE_SIZES = [10, 25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];

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
interface EmployeeRow {
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
            {/* Edit */}
            <button
              onClick={() => onEdit(r)}
              aria-label="編集"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card transition-all hover:border-primary/40 hover:bg-primary/10"
            >
              <Edit3 className="h-4 w-4" />
            </button>
            {/* Delete */}
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

/* ── Excel export ─────────────────────────────────────────────────────── */
async function exportEmployeesToExcel(rows: EmployeeRow[]): Promise<void> {
  const workbook = await createExcelWorkbook();
  workbook.creator = "JP個別契約書 v26.3.31";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("社員一覧", {
    views: [{ state: "frozen", xSplit: 3 }],
  });

  // Header row
  const headers = [
    "社員番号",
    "氏名",
    "カタカナ",
    "国籍",
    "派遣先",
    "工場・ライン",
    "時給",
    "単価",
    "状態",
    "VISA期限",
    "生年月日",
    "入社日",
  ];

  // Add header row with styling
  const headerRow = worksheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF059669" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Header styling
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF059669" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Data rows
  for (const row of rows) {
    const r = row._raw;
    const visaDate = r.visaExpiry ? parseISO(r.visaExpiry) : null;
    const now = new Date();
    const isExpired = visaDate && isBefore(visaDate, now);
    const isExpiring =
      visaDate && !isBefore(visaDate, now) && isBefore(visaDate, addDays(now, 30));

    worksheet.addRow([
      r.employeeNumber,
      r.fullName,
      r.katakanaName ?? "",
      r.nationality ?? "",
      row.companyName,
      row.factoryName,
      r.hourlyRate ?? "",
      r.billingRate ?? "",
      r.status === "active" ? "有効" : r.status === "inactive" ? "無効" : r.status,
      r.visaExpiry ?? "",
      r.birthDate ?? "",
      r.hireDate ?? "",
    ]);

    const rowNum = worksheet.rowCount;
    const dataRow = worksheet.getRow(rowNum);
    dataRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = { vertical: "middle" };
    });

    // Highlight expired/expiring visa rows
    if (isExpired) {
      dataRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
      });
    } else if (isExpiring) {
      dataRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF9C3" } };
      });
    }
  }

  // Column widths
  const colWidths = [14, 18, 18, 10, 20, 20, 10, 10, 8, 14, 14, 14];
  colWidths.forEach((w, i) => {
    worksheet.getColumn(i + 1).width = w;
  });

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `empleados_${dateStr}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Bulk edit dialog ─────────────────────────────────────────────────── */
interface BulkEditDialogProps {
  selectedCount: number;
  companies: Company[];
  onClose: () => void;
  onConfirm: (status: string | null, factoryId: number | null) => void;
}

function BulkEditDialog({
  selectedCount,
  companies,
  onClose,
  onConfirm,
}: BulkEditDialogProps) {
  const [newStatus, setNewStatus] = useState<string>("");
  const [newFactoryId, setNewFactoryId] = useState<string>("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const status = newStatus || null;
    const factoryId = newFactoryId ? Number(newFactoryId) : null;
    onConfirm(status, factoryId);
    onClose();
  }

  return (
    <Dialog open onClose={onClose} className="max-w-md">
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <div className="flex-1">
            <DialogTitle>一括編集 — {selectedCount}件</DialogTitle>
          </div>
          <DialogClose onClose={onClose} />
        </DialogHeader>

        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bulk-status" className="text-sm font-medium">
              状態を変更
            </label>
            <Select
              id="bulk-status"
              className="w-full"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
            >
              <option value="">変更しない</option>
              <option value="active">有効</option>
              <option value="inactive">無効</option>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="bulk-factory" className="text-sm font-medium">
              配属先を変更
            </label>
            <Select
              id="bulk-factory"
              className="w-full"
              value={newFactoryId}
              onChange={(e) => setNewFactoryId(e.target.value)}
            >
              <option value="">変更しない</option>
              {companies.map((c) => (
                <optgroup key={c.id} label={c.name}>
                  {c.factories?.map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      {f.factoryName}
                      {f.department ? ` / ${f.department}` : ""}
                      {f.lineName ? ` / ${f.lineName}` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" variant="default">
            一括更新
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/* ── Main component ──────────────────────────────────────────────────── */
export function EmployeeManager() {
  const shouldReduceMotion = useReducedMotion();
  const qc = useQueryClient();

  /* ── Filters ─────────────────────────────────────────────────────── */
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [nationalitySearch, setNationalitySearch] = useState("");
  const [visaFilter, setVisaFilter] = useState<string>("all");
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);

  /* ── Row selection ───────────────────────────────────────────────── */
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmAction, setConfirmAction] = useState<
    | { type: "delete"; row: EmployeeRow }
    | { type: "bulk-delete" }
    | null
  >(null);

  /* ── Edit dialog state ───────────────────────────────────────────── */
  const [editRow, setEditRow] = useState<EmployeeRow | null>(null);
  const [crudMode, setCrudMode] = useState<"create" | "edit" | "delete">("edit");
  const [showBulkEdit, setShowBulkEdit] = useState(false);

  /* ── Queries ─────────────────────────────────────────────────────── */
  const { data: allEmployees, isLoading, isFetching } = useEmployees();
  const { data: companies } = useCompanies({ includeInactive: true });

  /* ── Admin columns for employee table ───────────────────────────── */
  const { data: employeeColumns = [] } = useAdminColumns("employees");

  /* ── Handlers ───────────────────────────────────────────────────── */
  const handleDelete = useCallback(
    (row: EmployeeRow) => {
      setConfirmAction({ type: "delete", row });
    },
    [],
  );

  const handleEdit = useCallback((row: EmployeeRow) => {
    setEditRow(row);
    setCrudMode("edit");
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    setConfirmAction({ type: "bulk-delete" });
  }, [selectedIds]);

  async function confirmAndExecute() {
    if (!confirmAction) return;
    if (confirmAction.type === "delete") {
      try {
        await api.delete<{ deleted: boolean }>(`/admin/crud/employees/${confirmAction.row.id}`);
        qc.invalidateQueries({ queryKey: queryKeys.employees.all() });
        toast.success("社員を削除しました");
      } catch (err: unknown) {
        onMutationError(err);
      }
      setConfirmAction(null);
    } else if (confirmAction.type === "bulk-delete") {
      const ids = [...selectedIds];
      let deleted = 0;
      for (const id of ids) {
        try {
          await api.delete<{ deleted: boolean }>(`/admin/crud/employees/${id}`);
          deleted++;
        } catch {
          /* skip individual failures */
        }
      }
      toast.success(`${deleted}/${ids.length}件を削除しました`);
      qc.invalidateQueries({ queryKey: queryKeys.employees.all() });
      setSelectedIds(new Set());
      setConfirmAction(null);
    }
  }

  /* ── Bulk edit handler ───────────────────────────────────────────── */
  function handleBulkEditConfirm(newStatus: string | null, newFactoryId: number | null) {
    const ids = [...selectedIds];
    let updated = 0;
    for (const id of ids) {
      const updates: Record<string, unknown> = {};
      if (newStatus) updates.status = newStatus;
      if (newFactoryId) updates.factoryId = newFactoryId;
      if (Object.keys(updates).length === 0) continue;
      api.put<{ updated: boolean }>(`/admin/crud/employees/${id}`, updates)
        .then(() => updated++)
        .catch(() => {
          /* skip individual failures */
        });
    }
    toast.success(`${updated}/${ids.length}件を更新しました`);
    qc.invalidateQueries({ queryKey: queryKeys.employees.all() });
    setSelectedIds(new Set());
  }

  /* ── Filter + map raw employees → table rows ─────────────────────── */
  const rows: EmployeeRow[] = useMemo(() => {
    if (!allEmployees) return [];
    return allEmployees
      .filter((e: Employee) => {
        // Status filter
        if (statusFilter !== "all" && e.status !== statusFilter) return false;

        // Company filter — match by companyId or companyName
        if (companyFilter !== "all") {
          const companyId = Number(companyFilter);
          if (e.companyId !== companyId) return false;
        }

        // Nationality text search
        if (nationalitySearch) {
          const q = nationalitySearch.toLowerCase();
          if (!(e.nationality ?? "").toLowerCase().includes(q)) return false;
        }

        // Visa expiry filter
        if (visaFilter !== "all") {
          if (!e.visaExpiry) return visaFilter === "valid"; // no visa = "none" case
          const expiry = parseISO(e.visaExpiry);
          const now = new Date();
          const thirtyDays = addDays(now, 30);
          if (visaFilter === "expired" && !isBefore(expiry, now)) return false;
          if (visaFilter === "expiring" && (isBefore(expiry, now) || !isBefore(expiry, thirtyDays)))
            return false;
          if (visaFilter === "valid" && isBefore(expiry, now)) return false;
        }

        return true;
      })
      .map((e: Employee): EmployeeRow => ({
        id: e.id,
        employeeNumber: e.employeeNumber,
        fullName: e.fullName,
        nationality: e.nationality,
        companyName: e.company?.name ?? "—",
        factoryName: e.factory
          ? [e.factory.factoryName, e.factory.department, e.factory.lineName]
              .filter(Boolean)
              .join(" / ")
          : "—",
        hourlyRate: e.hourlyRate,
        billingRate: e.billingRate,
        status: e.status,
        visaExpiry: e.visaExpiry,
        _raw: e,
      }));
  }, [allEmployees, statusFilter, companyFilter, nationalitySearch, visaFilter]);

  /* ── TanStack Table ───────────────────────────────────────────────── */
  const columns = useMemo(
    () =>
      buildColumns(
        (r) => handleEdit(r),
        (r) => handleDelete(r),
      ),
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      globalFilter,
      pagination: { pageIndex: page - 1, pageSize },
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function"
          ? updater({ pageIndex: page - 1, pageSize })
          : updater;
      setPage(next.pageIndex + 1);
      setPageSize(next.pageSize as PageSize);
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

  /* ── Computed ─────────────────────────────────────────────────────── */
  const pageCount = table.getPageCount();

  function handleSelectAll() {
    if (selectedIds.size === rows.length && rows.length > 0) {
      table.resetRowSelection();
      setSelectedIds(new Set());
    } else {
      table.setRowSelection(Object.fromEntries(rows.map((r) => [r.id, true])));
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  }

  function handleRowSelect(row: EmployeeRow, checked: boolean) {
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

  function handlePageSizeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = Number(e.target.value) as PageSize;
    setPageSize(next);
    setPage(1);
    table.setPageSize(next);
  }

  function handleExportExcel() {
    if (rows.length === 0) {
      toast.warning("エクスポートするデータがありません");
      return;
    }
    void exportEmployeesToExcel(rows);
    toast.success(`${rows.length}件をExcelにエクスポートしました`);
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

        {/* Company */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            派遣先
          </label>
          <Select
            className="h-8 w-44"
            value={companyFilter}
            onChange={(e) => {
              setCompanyFilter(e.target.value);
              setPage(1);
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

        {/* Nationality */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            国籍
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="h-8 w-32 pl-8 text-sm"
              placeholder="国籍で検索..."
              value={nationalitySearch}
              onChange={(e) => {
                setNationalitySearch(e.target.value);
                setPage(1);
              }}
              aria-label="国籍で検索"
            />
          </div>
        </div>

        {/* Visa expiry */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            VISA期限
          </label>
          <Select
            className="h-8 w-44"
            value={visaFilter}
            onChange={(e) => {
              setVisaFilter(e.target.value);
              setPage(1);
            }}
          >
            {VISA_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
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
              placeholder="社員番号 · 氏名 · 国籍で検索..."
              value={globalFilter}
              onChange={(e) => {
                setGlobalFilter(e.target.value);
                setPage(1);
              }}
              aria-label="社員一覧を検索"
            />
          </div>
        </div>

        {/* Excel export */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 self-end"
          onClick={handleExportExcel}
          aria-label="Excelにエクスポート"
        >
          <Download className="h-3.5 w-3.5" />
          Excel
        </Button>

        {/* Result count */}
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
                    onChange={handleSelectAll}
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
                        onChange={(e) => handleRowSelect(row.original, e.target.checked)}
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
                  setPage(1);
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
                  setPage(page - 1);
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
                  setPage(page + 1);
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
                  setPage(pageCount);
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
                  table.resetRowSelection();
                }}
              >
                <X className="h-3.5 w-3.5" />
                選択解除
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => setShowBulkEdit(true)}
              >
                <Edit3 className="h-3.5 w-3.5" />
                一括編集
              </Button>

              <Button
                variant="destructive"
                size="sm"
                className="h-8 gap-1.5"
                onClick={handleBulkDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
                一括削除
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bulk edit dialog ─────────────────────────────────────────── */}
      {showBulkEdit && companies && (
        <BulkEditDialog
          selectedCount={selectedIds.size}
          companies={companies}
          onClose={() => setShowBulkEdit(false)}
          onConfirm={handleBulkEditConfirm}
        />
      )}

      {/* ── Edit dialog ─────────────────────────────────────────────── */}
      {editRow && employeeColumns.length > 0 && (
        <CrudDialog
          mode={crudMode}
          table="employees"
          columns={employeeColumns}
          row={editRow._raw as unknown as Record<string, unknown>}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: queryKeys.employees.all() });
          }}
          onClose={() => {
            setEditRow(null);
            setCrudMode("edit");
          }}
        />
      )}

      {/* ── Confirm dialogs ─────────────────────────────────────────── */}
      {confirmAction?.type === "delete" && (
        <ConfirmDialog
          open
          onClose={() => setConfirmAction(null)}
          onConfirm={confirmAndExecute}
          title={`社員 ${confirmAction.row.fullName} を削除しますか？`}
          description="この操作は取り消せません。社員データが完全に削除されます。"
          confirmLabel="削除"
          variant="destructive"
        />
      )}
      {confirmAction?.type === "bulk-delete" && (
        <ConfirmDialog
          open
          onClose={() => setConfirmAction(null)}
          onConfirm={confirmAndExecute}
          title={`${selectedIds.size}件の社員を削除しますか？`}
          description="この操作は取り消せません。選択した社員が完全に削除されます。"
          confirmLabel="削除"
          variant="destructive"
        />
      )}
    </div>
  );
}
