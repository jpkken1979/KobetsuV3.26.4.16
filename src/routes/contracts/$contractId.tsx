import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import type { ContractEmployee, Employee } from "@/lib/api-types";
import { queryKeys } from "@/lib/query-keys";
import { AnimatedPage, GradientText } from "@/components/ui/animated";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { ContractStatusBadge } from "@/components/ui/status-badge";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileText,
  Calendar,
  Clock,
  Users,
  DollarSign,
  Download,
  Trash2,
  AlertTriangle,
  Ban,
} from "lucide-react";

export const Route = createFileRoute("/contracts/$contractId")({
  component: ContractDetail,
  errorComponent: ({ reset }) => (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <p className="text-lg font-semibold text-destructive">契約が見つかりません</p>
      <Button variant="outline" onClick={reset}>再試行</Button>
    </div>
  ),
});

/* ── Info card ── */
function InfoCard({
  icon: Icon,
  label,
  value,
  sub,
  className,
}: {
  icon: typeof FileText;
  label: string;
  value: string | number | null | undefined;
  sub?: string;
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-lg font-bold tabular-nums">{value ?? "--"}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground/60">{sub}</p>}
    </Card>
  );
}

/* ── Section ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/40">
        {title}
      </h3>
      {children}
    </div>
  );
}

/* ── Detail row ── */
function DetailRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  const text = value ?? "--";
  const hasNewline = typeof text === "string" && text.includes("\n");
  return (
    <div className={`flex ${hasNewline ? "flex-col gap-1" : "items-baseline justify-between"} border-b border-border/20 py-2 last:border-0`}>
      <span className="text-xs text-muted-foreground/60">{label}</span>
      {hasNewline ? (
        <div className="space-y-0.5">
          {(text as string).split("\n").map((line, i) => (
            <p key={i} className="text-sm font-medium">{line}</p>
          ))}
        </div>
      ) : (
        <span className="text-sm font-medium">{text}</span>
      )}
    </div>
  );
}

/* ── Status config for detail labels ── */
const STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  active: "有効",
  expired: "期限切れ",
  cancelled: "取消",
  renewed: "更新済",
};

/* ── Format rate ── */
function fmtRate(rate: number | null | undefined): string {
  if (rate == null) return "--";
  return `¥${rate.toLocaleString()}`;
}

