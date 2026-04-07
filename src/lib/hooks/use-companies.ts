// src/lib/hooks/use-companies.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { onMutationSuccess, onMutationError } from "@/lib/mutation-helpers";
import type { Company, CompanyCreate, CompanyUpdate } from "@/lib/api-types";

export function useCompanies(opts?: { includeInactive?: boolean }) {
  const params = opts?.includeInactive ? "?includeInactive=true" : "";
  return useQuery({
    queryKey: queryKeys.companies.all,
    queryFn: () => api.get<Company[]>(`/companies${params}`),
  });
}

export function useCompany(id: number | null) {
  return useQuery({
    queryKey: queryKeys.companies.detail(id!),
    queryFn: () => api.get<Company>(`/companies/${id}`),
    enabled: id !== null,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CompanyCreate) => api.post<Company>("/companies", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.companies.all });
      onMutationSuccess("企業を作成しました");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CompanyUpdate }) =>
      api.put<Company>(`/companies/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.companies.all });
      onMutationSuccess("企業を更新しました");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}
