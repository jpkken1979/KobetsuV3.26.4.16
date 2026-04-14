import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";
import { Trash2, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// Tables allowed for CRUD (excludes client_companies, factories, audit_log — protected)
const ALLOWED_TABLES = [
  "employees",
  "contracts",
  "shift_templates",
  "factory_calendars",
] as const;

type AllowedTable = (typeof ALLOWED_TABLES)[number];

interface TableColumn {
  name: string;
  type: string;
}

interface TableMeta {
  name: string;
  columns: TableColumn[];
}

export function AdminCrudTab() {
  const queryClient = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<AllowedTable>("employees");
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [showInsertForm, setShowInsertForm] = useState(false);
  const [insertData, setInsertData] = useState<Record<string, string>>({});

  // Fetch table metadata (column names/types)
  const { data: tableMeta } = useQuery({
    queryKey: queryKeys.admin.tables,
    queryFn: () => api.getAdminTables(),
    staleTime: 60_000,
  });

  // Fetch last 20 rows for selected table
  const { data: rows, isLoading, refetch } = useQuery({
    queryKey: [...queryKeys.admin.rows(selectedTable), { limit: 20 }],
    queryFn: () => api.getAdminRows(selectedTable, { pageSize: 20, page: 1 }),
    staleTime: 10_000,
  });

  const currentMeta = (tableMeta as TableMeta[] | undefined)?.find(
    (t) => t.name === selectedTable,
  );
  // Editable columns: exclude id, createdAt, updatedAt
  const editableColumns = (currentMeta?.columns ?? []).filter(
    (col) => col.name !== "id" && col.name !== "createdAt" && col.name !== "updatedAt",
  );

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.adminDelete(selectedTable, id),
    onSuccess: () => {
      toast.success("削除しました");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.rows(selectedTable) });
    },
    onError: () => toast.error("削除に失敗しました"),
  });

  const insertMutation = useMutation({
    mutationFn: (data: Record<string, string>) => api.adminInsert(selectedTable, data),
    onSuccess: () => {
      toast.success("追加しました");
      setShowInsertForm(false);
      setInsertData({});
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.rows(selectedTable) });
    },
    onError: () => toast.error("追加に失敗しました"),
  });

  // Rows are in AdminRowResult.rows
  const rowData = (rows as { rows?: Record<string, unknown>[] } | undefined)?.rows ?? [];
  const displayColumns = (currentMeta?.columns ?? [])
    .filter((c) => c.name !== "id");

  return (
    <div className="space-y-4">
      {/* Table selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {ALLOWED_TABLES.map((table) => (
            <button
              key={table}
              type="button"
              onClick={() => {
                setSelectedTable(table);
                setShowInsertForm(false);
                setInsertData({});
              }}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                selectedTable === table
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {table}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => void refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" onClick={() => setShowInsertForm(!showInsertForm)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Insert
        </Button>
      </div>

      {/* Insert form */}
      {showInsertForm && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            New row — {selectedTable}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {editableColumns.map((col) => (
              <div key={col.name}>
                <label className="text-xs text-muted-foreground mb-1 block">{col.name}</label>
                <input
                  className="w-full rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs focus:border-primary/50 focus:outline-none"
                  placeholder={col.type}
                  value={insertData[col.name] ?? ""}
                  onChange={(e) =>
                    setInsertData((prev) => ({ ...prev, [col.name]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowInsertForm(false);
                setInsertData({});
              }}
            >
              キャンセル
            </Button>
            <Button
              size="sm"
              onClick={() => insertMutation.mutate(insertData)}
              disabled={insertMutation.isPending}
            >
              {insertMutation.isPending ? "追加中..." : "追加"}
            </Button>
          </div>
        </div>
      )}

      {/* Rows table */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/30 border-b border-border/60">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">id</th>
                {displayColumns.map((col) => (
                  <th
                    key={col.name}
                    className="px-3 py-2 text-left font-medium text-muted-foreground"
                  >
                    {col.name}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rowData.map((row) => (
                <tr
                  key={String(row.id)}
                  className="border-b border-border/40 hover:bg-muted/20"
                >
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    {String(row.id)}
                  </td>
                  {displayColumns.map((col) => (
                    <td key={col.name} className="px-3 py-2 truncate max-w-[140px]">
                      {String(row[col.name] ?? "")}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(Number(row.id))}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
              {rowData.length === 0 && (
                <tr>
                  <td
                    colSpan={displayColumns.length + 2}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="行を削除"
        description={`ID ${String(deleteTarget)} のレコードを削除します。この操作は取り消せません。`}
        confirmLabel="削除"
        variant="destructive"
        onConfirm={() => {
          if (deleteTarget !== null) deleteMutation.mutate(deleteTarget);
        }}
      />
    </div>
  );
}
