import { AnimatedPage, NumberTicker } from "@/components/ui/animated";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Factory,
  FileText,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import type React from "react";

const heroVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.5, 0, 0, 1] as [number, number, number, number] },
  },
};

const statGridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const statItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.5, 0, 0, 1] as [number, number, number, number] },
  },
};

/* ── StatCard ── */
function StatCard({
  title,
  value,
  icon: Icon,
  accent = "primary",
  isLoading,
  to,
  trend,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  accent?: "primary" | "accent" | "warning" | "neutral";
  isLoading?: boolean;
  to?: string;
  trend?: "up" | "stable";
}) {
  const accentStyles: Record<string, { icon: string; iconBg: string }> = {
    primary: {
      icon: "text-primary",
      iconBg: "bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] ring-[color-mix(in_srgb,var(--color-primary)_25%,transparent)]",
    },
    accent: {
      icon: "text-accent",
      iconBg: "bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] ring-[color-mix(in_srgb,var(--color-accent)_25%,transparent)]",
    },
    warning: {
      icon: "text-[var(--color-status-warning)]",
      iconBg: "bg-[var(--color-status-warning-muted)] ring-[color-mix(in_srgb,var(--color-status-warning)_28%,transparent)]",
    },
    neutral: {
      icon: "text-muted-foreground",
      iconBg: "bg-muted ring-border/60",
    },
  };
  const s = accentStyles[accent];

  const content = (
    <Card variant="elevated" spotlight className="h-full p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {title}
          </p>
          {isLoading ? (
            <div className="skeleton h-9 w-20 rounded-md" />
          ) : (
            <div className="flex items-baseline gap-2">
              <p className={cn("text-display text-[2rem] mono-tabular", s.icon)}>
                {typeof value === "number" ? <NumberTicker value={value} /> : value}
              </p>
              {trend && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-xs px-1.5 py-0.5 text-[0.625rem] font-bold",
                    trend === "up"
                      ? "bg-[var(--color-status-ok-muted)] text-[var(--color-status-ok)]"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {trend === "up" ? (
                    <>
                      <ArrowUpRight className="h-3 w-3" />
                      UP
                    </>
                  ) : (
                    "—"
                  )}
                </span>
              )}
            </div>
          )}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md ring-1", s.iconBg)}>
          <Icon className={cn("h-5 w-5", s.icon)} />
        </div>
      </div>
    </Card>
  );

  return to ? (
    <motion.div variants={statItemVariants}>
      <Link to={to} className="block cursor-pointer">
        {content}
      </Link>
    </motion.div>
  ) : (
    <motion.div variants={statItemVariants}>{content}</motion.div>
  );
}

export interface DashboardStatsData {
  companies?: number;
  factories?: number;
  activeEmployees?: number;
  totalContracts?: number;
  activeContracts?: number;
  expiringInDays?: number;
}

/* ── Dashboard Hero ── */
export function DashboardHeader() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.section
      variants={heroVariants}
      initial={shouldReduceMotion ? undefined : "hidden"}
      animate={shouldReduceMotion ? undefined : "visible"}
      className="relative"
    >
      <Card variant="hero" className="relative overflow-hidden p-8 md:p-10">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.4fr_0.9fr] lg:items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2">
              <Badge size="sm" variant="default" dot pulse>
                LIVE OVERVIEW
              </Badge>
              <Badge size="sm" variant="secondary">v26.3.31</Badge>
            </div>

            <div className="space-y-3">
              <h1 className="text-display text-4xl md:text-6xl tracking-[-0.04em]">
                <span className="block text-muted-foreground text-sm font-mono uppercase tracking-[0.2em] mb-2">
                  UNS Dispatch Control
                </span>
                <span className="bg-[linear-gradient(135deg,var(--color-primary),var(--color-accent))] bg-clip-text text-transparent">
                  ダッシュボード
                </span>
              </h1>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                契約期限・社員配属・アラートを横断して、今動くべき項目を一画面で把握します。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link to="/contracts/new">
                <Button>
                  <Sparkles className="h-4 w-4" />
                  新規契約を作成
                </Button>
              </Link>
              <Link to="/documents">
                <Button variant="outline">
                  <FileText className="h-4 w-4" />
                  書類出力へ
                </Button>
              </Link>
            </div>
          </div>

          {/* Right column: Today's focus */}
          <div className="relative hidden lg:block">
            <div className="space-y-3">
              <FocusLine label="System" value="監視・出力・台帳フロー稼働中" tone="ok" />
              <FocusLine label="Focus" value="期限アラートと契約更新を優先" tone="info" />
              <FocusLine label="Today" value="ライン単位の運用状態を即確認" tone="warning" />
            </div>
          </div>
        </div>
      </Card>
    </motion.section>
  );
}

function FocusLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "info" | "warning";
}) {
  const dotClass =
    tone === "ok"
      ? "text-[var(--color-status-ok)]"
      : tone === "info"
        ? "text-[var(--color-status-info)]"
        : "text-[var(--color-status-warning)]";
  return (
    <div className="flex items-center gap-3 rounded-md border border-border/50 bg-card/60 px-4 py-3 backdrop-blur-sm">
      <span className={cn("live-dot", dotClass)} />
      <div className="min-w-0 flex-1">
        <p className="text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-xs font-medium text-foreground/90">{value}</p>
      </div>
    </div>
  );
}

/* ── Dashboard Stats Grid ── */
export function DashboardStats({
  stats,
  isLoading,
  conflictWarningDays,
}: {
  stats: DashboardStatsData | undefined;
  isLoading: boolean;
  conflictWarningDays: number;
}) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      variants={statGridVariants}
      initial={shouldReduceMotion ? undefined : "hidden"}
      animate={shouldReduceMotion ? undefined : "visible"}
      className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6"
    >
      <StatCard
        title="派遣社員"
        value={stats?.activeEmployees ?? 0}
        icon={Users}
        accent="primary"
        isLoading={isLoading}
        to="/employees"
        trend="up"
      />
      <StatCard
        title="有効契約"
        value={stats?.activeContracts ?? 0}
        icon={TrendingUp}
        accent="accent"
        isLoading={isLoading}
        to="/contracts"
        trend="up"
      />
      <StatCard
        title={`期限 ${conflictWarningDays}日以内`}
        value={stats?.expiringInDays ?? 0}
        icon={AlertTriangle}
        accent="warning"
        isLoading={isLoading}
        to="/contracts"
      />
      <StatCard
        title="派遣先企業"
        value={stats?.companies ?? 0}
        icon={Building2}
        accent="neutral"
        isLoading={isLoading}
        to="/companies"
        trend="stable"
      />
      <StatCard
        title="工場・ライン"
        value={stats?.factories ?? 0}
        icon={Factory}
        accent="neutral"
        isLoading={isLoading}
        to="/companies"
        trend="stable"
      />
      <StatCard
        title="契約総数"
        value={stats?.totalContracts ?? 0}
        icon={FileText}
        accent="primary"
        isLoading={isLoading}
        to="/contracts"
        trend="up"
      />
    </motion.div>
  );
}

export { AnimatedPage };
