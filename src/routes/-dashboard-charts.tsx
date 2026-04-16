import { NumberTicker } from "@/components/ui/animated";
import type { CompanyStat, NationalityStat } from "@/lib/api";
import { SpotlightPanel } from "./-dashboard-effects";
import { cn } from "@/lib/utils";
import { CHART_COLORS } from "@/lib/chart-colors";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Building2,
  Command,
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

const chartCardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
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
        variants={chartCardVariants}
        initial={shouldReduceMotion ? undefined : "hidden"}
        whileInView={shouldReduceMotion ? undefined : "visible"}
        viewport={{ once: true }}
        className="relative"
      >
        <SpotlightPanel tone="amber" spotlightSize={260} className="p-6">
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
          <div className="relative">
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
          </div>
          <div className="mt-4 flex items-center justify-between text-[11px] font-medium text-muted-foreground/80">
            <span className="rounded-full border border-white/10 bg-background/35 px-2.5 py-1">
              Ratio map
            </span>
            <span>Realtime distribution</span>
          </div>
        </SpotlightPanel>
      </motion.div>

      {/* Nationality distribution — donut with center total */}
      <motion.div
        variants={chartCardVariants}
        initial={shouldReduceMotion ? undefined : "hidden"}
        whileInView={shouldReduceMotion ? undefined : "visible"}
        viewport={{ once: true }}
        className="relative"
      >
        <SpotlightPanel tone="rose" spotlightSize={260} className="p-6">
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
          <div className="relative">
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
          </div>
          <div className="mt-4 flex items-center justify-between text-[11px] font-medium text-muted-foreground/80">
            <span className="rounded-full border border-white/10 bg-background/35 px-2.5 py-1">
              Identity view
            </span>
            <span>Breakdown by nationality</span>
          </div>
        </SpotlightPanel>
      </motion.div>
    </div>
  );
}

export function DashboardQuickActions() {
  const shouldReduceMotion = useReducedMotion();
  const actions = [
    {
      to: "/contracts/new" as const,
      icon: FileText,
      title: "新規契約作成",
      desc: "ウィザードからライン単位で契約を起票",
      badge: "CREATE",
      accent: "from-primary/18 to-accent/6",
      iconClass: "bg-primary shadow-primary/30",
      tone: "rose",
      className: "xl:col-span-5",
    },
    {
      to: "/documents" as const,
      icon: FileOutput,
      title: "書類出力",
      desc: "個別契約書・通知書・台帳をまとめて生成",
      badge: "PDF",
      accent: "from-amber-500/18 to-primary/6",
      iconClass: "bg-accent shadow-amber-500/30",
      tone: "amber",
      className: "xl:col-span-4",
    },
    {
      to: "/employees" as const,
      icon: Users,
      title: "社員管理",
      desc: "在籍・配属・国籍データを横断で確認",
      badge: "STAFF",
      accent: "from-foreground/12 to-background",
      iconClass: "bg-foreground shadow-black/20",
      tone: "amber",
      className: "xl:col-span-3",
    },
    {
      to: "/import" as const,
      icon: Upload,
      title: "データ同期",
      desc: "Excel取込と差分反映をまとめて実行",
      badge: "SYNC",
      accent: "from-amber-500/18 to-background",
      iconClass: "bg-accent shadow-amber-500/30",
      tone: "amber",
      className: "xl:col-span-12",
    },
  ] as const;

  return (
    <motion.div
      variants={chartCardVariants}
      initial={shouldReduceMotion ? undefined : "hidden"}
      whileInView={shouldReduceMotion ? undefined : "visible"}
      viewport={{ once: true }}
      className="relative"
    >
      <SpotlightPanel tone="amber" spotlightSize={300} className="p-6">
        <div className="mb-6 flex items-center gap-3">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="text-base font-bold tracking-tight">クイック操作</h2>
          <span className="rounded-full border border-primary/15 bg-primary/8 px-2.5 py-1 text-[10px] font-bold tracking-[0.18em] text-primary">
            COMMAND
          </span>
        </div>
        <div className="relative grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
          {actions.map(({ to, icon: Icon, iconClass, title, desc, badge, accent, tone, className }) => (
            <Link
              key={to}
              to={to}
              className={cn("block", className)}
            >
              <SpotlightPanel
                tone={tone}
                spotlightSize={220}
                className={cn(
                  "h-full rounded-3xl bg-gradient-to-br p-4 transition-all duration-300",
                  accent,
                )}
              >
                <div className="relative mb-4 flex items-center justify-between">
                  <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
                    {badge}
                  </span>
                  <Command className="h-4 w-4 text-muted-foreground/60 transition-transform duration-300 group-hover:translate-x-0.5" />
                </div>
                <div
                  className={cn(
                    "relative flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm transition-transform group-hover:scale-105",
                    iconClass,
                  )}
                >
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="relative mt-4 space-y-1 text-left">
                  <span className="block text-sm font-bold tracking-tight text-foreground">
                    {title}
                  </span>
                  <span className="block text-[11px] font-medium leading-5 text-muted-foreground/80">
                    {desc}
                  </span>
                </div>
                <div className="relative mt-5 inline-flex items-center gap-1 rounded-full bg-background/70 px-2.5 py-1 text-[11px] font-semibold text-primary opacity-80 transition-opacity group-hover:opacity-100">
                  Open
                  <ArrowRight className="h-3 w-3" />
                </div>
              </SpotlightPanel>
            </Link>
          ))}
        </div>
      </SpotlightPanel>
    </motion.div>
  );
}
