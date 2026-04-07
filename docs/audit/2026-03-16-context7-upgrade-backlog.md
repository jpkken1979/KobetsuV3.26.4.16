# Context7 Upgrade Backlog (Conservative) — 2026-03-16

## Policy
- Only patch/minor updates in this cycle.
- No major framework/runtime migrations.
- Keep behavior unchanged and preserve DB safety rules.

## Current vs recommended (this cycle)
| Package | Before | Applied | Strategy | Risk | Status |
|---|---:|---:|---|---|---|
| `@tanstack/react-router` | `1.166.6` | `1.167.3` | patch/minor bump | Low | ✅ applied |
| `@tanstack/router-devtools` | `1.166.6` | `1.166.9` | patch bump | Low | ✅ applied |
| `@tanstack/router-plugin` | `1.166.6` | `1.166.12` | patch bump | Low | ✅ applied |
| `hono` | `4.12.7` | `4.12.8` | patch bump | Low | ✅ applied |
| `drizzle-kit` | `0.30.0` | `0.30.6` | patch bump | Low | ✅ applied |

## Deferred (next cycle, not applied now)
| Package | Reason deferred |
|---|---|
| `vite` 6 -> 8 | major with ecosystem impact |
| `drizzle-orm` 0.38 -> 0.45 | multiple release gaps, requires migration window |
| `framer-motion` 11 -> 12 | major UI runtime change |
| `recharts` 2 -> 3 | chart API/behavior changes likely |
| `better-sqlite3` 11 -> 12 | native module/runtime compatibility validation needed |

## Rollback
- Keep lockfile committed with upgrade batch.
- If regression appears:
  1. Revert package batch commit.
  2. Run `npm ci`.
  3. Re-run `lint/typecheck/test:run`.
