import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { onMutationError, onMutationSuccess } from "@/lib/mutation-helpers";

export function useShiftTemplates() {
  return useQuery({
    queryKey: queryKeys.shiftTemplates.all,
    queryFn: () => api.getShiftTemplates(),
  });
}

export function useCreateShiftTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; workHours: string; breakTime: string }) =>
      api.createShiftTemplate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.shiftTemplates.all });
      onMutationSuccess("テンプレートを保存しました");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useDeleteShiftTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteShiftTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.shiftTemplates.all });
      onMutationSuccess("テンプレートを削除しました");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}
