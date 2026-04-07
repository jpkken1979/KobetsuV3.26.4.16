# Kobetsuv2 — Fase 5: Dashboard + Polish

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Verificar que dashboard/settings/audit/command-palette estan completos, fixearviolaciones de coloridas, y ejecutar tests finales.

**Tech Stack:** React 19 + TanStack Router + TanStack React Query + Tailwind CSS 4

---

## Task 1: Fix DashboardStats — Indigo Color Violation

**Files:**
- Update: `src/routes/-dashboard-stats.tsx`

### Step 1.1 — Replace indigo color

- [ ] Read `src/routes/-dashboard-stats.tsx`
- [ ] Find `color="text-indigo-500"` in StatCard for 工場・ライン (line ~166)
- [ ] Replace with `text-cyan-500` (following the cyan theme used elsewhere)
- [ ] Replace `from-indigo-500/5` gradient with `from-cyan-500/5`
- [ ] Verify the card still looks good with the cyan color

---

## Task 2: Final Polish Audit

**Files to read:**
- `src/routes/-dashboard-alerts.tsx`
- `src/routes/-dashboard-charts.tsx`
- `src/routes/settings/index.tsx`
- `src/routes/audit/index.tsx`
- `src/components/layout/command-palette.tsx`

### Step 2.1 — useReducedMotion Check

- [ ] Verify all `motion.*` components in these files have `useReducedMotion` guards
- [ ] Check: `DashboardAlerts` — CriticalAlertCard, InfoAlertCard, AllClearState ✅
- [ ] Check: `DashboardCharts` — both `motion.div` wrappers ✅
- [ ] Check: `DashboardQuickActions` ✅
- [ ] Check: `settings/index.tsx` — `motion.div` in shortcuts ✅
- [ ] Check: `command-palette.tsx` ✅

### Step 2.2 — p-5 Violation Check

- [ ] Search for `p-5` or `p5` in `src/routes/` — CLAUDE.md prohibits p-5 spacing
- [ ] Fix any violations found (use p-4 or p-6)

### Step 2.3 — Empty States

- [ ] Verify all pages have empty states for: companies, employees, contracts, documents, history
- [ ] Verify loading skeletons exist for: companies, employees, contracts, history

---

## Task 3: Run Final Tests and Commit

### Step 3.1 — TypeScript Check

- [ ] Run `npx tsc --noEmit`
- [ ] Fix any errors found

### Step 3.2 — Test Suite

- [ ] Run `npm run test:run`
- [ ] Verify 609+ tests pass

### Step 3.3 — Commit

- [ ] Commit all Fase 5 changes

---

## Verification Criteria

1. `npm run test:run` — all tests pass (minimum 609)
2. `npx tsc --noEmit` — zero TypeScript errors
3. Dashboard: no indigo/purple colors in violation of CLAUDE.md rule
4. All pages have useReducedMotion guards where needed
5. No p-5 spacing violations
