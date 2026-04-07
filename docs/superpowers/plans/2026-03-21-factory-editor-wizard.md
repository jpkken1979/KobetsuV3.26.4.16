# Factory Editor Wizard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the confusing 4-tab factory editor dialog with a 5-step wizard using LUNARIS design tokens.

**Architecture:** The current `FactoryDrawer` component (709 lines) is split into a wizard shell (`-factory-drawer.tsx`) that manages state/navigation, 5 step components in a new file (`-factory-wizard-steps.tsx`), a reusable progress bar (`-wizard-progress.tsx`), and a compact personnel table (`-personnel-table.tsx`). All form state, submit logic, and mutation hooks are preserved exactly.

**Tech Stack:** React 19, TanStack Router, TanStack React Query, Framer Motion, Tailwind CSS 4 (LUNARIS tokens), Lucide React icons.

**Spec:** `docs/superpowers/specs/2026-03-21-factory-editor-wizard-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/routes/companies/-shared.tsx` | Modify | Add `WIZARD_STEPS` constant, `WizardStep` type |
| `src/routes/companies/-wizard-progress.tsx` | Create | Reusable step progress bar (5 circles + lines + labels) |
| `src/routes/companies/-personnel-table.tsx` | Create | Compact grouped table with inline edit for 5 person roles |
| `src/routes/companies/-factory-wizard-steps.tsx` | Create | 5 step content components (Step1Identity through Step5Contract) |
| `src/routes/companies/-factory-drawer.tsx` | Rewrite | Wizard shell: Dialog + progress + navigation + state + submit |
| `src/lib/shift-utils.ts` | Modify | Add `HOLIDAY_DB` + `generateCalendarText()` moved from drawer |

---

### Task 1: Move `HOLIDAY_DB` and `generateCalendarText` to shift-utils

**Files:**
- Modify: `src/lib/shift-utils.ts`
- Modify: `src/routes/companies/-factory-drawer.tsx`

- [ ] **Step 1:** Read `src/routes/companies/-factory-drawer.tsx` lines 37-59 to copy `HOLIDAY_DB` and `generateCalendarText`.

- [ ] **Step 2:** Append both to `src/lib/shift-utils.ts` (after existing exports). Export both.

```typescript
// At end of src/lib/shift-utils.ts
export const HOLIDAY_DB: Record<string, [[string, string], [string, string], [string, string]]> = {
  "2019": [["04-27", "05-06"], ["08-09", "08-17"], ["12-26", "01-05"]],
  // ... copy all years from drawer
  "2026": [["04-29", "05-05"], ["08-08", "08-16"], ["12-26", "01-05"]],
};

export function generateCalendarText(): string {
  const year = new Date().getFullYear();
  const db = HOLIDAY_DB[String(year)];
  const toJP = (mmdd: string) => { const [m, d] = mmdd.split("-").map(Number); return `${m}月${d}日`; };
  const parts = ["土曜日・日曜日"];
  if (db) {
    parts.push(`年末年始（${toJP(db[2][0])}～${toJP(db[2][1])}）`);
    parts.push(`GW（${toJP(db[0][0])}～${toJP(db[0][1])}）`);
    parts.push(`夏季休暇（${toJP(db[1][0])}～${toJP(db[1][1])}）`);
  }
  return parts.join("・");
}
```

- [ ] **Step 3:** In `-factory-drawer.tsx`, replace the inline `HOLIDAY_DB` and `generateCalendarText` with import from `@/lib/shift-utils`.

- [ ] **Step 4:** Run `npx tsc --noEmit 2>&1 | grep -v pdf-parse` — no errors.

- [ ] **Step 5:** Commit: `refactor: move HOLIDAY_DB and generateCalendarText to shift-utils`

---

### Task 2: Add wizard types and steps to -shared.tsx

**Files:**
- Modify: `src/routes/companies/-shared.tsx`

- [ ] **Step 1:** Add `WizardStep` type and `WIZARD_STEPS` constant after existing `DRAWER_TABS`:

```typescript
import { Building2, MapPin, Clock, Users, CreditCard } from "lucide-react";

export type WizardStep = "identity" | "location" | "work" | "personnel" | "contract";

export const WIZARD_STEPS: { id: WizardStep; label: string; labelShort: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "identity", label: "識別", labelShort: "識別", icon: Building2 },
  { id: "location", label: "所在地・仕事", labelShort: "所在地", icon: MapPin },
  { id: "work", label: "勤務条件", labelShort: "勤務", icon: Clock },
  { id: "personnel", label: "担当者", labelShort: "担当者", icon: Users },
  { id: "contract", label: "契約・支払", labelShort: "契約", icon: CreditCard },
];
```

