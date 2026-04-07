import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useContractFormStore } from "@/stores/contract-form";
import { CascadingSelect } from "./cascading-select";
import { DateCalculator } from "./date-calculator";
import { WorkConditions } from "./work-conditions";
import { RatePreview } from "./rate-preview";
import { EmployeeSelector } from "./employee-selector";
import { ContractPreview } from "./contract-preview";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEPS = [
  { id: 1, title: "派遣先選択", description: "企業・工場・ラインを選択" },
  { id: 2, title: "契約期間", description: "開始日・終了日・契約日" },
  { id: 3, title: "就業条件", description: "勤務時間・業務内容・法定項目" },
  { id: 4, title: "料金設定", description: "時給・残業・深夜・休日割増" },
  { id: 5, title: "派遣社員", description: "対象社員を選択" },
] as const;

export function ContractForm() {
  const { currentStep, setStep, data, reset } = useContractFormStore();
  const [draftDismissed, setDraftDismissed] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Detect if there's a pre-existing draft (non-empty state)
  const isDraft =
    (data.companyId != null && data.companyId !== 0) ||
    (data.startDate != null && data.startDate !== "") ||
    data.employeeIds.length > 0;

  return (
    <div className="space-y-6">
      {/* Draft recovery banner — shown only on step 1 */}
      {isDraft && !draftDismissed && currentStep === 1 && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-200/60 bg-amber-50/50 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-950/30">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            前回の下書きが残っています
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                reset();
                setDraftDismissed(false);
              }}
              className="text-xs font-semibold text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200 transition-colors"
            >
              下書きを破棄
            </button>
            <button
              onClick={() => setDraftDismissed(true)}
              aria-label="下書きバナーを閉じる"
              className="text-xs text-amber-500 hover:text-amber-700 dark:text-amber-500 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Step indicator — synthwave */}
      <nav aria-label="契約作成ウィザード" className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
        <ol role="list" className="flex items-center mb-2">
          {STEPS.map((step, i) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;

            return (
              <li key={step.id} role="listitem" className="flex items-center flex-1 last:flex-none">
                <button
                  onClick={() => {
                    if (step.id <= currentStep) setStep(step.id);
                  }}
                  disabled={step.id > currentStep}
                  aria-current={step.id === currentStep ? "step" : undefined}
                  aria-label={`ステップ ${step.id}: ${step.title}`}
                  className={cn(
                    "btn-press flex flex-col items-center gap-1",
                    step.id > currentStep && "cursor-not-allowed opacity-40 pointer-events-none"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
                    isCompleted
                      ? "bg-gradient-to-br from-[var(--gradient-accent-from)] to-[var(--gradient-accent-to)] text-[#06010f]"
                      : isCurrent
                      ? "bg-primary text-primary-foreground dark:shadow-[0_0_16px_rgba(139,92,246,0.5)]"
                      : "border-2 border-border text-muted-foreground"
                  )}>
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : step.id}
                  </div>
                  <div className="text-center">
                    <p className={cn(
                      "text-[9px] font-semibold md:text-[10px]",
                      isCurrent && "text-primary",
                      isCompleted && "text-primary/70",
                      !isCurrent && !isCompleted && "text-muted-foreground"
                    )}>
                      {step.title}
                    </p>
                  </div>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    "h-0.5 flex-1 mx-2 transition-all duration-500",
                    isCompleted
                      ? "bg-gradient-to-r from-[var(--gradient-accent-from)] to-[var(--gradient-accent-to)]"
                      : "bg-border"
                  )} />
                )}
              </li>
            );
          })}
        </ol>
        {/* Progress bar */}
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--gradient-accent-from)] to-[var(--gradient-accent-to)] transition-all duration-500 ease-out"
            style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
          />
        </div>
      </nav>

      {/* Step content with AnimatePresence transitions */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={currentStep}
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, y: -8 }}
          transition={shouldReduceMotion ? undefined : { duration: 0.18, ease: "easeOut" }}
          className="rounded-[var(--radius-xl)] border border-border bg-card p-6 shadow-[var(--shadow-card)]"
        >
          {currentStep === 1 && <CascadingSelect />}
          {currentStep === 2 && <DateCalculator />}
          {currentStep === 3 && <WorkConditions />}
          {currentStep === 4 && <RatePreview />}
          {currentStep === 5 && <EmployeeSelector />}
        </motion.div>
      </AnimatePresence>

      {/* Preview panel (visible from step 2 onwards) */}
      {currentStep >= 2 && data.companyId && (
        <ContractPreview />
      )}
    </div>
  );
}
