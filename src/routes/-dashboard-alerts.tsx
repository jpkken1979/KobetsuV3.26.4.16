import type {
  ExpiringContract,
  TeishokubiAlert,
  VisaExpiryAlert,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Shield,
} from "lucide-react";
import type React from "react";
import { useState } from "react";

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/* ── Shared skeleton ── */
function AlertCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border-l-4 border-l-border bg-card p-4 shadow-sm">
      <div className="skeleton h-12 w-12 rounded-xl" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-32 rounded" />
        <div className="skeleton h-3 w-48 rounded" />
      </div>
      <div className="skeleton h-10 w-10 rounded" />
    </div>
  );
}

/* ── Critical Alert Card — big, prominent, actionable ── */
function CriticalAlertCard({
  icon: Icon,
  borderColor,
  iconBg,
  iconColor,
  countColor,
  title,
  description,
  count,
  unit,
  linkTo,
  linkLabel,
  delay,
  children,
}: {
  icon: React.ElementType;
  borderColor: string;
  iconBg: string;
  iconColor: string;
  countColor: string;
  title: string;
  description: string;
  count: number;
  unit: string;
  linkTo: string;
  linkLabel: string;
  delay: number;
  children?: React.ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={shouldReduceMotion ? undefined : { opacity: 0, x: -20 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, x: 0 }}
      transition={shouldReduceMotion ? undefined : { duration: 0.4, delay }}
      className={cn(
        "flex flex-col gap-3 rounded-xl border-l-4 bg-card p-4 shadow-[var(--shadow-card)]",
        borderColor,
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            iconBg,
          )}
        >
          <Icon className={cn("h-6 w-6", iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="text-right">
          <span className={cn("text-3xl font-bold tabular-nums", countColor)}>
            {count}
          </span>
          <p className="text-[10px] text-muted-foreground">{unit}</p>
        </div>
        <Link
          to={linkTo}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80",
            iconBg,
            iconColor,
          )}
        >
          {linkLabel} <ArrowRight className="ml-1 inline h-3 w-3" />
        </Link>
      </div>
      {children}
    </motion.div>
  );
}

