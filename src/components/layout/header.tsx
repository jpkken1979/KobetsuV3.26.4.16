import { useEffect, useState } from "react";
import { Moon, Sun, Search, Menu, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/hooks/use-theme";
import type { LayoutAlign } from "./root-layout";

interface HeaderProps {
  onMenuClick: () => void;
  layoutAlign: LayoutAlign;
  onAlignChange: (align: LayoutAlign) => void;
}

export function Header({ onMenuClick, layoutAlign, onAlignChange }: HeaderProps) {
  const { isDark, toggleTheme } = useTheme();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-xl transition-all duration-300 md:px-6">
      {/* Left: hamburger + search */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="btn-press rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
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
          className="btn-press flex items-center gap-2 rounded-lg border border-border/80 bg-background px-3 py-1.5 text-sm text-muted-foreground shadow-xs transition-all hover:border-primary/30 hover:bg-muted hover:shadow-sm"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">検索・操作</span>
          <kbd className="ml-2 hidden rounded-[4px] border border-border/80 bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium sm:inline-block">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Layout alignment toggle */}
        <div className="hidden items-center rounded-lg border border-border/60 p-0.5 md:flex" title="レイアウト配置">
          {([
            { key: "left" as const, icon: AlignLeft, label: "左寄せ" },
            { key: "center" as const, icon: AlignCenter, label: "中央" },
            { key: "right" as const, icon: AlignRight, label: "右寄せ" },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => onAlignChange(key)}
              className={cn(
                "rounded-md p-1.5 transition-all duration-150",
                layoutAlign === key
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              )}
              aria-label={label}
              title={label}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        <div className="hidden h-4 w-px bg-border md:block" />
        <span className="hidden text-xs tabular-nums text-muted-foreground md:inline">
          {now.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}
        </span>
        <div className="hidden h-4 w-px bg-border md:block" />
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-border bg-card text-muted-foreground transition-all hover:border-primary/40 hover:bg-muted hover:text-primary"
          aria-label={isDark ? "ライトモードに切り替え" : "ダークモードに切り替え"}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
