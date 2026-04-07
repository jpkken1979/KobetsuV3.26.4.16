import { AnimatedPage, NumberTicker } from "@/components/ui/animated";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Factory,
  FileText,
  TrendingUp,
  Users,
} from "lucide-react";
import type React from "react";

/* ── Stat Card ── */
function StatCard({
  title,
  value,
  icon: Icon,
  color,
  gradientFrom,
  gradientTo,
  isLoading,
  to,
  delay = 0,
  trend,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  isLoading?: boolean;
  to?: string;
  delay?: number;
  trend?: "up" | "stable";
}) {
  const shouldReduceMotion = useReducedMotion();
  const content = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-all duration-200",
        "hover:border-primary/20 hover:shadow-md",
        "bg-gradient-to-br",
        gradientFrom,
        gradientTo,
      )}
    >
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </p>
          {isLoading ? (
            <div className="skeleton h-9 w-16 rounded" />
          ) : (
            <div className="flex items-baseline gap-2">
              <p
                className={cn(
                  "text-3xl font-extrabold tabular-nums tracking-tight",
                  color,
                )}
              >
                {typeof value === "number" ? (
                  <NumberTicker value={value} />
                ) : (
                  value
                )}
              </p>
              {trend && (
                <span
                  className={cn(
                    "flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold",
                    trend === "up"
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-muted/50 text-muted-foreground",
                  )}
                >
                  {trend === "up" ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : (
                    <span className="text-[9px]">&mdash;</span>
                  )}
                </span>
              )}
            </div>
          )}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/40 ring-1 ring-border/50",
          )}
        >
          <Icon className={cn("h-5 w-5", color)} />
        </div>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? undefined : { duration: 0.35, delay }}
    >
      {to ? (
        <Link to={to} className="block cursor-pointer">
          {content}
        </Link>
      ) : (
        content
      )}
    </motion.div>
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

export function DashboardHeader() {
  return (
    <PageHeader title="ダッシュボード" tag="OVERVIEW">
      <span className="rounded-full bg-muted/60 px-3 py-1 text-[10px] font-bold tracking-wide text-muted-foreground ring-1 ring-border shadow-xs">
        v26.3.31
      </span>
    </PageHeader>
  );
}

export function DashboardStats({
  stats,
  isLoading,
  conflictWarningDays,
}: {
  stats: DashboardStatsData | undefined;
  isLoading: boolean;
  conflictWarningDays: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      <StatCard
        title="派遣先企業"
        value={stats?.companies ?? 0}
        icon={Building2}
        color="text-cyan-500 dark:text-cyan-400"
        gradientFrom="from-cyan-500/5"
        gradientTo="to-background"
        isLoading={isLoading}
        to="/companies"
        delay={0.05}
        trend="stable"
      />
      <StatCard
        title="工場・ライン"
        value={stats?.factories ?? 0}
        icon={Factory}
        color="text-cyan-500 dark:text-cyan-400"
        gradientFrom="from-cyan-500/5"
        gradientTo="to-background"
        isLoading={isLoading}
        to="/companies"
        delay={0.08}
        trend="stable"
      />
      <StatCard
        title="派遣社員"
        value={stats?.activeEmployees ?? 0}
        icon={Users}
        color="text-emerald-500 dark:text-emerald-400"
        gradientFrom="from-emerald-500/5"
        gradientTo="to-background"
        isLoading={isLoading}
        to="/employees"
        delay={0.11}
        trend="up"
      />
      <StatCard
        title="契約総数"
        value={stats?.totalContracts ?? 0}
        icon={FileText}
        color="text-cyan-500 dark:text-cyan-400"
        gradientFrom="from-cyan-500/5"
        gradientTo="to-background"
        isLoading={isLoading}
        to="/contracts"
        delay={0.14}
        trend="up"
      />
      <StatCard
        title="有効契約"
        value={stats?.activeContracts ?? 0}
        icon={TrendingUp}
        color="text-blue-500 dark:text-blue-400"
        gradientFrom="from-blue-500/5"
        gradientTo="to-background"
        isLoading={isLoading}
        to="/contracts"
        delay={0.17}
        trend="up"
      />
      <StatCard
        title={`期限 ${conflictWarningDays}日以内`}
        value={stats?.expiringInDays ?? 0}
        icon={AlertTriangle}
        color="text-red-500 dark:text-red-400"
        gradientFrom="from-red-500/5"
        gradientTo="to-background"
        isLoading={isLoading}
        to="/contracts"
        delay={0.2}
      />
    </div>
  );
}

export { AnimatedPage };
