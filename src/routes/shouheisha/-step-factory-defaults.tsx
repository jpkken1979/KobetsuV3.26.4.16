import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface FactoryDefaultsFormProps {
  jobDescription: string;
  shiftPattern: string;
  workHours: string;
  workDays: string;
  workStartTime: string;
  workEndTime: string;
  breakMinutes: string;
  supervisorName: string;
  supervisorDept: string;
  supervisorPhone: string;
  complaintHandlerClient: string;
  complaintHandlerUns: string;
  hakenmotoManager: string;
  safetyMeasures: string;
  terminationMeasures: string;
  responsibilityLevel: string;
  overtimeMax: string;
  welfare: string;
  autoFillEnabled: boolean;
  onChange: (patch: Partial<{
    jobDescription: string;
    shiftPattern: string;
    workHours: string;
    workDays: string;
    workStartTime: string;
    workEndTime: string;
    breakMinutes: string;
    supervisorName: string;
    supervisorDept: string;
    supervisorPhone: string;
    complaintHandlerClient: string;
    complaintHandlerUns: string;
    hakenmotoManager: string;
    safetyMeasures: string;
    terminationMeasures: string;
    responsibilityLevel: string;
    overtimeMax: string;
    welfare: string;
  }>) => void;
  onAutoFillToggle: (enabled: boolean) => void;
  onApplyFactoryDefaults: () => void;
}

function fieldClassName() {
  return "mt-1.5";
}

interface FieldRowProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
}

function FieldRow({ label, value, onChange, multiline, rows = 3, inputMode }: FieldRowProps) {
  if (multiline) {
    return (
      <div>
        <label className="text-sm font-medium">{label}</label>
        <Textarea className={fieldClassName()} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <Input className={fieldClassName()} value={value} onChange={(e) => onChange(e.target.value)} inputMode={inputMode} />
    </div>
  );
}

export function FactoryDefaultsForm({
  jobDescription,
  shiftPattern,
  workHours,
  workDays,
  workStartTime,
  workEndTime,
  breakMinutes,
  supervisorName,
  supervisorDept,
  supervisorPhone,
  complaintHandlerClient,
  complaintHandlerUns,
  hakenmotoManager,
  safetyMeasures,
  terminationMeasures,
  responsibilityLevel,
  overtimeMax,
  welfare,
  autoFillEnabled,
  onChange,
  onAutoFillToggle,
  onApplyFactoryDefaults,
}: FactoryDefaultsFormProps) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">工場の既定値</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            選択中の工場マスタから、台帳にまだいない担当者情報も含めて契約欄へ反映します。ここは必要なら手で上書きできます。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={autoFillEnabled} onCheckedChange={onAutoFillToggle} />
            <span className="text-muted-foreground">自動反映</span>
          </label>
          <Button type="button" variant="outline" onClick={onApplyFactoryDefaults}>
            工場情報を反映
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <section className="rounded-lg border border-border/60 p-4">
          <h3 className="text-sm font-semibold">就業条件</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <FieldRow label="業務内容" value={jobDescription} onChange={(v) => onChange({ jobDescription: v })} multiline rows={3} />
            <FieldRow label="シフトパターン" value={shiftPattern} onChange={(v) => onChange({ shiftPattern: v })} />
            <FieldRow label="勤務時間" value={workHours} onChange={(v) => onChange({ workHours: v })} />
            <FieldRow label="勤務日" value={workDays} onChange={(v) => onChange({ workDays: v })} />
            <FieldRow label="開始時刻" value={workStartTime} onChange={(v) => onChange({ workStartTime: v })} />
            <FieldRow label="終了時刻" value={workEndTime} onChange={(v) => onChange({ workEndTime: v })} />
            <FieldRow label="休憩分" value={breakMinutes} onChange={(v) => onChange({ breakMinutes: v })} inputMode="numeric" />
            <FieldRow label="残業上限" value={overtimeMax} onChange={(v) => onChange({ overtimeMax: v })} />
          </div>
        </section>

        <section className="rounded-lg border border-border/60 p-4">
          <h3 className="text-sm font-semibold">責任者・連絡先</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <FieldRow label="責任区分" value={responsibilityLevel} onChange={(v) => onChange({ responsibilityLevel: v })} />
            <FieldRow label="指揮命令者" value={supervisorName} onChange={(v) => onChange({ supervisorName: v })} />
            <FieldRow label="所属部署" value={supervisorDept} onChange={(v) => onChange({ supervisorDept: v })} />
            <FieldRow label="電話番号" value={supervisorPhone} onChange={(v) => onChange({ supervisorPhone: v })} />
            <FieldRow label="苦情窓口（顧客側）" value={complaintHandlerClient} onChange={(v) => onChange({ complaintHandlerClient: v })} />
            <FieldRow label="苦情窓口（派遣元）" value={complaintHandlerUns} onChange={(v) => onChange({ complaintHandlerUns: v })} />
            <FieldRow label="派遣元責任者" value={hakenmotoManager} onChange={(v) => onChange({ hakenmotoManager: v })} />
          </div>
        </section>

        <section className="rounded-lg border border-border/60 p-4">
          <h3 className="text-sm font-semibold">安全・契約関連</h3>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <FieldRow label="安全衛生措置" value={safetyMeasures} onChange={(v) => onChange({ safetyMeasures: v })} multiline rows={3} />
            <FieldRow label="契約終了措置" value={terminationMeasures} onChange={(v) => onChange({ terminationMeasures: v })} multiline rows={3} />
            <div className="md:col-span-2">
              <FieldRow label="福利厚生" value={welfare} onChange={(v) => onChange({ welfare: v })} multiline rows={3} />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
