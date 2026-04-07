import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useAdminTables() {
  return useQuery({
    queryKey: queryKeys.admin.tables,
    queryFn: api.getAdminTables,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}
