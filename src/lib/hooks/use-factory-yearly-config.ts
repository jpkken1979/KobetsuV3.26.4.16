import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { onMutationError, onMutationSuccess } from "@/lib/mutation-helpers";
import type { FactoryYearlyConfigCreate, FactoryYearlyConfigUpdate } from "@/lib/api-types";

export function useFactoryYearlyConfigs(factoryId: number | null) {
  return useQuery({
    queryKey: queryKeys.factoryYearlyConfig.byFactory(factoryId ?? 0),
    queryFn: () => api.getFactoryYearlyConfigs(factoryId!),
    enabled: factoryId != null && factoryId > 0,
  });
}

export function useCreateFactoryYearlyConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FactoryYearlyConfigCreate) => api.createFactoryYearlyConfig(data),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.factoryYearlyConfig.byFactory(vars.factoryId) });
      onMutationSuccess("年度設定を保存しました");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useUpdateFactoryYearlyConfig(factoryId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: FactoryYearlyConfigUpdate }) =>
      api.updateFactoryYearlyConfig(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.factoryYearlyConfig.byFactory(factoryId) });
      onMutationSuccess("年度設定を更新しました");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useDeleteFactoryYearlyConfig(factoryId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteFactoryYearlyConfig(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.factoryYearlyConfig.byFactory(factoryId) });
      onMutationSuccess("年度設定を削除しました");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useCopyFactoryYearlyConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { sourceFactoryId: number; fiscalYear: number; targetFactoryIds: number[] }) =>
      api.copyFactoryYearlyConfig(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["factory-yearly-config"] });
      onMutationSuccess(
        `${res.copied}件コピー完了${res.skipped > 0 ? `（${res.skipped}件スキップ）` : ""}`
      );
    },
    onError: (err: unknown) => onMutationError(err),
  });
}
