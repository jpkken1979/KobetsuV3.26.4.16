import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { PdfVersion } from "@/lib/api-types";

export function usePdfVersions(contractId: number | null | undefined) {
  return useQuery<PdfVersion[]>({
    queryKey: contractId != null ? queryKeys.pdfVersions.byContract(contractId) : ["pdfVersions", "disabled"],
    queryFn: () => api.get<PdfVersion[]>(`/pdf-versions?contractId=${contractId}`),
    enabled: contractId != null,
    staleTime: 30_000,
  });
}
