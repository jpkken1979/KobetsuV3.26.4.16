import { type Contract } from "@/lib/api";
import { cn } from "@/lib/utils";
import { type UseMutationResult } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  Building2,
  Check,
  ClipboardList,
  Download,
  Eye,
  FileOutput,
  FileText,
  Loader2,
  Sparkles,
  Users,
  X,
} from "lucide-react";

interface GeneratedFile {
  type: string;
  filename: string;
  path: string;
}

interface GenerateResult {
  success: boolean;
  contractId: number;
  files: GeneratedFile[];
  summary: { total: number; errors: number };
}

interface ExistingDoc {
  filename: string;
  path: string;
  size?: number;
}

const DOC_TYPES: Record<string, {
  label: string;
  desc: string;
  icon: typeof FileText;
  perEmployee: boolean;
  color: string;
  bgColor: string;
}> = {
  kobetsu: {
    label: "個別契約書",
    desc: "人材派遣個別契約書（1通/契約）",
    icon: FileText,
    perEmployee: false,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/30",
  },
  tsuchisho: {
    label: "通知書",
    desc: "派遣先通知書 — 全従業員リスト",
    icon: ClipboardList,
    perEmployee: false,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/30",
  },
  hakensakiDaicho: {
    label: "派遣先管理台帳",
    desc: "派遣先が保管する台帳（1通/従業員）",
    icon: Building2,
    perEmployee: true,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/30",
  },
  hakenmotoDaicho: {
    label: "派遣元管理台帳",
    desc: "派遣元が保管する台帳（1通/従業員）",
    icon: Building2,
    perEmployee: true,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-900/30",
  },
  shugyoJoken: {
    label: "就業条件明示書",
    desc: "就業条件の通知書（1通/従業員）",
    icon: Users,
    perEmployee: true,
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-50 dark:bg-rose-900/30",
  },
};

interface DocumentGeneratorProps {
  selectedContractId: number;
  selectedContract: Contract | undefined;
  generateMutation: UseMutationResult<GenerateResult, Error, number>;
  existingDocs: { files: ExistingDoc[] } | undefined;
  previewUrl: string | null;
  onPreview: (url: string | null) => void;
}

