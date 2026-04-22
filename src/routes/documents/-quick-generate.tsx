import { type UseMutationResult } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  Check,
  Download,
  Eye,
  Loader2,
  Search,
  Sparkles,
  UserCheck,
} from "lucide-react";

export interface QuickGeneratedFile {
  type: "keiyakusho" | "shugyojoken";
  label: string;
  filename: string;
  path: string;
}

export interface KeiyakushoResult {
  success: boolean;
  employeeNumber: string;
  employeeName: string;
  company: string;
  factory: string;
  filename: string;
  path: string;
}

export interface QuickGenerateResult extends KeiyakushoResult {
  files: QuickGeneratedFile[];
  shugyoError?: string;
}

interface QuickGenerateProps {
  employeeNumber: string;
  onEmployeeNumberChange: (value: string) => void;
  includeShugyojoken: boolean;
  onIncludeShugyojokenChange: (value: boolean) => void;
  keiyakushoMutation: UseMutationResult<QuickGenerateResult, Error, { empNum: string; includeShugyojoken: boolean }>;
  onPreview: (url: string) => void;
}

export function QuickGenerate({
  employeeNumber,
  onEmployeeNumberChange,
  includeShugyojoken,
  onIncludeShugyojokenChange,
  keiyakushoMutation,
  onPreview,
}: QuickGenerateProps) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
      {/* Subtle gradient bg */}
      <div className="pointer-events-none absolute right-0 top-0 h-32 w-48 bg-gradient-to-bl from-primary/5 to-transparent" />

      <div className="mb-4 flex items-center gap-2.5">
        <div className="rounded-lg bg-primary/10 p-1.5">
          <UserCheck className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">社員番号で即時生成</h2>
          <p className="text-xs text-muted-foreground">社員番号を入力して労働契約書を直接生成</p>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <input
            type="search"
            value={employeeNumber}
            onChange={(e) => onEmployeeNumberChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && employeeNumber.trim()) {
                keiyakushoMutation.mutate({ empNum: employeeNumber.trim(), includeShugyojoken });
              }
            }}
            placeholder="社員番号を入力（例: 001）"
            aria-label="社員番号検索"
            className="w-full rounded-lg border border-input/80 bg-background py-2.5 pl-9 pr-3 text-sm shadow-xs transition-all placeholder:text-muted-foreground/50 focus:border-primary/30 focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <button
          onClick={() => {
            if (employeeNumber.trim()) {
              keiyakushoMutation.mutate({ empNum: employeeNumber.trim(), includeShugyojoken });
            }
          }}
          disabled={keiyakushoMutation.isPending || !employeeNumber.trim()}
          className="btn-press inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50"
        >
          {keiyakushoMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {includeShugyojoken ? "書類生成（契約書+就業条件明示書）" : "契約書生成"}
        </button>
      </div>

      <label className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={includeShugyojoken}
          onChange={(e) => onIncludeShugyojokenChange(e.target.checked)}
          className="h-4 w-4 rounded border-input bg-background accent-primary"
        />
        就業条件明示書も生成する（必要な時だけ）
      </label>

      <AnimatePresence>
        {keiyakushoMutation.isSuccess && keiyakushoMutation.data && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
            className="mt-4 flex items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--color-status-ok)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-status-ok)_8%,transparent)] p-3.5"
          >
            <div className="rounded-lg bg-[color-mix(in_srgb,var(--color-status-ok)_15%,transparent)] p-1.5">
              <Check className="h-4 w-4 text-[var(--color-status-ok)]" />
            </div>
            <div className="flex-1 text-sm">
              <p className="font-semibold text-[var(--color-status-ok)]">
                {keiyakushoMutation.data.employeeName}（{keiyakushoMutation.data.employeeNumber}）
              </p>
              <p className="text-xs text-[color-mix(in_srgb,var(--color-status-ok)_70%,transparent)]">
                {keiyakushoMutation.data.company} → {keiyakushoMutation.data.factory}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {keiyakushoMutation.data.files.map((file) => (
                <div key={file.path} className="flex items-center gap-1 rounded-lg border border-[color-mix(in_srgb,var(--color-status-ok)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-status-ok)_12%,transparent)] px-2 py-1">
                  <span className="text-[10px] font-semibold text-[var(--color-status-ok)]">{file.label}</span>
                  <button
                    onClick={() => onPreview(file.path)}
                    className="btn-press rounded-md p-1 text-[var(--color-status-ok)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-status-ok)_15%,transparent)]"
                    aria-label={`${file.label} プレビュー`}
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <a
                    href={file.path}
                    download={file.filename}
                    className="btn-press rounded-md p-1 text-[var(--color-status-ok)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-status-ok)_15%,transparent)]"
                    aria-label={`${file.label} ダウンロード`}
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>
              ))}
            </div>
          </motion.div>
        )}
        {keiyakushoMutation.isError && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0 }}
            className="mt-4 flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--color-status-error)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-status-error)_8%,transparent)] p-3.5"
          >
            <div className="mt-0.5 rounded-lg bg-[color-mix(in_srgb,var(--color-status-error)_15%,transparent)] p-1.5">
              <AlertCircle className="h-4 w-4 text-[var(--color-status-error)]" />
            </div>
            <p className="text-sm text-[var(--color-status-error)]">
              {(keiyakushoMutation.error as Error).message}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
