import { AnimatedPage } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { AuditActionBadge } from "@/components/ui/status-badge";
import type { AuditLogEntry } from "@/lib/api";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Filter, Loader2, Search, Shield } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/audit/")({
  component: AuditPage,
  errorComponent: ({ reset }) => (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <p className="text-lg font-semibold text-destructive">エラーが発生しました</p>
      <Button variant="outline" onClick={reset}>再試行</Button>
    </div>
  ),
  pendingComponent: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

const ENTITY_LABELS: Record<string, string> = {
  contract: "契約",
  employee: "社員",
  company: "企業",
  factory: "工場",
  calendar: "カレンダー",
  document: "書類",
};

function AuditSkeleton() {
  return (
    <Card>
      <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
        <div className="grid grid-cols-6 gap-4">
          {["w-28", "w-14", "w-14", "w-10", "w-40", "w-16"].map((w, i) => (
            <div key={i} className={`skeleton h-3.5 ${w} rounded`} />
          ))}
        </div>
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="border-b border-border/40 px-4 py-3 last:border-0">
          <div className="grid grid-cols-6 gap-4">
            <div className="skeleton h-3.5 w-32 rounded" />
            <div className="skeleton h-5 w-12 rounded-full" />
            <div className="skeleton h-3.5 w-12 rounded" />
            <div className="skeleton h-3.5 w-8 rounded" />
            <div className="skeleton h-3.5 w-44 rounded" />
            <div className="skeleton h-3.5 w-14 rounded" />
          </div>
        </div>
      ))}
    </Card>
  );
}

function AuditPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: queryKeys.dashboard.audit(actionFilter, entityFilter),
    queryFn: async () => {
      const result = await api.getAuditLogs({
        limit: 100,
        action: actionFilter || undefined,
        entityType: entityFilter || undefined,
      });
      return result.logs;
    },
  });

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log: AuditLogEntry) => {
      const haystack = [
        log.action,
        log.entityType,
        log.entityId,
        log.detail,
        log.userName,
        log.timestamp,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [logs, search]);

  return (
    <AnimatedPage>
      <div className="space-y-6">
        <PageHeader
          title="監査ログ"
          tag="AUDIT_LOG"
        />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="max-w-sm flex-1">
            <Input
              icon={Search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="詳細を検索..."
              aria-label="監査ログ検索"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground/50" />
            <Select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              aria-label="アクションフィルター"
            >
              <option value="">全アクション</option>
              <option value="create">作成</option>
              <option value="update">更新</option>
              <option value="delete">削除</option>
              <option value="export">出力</option>
              <option value="import">取込</option>
            </Select>

            <Select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              aria-label="エンティティフィルター"
            >
              <option value="">全エンティティ</option>
              <option value="contract">契約</option>
              <option value="employee">社員</option>
              <option value="company">企業</option>
              <option value="factory">工場</option>
            </Select>

            <span className="rounded-full bg-muted/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {filteredLogs.length}件
            </span>
          </div>
        </div>

        {/* Log table */}
        {isLoading ? (
          <AuditSkeleton />
        ) : (
          <Card className="overflow-hidden">
            {filteredLogs.length === 0 ? (
              <EmptyState
                icon={Shield}
                title="ログが見つかりません"
                className="border-0 rounded-none"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30">
                      <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">日時</th>
                      <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">操作</th>
                      <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">対象</th>
                      <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">ID</th>
                      <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">詳細</th>
                      <th scope="col" className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">ユーザー</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log: AuditLogEntry, i: number) => (
                      <tr
                        key={log.id}
                        className={cn(
                          "border-b border-border/40 last:border-0 transition-colors hover:bg-primary/5",
                          i % 2 === 1 && "bg-muted/10"
                        )}
                      >
                        <td className="whitespace-nowrap px-4 py-2 text-xs tabular-nums text-muted-foreground">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString("ja-JP") : "--"}
                        </td>
                        <td className="px-4 py-2">
                          <AuditActionBadge action={log.action} />
                        </td>
                        <td className="px-4 py-2 text-xs font-medium">
                          {ENTITY_LABELS[log.entityType] || log.entityType}
                        </td>
                        <td className="px-4 py-2 text-xs tabular-nums text-muted-foreground">
                          {log.entityId || "--"}
                        </td>
                        <td
                          className="max-w-xs truncate px-4 py-2 text-xs text-muted-foreground"
                          title={log.detail || undefined}
                        >
                          {log.detail || "--"}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {log.userName || "system"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </AnimatedPage>
  );
}
