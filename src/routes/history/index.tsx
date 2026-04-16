import { AnimatedPage } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { ContractStatusBadge } from "@/components/ui/status-badge";
import { api, type Contract, type LaborHistoryFile } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Archive, Building2, Calendar, ChevronDown, Download, FileText, FolderOpen, History, Layers3, Loader2, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/history/")({
  component: HistoryPage,
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

type ContractGroup = {
  id: string;
  companyName: string;
  factoryName: string;
  department: string;
  lineName: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  contracts: Contract[];
};

const ACTION_COLORS: Record<string, string> = {
  active: "bg-primary dark:shadow-[0_0_6px_rgba(155,167,255,0.7)]",
  draft: "bg-primary dark:shadow-[0_0_6px_rgba(155,167,255,0.7)]",
  expired: "bg-red-400 dark:shadow-[0_0_6px_rgba(248,113,113,0.8)]",
  cancelled: "bg-red-400 dark:shadow-[0_0_6px_rgba(248,113,113,0.8)]",
  renewed: "bg-amber-400 dark:shadow-[0_0_6px_rgba(251,191,36,0.8)]",
  keiyakusho: "bg-blue-400 dark:shadow-[0_0_6px_rgba(96,165,250,0.8)]",
  shugyojoken: "bg-rose-400 dark:shadow-[0_0_6px_rgba(251,113,133,0.8)]",
};

const GROUP_WINDOW_MS = 10 * 60 * 1000;

function safeTime(value: string | undefined | null): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function makeCoreKey(c: Contract): string {
  return [
    c.companyId ?? c.company?.name ?? "",
    c.factoryId ?? c.factory?.factoryName ?? "",
    c.factory?.department ?? "",
    c.factory?.lineName ?? "",
    c.startDate ?? "",
    c.endDate ?? "",
  ].join("|");
}

function buildGroups(contracts: Contract[]): ContractGroup[] {
  const sorted = [...contracts].sort((a, b) => safeTime(b.createdAt) - safeTime(a.createdAt));
  const lastGroupByCore = new Map<string, ContractGroup>();
  const groups: ContractGroup[] = [];

  for (const contract of sorted) {
    const coreKey = makeCoreKey(contract);
    const currentTs = safeTime(contract.createdAt);
    const existing = lastGroupByCore.get(coreKey);

    if (existing) {
      const lastTs = safeTime(existing.createdAt);
      if (Math.abs(lastTs - currentTs) <= GROUP_WINDOW_MS) {
        existing.contracts.push(contract);
        continue;
      }
    }

    const group: ContractGroup = {
      id: `${coreKey}|${contract.id}`,
      companyName: contract.company?.name || "未設定企業",
      factoryName: contract.factory?.factoryName || "未設定工場",
      department: contract.factory?.department || "--",
      lineName: contract.factory?.lineName || "--",
      startDate: contract.startDate,
      endDate: contract.endDate,
      createdAt: contract.createdAt,
      contracts: [contract],
    };
    groups.push(group);
    lastGroupByCore.set(coreKey, group);
  }

  return groups;
}

function HistorySkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-center gap-4">
            <div className="skeleton h-5 w-5 rounded" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <div className="skeleton h-4 w-32 rounded" />
                <div className="skeleton h-5 w-14 rounded-full" />
              </div>
              <div className="flex gap-4">
                <div className="skeleton h-3 w-28 rounded" />
                <div className="skeleton h-3 w-36 rounded" />
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function HistoryPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [mode, setMode] = useState<"kobetsu" | "roudou">("kobetsu");
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [expandedContractId, setExpandedContractId] = useState<number | null>(null);
  const [regeneratingGroupId, setRegeneratingGroupId] = useState<string | null>(null);

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: queryKeys.contracts.history(statusFilter),
    queryFn: () => api.getContracts(statusFilter ? { status: statusFilter } : undefined),
    enabled: mode === "kobetsu",
  });

  const { data: laborHistory, isLoading: laborLoading } = useQuery({
    queryKey: queryKeys.laborHistory,
    queryFn: () => api.listLaborHistory(),
    enabled: mode === "roudou",
  });

  const filtered = useMemo(
    () =>
      contracts.filter((c) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          c.contractNumber?.toLowerCase().includes(q) ||
          c.company?.name?.toLowerCase().includes(q) ||
          c.factory?.factoryName?.toLowerCase().includes(q) ||
          c.factory?.department?.toLowerCase().includes(q) ||
          c.factory?.lineName?.toLowerCase().includes(q)
        );
      }),
    [contracts, search]
  );

  const groups = useMemo(() => buildGroups(filtered), [filtered]);
  const laborFiltered = useMemo(() => {
    const files = laborHistory?.files || [];
    if (!search) return files;
    const q = search.toLowerCase();
    return files.filter((f) => f.filename.toLowerCase().includes(q));
  }, [laborHistory, search]);

  const regenerateGroupZip = useMutation({
    mutationFn: (contractIds: number[]) => api.generateBatchDocuments(contractIds),
    onSuccess: (result) => {
      const zipFiles = (result.files || []).filter((f) => f.filename?.toLowerCase().endsWith(".zip"));
      for (const file of zipFiles) {
        const href = file.path || file.downloadUrl;
        if (!href) continue;
        const a = document.createElement("a");
        a.href = href;
        a.download = file.filename;
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      toast.success(`ZIP再生成完了: ${zipFiles.length}件`);
    },
    onError: (error: Error) => {
      toast.error("ZIP再生成に失敗しました", { description: error.message });
    },
    onSettled: () => {
      setRegeneratingGroupId(null);
    },
  });

  const openFolder = useMutation({
    mutationFn: (type: "kobetsu" | "roudou") => api.openDocumentsFolder(type),
    onSuccess: (result) => {
      toast.success(`フォルダを開きました`, { description: result.path });
    },
    onError: (error: Error) => {
      toast.error("フォルダを開けませんでした", { description: error.message });
    },
  });

  return (
    <AnimatedPage>
      <div className="space-y-6">
        <PageHeader
          title="履歴"
          tag="ACTIVITY_HISTORY"
        />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-border/60 bg-card p-1">
            <button
              type="button"
              onClick={() => setMode("kobetsu")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                mode === "kobetsu" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/40"
              )}
            >
              個別契約書履歴
            </button>
            <button
              type="button"
              onClick={() => setMode("roudou")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                mode === "roudou" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/40"
              )}
            >
              労働契約書履歴
            </button>
          </div>
          <div className="max-w-sm flex-1">
            <Input
              icon={Search}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={mode === "kobetsu" ? "契約番号・企業名・工場名で検索..." : "ファイル名で検索..."}
              aria-label="履歴検索"
            />
          </div>
          {mode === "kobetsu" && (
            <>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="ステータスフィルター"
              >
                <option value="">全ステータス</option>
                <option value="draft">下書き</option>
                <option value="active">有効</option>
                <option value="expired">期限切れ</option>
                <option value="cancelled">取消</option>
                <option value="renewed">更新済</option>
              </Select>
              <span className="rounded-full bg-muted/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {groups.length}グループ / {filtered.length}件
              </span>
            </>
          )}
          {mode === "roudou" && (
            <span className="rounded-full bg-muted/80 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {laborFiltered.length}件
            </span>
          )}
          <button
            type="button"
            onClick={() => openFolder.mutate(mode)}
            disabled={openFolder.isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {openFolder.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FolderOpen className="h-3.5 w-3.5" />
            )}
            フォルダを開く
          </button>
        </div>

        {/* Contract list */}
        {mode === "kobetsu" && isLoading ? (
          <HistorySkeleton />
        ) : mode === "kobetsu" && groups.length === 0 ? (
          <EmptyState
            icon={History}
            title="契約が見つかりません"
          />
        ) : mode === "kobetsu" ? (
          <div className="space-y-2">
            {groups.map((group) => {
              const isGroupExpanded = expandedGroupId === group.id;
              const groupEmployeeCount = group.contracts.reduce(
                (sum, c) => sum + (c.employees?.length || 0),
                0
              );
              const rateCount = new Set(group.contracts.map((c) => c.hourlyRate ?? 0)).size;

              return (
                <Card key={group.id} className={cn(
                  "transition-all",
                  isGroupExpanded && "border-primary/20 shadow-[var(--shadow-md)]"
                )}>
                  <div className="flex items-center gap-2 p-2">
                    <button
                      onClick={() => {
                        setExpandedGroupId(isGroupExpanded ? null : group.id);
                        if (isGroupExpanded) setExpandedContractId(null);
                      }}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-4 rounded-md p-2 text-left transition-colors hover:bg-muted/20"
                    >
                      <Layers3 className="h-5 w-5 shrink-0 text-muted-foreground/50" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            {group.companyName} / {group.factoryName}
                          </span>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                            {group.contracts.length}件
                          </span>
                          {rateCount > 1 && (
                            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-500">
                              単価{rateCount}種
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {group.department} / {group.lineName}
                          </span>
                          <span className="flex items-center gap-1 tabular-nums">
                            <Calendar className="h-3 w-3" />
                            {group.startDate} ~ {group.endDate}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {groupEmployeeCount}名
                          </span>
                          <span>作成: {group.createdAt?.slice(0, 16).replace("T", " ")}</span>
                        </div>
                      </div>
                      <div className={cn("rounded-md p-1 transition-transform", isGroupExpanded && "rotate-180")}>
                        <ChevronDown className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRegeneratingGroupId(group.id);
                        regenerateGroupZip.mutate(group.contracts.map((c) => c.id));
                      }}
                      disabled={regenerateGroupZip.isPending}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      {regeneratingGroupId === group.id && regenerateGroupZip.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Archive className="h-3.5 w-3.5" />
                      )}
                      ZIP再生成
                    </button>
                  </div>

                  {isGroupExpanded && (
                    <div className="space-y-2 border-t border-border/40 bg-muted/10 p-4">
                      {group.contracts.map((contract) => {
                        const isContractExpanded = expandedContractId === contract.id;
                        const employees = contract.employees;
                        const empCount = employees?.length || 0;

                        return (
                          <div key={contract.id} className="overflow-hidden rounded-lg border border-border/50 bg-background/30">
                            <button
                              onClick={() =>
                                setExpandedContractId(isContractExpanded ? null : contract.id)
                              }
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-primary/5"
                            >
                              <div className={cn(
                                "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                                ACTION_COLORS[contract.status ?? ""] ?? "bg-muted"
                              )} />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold">{contract.contractNumber}</span>
                                  <ContractStatusBadge status={contract.status} />
                                  {contract.hourlyRate && (
                                    <span className="text-xs font-semibold tabular-nums text-primary">
                                      ¥{contract.hourlyRate.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                  {contract.startDate} ~ {contract.endDate} ・ {empCount}名
                                </div>
                              </div>
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform",
                                  isContractExpanded && "rotate-180"
                                )}
                              />
                            </button>

                            {isContractExpanded && (
                              <div className="border-t border-border/40 bg-muted/10 p-4">
                                <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs md:grid-cols-4">
                                  {[
                                    { label: "工場", value: contract.factory?.factoryName ?? "--" },
                                    { label: "配属先", value: contract.factory?.department ?? "--" },
                                    { label: "ライン", value: contract.factory?.lineName ?? "--" },
                                    { label: "契約日", value: contract.contractDate ?? "--" },
                                    { label: "通知日", value: contract.notificationDate ?? "--" },
                                    { label: "業務", value: contract.jobDescription || contract.factory?.jobDescription || "--" },
                                    { label: "就業時間", value: `${contract.workStartTime ?? ""} ~ ${contract.workEndTime ?? ""}` },
                                  ].map((item) => (
                                    <div key={item.label}>
                                      <span className="text-muted-foreground/60">{item.label}:</span>{" "}
                                      <span className="font-medium">{item.value}</span>
                                    </div>
                                  ))}
                                </div>

                                {contract.hourlyRate && (
                                  <div className="mt-4 flex flex-wrap gap-2">
                                    {[
                                      { label: "基本", value: contract.hourlyRate },
                                      { label: "残業", value: contract.overtimeRate },
                                      { label: "深夜", value: contract.nightShiftRate },
                                      { label: "休日", value: contract.holidayRate },
                                    ].map((r) => (
                                      <div key={r.label} className="rounded-lg bg-background px-3 py-2 text-xs shadow-xs">
                                        <span className="text-muted-foreground">{r.label}:</span>{" "}
                                        <span className="font-semibold tabular-nums">¥{r.value?.toLocaleString() || "--"}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {employees && employees.length > 0 && (
                                  <div className="mt-4">
                                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">配属社員</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {employees.map((emp) => (
                                        <span
                                          key={emp.id}
                                          className="rounded-md bg-background px-2.5 py-1 text-xs font-medium shadow-xs"
                                        >
                                          {'fullName' in emp ? emp.fullName : `ID:${emp.id}`}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {contract.notes && (
                                  <p className="mt-3 text-xs text-muted-foreground">
                                    備考: {contract.notes}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : laborLoading ? (
          <HistorySkeleton />
        ) : laborFiltered.length === 0 ? (
          <EmptyState icon={FileText} title="労働契約書履歴がありません" />
        ) : (
          <Card className="overflow-hidden">
            <div className="divide-y divide-border/40">
              {laborFiltered.map((file: LaborHistoryFile) => (
                <div
                  key={`${file.filename}-${file.createdAt}`}
                  className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-primary/5"
                >
                  <div className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    ACTION_COLORS[file.type ?? ""] ?? "bg-muted"
                  )} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{file.filename}</span>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        file.type === "shugyojoken"
                          ? "bg-rose-500/15 text-rose-500"
                          : "bg-primary/15 text-primary"
                      )}>
                        {file.type === "shugyojoken" ? "就業条件明示書" : "労働契約書"}
                      </span>
                    </div>
                    <p className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                      <span>保存先: output/roudou</span>
                      <span>{file.createdAt?.slice(0, 16).replace("T", " ")}</span>
                      <span>{file.size ? `${(file.size / 1024).toFixed(0)}KB` : ""}</span>
                    </p>
                  </div>
                  <a
                    href={file.path}
                    download={file.filename}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                  >
                    <Download className="h-3.5 w-3.5" />
                    DL
                  </a>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AnimatedPage>
  );
}


