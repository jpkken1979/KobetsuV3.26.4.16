import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useState, useMemo } from "react";
import { AnimatedPage } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useDataCheck } from "@/lib/hooks/use-data-check";
import { useCompanies } from "@/lib/hooks/use-companies";
import { SkeletonTable } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { COMPLETENESS_CONFIG, type CompletenessLevel } from "./-completeness";
import { FlatView } from "./-flat-view";
import { GroupedView } from "./-grouped-view";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ClipboardCheck,
  Table2,
  LayoutList,
  Loader2,
  Search,
  Building2,
  Columns3,
  Filter,
} from "lucide-react";

const ExportImportButtonsLazy = lazy(async () => {
  const mod = await import("./-export-import");
  return { default: mod.ExportImportButtons };
});

export const Route = createFileRoute("/data-check/")({
  component: DataCheckPage,
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

function DataCheckPage() {
  const [companyId, setCompanyId] = useState<number | undefined>();
  const [viewMode, setViewMode] = useState<"flat" | "grouped">("flat");
  const [filter, setFilter] = useState<CompletenessLevel | "all">("all");
  const [search, setSearch] = useState("");
  const [showAllColumns, setShowAllColumns] = useState(false);

  const { data: companies } = useCompanies();
  const { data, isLoading } = useDataCheck(companyId);

  const filtered = useMemo(() => {
    if (!data) return [];
    let result = data.employees;
    if (filter !== "all")
      result = result.filter((e) => e.completeness === filter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.fullName?.toLowerCase().includes(q) ||
          e.employeeNumber?.toLowerCase().includes(q) ||
          e.katakanaName?.toLowerCase().includes(q) ||
          e.factory?.factoryName?.toLowerCase().includes(q) ||
          e.company?.name?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [data, filter, search]);

  return (
    <AnimatedPage className="space-y-6 p-6">
      <PageHeader
        title="データ確認"
        subtitle="派遣社員マスターデータの充足度を確認・編集"
        tag="data check"
      >
        <Suspense fallback={null}>
          <ExportImportButtonsLazy />
        </Suspense>
        {/* Column filter toggle (テーブル mode only) */}
        {viewMode === "flat" && (
          <button
            onClick={() => setShowAllColumns((v) => !v)}
            aria-pressed={showAllColumns}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
              showAllColumns
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-border"
            )}
            title={showAllColumns ? "問題のある列のみ表示" : "全列を表示"}
          >
            {showAllColumns ? (
              <Columns3 className="h-3.5 w-3.5" />
            ) : (
              <Filter className="h-3.5 w-3.5" />
            )}
            {showAllColumns ? "全列" : "要確認のみ"}
          </button>
        )}
        <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card p-0.5">
          <button
            onClick={() => setViewMode("flat")}
            aria-pressed={viewMode === "flat"}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
              viewMode === "flat"
                ? "bg-primary/15 text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Table2 className="h-3.5 w-3.5" />
            テーブル
          </button>
          <button
            onClick={() => setViewMode("grouped")}
            aria-pressed={viewMode === "grouped"}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer",
              viewMode === "grouped"
                ? "bg-primary/15 text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutList className="h-3.5 w-3.5" />
            グループ
          </button>
        </div>
      </PageHeader>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["green", "yellow", "red", "gray"] as const).map((level) => (
          <button
            key={level}
            onClick={() => setFilter(filter === level ? "all" : level)}
            className={cn(
              "rounded-xl border p-3 text-center transition-all cursor-pointer",
              filter === level
                ? "ring-2 ring-primary"
                : "border-border/60 hover:border-border",
              "bg-card shadow-[var(--shadow-card)]"
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  COMPLETENESS_CONFIG[level].dotClass
                )}
              />
              <span className="text-2xl font-bold tabular-nums">
                {data?.stats[level] ?? 0}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {COMPLETENESS_CONFIG[level].label}
            </p>
          </button>
        ))}
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Company Filter */}
        <div className="relative">
          <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <select
            value={companyId ?? ""}
            onChange={(e) =>
              setCompanyId(e.target.value ? Number(e.target.value) : undefined)
            }
            className="h-9 rounded-lg border border-border/60 bg-card pl-9 pr-8 text-sm text-foreground shadow-sm transition-colors hover:border-border focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer appearance-none"
          >
            <option value="">全企業</option>
            {companies?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="氏名、社員番号、カナ、工場名で検索…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-lg border border-border/60 bg-card pl-9 pr-3 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/40 hover:border-border focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Results count */}
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <ClipboardCheck className="h-3.5 w-3.5" />
          <span>
            {filtered.length}
            {data ? ` / ${data.stats.total}` : ``} 件
          </span>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <SkeletonTable rows={12} columns={8} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="データが見つかりません"
          description={search || filter !== "all" ? "条件に一致する社員が見つかりません。フィルターを変更してください" : "社員データが登録されていません"}
        />
      ) : viewMode === "flat" ? (
        <FlatView employees={filtered} showAllColumns={showAllColumns} />
      ) : (
        <GroupedView employees={filtered} />
      )}
    </AnimatedPage>
  );
}
