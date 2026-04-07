# Kobetsuv2 — Fase 3: Contratos

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Implementar flujo de contratos v2 — creator individual (2 pasos), batch (normal + 途中入社 + 新入社), contract list con TanStack Table, renovacion automatica, y soft-delete universal.

**Architecture:** Contract routes en server (8 rutas: CRUD + batch). Frontend: TanStack Table + React Hook Form (si disponible) o useState. El contract creator usa smart defaults desde factory (contractStartDate, contractEndDate, conflictDate).

**Tech Stack:** Hono 4 + Drizzle ORM + React 19 + TanStack Table v8 + React Hook Form + Zod 4

---

## Task 1: Contract List — TanStack Table

**Files:**
- Update: `src/routes/contracts/index.tsx` — replace current table with TanStack Table v8
- Create: `src/routes/contracts/-contract-table.tsx` — table component

### Step 1.1 — contracts/index.tsx Table

- [ ] Read existing `src/routes/contracts/index.tsx`
- [ ] Add `useContracts` hook import (already exists from use-contracts.ts)
- [ ] Add TanStack Table imports: `useReactTable`, `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`, `getPaginationRowModel`, `flexRender`
- [ ] Add columns: checkbox, contractNumber (sortable), companyName, factoryName, startDate, endDate, employeeCount, status badge, actions
- [ ] Replace static table HTML with TanStack Table pattern:
  ```tsx
  const table = useReactTable({
    data: contracts ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  ```
- [ ] Add sortable columns (click header to sort)
- [ ] Add status filter (active/cancelled toggle — useEye from lucide)
- [ ] Add search input for contract number / company name
- [ ] Add pagination (previous/next page buttons)
- [ ] Row actions: View, Edit, Cancel (soft delete), Delete (hard if already cancelled)

### Step 1.2 — Contract Status

- [ ] Add `isCancelled` field to contract type if missing
- [ ] Contract list filters out cancelled by default
- [ ] Eye/EyeOff toggle to show cancelled
- [ ] Cancelled contracts show with strikethrough style

---

## Task 2: Contract Creator — 2-Step Wizard

**Files:**
- Create: `src/routes/contracts/new.tsx` — 2-step contract creator
- Create: `src/lib/hooks/use-contract-creator.ts` — wizard state management

### Step 2.1 — Step 1: Select Factory + Dates

- [ ] Read `src/routes/contracts/-contract-wizard-step1.tsx` if it exists
- [ ] Create `src/routes/contracts/new.tsx` using TanStack Router's `createFileRoute` pattern
- [ ] Use `useFactoryCascade(companyId)` for cascading company → factory dropdowns
- [ ] Use `useCompanies()` to get company list
- [ ] Step 1 fields:
  - Company selector (combobox or select)
  - Factory selector (filtered by company)
  - Contract start date (from factory.contractStartDate as default)
  - Contract period (select: 1month, 2months, 3months, 6months, 1year, teishokubi)
  - Contract end date (AUTO-CALCULATED from start + period, capped at factory.conflictDate)
  - Override: if user edits endDate manually, accept it
- [ ] Sidebar preview card showing auto-filled data from factory:
  - Supervisor name
  - Work hours
  - Base hourly rate
  - Conflict date

### Step 2.2 — Step 2: Select Employees

- [ ] Read existing `useContracts` hook
- [ ] Use `useEmployeesByFactory(factoryId)` or add to `use-employees.ts`
- [ ] Show employees with: checkbox, name, current billingRate, hireDate
- [ ] Group employees by billingRate — show warning if multiple rates (will create multiple contracts)
- [ ] Summary section showing:
  - How many contracts will be created
  - Employee count per contract
- [ ] "Generar PDFs automaticamente" checkbox
- [ ] On submit: call `useCreateContract` for each rate group

### Step 2.3 — Auto-Calculation Logic

