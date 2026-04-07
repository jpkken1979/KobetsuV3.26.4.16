import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { getAppSettings } from "@/lib/app-settings";
import { queryKeys } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
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
      <p className="text-lg font-semibold text-destructive">エラーが発生しました</p>
      <Button variant="outline" onClick={reset}>再試行</Button>
    </div>
  ),
  pendingComponent: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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

  const chartFallback = (
    <div className="flex h-[220px] items-center justify-center rounded-2xl border border-border/40 bg-card p-6 shadow-lg">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
    </div>
  );

  return (
    <AnimatedPage className="relative space-y-8 pb-12">
      <DashboardHeader />

      {/* Alerts FIRST — what needs attention right now */}
      <section aria-label="アラート" className="relative z-10">
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

      <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />

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
            <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
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
