import { getAppSettings } from "@/lib/app-settings";
import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import {
    Building2,
    ClipboardCheck,
    FileDown,
    FileText,
    FileUp,
    History,
    LayoutDashboard,
    ScrollText,
    Settings,
    Shield,
    Table2,
    Upload,
    Users,
    X,
} from "lucide-react";
import { useMemo } from "react";
import type { ElementType } from "react";


interface SidebarProps {
  onClose?: () => void;
}

function NavItem({
  to,
  icon: Icon,
  label,
  active,
  onClick,
}: {
  to: string;
  icon: ElementType;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 cursor-pointer overflow-hidden",
        active
          ? "bg-primary/10 text-primary font-semibold dark:bg-primary/[0.12]"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:translate-x-0.5"
      )}
    >
      {/* Left border indicator for active state */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
      )}
      <Icon
        className={cn(
          "h-[17px] w-[17px] shrink-0 transition-all duration-200",
          active
            ? "text-primary"
            : "text-muted-foreground/60 group-hover:text-foreground/70 group-hover:scale-110"
        )}
      />
      <span className="truncate">{label}</span>

      {active && (
        <span className="ml-auto h-2 w-2 rounded-full bg-primary shadow-[0_0_6px_var(--color-primary)]" />
      )}
    </Link>
  );
}

export function Sidebar({ onClose }: SidebarProps) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const adminMode = getAppSettings().adminMode;

  const navigationSections = useMemo(() => [
    {
      label: null,
      items: [
        { name: "ダッシュボード", href: "/", icon: LayoutDashboard },
        { name: "契約管理", href: "/contracts", icon: FileText },
      ],
    },
    {
      label: "基本データ",
      items: [
        { name: "派遣社員", href: "/employees", icon: Users },
        { name: "派遣先企業", href: "/companies", icon: Building2 },
        { name: "データ確認", href: "/data-check", icon: ClipboardCheck },
      ],
    },
    {
      label: "業務ツール",
      items: [
        { name: "書類生成", href: "/documents", icon: FileDown },
        { name: "インポート", href: "/import", icon: Upload },
        { name: "企業テーブル", href: "/companies/table", icon: Table2 },
        { name: "コーリツ管理", href: "/companies/koritsu", icon: FileUp },
      ],
    },
    {
      label: "システム",
      items: [
        { name: "履歴・書類", href: "/history", icon: History },
        { name: "監査ログ", href: "/audit", icon: ScrollText },
        { name: "設定", href: "/settings", icon: Settings },
        ...(adminMode ? [{ name: "Admin DB", href: "/admin", icon: Shield }] : []),
      ],
    },
  ], [adminMode]);

  return (
    <aside className="relative z-20 flex h-screen w-64 flex-col bg-sidebar border-r border-border backdrop-blur-xl text-sidebar-foreground">

      {/* Ambient glow superior */}
      <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-48 w-full bg-gradient-to-b from-violet-500/5 to-transparent" />

      {/* Logo / branding */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[var(--gradient-accent-from)] to-[var(--gradient-accent-to)] font-black text-base text-[#06010f] dark:shadow-[0_0_24px_rgba(139,92,246,0.45)]">
          契
        </div>
        <div>
          <p className="text-sm font-bold text-foreground leading-tight">JP個別契約書</p>
          <p className="text-[11px] font-semibold text-muted-foreground">
            ユニバーサル企画
          </p>
        </div>

        {/* Cierre en móvil */}
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:bg-white/10 hover:text-foreground lg:hidden cursor-pointer"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navegación */}
      <nav aria-label="メインナビゲーション" className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/30">
        {navigationSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className={cn(sectionIndex > 0 && "mt-4")}>
            {section.label && (
              <>
                <div className="mx-3 mb-3 h-px bg-border/40" />
                <p className="px-3 mb-2 text-[10px] uppercase tracking-widest text-muted-foreground/50">
                  {section.label}
                </p>
              </>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = (() => {
                  if (item.href === "/") return currentPath === "/";
                  const exactMatch = currentPath === item.href || currentPath === item.href + "/";
                  if (exactMatch) return true;
                  if (!currentPath.startsWith(item.href + "/")) return false;
                  // Search ALL sections for a more-specific match to avoid
                  // cross-section false positives (e.g. /companies vs /companies/table)
                  const allItems = navigationSections.flatMap((s) => s.items);
                  const hasBetterMatch = allItems.some(
                    (other) =>
                      other.href !== item.href &&
                      other.href.startsWith(item.href) &&
                      (currentPath === other.href ||
                        currentPath === other.href + "/" ||
                        currentPath.startsWith(other.href + "/"))
                  );
                  return !hasBetterMatch;
                })();

                return (
                  <NavItem
                    key={item.href}
                    to={item.href}
                    icon={item.icon}
                    label={item.name}
                    active={isActive}
                    onClick={onClose}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Divisor */}
      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-border/30 to-transparent" />

      {/* Footer — info empresa */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-border/20 dark:ring-white/[0.05]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--gradient-accent-from)]/20 to-[var(--gradient-accent-to)]/10 ring-1 ring-[var(--gradient-accent-from)]/20">
            <span className="text-[10px] font-bold text-primary/80">管</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-foreground/90">
              UNS 管理
            </p>
            <p className="truncate text-[10px] font-medium text-muted-foreground/60">
              契約管理システム
            </p>
          </div>
          <div className="ml-auto flex h-2 w-2 shrink-0 items-center justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </div>
    </aside>
  );
}
