import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Factory, X, Save, Copy } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { api, type Factory as FactoryType } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useFactories, useFactoryRoles } from "@/lib/hooks/use-factories";
import { FactoryRolesHeader } from "./-factory-roles-header";
import { FactoryCard } from "./-factory-card";
import { BulkEditModal } from "./-bulk-edit-modal";
import { FactoryDrawer } from "./-factory-drawer";
import { AVATAR_COLORS } from "./-shared";

export function FactoryPanel({
  companyId,
  companyName,
  colorIndex,
  conflictWarningDays,
  initialAction,
  onClose,
}: {
  companyId: number;
  companyName?: string;
  colorIndex: number;
  conflictWarningDays: number;
  initialAction: "view" | "companyInfo" | "newLine";
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: factoriesList, isLoading } = useFactories(companyId);
  const [drawerState, setDrawerState] = useState<{ open: boolean; editingId: number | null }>({
    open: false,
    editingId: null,
  });
  const [bulkEditGroup, setBulkEditGroup] = useState<{ factoryName: string; lines: FactoryType[] } | null>(null);
  const { data: roleSummary } = useFactoryRoles(companyId);
  const shouldReduceMotion = useReducedMotion();

  // Load employee counts per factory line
  const { data: employeesList } = useQuery({
    queryKey: queryKeys.employees.all({ companyId, status: "active" }),
    queryFn: () => api.getEmployees({ companyId, status: "active" }),
    enabled: companyId > 0,
  });
  const employeeCountByFactory = new Map<number, number>();
  if (employeesList) {
    for (const emp of employeesList) {
      if (emp.factoryId) {
        employeeCountByFactory.set(emp.factoryId, (employeeCountByFactory.get(emp.factoryId) ?? 0) + 1);
      }
    }
  }

  const [editingCompany, setEditingCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({ name: "", address: "", phone: "", representative: "" });
  const lastHandledActionRef = useRef<"view" | "companyInfo" | "newLine" | null>(null);
  const color = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];

  useEffect(() => {
    if (initialAction === lastHandledActionRef.current) return;
    if (initialAction === "companyInfo") {
      setEditingCompany(true);
    }
    if (initialAction === "newLine") {
      setDrawerState({ open: true, editingId: null });
    }
    lastHandledActionRef.current = initialAction;
  }, [initialAction]);

  // Load company data for editing
  const { data: companyData } = useQuery({
    queryKey: queryKeys.companies.detail(companyId),
    queryFn: () => api.getCompany(companyId),
    enabled: editingCompany,
  });

  useEffect(() => {
    if (companyData && editingCompany) {
      setCompanyForm({
        name: companyData.name || "",
        address: companyData.address || "",
        phone: companyData.phone || "",
        representative: companyData.representative || "",
      });
    }
  }, [companyData, editingCompany]);

  const updateCompanyMut = useMutation({
    mutationFn: (data: Record<string, string>) => api.updateCompany(companyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.invalidateAll });
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.detail(companyId) });
      toast.success("企業情報を更新しました");
      setEditingCompany(false);
    },
    onError: () => toast.error("企業情報の更新に失敗しました"),
  });

  const grouped: Record<string, FactoryType[]> = {};
  for (const f of factoriesList ?? []) {
    const name = f.factoryName || "その他";
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push(f);
  }

  const openDrawer = (editingId: number | null) => {
    setDrawerState({ open: true, editingId });
  };

  const closeDrawer = () => {
    setDrawerState({ open: false, editingId: null });
  };

  return (
    <>
      <div className={cn("overflow-hidden rounded-2xl border backdrop-blur-2xl card-hyper", "border-border/60 shadow-2xl")}>
        <div className="flex items-center justify-between border-b border-border/60 px-8 py-6 bg-card">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-black text-white shadow-2xl",
                color.bg,
              )}
            >
              {companyName?.charAt(0)}
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tighter text-foreground uppercase">{companyName}</h3>
              <div className="mt-1 flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-primary/60">
                  <Factory className="h-3 w-3" />
                  {factoriesList?.length ?? 0} SYSTEMS
                </span>
                <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                <span className="flex items-center gap-1.5 text-[10px] font-black tracking-widest text-muted-foreground/60">
                  <Factory className="h-3 w-3" />
                  {Object.keys(grouped).length} FACILITIES
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditingCompany((v) => !v)}
              className={cn(
                "btn-press inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black tracking-widest uppercase transition-all",
                editingCompany
                  ? "bg-[var(--color-status-warning-muted)] text-[var(--color-status-warning)] border border-[var(--color-status-warning)]/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground border border-border/60",
              )}
            >
              <Pencil className="h-3.5 w-3.5" />
              SETTINGS
            </button>
            <button
              onClick={() => openDrawer(null)}
              className="btn-press inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[10px] font-black tracking-widest uppercase text-primary-foreground shadow-[0_10px_24px_rgba(51,65,163,0.16)] dark:shadow-[0_10px_24px_rgba(155,167,255,0.16)] transition-all hover:bg-primary/90 hover:scale-105 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              DEPLOY LINE
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="ml-2 rounded-xl p-2.5 text-muted-foreground transition-all hover:bg-[var(--color-status-error-muted)] hover:text-[var(--color-status-error)] border border-transparent hover:border-[var(--color-status-error)]/20"
              aria-label="閉じる"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Company Info Edit Form */}
        <AnimatePresence>
          {editingCompany && (
            <motion.div
              {...(shouldReduceMotion
                ? {}
                : {
                    initial: { height: 0, opacity: 0 },
                    animate: { height: "auto", opacity: 1 },
                    exit: { height: 0, opacity: 0 },
                    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
                  })}
              className="overflow-hidden border-b border-border/60"
            >
              <div className="grid grid-cols-1 gap-4 bg-muted/20 px-8 py-6 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">ENTITY NAME</label>
                  <input
                    type="text"
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-xl border border-input bg-muted/30 px-4 py-2.5 text-sm font-medium text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">REPRESENTATIVE</label>
                  <input
                    type="text"
                    value={companyForm.representative}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, representative: e.target.value }))}
                    className="w-full rounded-xl border border-input bg-muted/30 px-4 py-2.5 text-sm font-medium text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
                    BASE LOCATION <span className="text-amber-500/60 ml-2 font-bold tracking-normal italic">(REGISTRY ADDRESS)</span>
                  </label>
                  <input
                    type="text"
                    value={companyForm.address}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, address: e.target.value }))}
                    className="w-full rounded-xl border border-input bg-muted/30 px-4 py-2.5 text-sm font-medium text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                    placeholder="〒000-0000 ..."
                  />
                </div>
                <div className="sm:col-span-2 flex items-center gap-4 pt-2">
                  <button
                    onClick={() => updateCompanyMut.mutate(companyForm)}
                    disabled={updateCompanyMut.isPending}
                    className="btn-press inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-[10px] font-black tracking-widest uppercase text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50 shadow-[0_10px_24px_rgba(51,65,163,0.14)] dark:shadow-[0_10px_24px_rgba(155,167,255,0.12)]"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {updateCompanyMut.isPending ? "UPLOADING..." : "SYNC DATA"}
                  </button>
                  <button
                    onClick={() => setEditingCompany(false)}
                    className="rounded-xl px-4 py-2.5 text-[10px] font-black tracking-widest uppercase text-muted-foreground hover:bg-muted/30 transition-all"
                  >
                    ABORT
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-8">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-32 w-full rounded-2xl" />
              ))}
            </div>
          ) : (factoriesList ?? []).length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center border-2 border-dashed border-border/60 rounded-3xl">
              <div className="rounded-full bg-muted/20 p-6 border border-border/60">
                <Factory className="h-12 w-12 text-muted-foreground/20" />
              </div>
              <p className="mt-6 text-sm font-black uppercase tracking-widest text-muted-foreground/60">
                No active systems found
              </p>
              <button
                onClick={() => openDrawer(null)}
                className="mt-4 text-[10px] font-black text-primary/70 hover:text-primary transition-colors uppercase tracking-[0.2em]"
              >
                + Initialize New Line
              </button>
            </div>
          ) : (
            <div className="space-y-10">
              {Object.entries(grouped).map(([factoryName, lines]) => (
                <div key={factoryName} className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/40 to-transparent" />
                    <div className="flex items-center gap-3 px-4 py-1 rounded-full border border-border/60 bg-muted/20">
                      <Factory className="h-3.5 w-3.5 text-primary/40" />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/80">{factoryName}</span>
                      <span className="gauge-value rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">
                        {lines.length}
                      </span>
                    </div>
                    {lines.length > 1 && (
                      <button
                        onClick={() => setBulkEditGroup({ factoryName, lines })}
                        className="btn-press inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-primary transition-all hover:bg-primary/20 border border-primary/20"
                      >
                        <Copy className="h-3 w-3" />
                        GROUP EDIT
                      </button>
                    )}
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/40 to-transparent" />
                  </div>
                  
                  {roleSummary && (() => {
                    const groupRoles = roleSummary.find((g) => g.factoryName === factoryName);
                    return groupRoles ? (
                      <div className="px-2">
                        <FactoryRolesHeader companyId={companyId} group={groupRoles} />
                      </div>
                    ) : null;
                  })()}
                  
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {lines.map((f) => (
                      <FactoryCard
                        key={f.id}
                        factory={f}
                        employeeCount={employeeCountByFactory.get(f.id) ?? 0}
                        conflictWarningDays={conflictWarningDays}
                        onEdit={() => openDrawer(f.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Factory Drawer (slide-over) — portaled to avoid scroll jump */}
      {createPortal(
        <AnimatePresence>
          {drawerState.open && (
            <FactoryDrawer
              companyId={companyId}
              editingId={drawerState.editingId}
              onClose={closeDrawer}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Bulk Edit Modal — portaled to avoid scroll jump */}
      {createPortal(
        <AnimatePresence>
          {bulkEditGroup && (
            <BulkEditModal
              factoryName={bulkEditGroup.factoryName}
              lines={bulkEditGroup.lines}
              onClose={() => setBulkEditGroup(null)}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}


