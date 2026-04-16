import { useState, useRef, useEffect } from "react";
import { Clock, Users, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useDeleteFactory, useUpdateFactory } from "@/lib/hooks/use-factories";
import type { Factory as FactoryType } from "@/lib/api";
import { getConflictDateStatus } from "./-shared";
import { FactoryYearlyConfigDialog } from "./-factory-yearly-config";

export function QuickEditField({
  value,
  type,
  onSave,
  onCancel,
  prefix,
  className,
}: {
  value: string;
  type: "number" | "date";
  onSave: (val: string) => void;
  onCancel: () => void;
  prefix?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = () => {
    onSave(localVal);
  };

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      onClick={(e) => e.stopPropagation()}
    >
      {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
      <input
        ref={inputRef}
        type={type}
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") onCancel();
        }}
        onBlur={handleSave}
        className={cn(
          "rounded border border-primary/40 bg-background px-1.5 py-0.5 text-xs shadow-sm outline-none ring-2 ring-primary/20",
          type === "number" ? "w-20" : "w-32",
        )}
      />
    </div>
  );
}

export function FactoryCard({
  factory,
  employeeCount = 0,
  conflictWarningDays,
  onEdit,
}: {
  factory: FactoryType;
  employeeCount?: number;
  conflictWarningDays: number;
  onEdit: () => void;
}) {
  const deleteMutation = useDeleteFactory();
  const updateMutation = useUpdateFactory();
  const [confirming, setConfirming] = useState(false);
  const [editingRate, setEditingRate] = useState(false);
  const [editingConflictDate, setEditingConflictDate] = useState(false);
  const [yearlyConfigOpen, setYearlyConfigOpen] = useState(false);
  const conflictStatus = getConflictDateStatus(factory.conflictDate, conflictWarningDays);

  const handleQuickSaveRate = (val: string) => {
    setEditingRate(false);
    const numVal = val ? Number(val) : null;
    if (numVal !== factory.hourlyRate) {
      updateMutation.mutate({ id: factory.id, data: { hourlyRate: numVal } });
    }
  };

  const handleQuickSaveConflictDate = (val: string) => {
    setEditingConflictDate(false);
    if (val !== (factory.conflictDate ?? "")) {
      updateMutation.mutate({ id: factory.id, data: { conflictDate: val || null } });
    }
  };

  return (
    <div className="group relative cursor-pointer rounded-xl border border-border/60 bg-card p-4 transition-all duration-300 hover:bg-white/[0.06] hover:border-primary/40 hover:shadow-[0_16px_44px_rgba(18,19,22,0.12),inset_0_1px_0_rgba(255,255,255,0.35)] hover:scale-[1.01]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-black uppercase tracking-wider text-muted-foreground/60">Module</p>
          <p className="mt-0.5 truncate text-sm font-bold text-foreground group-hover:text-primary transition-colors">
            {factory.department || "--"}
          </p>
          <p className={cn(
            "mt-1 truncate text-[10px] font-bold tracking-tight px-1.5 py-0.5 rounded-md inline-block border",
            factory.lineName
              ? "bg-white/5 border-border text-muted-foreground"
              : "bg-red-500/10 border-red-500/20 text-red-400"
          )}>
            {factory.lineName || "ライン未設定"}
          </p>
          {employeeCount > 0 && (
            <p className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-primary/50">
              <Users className="h-3 w-3" />
              {employeeCount}名 配属中
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Quick-edit: hourly rate */}
          {editingRate ? (
            <QuickEditField
              value={String(factory.hourlyRate ?? "")}
              type="number"
              onSave={handleQuickSaveRate}
              onCancel={() => setEditingRate(false)}
              prefix="¥"
            />
          ) : (factory.hourlyRate ?? 0) > 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingRate(true);
              }}
              className="gauge-value flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-sm font-black text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)] transition-all hover:bg-emerald-500/20"
            >
              <span className="text-[10px] opacity-60">¥</span>
              {factory.hourlyRate!.toLocaleString()}
            </button>
          ) : null}
          
          {factory.shiftPattern && (
            <span className="rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[9px] font-black text-primary/80">
              {factory.shiftPattern}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
        {factory.jobDescription && (
          <p className="truncate text-[11px] font-medium text-muted-foreground/70 italic">
            " {factory.jobDescription} "
          </p>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {(factory.workHours || factory.workHoursDay) && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/60">
              <Clock className="h-3 w-3 text-primary/40" />
              <span>{factory.workHours || `${factory.workHoursDay}`}</span>
            </div>
          )}
          {factory.supervisorName && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground/60">
              <Users className="h-3 w-3 text-muted-foreground/40" />
              <span>{factory.supervisorName}</span>
            </div>
          )}
        </div>

        {/* Quick-edit: conflict date */}
        {editingConflictDate ? (
          <div className="mt-2">
            <QuickEditField
              value={factory.conflictDate ?? ""}
              type="date"
              onSave={handleQuickSaveConflictDate}
              onCancel={() => setEditingConflictDate(false)}
            />
          </div>
        ) : factory.conflictDate ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingConflictDate(true);
            }}
            className={cn(
              "mt-1 w-full flex items-center justify-center gap-2 rounded-lg border px-2 py-1.5 text-[10px] font-black transition-all",
              conflictStatus.tone === "expired" && "bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.1)]",
              conflictStatus.tone === "warning" && "bg-amber-500/10 border-amber-500/30 text-amber-400",
              conflictStatus.tone === "normal" && "bg-primary/5 border-border/60 text-muted-foreground/60 hover:border-primary/20",
            )}
          >
            <AlertTriangle className="h-3 w-3" />
            LIMIT: {factory.conflictDate}
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 rounded-md bg-muted/30 text-[10px] font-black hover:bg-white/10"
          onClick={(e) => { e.stopPropagation(); setYearlyConfigOpen(true); }}
        >
          年度
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 rounded-md bg-muted/30 text-[10px] font-black hover:bg-white/10"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
        >
          EDIT
        </Button>
        <button
          className={cn(
            "h-7 px-3 rounded-md text-[10px] font-black transition-all",
            confirming
              ? "bg-red-600 text-white shadow-[0_0_15px_rgba(220,20,60,0.4)]"
              : "bg-muted/30 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
          )}
          onClick={(e) => {
            e.stopPropagation();
            if (confirming) deleteMutation.mutate(factory.id);
            else setConfirming(true);
          }}
        >
          {confirming ? "CONFIRM" : "DELETE"}
        </button>
      </div>

      <FactoryYearlyConfigDialog
        factoryId={factory.id}
        companyId={factory.companyId}
        factoryLabel={`${factory.factoryName} / ${factory.department ?? ""} / ${factory.lineName ?? ""}`}
        open={yearlyConfigOpen}
        onClose={() => setYearlyConfigOpen(false)}
      />
    </div>
  );
}

