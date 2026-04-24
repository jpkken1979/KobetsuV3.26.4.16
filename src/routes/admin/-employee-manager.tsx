/**
 * Employee Manager — Admin Tab 5 Orchestrator.
 * Manages state, queries, and delegates UI to sub-components.
 */

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addDays, isBefore, parseISO } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CheckSquare,
  Edit3,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CrudDialog } from "./-crud-dialog";
import { EmployeeTable, type EmployeeRow, type PageSize } from "./-employee-table";
import { BulkEditDialog } from "./-employee-form";
import { api } from "@/lib/api";
import type { Employee } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { createExcelWorkbook } from "@/lib/excel/workbook-loader";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useEmployees } from "@/lib/hooks/use-employees";
import { onMutationError } from "@/lib/mutation-helpers";
import { useAdminColumns } from "@/lib/hooks/use-admin-columns";

/* ── Excel export ─────────────────────────────────────────────────── */
async function exportEmployeesToExcel(rows: EmployeeRow[]): Promise<void> {
  const workbook = await createExcelWorkbook();
  workbook.creator = "JP個別契約書 v26.3.31";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("社員一覧", {
    views: [{ state: "frozen", xSplit: 3 }],
  });

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

  const colWidths = [14, 18, 18, 10, 20, 20, 10, 10, 8, 14, 14, 14];
  colWidths.forEach((w, i) => {
    worksheet.getColumn(i + 1).width = w;
  });

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

/* ── Main component ──────────────────────────────────────────────── */
export function EmployeeManager() {
  const shouldReduceMotion = useReducedMotion();
  const qc = useQueryClient();

  /* ── Filter state ────────────────────────────────────────────────── */
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [nationalitySearch, setNationalitySearch] = useState("");
  const [visaFilter, setVisaFilter] = useState<string>("all");
  const [globalFilter, setGlobalFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);

  /* ── Selection & action state ─────────────────────────────────── */
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmAction, setConfirmAction] = useState<
    | { type: "delete"; row: EmployeeRow }
    | { type: "bulk-delete" }
    | null
  >(null);
  const [editRow, setEditRow] = useState<EmployeeRow | null>(null);
  const [crudMode, setCrudMode] = useState<"create" | "edit" | "delete">("edit");
  const [showBulkEdit, setShowBulkEdit] = useState(false);

  /* ── Queries ─────────────────────────────────────────────────────── */
  const { data: allEmployees, isLoading, isFetching } = useEmployees();
  const { data: companies } = useCompanies({ includeInactive: true });
  const { data: employeeColumns = [] } = useAdminColumns("employees");

  /* ── Handlers: edit/delete ─────────────────────────────────────── */
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

  /* ── Confirm & execute deletion ──────────────────────────────────── */
  async function confirmAndExecute() {
    if (!confirmAction) return;
    if (confirmAction.type === "delete") {
      try {
        await api.delete<{ deleted: boolean }>(`/admin/crud/employees/${confirmAction.row.id}`);
        qc.invalidateQueries({ queryKey: queryKeys.employees.invalidateAll });
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
        qc.invalidateQueries({ queryKey: queryKeys.employees.invalidateAll });
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
        qc.invalidateQueries({ queryKey: queryKeys.employees.invalidateAll });
    setSelectedIds(new Set());
  }

  /* ── Filter & map employees → table rows ──────────────────────── */
  const rows: EmployeeRow[] = useMemo(() => {
    if (!allEmployees) return [];
    return allEmployees
      .filter((e: Employee) => {
        if (statusFilter !== "all" && e.status !== statusFilter) return false;
        if (companyFilter !== "all") {
          const companyId = Number(companyFilter);
          if (e.companyId !== companyId) return false;
        }
        if (nationalitySearch) {
          const q = nationalitySearch.toLowerCase();
          if (!(e.nationality ?? "").toLowerCase().includes(q)) return false;
        }
        if (visaFilter !== "all") {
          if (!e.visaExpiry) return visaFilter === "valid";
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

  /* ── Selection handlers ──────────────────────────────────────────── */
  function handleSelectAll() {
    if (selectedIds.size === rows.length && rows.length > 0) {
      setSelectedIds(new Set());
    } else {
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

  /* ── Export handler ──────────────────────────────────────────────── */
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
      {/* ── Table component ─────────────────────────────────────────── */}
      <EmployeeTable
        rows={rows}
        isLoading={isLoading}
        isFetching={isFetching}
        onEdit={handleEdit}
        onDelete={handleDelete}
        selectedIds={selectedIds}
        onSelectRow={handleRowSelect}
        onSelectAll={handleSelectAll}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        companyFilter={companyFilter}
        onCompanyFilterChange={setCompanyFilter}
        nationalitySearch={nationalitySearch}
        onNationalitySearchChange={setNationalitySearch}
        visaFilter={visaFilter}
        onVisaFilterChange={setVisaFilter}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        onExportExcel={handleExportExcel}
        companies={companies}
        page={page}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
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
      qc.invalidateQueries({ queryKey: queryKeys.employees.invalidateAll });
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
