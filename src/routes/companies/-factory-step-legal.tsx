import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTRACT_PERIOD_OPTIONS } from "@/lib/shift-utils";
import { FieldInput, INPUT_CLS, SelectInput } from "./-shared";
import type { StepProps } from "./-factory-step-types";

// ─── Step 5: Contract ────────────────────────────────────────────────

const TIME_UNIT_BUTTONS = [
  { value: "15", label: "15分" },
  { value: "30", label: "30分" },
  { value: "60", label: "1時間" },
];

export function StepContract({ form, updateForm }: StepProps) {
  const currentTimeUnit =
    form.timeUnit != null ? String(form.timeUnit) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldInput
          label="抵触日"
          value={form.conflictDate}
          onChange={(v) => updateForm("conflictDate", v)}
          type="date"
        />
        <SelectInput
          label="契約期間"
          value={form.contractPeriod}
          onChange={(v) => updateForm("contractPeriod", v)}
          options={CONTRACT_PERIOD_OPTIONS}
        />
        <FieldInput
          label="締め日"
          value={form.closingDayText ?? form.closingDay}
          onChange={(v) => updateForm("closingDayText", v)}
          placeholder="15日"
        />
        <FieldInput
          label="支払日"
          value={form.paymentDayText ?? form.paymentDay}
          onChange={(v) => updateForm("paymentDayText", v)}
          placeholder="当月末日"
        />
      </div>

      {/* Time unit toggle buttons */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          丸め単位
        </label>
        <div className="flex gap-1.5">
          {TIME_UNIT_BUTTONS.map((btn) => (
            <button
              key={btn.value}
              type="button"
              onClick={() => updateForm("timeUnit", btn.value)}
              className={cn(
                "rounded-lg border px-4 py-2 text-xs font-medium transition-all",
                currentTimeUnit === btn.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          振込先
        </label>
        <input
          type="text"
          value={String(form.bankAccount ?? "")}
          onChange={(e) =>
            updateForm("bankAccount", e.target.value || null)
          }
          className={INPUT_CLS}
          placeholder="愛知銀行　当知支店　普通2075479　名義人　ユニバーサル企画（株）"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldInput
          label="締め日 (数値)"
          value={form.closingDay}
          onChange={(v) => updateForm("closingDay", v)}
          type="number"
          placeholder="15"
        />
        <FieldInput
          label="支払日 (数値)"
          value={form.paymentDay}
          onChange={(v) => updateForm("paymentDay", v)}
          type="number"
          placeholder="25"
        />
      </div>

      <FieldInput
        label="当該協定期間"
        value={form.agreementPeriodEnd}
        onChange={(v) => updateForm("agreementPeriodEnd", v)}
        placeholder="2026年4月1日～2027年3月31日"
      />

      {/* Worker settings sub-section */}
      <div className="border-t border-border/30 pt-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-foreground/70">
          <Users className="h-3.5 w-3.5 text-blue-500" />
          作業者向け設定
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FieldInput
            label="作業者締め日"
            value={form.workerClosingDay}
            onChange={(v) => updateForm("workerClosingDay", v)}
            placeholder="末日"
          />
          <FieldInput
            label="作業者支払日"
            value={form.workerPaymentDay}
            onChange={(v) => updateForm("workerPaymentDay", v)}
            placeholder="翌月15日"
          />
          <FieldInput
            label="作業者カレンダー"
            value={form.workerCalendar}
            onChange={(v) => updateForm("workerCalendar", v)}
            placeholder="工場カレンダーに準ずる"
          />
        </div>
      </div>
    </div>
  );
}
