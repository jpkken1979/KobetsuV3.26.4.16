import { AnimatedPage } from "@/components/ui/animated";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { useAdminStats } from "@/lib/hooks/use-admin-stats";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Factory,
  FileText,
  Globe,
  Loader2,
  Table2,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PIE_COLORS = [
  "#0052CC",
  "#DC143C",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
];

const STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  active: "有効",
  expired: "期限切れ",
  cancelled: "キャンセル",
  renewed: "更新済",
};

const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: "10px",
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-card)",
  backdropFilter: "blur(12px)",
  boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
  fontSize: "11px",
  fontWeight: "600",
  color: "var(--color-foreground)",
  padding: "8px 12px",
};

function StatCard({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 shadow-sm",
        className
      )}
    >
      <div className="rounded-lg bg-primary/10 p-3">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 text-sm font-semibold text-foreground">{children}</h3>
  );
}

export function StatsDashboard() {
  const { data, isLoading, error } = useAdminStats();

  if (isLoading) {
    return (
      <AnimatedPage>
        <PageHeader title="Estadísticas" subtitle="Admin Statistics Dashboard" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AnimatedPage>
    );
  }

  if (error || !data) {
    return (
      <AnimatedPage>
        <PageHeader title="Estadísticas" subtitle="Admin Statistics Dashboard" />
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-destructive">
          <AlertTriangle className="h-8 w-8" />
          <p className="text-sm font-semibold">Error loading statistics</p>
        </div>
      </AnimatedPage>
    );
  }

  // Build chart data
  const statusPieData = Object.entries(data.contractStatusDistribution).map(
    ([status, count]) => ({
      name: STATUS_LABELS[status] ?? status,
      value: count,
    })
  );

  const nationalityPieData = data.nationalityDistribution.map((item) => ({
    name: item.nationality,
    value: item.count,
  }));

  const totalEmployees =
    (data.employeeStatusDistribution["active"] ?? 0) +
    (data.employeeStatusDistribution["inactive"] ?? 0) +
    (data.employeeStatusDistribution["onLeave"] ?? 0);

  const totalContracts = Object.values(
    data.contractStatusDistribution
  ).reduce((a, b) => a + b, 0);

  return (
    <AnimatedPage>
      <PageHeader title="Estadísticas" subtitle="Admin Statistics Dashboard" />

      <div className="space-y-6">
        {/* ── Top-level summary cards ───────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={Users}
            label="社員"
            value={totalEmployees}
          />
          <StatCard
            icon={FileText}
            label="契約書"
            value={totalContracts}
          />
          <StatCard
            icon={Building2}
            label="取引先"
            value={data.counts["client_companies"] ?? 0}
          />
          <StatCard
            icon={Factory}
            label="工場・ライン"
            value={data.counts["factories"] ?? 0}
          />
        </div>

        {/* ── Secondary counts ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            icon={Users}
            label="社員 (有効)"
            value={data.employeeStatusDistribution["active"] ?? 0}
            className="border-emerald-500/20 bg-emerald-500/5"
          />
          <StatCard
            icon={FileText}
            label="契約書 (有効)"
            value={data.contractStatusDistribution["active"] ?? 0}
            className="border-blue-500/20 bg-blue-500/5"
          />
          <StatCard
            icon={Table2}
            label="契約×社員"
            value={data.counts["contract_employees"] ?? 0}
          />
          <StatCard
            icon={BarChart3}
            label="監査ログ"
            value={data.counts["audit_log"] ?? 0}
          />
        </div>

        {/* ── Charts row ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Monthly contracts bar chart */}
          <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
            <SectionTitle>契約書作成推移（過去12ヶ月）</SectionTitle>
            {data.monthlyContracts.length === 0 ? (
              <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground/40">
                <BarChart3 className="h-8 w-8" />
                <p className="text-xs font-semibold">データなし</p>
              </div>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlyContracts}>
                    <XAxis
                      dataKey="month"
                      stroke="var(--color-muted-foreground)"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      angle={-25}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis
                      stroke="var(--color-muted-foreground)"
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      width={30}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(0,82,204,0.05)", radius: 8 }}
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value) => [`${value}件`, "新規契約書"]}
                    />
                    <Bar
                      dataKey="count"
                      fill="var(--color-primary)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Contract status pie chart */}
          <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
            <SectionTitle>契約書ステータス分布</SectionTitle>
            {statusPieData.length === 0 ? (
              <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground/40">
                <FileText className="h-8 w-8" />
                <p className="text-xs font-semibold">データなし</p>
              </div>
            ) : (
              <div className="flex h-[200px] flex-col items-center sm:flex-row">
                <div className="relative h-full flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        dataKey="value"
                        nameKey="name"
                        stroke="none"
                      >
                        {statusPieData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value, name) => [`${value}件`, String(name)]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 sm:flex-col sm:justify-start sm:overflow-y-auto sm:max-h-[200px] sm:w-1/3">
                  {statusPieData.map((item, index) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            PIE_COLORS[index % PIE_COLORS.length],
                        }}
                      />
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {item.name}
                      </span>
                      <span className="ml-auto text-[11px] font-bold tabular-nums">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Tables row ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Top factories */}
          <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
            <SectionTitle>工場別社員数（Top 10）</SectionTitle>
            {data.topFactories.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                データなし
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="pb-2 pr-3 text-left font-semibold text-muted-foreground">
                        #
                      </th>
                      <th className="pb-2 pr-3 text-left font-semibold text-muted-foreground">
                        工場名
                      </th>
                      <th className="pb-2 pr-3 text-left font-semibold text-muted-foreground">
                        取引先
                      </th>
                      <th className="pb-2 text-right font-semibold text-muted-foreground">
                        社員数
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topFactories.map((factory, i) => (
                      <tr
                        key={factory.factoryId}
                        className="border-b border-border/30 last:border-0"
                      >
                        <td className="py-2 pr-3 text-muted-foreground">{i + 1}</td>
                        <td className="py-2 pr-3 font-medium">{factory.factoryName}</td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {factory.companyName}
                        </td>
                        <td className="py-2 text-right">
                          <Badge variant="secondary">{factory.employeeCount}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Nationality distribution */}
          <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
            <SectionTitle>国籍分布（Top 10）</SectionTitle>
            {data.nationalityDistribution.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                データなし
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Donut chart */}
                <div className="relative h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={nationalityPieData}
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={5}
                        dataKey="value"
                        nameKey="name"
                        stroke="none"
                      >
                        {nationalityPieData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        formatter={(value, name) => [
                          `${value}名`,
                          String(name),
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <Globe className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                </div>
                {/* Legend */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {data.nationalityDistribution.map((item, index) => (
                    <div key={item.nationality} className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor:
                            PIE_COLORS[index % PIE_COLORS.length],
                        }}
                      />
                      <span className="truncate text-[10px] font-medium text-muted-foreground">
                        {item.nationality}
                      </span>
                      <span className="ml-auto text-[11px] font-bold tabular-nums">
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Warnings section ────────────────────────────────────────── */}
        {(data.expiringContracts.length > 0 || data.nullCounts.length > 0) && (
          <div className="space-y-3">
            {/* Expiring contracts warning */}
            {data.expiringContracts.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <h3 className="text-sm font-semibold">
                    契約書期限切れ预警（90日以内）
                  </h3>
                  <Badge variant="warning">{data.expiringContracts.length}件</Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-amber-500/20">
                        <th className="pb-2 pr-3 text-left font-semibold text-amber-600 dark:text-amber-400">
                          契約書番号
                        </th>
                        <th className="pb-2 pr-3 text-left font-semibold text-amber-600 dark:text-amber-400">
                          取引先
                        </th>
                        <th className="pb-2 pr-3 text-left font-semibold text-amber-600 dark:text-amber-400">
                          工場
                        </th>
                        <th className="pb-2 text-right font-semibold text-amber-600 dark:text-amber-400">
                          期限日
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.expiringContracts.slice(0, 10).map((c) => (
                        <tr
                          key={c.contractId}
                          className="border-b border-amber-500/10 last:border-0"
                        >
                          <td className="py-1.5 pr-3 font-mono font-medium">
                            {c.contractNumber}
                          </td>
                          <td className="py-1.5 pr-3">{c.companyName}</td>
                          <td className="py-1.5 pr-3 text-muted-foreground">
                            {c.factoryName}
                          </td>
                          <td className="py-1.5 text-right">
                            <Badge variant="warning">{c.endDate}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.expiringContracts.length > 10 && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    ...他{data.expiringContracts.length - 10}件
                  </p>
                )}
              </div>
            )}

            {/* Null counts — missing data */}
            {data.nullCounts.length > 0 && (
              <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
                <SectionTitle>欠損データ（NULL値）</SectionTitle>
                <p className="mb-3 text-xs text-muted-foreground">
                  NULL値が多い列がデータ整合性の проблема を示しています
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="pb-2 pr-3 text-left font-semibold text-muted-foreground">
                          テーブル
                        </th>
                        <th className="pb-2 pr-3 text-left font-semibold text-muted-foreground">
                          列
                        </th>
                        <th className="pb-2 text-right font-semibold text-muted-foreground">
                          NULL数
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.nullCounts.slice(0, 20).map((item, i) => (
                        <tr
                          key={i}
                          className="border-b border-border/30 last:border-0"
                        >
                          <td className="py-1.5 pr-3 font-mono text-muted-foreground">
                            {item.table}
                          </td>
                          <td className="py-1.5 pr-3 font-mono">{item.column}</td>
                          <td className="py-1.5 text-right">
                            <Badge
                              variant={
                                item.nullCount > 100
                                  ? "destructive"
                                  : item.nullCount > 20
                                    ? "warning"
                                    : "secondary"
                              }
                            >
                              {item.nullCount}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.nullCounts.length > 20 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    ...他{data.nullCounts.length - 20}件
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AnimatedPage>
  );
}
