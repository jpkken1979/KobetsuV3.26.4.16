/**
 * Admin column metadata hook.
 * Phase 2 of the Admin Database Panel.
 *
 * Returns the AdminColumnMeta[] for a given table name,
 * extracted from the useAdminTables query (tables include embedded columns).
 */

import { useMemo } from "react";
import { useAdminTables } from "./use-admin-tables";
import type { AdminColumnMeta } from "@/lib/api-types";

export function useAdminColumns(table: string): { data: AdminColumnMeta[] } {
  const { data: tables } = useAdminTables();

  const columns = useMemo(() => {
    const t = tables?.find((meta) => meta.name === table);
    return t?.columns ?? [];
  }, [tables, table]);

  return { data: columns };
}
