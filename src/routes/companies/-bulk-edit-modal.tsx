import { useState, useCallback } from "react";
import { motion, useReducedMotion } from "motion/react";
import { X, Copy, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateFactory } from "@/lib/hooks/use-factories";
import type { Factory as FactoryType } from "@/lib/api";
import {
  type ShiftEntry,
  CONTRACT_PERIOD_OPTIONS,
  uid,
  composeWorkHoursText,
  composeFullBreakText,
  composeBreakForShift,
  primaryBreakMins,
  parseExistingShifts,
} from "@/lib/shift-utils";
import { useShiftTemplates } from "@/lib/hooks/use-shift-templates";
import { ShiftManager } from "./-shift-manager";
import { BULK_FIELDS, INPUT_CLS } from "./-shared";
import type { FormValue } from "./-shared";

export function BulkEditModal({
  factoryName,
  lines,
  onClose,
}: {
  factoryName: string;
  lines: FactoryType[];
  onClose: () => void;
}) {
  const updateMutation = useUpdateFactory();
  const [bulkForm, setBulkForm] = useState<Record<string, unknown>>({});
  const [enabledFields, setEnabledFields] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const shouldReduceMotion = useReducedMotion();

  // Shift management for bulk edit
  const [shiftEnabled, setShiftEnabled] = useState(false);
  const [shifts, setShifts] = useState<ShiftEntry[]>(() => {
    // Initialize from first line's shifts
    if (lines[0]) return parseExistingShifts(lines[0]);
    return [{ id: uid(), name: "日勤", startTime: "", endTime: "", breaks: [] }];
  });
  const { data: shiftTemplatesList } = useShiftTemplates();

  const handleLoadTemplate = useCallback(
    (templateId: string) => {
      if (!templateId || !shiftTemplatesList) return;
      const tpl = shiftTemplatesList.find((t) => t.id === Number(templateId));
      if (!tpl) return;
      const parsed = parseExistingShifts({
        workHours: tpl.workHours,
        breakTimeDay: tpl.breakTime,
        breakTimeNight: null,
        workHoursDay: null,
        workHoursNight: null,
      });
      setShifts(parsed);
    },
    [shiftTemplatesList],
  );

  const toggleField = (key: string) => {
    setEnabledFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        // Pre-fill from first line if not already set
        const first = lines[0] as unknown as Record<string, FormValue>;
        if (bulkForm[key] === undefined && first?.[key] != null) {
          setBulkForm((prev) => ({ ...prev, [key]: first[key] }));
        }
      }
      return next;
    });
  };

  const handleBulkSave = async () => {
    const fieldsToUpdate: Record<string, unknown> = {};
    for (const key of enabledFields) {
      fieldsToUpdate[key] = bulkForm[key] ?? null;
    }

    // Compose shift data if shift editing is enabled
    if (shiftEnabled) {
      fieldsToUpdate.workHours = composeWorkHoursText(shifts);
      if (shifts[0]?.startTime && shifts[0]?.endTime) {
        fieldsToUpdate.workHoursDay = `${shifts[0].startTime}～${shifts[0].endTime}`;
      }
      if (shifts[1]?.startTime && shifts[1]?.endTime) {
        fieldsToUpdate.workHoursNight = `${shifts[1].startTime}～${shifts[1].endTime}`;
      }
      if (shifts.length >= 3) {
        fieldsToUpdate.breakTimeDay = composeFullBreakText(shifts) || null;
        fieldsToUpdate.breakTimeNight = null;
      } else {
        fieldsToUpdate.breakTimeDay = shifts[0]?.breaks.length > 0 ? composeBreakForShift(shifts[0]) || null : null;
        fieldsToUpdate.breakTimeNight = shifts[1]?.breaks.length > 0 ? composeBreakForShift(shifts[1]) || null : null;
      }
      if (!shifts[1] || !shifts[1].startTime) {
        fieldsToUpdate.workHoursNight = null;
        fieldsToUpdate.breakTimeNight = null;
      }
      fieldsToUpdate.breakTime = primaryBreakMins(shifts);
    }

    if (Object.keys(fieldsToUpdate).length === 0) return;

    setProgress({ done: 0, total: lines.length });

    for (let i = 0; i < lines.length; i++) {
      await new Promise<void>((resolve, reject) => {
        updateMutation.mutate(
          { id: lines[i].id, data: fieldsToUpdate },
          {
            onSuccess: () => {
              setProgress({ done: i + 1, total: lines.length });
              resolve();
            },
            onError: (err) => reject(err),
          },
        );
      });
    }

    setTimeout(onClose, 800);
  };

  const isComplete = progress && progress.done === progress.total;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        {...(shouldReduceMotion
          ? {}
          : {
              initial: { opacity: 0 },
              animate: { opacity: 1 },
              exit: { opacity: 0 },
            })}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        {...(shouldReduceMotion
          ? {}
          : {
              initial: { opacity: 0, scale: 0.95, y: 10 },
              animate: { opacity: 1, scale: 1, y: 0 },
              exit: { opacity: 0, scale: 0.95, y: 10 },
              transition: { type: "spring", stiffness: 400, damping: 30 },
            })}
        className="relative z-10 w-full max-w-lg rounded-xl border border-border/60 bg-card shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              <Copy className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">一括設定</h3>
              <p className="text-[11px] text-muted-foreground">
                {factoryName} — {lines.length} ライン
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="閉じる"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {progress ? (
            <div className="space-y-4 py-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                {isComplete ? (
                  <Check className="h-7 w-7 text-emerald-500" />
                ) : (
                  <motion.div
                    animate={shouldReduceMotion ? {} : { rotate: 360 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { repeat: Infinity, duration: 1, ease: "linear" }}
                    className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent"
                  />
                )}
              </div>
              <p className="text-sm font-medium">
                {isComplete ? "更新完了" : `${progress.done}/${progress.total} 更新中...`}
              </p>
              <div className="mx-auto h-2 w-48 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={shouldReduceMotion ? false : { width: 0 }}
                  animate={shouldReduceMotion ? {} : { width: `${(progress.done / progress.total) * 100}%` }}
                  transition={shouldReduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 30 }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                適用するフィールドにチェックを入れて値を設定してください。
                選択されたフィールドのみ全ラインに上書きされます。
              </p>

              {/* Shift/Break bulk edit section */}
              <div
                className={cn(
                  "rounded-lg border p-3 transition-all",
                  shiftEnabled
                    ? "border-amber-500/30 bg-amber-500/[0.06]"
                    : "border-border/40 bg-transparent",
                )}
              >
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={shiftEnabled}
                    onChange={() => setShiftEnabled((v) => !v)}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-medium">シフト・休憩（全ラインに適用）</span>
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                    {shifts.length}シフト
                  </span>
                </label>

                {shiftEnabled && (
                  <div className="mt-3 ml-6 space-y-3">
                    {shiftTemplatesList && shiftTemplatesList.length > 0 && (
                      <select
                        className={cn(INPUT_CLS, "text-xs")}
                        defaultValue=""
                        onChange={(e) => {
                          handleLoadTemplate(e.target.value);
                          e.target.value = "";
                        }}
                      >
                        <option value="">テンプレートから読込...</option>
                        {shiftTemplatesList.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}（{t.shiftCount}シフト）
                          </option>
                        ))}
                      </select>
                    )}
                    <ShiftManager shifts={shifts} onChange={setShifts} />
                  </div>
                )}
              </div>

              {BULK_FIELDS.map((field) => {
                const isEnabled = enabledFields.has(field.key);
                return (
                  <div
                    key={field.key}
                    className={cn(
                      "rounded-lg border p-3 transition-all",
                      isEnabled
                        ? "border-primary/30 bg-primary/[0.06]"
                        : "border-border/40 bg-transparent",
                    )}
                  >
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => toggleField(field.key)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary"
                      />
                      <span className="text-xs font-medium">{field.label}</span>
                    </label>

                    {isEnabled && (
                      <div className="mt-2 ml-6">
                        {field.type === "select" && field.key === "contractPeriod" ? (
                          <select
                            value={String(bulkForm[field.key] ?? "")}
                            onChange={(e) =>
                              setBulkForm((p) => ({ ...p, [field.key]: e.target.value || null }))
                            }
                            className={INPUT_CLS}
                          >
                            <option value="">未設定</option>
                            {CONTRACT_PERIOD_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : field.type === "textarea" ? (
                          <textarea
                            value={String(bulkForm[field.key] ?? "")}
                            onChange={(e) =>
                              setBulkForm((p) => ({ ...p, [field.key]: e.target.value || null }))
                            }
                            rows={2}
                            className={cn(INPUT_CLS, "resize-y")}
                          />
                        ) : (
                          <input
                            type={field.type}
                            value={String(bulkForm[field.key] ?? "")}
                            onChange={(e) =>
                              setBulkForm((p) => ({
                                ...p,
                                [field.key]: e.target.value || null,
                              }))
                            }
                            className={INPUT_CLS}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {!progress && (
          <div className="flex items-center justify-between border-t border-border/40 px-4 py-3">
            <p className="text-[11px] text-muted-foreground">
              {enabledFields.size + (shiftEnabled ? 1 : 0)} フィールド選択中
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="btn-press rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                キャンセル
              </button>
              <button
                onClick={handleBulkSave}
                disabled={enabledFields.size === 0 && !shiftEnabled}
                className="btn-press inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-medium text-white transition-all hover:bg-amber-700 disabled:opacity-40"
              >
                <Copy className="h-3 w-3" />
                {lines.length} ラインに適用
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
