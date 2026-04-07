import { useContractFormStore } from "@/stores/contract-form";
import { cn } from "@/lib/utils";
import { Briefcase, Shield, Users, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Holiday periods for major Japanese manufacturers (Toyota-style).
 * [GW, 夏季休暇, 年末年始] — each as [MM-DD start, MM-DD end]
 * 年末年始 end is in the *following* year (e.g. "01-05" = Jan 5 of year+1)
 */
const HOLIDAY_DB: Record<string, [[string, string], [string, string], [string, string]]> = {
  "2019": [["04-27", "05-06"], ["08-09", "08-17"], ["12-26", "01-05"]],
  "2020": [["04-29", "05-06"], ["08-08", "08-16"], ["12-26", "01-05"]],
  "2021": [["04-29", "05-05"], ["08-07", "08-15"], ["12-26", "01-05"]],
  "2022": [["04-29", "05-05"], ["08-08", "08-16"], ["12-26", "01-05"]],
  "2023": [["04-29", "05-05"], ["08-08", "08-16"], ["12-26", "01-05"]],
  "2024": [["04-27", "05-06"], ["08-10", "08-18"], ["12-26", "01-05"]],
  "2025": [["04-29", "05-06"], ["08-08", "08-17"], ["12-27", "01-05"]],
  "2026": [["04-29", "05-05"], ["08-08", "08-16"], ["12-26", "01-05"]],
};

function toJpMD(mmdd: string): string {
  const [m, d] = mmdd.split("-").map(Number);
  return `${m}月${d}日`;
}

function rangeOverlaps(cS: string, cE: string, pS: string, pE: string): boolean {
  return pS <= cE && pE >= cS;
}

/**
 * Auto-generate 就業日 text based on contract period.
 * Always includes 土曜日・日曜日, then adds any of:
 *   GW, 夏季休暇, 年末年始 that fall within [startDate, endDate].
 */
function generateWorkDaysText(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return "";
  const parts: string[] = ["土曜日・日曜日"];
  const sy = new Date(startDate).getFullYear();
  const ey = new Date(endDate).getFullYear();

  for (let y = sy; y <= ey; y++) {
    const db = HOLIDAY_DB[String(y)];
    if (!db) continue;
    const [gw, natsu, nenmatsu] = db;

    // GW (April–May of this year)
    if (rangeOverlaps(startDate, endDate, `${y}-${gw[0]}`, `${y}-${gw[1]}`)) {
      parts.push(`GW（${toJpMD(gw[0])}～${toJpMD(gw[1])}）`);
    }
    // 夏季休暇 (August of this year)
    if (rangeOverlaps(startDate, endDate, `${y}-${natsu[0]}`, `${y}-${natsu[1]}`)) {
      parts.push(`夏季休暇（${toJpMD(natsu[0])}～${toJpMD(natsu[1])}）`);
    }
    // 年末年始 (Dec of this year → Jan of next year)
    if (rangeOverlaps(startDate, endDate, `${y}-${nenmatsu[0]}`, `${y + 1}-${nenmatsu[1]}`)) {
      parts.push(`年末年始（${toJpMD(nenmatsu[0])}～${toJpMD(nenmatsu[1])}）`);
    }
  }

  return parts.join("・");
}

/* Shared input class for consistent styling */
const inputClass =
  "w-full rounded-lg border border-input/80 bg-background px-3 py-2.5 text-sm shadow-xs transition-all placeholder:text-muted-foreground/50 focus:border-primary/30 focus:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10";

export function WorkConditions() {
  const { data, updateField, nextStep, prevStep } = useContractFormStore();

  const legalFields: { value: unknown; allowZero?: boolean }[] = [
    { value: data.workDays },
    { value: data.workStartTime },
    { value: data.workEndTime },
    { value: data.breakMinutes, allowZero: true },
    { value: data.supervisorName },
    { value: data.supervisorDept },
    { value: data.supervisorPhone },
    { value: data.complaintHandlerClient },
    { value: data.complaintHandlerUns },
    { value: data.hakenmotoManager },
    { value: data.safetyMeasures },
    { value: data.terminationMeasures },
    { value: data.jobDescription },
    { value: data.responsibilityLevel },
    { value: data.overtimeMax },
    { value: data.welfare },
  ];
  const filledCount = legalFields.filter(
    ({ value: v, allowZero }) =>
      v !== undefined && v !== null && v !== "" && (allowZero || v !== 0)
  ).length;
  const totalLegal = 16;
  const progressPercent = Math.round((filledCount / totalLegal) * 100);
  const canProceedToNext = filledCount === totalLegal;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">就業条件・法定項目</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            派遣法第26条で定められた必須項目です
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-16 sm:w-24">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  filledCount === totalLegal
                    ? "bg-green-500"
                    : "bg-amber-500"
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <div
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
              filledCount === totalLegal
                ? "bg-green-50 text-green-700 ring-green-200 dark:bg-green-900/50 dark:text-green-300 dark:ring-green-700"
                : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:ring-amber-700"
            )}
          >
            {filledCount}/{totalLegal}
          </div>
        </div>
      </div>

      {/* Section: Work conditions */}
      <fieldset className="space-y-4 rounded-xl border border-border/60 p-4">
        <legend className="flex items-center gap-2 px-2 text-sm font-semibold">
          <Briefcase className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          業務・勤務条件
        </legend>

        <div>
          <label htmlFor="wc-jobDescription" className="mb-1.5 block text-sm font-medium">
            業務の内容 <span className="text-destructive">*</span>
          </label>
          <Textarea
            id="wc-jobDescription"
            value={data.jobDescription}
            onChange={(e) => updateField("jobDescription", e.target.value)}
            rows={3}
            aria-required="true"
            className={inputClass}
            placeholder="NC旋盤を使い、金属部品の加工作業..."
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="wc-responsibilityLevel" className="mb-1.5 block text-sm font-medium">
              責任の程度 <span className="text-destructive">*</span>
            </label>
            <input
              id="wc-responsibilityLevel"
              type="text"
              value={data.responsibilityLevel}
              onChange={(e) =>
                updateField("responsibilityLevel", e.target.value)
              }
              aria-required="true"
              className={inputClass}
              placeholder="班長ではないが、副リーダー"
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="wc-workDays" className="text-sm font-medium">
                就業日 <span className="text-destructive">*</span>
              </label>
              {data.startDate && data.endDate && (
                <button
                  type="button"
                  onClick={() =>
                    updateField("workDays", generateWorkDaysText(data.startDate, data.endDate))
                  }
                  className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  title="契約期間から休日を自動生成"
                >
                  <Sparkles className="h-3 w-3" />
                  自動生成
                </button>
              )}
            </div>
            <input
              id="wc-workDays"
              type="text"
              value={data.workDays}
              onChange={(e) => updateField("workDays", e.target.value)}
              aria-required="true"
              className={inputClass}
              placeholder="月~金（祝日、年末年始を除く）"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="wc-workStartTime" className="mb-1.5 block text-sm font-medium">
              始業時刻 <span className="text-destructive">*</span>
            </label>
            <input
              id="wc-workStartTime"
              type="time"
              value={data.workStartTime}
              onChange={(e) => updateField("workStartTime", e.target.value)}
              aria-required="true"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="wc-workEndTime" className="mb-1.5 block text-sm font-medium">
              終業時刻 <span className="text-destructive">*</span>
            </label>
            <input
              id="wc-workEndTime"
              type="time"
              value={data.workEndTime}
              onChange={(e) => updateField("workEndTime", e.target.value)}
              aria-required="true"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="wc-breakMinutes" className="mb-1.5 block text-sm font-medium">
              休憩時間 (分) <span className="text-destructive">*</span>
            </label>
            <input
              id="wc-breakMinutes"
              type="number"
              value={data.breakMinutes || ""}
              onChange={(e) =>
                updateField("breakMinutes", parseInt(e.target.value) || 0)
              }
              aria-required="true"
              className={inputClass}
              placeholder="45"
            />
          </div>
        </div>

        <div>
          <label htmlFor="wc-overtimeMax" className="mb-1.5 block text-sm font-medium">
            時間外労働の上限 <span className="text-destructive">*</span>
          </label>
          <input
            id="wc-overtimeMax"
            type="text"
            value={data.overtimeMax}
            onChange={(e) => updateField("overtimeMax", e.target.value)}
            aria-required="true"
            className={inputClass}
            placeholder="3時間/日、42時間/月、320時間/年迄"
          />
        </div>
      </fieldset>

      {/* Section: Supervisors */}
      <fieldset className="space-y-4 rounded-xl border border-border/60 p-4">
        <legend className="flex items-center gap-2 px-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          指揮命令者・苦情処理・責任者
        </legend>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="wc-supervisorName" className="mb-1.5 block text-sm font-medium">
              指揮命令者 <span className="text-destructive">*</span>
            </label>
            <input
              id="wc-supervisorName"
              type="text"
              value={data.supervisorName}
              onChange={(e) => updateField("supervisorName", e.target.value)}
              aria-required="true"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="wc-supervisorDept" className="mb-1.5 block text-sm font-medium">
              所属部署 <span className="text-destructive">*</span>
            </label>
            <input
              id="wc-supervisorDept"
              type="text"
              value={data.supervisorDept}
              onChange={(e) => updateField("supervisorDept", e.target.value)}
              aria-required="true"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="wc-supervisorPhone" className="mb-1.5 block text-sm font-medium">
              電話番号 <span className="text-destructive">*</span>
            </label>
            <input
              id="wc-supervisorPhone"
              type="text"
              value={data.supervisorPhone}
              onChange={(e) => updateField("supervisorPhone", e.target.value)}
              aria-required="true"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="wc-complaintHandlerClient" className="mb-1.5 block text-sm font-medium">
              派遣先苦情処理担当 <span className="text-destructive">*</span>
            </label>
            <input
              id="wc-complaintHandlerClient"
              type="text"
              value={data.complaintHandlerClient}
              onChange={(e) =>
                updateField("complaintHandlerClient", e.target.value)
              }
              aria-required="true"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="wc-complaintHandlerUns" className="mb-1.5 block text-sm font-medium">
              派遣元苦情処理担当 <span className="text-destructive">*</span>
            </label>
            <input
              id="wc-complaintHandlerUns"
              type="text"
              value={data.complaintHandlerUns}
              onChange={(e) =>
                updateField("complaintHandlerUns", e.target.value)
              }
              aria-required="true"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="wc-hakenmotoManager" className="mb-1.5 block text-sm font-medium">
              派遣元責任者 <span className="text-destructive">*</span>
            </label>
            <input
              id="wc-hakenmotoManager"
              type="text"
              value={data.hakenmotoManager}
              onChange={(e) => updateField("hakenmotoManager", e.target.value)}
              aria-required="true"
              className={inputClass}
            />
          </div>
        </div>
      </fieldset>

      {/* Section: Safety & Legal */}
      <fieldset className="space-y-4 rounded-xl border border-border/60 p-4">
        <legend className="flex items-center gap-2 px-2 text-sm font-semibold">
          <Shield className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          安全衛生・福利厚生・措置
        </legend>

        <div>
          <label htmlFor="wc-safetyMeasures" className="mb-1.5 block text-sm font-medium">
            安全衛生措置 <span className="text-destructive">*</span>
          </label>
          <Textarea
            id="wc-safetyMeasures"
            value={data.safetyMeasures}
            onChange={(e) => updateField("safetyMeasures", e.target.value)}
            rows={2}
            aria-required="true"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="wc-terminationMeasures" className="mb-1.5 block text-sm font-medium">
            契約解除の措置 <span className="text-destructive">*</span>
          </label>
          <Textarea
            id="wc-terminationMeasures"
            value={data.terminationMeasures}
            onChange={(e) =>
              updateField("terminationMeasures", e.target.value)
            }
            rows={2}
            aria-required="true"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="wc-welfare" className="mb-1.5 block text-sm font-medium">
              福利厚生施設 <span className="text-destructive">*</span>
            </label>
            <input
              id="wc-welfare"
              type="text"
              value={data.welfare}
              onChange={(e) => updateField("welfare", e.target.value)}
              aria-required="true"
              className={inputClass}
              placeholder="食堂、休憩室、更衣室"
            />
          </div>
          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/80 px-4 py-3 transition-colors hover:bg-muted/30">
              <input
                id="wc-isKyoteiTaisho"
                type="checkbox"
                checked={data.isKyoteiTaisho}
                onChange={(e) =>
                  updateField("isKyoteiTaisho", e.target.checked)
                }
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm font-medium">労使協定方式の対象</span>
            </label>
          </div>
        </div>
      </fieldset>

      {/* Compliance warning */}
      {filledCount < totalLegal && (
        <div role="alert" aria-live="polite" className="flex items-start gap-3 rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 dark:border-amber-800/40 dark:bg-amber-950/30">
          <div className="mt-0.5 rounded-lg bg-amber-100 p-1.5 dark:bg-amber-900/50">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-400">
            法定16項目のうち <span className="font-bold">{totalLegal - filledCount}</span>{" "}
            項目が未入力です。すべて入力しないとコンプライアンス違反になる可能性があります。
          </p>
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
          disabled={!canProceedToNext}
        >
          次へ: 料金設定
        </Button>
      </div>
    </div>
  );
}
