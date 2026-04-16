import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { onMutationError, onMutationSuccess } from "@/lib/mutation-helpers";
import type { CompanyYearlyConfigCreate, CompanyYearlyConfigUpdate } from "@/lib/api-types";

export function useCompanyYearlyConfigs(companyId: number | null) {
  return useQuery({
    queryKey: queryKeys.companyYearlyConfig.byCompany(companyId ?? 0),
    queryFn: () => api.getCompanyYearlyConfigs(companyId!),
    enabled: companyId != null && companyId > 0,
  });
}

export function useCreateCompanyYearlyConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CompanyYearlyConfigCreate) => api.createCompanyYearlyConfig(data),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.companyYearlyConfig.byCompany(vars.companyId) });
      onMutationSuccess("企業年度設定を保存しました");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useUpdateCompanyYearlyConfig(companyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CompanyYearlyConfigUpdate }) =>
      api.updateCompanyYearlyConfig(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.companyYearlyConfig.byCompany(companyId) });
      onMutationSuccess("企業年度設定を更新しました");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useDeleteCompanyYearlyConfig(companyId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.deleteCompanyYearlyConfig(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.companyYearlyConfig.byCompany(companyId) });
      onMutationSuccess("企業年度設定を削除しました");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}
