import { useContractFormStore } from "@/stores/contract-form";
import { cn } from "@/lib/utils";
import { Calculator, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

const RATE_LABELS: { key: string; label: string; multiplier: string; accent: string }[] = [
  { key: "hourlyRate", label: "基本時給", multiplier: "x1.00", accent: "border-primary/20 bg-primary/[0.03]" },
  { key: "overtimeRate", label: "残業 (25%増)", multiplier: "x1.25", accent: "border-border/60" },
  { key: "nightShiftRate", label: "深夜 (25%増)", multiplier: "x1.25", accent: "border-border/60" },
  { key: "holidayRate", label: "休日 (35%増)", multiplier: "x1.35", accent: "border-border/60" },
];

export function RatePreview() {
  const { data, updateField, nextStep, prevStep } = useContractFormStore();

  const handleBaseRateChange = (newRate: number) => {
    updateField("hourlyRate", newRate);
    updateField("overtimeRate", Math.round(newRate * 1.25));
    updateField("nightShiftRate", Math.round(newRate * 1.25));
    updateField("holidayRate", Math.round(newRate * 1.35));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">料金設定（基準単価）</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          工場のデフォルト単価です。社員ごとの単価が異なる場合は、次のステップで自動的に分割されます。
        </p>
      </div>

      {/* Rate grouping notice */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/[0.06] p-4 dark:bg-primary/[0.08]">
        <div className="mt-0.5 rounded-lg bg-primary/10 p-1.5">
          <Info className="h-4 w-4 text-primary" />
        </div>
        <div className="text-sm text-foreground/80">
          <p className="font-semibold">社員の単価が優先されます</p>
          <p className="mt-0.5 text-muted-foreground">
            社員台帳（Excel）からインポートした個別の単価がある場合、その単価が使用されます。
            単価が異なる社員は自動的に別の個別契約書に分割されます。
          </p>
        </div>
      </div>

      {/* Rate cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {RATE_LABELS.map((rate) => {
          const value =
            data[rate.key as keyof typeof data] as number;
          const isBase = rate.key === "hourlyRate";

          return (
            <div
              key={rate.key}
              className={cn(
                "rounded-xl border p-4 shadow-[var(--shadow-card)] transition-all",
                rate.accent,
                isBase && "ring-1 ring-primary/10"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{rate.label}</span>
                <span className="text-xs text-muted-foreground">
                  {rate.multiplier}
                </span>
              </div>
              <div className="mt-4">
                {isBase ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg text-muted-foreground">¥</span>
                    <input
                      type="number"
                      aria-label="基本時給"
                      value={value || ""}
                      onChange={(e) =>
                        handleBaseRateChange(parseInt(e.target.value, 10) || 0)
                      }
                      className="w-full border-b-2 border-primary/40 bg-transparent font-mono text-3xl font-bold text-primary tabular-nums outline-none transition-colors focus:border-primary"
                      step={50}
                    />
                  </div>
                ) : (
                  <p className="font-mono text-3xl font-bold text-primary tabular-nums">
                    <span className="text-lg text-muted-foreground">¥</span>
                    {value?.toLocaleString() || "0"}
                  </p>
                )}
                <p className="mt-1.5 text-xs text-muted-foreground">/時間</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 60h+ rate */}
      <div className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-muted p-1.5">
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </div>
          <span className="text-sm font-medium">
            月60時間超残業 (50%増)
          </span>
          <span className="text-xs text-muted-foreground">
            x1.50
          </span>
          <span className="ml-auto font-mono text-2xl font-bold text-primary tabular-nums">
            ¥{data.hourlyRate ? Math.round(data.hourlyRate * 1.5).toLocaleString() : "0"}
          </span>
          <span className="text-xs text-muted-foreground">/時間</span>
        </div>
      </div>

      {/* Monthly estimate */}
      {data.hourlyRate > 0 && (
        <div className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
          <h3 className="mb-4 text-sm font-semibold text-muted-foreground">
            月額見積り (参考)
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "160h/月 (標準)", value: data.hourlyRate * 160 },
              { label: "176h/月 (残業16h)", value: data.hourlyRate * 160 + data.overtimeRate * 16 },
              { label: "200h/月 (残業40h)", value: data.hourlyRate * 160 + data.overtimeRate * 40 },
            ].map((est) => (
              <div key={est.label} className="rounded-lg bg-muted/30 p-3 text-center">
                <p className="text-[11px] text-muted-foreground">{est.label}</p>
                <p className="mt-1 text-lg font-bold tabular-nums">
                  ¥{est.value.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" size="lg" onClick={prevStep}>
          戻る
        </Button>
        <Button
          size="lg"
          onClick={nextStep}
          disabled={!data.hourlyRate}
        >
          次へ: 派遣社員選択
        </Button>
      </div>
    </div>
  );
}
