import { Button } from "@/components/ui/button";
import { api, downloadZip } from "@/lib/api";
import type { ByIdsGroup, GenerateByIdsResult, PreviewByIdsResult } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, Archive, Check, ChevronRight, Copy, FileText, Hash, Layers, Loader2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type IdType = "hakensaki" | "hakenmoto";
type Step = "input" | "preview" | "result";

function parseIds(raw: string): string[] {
  return raw
    .split(/[\n,、\s]+/)
    .map((s) => s.trim().replace(/^['"「」]+|['"「」]+$/g, ""))
    .filter(Boolean);
}

// ─── Step 1: Input form ───────────────────────────────────────────────

function InputStep({
  onPreview,
  loading,
}: {
  onPreview: (params: { ids: string[]; idType: IdType; contractStart: string; contractEnd: string }) => void;
  loading: boolean;
}) {
  const [rawIds, setRawIds] = useState("");
  const [idType, setIdType] = useState<IdType>("hakensaki");
  const [contractStart, setContractStart] = useState("2025-10-01");
  const [contractEnd, setContractEnd] = useState("2026-09-30");

  const ids = parseIds(rawIds);

  function handleSubmit() {
    if (ids.length === 0) {
      toast.warning("IDを入力してください");
      return;
    }
    if (!contractStart || !contractEnd) {
      toast.warning("契約期間を設定してください");
      return;
    }
    onPreview({ ids, idType, contractStart, contractEnd });
  }

  return (
    <div className="space-y-4">
      {/* ID type toggle */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-foreground">IDの種類</label>
        <div className="flex gap-2">
          {([
            { value: "hakensaki" as IdType, label: "派遣先ID", desc: "高雄工業など派遣先の社員番号" },
            { value: "hakenmoto" as IdType, label: "派遣元番号", desc: "UNSの社員番号 (例: 250608)" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setIdType(opt.value)}
              className={cn(
                "flex flex-1 flex-col rounded-xl border px-4 py-3 text-left transition-all",
                idType === opt.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/60 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              <span className="text-sm font-semibold">{opt.label}</span>
              <span className="mt-0.5 text-xs opacity-70">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* IDs textarea */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-foreground">
          {idType === "hakensaki" ? "派遣先ID" : "派遣元番号"}
          <span className="ml-2 font-normal text-muted-foreground text-xs">（改行・カンマ・スペース区切り）</span>
        </label>
        <textarea
          value={rawIds}
          onChange={(e) => setRawIds(e.target.value)}
          rows={6}
          placeholder={
            idType === "hakensaki"
              ? "212058\n212059\n212060\n242132\n242133"
              : "250608\n251202\n250607\n250708"
          }
          className="w-full rounded-xl border border-border/60 bg-muted/30 px-4 py-3 font-mono text-sm placeholder:text-muted-foreground/50 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
        />
        {ids.length > 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {ids.length}件 検出
          </p>
        )}
      </div>

      {/* Contract period */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">契約開始日</label>
          <input
            type="date"
            value={contractStart}
            onChange={(e) => setContractStart(e.target.value)}
            className="w-full rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-sm focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">契約終了日</label>
          <input
            type="date"
            value={contractEnd}
            onChange={(e) => setContractEnd(e.target.value)}
            className="w-full rounded-xl border border-border/60 bg-muted/30 px-4 py-2.5 text-sm focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Rule explanation */}
      <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-xs text-muted-foreground leading-relaxed">
        <p className="mb-1 font-semibold text-foreground/70">契約日付のルール</p>
        <ul className="space-y-1 list-none">
          <li>• <span className="text-cyan-400">入社日 &lt; 開始日</span>：契約は <strong>開始日</strong> からスタート（既存社員）</li>
          <li>• <span className="text-blue-400">入社日 ≥ 開始日</span>：契約は <strong>入社日</strong> からスタート（途中入社）</li>
          <li>• 同一工場・同一単価・同一開始日 → <strong>1つの契約</strong>にまとめる</li>
        </ul>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={ids.length === 0 || loading}
        className="w-full"
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ChevronRight className="mr-2 h-4 w-4" />
        )}
        プレビューを確認
      </Button>
    </div>
  );
}

// ─── Step 2: Preview groups ───────────────────────────────────────────

function PreviewStep({
  preview,
  contractStart,
  contractEnd,
  kobetsuCopies,
  onKobetsuCopiesChange,
  onGenerate,
  onBack,
  loading,
}: {
  preview: PreviewByIdsResult;
  contractStart: string;
  contractEnd: string;
  kobetsuCopies: 1 | 2;
  onKobetsuCopiesChange: (v: 1 | 2) => void;
  onGenerate: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
        <div className="flex flex-1 gap-4 text-sm">
          <span><strong className="text-primary">{preview.groups.length}</strong> 契約グループ</span>
          <span className="text-muted-foreground">|</span>
          <span><strong className="text-foreground">{preview.totalEmployees}</strong> 名</span>
          <span className="text-muted-foreground">|</span>
          <span className="text-cyan-400">{contractStart}</span>
          <span className="text-muted-foreground">→</span>
          <span className="text-cyan-400">{contractEnd}</span>
        </div>
      </div>

      {/* Not found IDs */}
      {preview.notFoundIds.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
          <div className="text-sm">
            <p className="font-semibold text-amber-400">見つからないID ({preview.notFoundIds.length}件)</p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{preview.notFoundIds.join(", ")}</p>
          </div>
        </div>
      )}

      {/* Groups list */}
      <div className="space-y-3">
        {preview.groups.map((group, idx) => (
          <GroupCard key={group.groupKey} group={group} index={idx} />
        ))}
      </div>

      {/* kobetsuCopies toggle */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-foreground">個別契約書のコピー数</label>
        <div className="flex gap-2">
          {([
            { value: 1 as const, label: "1通", desc: "通常" },
            { value: 2 as const, label: "2通", desc: "派遣先用 + 派遣元用" },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => onKobetsuCopiesChange(opt.value)}
              className={cn(
                "flex flex-1 flex-col rounded-xl border px-4 py-3 text-left transition-all",
                kobetsuCopies === opt.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/60 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              <span className="text-sm font-semibold">{opt.label}</span>
              <span className="mt-0.5 text-xs opacity-70">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} disabled={loading} className="flex-1">
          戻る
        </Button>
        <Button onClick={onGenerate} disabled={loading} className="flex-1">
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileText className="mr-2 h-4 w-4" />
          )}
          契約書を作成・生成
        </Button>
      </div>
    </div>
  );
}

function GroupCard({ group, index }: { group: ByIdsGroup; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const isNew = group.startDate !== group.endDate && group.employees.some(
    (e) => e.hireDate && e.hireDate === group.startDate
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold truncate">{group.companyName}</span>
            {group.factoryName && (
              <span className="text-xs text-muted-foreground">{group.factoryName}</span>
            )}
            {group.lineName && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs">{group.lineName}</span>
            )}
            {isNew && (
              <span className="rounded-md bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-400">途中入社</span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="text-blue-400 font-mono">¥{group.billingRate.toLocaleString("ja-JP")}/h</span>
            <span>|</span>
            <span className="text-cyan-400">{group.startDate}</span>
            <span>→</span>
            <span className="text-cyan-400">{group.endDate}</span>
            <span>|</span>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{group.employees.length}名</span>
          </div>
        </div>
        <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")} />
      </button>

      {expanded && (
        <div className="border-t border-border/40 px-4 py-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="pb-1.5 text-left font-medium">氏名</th>
                <th className="pb-1.5 text-left font-medium">社員番号</th>
                <th className="pb-1.5 text-left font-medium">派遣先ID</th>
                <th className="pb-1.5 text-left font-medium">入社日</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {group.employees.map((emp) => (
                <tr key={emp.id}>
                  <td className="py-1.5 font-medium">{emp.fullName}</td>
                  <td className="py-1.5 font-mono text-muted-foreground">{emp.employeeNumber}</td>
                  <td className="py-1.5 font-mono text-muted-foreground">{emp.clientEmployeeId ?? "—"}</td>
                  <td className={cn("py-1.5 font-mono", emp.hireDate === group.startDate ? "text-blue-400" : "text-muted-foreground")}>
                    {emp.hireDate ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Result ───────────────────────────────────────────────────

function ResultStep({ result, onReset }: { result: GenerateByIdsResult; onReset: () => void }) {
  return (
    <div className="space-y-4">
      {/* Success header */}
      <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
          <Check className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-foreground">生成完了</p>
          <p className="text-sm text-muted-foreground">
            {result.contractCount}件の契約 · {result.employeeCount}名 · {result.fileCount}ファイル
          </p>
        </div>
      </div>

      {/* Not found warning */}
      {result.notFoundIds.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-400" />
          <div className="text-sm">
            <p className="font-semibold text-amber-400">見つからなかったID ({result.notFoundIds.length}件)</p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{result.notFoundIds.join(", ")}</p>
          </div>
        </div>
      )}

      {/* Created contracts */}
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground/70 flex items-center gap-2">
          <Layers className="h-4 w-4" />
          作成された契約
        </p>
        {result.contracts.map((ct) => (
          <div key={ct.id} className="flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-2.5 text-sm">
            <Copy className="h-4 w-4 shrink-0 text-primary/60" />
            <span className="font-mono text-xs text-primary">{ct.contractNumber}</span>
            <span className="text-muted-foreground">{ct.factoryName}</span>
            <span className="ml-auto text-xs text-cyan-400">{ct.startDate} → {ct.endDate}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" />{ct.employeeCount}</span>
          </div>
        ))}
      </div>

      {/* ZIP download */}
      {result.zipPath && (
        <a
          href={result.zipPath}
          download={result.zipFilename ?? undefined}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
        >
          <Archive className="h-5 w-5" />
          ZIPをダウンロード
          <span className="ml-1 rounded-md bg-primary-foreground/20 px-1.5 py-0.5 text-xs">
            {result.fileCount}ファイル
          </span>
        </a>
      )}

      <Button variant="outline" onClick={onReset} className="w-full">
        新しいセットを作成
      </Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────

export function IdGenerator() {
  const [step, setStep] = useState<Step>("input");
  const [preview, setPreview] = useState<PreviewByIdsResult | null>(null);
  const [result, setResult] = useState<GenerateByIdsResult | null>(null);
  const [params, setParams] = useState<{
    ids: string[];
    idType: IdType;
    contractStart: string;
    contractEnd: string;
  } | null>(null);
  const [kobetsuCopies, setKobetsuCopies] = useState<1 | 2>(1);

  const previewMutation = useMutation({
    mutationFn: (p: { ids: string[]; idType: IdType; contractStart: string; contractEnd: string }) =>
      api.previewByIds(p.ids, p.idType, p.contractStart, p.contractEnd),
    onSuccess: (data) => {
      setPreview(data);
      setStep("preview");
    },
    onError: (err: Error) => {
      toast.error("プレビューに失敗しました", { description: err.message });
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => {
      if (!params) throw new Error("params missing");
      return api.generateByIds(params.ids, params.idType, params.contractStart, params.contractEnd, kobetsuCopies);
    },
    onSuccess: async (data) => {
      setResult(data);
      setStep("result");
      toast.success("生成完了", { description: `${data.contractCount}件の契約書を作成しました` });
      if (data.zipFilename) {
        try {
          await downloadZip([data.zipFilename], data.zipFilename);
        } catch {
          // silent — manual link is available in the result step
        }
      }
    },
    onError: (err: Error) => {
      toast.error("生成に失敗しました", { description: err.message });
    },
  });

  function handlePreview(p: typeof params & {}) {
    setParams(p);
    previewMutation.mutate(p);
  }

  function reset() {
    setStep("input");
    setPreview(null);
    setResult(null);
    setParams(null);
    setKobetsuCopies(1);
  }

  // Step indicator
  const steps = [
    { key: "input", label: "ID入力", icon: Hash },
    { key: "preview", label: "確認", icon: Users },
    { key: "result", label: "完了", icon: Check },
  ] as const;

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
      {/* Header */}
      <div className="border-b border-border/60 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">ID指定 — 契約書一括生成</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              派遣先IDまたは派遣元番号から契約を作成してPDFを生成
            </p>
          </div>
          {/* Step indicator */}
          <div className="hidden sm:flex items-center gap-1.5">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const isActive = s.key === step;
              const isDone = steps.findIndex((x) => x.key === step) > i;
              return (
                <div key={s.key} className="flex items-center gap-1.5">
                  <div className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all",
                    isActive ? "bg-primary text-primary-foreground" :
                    isDone ? "bg-primary/20 text-primary" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {isDone ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <span className={cn("text-xs hidden md:block", isActive ? "text-foreground font-medium" : "text-muted-foreground")}>
                    {s.label}
                  </span>
                  {i < steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {step === "input" && (
          <InputStep
            onPreview={handlePreview}
            loading={previewMutation.isPending}
          />
        )}
        {step === "preview" && preview && params && (
          <PreviewStep
            preview={preview}
            contractStart={params.contractStart}
            contractEnd={params.contractEnd}
            kobetsuCopies={kobetsuCopies}
            onKobetsuCopiesChange={setKobetsuCopies}
            onGenerate={() => generateMutation.mutate()}
            onBack={() => setStep("input")}
            loading={generateMutation.isPending}
          />
        )}
        {step === "result" && result && (
          <ResultStep result={result} onReset={reset} />
        )}
      </div>
    </div>
  );
}
