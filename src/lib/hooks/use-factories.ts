import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Factory, type FactoryGroupRoles, type RoleKey, type RoleValue } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { onMutationError, onMutationSuccess } from "@/lib/mutation-helpers";

export function useFactories(companyId?: number) {
  return useQuery({
    queryKey: queryKeys.factories.all({ companyId }),
    queryFn: () => api.getFactories(companyId),
  });
}

export function useFactory(id: number) {
  return useQuery({
    queryKey: queryKeys.factories.detail(id),
    queryFn: () => api.getFactory(id),
    enabled: id > 0,
  });
}

export function useFactoryCascade(companyId: number) {
  return useQuery({
    queryKey: queryKeys.factories.cascade(companyId),
    queryFn: () => api.getFactoryCascade(companyId),
    enabled: companyId > 0,
  });
}

export function useFactoryBadges(companyId: number | null) {
  return useQuery({
    queryKey: queryKeys.factories.badges(companyId!),
    queryFn: () => api.get<FactoryBadgeStatus[]>(`/factories/badges/${companyId}`),
    enabled: companyId !== null,
  });
}

export type FactoryBadgeStatus = { factoryId: number; dataComplete: "ok" | "warning" | "error"; hasCalendar: boolean; employeeCount: number };

export function useCreateFactory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Factory>) => api.createFactory(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.factories.invalidateAll });
      qc.invalidateQueries({ queryKey: queryKeys.companies.all });
      onMutationSuccess("工場を登録しました");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useUpdateFactory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Factory> }) => api.updateFactory(id, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.factories.invalidateAll });
      qc.invalidateQueries({ queryKey: queryKeys.companies.all });
      qc.invalidateQueries({ queryKey: queryKeys.dataCheck.invalidateAll });
      const companyId = (variables.data as { companyId?: number }).companyId;
      if (typeof companyId === "number") {
        qc.invalidateQueries({ queryKey: queryKeys.factories.roleSummary(companyId) });
      }
      onMutationSuccess("工場を更新しました");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useDeleteFactory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteFactory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.factories.invalidateAll });
      qc.invalidateQueries({ queryKey: queryKeys.companies.all });
      onMutationSuccess("工場を削除しました");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useFactoryRoles(companyId: number | null) {
  return useQuery<FactoryGroupRoles[]>({
    queryKey: queryKeys.factories.roleSummary(companyId!),
    queryFn: () => api.getFactoryRoleSummary(companyId!),
    enabled: !!companyId,
  });
}

export function useBulkUpdateRoles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      companyId: number; factoryName: string; roleKey: RoleKey;
      value: RoleValue; excludeLineIds?: number[];
    }) => api.bulkUpdateFactoryRoles(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.factories.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.factories.roleSummary(variables.companyId) });
      onMutationSuccess("担当者を一括更新しました");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}
