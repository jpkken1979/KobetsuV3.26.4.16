import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";

export function useDashboardStats(warningDays = 30) {
  return useQuery({
    queryKey: queryKeys.dashboard.stats(warningDays),
    queryFn: () => api.getDashboardStats(warningDays),
  });
}
