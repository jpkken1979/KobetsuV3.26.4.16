import { cn } from "@/lib/utils";
import { Plus, Minus, X } from "lucide-react";
import { type ShiftEntry, uid, calcMinsBetween, composeWorkHoursText, composeFullBreakText } from "@/lib/shift-utils";
import { INPUT_SM_CLS } from "./-shared";

export function ShiftManager({
  shifts,
  onChange,
}: {
  shifts: ShiftEntry[];
  onChange: (s: ShiftEntry[]) => void;
}) {
  const addShift = () => {
    onChange([...shifts, { id: uid(), name: `シフト${shifts.length + 1}`, startTime: "", endTime: "", breaks: [] }]);
  };
  const removeShift = (id: string) => {
    if (shifts.length <= 1) return;
    onChange(shifts.filter((s) => s.id !== id));
  };
  const updateShift = (id: string, field: string, value: string) => {
    onChange(shifts.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };
  const addBreak = (sid: string) => {
    onChange(
      shifts.map((s) =>
        s.id === sid ? { ...s, breaks: [...s.breaks, { id: uid(), startTime: "", endTime: "" }] } : s,
      ),
    );
  };
  const removeBreak = (sid: string, bid: string) => {
    onChange(shifts.map((s) => (s.id === sid ? { ...s, breaks: s.breaks.filter((b) => b.id !== bid) } : s)));
  };
  const updateBreak = (sid: string, bid: string, field: string, value: string) => {
    onChange(
      shifts.map((s) =>
        s.id === sid
          ? { ...s, breaks: s.breaks.map((b) => (b.id === bid ? { ...b, [field]: value } : b)) }
          : s,
      ),
    );
  };

  return (
    <div className="space-y-3">
      {shifts.map((shift, idx) => (
        <div key={shift.id} className="space-y-3 rounded-lg border border-border/50 bg-background p-4">
          {/* Shift header: row 1 — badge + name + delete */}
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
              {idx + 1}
            </div>
            <input
              type="text"
              value={shift.name}
              onChange={(e) => updateShift(shift.id, "name", e.target.value)}
              placeholder="シフト名"
              className={cn(INPUT_SM_CLS, "flex-1 font-medium")}
            />
            <button
              type="button"
              onClick={() => removeShift(shift.id)}
              disabled={shifts.length <= 1}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-900/30"
              aria-label="シフト削除"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Shift header: row 2 — start/end times + duration */}
          <div className="ml-8 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-medium text-muted-foreground/70">開始</label>
              <input
                type="time"
                value={shift.startTime}
                onChange={(e) => updateShift(shift.id, "startTime", e.target.value)}
                className={cn(INPUT_SM_CLS, "w-[7.5rem]")}
              />
            </div>
            <span className="text-xs text-muted-foreground/40">～</span>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-medium text-muted-foreground/70">終了</label>
              <input
                type="time"
                value={shift.endTime}
                onChange={(e) => updateShift(shift.id, "endTime", e.target.value)}
                className={cn(INPUT_SM_CLS, "w-[7.5rem]")}
              />
            </div>
            {shift.startTime && shift.endTime && (
              <span className="rounded-md bg-primary/8 px-2.5 py-1 text-[10px] font-semibold text-primary">
                {calcMinsBetween(shift.startTime, shift.endTime)}分
              </span>
            )}
          </div>

          {/* Break times */}
          <div className="ml-4 space-y-2 border-l-2 border-border/30 pl-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">休憩時間</span>
              <button
                type="button"
                onClick={() => addBreak(shift.id)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/5"
              >
                <Plus className="h-3 w-3" />
                追加
              </button>
            </div>

            {shift.breaks.length === 0 && (
              <p className="text-[11px] italic text-muted-foreground/50">休憩時間が未設定です</p>
            )}

            {shift.breaks.map((brk, bi) => {
              const mins = calcMinsBetween(brk.startTime, brk.endTime);
              return (
                <div key={brk.id} className="flex flex-wrap items-center gap-2">
                  <span className="w-4 text-center text-[10px] text-muted-foreground">{bi + 1}</span>
                  <input
                    type="time"
                    value={brk.startTime}
                    onChange={(e) => updateBreak(shift.id, brk.id, "startTime", e.target.value)}
                    className={cn(INPUT_SM_CLS, "w-[7.5rem]")}
                  />
                  <span className="text-xs text-muted-foreground/40">～</span>
                  <input
                    type="time"
                    value={brk.endTime}
                    onChange={(e) => updateBreak(shift.id, brk.id, "endTime", e.target.value)}
                    className={cn(INPUT_SM_CLS, "w-[7.5rem]")}
                  />
                  {mins > 0 && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {mins}分
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeBreak(shift.id, brk.id)}
                    className="rounded p-1 text-muted-foreground/50 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
                    aria-label="休憩削除"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}

            {shift.breaks.length > 0 && (
              <div className="border-t border-border/30 pt-1.5">
                <span className="text-[11px] font-medium text-primary/70">
                  合計:{" "}
                  {shift.breaks
                    .filter((b) => b.startTime && b.endTime)
                    .reduce((s, b) => s + calcMinsBetween(b.startTime, b.endTime), 0)}
                  分
                </span>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Add shift button */}
      <button
        type="button"
        onClick={addShift}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/60 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
      >
        <Plus className="h-3.5 w-3.5" />
        シフト追加
      </button>

      {/* Auto-generated text preview */}
      {shifts.some((s) => s.startTime && s.endTime) && (
        <div className="space-y-1 rounded-lg bg-primary/[0.06] p-3 dark:bg-primary/[0.08]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/70">
            自動生成テキスト（PDF出力用）
          </p>
          <p className="text-xs text-foreground/70">
            <span className="font-medium">就業時間: </span>
            {composeWorkHoursText(shifts)}
          </p>
          {shifts.some((s) => s.breaks.length > 0) && (
            <p className="whitespace-pre-line text-xs text-foreground/70">
              <span className="font-medium">休憩時間: </span>
              {composeFullBreakText(shifts)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
