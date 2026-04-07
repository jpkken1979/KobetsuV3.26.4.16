import { useState, useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { COMPLETENESS_CONFIG, FIELD_LABELS } from "./-completeness";
import type { DataCheckEmployee } from "@/lib/api";
import {
  Building2,
  Factory,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Users,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────

interface FactoryGroup {
  key: string;
  companyId: number;
  companyName: string;
  factoryId: number;
  factoryName: string;
  department: string | null;
  lineName: string | null;
  employees: DataCheckEmployee[];
  /** Missing factory-level fields (from any employee in this group) */
  missingFactory: string[];
  /** Worst completeness level in this group */
  worstLevel: "green" | "yellow" | "red" | "gray";
}

interface CompanySection {
  companyId: number;
  companyName: string;
  factories: FactoryGroup[];
}

// ─── Helpers ──────────────────────────────────────────────────────────

function getWorstLevel(
  employees: DataCheckEmployee[]
): "green" | "yellow" | "red" | "gray" {
  if (employees.some((e) => e.completeness === "red")) return "red";
  if (employees.some((e) => e.completeness === "yellow")) return "yellow";
  if (employees.some((e) => e.completeness === "green")) return "green";
  return "gray";
}

function shouldDefaultExpand(group: FactoryGroup): boolean {
  return group.worstLevel === "red" || group.worstLevel === "yellow";
}

// ─── Employee Row ─────────────────────────────────────────────────────

function EmployeeRow({ emp }: { emp: DataCheckEmployee }) {
  const cfg = COMPLETENESS_CONFIG[emp.completeness];
  const allMissing = [
    ...emp.missingEmployee.map((f) => FIELD_LABELS[f] ?? f),
    ...emp.missingFactory.map((f) => FIELD_LABELS[f] ?? f),
  ];

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-border/20 px-4 py-2.5 text-xs last:border-0 transition-colors hover:bg-muted/20",
        emp.completeness === "red" && "bg-red-500/[0.03] dark:bg-red-500/[0.04]",
        emp.completeness === "yellow" && "bg-amber-500/[0.03] dark:bg-amber-500/[0.04]",
        emp.completeness === "gray" && "bg-gray-500/[0.02]",
      )}
    >
      {/* Completeness dot */}
      <span
        className={cn("inline-block h-2 w-2 shrink-0 rounded-full", cfg.dotClass)}
        title={cfg.label}
      />

      {/* Employee number */}
      <span className="w-20 shrink-0 font-mono text-muted-foreground">
        {emp.employeeNumber}
      </span>

      {/* Client ID */}
      <span className="w-20 shrink-0 text-muted-foreground">
        {emp.clientEmployeeId ?? "—"}
      </span>

      {/* Full name */}
      <span className="w-32 shrink-0 font-medium text-foreground">
        {emp.fullName}
      </span>

      {/* Katakana */}
      <span className="w-32 shrink-0 text-muted-foreground">
        {emp.katakanaName ?? "—"}
      </span>

      {/* Nationality */}
      <span className="w-16 shrink-0 text-muted-foreground">
        {emp.nationality ?? "—"}
      </span>

      {/* Gender */}
      <span className="w-10 shrink-0 text-muted-foreground">
        {emp.gender ?? "—"}
      </span>

      {/* Birth date */}
      <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
        {emp.birthDate ?? "—"}
      </span>

      {/* Hire date */}
      <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
        {emp.actualHireDate ?? emp.hireDate ?? "—"}
      </span>

      {/* Billing rate */}
      <span className="w-20 shrink-0 text-right tabular-nums">
        {emp.billingRate != null
          ? `¥${emp.billingRate.toLocaleString("ja-JP")}`
          : "—"}
      </span>

      {/* Hourly rate */}
      <span className="w-20 shrink-0 text-right tabular-nums text-muted-foreground">
        {emp.hourlyRate != null
          ? `¥${emp.hourlyRate.toLocaleString("ja-JP")}`
          : "—"}
      </span>

      {/* Missing field badges */}
      {allMissing.length > 0 && (
        <div className="flex flex-1 flex-wrap gap-1">
          {allMissing.map((label) => (
            <span
              key={label}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Employee Row Header (column labels) ─────────────────────────────

function EmployeeRowHeader() {
  return (
    <div className="flex items-center gap-3 border-b border-border/40 bg-muted/20 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      <span className="w-2 shrink-0" />
      <span className="w-20 shrink-0">社員№</span>
      <span className="w-20 shrink-0">派遣先ID</span>
      <span className="w-32 shrink-0">氏名</span>
      <span className="w-32 shrink-0">カナ</span>
      <span className="w-16 shrink-0">国籍</span>
      <span className="w-10 shrink-0">性別</span>
      <span className="w-24 shrink-0">生年月日</span>
      <span className="w-24 shrink-0">入社日</span>
      <span className="w-20 shrink-0 text-right">単価</span>
      <span className="w-20 shrink-0 text-right">時給</span>
      <span className="flex-1">不足フィールド</span>
    </div>
  );
}

// ─── Factory Group Component ──────────────────────────────────────────

function FactoryGroupCard({
  group,
  isCollapsed,
  onToggle,
}: {
  group: FactoryGroup;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const shouldReduceMotion = useReducedMotion();
  const cfg = COMPLETENESS_CONFIG[group.worstLevel];
  const subtitle = [group.department, group.lineName].filter(Boolean).join(" / ");

  // Deduplicate missing factory fields across all employees in group
  const uniqueMissingFactory = Array.from(
    new Set(group.missingFactory)
  );

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
      {/* Factory Header — clickable */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 rounded-xl"
        aria-expanded={!isCollapsed}
      >
        {/* Collapse icon */}
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}

        {/* Factory icon + completeness dot */}
        <Factory className="h-4 w-4 shrink-0 text-muted-foreground/60" />
        <span
          className={cn("h-2.5 w-2.5 shrink-0 rounded-full", cfg.dotClass)}
          title={cfg.label}
        />

        {/* Factory name */}
        <span className="font-semibold text-foreground text-sm">
          {group.factoryName}
        </span>

        {/* Dept / Line subtitle */}
        {subtitle && (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        )}

        {/* Employee count badge */}
        <span className="ml-auto flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          <Users className="h-3 w-3" />
          {group.employees.length}名
        </span>

        {/* Missing factory field badges */}
        {uniqueMissingFactory.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {uniqueMissingFactory.map((field) => (
              <span
                key={field}
                className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              >
                {FIELD_LABELS[field] ?? field}
              </span>
            ))}
          </div>
        )}
      </button>

      {/* Employee rows — collapsible */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="content"
            initial={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
            animate={shouldReduceMotion ? undefined : { height: "auto", opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={shouldReduceMotion ? undefined : { duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40">
              <EmployeeRowHeader />
              {group.employees.map((emp) => (
                <EmployeeRow key={emp.id} emp={emp} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Unassigned Section ───────────────────────────────────────────────

function UnassignedSection({ employees }: { employees: DataCheckEmployee[] }) {
  const shouldReduceMotion = useReducedMotion();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 shadow-[var(--shadow-card)]">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 rounded-xl"
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="font-semibold text-sm text-foreground">未配属</span>
        <span className="text-xs text-muted-foreground">
          工場ラインが未設定の社員
        </span>
        <span className="ml-auto flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          <Users className="h-3 w-3" />
          {employees.length}名
        </span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="unassigned-content"
            initial={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
            animate={shouldReduceMotion ? undefined : { height: "auto", opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
            transition={shouldReduceMotion ? undefined : { duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40">
              <EmployeeRowHeader />
              {employees.map((emp) => (
                <EmployeeRow key={emp.id} emp={emp} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── GroupedView Component ────────────────────────────────────────────

interface GroupedViewProps {
  employees: DataCheckEmployee[];
}

export function GroupedView({ employees }: GroupedViewProps) {
  // Build grouped structure
  const { unassigned, companies } = useMemo(() => {
    const unassigned: DataCheckEmployee[] = [];
    // Map: companyId → Map: factoryKey → FactoryGroup
    const companyMap = new Map<number, { name: string; factoryMap: Map<string, FactoryGroup> }>();

    for (const emp of employees) {
      if (emp.factoryId === null || emp.factory === null) {
        unassigned.push(emp);
        continue;
      }

      const companyId = emp.company?.id ?? 0;
      const companyName = emp.company?.name ?? "(企業不明)";
      const factoryKey = `${companyId}-${emp.factoryId}`;

      if (!companyMap.has(companyId)) {
        companyMap.set(companyId, { name: companyName, factoryMap: new Map() });
      }
      const companyEntry = companyMap.get(companyId)!;

      if (!companyEntry.factoryMap.has(factoryKey)) {
        companyEntry.factoryMap.set(factoryKey, {
          key: factoryKey,
          companyId,
          companyName,
          factoryId: emp.factoryId,
          factoryName: emp.factory.factoryName,
          department: emp.factory.department,
          lineName: emp.factory.lineName,
          employees: [],
          missingFactory: [],
          worstLevel: "green",
        });
      }
      const group = companyEntry.factoryMap.get(factoryKey)!;
      group.employees.push(emp);

      // Collect missing factory fields (deduplicated at render time)
      for (const f of emp.missingFactory) {
        if (!group.missingFactory.includes(f)) {
          group.missingFactory.push(f);
        }
      }
    }

    // Compute worstLevel per group
    const companySections: CompanySection[] = [];
    for (const [companyId, { name, factoryMap }] of companyMap) {
      const factories = Array.from(factoryMap.values()).map((group) => ({
        ...group,
        worstLevel: getWorstLevel(group.employees),
      }));
      // Sort factories: worst first, then by name
      factories.sort((a, b) => {
        const order = { red: 0, yellow: 1, green: 2, gray: 3 };
        const diff = order[a.worstLevel] - order[b.worstLevel];
        if (diff !== 0) return diff;
        return a.factoryName.localeCompare(b.factoryName, "ja");
      });
      companySections.push({ companyId, companyName: name, factories });
    }

    // Sort companies alphabetically
    companySections.sort((a, b) =>
      a.companyName.localeCompare(b.companyName, "ja")
    );

    return { unassigned, companies: companySections };
  }, [employees]);

  // Collapse state: Set of factory keys that are collapsed
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    // Default: collapse groups that are all green/gray
    const initial = new Set<string>();
    return initial;
  });

  // Initialize collapse state when companies change
  const [initialized, setInitialized] = useState(false);
  if (!initialized && companies.length > 0) {
    const initial = new Set<string>();
    for (const section of companies) {
      for (const group of section.factories) {
        if (!shouldDefaultExpand(group)) {
          initial.add(group.key);
        }
      }
    }
    setCollapsed(initial);
    setInitialized(true);
  }

  function toggleFactory(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  if (employees.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-12 text-center text-muted-foreground shadow-[var(--shadow-card)]">
        <p className="text-sm">条件に一致するデータがありません</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Unassigned section */}
      {unassigned.length > 0 && (
        <div>
          <UnassignedSection employees={unassigned} />
        </div>
      )}

      {/* Company sections */}
      {companies.map((section) => (
        <div key={section.companyId} className="space-y-3">
          {/* Company header */}
          <div className="flex items-center gap-2 px-1">
            <Building2 className="h-4 w-4 text-muted-foreground/60" />
            <h2 className="text-sm font-bold text-foreground">{section.companyName}</h2>
            <span className="rounded-full border border-border/40 bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">
              {section.factories.length}ライン
            </span>
            <div className="ml-2 h-px flex-1 bg-border/40" />
          </div>

          {/* Factory groups */}
          <div className="space-y-2">
            {section.factories.map((group) => (
              <FactoryGroupCard
                key={group.key}
                group={group}
                isCollapsed={collapsed.has(group.key)}
                onToggle={() => toggleFactory(group.key)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
