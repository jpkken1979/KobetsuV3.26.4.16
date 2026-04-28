import { ParticleBurst } from "@/components/ui/particle-burst";
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
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Download,
  FileText,
  Layers,
  Loader2,
  Sparkles,
  Square,
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

// ─── Helpers ─────────────────────────────────────────────────────────

interface FactoryGroup {
  factoryName: string;
  factories: Factory[];
}

function groupFactoriesByName(factories: Factory[]): FactoryGroup[] {
  const map = new Map<string, Factory[]>();
  for (const f of factories) {
    const key = f.factoryName ?? "(未指定)";
    const arr = map.get(key) ?? [];
    arr.push(f);
    map.set(key, arr);
  }
  return Array.from(map.entries())
    .map(([factoryName, list]) => ({
      factoryName,
      factories: list.sort((a, b) =>
        `${a.department ?? ""}/${a.lineName ?? ""}`.localeCompare(`${b.department ?? ""}/${b.lineName ?? ""}`)
      ),
    }))
    .sort((a, b) => a.factoryName.localeCompare(b.factoryName));
}

// ─── Main factory generator component ────────────────────────────────

export function FactoryGenerator() {
  const shouldReduceMotion = useReducedMotion();
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [selectedFactoryIds, setSelectedFactoryIds] = useState<Set<number>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
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

  const factoryGroups = useMemo(() => groupFactoriesByName(availableFactories), [availableFactories]);

  const factoryIdArray = useMemo(() => Array.from(selectedFactoryIds), [selectedFactoryIds]);

  const generateMutation = useMutation({
    mutationFn: () => api.generateFactory(factoryIdArray, kobetsuCopies),
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

  const canGenerate = factoryIdArray.length > 0 && !generateMutation.isPending;

  // Counts for diagram (best-effort placeholders — backend filters actives)
  const diagContractCount = factoryIdArray.length;
  const diagEmployeeCount = 1;

  const toggleFactoryId = (id: number) => {
    setSelectedFactoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setResult(null);
  };

  const toggleGroup = (group: FactoryGroup) => {
    const groupIds = group.factories.map((f) => f.id);
    const allSelected = groupIds.every((id) => selectedFactoryIds.has(id));
    setSelectedFactoryIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of groupIds) next.delete(id);
      } else {
        for (const id of groupIds) next.add(id);
      }
      return next;
    });
    setResult(null);
  };

  const toggleCollapse = (factoryName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(factoryName)) next.delete(factoryName);
      else next.add(factoryName);
      return next;
    });
  };

  // Build label for the generate button
  const generateLabel = useMemo(() => {
    if (factoryIdArray.length === 0) return "工場一括生成";
    const selectedFactories = availableFactories.filter((f) => selectedFactoryIds.has(f.id));
    const distinctFactoryNames = new Set(selectedFactories.map((f) => f.factoryName));
    if (selectedFactories.length === 1) {
      const f = selectedFactories[0];
      return `${[f.factoryName, f.department, f.lineName].filter(Boolean).join(" / ")} — 一括生成`;
    }
    if (distinctFactoryNames.size === 1) {
      const name = distinctFactoryNames.values().next().value as string;
      const totalInFactory = availableFactories.filter((f) => f.factoryName === name).length;
      const isWhole = selectedFactories.length === totalInFactory;
      return isWhole
        ? `${name} 工場全体 (${selectedFactories.length}ライン) — 一括生成`
        : `${name} (${selectedFactories.length}/${totalInFactory}ライン) — 一括生成`;
    }
    return `${selectedFactories.length}ライン選択 — 一括生成`;
  }, [factoryIdArray, availableFactories, selectedFactoryIds]);

  return (
    <div className="space-y-4">
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
                  setSelectedFactoryIds(new Set());
                  setCollapsedGroups(new Set());
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

      {/* Step 2 — Factory groups + lines (multi-select) */}
      <AnimatePresence>
        {selectedCompanyId && availableFactories.length > 0 && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
            className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">2</span>
                <h3 className="text-sm font-semibold">工場・ラインを選択（複数可）</h3>
              </div>
              {factoryIdArray.length > 0 && (
                <button
                  onClick={() => {
                    setSelectedFactoryIds(new Set());
                    setResult(null);
                  }}
                  className="text-[10px] font-medium text-muted-foreground/70 hover:text-foreground"
                >
                  クリア
                </button>
              )}
            </div>

            <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
              {factoryGroups.map((group) => {
                const groupIds = group.factories.map((f) => f.id);
                const selectedInGroup = groupIds.filter((id) => selectedFactoryIds.has(id)).length;
                const allSelected = selectedInGroup === groupIds.length;
                const someSelected = selectedInGroup > 0 && !allSelected;
                const isCollapsed = collapsedGroups.has(group.factoryName);

                return (
                  <div
                    key={group.factoryName}
                    className={cn(
                      "rounded-lg border transition-colors",
                      allSelected
                        ? "border-primary/40 bg-primary/5 dark:bg-primary/10"
                        : someSelected
                          ? "border-primary/25 bg-muted/30"
                          : "border-border/60"
                    )}
                  >
                    {/* Group header — toggles entire factory */}
                    <div className="flex items-center gap-2 px-3 py-2">
                      <button
                        onClick={() => toggleGroup(group)}
                        className="btn-press flex flex-1 items-center gap-2 text-left"
                      >
                        {allSelected ? (
                          <CheckSquare className="h-4 w-4 shrink-0 text-primary" />
                        ) : someSelected ? (
                          <CheckSquare className="h-4 w-4 shrink-0 text-primary/50" />
                        ) : (
                          <Square className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                        )}
                        <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
                        <span className="text-sm font-semibold">{group.factoryName}</span>
                        <span className="text-[10px] tabular-nums text-muted-foreground/60">
                          {selectedInGroup}/{groupIds.length}ライン
                        </span>
                      </button>
                      <button
                        onClick={() => toggleCollapse(group.factoryName)}
                        className="btn-press rounded p-1 text-muted-foreground/50 hover:text-foreground"
                        aria-label={isCollapsed ? "展開" : "折りたたむ"}
                      >
                        <ChevronDown
                          className={cn("h-4 w-4 transition-transform", isCollapsed && "-rotate-90")}
                        />
                      </button>
                    </div>

                    {/* Lines list */}
                    {!isCollapsed && (
                      <div className="border-t border-border/40 px-2 py-1.5">
                        {group.factories.map((factory) => {
                          const isSelected = selectedFactoryIds.has(factory.id);
                          const label = [factory.department, factory.lineName].filter(Boolean).join(" / ") || "(ライン名なし)";
                          return (
                            <button
                              key={factory.id}
                              onClick={() => toggleFactoryId(factory.id)}
                              className={cn(
                                "btn-press flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-all",
                                isSelected
                                  ? "bg-primary/10 text-primary dark:bg-primary/15"
                                  : "hover:bg-muted/40"
                              )}
                            >
                              {isSelected ? (
                                <CheckSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
                              ) : (
                                <Square className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                              )}
                              <Layers className="h-3 w-3 shrink-0 opacity-50" />
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
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 3 — Options (kobetsuCopies) */}
      <AnimatePresence>
        {factoryIdArray.length > 0 && (
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
        {factoryIdArray.length > 0 && (
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
        {factoryIdArray.length > 0 && (
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
                  {generateLabel}
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
            className="relative rounded-xl border border-[color-mix(in_srgb,var(--color-status-ok)_30%,transparent)] bg-[color-mix(in_srgb,var(--color-status-ok)_8%,transparent)] p-4"
          >
            <ParticleBurst trigger={!!result} />
            <div className="mb-4 flex items-center gap-2.5">
              <div className="rounded-lg bg-[color-mix(in_srgb,var(--color-status-ok)_15%,transparent)] p-1.5">
                <Check className="h-5 w-5 text-[var(--color-status-ok)]" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--color-status-ok)]">生成完了</h3>
                <p className="text-xs text-[color-mix(in_srgb,var(--color-status-ok)_70%,transparent)]">
                  {result.lineCount && result.lineCount > 1 ? `${result.lineCount}ライン / ` : ""}
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
