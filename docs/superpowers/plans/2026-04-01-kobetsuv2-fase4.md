# Kobetsuv2 — Fase 4: Documentos PDF + Koritsu + Historial

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Auditar pixel-perfect de PDFs, verificar ZIP downloads en todos los modos, y asegurar que Koritsu + historial funcionan correctamente.

**Architecture:** PDF generators en `server/pdf/`. Frontend: `/documents` (contract/factory/ids modes), `/companies/koritsu` (import), `/history` (contract + labor history).

**Tech Stack:** PDFKit + NotoSansJP + BIZ UD Mincho | TanStack Table v8 | React Query v5 | Zod 4

---

## Task 1: AnimatedPage useReducedMotion — Documents Page

**Files:**
- Update: `src/routes/documents/index.tsx`

### Step 1.1 — Add useReducedMotion to AnimatedPage

- [ ] Read `src/routes/documents/index.tsx`
- [ ] Import `useReducedMotion` from `motion/react`
- [ ] Add `const shouldReduceMotion = useReducedMotion();`
- [ ] Pass `reducedMotion={shouldReduceMotion}` to `AnimatedPage` component
- [ ] Verify all `AnimatePresence` and `motion.*` components in this file have their own `useReducedMotion` guards (they do — this is a belt-and-suspenders check)

---

## Task 2: ZIP Download Verification — All Modes

**Files:**
- Read: `src/routes/documents/-factory-generator.tsx`
- Read: `src/routes/documents/-id-generator.tsx`
- Read: `server/routes/documents-generate-batch-factory.ts`
- Read: `server/routes/documents-generate-batch-ids.ts`

### Step 2.1 — Factory Generator ZIP

- [ ] Read `src/routes/documents/-factory-generator.tsx`
- [ ] Verify it calls `api.generateFactoryDocuments` and handles ZIP download
- [ ] If ZIP auto-download missing, add it after successful generation

### Step 2.2 — ID Generator ZIP

- [ ] Read `src/routes/documents/-id-generator.tsx`
- [ ] Verify it calls `api.generateDocumentsByIds` and handles ZIP download
- [ ] If ZIP auto-download missing, add it after successful generation

### Step 2.3 — Backend Batch Endpoints

- [ ] Read `server/routes/documents-generate-batch-factory.ts`
- [ ] Verify it returns ZIP file path correctly
- [ ] Read `server/routes/documents-generate-batch-ids.ts`
- [ ] Verify it returns ZIP file path correctly

---

## Task 3: PDF Pixel-Perfect Audit

**Files:**
- Read: `server/pdf/kobetsu-pdf.ts`
- Read: `server/pdf/tsuchisho-pdf.ts`
- Read: `server/pdf/keiyakusho-pdf.ts`
- Read: `server/pdf/shugyojoken-pdf.ts`
- Read: `server/pdf/helpers.ts`

### Step 3.1 — Grid System Verification

- [ ] Verify each generator uses the grid system pattern (COL_PX[], CX[], RY[] arrays)
- [ ] Verify `cell()` function handles auto-shrink correctly
- [ ] Verify fonts are registered correctly: `"JP"` for NotoSansJP, `"JP-Mincho"` for BIZ UD Mincho
- [ ] Verify NO mixing of fonts in the same document

### Step 3.2 — 派遣元責任者 Roles

- [ ] Verify all PDFs use `managerUns*` fields (NOT `complaintUns*`) for 派遣元責任者
- [ ] Check `kobetsu-pdf.ts`, `tsuchisho-pdf.ts`, `keiyakusho-pdf.ts`, `shugyojoken-pdf.ts`

### Step 3.3 — 高雄工業 Logic

- [ ] Read `server/pdf/helpers.ts` — verify `getTakaoJigyosho()` function exists
- [ ] Verify `kobetsu-pdf.ts` uses it for company names containing "高雄"

### Step 3.4 — PDF Output Directories

- [ ] Verify output goes to correct directories:
  - `output/kobetsu/` for 個別契約書 + 台帳
  - `output/roudou/` for 契約書 + 就業条件明示書
  - `output/koritsu/` for コーリツ PDFs

---

## Task 4: Koritsu Import — Full Workflow Test

**Files:**
- Read: `server/routes/import-koritsu.ts`
- Read: `server/services/koritsu-excel-parser.ts`

### Step 4.1 — Koritsu Backend Routes

- [ ] Read `server/routes/import-koritsu.ts`
- [ ] Verify `POST /api/import/koritsu/parse` returns correct `ParseResponse` shape
- [ ] Verify `POST /api/import/koritsu/apply` handles the apply correctly
- [ ] Check that `companyId` is correctly extracted from the Koritsu company

### Step 4.2 — Koritsu Excel Parser

- [ ] Read `server/services/koritsu-excel-parser.ts`
- [ ] Verify it parses 派遣先責任者, 指揮命令者, 抵触日 correctly
- [ ] Verify it handles the `companies` table for コーリツ

---

## Task 5: History Page — Full Workflow Test

**Files:**
- Read: `server/routes/contracts.ts` — verify history endpoint
- Read: `src/lib/api.ts` — verify `generateBatchDocuments`, `listLaborHistory`, `openDocumentsFolder`

### Step 5.1 — History API

- [ ] Verify `GET /api/contracts` with `status` filter returns correct contracts
- [ ] Verify `GET /api/contracts?status=cancelled` includes cancelled contracts
- [ ] Verify `api.listLaborHistory()` returns labor history files
- [ ] Verify `api.openDocumentsFolder(type)` works for both "kobetsu" and "roudou"

### Step 5.2 — ZIP Regeneration

- [ ] Read `history/index.tsx` line 178 — `regenerateGroupZip` mutation
- [ ] Verify `api.generateBatchDocuments(contractIds)` returns ZIP file
- [ ] Verify ZIP auto-download fires on success

---

## Verification Criteria

1. `npm run test:run` — all tests pass (minimum 609)
2. `npx tsc --noEmit` — zero TypeScript errors
3. Documents page: all 3 modes (contract/factory/ids) have ZIP download
4. PDF generators: pixel-perfect grid system, correct fonts, correct roles
5. Koritsu import: parse + preview + apply flow works end-to-end
6. History page: contract grouping + ZIP regeneration works
