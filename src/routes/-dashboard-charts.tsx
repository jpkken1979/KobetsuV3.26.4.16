import { NumberTicker } from "@/components/ui/animated";
import type { CompanyStat, NationalityStat } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CHART_COLORS } from "@/lib/chart-colors";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Building2,
  FileOutput,
  FileText,
  Loader2,
  TrendingUp,
  Upload,
  Users,
  Users2,
  Zap,
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

export function DashboardCharts({
  byCompanyData,
  loadingByCompany,
  errorByCompany,
  nationalityData,
  loadingNationality,
  errorNationality,
  activeEmployees,
}: {
  byCompanyData: CompanyStat[] | undefined;
  loadingByCompany: boolean;
  errorByCompany?: boolean;
  nationalityData: NationalityStat[] | undefined;
  loadingNationality: boolean;
  errorNationality?: boolean;
  activeEmployees: number;
}) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* By Company Chart */}
      <motion.div
        initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
        whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-2xl border border-border/40 bg-card p-6 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold tracking-tight">
              派遣先別社員比率
            </h2>
            <p className="text-[11px] font-medium text-muted-foreground">
              上位10社
            </p>
          </div>
          <div className="rounded-full bg-primary/10 p-2">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
        </div>
        {loadingByCompany ? (
          <div className="flex h-[200px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
          </div>
        ) : errorByCompany ? (
          <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-destructive/60">
            <Building2 className="h-8 w-8" />
            <p className="text-xs font-semibold">データ読み込みエラー</p>
          </div>
        ) : !byCompanyData?.length ? (
          <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground/40">
            <Building2 className="h-8 w-8" />
            <p className="text-xs font-semibold">データなし</p>
          </div>
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCompanyData?.slice(0, 10)}>
                <XAxis
                  dataKey="companyShortName"
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
                  formatter={(value) => [`${value}名`, "社員数"]}
                />
                <Bar
                  dataKey="total"
                  fill="var(--color-primary)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>

      {/* Nationality distribution — donut with center total */}
      <motion.div
        initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
        whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-2xl border border-border/40 bg-card p-6 shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold tracking-tight">国籍分布</h2>
            <p className="text-[11px] font-medium text-muted-foreground">
              在籍社員内訳
            </p>
          </div>
          <div className="rounded-full bg-secondary/10 p-2">
            <Users className="h-4 w-4 text-secondary" />
          </div>
        </div>
        {loadingNationality ? (
          <div className="flex h-[200px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/30" />
          </div>
        ) : errorNationality ? (
          <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-destructive/60">
            <Users2 className="h-8 w-8" />
            <p className="text-xs font-semibold">データ読み込みエラー</p>
          </div>
        ) : !nationalityData?.length ? (
          <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-muted-foreground/40">
            <Users2 className="h-8 w-8" />
            <p className="text-xs font-semibold">データなし</p>
          </div>
        ) : (
          <div className="flex h-[220px] flex-col items-center justify-center sm:flex-row">
            <div className="relative h-full flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={nationalityData}
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={6}
                    dataKey="count"
                    nameKey="nationality"
                    stroke="none"
                  >
                    {(nationalityData || []).map(
                      (_: NationalityStat, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ),
                    )}
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
              {/* Center Content — total count */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[11px] font-medium text-muted-foreground/60">
                  合計
                </span>
                <span className="text-2xl font-bold tabular-nums">
                  <NumberTicker value={activeEmployees} />
                </span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 sm:mt-0 sm:max-h-[200px] sm:w-1/3 sm:flex-col sm:justify-start sm:overflow-y-auto">
              {(nationalityData || []).map(
                (item: NationalityStat, index: number) => (
                  <div key={item.nationality} className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                      }}
                    />
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {item.nationality}
                    </span>
                    <span className="ml-auto text-[11px] font-bold tabular-nums">
                      {item.count}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export function DashboardQuickActions() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 20 }}
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="rounded-2xl border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]"
    >
      <div className="mb-6 flex items-center gap-3">
        <Zap className="h-5 w-5 text-primary" />
        <h2 className="text-base font-bold tracking-tight">クイック操作</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            {
              to: "/contracts/new" as const,
              icon: FileText,
              bgColor: "bg-blue-600 shadow-blue-500/30",
              label: "新規契約作成",
              desc: "契約ウィザード",
            },
            {
              to: "/employees" as const,
              icon: Users,
              bgColor: "bg-emerald-600 shadow-emerald-500/30",
              label: "社員管理",
              desc: "社員一覧",
            },
            {
              to: "/documents" as const,
              icon: FileOutput,
              bgColor: "bg-blue-600 shadow-blue-500/30",
              label: "書類出力",
              desc: "PDF生成",
            },
            {
              to: "/import" as const,
              icon: Upload,
              bgColor: "bg-blue-700 shadow-blue-500/30",
              label: "データ同期",
              desc: "Excel取込",
            },
          ] as const
        ).map(({ to, icon: Icon, bgColor, label, desc }) => (
          <Link
            key={to}
            to={to}
            className="group flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-muted/10 p-4 text-center transition-all duration-200 hover:border-primary/30 hover:bg-card hover:shadow-sm"
          >
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:scale-105",
                bgColor,
              )}
            >
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="space-y-0.5">
              <span className="block text-xs font-bold tracking-tight">
                {label}
              </span>
              <span className="block text-[10px] font-medium text-muted-foreground/70">
                {desc}
              </span>
            </div>
            <div className="rounded-full bg-muted/60 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              <ArrowRight className="h-3 w-3 text-primary" />
            </div>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
