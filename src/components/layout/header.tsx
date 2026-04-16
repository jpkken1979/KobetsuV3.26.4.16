import { useEffect, useState } from "react";
import { Moon, Sun, Search, Menu, Columns3, PanelTop, View, AlignJustify, ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/hooks/use-theme";
import { useUIPrefs } from "@/stores/ui-prefs";
import type { LayoutMode } from "./root-layout";

interface HeaderProps {
  onMenuClick: () => void;
  layoutMode: LayoutMode;
  onModeChange: (mode: LayoutMode) => void;
}

const MODE_ITEMS: Array<{ key: LayoutMode; icon: typeof View; label: string; hint: string }> = [
  { key: "wide", icon: Columns3, label: "広い", hint: "全幅" },
  { key: "balanced", icon: PanelTop, label: "標準", hint: "読みやすさ" },
  { key: "focus", icon: View, label: "集中", hint: "詳細" },
];

export function Header({ onMenuClick, layoutMode, onModeChange }: HeaderProps) {
  const { isDark, toggleTheme } = useTheme();
  const { density, setDensity } = useUIPrefs();
  const [now, setNow] = useState(new Date());
  const themeLabel = isDark ? "Bugatti" : "Ferrari";
  const themeDetail = isDark ? "carbon / red / gold" : "white / red / gold / carbon";

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="btn-press rounded-xl border border-border/60 bg-card/70 p-2.5 text-muted-foreground shadow-xs hover:border-primary/25 hover:text-foreground lg:hidden"
          aria-label="メニュー"
        >
          <Menu className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("command-palette:open"));
          }}
          aria-label="検索とコマンドを開く"
          className="btn-press flex min-w-0 items-center gap-2 rounded-full border border-border/70 bg-card/70 px-4 py-2 text-sm text-muted-foreground shadow-xs hover:border-primary/25 hover:text-foreground"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden truncate sm:inline">検索・操作</span>
          <kbd className="ml-2 hidden rounded-[4px] border border-border/70 bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            Ctrl+K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <div className="hidden items-center rounded-full border border-border/70 bg-card/70 p-1 md:flex" title="表示幅">
          {MODE_ITEMS.map(({ key, icon: Icon, label, hint }) => (
            <button
              key={key}
              onClick={() => onModeChange(key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
                layoutMode === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label={label}
              title={`${label} - ${hint}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="hidden h-5 w-px bg-border/80 md:block" />
        
        {/* Density Toggle */}
        <div className="hidden items-center rounded-full border border-border/70 bg-card/70 p-1 md:flex" title="表示密度">
          <button
            onClick={() => setDensity("comfortable")}
            className={cn(
              "p-1.5 rounded-full",
              density === "comfortable" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            title="標準"
          >
            <AlignJustify className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setDensity("compact")}
            className={cn(
              "p-1.5 rounded-full",
              density === "compact" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            title="コンパクト"
          >
            <ListFilter className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="hidden h-5 w-px bg-border/80 md:block" />
        <span className="hidden text-xs tabular-nums text-muted-foreground md:inline">
          {now.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}
        </span>
        <div className="hidden h-5 w-px bg-border/80 md:block" />
        <button
          type="button"
          onClick={toggleTheme}
          className="btn-press flex items-center gap-2 rounded-full border border-border/70 bg-card/70 px-3 py-2 text-muted-foreground shadow-xs hover:border-primary/25 hover:text-foreground"
          aria-label={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
        >
          {isDark ? <Moon className="h-4 w-4 text-accent" /> : <Sun className="h-4 w-4 text-primary" />}
          <span className="hidden min-w-0 flex-col text-left leading-tight sm:flex">
            <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
              Theme
            </span>
            <span className="text-[11px] font-semibold text-foreground">{themeLabel}</span>
          </span>
          <span className="hidden rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground md:inline">
            {themeDetail}
          </span>
        </button>
      </div>
    </header>
  );
}
