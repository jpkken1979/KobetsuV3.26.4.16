/**
 * Admin Backup Hooks
 *
 * React Query hooks for backup management operations in the admin panel.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { onMutationError } from "@/lib/mutation-helpers";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────

export interface BackupEntry {
  filename: string;
  path: string;
  size: number;
  createdAt: string;
}

export interface BackupListResponse {
  backups: BackupEntry[];
}

export interface CreateBackupResponse {
  success: boolean;
  filename: string;
  message: string;
  backups: BackupEntry[];
}

export interface RestoreBackupResponse {
  success: boolean;
  message: string;
  preBackup: string;
  restoredFrom: string;
}

export interface DeleteBackupResponse {
  deleted: boolean;
  filename: string;
}

export interface ExportSqlResponse {
  sql: string;
  filename: string;
}

// ─── Query Key ───────────────────────────────────────────────────────

const backupKeys = {
  all: ["admin", "backups"] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────

/**
 * useAdminBackups — fetch the list of all .db files in data/
 *
 * GET /api/admin/backups
 */
export function useAdminBackups() {
  return useQuery({
    queryKey: backupKeys.all,
    queryFn: () => api.get<BackupListResponse>("/admin/backups"),
    staleTime: 30_000,
  });
}

/**
 * useCreateBackup — create a new manual backup
 *
 * POST /api/admin/backup
 */
export function useCreateBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<CreateBackupResponse>("/admin/backup", {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: backupKeys.all });
      toast.success("バックアップを作成しました", {
        description: data.filename,
      });
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

/**
 * useRestoreBackup — restore the database from a backup file
 *
 * POST /api/admin/restore
 *
 * NOTE: The active DB connection will not change until server restart.
 * The response includes a message instructing the user to restart.
 */
export function useRestoreBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filename: string) =>
      api.post<RestoreBackupResponse>("/admin/restore", { filename }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: backupKeys.all });
      toast.success(data.message, {
        description: `Restored from: ${data.restoredFrom}`,
      });
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

/**
 * useDeleteBackup — delete a backup file
 *
 * DELETE /api/admin/backup/:filename
 *
 * Only files matching kobetsu-*.db pattern can be deleted.
 */
export function useDeleteBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filename: string) =>
      api.delete<DeleteBackupResponse>(`/admin/backup/${encodeURIComponent(filename)}`),
    onSuccess: (_data, filename) => {
      queryClient.invalidateQueries({ queryKey: backupKeys.all });
      toast.success("バックアップを削除しました", {
        description: filename,
      });
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

/**
 * useExportSql — export the entire database as an SQL dump
 *
 * POST /api/admin/backup/export-sql
 *
 * Returns the SQL as a string for the client to trigger a download.
 */
export function useExportSql() {
  return useMutation({
    mutationFn: () => api.post<ExportSqlResponse>("/admin/backup/export-sql", {}),
    onSuccess: (data) => {
      // Trigger browser download of the SQL file
      const blob = new Blob([data.sql], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("SQLダンプをエクスポートしました", {
        description: data.filename,
      });
    },
    onError: (err: unknown) => onMutationError(err),
  });
}