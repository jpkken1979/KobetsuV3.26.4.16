import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  MapPin,
  Pencil,
  Users,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useFactories, useUpdateFactory } from "@/lib/hooks/use-factories";
import type { Factory } from "@/lib/api";

// ─── Types ──────────────────────────────────────────────────────────────

export interface DiffFactory {
  factoryName: string;
  department: string;
  lineName: string | null;
  hakensakiManagerName: string | null;
  hakensakiManagerDept: string | null;
  supervisorName: string | null;
  supervisorDept: string | null;
  phone: string | null;
  existingId: number | null;
  status: "insert" | "update" | "unchanged";
  changes: Record<string, { old: string | null; new: string | null }>;
  employees: Array<{
    id: number;
    employeeNumber: string;
    fullName: string;
    status: string;
  }>;
}

export interface UnassignedEmployee {
  id: number;
  employeeNumber: string;
  fullName: string;
  status: string;
}

export interface ParseResponse {
  parsed: {
    period: string;
    factories: Array<{
      factoryName: string;
      department: string;
      lineName: string;
      hakensakiManagerName: string;
      hakensakiManagerDept: string;
      supervisorName: string;
      supervisorDept: string;
      phone: string;
    }>;
    addresses: Record<string, string>;
    complaint: { name: string; dept: string; phone: string; fax: string };
    overtime: { regular: string; threeShift: string };
  };
  companyId: number;
  diff: DiffFactory[];
  unassigned: UnassignedEmployee[];
  summary: {
    inserts: number;
    updates: number;
    unchanged: number;
    totalEmployees: number;
    unassignedEmployees: number;
  };
}

export interface ApplyResponse {
  success: boolean;
  inserted: number;
  updated: number;
  total: number;
}

export interface ApplyResultWithDiff extends ApplyResponse {
  diff: DiffFactory[];
  unchanged: number;
}

export type PageState = "upload" | "preview" | "result";

// ─── Collapsible Section ────────────────────────────────────────────────