- [ ] **Step 2:** Add `PersonnelRole` type for the personnel table:

```typescript
export interface PersonnelRole {
  label: string;
  nameKey: string;
  deptKey: string;
  phoneKey: string;
}

export const CLIENT_ROLES: PersonnelRole[] = [
  { label: "派遣先責任者", nameKey: "hakensakiManagerName", deptKey: "hakensakiManagerDept", phoneKey: "hakensakiManagerPhone" },
  { label: "指揮命令者", nameKey: "supervisorName", deptKey: "supervisorDept", phoneKey: "supervisorPhone" },
  { label: "苦情処理", nameKey: "complaintClientName", deptKey: "complaintClientDept", phoneKey: "complaintClientPhone" },
];

export const UNS_ROLES: PersonnelRole[] = [
  { label: "派遣元責任者", nameKey: "managerUnsName", deptKey: "managerUnsDept", phoneKey: "managerUnsPhone" },
  { label: "苦情処理", nameKey: "complaintUnsName", deptKey: "complaintUnsDept", phoneKey: "complaintUnsPhone" },
];
```

- [ ] **Step 3:** Run typecheck, commit: `feat: add wizard step types and personnel role definitions`

---

### Task 3: Create WizardProgress component

**Files:**
- Create: `src/routes/companies/-wizard-progress.tsx`

- [ ] **Step 1:** Create the progress bar component:

```typescript
import { cn } from "@/lib/utils";
import { WIZARD_STEPS, type WizardStep } from "./-shared";
import { motion } from "framer-motion";

interface WizardProgressProps {
  currentStep: WizardStep;
  completedSteps: Set<WizardStep>;
  isEditMode: boolean;
  onStepClick: (step: WizardStep) => void;
}

export function WizardProgress({ currentStep, completedSteps, isEditMode, onStepClick }: WizardProgressProps) {
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-center gap-1 px-6 py-4">
      {WIZARD_STEPS.map((step, i) => {
        const isCurrent = step.id === currentStep;
        const isCompleted = completedSteps.has(step.id);
        const isClickable = isEditMode || isCompleted || i <= currentIndex;

        return (
          <div key={step.id} className="flex items-center gap-1">
            {i > 0 && (
              <div className={cn("h-0.5 w-8 rounded-full transition-colors", isCompleted || i <= currentIndex ? "bg-primary" : "bg-border")} />
            )}
            <button
              type="button"
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              className={cn(
                "flex items-center gap-2 rounded-full px-1 transition-all",
                isClickable ? "cursor-pointer" : "cursor-default",
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all",
                  isCurrent
                    ? "border-2 border-primary bg-transparent text-primary"
                    : isCompleted
                      ? "bg-primary text-primary-foreground"
                      : "border-2 border-border text-muted-foreground",
                )}
              >
                {i + 1}
              </div>
              <span
                className={cn(
                  "hidden text-xs font-semibold sm:inline",
                  isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.labelShort}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2:** Run typecheck, commit: `feat: create WizardProgress component`

---

### Task 4: Create PersonnelTable component

**Files:**
- Create: `src/routes/companies/-personnel-table.tsx`

- [ ] **Step 1:** Create the compact grouped table with inline edit:

```typescript
import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { INPUT_CLS, type FormValue, type PersonnelRole, CLIENT_ROLES, UNS_ROLES } from "./-shared";

interface PersonnelTableProps {
  form: Record<string, FormValue>;
  onChange: (key: string, value: string | null) => void;
}