- [ ] Add `calculateEndDate(startDate: Date, period: string, conflictDate: Date): Date` function
- [ ] Period to months mapping: 1month=1, 2months=2, 3months=3, 6months=6, 1year=12, teishokubi=Infinity
- [ ] If endDate > conflictDate → set endDate = conflictDate + show warning
- [ ] If user manually edits endDate → mark as override (don't auto-recalculate)

---

## Task 3: Batch Creator — 3 Modos

**Files:**
- Update: `src/routes/contracts/batch.tsx` — add 3 modes tab interface
- Create: `src/routes/contracts/-batch-normal.tsx` — Mode A: all active employees
- Create: `src/routes/contracts/-batch-mid-hires.tsx` — Mode B: mid-period hires
- Create: `src/routes/contracts/-batch-new-hires.tsx` — Mode C: newly hired

### Step 3.1 — batch.tsx Tab Interface

- [ ] Read existing `src/routes/contracts/batch.tsx`
- [ ] Add Tabs: Normal | 途中入社 | 新入社
- [ ] Each tab renders the respective mode component
- [ ] Shared: company selector at top (all modes)
- [ ] Shared: "Generar PDFs automaticamente" checkbox

### Step 3.2 — Batch Normal (Mode A)

- [ ] Read existing batch preview logic from `useBatchPreviewContracts()`
- [ ] Show table of factories with: checkbox, factoryName, dept, line, employeeCount, baseRate, startDate, endDate
- [ ] All factories selected by default
- [ ] User can deselect individual factories
- [ ] Show total: X factories, Y employees, Z contracts to be created
- [ ] "Preview Detallado" button → calls `useBatchPreviewContracts()`
- [ ] "Crear Batch" button → calls `useBatchCreateContracts()`

### Step 3.3 — 途中入社 / Mid-Hires (Mode B)

- [ ] Read existing `useMidHiresPreview()` and `useMidHiresCreate()`
- [ ] Show: select factory (or multiple), then show employees with hireDate > contractStartDate
- [ ] Employees grouped by factory
- [ ] Each employee shows: name, entry date, rate, visa status (warning if expiring)
- [ ] Contract dates: employee entry date → factory contractEndDate
- [ ] Preview button → `useMidHiresPreview()`
- [ ] Create button → `useMidHiresCreate()`

### Step 3.4 — 新入社 / New Hires (Mode C)

- [ ] Read existing `useNewHiresPreview()` and `useNewHiresCreate()`
- [ ] Show: date range selector (hireDateFrom, hireDateTo)
- [ ] Show employees hired within range
- [ ] Factory selector (or all)
- [ ] End date: from factory.contractEndDate (default) or manual override
- [ ] Preview → `useNewHiresPreview()`
- [ ] Create → `useNewHiresCreate()`

---

## Task 4: Contract Detail View

**Files:**
- Create: `src/routes/contracts/$contractId.tsx` — detail page
- Create: `src/routes/contracts/-contract-detail.tsx` — detail component

### Step 4.1 — Detail Page

- [ ] Use `createFileRoute("/contracts/$contractId")` for the route
- [ ] Read `useContract(contractId)` to fetch contract data
- [ ] Show: contract number, company, factory, dates, status
- [ ] Show: list of assigned employees with their rates
- [ ] Show: generated documents list (if any stored)
- [ ] Action buttons: Edit, Generate Documents, Cancel, Delete

### Step 4.2 — Cancel / Soft Delete

- [ ] Read existing `useDeleteContract()` hook
- [ ] `useCancelContract()` should call `updateContract(id, { status: 'cancelled' })`
- [ ] Confirm dialog before cancelling
- [ ] After cancel: invalidate contracts list and redirect

---

## Task 5: Contract API Routes — Alignment

**Files:**
- Read: `server/routes/contracts.ts`
- Read: `server/routes/contracts-batch.ts`
- Update: Add `useContract(id)` endpoint if missing
- Update: Add `useCancelContract(id)` endpoint (soft delete)
- Update: `GET /contracts` should support `status` filter (active/cancelled)

### Step 5.1 — API Alignment

- [ ] Verify `GET /api/contracts` returns `{ contracts: Contract[], total: number }`
- [ ] Add `status` query param filtering (default: exclude cancelled)
- [ ] Verify `GET /api/contracts/:id` returns full contract with employees
- [ ] Verify `POST /api/contracts/batch/preview` exists
- [ ] Verify `POST /api/contracts/batch` creates multiple contracts atomically
- [ ] Add `PATCH /api/contracts/:id/status` for soft cancel (set status to 'cancelled')

---

## Task 6: Hooks — Contract Creator Hooks

**Files:**
- Create: `src/lib/hooks/use-contract-wizard.ts` — wizard step state

### Step 6.1 — useContractWizard

- [ ] Create state machine for wizard:
  ```typescript
  interface WizardState {
    step: 1 | 2;
    companyId: number | null;
    factoryId: number | null;
    startDate: string;
    period: string;
    endDate: string;
    employeeIds: number[];
    generatePdfs: boolean;
    // For batch
    mode: 'normal' | 'mid' | 'new';
  }
  ```
- [ ] Export `useContractWizard()` hook with methods:
  - `setStep(n)`
  - `setFactory(factoryId)`
  - `calculateEndDate()`
  - `submit()`

### Step 6.2 — useEmployeesByFactory

- [ ] Read `src/lib/hooks/use-employees.ts`
- [ ] Add `useEmployeesByFactory(factoryId: number)` that filters employees by factory
- [ ] Return employees with their `billingRate ?? hourlyRate`

---

## Verification Criteria

1. `npm run test:run` — all tests pass (minimum 609)
2. `npx tsc --noEmit` — zero TypeScript errors
3. Contract list shows all contracts with sorting and filtering
4. Contract creator pre-fills from factory defaults
5. Batch creator generates correct number of contracts for each mode
6. Cancelled contracts are hidden by default but viewable via toggle
7. All contract mutations invalidate React Query cache correctly
