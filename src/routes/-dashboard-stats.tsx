import { AnimatedPage, GradientText, NumberTicker } from "@/components/ui/animated";
import { SpotlightPanel } from "./-dashboard-effects";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  Factory,
  FileText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import type React from "react";

const heroVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" as const },
  },
};

const statGridVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.04 },
  },
};

function DashboardSignal({
  icon: Icon,
  label,
  value,
  tone = "default",
  isLoading = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
  isLoading?: boolean;
}) {
  return (
    <SpotlightPanel
      tone={tone === "warning" ? "amber" : tone === "success" ? "emerald" : "cyan"}
      spotlightSize={180}
      className={cn(
        "rounded-2xl px-4 py-3 shadow-[var(--shadow-card)]",
        tone === "success" && "border-primary/20 bg-primary/5",
        tone === "warning" && "border-amber-500/20 bg-amber-500/5",
        tone === "default" && "border-border/60 bg-card/90",
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl",
            tone === "success" && "bg-primary/10 text-primary",
            tone === "warning" && "bg-amber-500/10 text-amber-500",
            tone === "default" && "bg-muted/70 text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
      </div>
      {isLoading ? (
        <div className="skeleton h-6 w-24 rounded-lg" />
      ) : (
        <p className="text-sm font-semibold text-foreground">{value}</p>
      )}
    </SpotlightPanel>
  );
}

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
    <SpotlightPanel
      tone={
        color.includes("red")
          ? "rose"
          : color.includes("emerald")
            ? "emerald"
            : "cyan"
      }
      spotlightSize={220}
      className={cn(
        "rounded-3xl bg-gradient-to-br p-4",
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
                      ? "bg-primary/10 text-primary"
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
      <div className="relative mt-4 flex items-center justify-between text-[11px] font-medium text-muted-foreground/80">
        <span className="rounded-full border border-white/10 bg-background/40 px-2.5 py-1 backdrop-blur-sm">
          Live overview
        </span>
        <span className="inline-flex items-center gap-1">
          Deep focus
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </span>
      </div>
    </SpotlightPanel>
  );

  return (
    <motion.div
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? undefined : { duration: 0.35, delay }}
      whileHover={shouldReduceMotion ? undefined : { scale: 1.02, y: -2 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
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
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.section
      variants={heroVariants}
      initial={shouldReduceMotion ? undefined : "hidden"}
      animate={shouldReduceMotion ? undefined : "visible"}
      className="relative"
    >
      <SpotlightPanel tone="emerald" spotlightSize={320} className="p-6 md:p-8">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-70 dark:via-white/20" />
        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_0.9fr] lg:items-end">
          <div className="space-y-5">
            <PageHeader
              title="ダッシュボード"
              subtitle="契約・社員・アラートを横断して、今動くべき項目を一画面で把握できます。"
              tag="OVERVIEW"
              className="gap-3"
            >
              <span className="rounded-full border border-primary/15 bg-primary/8 px-3 py-1 text-[10px] font-bold tracking-[0.18em] text-primary shadow-xs">
                v26.3.31
              </span>
            </PageHeader>

            <div className="space-y-3">
              <p className="max-w-3xl text-3xl font-black tracking-tight text-foreground md:text-4xl">
                <GradientText from="var(--color-primary)" to="var(--color-cyan-hi)">
                  UNS dispatch command center
                </GradientText>
              </p>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                ライン単位の運用、契約期限、社員分布、PDF出力までをまとめて監視するための
                オペレーションビューです。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Contract flow", value: "Wizard / batch / renew" },
                { label: "Document layer", value: "PDF bundle & ledgers" },
                { label: "Alert mesh", value: "Expiry / visa / conflict" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-background/35 px-4 py-3 backdrop-blur-md"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground/90">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/contracts/new"
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-card)] transition-transform hover:-translate-y-0.5"
              >
                <Sparkles className="h-4 w-4" />
                新規契約を作成
              </Link>
              <Link
                to="/documents"
                className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-background/70 px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/30 hover:bg-card"
              >
                <FileText className="h-4 w-4 text-primary" />
                書類出力へ移動
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <DashboardSignal
              icon={ShieldCheck}
              label="System"
              value="監視・出力・台帳フロー稼働中"
              tone="success"
            />
            <DashboardSignal
              icon={Activity}
              label="Focus"
              value="期限アラートと契約更新を優先"
            />
            <DashboardSignal
              icon={CalendarClock}
              label="Today"
              value="ライン単位の運用状態を即確認"
              tone="warning"
            />
          </div>
        </div>
      </SpotlightPanel>
    </motion.section>
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
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      variants={statGridVariants}
      initial={shouldReduceMotion ? undefined : "hidden"}
      animate={shouldReduceMotion ? undefined : "visible"}
      className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12"
    >
      <div className="md:col-span-1 xl:col-span-4">
        <StatCard
          title="派遣社員"
          value={stats?.activeEmployees ?? 0}
          icon={Users}
          color="text-emerald-500 dark:text-emerald-400"
          gradientFrom="from-emerald-500/8"
          gradientTo="to-background"
          isLoading={isLoading}
          to="/employees"
          delay={0.05}
          trend="up"
        />
      </div>
      <div className="md:col-span-1 xl:col-span-4">
        <StatCard
          title="有効契約"
          value={stats?.activeContracts ?? 0}
          icon={TrendingUp}
          color="text-blue-500 dark:text-blue-400"
          gradientFrom="from-blue-500/8"
          gradientTo="to-background"
          isLoading={isLoading}
          to="/contracts"
          delay={0.08}
          trend="up"
        />
      </div>
      <div className="md:col-span-2 xl:col-span-4">
        <StatCard
          title={`期限 ${conflictWarningDays}日以内`}
          value={stats?.expiringInDays ?? 0}
          icon={AlertTriangle}
          color="text-red-500 dark:text-red-400"
          gradientFrom="from-red-500/10"
          gradientTo="to-background"
          isLoading={isLoading}
          to="/contracts"
          delay={0.11}
        />
      </div>
      <div className="md:col-span-1 xl:col-span-3">
        <StatCard
          title="派遣先企業"
          value={stats?.companies ?? 0}
          icon={Building2}
          color="text-cyan-500 dark:text-cyan-400"
          gradientFrom="from-cyan-500/8"
          gradientTo="to-background"
          isLoading={isLoading}
          to="/companies"
          delay={0.14}
          trend="stable"
        />
      </div>
      <div className="md:col-span-1 xl:col-span-3">
        <StatCard
          title="工場・ライン"
          value={stats?.factories ?? 0}
          icon={Factory}
          color="text-cyan-500 dark:text-cyan-400"
          gradientFrom="from-cyan-500/8"
          gradientTo="to-background"
          isLoading={isLoading}
          to="/companies"
          delay={0.17}
          trend="stable"
        />
      </div>
      <div className="md:col-span-2 xl:col-span-6">
        <StatCard
          title="契約総数"
          value={stats?.totalContracts ?? 0}
          icon={FileText}
          color="text-cyan-500 dark:text-cyan-400"
          gradientFrom="from-primary/8"
          gradientTo="to-background"
          isLoading={isLoading}
          to="/contracts"
          delay={0.2}
          trend="up"
        />
      </div>
    </motion.div>
  );
}

export { AnimatedPage };