/* ── Main Component ── */
function ContractDetail() {
  const { contractId } = Route.useParams();
  const id = Number(contractId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const { data: contract, isLoading, error } = useQuery({
    queryKey: queryKeys.contracts.detail(id),
    queryFn: () => api.getContract(id),
  });

  // Generate PDF
  const generatePdf = useMutation({
    mutationFn: () => api.generateContractDocuments(id),
    onSuccess: (data) => {
      const zipFile = data.files?.find((f) => f.filename?.toLowerCase().endsWith(".zip"));
      toast.success("書類生成完了", { description: zipFile?.filename || data.files?.[0]?.filename });
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.forContract(id) });
    },
    onError: () => {
      toast.error("PDF生成に失敗しました");
    },
  });

  // Cancel contract (soft delete)
  const cancelContract = useMutation({
    mutationFn: () => api.deleteContract(id),
    onSuccess: () => {
      toast.success("契約を取り消しました");
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.invalidateAll });
      navigate({ to: "/contracts" });
    },
    onError: () => {
      toast.error("取消に失敗しました");
    },
  });

  // Purge contract (hard delete — only for cancelled contracts)
  const purgeContract = useMutation({
    mutationFn: () => api.purgeContracts([id]),
    onSuccess: (data) => {
      toast.success(`${data.purged}件の契約を完全削除しました`);
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.invalidateAll });
      navigate({ to: "/contracts" });
    },
    onError: () => {
      toast.error("完全削除に失敗しました");
    },
  });

  if (isLoading) {
    return (
      <AnimatedPage className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="skeleton h-8 w-8 rounded-lg" />
          <div className="skeleton h-6 w-48 rounded" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-64 rounded-xl" />
      </AnimatedPage>
    );
  }

  if (error || !contract) {
    return (
      <AnimatedPage className="flex flex-col items-center justify-center py-32">
        <AlertTriangle className="h-12 w-12 text-amber-500/50" />
        <p className="mt-4 text-lg font-bold text-muted-foreground">契約が見つかりません</p>
        <p className="mt-1 text-sm text-muted-foreground/60">ID: {contractId}</p>
        <Link
          to="/contracts"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          一覧に戻る
        </Link>
      </AnimatedPage>
    );
  }

  const daysLeft = contract.endDate
    ? Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / 86400000)
    : null;

  // Junction rows from API — ContractEmployee with nested employee object
  const empList = (contract.employees ?? []) as Array<
    ContractEmployee & { employee?: Employee }
  >;


  return (
    <AnimatedPage className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/contracts"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground/60 transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-3 w-3" />
            契約一覧
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              <GradientText>{contract.contractNumber}</GradientText>
            </h1>
            <ContractStatusBadge status={contract.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground/60">
            {contract.company?.name ?? ""}
            {contract.factory?.factoryName && ` / ${contract.factory.factoryName}`}
            {contract.factory?.department && ` / ${contract.factory.department}`}
            {contract.factory?.lineName && ` / ${contract.factory.lineName}`}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="cyan"
            onClick={() => generatePdf.mutate()}
            disabled={generatePdf.isPending}
          >
            <Download className="h-4 w-4" />
            {generatePdf.isPending ? "生成中..." : "PDF生成"}
          </Button>
          {contract.status !== "cancelled" ? (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={cancelContract.isPending}
            >
              <Ban className="h-4 w-4" />
              {cancelContract.isPending ? "取消中..." : "取消"}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={purgeContract.isPending}
            >
              <Trash2 className="h-4 w-4" />
              {purgeContract.isPending ? "削除中..." : "完全削除"}
            </Button>
          )}
        </div>
      </div>

      {/* Cancel / Purge confirmation dialog */}
      <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>
              {contract.status === "cancelled" ? "契約の完全削除" : "契約の取消"}
            </DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            {contract.status === "cancelled" ? (
              <>
                契約 <span className="font-bold text-foreground">{contract.contractNumber}</span> を完全削除しますか？この操作は取り消せません。
              </>
            ) : (
              <>
                契約 <span className="font-bold text-foreground">{contract.contractNumber}</span> を取り消みにしますか？取消後はリストに戻りますが、データは完全に削除されません。
              </>
            )}
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowDeleteConfirm(false);
                if (contract.status === "cancelled") {
                  purgeContract.mutate();
                } else {
                  cancelContract.mutate();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              {contract.status === "cancelled" ? "完全削除する" : "取消する"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Hero section */}
      <div className="rounded-[var(--radius-xl)] border border-border bg-card p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              個別契約書
            </p>
            <h1 className="font-mono text-2xl font-black tracking-tight text-primary dark:drop-shadow-[0_0_16px_rgba(0,255,136,0.4)]">
              {contract.contractNumber}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {contract.company?.name ?? ""}
              {contract.factory?.factoryName && ` / ${contract.factory.factoryName}`}
              {contract.factory?.department && ` / ${contract.factory.department}`}
              {contract.factory?.lineName && ` / ${contract.factory.lineName}`}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="cyan"
              size="sm"
              onClick={() => generatePdf.mutate()}
              disabled={generatePdf.isPending}
            >
              <Download className="h-4 w-4" />
              {generatePdf.isPending ? "生成中..." : "PDF生成"}
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <InfoCard
          icon={Calendar}
          label="契約期間"
          value={`${contract.startDate} ~ ${contract.endDate}`}
          sub={daysLeft != null ? (daysLeft >= 0 ? `残り${daysLeft}日` : `${Math.abs(daysLeft)}日超過`) : undefined}
        />
        <InfoCard
          icon={DollarSign}
          label="単価"
          value={fmtRate(contract.hourlyRate)}
          sub={contract.overtimeRate ? `残業 ${fmtRate(contract.overtimeRate)}` : undefined}
        />
        <InfoCard
          icon={Users}
          label="派遣社員"
          value={`${empList.length}名`}
        />
        <InfoCard
          icon={Clock}
          label="勤務時間"
          value={contract.factory?.workHours
            || (contract.workStartTime && contract.workEndTime ? `${contract.workStartTime} ~ ${contract.workEndTime}` : null)
            || "--"}
          sub={contract.breakMinutes ? `休憩 ${contract.breakMinutes}分` : undefined}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Contract Details */}
        <motion.div
          {...(shouldReduceMotion
            ? {}
            : {
                initial: { opacity: 0, y: 8 },
                animate: { opacity: 1, y: 0 },
                transition: { delay: 0.1 },
              })}
          className="space-y-6"
        >
          <div className="hover-lift rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
            <Section title="契約情報">
              <div className="space-y-0">
                <DetailRow label="契約番号" value={contract.contractNumber} />
                <DetailRow label="契約締結日" value={contract.contractDate} />
                <DetailRow label="通知日" value={contract.notificationDate} />
                <DetailRow label="開始日" value={contract.startDate} />
                <DetailRow label="終了日" value={contract.endDate} />
                {(contract.conflictDateOverride || contract.factory?.conflictDate) && (
                  <DetailRow
                    label="抵触日"
                    value={contract.conflictDateOverride
                      ? `${contract.conflictDateOverride} (個別設定)`
                      : contract.factory?.conflictDate ?? ""}
                  />
                )}
                <DetailRow label="状態" value={STATUS_LABELS[contract.status] ?? contract.status} />
              </div>
            </Section>
          </div>

          <div className="hover-lift rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
            <Section title="料金">
              <div className="space-y-0">
                <DetailRow label="基本単価" value={fmtRate(contract.hourlyRate)} />
                <DetailRow label="残業単価" value={fmtRate(contract.overtimeRate)} />
                <DetailRow label="深夜単価" value={fmtRate(contract.nightShiftRate)} />
                <DetailRow label="休日単価" value={fmtRate(contract.holidayRate)} />
              </div>
            </Section>
          </div>

          <div className="hover-lift rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
            <Section title="就業条件">
              <div className="space-y-0">
                <DetailRow label="業務内容" value={contract.jobDescription} />
                <DetailRow label="勤務日" value={contract.workDays} />
                <DetailRow label="勤務時間" value={
                  contract.factory?.workHours
                    || (contract.workStartTime && contract.workEndTime ? `${contract.workStartTime} ~ ${contract.workEndTime}` : null)
                } />
                <DetailRow label="休憩" value={
                  [contract.factory?.breakTimeDay, contract.factory?.breakTimeNight].filter(Boolean).join("\n")
                    || (contract.breakMinutes ? `${contract.breakMinutes}分` : null)
                } />
                <DetailRow label="残業上限" value={contract.overtimeMax} />
              </div>
            </Section>
          </div>
        </motion.div>

        {/* Right: Employees + Company info */}
        <motion.div
          {...(shouldReduceMotion
            ? {}
            : {
                initial: { opacity: 0, y: 8 },
                animate: { opacity: 1, y: 0 },
                transition: { delay: 0.15 },
              })}
          className="space-y-6"
        >
          {/* Employees */}
          <div className="hover-lift rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
            <Section title={`派遣社員 (${empList.length}名)`}>
              {empList.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground/40">社員が割り当てられていません</p>
              ) : (
                <div className="space-y-2">
                  {empList.map((ce) => {
                    const emp = (ce.employee ?? ce) as Employee;
                    return (
                      <div
                        key={ce.id ?? emp.id}
                        className="flex items-center justify-between rounded-lg border border-border/20 bg-background/50 px-3 py-2.5 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {(emp.fullName ?? "?")[0]}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{emp.fullName ?? emp.employeeNumber}</p>
                            <p className="text-[10px] text-muted-foreground/50">
                              {emp.employeeNumber}
                              {emp.nationality && ` · ${emp.nationality}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {ce.hourlyRate && (
                            <p className="text-sm font-bold tabular-nums">{fmtRate(ce.hourlyRate)}</p>
                          )}
                          {ce.individualStartDate && (
                            <p className="text-[10px] text-muted-foreground/50 tabular-nums">
                              {ce.individualStartDate}~
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </div>

          {/* Company info */}
          {contract.company && (
            <div className="hover-lift rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
              <Section title="派遣先情報">
                <div className="space-y-0">
                  <DetailRow label="企業名" value={contract.company.name} />
                  {contract.factory && (
                    <>
                      <DetailRow label="工場" value={contract.factory.factoryName} />
                      <DetailRow label="部署" value={contract.factory.department} />
                      <DetailRow label="ライン" value={contract.factory.lineName} />
                      <DetailRow label="住所" value={contract.factory.address} />
                    </>
                  )}
                </div>
              </Section>
            </div>
          )}

          {/* Supervisor info */}
          <div className="hover-lift rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
            <Section title="担当者">
              <div className="space-y-0">
                <DetailRow label="指揮命令者" value={contract.supervisorName} />
                <DetailRow label="指揮命令者部署" value={contract.supervisorDept} />
                <DetailRow label="苦情処理（派遣先）" value={contract.complaintHandlerClient} />
                <DetailRow label="苦情処理（派遣元）" value={contract.complaintHandlerUns} />
                <DetailRow label="派遣元責任者" value={contract.hakenmotoManager} />
              </div>
            </Section>
          </div>
        </motion.div>
      </div>
    </AnimatedPage>
  );
}
