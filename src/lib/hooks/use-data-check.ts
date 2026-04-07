import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useDataCheck(companyId?: number) {
  return useQuery({
    queryKey: queryKeys.dataCheck.byCompany(companyId),
    queryFn: () => api.getDataCheck(companyId),
  });
}
