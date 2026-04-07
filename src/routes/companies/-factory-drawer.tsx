import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useCreateFactory, useUpdateFactory, useFactories } from "@/lib/hooks/use-factories";
import { useShiftTemplates, useCreateShiftTemplate, useDeleteShiftTemplate } from "@/lib/hooks/use-shift-templates";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { X, Save, ChevronLeft, ChevronRight, Check, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { useUnsavedWarning } from "@/lib/hooks/use-unsaved-warning";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import {
  type ShiftEntry,
  SHIFT_PRESETS,
  uid,
  composeWorkHoursText,
  composeBreakForShift,
  composeFullBreakText,
  primaryBreakMins,
  parseExistingShifts,
} from "@/lib/shift-utils";
import {
  WIZARD_STEPS,
  type WizardStep,
  type FormValue,
} from "./-shared";
import {
  StepIdentity,
  StepLocation,
  StepWork,
  StepPersonnel,
  StepContract,
} from "./-factory-wizard-steps";

type FormRecord = Record<string, FormValue>;

const STEP_IDS: WizardStep[] = ["identity", "location", "work", "personnel", "contract"];

// Fields that belong to each step (for completed detection)
const STEP_FIELDS: Record<WizardStep, string[]> = {
  identity: ["factoryName", "department", "lineName"],
  location: ["address", "phone", "hourlyRate", "jobDescription"],
  work: ["workDays", "overtimeHours", "calendar", "shiftPattern"],
  personnel: ["hakensakiManagerName", "supervisorName", "complaintClientName", "managerUnsName", "complaintUnsName"],
  contract: ["conflictDate", "contractPeriod", "closingDayText", "paymentDayText"],
};

export function FactoryDrawer({
  companyId,
  editingId,
  onClose,
}: {
  companyId: number;
  editingId: number | null;
  onClose: () => void;
}) {
  const isEditMode = editingId !== null && editingId > 0;

  const { data: existing, isLoading: isLoadingExisting } = useQuery({
    queryKey: queryKeys.factories.detail(editingId!),
    queryFn: () => api.getFactory(editingId!),
    enabled: isEditMode,
  });

  const { data: factoriesList } = useFactories(companyId);

  const createMutation = useCreateFactory();
  const updateMutation = useUpdateFactory();
  const { data: shiftTemplatesList } = useShiftTemplates();
  const createTemplateMutation = useCreateShiftTemplate();
  const deleteTemplateMutation = useDeleteShiftTemplate();

  const [form, setForm] = useState<FormRecord>(() => {
    if (existing) return { ...existing } as unknown as FormRecord;
    return { companyId };
  });

  const [shifts, setShifts] = useState<ShiftEntry[]>(() => {
    if (existing) return parseExistingShifts(existing);
    return [{ id: uid(), name: "日勤", startTime: "", endTime: "", breaks: [] }];
  });

  const [currentStep, setCurrentStep] = useState<WizardStep>("identity");
  const shouldReduceMotion = useReducedMotion();


  // Detect dirty form for unsaved warning
  const isDirty = useMemo(() => {
    if (!existing) return Object.keys(form).length > 1;
    return JSON.stringify(form) !== JSON.stringify({ ...existing });
  }, [form, existing]);
  useUnsavedWarning(isDirty);

  // Sync form state when async query data loads
  useEffect(() => {
    if (existing) {
      setForm({ ...existing } as unknown as FormRecord);
      setShifts(parseExistingShifts(existing));
    }
  }, [existing]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const updateForm = useCallback(
    (key: string, value: FormValue) => setForm((prev) => ({ ...prev, [key]: value })),
    [],
  );

  // ── Shift Handlers ──

  const handleShiftPatternChange = useCallback(
    (pattern: string | number | null) => {
      updateForm("shiftPattern", pattern);
      const preset = typeof pattern === "string" ? SHIFT_PRESETS[pattern] : undefined;
      if (preset) {
        setShifts(preset.map((p) => ({ ...p, id: uid(), breaks: [] })));
      }
    },
    [updateForm],
  );

  const handleLoadTemplate = useCallback(
    (templateId: number) => {
      if (!templateId || !shiftTemplatesList) return;
      const tpl = shiftTemplatesList.find((t) => t.id === templateId);
      if (!tpl) return;
      const parsed = parseExistingShifts({
        workHours: tpl.workHours,
        breakTimeDay: tpl.breakTime,
        breakTimeNight: null,
        workHoursDay: null,
        workHoursNight: null,
      });
      setShifts(parsed);
      updateForm("shiftPattern", "irregular");
    },
    [shiftTemplatesList, updateForm],
  );

  const handleSaveTemplate = useCallback(() => {
    const name = prompt("テンプレート名を入力してください:");
    if (!name) return;
    createTemplateMutation.mutate({
      name,
      workHours: composeWorkHoursText(shifts),
      breakTime: composeFullBreakText(shifts),
    });
  }, [shifts, createTemplateMutation]);

  // ── Copy from another line ──

  const handleCopyLine = useCallback(
    (factoryId: number) => {
      const source = factoriesList?.find((f) => f.id === factoryId);
      if (!source) return;
      // Copy everything EXCEPT identity fields (factoryName, department, lineName)
      const exclude = new Set(["id", "factoryName", "department", "lineName", "companyId", "createdAt", "updatedAt", "isActive", "company"]);
      const newForm: FormRecord = { ...form };
      for (const [key, val] of Object.entries(source)) {
        if (!exclude.has(key)) {
          newForm[key] = val as FormValue;
        }
      }
      setForm(newForm);
      setShifts(parseExistingShifts(source));
    },
    [factoriesList, form],
  );

  // ── Submit ──

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // Compose shift/break data into DB fields
      const data: Record<string, unknown> = { ...form };
      data.workHours = composeWorkHoursText(shifts);

      if (shifts[0]?.startTime && shifts[0]?.endTime) {
        data.workHoursDay = `${shifts[0].startTime}～${shifts[0].endTime}`;
      }
      if (shifts[1]?.startTime && shifts[1]?.endTime) {
        data.workHoursNight = `${shifts[1].startTime}～${shifts[1].endTime}`;
      }

      // Break data: for 3+ shifts, compose all breaks into breakTimeDay (DB only has 2 fields)
      if (shifts.length >= 3) {
        data.breakTimeDay = composeFullBreakText(shifts) || null;
        data.breakTimeNight = null;
      } else {
        data.breakTimeDay = shifts[0]?.breaks.length > 0
          ? composeBreakForShift(shifts[0]) || null
          : null;
        data.breakTimeNight = shifts[1]?.breaks.length > 0
          ? composeBreakForShift(shifts[1]) || null
          : null;
      }

      // Clear night shift data if only 1 shift
      if (!shifts[1] || !shifts[1].startTime || !shifts[1].endTime) {
        data.workHoursNight = null;
        data.breakTimeNight = null;
      }

      data.breakTime = primaryBreakMins(shifts);

      // Always include companyId so the mutation hook can invalidate role-summary
      data.companyId = companyId;

      if (editingId) {
        updateMutation.mutate({ id: editingId, data }, { onSuccess: handleClose });
      } else {
        createMutation.mutate({ ...data, companyId }, { onSuccess: handleClose });
      }
    },
    [form, shifts, editingId, companyId, createMutation, updateMutation, handleClose],
  );

  // ── Navigation ──

  const currentStepIndex = STEP_IDS.indexOf(currentStep);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEP_IDS.length - 1;

  const completedSteps = useMemo(() => {
    const set = new Set<WizardStep>();
    for (const [step, fields] of Object.entries(STEP_FIELDS)) {
      if (fields.some((f) => form[f] != null && form[f] !== "")) {
        set.add(step as WizardStep);
      }
    }
    return set;
  }, [form]);

  const goNext = useCallback(() => {
    // Validate step 1: factoryName required
    if (currentStep === "identity" && !form.factoryName) return;
    if (!isLastStep) {
      setCurrentStep(STEP_IDS[currentStepIndex + 1]);
    }
  }, [currentStep, currentStepIndex, isLastStep, form.factoryName]);

  const goPrev = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStep(STEP_IDS[currentStepIndex - 1]);
    }
  }, [currentStepIndex, isFirstStep]);

  const onStepClick = useCallback(
    (step: WizardStep) => {
      if (isEditMode) {
        setCurrentStep(step);
        return;
      }
      // Create mode: allow click on completed steps or current step or next step
      const targetIdx = STEP_IDS.indexOf(step);
      if (targetIdx <= currentStepIndex || completedSteps.has(step)) {
        setCurrentStep(step);
      }
    },
    [isEditMode, currentStepIndex, completedSteps],
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  const drawerTitle = editingId
    ? form.factoryName
      ? `${form.factoryName}${form.department ? ` / ${form.department}` : ""}${form.lineName ? ` / ${form.lineName}` : ""}`
      : "工場・ライン編集"
    : "工場・ライン新規登録";

  // Other factories for "copy from line" feature
  const companyFactories = useMemo(
    () =>
      (factoriesList ?? [])
        .filter((f) => !editingId || f.id !== editingId)
        .map((f) => ({
          id: f.id,
          factoryName: f.factoryName,
          department: f.department,
          lineName: f.lineName,
        })),
    [factoriesList, editingId],
  );

  // Direction for animation
  const prevStepIndexRef = useRef(0);
  const direction = currentStepIndex >= prevStepIndexRef.current ? 1 : -1;
  useEffect(() => {
    prevStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  return (
    <Dialog
      open
      onClose={handleClose}
      className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl p-0"
    >
      {/* ── Sticky header ── */}
      <div className="flex shrink-0 flex-row items-center justify-between border-b border-border/40 px-6 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-foreground">{drawerTitle}</h2>
          <p className="text-[11px] text-muted-foreground">
            {editingId ? "編集モード" : "新規登録"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="btn-press rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => {
              const formEl = document.getElementById("factory-drawer-form") as HTMLFormElement;
              if (formEl) formEl.requestSubmit();
            }}
            disabled={isPending}
            className="btn-press inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {isPending ? "保存中..." : editingId ? "更新" : "登録"}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="btn-press ml-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Wizard Progress ── */}
      <div className="shrink-0 border-b border-border/30 px-4 py-3">
        <div className="flex items-center justify-between">
          {WIZARD_STEPS.map((step, idx) => {
            const isActive = currentStep === step.id;
            const isCompleted = completedSteps.has(step.id) && !isActive;
            const isClickable = isEditMode || idx <= currentStepIndex || completedSteps.has(step.id);
            const Icon = step.icon;
            return (
              <div key={step.id} className="flex items-center gap-0">
                <button
                  type="button"
                  onClick={() => onStepClick(step.id)}
                  disabled={!isClickable}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : isCompleted
                        ? "text-primary/70 hover:bg-primary/5"
                        : isClickable
                          ? "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          : "cursor-not-allowed text-muted-foreground/40",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : isCompleted
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Icon className="h-3 w-3" />
                    )}
                  </div>
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.labelShort}</span>
                </button>
                {idx < WIZARD_STEPS.length - 1 && (
                  <div
                    className={cn(
                      "mx-1 h-px w-6 transition-colors",
                      idx < currentStepIndex ? "bg-primary/40" : "bg-border/40",
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <form
        id="factory-drawer-form"
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/30"
      >
        {/* Loading skeleton for edit mode */}
        {isEditMode && isLoadingExisting ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/30" />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              {...(shouldReduceMotion
                ? {}
                : {
                    initial: { opacity: 0, x: direction * 24 },
                    animate: { opacity: 1, x: 0 },
                    exit: { opacity: 0, x: direction * -24 },
                    transition: { duration: 0.15 },
                  })}
            >
              {currentStep === "identity" && (
                <StepIdentity
                  form={form}
                  updateForm={updateForm}
                  companyFactories={companyFactories}
                  onCopyLine={handleCopyLine}
                />
              )}
              {currentStep === "location" && (
                <StepLocation form={form} updateForm={updateForm} />
              )}
              {currentStep === "work" && (
                <StepWork
                  form={form}
                  updateForm={updateForm}
                  shifts={shifts}
                  onShiftsChange={setShifts}
                  onShiftPatternChange={handleShiftPatternChange}
                  shiftTemplatesList={shiftTemplatesList}
                  onLoadTemplate={handleLoadTemplate}
                  onSaveTemplate={handleSaveTemplate}
                  onDeleteTemplate={(id) => deleteTemplateMutation.mutate(id)}
                />
              )}
              {currentStep === "personnel" && (
                <StepPersonnel
                  form={form}
                  updateForm={updateForm}
                  editingId={editingId}
                  companyId={companyId}
                />
              )}
              {currentStep === "contract" && (
                <StepContract form={form} updateForm={updateForm} />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </form>

      {/* ── Footer ── */}
      <div className="flex shrink-0 items-center justify-between border-t border-border/40 px-6 py-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={isFirstStep}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            isFirstStep
              ? "cursor-not-allowed text-muted-foreground/30"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          前へ
        </button>

        <span className="text-[11px] text-muted-foreground">
          ステップ {currentStepIndex + 1} / {STEP_IDS.length}
        </span>

        <div className="flex items-center gap-2">
          {!isFirstStep && !isLastStep && (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] text-muted-foreground/60 transition-colors hover:bg-muted/30 hover:text-muted-foreground"
            >
              <SkipForward className="h-3 w-3" />
              スキップ
            </button>
          )}
          {isLastStep ? (
            <button
              type="button"
              onClick={() => {
                const formEl = document.getElementById("factory-drawer-form") as HTMLFormElement;
                if (formEl) formEl.requestSubmit();
              }}
              disabled={isPending}
              className="btn-press inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {isPending ? "保存中..." : editingId ? "更新" : "登録"}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="btn-press inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-all hover:bg-primary/90"
            >
              次へ
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
