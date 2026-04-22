import { NumberTicker } from "@/components/ui/animated";
import { Card } from "@/components/ui/card";
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
  Upload,
  Users,
  Users2,
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
  borderRadius: "8px",
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-card)",
  backdropFilter: "blur(12px)",
  boxShadow: "var(--shadow-md)",
  fontSize: "11px",
  fontWeight: "600",
  color: "var(--color-foreground)",
  padding: "8px 12px",
};

const chartCardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.5, 0, 0, 1] as [number, number, number, number] },
  },
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
      >
        <Card variant="elevated" spotlight className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-display text-base font-bold tracking-tight">
                派遣先別社員比率
              </h2>
              <p className="text-[11px] font-medium text-muted-foreground">
                上位10社 · リアルタイム分布
              </p>
            </div>
          </div>
          {loadingByCompany ? (
            <div className="flex h-[220px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
            </div>
          ) : errorByCompany ? (
            <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-[var(--color-status-error)]/60">
              <Building2 className="h-8 w-8" />
              <p className="text-xs font-semibold">データ読み込みエラー</p>
            </div>
          ) : !byCompanyData?.length ? (
            <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-muted-foreground/40">
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
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    angle={-25}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <Tooltip
                    cursor={{ fill: "color-mix(in srgb, var(--color-primary) 6%, transparent)", radius: 4 }}
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => [`${value}名`, "社員数"]}
                  />
                  <Bar
                    dataKey="total"
                    fill="var(--color-chart-1)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Nationality donut */}
      <motion.div
        variants={chartCardVariants}
        initial={shouldReduceMotion ? undefined : "hidden"}
        whileInView={shouldReduceMotion ? undefined : "visible"}
        viewport={{ once: true }}
      >
        <Card variant="elevated" spotlight className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-display text-base font-bold tracking-tight">国籍分布</h2>
              <p className="text-[11px] font-medium text-muted-foreground">
                在籍社員内訳
              </p>
            </div>
          </div>
          {loadingNationality ? (
            <div className="flex h-[220px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
            </div>
          ) : errorNationality ? (
            <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-[var(--color-status-error)]/60">
              <Users2 className="h-8 w-8" />
              <p className="text-xs font-semibold">データ読み込みエラー</p>
            </div>
          ) : !nationalityData?.length ? (
            <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-muted-foreground/40">
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
                      innerRadius={58}
                      outerRadius={88}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="nationality"
                      stroke="none"
                    >
                      {(nationalityData || []).map((_: NationalityStat, index: number) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(value, name) => [`${value}名`, String(name)]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[0.625rem] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    合計
                  </span>
                  <span className="text-display text-3xl mono-tabular">
                    <NumberTicker value={activeEmployees} />
                  </span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 sm:mt-0 sm:max-h-[200px] sm:w-1/3 sm:flex-col sm:justify-start sm:overflow-y-auto">
                {(nationalityData || []).map((item: NationalityStat, index: number) => (
                  <div key={item.nationality} className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="text-[0.6875rem] font-medium text-muted-foreground">
                      {item.nationality}
                    </span>
                    <span className="ml-auto text-[0.6875rem] font-bold mono-tabular">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}

/* ── Quick Actions ── */
export function DashboardQuickActions() {
  const shouldReduceMotion = useReducedMotion();
  const actions = [
    {
      to: "/contracts/new" as const,
      icon: FileText,
      title: "新規契約作成",
      desc: "ウィザードからライン単位で契約を起票",
    },
    {
      to: "/documents" as const,
      icon: FileOutput,
      title: "書類出力",
      desc: "個別契約書・通知書・台帳をまとめて生成",
    },
    {
      to: "/employees" as const,
      icon: Users,
      title: "社員管理",
      desc: "在籍・配属・国籍データを横断で確認",
    },
    {
      to: "/import" as const,
      icon: Upload,
      title: "データ同期",
      desc: "Excel取込と差分反映をまとめて実行",
    },
  ] as const;

  return (
    <motion.div
      variants={chartCardVariants}
      initial={shouldReduceMotion ? undefined : "hidden"}
      whileInView={shouldReduceMotion ? undefined : "visible"}
      viewport={{ once: true }}
    >
      <Card variant="default" className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-display text-base font-bold tracking-tight">クイック操作</h2>
            <p className="text-[11px] font-medium text-muted-foreground">よく使う操作へ直接ジャンプ</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {actions.map(({ to, icon: Icon, title, desc }) => (
            <Link key={to} to={to} className="group">
              <Card
                variant="elevated"
                className={cn(
                  "shine-hover relative h-full cursor-pointer overflow-hidden p-4",
                  "hover:border-[color-mix(in_srgb,var(--color-primary)_40%,var(--color-border))]",
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--color-primary)_25%,transparent)]">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/60 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <div className="mt-4 space-y-1">
                  <p className="text-display text-sm font-semibold tracking-tight">{title}</p>
                  <p className="text-[0.6875rem] leading-4 text-muted-foreground">{desc}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}
