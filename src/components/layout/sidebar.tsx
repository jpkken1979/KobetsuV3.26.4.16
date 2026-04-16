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
        "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 cursor-pointer overflow-hidden",
        active
          ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/15 dark:bg-primary/[0.14]"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground hover:translate-x-0.5"
      )}
    >
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
        { name: "招聘者", href: "/shouheisha", icon: Users },
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
    <aside className="relative z-20 flex h-screen w-[18rem] flex-col overflow-hidden border-r border-border/70 bg-sidebar/90 text-sidebar-foreground backdrop-blur-xl shadow-[12px_0_40px_rgba(18,19,22,0.04)] dark:shadow-[12px_0_40px_rgba(0,0,0,0.28)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.35),transparent_22%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute left-4 top-4 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative border-b border-border/70 px-4 py-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 px-3 py-3 shadow-[var(--shadow-card)]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-black text-primary-foreground shadow-sm">
            契
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Sumi Ledger</p>
            <p className="truncate text-sm font-semibold text-foreground">個別契約書管理</p>
            <p className="truncate text-[11px] text-muted-foreground">ユニバーサル企画株式会社</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2">
            <p className="text-muted-foreground">API</p>
            <p className="mt-0.5 font-semibold text-foreground">Online</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/70 px-3 py-2">
            <p className="text-muted-foreground">DB</p>
            <p className="mt-0.5 font-semibold text-foreground">SQLite</p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-xl border border-border/60 bg-card/80 p-2 text-muted-foreground/70 transition-colors hover:border-primary/20 hover:text-foreground lg:hidden"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav aria-label="メインナビゲーション" className="flex-1 overflow-y-auto px-3 py-4">
        {navigationSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className={cn(sectionIndex > 0 && "mt-4")}>
            {section.label && (
              <>
                <div className="mx-3 mb-3 h-px bg-gradient-to-r from-transparent via-border/70 to-transparent" />
                <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.24em] text-muted-foreground/55">
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

      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-border/70 to-transparent" />

      <div className="px-4 py-4">
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/70 px-3 py-2.5 shadow-[var(--shadow-card)]">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/15">
            <span className="text-[10px] font-bold text-primary">管</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-foreground">
              UNS 管理
            </p>
            <p className="truncate text-[10px] font-medium text-muted-foreground">
              契約管理システム
            </p>
          </div>
          <div className="ml-auto flex h-2 w-2 shrink-0 items-center justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          </div>
        </div>
      </div>
    </aside>
  );
}
