import { cn } from "@/lib/utils";
import { FieldInput, INPUT_CLS } from "./-shared";
import type { StepProps } from "./-factory-step-types";

// ─── Step 2: Location ────────────────────────────────────────────────

export function StepLocation({ form, updateForm }: StepProps) {
  return (
    <div className="space-y-4">
      <FieldInput
        label="住所"
        value={form.address}
        onChange={(v) => updateForm("address", v)}
      />
      <FieldInput
        label="電話番号"
        value={form.phone}
        onChange={(v) => updateForm("phone", v)}
      />
      <FieldInput
        label="時給（基本単価）"
        value={form.hourlyRate}
        onChange={(v) => updateForm("hourlyRate", v)}
        type="number"
        placeholder="1600"
      />
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          仕事内容
        </label>
        <textarea
          value={String(form.jobDescription ?? "")}
          onChange={(e) =>
            updateForm("jobDescription", e.target.value || null)
          }
          rows={3}
          className={cn(INPUT_CLS, "resize-y")}
        />
      </div>
    </div>
  );
}