/* ── Expiring contracts — top items preview ── */
function ExpiringContractsList({ data }: { data: ExpiringContract[] }) {
  if (data.length === 0)
    return (
      <div className="mt-1 border-t border-border/40 pt-3">
        <p className="text-center text-sm text-muted-foreground">
          該当する契約はありません
        </p>
      </div>
    );
  return (
    <div className="mt-1 space-y-1.5 border-t border-border/40 pt-3">
      {data.slice(0, 3).map((c) => {
        const days = daysUntil(c.endDate);
        return (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs"
          >
            <span className="max-w-[8rem] truncate font-mono font-semibold text-foreground/80">
              {c.contractNumber}
            </span>
            <span className="mx-2 max-w-[8rem] truncate text-muted-foreground">
              {c.company?.name}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 font-bold tabular-nums",
                days <= 7
                  ? "bg-red-500/15 text-red-500"
                  : "bg-amber-500/15 text-amber-500",
              )}
            >
              {days}日
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Teishokubi top items preview ── */
function TeishokubiList({ data }: { data: TeishokubiAlert[] }) {
  if (data.length === 0)
    return (
      <div className="mt-1 border-t border-border/40 pt-3">
        <p className="text-center text-sm text-muted-foreground">
          該当する工場はありません
        </p>
      </div>
    );
  return (
    <div className="mt-1 space-y-1.5 border-t border-border/40 pt-3">
      {data.slice(0, 3).map((f) => {
        const days = daysUntil(f.conflictDate);
        return (
          <div
            key={f.id}
            className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs"
          >
            <span className="max-w-[10rem] truncate font-semibold text-foreground/80">
              {f.company?.name}
            </span>
            <span className="mx-2 max-w-[8rem] truncate text-muted-foreground">
              {f.department} {f.lineName}
            </span>
            <span className="shrink-0 rounded-full bg-red-500/15 px-2 py-0.5 font-bold tabular-nums text-red-500">
              {days}日
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Info Alert — collapsible, smaller ── */
function InfoAlertCard({
  icon: Icon,
  title,
  description,
  count,
  unit,
  linkTo,
  linkLabel,
  delay,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  count: number;
  unit: string;
  linkTo: string;
  linkLabel: string;
  delay: number;
  children?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? undefined : { opacity: 0, x: -20 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, x: 0 }}
      transition={shouldReduceMotion ? undefined : { duration: 0.4, delay }}
      className="rounded-xl border-l-4 border-l-primary bg-card p-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
        <span className="text-2xl font-bold tabular-nums text-primary">
          {count}
        </span>
        <span className="text-[10px] text-muted-foreground">{unit}</span>
        <Link
          to={linkTo}
          className="shrink-0 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
        >
          {linkLabel}
        </Link>
        {children && count > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/50"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </button>
        )}
      </div>
      <AnimatePresence>
        {expanded && children && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
            animate={shouldReduceMotion ? undefined : { height: "auto", opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={shouldReduceMotion ? undefined : { duration: 0.2 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── All Clear State ── */
function AllClearState() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, scale: 1 }}
      transition={shouldReduceMotion ? undefined : { duration: 0.4, delay: 0.1 }}
      className="flex items-center gap-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">問題なし</p>
        <p className="text-xs text-muted-foreground">
          現在、注意が必要なアラートはありません
        </p>
      </div>
    </motion.div>
  );
}

/* ── Main Export ── */
export function DashboardAlerts({
  teishokubi,
  loadingTeishokubi,
  expiring,
  loadingExpiring,
  visaExpiry,
  loadingVisa,
}: {
  teishokubi: TeishokubiAlert[];
  loadingTeishokubi: boolean;
  expiring: ExpiringContract[];
  loadingExpiring: boolean;
  visaExpiry: VisaExpiryAlert[];
  loadingVisa: boolean;
}) {
  const isLoading = loadingTeishokubi || loadingExpiring || loadingVisa;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <AlertCardSkeleton />
        <AlertCardSkeleton />
        <AlertCardSkeleton />
      </div>
    );
  }

  const hasExpiring = expiring.length > 0;
  const hasTeishokubi = teishokubi.length > 0;
  const hasVisa = visaExpiry.length > 0;
  const hasCritical = hasExpiring || hasTeishokubi;
  const hasAny = hasCritical || hasVisa;

  if (!hasAny) {
    return <AllClearState />;
  }

  // Split expiring into urgent (<=7 days) and upcoming
  const urgentExpiring = expiring.filter((c) => daysUntil(c.endDate) <= 7);
  const upcomingExpiring = expiring.filter((c) => daysUntil(c.endDate) > 7);

  return (
    <div className="space-y-3">
      {/* Critical: contracts expiring within 7 days */}
      {urgentExpiring.length > 0 && (
        <CriticalAlertCard
          icon={AlertTriangle}
          borderColor="border-l-red-500"
          iconBg="bg-red-500/10"
          iconColor="text-red-500"
          countColor="text-red-500"
          title="契約期限切れ間近"
          description="7日以内に期限切れの契約があります"
          count={urgentExpiring.length}
          unit="件"
          linkTo="/contracts"
          linkLabel="確認"
          delay={0.05}
        >
          <ExpiringContractsList data={urgentExpiring} />
        </CriticalAlertCard>
      )}

      {/* Critical: teishokubi alerts */}
      {hasTeishokubi && (
        <CriticalAlertCard
          icon={Shield}
          borderColor="border-l-amber-500"
          iconBg="bg-amber-500/10"
          iconColor="text-amber-500"
          countColor="text-amber-500"
          title="抵触日アラート"
          description="30日以内に抵触日を迎える工場があります"
          count={teishokubi.length}
          unit="件"
          linkTo="/companies"
          linkLabel="確認"
          delay={0.1}
        >
          <TeishokubiList data={teishokubi} />
        </CriticalAlertCard>
      )}

      {/* Warning: contracts expiring beyond 7 days */}
      {upcomingExpiring.length > 0 && (
        <CriticalAlertCard
          icon={Clock}
          borderColor="border-l-amber-400"
          iconBg="bg-amber-400/10"
          iconColor="text-amber-400"
          countColor="text-amber-400"
          title="契約更新予定"
          description="期限切れが近づいている契約があります"
          count={upcomingExpiring.length}
          unit="件"
          linkTo="/contracts"
          linkLabel="確認"
          delay={0.15}
        >
          <ExpiringContractsList data={upcomingExpiring} />
        </CriticalAlertCard>
      )}

      {/* Info: visa expiry — collapsible */}
      {hasVisa && (
        <InfoAlertCard
          icon={CalendarDays}
          title="ビザ更新アラート"
          description="90日以内にビザが期限切れになる社員がいます"
          count={visaExpiry.length}
          unit="件"
          linkTo="/employees"
          linkLabel="確認"
          delay={0.2}
        >
          <div className="mt-3 space-y-1.5 border-t border-border/40 pt-3">
            {visaExpiry.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                該当する社員はいません
              </p>
            ) : (
              visaExpiry.slice(0, 5).map((e) => {
                const days = daysUntil(e.visaExpiry);
                return (
                  <div
                    key={e.id}
                    className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs"
                  >
                    <span className="max-w-[10rem] truncate font-semibold text-foreground/80">
                      {e.fullName}
                    </span>
                    <span className="mx-2 max-w-[8rem] truncate text-muted-foreground">
                      {e.company?.name || "未割当"}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 font-bold tabular-nums",
                        days <= 30
                          ? "bg-amber-500/15 text-amber-500"
                          : "bg-primary/15 text-primary",
                      )}
                    >
                      {days}日
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </InfoAlertCard>
      )}
    </div>
  );
}
