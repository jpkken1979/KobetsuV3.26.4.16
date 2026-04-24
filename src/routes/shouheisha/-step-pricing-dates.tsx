import { ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { calculateContractDates, calculateDefaultEndDate } from "@/lib/contract-dates";

function fieldClassName() {
  return "mt-1.5";
}

interface PricingDatesFormProps {
  hourlyRate: string;
  billingRate: string;
  startDate: string;
  endDate: string;
  contractDateOverride: string;
  includeShugyojoken: boolean;
  notes: string;
  onHourlyRateChange: (v: string) => void;
  onBillingRateChange: (v: string) => void;
  onStartDateChange: (v: string) => void;
  onEndDateChange: (v: string) => void;
  onContractDateOverrideChange: (v: string) => void;
  onIncludeShugyojokenChange: (v: boolean) => void;
  onNotesChange: (v: string) => void;
}

export function PricingDatesForm({
  hourlyRate,
  billingRate,
  startDate,
  endDate,
  contractDateOverride,
  includeShugyojoken,
  notes,
  onHourlyRateChange,
  onBillingRateChange,
  onStartDateChange,
  onEndDateChange,
  onContractDateOverrideChange,
  onIncludeShugyojokenChange,
  onNotesChange,
}: PricingDatesFormProps) {
  const contractDates = startDate ? calculateContractDates(startDate) : null;

  const handleStartDateChange = (value: string) => {
    onStartDateChange(value);
    if (!endDate && value) {
      onEndDateChange(calculateDefaultEndDate(value));
    }
  };

  return (
    <>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">価格と期間</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          開始日から契約日と通知日を自動計算します。すべての招聘者に同じ価格・期間が適用されます。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
        <div>
          <label className="text-sm font-medium">時給（支給）</label>
          <Input className={fieldClassName()} inputMode="decimal" value={hourlyRate} onChange={(e) => onHourlyRateChange(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">請求単価（契約書反映）</label>
          <Input className={fieldClassName()} inputMode="decimal" value={billingRate} onChange={(e) => onBillingRateChange(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">契約開始日</label>
          <Input className={fieldClassName()} type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">契約終了日</label>
          <Input className={fieldClassName()} type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} />
        </div>
        <div className="md:col-span-2 xl:col-span-1">
          <label className="text-sm font-medium">契約日（作成日・任意）</label>
          <Input
            className={fieldClassName()}
            type="date"
            value={contractDateOverride}
            onChange={(e) => onContractDateOverrideChange(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            空欄なら「契約開始日の2営業日前」で自動計算します。入力した場合、通知日も同じ日付になります。
          </p>
        </div>
      </div>

      {contractDates && (
        <div className="mt-4 rounded-lg bg-muted/30 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {contractDateOverride ? "反映される日付" : "自動計算"}
          </div>
          <div className="mt-2 grid gap-2 text-muted-foreground md:grid-cols-2">
            <div>
              契約日: {contractDateOverride || contractDates.contractDate}
              {contractDateOverride && <span className="ml-2 text-xs uppercase tracking-wide text-primary">手動</span>}
            </div>
            <div>
              通知日: {contractDateOverride || contractDates.notificationDate}
              {contractDateOverride && <span className="ml-2 text-xs uppercase tracking-wide text-primary">手動</span>}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-dashed border-border/60 bg-background/50 p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={includeShugyojoken}
            onChange={(e) => onIncludeShugyojokenChange(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-border"
          />
          <span>
            <span className="block text-sm font-medium">就業条件明示書も作成する</span>
            <span className="block text-xs text-muted-foreground">
              生成が通れば、個別契約書セットと一緒に出します。
            </span>
          </span>
        </label>
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium">補足メモ</label>
        <Textarea
          className={fieldClassName()}
          rows={4}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="必要なら契約の補足を残してください"
        />
      </div>
    </>
  );
}
