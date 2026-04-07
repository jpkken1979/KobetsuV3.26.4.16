import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { onMutationError } from "@/lib/mutation-helpers";
import type { DiffFactory, ParseResponse } from "@/routes/companies/-koritsu-components";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KoritsuApplyPayload {
  companyId: number;
  factories: DiffFactory[];
  addresses: Record<string, string>;
  complaint: { name: string | null; dept: string | null; phone: string | null };
  uns: {
    managerName: string | null;
    managerDept: string | null;
    managerPhone: string | null;
    managerAddress: string | null;
    complaintName: string | null;
    complaintDept: string | null;
    complaintPhone?: string | null;
  };
  workConditions: {
    workDays: string | null;
    workHours: string | null;
    breakTime: string | null;
    overtimeHours: string | null;
  };
}

export interface KoritsuApplyResult {
  success: boolean;
  inserted: number;
  updated: number;
  total: number;
}

// ─── Preview mutation (parse Excel → dry run diff, never writes DB) ──────────

export function usePreviewKoritsuImport() {
  return useMutation<ParseResponse, Error, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/koritsu/parse", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      return res.json() as Promise<ParseResponse>;
    },
    onError: (err: unknown) => onMutationError(err),
  });
}

// ─── Apply mutation (writes diff to DB and invalidates caches) ────────────────

export function useApplyKoritsuImport() {
  const qc = useQueryClient();

  return useMutation<KoritsuApplyResult, Error, KoritsuApplyPayload>({
    mutationFn: async (payload: KoritsuApplyPayload) => {
      const res = await fetch("/api/import/koritsu/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      return res.json() as Promise<KoritsuApplyResult>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.factories.invalidateAll });
      qc.invalidateQueries({ queryKey: queryKeys.companies.all });
    },
    onError: (err: unknown) => onMutationError(err),
  });
}
