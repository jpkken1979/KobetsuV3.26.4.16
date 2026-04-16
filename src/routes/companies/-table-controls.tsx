import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Filter,
  Maximize2,
  Minimize2,
  Search,
  Table2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GradientText } from "@/components/ui/animated";

interface CompanyTableControlsProps {
  sortedCount: number;
  companyCount: number;
  search: string;
  filterCompany: string;
  companyNames: string[];
  isFullscreen: boolean;
  exporting: boolean;
  onSearchChange: (value: string) => void;
  onFilterCompanyChange: (value: string) => void;
  onScroll: (direction: "left" | "right") => void;
  onOpenImport: () => void;
  onExport: () => void;
  onToggleFullscreen: () => void;
}

export function CompanyTableControls({
  sortedCount,
  companyCount,
  search,
  filterCompany,
  companyNames,
  isFullscreen,
  exporting,
  onSearchChange,
  onFilterCompanyChange,
  onScroll,
  onOpenImport,
  onExport,
  onToggleFullscreen,
}: CompanyTableControlsProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-4 pb-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight">
            <Table2 className="h-6 w-6 text-primary/80" />
            <GradientText>企業データ一覧</GradientText>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground/60">
            全{sortedCount}件 ・ {companyCount}社 ・ TBKaisha準拠レイアウト
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onScroll("left")}
            className="rounded-lg border border-border/50 p-2 text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-foreground/80 dark:border-white/10 dark:text-white/40 dark:hover:bg-white/5 dark:hover:text-white/70"
            title="左スクロール"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => onScroll("right")}
            className="rounded-lg border border-border/50 p-2 text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-foreground/80 dark:border-white/10 dark:text-white/40 dark:hover:bg-white/5 dark:hover:text-white/70"
            title="右スクロール"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={onOpenImport}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 transition-all hover:bg-emerald-500/20 hover:brightness-110 dark:bg-emerald-500/15 dark:text-emerald-400"
          >
            <Upload className="h-3.5 w-3.5" />
            Excel取込
          </button>
          <button
            onClick={onExport}
            disabled={exporting}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-all",
              exporting
                ? "cursor-wait border-border/20 text-muted-foreground/40 dark:border-white/5 dark:text-white/50"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 hover:brightness-110 active:scale-95 dark:text-emerald-400",
            )}
          >
            {exporting ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-emerald-600 dark:border-white/20 dark:border-t-emerald-400" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5" />
            )}
            {exporting ? "出力中..." : "Excel出力"}
          </button>
          <button
            onClick={onToggleFullscreen}
            className="rounded-lg border border-border/50 p-2 text-muted-foreground/60 transition-colors hover:bg-muted/50 hover:text-foreground/80 dark:border-white/10 dark:text-white/40 dark:hover:bg-white/5 dark:hover:text-white/70"
            title={isFullscreen ? "通常表示 (Esc)" : "フルスクリーン"}
          >
            {isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50 dark:text-white/50" />
          <input
            type="search"
            placeholder="会社名・工場名・住所で検索..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="w-72 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 pl-9 text-xs text-foreground/80 placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:placeholder:text-white/40"
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 dark:text-white/50">
          <Filter className="h-3.5 w-3.5" />
          <select
            value={filterCompany}
            onChange={(event) => onFilterCompanyChange(event.target.value)}
            className="rounded-lg border border-border/50 bg-muted/30 px-2 py-2 text-xs text-foreground/70 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:[color-scheme:dark]"
          >
            <option value="all">全企業</option>
            {companyNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        {isFullscreen && (
          <span className="ml-auto text-[10px] text-muted-foreground/40 dark:text-white/40">
            Esc で通常表示に戻る
          </span>
        )}
      </div>
    </>
  );
}