export function DocumentGenerator({
  selectedContractId,
  selectedContract,
  generateMutation,
  existingDocs,
  previewUrl,
  onPreview,
}: DocumentGeneratorProps) {
  const shouldReduceMotion = useReducedMotion();
  const totalDocs = selectedContract
    ? Object.values(DOC_TYPES).reduce((sum, d) => {
        if (d.perEmployee) return sum + (selectedContract.employees?.length || 0);
        return sum + 1;
      }, 0)
    : 0;

  return (
    <motion.div
      key={selectedContractId}
      initial={shouldReduceMotion ? undefined : { opacity: 0, x: 12 }}
      animate={shouldReduceMotion ? undefined : { opacity: 1, x: 0 }}
      className="space-y-4"
    >
      {/* Contract summary card */}
      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="pointer-events-none absolute right-0 top-0 h-28 w-40 bg-gradient-to-bl from-primary/5 to-transparent" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">選択中の契約</p>
            <h2 className="mt-0.5 text-xl font-bold tabular-nums tracking-tight">
              {selectedContract?.contractNumber}
            </h2>
          </div>
          <button
            onClick={() => generateMutation.mutate(selectedContractId)}
            disabled={generateMutation.isPending}
            className="btn-press inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                全書類生成 ({totalDocs}通)
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          {[
            { label: "派遣先", value: selectedContract?.company?.name },
            { label: "期間", value: `${selectedContract?.startDate?.slice(5)} ～ ${selectedContract?.endDate?.slice(5)}` },
            { label: "従業員", value: `${selectedContract?.employees?.length || 0}名` },
            { label: "単価", value: `¥${selectedContract?.hourlyRate?.toLocaleString() ?? "--"}` },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-muted/30 px-3 py-2.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">{item.label}</span>
              <p className="mt-0.5 truncate text-sm font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Document types */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">生成書類 — 5種類</h3>
          {generateMutation.isPending && (
            <div className="flex items-center gap-2 text-primary dark:drop-shadow-[0_0_8px_rgba(0,255,136,0.4)]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm font-medium">生成中...</span>
            </div>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(DOC_TYPES).map(([key, docType], i) => {
            const Icon = docType.icon;
            const count = docType.perEmployee
              ? selectedContract?.employees?.length || 0
              : 1;
            return (
              <motion.div
                key={key}
                initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
                animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={shouldReduceMotion ? undefined : { delay: i * 0.05 }}
                className="hover-lift flex flex-col items-center gap-3 rounded-[var(--radius-xl)] border border-border bg-card p-4 text-center transition-all hover:border-primary/40 dark:hover:shadow-[0_0_30px_rgba(0,255,136,0.12)]"
              >
                <div className={cn("rounded-lg p-2.5", docType.bgColor)}>
                  <Icon className={cn("h-5 w-5", docType.color)} />
                </div>
                <div className="min-w-0 w-full">
                  <p className="text-sm font-semibold">{docType.label}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/70 truncate">{docType.desc}</p>
                </div>
                <span className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset tabular-nums",
                  docType.perEmployee
                    ? "bg-primary/10 text-primary ring-primary/20 dark:bg-primary/15 dark:text-primary/90 dark:ring-primary/30"
                    : "bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-700/40"
                )}>
                  {count}通
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Generation results */}
      <AnimatePresence>
        {generateMutation.isSuccess && generateMutation.data && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 12 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            className="rounded-xl border border-green-200/60 bg-green-50/50 p-4 dark:border-green-800/40 dark:bg-green-950/30"
          >
            <div className="mb-4 flex items-center gap-2.5">
              <div className="rounded-lg bg-green-100 p-1.5 dark:bg-green-900/50">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-300">
                  生成完了
                </h3>
                <p className="text-xs text-green-700/70 dark:text-green-400/60">
                  {generateMutation.data.summary.total}ファイル生成済み
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              {generateMutation.data.files.map((file, i) => {
                const isError = file.path.startsWith("ERROR");
                const isZip = file.filename?.toLowerCase().endsWith(".zip");
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-white px-3 py-2.5 text-sm shadow-xs dark:bg-card/80"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isError ? (
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0 text-green-600" />
                      )}
                      <span className={cn("truncate text-xs", isError ? "text-red-600" : "")}>
                        {isError ? file.path : file.filename}
                      </span>
                    </div>
                    {!isError && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isZip && (
                          <button
                            onClick={() => onPreview(file.path)}
                            className="btn-press rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label="プレビュー"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        )}
                        <a
                          href={file.path}
                          download={file.filename}
                          className="btn-press rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label="ダウンロード"
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
        {generateMutation.isError && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            role="alert"
            aria-live="polite"
            className="flex items-start gap-3 rounded-xl border border-red-200/60 bg-red-50/50 p-4 dark:border-red-800/40 dark:bg-red-950/30"
          >
            <div className="rounded-lg bg-red-100 p-1.5 dark:bg-red-900/50">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-sm text-red-700 dark:text-red-400">
              書類の生成に失敗しました。契約データを確認してください。
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Existing documents */}
      {(existingDocs?.files?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
          <h3 className="mb-3 text-sm font-semibold">
            生成済み書類
            <span className="ml-2 rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {existingDocs!.files.length}件
            </span>
          </h3>
          <div className="space-y-1.5">
            {existingDocs!.files.map((file, i: number) => {
              const isZip = file.filename.toLowerCase().endsWith(".zip");
              return (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  <span className="truncate text-xs">{file.filename}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] tabular-nums text-muted-foreground/50">
                    {file.size ? `${(file.size / 1024).toFixed(0)}KB` : ""}
                  </span>
                  {!isZip && (
                    <button
                      onClick={() => onPreview(file.path)}
                      className="btn-press rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="プレビュー"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                  <a
                    href={file.path}
                    download={file.filename}
                    className="btn-press rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="ダウンロード"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PDF Preview */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, scale: 1 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
            className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)]"
          >
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary/70" />
                <h3 className="text-sm font-semibold">PDF プレビュー</h3>
              </div>
              <button
                onClick={() => onPreview(null)}
                aria-label="プレビューを閉じる"
                className="btn-press rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <iframe
              src={previewUrl}
              className="h-[700px] w-full"
              title="PDF Preview"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Empty state when no contract is selected */
export function DocumentGeneratorEmpty() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/50 bg-card/50 py-28 text-center">
      <div className="mb-4 rounded-2xl bg-muted/50 p-4">
        <FileOutput className="h-10 w-10 text-muted-foreground/30" />
      </div>
      <p className="text-base font-medium text-muted-foreground/60">契約を選択してください</p>
      <p className="mt-1 text-xs text-muted-foreground/40">左リストから生成したい契約をクリック</p>
      <Link
        to="/contracts/new"
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
      >
        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        新規契約を作成
      </Link>
    </div>
  );
}