function RoleGroup({
  title,
  roles,
  form,
  onChange,
}: {
  title: string;
  roles: PersonnelRole[];
  form: Record<string, FormValue>;
  onChange: (key: string, value: string | null) => void;
}) {
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // Close inline edit on click outside
  useEffect(() => {
    if (!editingRole) return;
    const handler = (e: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
        setEditingRole(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editingRole]);

  return (
    <div>
      <div className="mb-1.5 pl-1 text-[9px] font-bold uppercase tracking-[1.5px] text-muted-foreground">
        {title}
      </div>
      <div className="overflow-hidden rounded-xl border border-border/40">
        {/* Header */}
        <div className="grid grid-cols-[110px_1fr_1fr_130px] gap-0 border-b border-border/30 px-3.5 py-1.5 text-[9px] font-semibold text-muted-foreground/60">
          <span>役職</span><span>氏名</span><span>部署</span><span>電話番号</span>
        </div>
        {/* Rows */}
        {roles.map((role) => {
          const hasData = Boolean(form[role.nameKey]);
          const isEditing = editingRole === role.nameKey;

          return (
            <div
              key={role.nameKey}
              ref={isEditing ? rowRef : undefined}
              onClick={() => !isEditing && setEditingRole(role.nameKey)}
              className={cn(
                "grid grid-cols-[110px_1fr_1fr_130px] items-center gap-0 border-b border-border/20 px-3.5 transition-colors last:border-0",
                isEditing
                  ? "border-primary/30 bg-primary/[0.02] py-2.5"
                  : "cursor-pointer py-2 hover:bg-muted/30",
              )}
            >
              {/* Role label + dot */}
              <div className="flex items-center gap-1.5">
                <div className={cn("h-1.5 w-1.5 rounded-full", hasData ? "bg-primary" : "bg-muted-foreground/20")} />
                <span className={cn("text-[11px] font-semibold", hasData ? "text-foreground" : "text-muted-foreground")}>
                  {role.label}
                </span>
              </div>

              {isEditing ? (
                <>
                  <input
                    autoFocus
                    type="text"
                    value={String(form[role.nameKey] ?? "")}
                    onChange={(e) => onChange(role.nameKey, e.target.value || null)}
                    className={cn(INPUT_CLS, "mx-1 text-[11px]")}
                    placeholder="氏名"
                  />
                  <input
                    type="text"
                    value={String(form[role.deptKey] ?? "")}
                    onChange={(e) => onChange(role.deptKey, e.target.value || null)}
                    className={cn(INPUT_CLS, "mx-1 text-[11px]")}
                    placeholder="部署"
                  />
                  <input
                    type="text"
                    value={String(form[role.phoneKey] ?? "")}
                    onChange={(e) => onChange(role.phoneKey, e.target.value || null)}
                    className={cn(INPUT_CLS, "mx-1 text-[11px]")}
                    placeholder="電話番号"
                    onKeyDown={(e) => e.key === "Escape" && setEditingRole(null)}
                  />
                </>
              ) : (
                <>
                  <span className={cn("text-[11px]", hasData ? "text-foreground/90" : "text-muted-foreground/50")}>
                    {String(form[role.nameKey] ?? "未設定")}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {String(form[role.deptKey] ?? "—")}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {String(form[role.phoneKey] ?? "—")}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PersonnelTable({ form, onChange }: PersonnelTableProps) {
  return (
    <div className="space-y-5">
      <RoleGroup title="派遣先（客先側）" roles={CLIENT_ROLES} form={form} onChange={onChange} />
      <RoleGroup title="派遣元（UNS側）" roles={UNS_ROLES} form={form} onChange={onChange} />
    </div>
  );
}
```

- [ ] **Step 2:** Run typecheck, commit: `feat: create PersonnelTable with inline edit`

---

### Task 5: Create wizard step components

**Files:**
- Create: `src/routes/companies/-factory-wizard-steps.tsx`

- [ ] **Step 1:** Create file with all 5 step components. Each step receives `form`, `updateForm`, and step-specific props. Reference the exact field lists from the spec and current drawer code (lines 310-703).

The file exports:
```typescript
export function StepIdentity({ form, updateForm, companyId, onCopyLine }: StepProps & { companyId: number; onCopyLine: () => void })
export function StepLocation({ form, updateForm }: StepProps)
export function StepWork({ form, updateForm, shifts, onShiftsChange, shiftTemplates, onLoadTemplate, onSaveTemplate, onDeleteTemplate }: StepWorkProps)
export function StepPersonnel({ form, updateForm, companyId, editingId }: StepProps & { companyId: number; editingId: number | null })
export function StepContract({ form, updateForm }: StepProps)
```

Key patterns per step:
- **Step 1:** 3 fields (factoryName*, department, lineName) + "別のラインからコピー" button + hint card
- **Step 2:** 4 fields (address, phone, hourlyRate with ¥ format, jobDescription textarea)
- **Step 3:** workDays, overtimeHours, overtimeOutsideDays, calendar with auto-gen button, ShiftManager in card, shift preset buttons (日勤/2交替/3交替), hasRobotTraining checkbox, shiftPattern (set by presets)
- **Step 4:** `<PersonnelTable>` + UNS address section + explainerName + "全ラインに適用" button with ConfirmDialog
- **Step 5:** conflictDate, contractPeriod select, closingDayText, paymentDayText, timeUnit as toggle buttons, bankAccount, closingDay/paymentDay numeric, agreementPeriodEnd, worker subsection (workerClosingDay, workerPaymentDay, workerCalendar)

All using `FieldInput`, `SelectInput`, `INPUT_CLS` from `-shared.tsx` and LUNARIS tokens.

- [ ] **Step 2:** Run typecheck, commit: `feat: create 5 wizard step components`

---

### Task 6: Rewrite FactoryDrawer as wizard

**Files:**
- Rewrite: `src/routes/companies/-factory-drawer.tsx`

- [ ] **Step 1:** Rewrite the entire component. Key structure:

```typescript
import { WizardProgress } from "./-wizard-progress";
import { StepIdentity, StepLocation, StepWork, StepPersonnel, StepContract } from "./-factory-wizard-steps";
import { WIZARD_STEPS, type WizardStep } from "./-shared";
import { Dialog } from "@/components/ui/dialog";
import { generateCalendarText } from "@/lib/shift-utils";
// ... keep all existing mutation/query hooks

export function FactoryDrawer({ companyId, editingId, onClose }: Props) {
  // === State (preserved from current) ===
  const [form, setForm] = useState<FormRecord>({});
  const [shifts, setShifts] = useState<ShiftEntry[]>([...]);
  const [currentStep, setCurrentStep] = useState<WizardStep>("identity");

  // === Queries & mutations (preserved exactly) ===
  const { data: existing, isLoading } = useQuery({...});
  const createMutation = useCreateFactory();
  const updateMutation = useUpdateFactory();

  // === Computed ===
  const isEditMode = editingId !== null;
  const completedSteps = useMemo(() => {
    const set = new Set<WizardStep>();
    if (form.factoryName) set.add("identity");
    if (form.address || form.phone || form.hourlyRate) set.add("location");
    if (form.workDays || shifts.length > 0) set.add("work");
    if (form.hakensakiManagerName || form.supervisorName) set.add("personnel");
    if (form.conflictDate || form.contractPeriod) set.add("contract");
    return set;
  }, [form, shifts]);

  // === Navigation ===
  const stepIndex = WIZARD_STEPS.findIndex(s => s.id === currentStep);
  const canGoNext = currentStep !== "identity" || Boolean(form.factoryName);
  const isLastStep = stepIndex === WIZARD_STEPS.length - 1;

  const goNext = () => {
    if (isLastStep) return;
    setCurrentStep(WIZARD_STEPS[stepIndex + 1].id);
  };
  const goPrev = () => {
    if (stepIndex === 0) return;
    setCurrentStep(WIZARD_STEPS[stepIndex - 1].id);
  };

  // === Submit (preserved EXACTLY from current handleSubmit) ===
  const handleSubmit = useCallback(() => {
    // ... copy entire handleSubmit from current drawer lines 160-206
  }, [...]);

  // === Render ===
  return (
    <Dialog open onClose={onClose} className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl p-0">
      {/* Header */}
      <div className="shrink-0 border-b border-border/40 px-6 py-3">
        {/* title + cancel/save buttons — same pattern as current */}
      </div>

      {/* Progress bar */}
      <WizardProgress
        currentStep={currentStep}
        completedSteps={completedSteps}
        isEditMode={isEditMode}
        onStepClick={setCurrentStep}
      />

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {isLoading ? <SkeletonCard /> : (
          <AnimatePresence mode="wait">
            <motion.div key={currentStep} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}>
              {currentStep === "identity" && <StepIdentity form={form} updateForm={updateForm} companyId={companyId} onCopyLine={handleCopyLine} />}
              {currentStep === "location" && <StepLocation form={form} updateForm={updateForm} />}
              {currentStep === "work" && <StepWork form={form} updateForm={updateForm} shifts={shifts} onShiftsChange={setShifts} ... />}
              {currentStep === "personnel" && <StepPersonnel form={form} updateForm={updateForm} companyId={companyId} editingId={editingId} />}
              {currentStep === "contract" && <StepContract form={form} updateForm={updateForm} />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Footer navigation */}
      <div className="shrink-0 border-t border-border/40 px-6 py-3 flex items-center justify-between">
        <button onClick={goPrev} disabled={stepIndex === 0}>← 前へ</button>
        <span className="text-xs text-muted-foreground">ステップ {stepIndex + 1} / 5</span>
        <div className="flex gap-2">
          {!isLastStep && currentStep !== "identity" && (
            <button onClick={goNext} className="...outline...">スキップ</button>
          )}
          {isLastStep ? (
            <button onClick={handleSubmit} disabled={isPending} className="...primary...">
              {isPending ? "保存中..." : isEditMode ? "更新" : "登録"}
            </button>
          ) : (
            <button onClick={goNext} disabled={!canGoNext} className="...primary...">次へ →</button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
```

- [ ] **Step 2:** Ensure ALL fields from the current drawer are accounted for (cross-reference spec section "Campos deliberadamente excluidos" — all 9 added fields must be present).

- [ ] **Step 3:** Run typecheck: `npx tsc --noEmit 2>&1 | grep -v pdf-parse`

- [ ] **Step 4:** Run all tests: `npx vitest run` — 352 tests must pass.

- [ ] **Step 5:** Run lint: `npx eslint src/routes/companies/`

- [ ] **Step 6:** Commit: `feat: rewrite factory editor as 5-step wizard`

---

### Task 7: Implement copy-from-line feature

**Files:**
- Modify: `src/routes/companies/-factory-wizard-steps.tsx` (StepIdentity)
- Modify: `src/routes/companies/-factory-drawer.tsx` (handleCopyLine)

- [ ] **Step 1:** In the drawer, implement `handleCopyLine`:
- Query `factories/cascade/:companyId` to get all lines
- Show dropdown in StepIdentity with available lines
- On select: copy all fields EXCEPT factoryName, department, lineName
- Also copy shifts via `parseExistingShifts(selectedFactory)`

- [ ] **Step 2:** In StepIdentity, render the dropdown only if company has other lines.

- [ ] **Step 3:** Run typecheck + lint, commit: `feat: add copy-from-line in factory wizard step 1`

---

### Task 8: Implement 全ラインに適用 (bulk apply personnel)

**Files:**
- Modify: `src/routes/companies/-factory-wizard-steps.tsx` (StepPersonnel)

- [ ] **Step 1:** Add ConfirmDialog import and state in StepPersonnel.

- [ ] **Step 2:** Add button "全ラインに適用" that:
1. Opens ConfirmDialog with destructive variant
2. On confirm, calls `PUT /api/factories/bulk-roles` with current personnel data
3. Shows toast success/error

- [ ] **Step 3:** Run typecheck + tests, commit: `feat: add bulk apply personnel in factory wizard`

---

### Task 9: Visual polish and final verification

**Files:**
- All wizard files

- [ ] **Step 1:** Verify ALL LUNARIS tokens are used (no hardcoded colors). Grep for hex colors in the new files:
```bash
grep -n "#[0-9a-fA-F]" src/routes/companies/-wizard-progress.tsx src/routes/companies/-personnel-table.tsx src/routes/companies/-factory-wizard-steps.tsx
```
Should return 0 results.

- [ ] **Step 2:** Test dark mode + light mode manually: `npm run dev`, open http://localhost:3026/companies, create/edit a factory.

- [ ] **Step 3:** Run full test suite: `npx vitest run` — all 352+ tests pass.

- [ ] **Step 4:** Run typecheck + lint.

- [ ] **Step 5:** Final commit: `feat: factory editor wizard — visual polish and verification`

---

### Task 10: Clean up old code

**Files:**
- Modify: `src/routes/companies/-shared.tsx`

- [ ] **Step 1:** Remove `DRAWER_TABS` and `DrawerTab` type from `-shared.tsx` if nothing else imports them. Check:
```bash
grep -r "DRAWER_TABS\|DrawerTab" src/ --include="*.tsx" --include="*.ts"
```
If only the old drawer used them, delete them.

- [ ] **Step 2:** Remove old `PersonRow` from `-shared.tsx` if replaced by PersonnelTable. Check imports first.

- [ ] **Step 3:** Run typecheck + tests, commit: `chore: remove legacy tab types from factory editor`
