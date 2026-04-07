import { Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldInput, INPUT_CLS } from "./-shared";
import type { StepProps } from "./-factory-step-types";

// ─── Step 1: Identity ────────────────────────────────────────────────

export function StepIdentity({
  form,
  updateForm,
  companyFactories,
  onCopyLine,
}: StepProps & {
  companyFactories: Array<{
    id: number;
    factoryName: string;
    department: string | null;
    lineName: string | null;
  }>;
  onCopyLine: (factoryId: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FieldInput
          label="工場名"
          value={form.factoryName}
          onChange={(v) => updateForm("factoryName", v)}
          required
        />
        <FieldInput
          label="配属先"
          value={form.department}
          onChange={(v) => updateForm("department", v)}
        />
        <FieldInput
          label="ライン"
          value={form.lineName}
          onChange={(v) => updateForm("lineName", v)}
        />
      </div>

      {/* Copy from another line */}
      {companyFactories.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card/50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Copy className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold">
              別のラインからコピー
            </span>
          </div>
          <select
            className={cn(INPUT_CLS, "text-xs")}
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                onCopyLine(Number(e.target.value));
                e.target.value = "";
              }
            }}
          >
            <option value="">コピー元を選択...</option>
            {companyFactories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.factoryName}
                {f.department ? ` / ${f.department}` : ""}
                {f.lineName ? ` / ${f.lineName}` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            工場名・配属先・ラインを除く全データがコピーされます
          </p>
        </div>
      )}

      {/* Hint */}
      <div className="rounded-lg border-l-3 border-primary bg-primary/5 p-3 text-[11px] text-muted-foreground">
        工場名 + 配属先 + ライン
        の組み合わせがユニークIDになります
      </div>
    </div>
  );
}
