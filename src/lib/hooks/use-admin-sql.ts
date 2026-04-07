import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useAdminSql() {
  return useMutation({
    mutationFn: (sql: string) => api.executeSql(sql),
  });
}
