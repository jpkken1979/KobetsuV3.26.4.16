import { Clock, Sparkles, BookmarkPlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type ShiftEntry,
  SHIFT_PATTERN_OPTIONS,
  generateCalendarText,
} from "@/lib/shift-utils";
import { FieldInput, INPUT_CLS, SelectInput } from "./-shared";
import { ShiftManager } from "./-shift-manager";
import type { StepProps } from "./-factory-step-types";

// ─── Step 3: Work ────────────────────────────────────────────────────

export function StepWork({
  form,
  updateForm,
  shifts,
  onShiftsChange,
  onShiftPatternChange,
  shiftTemplatesList,
  onLoadTemplate,
  onSaveTemplate,
  onDeleteTemplate,
}: StepProps & {
  shifts: ShiftEntry[];
  onShiftsChange: (shifts: ShiftEntry[]) => void;
  onShiftPatternChange: (pattern: string | number | null) => void;
  shiftTemplatesList:
    | Array<{
        id: number;
        name: string;
        shiftCount: number;
        workHours: string;
        breakTime: string;
      }>
    | undefined;
  onLoadTemplate: (templateId: number) => void;
  onSaveTemplate: () => void;
  onDeleteTemplate: (id: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FieldInput
          label="勤務日"
          value={form.workDays}
          onChange={(v) => updateForm("workDays", v)}
          placeholder="月～金 等"
        />
        <FieldInput
          label="残業上限"
          value={form.overtimeHours}
          onChange={(v) => updateForm("overtimeHours", v)}
          placeholder="3時間/日、42時間/月 等"
        />
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            就業日外労働
          </label>
          <textarea
            value={String(form.overtimeOutsideDays ?? "")}
            onChange={(e) =>
              updateForm("overtimeOutsideDays", e.target.value || null)
            }
            rows={2}
            className={cn(INPUT_CLS, "resize-y")}
            placeholder="有：休日出勤あり・月2回程度"
          />
        </div>
      </div>

      {/* Calendar */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            カレンダー（就業日）
          </label>
          <button
            type="button"
            onClick={() => updateForm("calendar", generateCalendarText())}
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            <Sparkles className="h-3 w-3" />
            自動生成
          </button>
        </div>
        <textarea
          value={String(form.calendar ?? "")}
          onChange={(e) => updateForm("calendar", e.target.value || null)}
          rows={4}
          className={cn(INPUT_CLS, "resize-y")}
          placeholder="月～金（祝日、年末年始、夏季休業を除く。）別紙ｶﾚﾝﾀﾞｰの通り"
        />
      </div>

      {/* Shift pattern + ShiftManager */}
      <div className="space-y-3 rounded-xl border border-border/40 bg-card/50 p-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-semibold">シフト・休憩管理</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            {shifts.length}シフト
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectInput
            label="シフトパターン"
            value={form.shiftPattern}
            onChange={onShiftPatternChange}
            options={SHIFT_PATTERN_OPTIONS}
            placeholder="プリセットから選択"
          />
          {shiftTemplatesList && shiftTemplatesList.length > 0 && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                保存済みテンプレート
              </label>
              <div className="flex gap-1.5">
                <select
                  className={cn(INPUT_CLS, "flex-1")}
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      onLoadTemplate(Number(e.target.value));
                      e.target.value = "";
                    }
                  }}
                >
                  <option value="">テンプレートから読込...</option>
                  {shiftTemplatesList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}（{t.shiftCount}シフト）
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const id = prompt(
                      "削除するテンプレートIDを入力（" +
                        shiftTemplatesList
                          .map((t) => `${t.id}=${t.name}`)
                          .join(", ") +
                        "）:",
                    );
                    if (id) onDeleteTemplate(Number(id));
                  }}
                  className="rounded-lg border border-red-300 px-2 text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
                  title="テンプレート削除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
        <ShiftManager shifts={shifts} onChange={onShiftsChange} />
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onSaveTemplate}
            className="flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            テンプレート保存
          </button>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground">
            <input
              type="checkbox"
              checked={Boolean(form.hasRobotTraining)}
              onChange={(e) =>
                updateForm("hasRobotTraining", e.target.checked)
              }
              className="h-3.5 w-3.5 rounded border-border accent-primary"
            />
            産業用ロボット特別教育
          </label>
        </div>
      </div>
    </div>
  );
}
