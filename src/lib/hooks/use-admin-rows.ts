import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useAdminRows(
  table: string,
  params?: {
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
  }
) {
  return useQuery({
    queryKey: queryKeys.admin.rows(table),
    queryFn: () => api.getAdminRows(table, params),
    enabled: !!table,
  });
}
