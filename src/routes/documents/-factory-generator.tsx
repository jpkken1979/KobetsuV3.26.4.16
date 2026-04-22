import { api, downloadZip, type Company, type Factory, type GenerateFactoryResult } from "@/lib/api";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  Archive,
  Building2,
  Check,
  ChevronDown,
  ClipboardList,
  Download,
  FileText,
  Layers,
  Loader2,
  Package,
  Sparkles,
  Users,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

// ─── Visual diagram of what gets generated ───────────────────────────

interface DocDiagramProps {
  kobetsuCopies: 1 | 2;
  contractCount?: number;
  employeeCount?: number;
}

function DocDiagram({ kobetsuCopies, contractCount = 1, employeeCount = 1 }: DocDiagramProps) {
  const shouldReduceMotion = useReducedMotion();
  const docs = [
    ...(kobetsuCopies === 2
      ? [
          { label: "個別契約書", sublabel: "派遣先用（クライアントへ）", icon: FileText, color: "text-primary", bg: "bg-primary/10", count: contractCount, each: true },
          { label: "個別契約書", sublabel: "派遣元用（社内保管）", icon: FileText, color: "text-primary", bg: "bg-primary/10", count: contractCount, each: true },
        ]
      : [
          { label: "個別契約書", sublabel: "通知書込み（1通）", icon: FileText, color: "text-primary", bg: "bg-primary/10", count: contractCount, each: true },
        ]),
    { label: "派遣先管理台帳", sublabel: "クライアント保管", icon: Building2, color: "text-[var(--color-status-ok)]", bg: "bg-[var(--color-status-ok-muted)]", count: employeeCount, each: false },
    { label: "派遣元管理台帳", sublabel: "社内保管", icon: Building2, color: "text-[var(--color-status-warning)]", bg: "bg-[var(--color-status-warning-muted)]", count: employeeCount, each: false },
  ];

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
        生成される書類
      </p>

      {/* Diagram: contracts → docs → ZIP */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {/* Input: contracts */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
            <ClipboardList className="h-5 w-5 text-muted-foreground/60" />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground/50">
            {contractCount}契約
          </span>
        </div>

        {/* Arrow */}
        <ChevronDown className="h-4 w-4 shrink-0 rotate-[-90deg] text-muted-foreground/30" />

        {/* Docs grid */}
        <div className="flex shrink-0 flex-wrap gap-2">
          {docs.map((doc, i) => (
            <motion.div
              key={i}
              initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
              animate={shouldReduceMotion ? undefined : { opacity: 1, scale: 1 }}
              transition={shouldReduceMotion ? undefined : { delay: i * 0.06 }}
              className="flex flex-col items-center gap-1 rounded-lg border border-border/50 px-3 py-2 text-center"
            >
              <div className={cn("rounded-md p-1.5", doc.bg)}>
                <doc.icon className={cn("h-3.5 w-3.5", doc.color)} />
              </div>
              <p className="text-[10px] font-semibold leading-tight">{doc.label}</p>
              <p className="max-w-[72px] text-[9px] leading-tight text-muted-foreground/60">{doc.sublabel}</p>
              <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums ring-1 ring-inset", doc.color.includes("primary") ? "bg-primary/10 ring-primary/20 text-primary" : "bg-muted/50 ring-border/50 text-muted-foreground")}>
                ×{doc.count}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Arrow */}
        <ChevronDown className="h-4 w-4 shrink-0 rotate-[-90deg] text-muted-foreground/30" />

        {/* Output: ZIP */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-dashed border-primary/30 bg-primary/5">
            <Archive className="h-5 w-5 text-primary/60" />
          </div>
          <span className="text-[10px] font-semibold text-primary/70">1 ZIP</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main factory generator component ────────────────────────────────

export function FactoryGenerator() {
  const shouldReduceMotion = useReducedMotion();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedFactoryId, setSelectedFactoryId] = useState<number | null>(null);
  const [kobetsuCopies, setKobetsuCopies] = useState<1 | 2>(1);
  const [result, setResult] = useState<GenerateFactoryResult | null>(null);

  const { data: companies = [], isLoading: loadingCompanies } = useQuery({
    queryKey: queryKeys.companies.all,
    queryFn: () => api.getCompanies(),
  });

  const activeCompanies = useMemo(() => companies.filter((c: Company) => c.isActive), [companies]);

  const selectedCompany = useMemo(
    () => activeCompanies.find((c: Company) => c.id === selectedCompanyId),
    [activeCompanies, selectedCompanyId]
  );

  const availableFactories: Factory[] = useMemo(
    () => selectedCompany?.factories ?? [],
    [selectedCompany]
  );

  const selectedFactory = useMemo(
    () => availableFactories.find((f: Factory) => f.id === selectedFactoryId),
    [availableFactories, selectedFactoryId]
  );

  const generateMutation = useMutation({
    mutationFn: () => api.generateFactory(selectedFactoryId!, kobetsuCopies),
    onSuccess: async (data) => {
      setResult(data);
      toast.success("工場一括生成完了", {
        description: `${data.contractCount}契約 / ${data.fileCount}ファイル → ZIP`,
      });
      if (data.zipFilename) {
        try {
          await downloadZip([data.zipFilename], data.zipFilename);
        } catch {
          // downloadZip failure is silent — user can use the manual link below
        }
      }
    },
    onError: (error: Error) => {
      toast.error("生成に失敗しました", { description: error.message });
    },
  });

  const canGenerate = !!selectedFactoryId && !generateMutation.isPending;

  // Estimate counts for diagram
  const diagContractCount = selectedFactory ? 1 : 1; // backend finds actives — show "1+" placeholder
  const diagEmployeeCount = 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="mb-1 flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-base font-bold">工場一括生成</h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary ring-1 ring-primary/20">
            全契約
          </span>
        </div>
        <p className="text-xs text-muted-foreground/70">
          工場を選ぶと、その工場の全稼働契約の書類を一括でZIPに生成します
        </p>
      </div>

      {/* Step 1 — Company */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">1</span>
          <h3 className="text-sm font-semibold">派遣先を選択</h3>
        </div>
        {loadingCompanies ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            読み込み中...
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {activeCompanies.map((company: Company) => (
              <button
                key={company.id}
                onClick={() => {
                  setSelectedCompanyId(company.id);
                  setSelectedFactoryId(null);
                  setResult(null);
                }}
                className={cn(
                  "btn-press rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all",
                  selectedCompanyId === company.id
                    ? "border-primary/60 bg-primary/10 text-primary shadow-sm dark:bg-primary/15"
                    : "border-border/60 bg-muted/20 hover:border-primary/30 hover:bg-muted/40"
                )}
              >
                <span className="block truncate">{company.shortName ?? company.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step 2 — Factory (only after company selected) */}
      <AnimatePresence>
        {selectedCompanyId && availableFactories.length > 0 && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
            className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">2</span>
              <h3 className="text-sm font-semibold">工場・ラインを選択</h3>
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
              {availableFactories.map((factory: Factory) => {
                const label = [factory.factoryName, factory.department, factory.lineName]
                  .filter(Boolean)
                  .join(" / ");
                return (
                  <button
                    key={factory.id}
                    onClick={() => {
                      setSelectedFactoryId(factory.id);
                      setResult(null);
                    }}
                    className={cn(
                      "btn-press flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all",
                      selectedFactoryId === factory.id
                        ? "bg-primary/10 text-primary ring-1 ring-primary/20 dark:bg-primary/15"
                        : "hover:bg-muted/40"
                    )}
                  >
                    <Layers className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    <span className="truncate">{label}</span>
                    {factory.hourlyRate && (
                      <span className="ml-auto shrink-0 text-[10px] tabular-nums text-blue-500 dark:text-blue-400">
                        ¥{factory.hourlyRate.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 3 — Options (kobetsuCopies) */}
      <AnimatePresence>
        {selectedFactoryId && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
            className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]"
          >
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">3</span>
              <h3 className="text-sm font-semibold">個別契約書 — 部数</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setKobetsuCopies(1)}
                className={cn(
                  "btn-press flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all",
                  kobetsuCopies === 1
                    ? "border-primary/60 bg-primary/10 dark:bg-primary/15"
                    : "border-border/60 hover:border-primary/30 hover:bg-muted/40"
                )}
              >
                <FileText className={cn("h-6 w-6", kobetsuCopies === 1 ? "text-primary" : "text-muted-foreground/50")} />
                <div>
                  <p className={cn("text-sm font-bold", kobetsuCopies === 1 ? "text-primary" : "")}>1通</p>
                  <p className="text-[10px] text-muted-foreground/60">通常（1部）</p>
                </div>
              </button>
              <button
                onClick={() => setKobetsuCopies(2)}
                className={cn(
                  "btn-press flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all",
                  kobetsuCopies === 2
                    ? "border-primary/60 bg-primary/10 dark:bg-primary/15"
                    : "border-border/60 hover:border-primary/30 hover:bg-muted/40"
                )}
              >
                <div className="relative">
                  <FileText className={cn("h-6 w-6", kobetsuCopies === 2 ? "text-primary" : "text-muted-foreground/50")} />
                  <FileText className={cn("absolute -right-1.5 -top-1.5 h-6 w-6 opacity-50", kobetsuCopies === 2 ? "text-primary" : "text-muted-foreground/30")} />
                </div>
                <div>
                  <p className={cn("text-sm font-bold", kobetsuCopies === 2 ? "text-primary" : "")}>2通</p>
                  <p className="text-[10px] text-muted-foreground/60">派遣先用＋派遣元用</p>
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Diagram — what gets generated */}
      <AnimatePresence>
        {selectedFactoryId && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
          >
            <DocDiagram kobetsuCopies={kobetsuCopies} contractCount={diagContractCount} employeeCount={diagEmployeeCount} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generate button */}
      <AnimatePresence>
        {selectedFactoryId && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
          >
            <button
              onClick={() => generateMutation.mutate()}
              disabled={!canGenerate}
              className="btn-press flex w-full items-center justify-center gap-2.5 rounded-xl bg-primary py-4 text-base font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  生成中... しばらくお待ちください
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  {selectedFactory
                    ? `${[selectedFactory.factoryName, selectedFactory.department, selectedFactory.lineName].filter(Boolean).join(" / ")} — 一括生成`
                    : "工場一括生成"}
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 12 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            className="rounded-xl border border-[color-mix(in_srgb,var(--color-status-ok)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-status-ok)_8%,transparent)] p-4"
          >
            <div className="mb-4 flex items-center gap-2.5">
              <div className="rounded-lg bg-[color-mix(in_srgb,var(--color-status-ok)_15%,transparent)] p-1.5">
                <Check className="h-5 w-5 text-[var(--color-status-ok)]" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--color-status-ok)]">生成完了</h3>
                <p className="text-xs text-[color-mix(in_srgb,var(--color-status-ok)_70%,transparent)]">
                  {result.contractCount}契約 / {result.employeeCount}名 / {result.fileCount}ファイル
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              {[
                { label: "契約数", value: result.contractCount, icon: ClipboardList },
                { label: "従業員", value: result.employeeCount, icon: Users },
                { label: "ファイル", value: result.fileCount, icon: FileText },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-lg bg-white p-3 dark:bg-card/80">
                  <Icon className="mx-auto mb-1 h-4 w-4 text-[var(--color-status-ok)]" />
                  <p className="text-lg font-bold tabular-nums text-[var(--color-status-ok)]">{value}</p>
                  <p className="text-[10px] text-muted-foreground/60">{label}</p>
                </div>
              ))}
            </div>

            {/* ZIP download */}
            <a
              href={result.zipPath}
              download={result.zipFilename}
              className="btn-press flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-status-ok)] py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-[color-mix(in_srgb,var(--color-status-ok)_85%,black)] hover:shadow-md"
            >
              <Download className="h-4 w-4" />
              ZIPをダウンロード — {result.zipFilename}
            </a>
          </motion.div>
        )}

        {generateMutation.isError && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--color-status-error)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-status-error)_8%,transparent)] p-4"
          >
            <div className="rounded-lg bg-[color-mix(in_srgb,var(--color-status-error)_15%,transparent)] p-1.5">
              <AlertCircle className="h-5 w-5 text-[var(--color-status-error)]" />
            </div>
            <p className="text-sm text-[var(--color-status-error)]">
              {generateMutation.error.message}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
