import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Contract, BatchCreateResult, BatchDocumentResult, ByLineBatchResult } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { onMutationError } from "@/lib/mutation-helpers";
import { toast } from "sonner";

export function useContracts(params?: { companyId?: number; status?: string }) {
  return useQuery({
    queryKey: queryKeys.contracts.all(params),
    queryFn: () => api.getContracts(params),
  });
}

export function useContract(id: number) {
  return useQuery({
    queryKey: queryKeys.contracts.detail(id),
    queryFn: () => api.getContract(id),
    enabled: id > 0,
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ __silent, ...payload }: Record<string, unknown> & { __silent?: boolean }) => api.createContract(payload),
    onSuccess: (data: Contract, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.invalidateAll });
      if (!variables.__silent) {
        toast.success("契約を作成しました", { description: data?.contractNumber || "" });
      }
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Contract> }) => api.updateContract(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.invalidateAll });
      toast.success("契約を更新しました");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useBatchCreateContracts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.batchCreateContracts,
    onSuccess: (data: BatchCreateResult) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.invalidateAll });
      toast.success("一括作成完了: " + data.created + "件の契約を作成", {
        description: data.skipped > 0 ? data.skipped + "件スキップ" : undefined,
      });
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useBatchPreviewContracts() {
  return useMutation({
    mutationFn: api.batchPreviewContracts,
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useBatchGenerateDocuments() {
  return useMutation({
    mutationFn: api.generateBatchDocuments,
    onSuccess: (data: BatchDocumentResult) => {
      const errorCount = data.summary?.errors ?? 0;
      if (errorCount > 0) {
        toast.warning("PDF生成: " + errorCount + "件エラー", {
          description: data.contractCount + "契約処理 — エラーのある書類を確認してください",
        });
      } else {
        toast.success("ZIP生成完了: " + (data.files?.length || 0) + "件のZIP", {
          description: data.contractCount + "契約 / " + data.employeeCount + "名分",
        });
      }
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useNewHiresPreview() {
  return useMutation({
    mutationFn: api.newHiresPreview,
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useNewHiresCreate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.newHiresCreate,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.invalidateAll });
      toast.success("新規入社一括作成完了: " + data.created + "件の契約を作成", {
        description: data.skipped > 0 ? data.skipped + "件スキップ" : undefined,
      });
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useMidHiresPreview() {
  return useMutation({
    mutationFn: api.midHiresPreview,
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useMidHiresCreate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.midHiresCreate,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.invalidateAll });
      toast.success("途中入社一括作成完了: " + data.created + "件の契約を作成", {
        description: data.skipped > 0 ? data.skipped + "件スキップ" : undefined,
      });
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useByLineBatchCreate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.byLineBatchCreate,
    onSuccess: (data: ByLineBatchResult) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.invalidateAll });
      toast.success("ライン個別作成完了: " + data.created + "件の契約を作成");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.invalidateAll });
      toast.success("契約を削除しました");
    },
    onError: (err: unknown) => onMutationError(err),
  });
}
