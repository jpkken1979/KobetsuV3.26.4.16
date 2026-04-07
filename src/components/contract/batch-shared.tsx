/**
 * Shared UI components for batch contract creation pages.
 * Used by both batch.tsx and new-hires.tsx.
 */
import type { ReactNode, ElementType } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { AnimatedPage } from "@/components/ui/animated";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import type { Company } from "@/lib/api";
import {
  Building2,
  Check,
  CheckCircle2,
  XCircle,
  FileText,
  FileDown,
  Download,
  ArrowLeft,
  ShieldAlert,
  Loader2,
} from "lucide-react";

// ─── Section / StatCard (existing) ──────────────────────────────────

export function Section({
  icon: Icon,
  title,
  step,
  children,
}: {
  icon: ElementType;
  title: string;
  step: number;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
          {step}
        </div>
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: ElementType }) {
  return (
    <div className="rounded-lg bg-muted/30 p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-muted-foreground/40" />
      <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Company Selector Grid ──────────────────────────────────────────

export function CompanySelector({
  companies,
  selectedId,
  onChange,
}: {
  companies: Company[] | undefined;
  selectedId: number | null;
  onChange: (id: number) => void;
}) {
  return (
    <Section icon={Building2} title="企業選択" step={1}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {companies?.map((company: Company) => (
          <button
            key={company.id}
            onClick={() => onChange(company.id)}
            className={cn(
              "btn-press rounded-lg border p-3 text-left text-sm transition-all",
              selectedId === company.id
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border/60 hover:border-border hover:bg-muted/30"
            )}
          >
            <span className="font-medium">{company.shortName || company.name}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}

// ─── Page Header (back arrow + title) ───────────────────────────────

export function BatchPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <Link
        to="/contracts"
        className="rounded-lg border border-border p-2 transition-colors hover:bg-muted"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// ─── Result Screen Components ───────────────────────────────────────

/** Success banner at the top of the results screen */
export function ResultHeader({
  title,
  created,
  skipped,
}: {
  title: string;
  created: number;
  skipped: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-xl bg-green-100 p-2.5 dark:bg-green-900/50">
        <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {created}件の契約を作成しました
          {skipped > 0 && ` (${skipped}件スキップ)`}
        </p>
      </div>
    </div>
  );
}

/** PDF download links section */
export function PdfFilesList({
  files,
  label,
}: {
  files: { filename: string; path: string }[];
  label?: string;
}) {
  const valid = files.filter((f) => !f.path.startsWith("ERROR"));
  if (valid.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
      <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <FileDown className="h-4 w-4" />
          {label ?? "生成されたPDF"}
        </h3>
      </div>
      <div className="divide-y divide-border/40">
        {valid.map((f) => (
          <a
            key={f.filename}
            href={f.path}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/30"
          >
            <span className="text-sm font-medium">{f.filename}</span>
            <Download className="h-4 w-4 text-muted-foreground" />
          </a>
        ))}
      </div>
    </div>
  );
}

/** Skipped lines warning panel */
export function SkippedLinesList({
  items,
}: {
  items: { factoryName: string; lineName?: string; reason: string }[];
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 dark:border-amber-800/40 dark:bg-amber-950/30">
      <h3 className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
        スキップされたライン
      </h3>
      <div className="space-y-1">
        {items.map((s, i: number) => (
          <div
            key={i}
            className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400"
          >
            <XCircle className="h-3.5 w-3.5" />
            <span>{s.factoryName} {s.lineName}</span>
            <span className="text-amber-500">({s.reason})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Bottom action buttons: go to contract list + continue creating */
export function ResultActions({
  onReset,
}: {
  onReset: () => void;
}) {
  return (
    <div className="flex gap-3 pt-2">
      <Link
        to="/contracts"
        className="btn-press inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
      >
        <FileText className="h-4 w-4" />
        契約一覧へ
      </Link>
      <button
        onClick={onReset}
        className="btn-press rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
      >
        続けて作成
      </button>
    </div>
  );
}

/** Wrapper for entire result screen using AnimatedPage */
export function ResultScreen({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AnimatedPage className="space-y-6">
      {children}
    </AnimatedPage>
  );
}

// ─── Checkbox Toggle (custom styled) ────────────────────────────────

export function StyledCheckbox({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <div
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded border transition-all",
          checked
            ? "border-primary bg-primary text-primary-foreground shadow-sm"
            : "border-border/80"
        )}
      >
        {checked && <Check className="h-3 w-3" />}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <div>
        <span className="text-sm font-medium">{label}</span>
        {description && (
          <p className="text-[11px] text-muted-foreground">{description}</p>
        )}
      </div>
    </label>
  );
}

// ─── Confirmation Modal Shell ───────────────────────────────────────

export function ConfirmationModalShell({
  open,
  onClose,
  title,
  subtitle,
  stats,
  isPending,
  totalContracts,
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  stats: { label: string; value: number }[];
  isPending: boolean;
  totalContracts: number;
  onConfirm: () => void;
  /** Extra content between stats and buttons (duplicate warnings, line details, PDF info, etc.) */
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-xl bg-amber-100 p-2 dark:bg-amber-900/50">
          <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-muted/30 p-3 text-center">
            <p className="text-xl font-bold tabular-nums">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {children}

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onClose}
          disabled={isPending}
          className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          onClick={onConfirm}
          disabled={isPending}
          className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-green-600/20 transition-all hover:bg-green-700 disabled:opacity-50"
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              作成中...
            </span>
          ) : (
            `${totalContracts}件を作成する`
          )}
        </button>
      </div>
    </Dialog>
  );
}

/** PDF auto-generation info banner used inside confirmation modals */
export function PdfGenerationBanner() {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg bg-primary/[0.08] p-2.5 text-xs text-primary dark:bg-primary/[0.12] dark:text-primary/80">
      <FileDown className="h-3.5 w-3.5" />
      作成後にPDFも自動生成します (個別契約書+通知書・派遣先管理台帳・派遣元管理台帳)
    </div>
  );
}
