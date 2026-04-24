// src/lib/hooks/use-employees.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { onMutationSuccess, onMutationError } from "@/lib/mutation-helpers";
import type {
  Employee,
  EmployeeCreate,
  EmployeeUpdate,
  EmployeeFilterParams,
  CompletenessRow,
  ImportResult,
} from "@/lib/api-types";

export function useEmployees(params?: EmployeeFilterParams) {
  const qs = new URLSearchParams();
  if (params?.companyId) qs.set("companyId", String(params.companyId));
  if (params?.factoryId) qs.set("factoryId", String(params.factoryId));
  if (params?.search) qs.set("search", params.search);
  if (params?.status) qs.set("status", params.status);
  const query = qs.toString() ? `?${qs.toString()}` : "";
  return useQuery({
    queryKey: queryKeys.employees.all(params),
    queryFn: () => api.get<Employee[]>(`/employees${query}`),
  });
}

export function useEmployeesByFactory(factoryId: number | null) {
  return useQuery({
    queryKey: queryKeys.employees.byFactory(factoryId ?? -1),
    queryFn: () => api.getEmployees({ factoryId: factoryId ?? undefined }),
    enabled: factoryId !== null && factoryId > 0,
    select: (employees: Employee[]) =>
      employees
        .map((e) => ({
          ...e,
          displayRate: e.billingRate ?? e.hourlyRate,
        }))
        .sort((a, b) => (a.fullName ?? "").localeCompare(b.fullName ?? "")),
  });
}

export function useEmployee(id: number | null) {
  return useQuery({
    queryKey: queryKeys.employees.detail(id!),
    queryFn: () => api.get<Employee>(`/employees/${id}`),
    enabled: id !== null,
  });
}

export function useEmployeeCompleteness() {
  return useQuery({
    queryKey: queryKeys.employees.completeness,
    queryFn: () => api.get<CompletenessRow[]>("/employees/completeness"),
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EmployeeCreate) => api.post<Employee>("/employees", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.employees.invalidateAll });
      onMutationSuccess("社員を作成しました");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: EmployeeUpdate }) =>
      api.put<Employee>(`/employees/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.employees.invalidateAll });
      onMutationSuccess("社員を更新しました");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useImportEmployees() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows: Record<string, unknown>[]) =>
      api.post<ImportResult>("/import/employees", { rows }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.employees.invalidateAll });
      onMutationSuccess(`インポート完了: ${data.summary.inserted}件`);
    },
    onError: (err: unknown) => onMutationError(err),
  });
}
