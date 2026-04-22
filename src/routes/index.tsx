import { Button } from "@/components/ui/button";
import { ChartSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { getAppSettings } from "@/lib/app-settings";
import { queryKeys } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { DashboardAlerts } from "./-dashboard-alerts";
import { Suspense, lazy } from "react";
import { AnimatedPage, DashboardHeader, DashboardStats } from "./-dashboard-stats";
import type { CompanyStat, NationalityStat } from "@/lib/api";

const DashboardChartsLazy = lazy(async () => {
  const mod = await import("./-dashboard-charts");
  return { default: mod.DashboardCharts };
});

const DashboardQuickActionsLazy = lazy(async () => {
  const mod = await import("./-dashboard-charts");
  return { default: mod.DashboardQuickActions };
});

export const Route = createFileRoute("/")({
  component: Dashboard,
  errorComponent: ({ reset }) => (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <p className="text-display text-lg font-semibold text-destructive">エラーが発生しました</p>
      <Button variant="outline" onClick={reset}>再試行</Button>
    </div>
  ),
  pendingComponent: () => (
    <div className="relative space-y-8 pb-12">
      <div className="h-12 w-48 animate-pulse rounded-md bg-muted/40" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="relative overflow-hidden rounded-lg border border-border/60 bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-2">
                <div className="h-3 w-20 animate-pulse rounded bg-muted/40" />
                <div className="h-9 w-16 animate-pulse rounded bg-muted/40" />
              </div>
              <div className="h-10 w-10 animate-pulse rounded-md bg-muted/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  ),
});

function Dashboard() {
  const { conflictWarningDays } = getAppSettings();

  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.dashboard.stats(conflictWarningDays),
    queryFn: () => api.getDashboardStats(conflictWarningDays),
  });

  const { data: expiring = [], isLoading: loadingExpiring } = useQuery({
    queryKey: queryKeys.dashboard.expiring(conflictWarningDays),
    queryFn: () => api.getExpiringContracts(conflictWarningDays),
  });

  const { data: teishokubi = [], isLoading: loadingTeishokubi } = useQuery({
    queryKey: queryKeys.dashboard.teishokubi(conflictWarningDays),
    queryFn: () => api.getTeishokubiAlerts(conflictWarningDays),
  });

  const { data: visaExpiry = [], isLoading: loadingVisa } = useQuery({
    queryKey: queryKeys.dashboard.visaExpiry,
    queryFn: api.getVisaExpiryAlerts,
  });

  const { data: nationalityData, isLoading: loadingNationality, isError: errorNationality } = useQuery({
    queryKey: queryKeys.dashboard.nationality,
    queryFn: api.getNationalityStats,
  });

  const { data: byCompanyData, isLoading: loadingByCompany, isError: errorByCompany } = useQuery({
    queryKey: queryKeys.dashboard.byCompany,
    queryFn: api.getByCompanyStats,
  });

  const chartFallback = <ChartSkeleton />;

  return (
    <AnimatedPage className="relative space-y-8 pb-12">
      <DashboardHeader />

      {/* Alerts */}
      <section aria-label="アラート">
        <DashboardAlerts
          teishokubi={teishokubi}
          loadingTeishokubi={loadingTeishokubi}
          expiring={expiring}
          loadingExpiring={loadingExpiring}
          visaExpiry={visaExpiry}
          loadingVisa={loadingVisa}
        />
      </section>

      {/* Stats overview */}
      <section aria-label="ステータス概要">
        <DashboardStats
          stats={stats}
          isLoading={isLoading}
          conflictWarningDays={conflictWarningDays}
        />
      </section>

      <div className="sep-fade" />

      {/* Charts + Quick Actions */}
      <section aria-label="分析データ" className="space-y-4">
        <Suspense fallback={chartFallback}>
          <DashboardChartsLazy
            byCompanyData={byCompanyData as CompanyStat[] | undefined}
            loadingByCompany={loadingByCompany}
            errorByCompany={errorByCompany}
            nationalityData={nationalityData as NationalityStat[] | undefined}
            loadingNationality={loadingNationality}
            errorNationality={errorNationality}
            activeEmployees={stats?.activeEmployees ?? 0}
          />
        </Suspense>

        <Suspense
          fallback={
            <div className="rounded-lg border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="space-y-3">
                <div className="h-4 w-32 animate-pulse rounded bg-muted/40" />
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded-md bg-muted/40" />
                  ))}
                </div>
              </div>
            </div>
          }
        >
          <DashboardQuickActionsLazy />
        </Suspense>
      </section>
    </AnimatedPage>
  );
}
