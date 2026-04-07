/**
 * Admin CRUD mutation hooks.
 * Phase 2 of the Admin Database Panel.
 *
 * Provides create / update / delete mutations for any of the 8 valid tables
 * via the /api/admin/crud/:table/* endpoints.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { onMutationError, onMutationSuccess } from "@/lib/mutation-helpers";

export function useCreateRow(table: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<Record<string, unknown>>(`/admin/crud/${table}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.rows(table) });
      onMutationSuccess("Registro creado correctamente");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useUpdateRow(table: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api.put<Record<string, unknown>>(`/admin/crud/${table}/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.rows(table) });
      onMutationSuccess("Registro actualizado correctamente");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useDeleteRow(table: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete<{ deleted: boolean; id: number }>(`/admin/crud/${table}/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.rows(table) });
      onMutationSuccess("Registro eliminado correctamente");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}