export function CollapsibleSection({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const shouldReduceMotion = useReducedMotion();
  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted/30"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        {icon}
        <span>{title}</span>
        {badge && <span className="ml-auto">{badge}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
            animate={shouldReduceMotion ? undefined : { height: "auto", opacity: 1 }}
            exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/40 p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Status Badge ───────────────────────────────────────────────────────

export function StatusBadge({
  status,
}: {
  status: "insert" | "update" | "unchanged";
}) {
  const config = {
    insert: {
      label: "新規",
      className:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    },
    update: {
      label: "更新",
      className:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    },
    unchanged: {
      label: "変更なし",
      className:
        "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
    },
  };
  const c = config[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
        c.className
      )}
    >
      {c.label}
    </span>
  );
}

// ─── Change Cell (shows old → new for updates) ─────────────────────────

export function ChangeCell({
  value,
  change,
}: {
  value: string | null;
  change?: { old: string | null; new: string | null };
}) {
  if (!change) {
    return <span className="text-xs text-foreground">{value ?? "—"}</span>;
  }
  return (
    <div className="space-y-0.5">
      <span className="text-xs font-medium text-foreground">
        {change.new ?? "—"}
      </span>
      <div className="text-[10px] text-muted-foreground line-through">
        {change.old ?? "（なし）"}
      </div>
    </div>
  );
}

// ─── Factory Group Table ────────────────────────────────────────────────

export function FactoryGroupTable({
  factoryName,
  address,
  items,
}: {
  factoryName: string;
  address: string | null;
  items: DiffFactory[];
}) {
  // Group by department
  const departments = new Map<string, DiffFactory[]>();
  for (const item of items) {
    const key = item.department;
    const arr = departments.get(key) ?? [];
    arr.push(item);
    departments.set(key, arr);
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)] overflow-hidden">
      {/* Factory header */}
      <div className="flex items-center gap-3 border-b border-border/40 bg-muted/20 px-4 py-3">
        <div className="rounded-lg bg-primary/10 p-1.5">
          <Building2 className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground">{factoryName}</h3>
          {address && (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {address}
            </p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {items.length}件
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/60 bg-muted/10">
              <th
                scope="col"
                className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground"
              >
                状態
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground"
              >
                課
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground"
              >
                工区/ライン
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground"
              >
                派遣先責任者
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground"
              >
                指揮命令者
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground"
              >
                電話番号
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground"
              >
                配属社員
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from(departments.entries()).map(([dept, deptItems]) => (
              <DepartmentRows
                key={dept}
                department={dept}
                items={deptItems}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Department Rows ────────────────────────────────────────────────────

function DepartmentRows({
  department,
  items,
}: {
  department: string;
  items: DiffFactory[];
}) {
  return (
    <>
      {items.map((item, idx) => {
        const rowBg =
          item.status === "insert"
            ? "bg-emerald-500/[0.06] dark:bg-emerald-500/[0.08]"
            : item.status === "update"
              ? "bg-amber-500/[0.06] dark:bg-amber-500/[0.08]"
              : "";

        return (
          <tr
            key={`${department}-${item.lineName ?? "dept"}-${idx}`}
            className={cn(
              "border-b border-border/30 last:border-0 transition-colors hover:bg-muted/20",
              rowBg
            )}
          >
            <td className="px-3 py-2">
              <StatusBadge status={item.status} />
            </td>
            <td className="px-3 py-2 text-xs font-medium text-foreground">
              {item.department}
            </td>
            <td className="px-3 py-2 text-xs text-foreground">
              {item.lineName ?? "—"}
            </td>
            <td className="px-3 py-2">
              <ChangeCell
                value={item.hakensakiManagerName}
                change={item.changes["hakensakiManagerName"]}
              />
              {(item.hakensakiManagerDept ||
                item.changes["hakensakiManagerDept"]) && (
                <div className="mt-0.5">
                  <ChangeCell
                    value={item.hakensakiManagerDept}
                    change={item.changes["hakensakiManagerDept"]}
                  />
                </div>
              )}
            </td>
            <td className="px-3 py-2">
              <ChangeCell
                value={item.supervisorName}
                change={item.changes["supervisorName"]}
              />
              {(item.supervisorDept || item.changes["supervisorDept"]) && (
                <div className="mt-0.5">
                  <ChangeCell
                    value={item.supervisorDept}
                    change={item.changes["supervisorDept"]}
                  />
                </div>
              )}
            </td>
            <td className="px-3 py-2">
              <ChangeCell
                value={item.phone}
                change={item.changes["phone"]}
              />
            </td>
            <td className="px-3 py-2">
              {item.employees.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary dark:bg-primary/15 dark:text-primary/90">
                  <Users className="h-3 w-3" />
                  {item.employees.length}名
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground/50">—</span>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}

// ─── Direct Edit Table ──────────────────────────────────────────────────

type EditDraft = {
  hakensakiManagerName: string | null;
  hakensakiManagerDept: string | null;
  hakensakiManagerRole: string | null;
  supervisorName: string | null;
  supervisorDept: string | null;
  supervisorRole: string | null;
  supervisorPhone: string | null;
  conflictDate: string | null;
};

function toDraft(f: Factory): EditDraft {
  return {
    hakensakiManagerName: f.hakensakiManagerName,
    hakensakiManagerDept: f.hakensakiManagerDept,
    hakensakiManagerRole: f.hakensakiManagerRole,
    supervisorName: f.supervisorName,
    supervisorDept: f.supervisorDept,
    supervisorRole: f.supervisorRole,
    supervisorPhone: f.supervisorPhone,
    conflictDate: f.conflictDate,
  };
}

function EditInput({
  value,
  onChange,
  placeholder,
  type = "text",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "date";
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary",
        className
      )}
    />
  );
}

export function KoritsuDirectEditTable() {
  const { data: companies, isLoading: loadingCompanies } = useCompanies();
  const koritsuCompany = useMemo(
    () => companies?.find((c) => c.name.includes("コーリツ")),
    [companies]
  );
  const { data: factories, isLoading: loadingFactories } = useFactories(
    koritsuCompany?.id
  );
  const updateFactory = useUpdateFactory();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EditDraft>({
    hakensakiManagerName: null,
    hakensakiManagerDept: null,
    hakensakiManagerRole: null,
    supervisorName: null,
    supervisorDept: null,
    supervisorRole: null,
    supervisorPhone: null,
    conflictDate: null,
  });

  const groups = useMemo(() => {
    if (!factories) return [] as [string, Factory[]][];
    const map = new Map<string, Factory[]>();
    for (const f of factories) {
      const arr = map.get(f.factoryName) ?? [];
      arr.push(f);
      map.set(f.factoryName, arr);
    }
    return Array.from(map.entries());
  }, [factories]);

  function startEdit(f: Factory) {
    setEditingId(f.id);
    setDraft(toDraft(f));
  }

  function handleSave() {
    if (editingId === null) return;
    updateFactory.mutate(
      { id: editingId, data: draft },
      {
        onSuccess: () => {
          setEditingId(null);
        },
      }
    );
  }

  function handleCancel() {
    setEditingId(null);
  }

  function setField<K extends keyof EditDraft>(key: K, val: string) {
    setDraft((d) => ({ ...d, [key]: val || null }));
  }

  if (loadingCompanies || loadingFactories) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">データを読み込み中…</span>
      </div>
    );
  }

  if (!koritsuCompany) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-amber-600 dark:text-amber-400">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm">コーリツの会社データが見つかりません</span>
      </div>
    );
  }

  if (!factories?.length) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <span className="text-sm">登録されている工場データがありません</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(([factoryName, rows]) => (
        <div
          key={factoryName}
          className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-[var(--shadow-card)]"
        >
          {/* Factory header */}
          <div className="flex items-center gap-3 border-b border-border/40 bg-muted/20 px-4 py-3">
            <div className="rounded-lg bg-primary/10 p-1.5">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-sm font-bold text-foreground">{factoryName}</h3>
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {rows.length}件
            </span>
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/60 bg-muted/10">
                  {[
                    "課",
                    "ライン",
                    "派遣先責任者",
                    "部署",
                    "指揮命令者",
                    "部署",
                    "電話",
                    "抵触日",
                    "",
                  ].map((h, i) => (
                    <th
                      key={i}
                      scope="col"
                      className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => {
                  const isEditing = editingId === f.id;
                  return (
                    <tr
                      key={f.id}
                      className={cn(
                        "border-b border-border/30 last:border-0 transition-colors",
                        isEditing ? "bg-primary/5" : "hover:bg-muted/20"
                      )}
                    >
                      {/* Dept & line always read-only */}
                      <td className="px-3 py-2 text-muted-foreground">
                        {f.department || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {f.lineName || "—"}
                      </td>

                      {isEditing ? (
                        <>
                          <td className="px-2 py-1.5">
                            <EditInput
                              value={draft.hakensakiManagerName ?? ""}
                              onChange={(v) => setField("hakensakiManagerName", v)}
                              className="w-28"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <EditInput
                              value={draft.hakensakiManagerDept ?? ""}
                              onChange={(v) => setField("hakensakiManagerDept", v)}
                              className="w-24"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <EditInput
                              value={draft.supervisorName ?? ""}
                              onChange={(v) => setField("supervisorName", v)}
                              className="w-28"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <EditInput
                              value={draft.supervisorDept ?? ""}
                              onChange={(v) => setField("supervisorDept", v)}
                              className="w-24"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <EditInput
                              value={draft.supervisorPhone ?? ""}
                              onChange={(v) => setField("supervisorPhone", v)}
                              className="w-32"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <EditInput
                              type="date"
                              value={draft.conflictDate ?? ""}
                              onChange={(v) => setField("conflictDate", v)}
                              className="w-36"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={handleSave}
                                disabled={updateFactory.isPending}
                                className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                              >
                                {updateFactory.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                )}
                                保存
                              </button>
                              <button
                                type="button"
                                onClick={handleCancel}
                                className="inline-flex items-center rounded-lg border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted"
                              >
                                取消
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 font-medium">
                            {f.hakensakiManagerName ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {f.hakensakiManagerDept ?? "—"}
                          </td>
                          <td className="px-3 py-2 font-medium">
                            {f.supervisorName ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {f.supervisorDept ?? "—"}
                          </td>
                          <td className="px-3 py-2 font-mono text-muted-foreground">
                            {f.supervisorPhone ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {f.conflictDate ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => startEdit(f)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-muted"
                            >
                              <Pencil className="h-3 w-3" />
                              編集
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Import Result Detail ────────────────────────────────────────────────

export function ImportResultDetail({ diff }: { diff: DiffFactory[] }) {
  const changed = diff.filter((d) => d.status !== "unchanged");

  if (changed.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        変更されたデータはありません
      </p>
    );
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-border/60 bg-muted/30">
            <th scope="col" className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">
              状態
            </th>
            <th scope="col" className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">
              工場名
            </th>
            <th scope="col" className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">
              課
            </th>
            <th scope="col" className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">
              工区/ライン
            </th>
            <th scope="col" className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold text-muted-foreground">
              変更内容
            </th>
          </tr>
        </thead>
        <tbody>
          {changed.map((item, idx) => {
            const changeEntries = Object.entries(item.changes);
            const rowBg =
              item.status === "insert"
                ? "bg-emerald-500/[0.06] dark:bg-emerald-500/[0.08]"
                : "bg-amber-500/[0.06] dark:bg-amber-500/[0.08]";

            return (
              <tr
                key={`${item.factoryName}-${item.department}-${item.lineName ?? ""}-${idx}`}
                className={cn(
                  "border-b border-border/30 last:border-0 transition-colors hover:bg-muted/20",
                  rowBg,
                )}
              >
                <td className="px-3 py-2 align-top">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-3 py-2 align-top text-xs font-medium text-foreground">
                  {item.factoryName}
                </td>
                <td className="px-3 py-2 align-top text-xs text-foreground">
                  {item.department}
                </td>
                <td className="px-3 py-2 align-top text-xs text-foreground">
                  {item.lineName ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {item.status === "insert" ? (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      新規登録
                    </span>
                  ) : (
                    <div className="space-y-1">
                      {changeEntries.map(([label, change]) => (
                        <div key={label} className="flex items-start gap-1.5">
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {label}
                          </span>
                          <span className="text-[10px] text-muted-foreground/70 line-through">
                            {change.old ?? "（なし）"}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50">→</span>
                          <span className="text-[10px] font-medium text-foreground">
                            {change.new ?? "（なし）"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
