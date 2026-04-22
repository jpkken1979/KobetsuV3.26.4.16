import { AnimatedPage } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { getAppSettings, updateAppSettings } from "@/lib/app-settings";
import { queryKeys } from "@/lib/query-keys";
import { useTheme } from "@/lib/hooks/use-theme";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Database,
    Download,
    Eye,
    Factory,
    GitBranch,
    Globe,
    Info,
    Keyboard,
    Loader2,
    Server,
    Shield,
    Terminal,
    Trash2,
    Zap,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/")({
  component: SettingsPage,
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

function SettingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Estado para el diálogo de reset
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetDone, setResetDone] = useState(false);

  // Redirect con cleanup cuando el reset es exitoso
  useEffect(() => {
    if (!resetDone) return;
    const timer = setTimeout(() => void navigate({ to: "/" }), 1500);
    return () => clearTimeout(timer);
  }, [resetDone, navigate]);

  // Query de stats para mostrar conteos actuales
  const { data: dbStats } = useQuery({
    queryKey: queryKeys.dashboard.stats(),
    queryFn: () => api.getDashboardStats(),
    staleTime: 30_000,
  });

  // Mutación de reset
  const resetMutation = useMutation({
    mutationFn: () => api.resetAllData({ confirm: "RESET" }),
    onSuccess: (data) => {
      const d = data.deleted;
      toast.success(
        `Base de datos reseteada. Se borraron ${d.contracts} contratos, ${d.employees} empleados, ${d.clientCompanies} empresas.`,
      );
      void queryClient.invalidateQueries();
      setShowResetDialog(false);
      setResetConfirmText("");
      setResetDone(true);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Error al resetear la base de datos";
      toast.error(message);
    },
  });

  const { isDark, toggleTheme } = useTheme();
  const themeLabel = isDark ? "Bugatti" : "Ferrari";
  const themeDetail = isDark ? "carbon / red / gold" : "white / red / gold / carbon";
  const [backingUp, setBackingUp] = useState(false);
  const [clearingEmployees, setClearingEmployees] = useState(false);
  const [clearEmployeesOpen, setClearEmployeesOpen] = useState(false);
  const [clearEmployeesToken, setClearEmployeesToken] = useState("");
  const [calendarUpdating, setCalendarUpdating] = useState(false);
  const [conflictWarningDays, setConflictWarningDays] = useState(() => getAppSettings().conflictWarningDays);
  const [adminMode, setAdminMode] = useState(() => getAppSettings().adminMode);
  const shouldReduceMotion = useReducedMotion();

  // Holiday date ranges — persisted in appSettings (localStorage)
  const [nenmatsuFrom, setNenmatsuFrom] = useState(() => getAppSettings().nenmatsuFrom);
  const [nenmatsuTo, setNenmatsuTo] = useState(() => getAppSettings().nenmatsuTo);
  const [gwFrom, setGwFrom] = useState(() => getAppSettings().gwFrom);
  const [gwTo, setGwTo] = useState(() => getAppSettings().gwTo);
  const [obonFrom, setObonFrom] = useState(() => getAppSettings().obonFrom);
  const [obonTo, setObonTo] = useState(() => getAppSettings().obonTo);

  const calendarPreview = `土曜日・日曜日・年末年始（${nenmatsuFrom}～${nenmatsuTo}）・GW（${gwFrom}～${gwTo}）・夏季休暇（${obonFrom}～${obonTo}）`;

  const handleBulkCalendar = async () => {
    // Validate no empty fields
    const fields = [
      { label: "年末年始 開始", value: nenmatsuFrom },
      { label: "年末年始 終了", value: nenmatsuTo },
      { label: "GW 開始", value: gwFrom },
      { label: "GW 終了", value: gwTo },
      { label: "夏季休暇 開始", value: obonFrom },
      { label: "夏季休暇 終了", value: obonTo },
    ];
    const emptyField = fields.find((f) => !f.value.trim());
    if (emptyField) {
      toast.error(`入力エラー: ${emptyField.label}が空です`);
      return;
    }

    // Persist holiday dates to appSettings before applying
    updateAppSettings({ nenmatsuFrom, nenmatsuTo, gwFrom, gwTo, obonFrom, obonTo });
    try {
      setCalendarUpdating(true);
      const result = await api.bulkUpdateCalendar(calendarPreview);
      toast.success(`${result.updated} 工場のカレンダーを更新しました`, {
        description: calendarPreview,
      });
    } catch {
      toast.error("カレンダーの一括更新に失敗しました");
    } finally {
      setCalendarUpdating(false);
    }
  };

  const { data: health } = useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.getHealth(),
    staleTime: 30_000,
  });


  const handleBackup = async () => {
    try {
      setBackingUp(true);
      const data = await api.createBackup();
      toast.success("バックアップを作成しました", { description: data.filename });
    } catch {
      toast.error("バックアップに失敗しました");
    } finally {
      setBackingUp(false);
    }
  };

  const handlePurgeEmployees = async () => {
    try {
      setClearingEmployees(true);
      const data = await api.purgeEmployees();
      setClearEmployeesOpen(false);
      setClearEmployeesToken("");
      toast.success("社員テーブルをクリアしました", {
        description: `${data.deleted}件削除${data.backup ? `（backup: ${data.backup}）` : ""}`,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.dataCheck.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.factories.invalidateAll });
    } catch {
      toast.error("社員テーブルのクリアに失敗しました");
    } finally {
      setClearingEmployees(false);
    }
  };

  const applyConflictWarningDays = (days: number) => {
    const next = updateAppSettings({ conflictWarningDays: days });
    setConflictWarningDays(next.conflictWarningDays);
    toast.success(`抵触日アラートを ${next.conflictWarningDays} 日前に設定しました`);
  };

  const handleAdminModeToggle = () => {
    const next = !adminMode;
    updateAppSettings({ adminMode: next });
    setAdminMode(next);
    toast.success(next ? "デベロッパーモードを有効化しました" : "デベロッパーモードを無効化しました");
  };

  const shortcuts = [
    { keys: "Ctrl + K", action: "コマンドパレットを開く", icon: Zap },
    { keys: "Ctrl + N", action: "新規契約を作成", icon: GitBranch },
    { keys: "↑ / ↓", action: "コマンドパレット内を移動", icon: Clock },
    { keys: "Enter", action: "コマンドを実行", icon: CheckCircle2 },
    { keys: "Esc", action: "パレットを閉じる", icon: Shield },
  ];

  const systemInfo = [
    { label: "アプリケーション", value: "個別契約書管理システム", icon: Server },
    { label: "バージョン", value: health?.version || "v26.3.31", icon: GitBranch },
    { label: "企業", value: "ユニバーサル企画株式会社", icon: Globe },
    { label: "APIサーバー", value: `ポート ${health?.port || 8026}`, icon: Server },
    { label: "データベース", value: "SQLite (Drizzle ORM)", icon: Database },
    { label: "法令準拠", value: "労働者派遣法 第26条", icon: Shield },
  ];

  return (
    <AnimatedPage className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <PageHeader
        title="設定"
        tag="SYSTEM_SETTINGS"
      >
        <Link
          to="/audit"
          className="text-xs text-muted-foreground hover:text-foreground border border-border/60 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5 transition-colors"
        >
          <Shield className="h-3 w-3" />
          監査ログ →
        </Link>
      </PageHeader>

      {/* First card — Theme toggle */}
      <div className="hover-lift rounded-[var(--radius-xl)] border border-border bg-card p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-foreground">テーマ</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {themeLabel} · {themeDetail}
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className={cn(
              "relative h-7 w-[5.75rem] rounded-full border transition-all duration-300",
              isDark
                ? "border-primary/20 bg-[linear-gradient(90deg,rgba(17,21,27,0.9),rgba(255,77,79,0.82))]"
                : "border-amber-500/20 bg-[linear-gradient(90deg,rgba(214,31,42,0.92),rgba(245,165,36,0.92))]"
            )}
            aria-label="テーマ切り替え"
          >
            <span className={cn(
              "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-300",
              isDark ? "left-[3.25rem]" : "left-0.5"
            )} />
          </button>
        </div>
      </div>

      {/* Backup */}
      <section className="rounded-xl border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="mb-3 flex items-center gap-2.5 text-sm font-semibold">
          <div className="rounded-lg bg-[var(--color-status-warning-muted)] p-1.5">
            <AlertTriangle className="h-4 w-4 text-[var(--color-status-warning)]" />
          </div>
          抵触日アラート設定
        </h2>
        <p className="mb-4 text-xs text-muted-foreground">
          工場管理とダッシュボードの抵触日アラートを「注意」と表示する閾値（日数）を設定します。
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {[60, 90, 120].map((days) => (
            <button
              key={days}
              onClick={() => applyConflictWarningDays(days)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                conflictWarningDays === days
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {days}日
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">カスタム</label>
          <input
            type="number"
            min={1}
            max={365}
            value={conflictWarningDays}
            onChange={(e) => setConflictWarningDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
            className="w-24 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
            aria-label="抵触日アラート日数"
          />
          <span className="text-xs text-muted-foreground">日前</span>
          <button
            onClick={() => applyConflictWarningDays(conflictWarningDays)}
            className="btn-press rounded-lg bg-[var(--color-status-error)] px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-[var(--color-status-error)]/90"
          >
            保存
          </button>
        </div>
      </section>

      {/* Backup */}
      <section className="rounded-xl border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="mb-3 flex items-center gap-2.5 text-sm font-semibold">
          <div className="rounded-lg bg-primary/10 p-1.5">
            <Database className="h-4 w-4 text-primary" />
          </div>
          データベース管理
        </h2>
        <div className="mb-5 rounded-lg bg-muted/30 px-4 py-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            SQLiteデータベースのバックアップを作成します。バックアップファイルは{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono">data/</code>{" "}
            ディレクトリに保存されます。定期的なバックアップを推奨します。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleBackup}
            disabled={backingUp}
            className="btn-press inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50"
          >
            {backingUp ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                作成中...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                バックアップを作成
              </>
            )}
          </button>
          {health && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-status-ok)]" />
              DBオンライン
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-border/40 pt-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--color-status-error)]">
            <Trash2 className="h-4 w-4" />
            危険操作
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            社員テーブル（employees）を空にします。契約割当（contract_employees）も連動で削除されます。
          </p>
          <button
            onClick={() => setClearEmployeesOpen(true)}
            disabled={clearingEmployees}
            className="btn-press inline-flex items-center gap-2 rounded-lg bg-[var(--color-status-error)] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[color-mix(in_srgb,var(--color-status-error)_85%,black)] hover:shadow-md disabled:opacity-50"
          >
            {clearingEmployees ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                クリア中...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                社員テーブルをクリア
              </>
            )}
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={clearEmployeesOpen}
        onClose={() => {
          setClearEmployeesOpen(false);
          setClearEmployeesToken("");
        }}
        onConfirm={handlePurgeEmployees}
        title="社員テーブルを空にしますか？"
        description="この操作は元に戻せません。全社員データが削除され、契約割当データも連動で削除されます。実行前に自動バックアップが作成されます。DELETE と入力した場合のみ実行できます。"
        confirmLabel="削除してクリア"
        variant="destructive"
        isPending={clearingEmployees}
        confirmDisabled={clearEmployeesToken.trim() !== "DELETE"}
        extraContent={
          <div className="space-y-2">
            <label className="block text-xs font-medium text-muted-foreground">確認のため DELETE と入力してください</label>
            <input
              type="text"
              value={clearEmployeesToken}
              onChange={(e) => setClearEmployeesToken(e.target.value)}
              placeholder="DELETE"
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
              aria-label="DELETE confirmation"
            />
          </div>
        }
      />

      {/* Factory Calendar Bulk Settings */}
      <section className="rounded-xl border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="mb-4">
          <p className="font-semibold text-foreground">工場カレンダー一括更新</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            factories.calendar フィールドを更新します
          </p>
        </div>
        <div className="mb-4 rounded-lg bg-muted/30 px-4 py-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            全工場のカレンダーを一括更新します。毎年、トヨタカレンダー等に合わせて
            <strong className="text-foreground">年末年始・GW・夏季休暇</strong>の日程を入力してください。
          </p>
        </div>

        {/* 3 holiday period inputs */}
        <div className="space-y-3 mb-4">
          {/* 年末年始 */}
          <div className="flex items-center gap-2">
            <span className="w-20 text-xs font-medium text-muted-foreground shrink-0">年末年始</span>
            <input
              type="text"
              value={nenmatsuFrom}
              onChange={(e) => setNenmatsuFrom(e.target.value)}
              className="w-24 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
              placeholder="12月26日"
              aria-label="年末年始開始日"
            />
            <span className="text-xs text-muted-foreground">～</span>
            <input
              type="text"
              value={nenmatsuTo}
              onChange={(e) => setNenmatsuTo(e.target.value)}
              className="w-24 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
              placeholder="1月5日"
              aria-label="年末年始終了日"
            />
          </div>

          {/* GW */}
          <div className="flex items-center gap-2">
            <span className="w-20 text-xs font-medium text-muted-foreground shrink-0">GW</span>
            <input
              type="text"
              value={gwFrom}
              onChange={(e) => setGwFrom(e.target.value)}
              className="w-24 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
              placeholder="4月29日"
              aria-label="GW開始日"
            />
            <span className="text-xs text-muted-foreground">～</span>
            <input
              type="text"
              value={gwTo}
              onChange={(e) => setGwTo(e.target.value)}
              className="w-24 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
              placeholder="5月5日"
              aria-label="GW終了日"
            />
          </div>

          {/* 夏季休暇 */}
          <div className="flex items-center gap-2">
            <span className="w-20 text-xs font-medium text-muted-foreground shrink-0">夏季休暇</span>
            <input
              type="text"
              value={obonFrom}
              onChange={(e) => setObonFrom(e.target.value)}
              className="w-24 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
              placeholder="8月8日"
              aria-label="夏季休暇開始日"
            />
            <span className="text-xs text-muted-foreground">～</span>
            <input
              type="text"
              value={obonTo}
              onChange={(e) => setObonTo(e.target.value)}
              className="w-24 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
              placeholder="8月16日"
              aria-label="夏季休暇終了日"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="mb-4 rounded-lg border border-[color-mix(in_srgb,var(--color-status-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-status-warning)_8%,transparent)] px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Eye className="h-3.5 w-3.5 text-[var(--color-status-warning)]" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-status-warning)]">プレビュー</span>
          </div>
          <p className="text-xs text-[var(--color-status-warning)] font-mono leading-relaxed break-all">
            {calendarPreview}
          </p>
        </div>

        {/* Apply button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleBulkCalendar}
            disabled={calendarUpdating}
            className="btn-press inline-flex items-center gap-2 rounded-lg bg-[var(--color-status-warning)] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[var(--color-status-warning)]/80 hover:shadow-md disabled:opacity-50"
          >
            {calendarUpdating ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                更新中...
              </>
            ) : (
              <>
                <Factory className="h-4 w-4" />
                全工場に適用
              </>
            )}
          </button>
          <p className="text-[10px] text-muted-foreground/70">
            全てのアクティブ工場のカレンダーが上記テキストに更新されます
          </p>
        </div>
      </section>

      {/* Keyboard shortcuts */}
      <section className="rounded-xl border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="mb-4 flex items-center gap-2.5 text-sm font-semibold">
          <div className="rounded-lg bg-primary/10 p-1.5">
            <Keyboard className="h-4 w-4 text-primary" />
          </div>
          キーボードショートカット
        </h2>
        <div className="space-y-1">
          {shortcuts.map((s, i) => (
            <motion.div
              key={s.keys}
              {...(shouldReduceMotion
                ? {}
                : {
                    initial: { opacity: 0, x: -8 },
                    animate: { opacity: 1, x: 0 },
                    transition: { delay: i * 0.04 },
                  })}
              className={cn(
                "flex items-center justify-between rounded-lg px-3.5 py-3",
                i % 2 === 0 && "bg-muted/20"
              )}
            >
              <div className="flex items-center gap-2.5">
                <s.icon className="h-3.5 w-3.5 text-muted-foreground/50" />
                <span className="text-sm text-muted-foreground">{s.action}</span>
              </div>
              <div className="flex items-center gap-1">
                {s.keys.split(" ").map((k, ki) => (
                  k === "+" || k === "/" ? (
                    <span key={ki} className="text-xs text-muted-foreground/50">{k}</span>
                  ) : (
                    <kbd
                      key={ki}
                      className="rounded-md border border-border/60 bg-muted/60 px-2.5 py-1 text-xs font-mono font-semibold"
                    >
                      {k}
                    </kbd>
                  )
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* System info */}
      <section className="rounded-xl border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]">
        <h2 className="mb-4 flex items-center gap-2.5 text-sm font-semibold">
          <div className="rounded-lg bg-[var(--color-status-ok-muted)] p-1.5">
            <Info className="h-4 w-4 text-[var(--color-status-ok)]" />
          </div>
          システム情報
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {systemInfo.map((item, i) => (
            <motion.div
              key={item.label}
              {...(shouldReduceMotion
                ? {}
                : {
                    initial: { opacity: 0 },
                    animate: { opacity: 1 },
                    transition: { delay: i * 0.04 },
                  })}
              className="flex items-center gap-3 rounded-lg bg-muted/20 px-3.5 py-3"
            >
              <item.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
                  {item.label}
                </p>
                <p className="truncate text-xs font-semibold">{item.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Health status */}
        {health && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--color-status-ok)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-status-ok)_8%,transparent)] px-3.5 py-3">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--color-status-ok)]" />
            <p className="text-xs text-[var(--color-status-ok)]">
              システム正常稼働中{" "}
              <span className="font-mono text-[10px] text-[color-mix(in_srgb,var(--color-status-ok)_60%,transparent)]">
                — {health.status}
              </span>
            </p>
          </div>
        )}
      </section>
      {/* Sección デベロッパーモード */}
      <motion.section
        initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
        animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, delay: 0.2 }}
        className="rounded-lg border border-border bg-card p-6 space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
            <Terminal className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">デベロッパーモード</h2>
            <p className="text-xs text-muted-foreground">
              Habilita el panel de administración con acceso directo a la base de datos
            </p>
          </div>
          {/* Toggle */}
          <button
            onClick={handleAdminModeToggle}
            aria-pressed={adminMode}
            aria-label={adminMode ? "デベロッパーモードを無効化" : "デベロッパーモードを有効化"}
            className={cn(
              "ml-auto relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              adminMode ? "bg-amber-500" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                adminMode ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>

        {/* Advertencia */}
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            El panel de administración permite modificar y eliminar datos directamente.
            Solo activar en entornos de desarrollo.
          </span>
        </div>

        {/* Link al panel cuando está activo */}
        {adminMode && (
          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-foreground">
              <Shield className="h-3.5 w-3.5 text-amber-500" />
              <span>Panel de administración activo</span>
            </div>
            <Link
              to="/admin"
              className="text-xs font-medium text-primary hover:underline"
            >
              Abrir panel →
            </Link>
          </div>
        )}
      </motion.section>

      {/* ─── Danger Zone ─────────────────────────────────────── */}
      <motion.section
        initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
        animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={shouldReduceMotion ? undefined : { duration: 0.3, delay: 0.35 }}
        className="space-y-4"
      >
        <div className="border border-[var(--color-status-error)] rounded-lg p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <h2 className="text-sm font-semibold text-destructive">Zona de peligro</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Estas acciones son irreversibles. El audit log se conserva.
          </p>

          {/* Reset card */}
          <div className="flex items-start justify-between gap-4 rounded-xl bg-muted/30 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-destructive/10 p-2 shrink-0 mt-0.5">
                <Database className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Reset completo de base de datos</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Borra todos los contratos, empleados, empresas y fábricas.
                  {dbStats && (
                    <span className="ml-1 text-muted-foreground/70">
                      ({dbStats.totalContracts} contratos · {dbStats.activeEmployees} empleados · {dbStats.companies} empresas · {dbStats.factories} fábricas)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowResetDialog(true)}
              className="shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Borrar todo
            </Button>
          </div>
        </div>

        {/* ConfirmDialog con input RESET */}
        <ConfirmDialog
          open={showResetDialog}
          onClose={() => {
            setShowResetDialog(false);
            setResetConfirmText("");
          }}
          onConfirm={() => resetMutation.mutate()}
          title="Reset total de base de datos"
          description={`Esta acción borrará TODOS los datos operativos (${dbStats?.totalContracts ?? 0} contratos, ${dbStats?.activeEmployees ?? 0} empleados, ${dbStats?.companies ?? 0} empresas, ${dbStats?.factories ?? 0} fábricas). El audit log se conserva. Esta operación es irreversible.`}
          confirmLabel="Confirmar borrado"
          variant="destructive"
          isPending={resetMutation.isPending}
          confirmDisabled={resetConfirmText !== "RESET" || resetMutation.isPending}
          extraContent={
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Escribí <span className="font-mono font-bold text-foreground">RESET</span> para confirmar:
              </p>
              <input
                className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-mono focus:border-destructive/50 focus:outline-none"
                placeholder="RESET"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          }
        />
      </motion.section>
    </AnimatedPage>
  );
}






