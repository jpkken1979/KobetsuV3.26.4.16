import { createFileRoute } from "@tanstack/react-router";
import { useFactories } from "@/lib/hooks/use-factories";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AnimatedPage } from "@/components/ui/animated";
import { api } from "@/lib/api";
import { ImportModal } from "./-import-modal";
import { CompanyTableControls } from "./-table-controls";
import { CompanyTableGrid } from "./-table-grid";
import { COLUMNS, COLUMN_GROUPS, COMPANY_PALETTE } from "./-table-config";

export const Route = createFileRoute("/companies/table")({
  component: CompanyTablePage,
});

// ─── Main Page Component ───────────────────────────────────────────────

function CompanyTablePage() {
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Escape key exits fullscreen
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  const { data: factories, isLoading } = useFactories();

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
      toast.success(`Excelを保存しました`, { description: `${result.path}（${result.factoryCount}ライン, ${result.companyCount}社）` });
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

  // Unique company names for filter
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
        isFullscreen={isFullscreen}
        exporting={exporting}
        onSearchChange={setSearch}
        onFilterCompanyChange={setFilterCompany}
        onScroll={scroll}
        onOpenImport={() => setShowImport(true)}
        onExport={handleExportExcel}
        onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
      />

      <CompanyTableGrid
        isLoading={isLoading}
        isFullscreen={isFullscreen}
        rowData={rowData}
        scrollRef={scrollRef}
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
      {isFullscreen ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-background p-4 pb-16 space-y-4">
          {tableContent}
        </div>
      ) : (
        <AnimatedPage className="space-y-4">
          {tableContent}
        </AnimatedPage>
      )}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </>
  );
}
