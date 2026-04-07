/**
 * Backup Manager — Admin Panel Tab 6
 *
 * Lists .db files in data/, create/delete/restore backups,
 * and export the entire DB as a SQL dump.
 */

import { useState } from "react";
import { useAdminBackups, useCreateBackup, useRestoreBackup, useDeleteBackup, useExportSql } from "@/lib/hooks/use-admin-backup";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RefreshCw, Download, Trash2, Plus, Database, FileCode, Upload } from "lucide-react";
import { useReducedMotion } from "motion/react";

const PAGE_SIZE = 20;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BackupManager() {
  const prefersReduced = useReducedMotion();

  const { data, isLoading, refetch, isFetching } = useAdminBackups();
  const createBackup = useCreateBackup();
  const restoreBackup = useRestoreBackup();
  const deleteBackup = useDeleteBackup();
  const exportSql = useExportSql();

  const [page, setPage] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);

  const backups = data?.backups ?? [];
  const totalPages = Math.ceil(backups.length / PAGE_SIZE);
  const paginatedBackups = backups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleCreate = () => {
    createBackup.mutate(undefined, {
      onSuccess: () => setPage(0),
    });
  };

  const handleRestoreConfirm = () => {
    if (!restoreTarget) return;
    restoreBackup.mutate(restoreTarget, {
      onSuccess: () => setRestoreTarget(null),
    });
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteBackup.mutate(deleteTarget, {
      onSuccess: () => {
        setDeleteTarget(null);
        // Adjust page if last item on last page
        const newTotal = backups.length - 1;
        const newPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
        if (page >= newPages) setPage(newPages - 1);
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            Restore overwrites the current database
          </p>
          <p className="mt-1 text-xs text-amber-600/70 dark:text-amber-400/70">
            An automatic backup of the current state is created before every restore.
            The active connection does not change until you restart the server.
          </p>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={handleCreate}
          disabled={createBackup.isPending}
          size="sm"
          variant="default"
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {createBackup.isPending ? "作成中..." : "Nuevo backup"}
        </Button>

        <Button
          onClick={() => exportSql.mutate()}
          disabled={exportSql.isPending}
          size="sm"
          variant="outline"
        >
          <FileCode className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {exportSql.isPending ? "エクスポート中..." : "Exportar SQL"}
        </Button>

        <Button
          onClick={() => refetch()}
          disabled={isFetching}
          size="sm"
          variant="ghost"
        >
          <RefreshCw className={`mr-1.5 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" style={prefersReduced ? { animation: "none" } : undefined} />
          更新
        </Button>

        <div className="ml-auto text-sm text-muted-foreground">
          {backups.length} ファイル
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
        </div>
      ) : backups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Database className="mb-3 h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">バックアップファイルがありません</p>
          <p className="mt-1 text-xs text-muted-foreground/60">「Nuevo backup」をクリックして最初のバックアップを作成</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span>ファイル名</span>
            <span className="w-24 text-right">サイズ</span>
            <span className="w-44 text-right">作成日時</span>
            <span className="w-52 text-right">アクション</span>
          </div>

          {/* Rows */}
          <div className="rounded-lg border border-border overflow-hidden">
            {paginatedBackups.map((backup, index) => {
              const isActive = backup.filename === "kobetsu.db";
              return (
                <div
                  key={backup.filename}
                  className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3 text-sm ${
                    index < paginatedBackups.length - 1
                      ? "border-b border-border"
                      : ""
                  }`}
                >
                  {/* Filename */}
                  <div className="flex items-center gap-2 min-w-0">
                    {isActive ? (
                      <Badge variant="default" className="shrink-0 text-xs">
                        アクティブ
                      </Badge>
                    ) : null}
                    <span className="truncate font-mono text-xs" title={backup.filename}>
                      {backup.filename}
                    </span>
                  </div>

                  {/* Size */}
                  <span className="w-24 text-right text-muted-foreground text-xs tabular-nums">
                    {formatBytes(backup.size)}
                  </span>

                  {/* Date */}
                  <span className="w-44 text-right text-muted-foreground text-xs tabular-nums">
                    {formatDate(backup.createdAt)}
                  </span>

                  {/* Actions */}
                  <div className="w-52 flex items-center justify-end gap-1.5">
                    {/* Download */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      title="Download backup file"
                      onClick={() => {
                        const url = `/api/admin/backups/download?filename=${encodeURIComponent(backup.filename)}`;
                        window.open(url, "_blank");
                      }}
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </Button>

                    {/* Restore */}
                    {!isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        title="Restore from this backup"
                        onClick={() => setRestoreTarget(backup.filename)}
                      >
                        <Upload className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}

                    {/* Delete */}
                    {!isActive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-destructive hover:text-destructive"
                        title="Delete backup file"
                        onClick={() => setDeleteTarget(backup.filename)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                ←
              </Button>
              <span className="text-xs text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                →
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Restore confirmation */}
      <ConfirmDialog
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleRestoreConfirm}
        title="バックアップからリストア"
        description={`選択したバックアップで現在のデータベースを上書きします。操作前に自動バックアップが作成されます。\n\n対象: ${restoreTarget ?? ""}`}
        confirmLabel="リストアする"
        variant="destructive"
        isPending={restoreBackup.isPending}
        extraContent={
          <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
            サーバー再起動が必要です。リストア後、APIサーバーを再起動してください。
          </div>
        }
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="バックアップを削除"
        description={`このバックアップファイルは完全に削除されます。取り消せません。\n\n対象: ${deleteTarget ?? ""}`}
        confirmLabel="削除する"
        variant="destructive"
        isPending={deleteBackup.isPending}
      />
    </div>
  );
}