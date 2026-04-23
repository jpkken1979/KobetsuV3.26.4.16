import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFactories } from "@/lib/hooks/use-factories";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AnimatedPage } from "@/components/ui/animated";
import { api } from "@/lib/api";
import type { Factory } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { ImportModal } from "./-import-modal";
import { CompanyTableControls } from "./-table-controls";
import { CompanyTableGrid } from "./-table-grid";
import { FactoryYearlyConfigDialog } from "./-factory-yearly-config";
import { COLUMNS, COLUMN_GROUPS, COMPANY_PALETTE } from "./-table-config";

export const Route = createFileRoute("/companies/table")({
  component: CompanyTablePage,
});

function CompanyTablePage() {
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/companies/table" });
  const isExpandMode = (searchParams as { expand?: string }).expand === "1";
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [yearlyConfigFactory, setYearlyConfigFactory] = useState<Factory | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const toggleExpand = () => {
    if (isExpandMode) {
      navigate({ to: "/companies/table", search: {}, replace: true });
    } else {
      navigate({ to: "/companies/table", search: { expand: "1" } as Record<string, string>, replace: true });
    }
  };

  // ESC key exits expand mode
  useEffect(() => {
    if (!isExpandMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        navigate({ to: "/companies/table", search: {}, replace: true });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isExpandMode, navigate]);

  const { data: factories, isLoading } = useFactories();

  const { data: configuredFactoryIds } = useQuery({
    queryKey: queryKeys.factoryYearlyConfig.summary(),
    queryFn: () => api.getFactoryYearlyConfigSummary(),
    staleTime: 30_000,
  });
  const configuredSet = useMemo(
    () => new Set(configuredFactoryIds ?? []),
    [configuredFactoryIds]
  );

  // Filter
  const filtered = useMemo(
    () =>
      (factories ?? []).filter((f) => {
        if (filterCompany !== "all" && f.company?.name !== filterCompany) return false;
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          (f.company?.name ?? "").toLowerCase().includes(s) ||
          (f.factoryName ?? "").toLowerCase().includes(s) ||
          (f.department ?? "").toLowerCase().includes(s) ||
          (f.lineName ?? "").toLowerCase().includes(s) ||
          (f.address ?? "").toLowerCase().includes(s)
        );
      }),
    [factories, search, filterCompany],
  );

  // Sort: company name → factory name → department → line
  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const cmp1 = (a.company?.name ?? "").localeCompare(b.company?.name ?? "");
        if (cmp1 !== 0) return cmp1;
        const cmp2 = (a.factoryName ?? "").localeCompare(b.factoryName ?? "");
        if (cmp2 !== 0) return cmp2;
        const cmp3 = (a.department ?? "").localeCompare(b.department ?? "");
        if (cmp3 !== 0) return cmp3;
        return (a.lineName ?? "").localeCompare(b.lineName ?? "");
      }),
    [filtered],
  );

  // Group by company for row coloring
  const companyColors = useMemo(() => {
    const map = new Map<string, number>();
    let colorIdx = 0;
    sorted.forEach((f) => {
      const name = f.company?.name ?? "";
      if (!map.has(name)) {
        map.set(name, colorIdx++);
      }
    });
    return map;
  }, [sorted]);

  // Pre-compute per-row color and alternation metadata
  const rowData = useMemo(() => {
    let prev = "";
    let within = 0;
    return sorted.map((factory, idx) => {
      const name = factory.company?.name ?? "";
      if (name !== prev) { within = 0; prev = name; } else { within++; }
      const cIdx = companyColors.get(name) ?? 0;
      const color = COMPANY_PALETTE[cIdx % COMPANY_PALETTE.length];
      return {
        factory,
        companyName: name,
        color,
        isNewCompany: idx > 0 && name !== (sorted[idx - 1].company?.name ?? ""),
        isEvenWithin: within % 2 === 0,
      };
    });
  }, [sorted, companyColors]);

  const handleExportExcel = useCallback(async () => {
    if (!sorted.length) return;
    setExporting(true);

    try {
      const result = await api.exportFactoriesExcel();
      toast.success("Excelを保存しました", {
        description: `${result.path}（${result.factoryCount}ライン, ${result.companyCount}社, 年度設定: 工場${result.factoryYearlyConfigCount}件 / 企業${result.companyYearlyConfigCount}件）`,
      });
    } catch {
      toast.error("Excel出力に失敗しました");
    } finally {
      setExporting(false);
    }
  }, [sorted]);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -600 : 600, behavior: "smooth" });
  };

  const scrollToGroup = useCallback((groupKey: string) => {
    if (!scrollRef.current) return;
    // Find the first column of this group (skip first 2 sticky cols)
    let offsetLeft = 0;
    for (const col of COLUMNS.slice(2)) {
      if (col.group === groupKey) break;
      offsetLeft += col.width;
    }
    scrollRef.current.scrollTo({ left: offsetLeft, behavior: "smooth" });
  }, []);

  const companyNames = [
    ...new Set(
      (factories ?? [])
        .map((factory) => factory.company?.name)
        .filter((name): name is string => Boolean(name)),
    ),
  ].sort();

  // ─── Content (shared between normal and fullscreen) ───────────────
  const tableContent = (
    <>
      <CompanyTableControls
        sortedCount={sorted.length}
        companyCount={companyNames.length}
        search={search}
        filterCompany={filterCompany}
        companyNames={companyNames}
        isExpandMode={isExpandMode}
        exporting={exporting}
        onSearchChange={setSearch}
        onFilterCompanyChange={setFilterCompany}
        onScroll={scroll}
        onOpenImport={() => setShowImport(true)}
        onExport={handleExportExcel}
        onToggleExpand={toggleExpand}
      />

      <CompanyTableGrid
        isLoading={isLoading}
        isFullscreen={false}
        rowData={rowData}
        scrollRef={scrollRef}
        onYearlyConfig={setYearlyConfigFactory}
        factoryConfigIds={configuredSet}
      />

      {/* Navigation buttons — click to jump to column group */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-1.5 border-t border-border/40 bg-card/95 px-3 py-2.5 backdrop-blur-md">
        <span className="mr-2 text-[10px] font-bold text-muted-foreground/60">移動:</span>
        {Object.entries(COLUMN_GROUPS).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => scrollToGroup(key)}
            className={cn(
              "cursor-pointer rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all",
              "hover:scale-105 hover:brightness-125 active:scale-95",
              cfg.color,
            )}
          >
            {cfg.label}
          </button>
        ))}
      </div>
    </>
  );

  return (
    <>
      <AnimatedPage className="space-y-4">
        {tableContent}
      </AnimatedPage>
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {yearlyConfigFactory && (
        <FactoryYearlyConfigDialog
          factoryId={yearlyConfigFactory.id}
          companyId={yearlyConfigFactory.companyId}
          factoryLabel={`${yearlyConfigFactory.factoryName ?? ""} / ${yearlyConfigFactory.department ?? ""} / ${yearlyConfigFactory.lineName ?? ""}`}
          open={true}
          onClose={() => setYearlyConfigFactory(null)}
        />
      )}
    </>
  );
}
