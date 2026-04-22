import { useContractFormStore } from "@/stores/contract-form";
import { useCompany } from "@/lib/hooks/use-companies";
import { useFactory } from "@/lib/hooks/use-factories";
import { FileText, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ContractPreview() {
  const { data } = useContractFormStore();
  const { data: company } = useCompany(data.companyId ?? 0);
  const { data: factory } = useFactory(data.factoryId ?? 0);

  const fields = [
    { label: "派遣先", value: company?.name, filled: !!company },
    {
      label: "工場・ライン",
      value: factory
        ? `${factory.factoryName} / ${factory.department || ""} / ${factory.lineName || ""}`
        : "",
      filled: !!factory,
    },
    { label: "開始日", value: data.startDate, filled: !!data.startDate },
    { label: "終了日", value: data.endDate, filled: !!data.endDate },
    { label: "契約日", value: data.contractDate, filled: !!data.contractDate },
    {
      label: "基本時給",
      value: data.hourlyRate ? `¥${data.hourlyRate.toLocaleString()}` : "",
      filled: data.hourlyRate > 0,
    },
    {
      label: "業務内容",
      value: data.jobDescription?.slice(0, 40),
      filled: !!data.jobDescription,
    },
    {
      label: "指揮命令者",
      value: data.supervisorName,
      filled: !!data.supervisorName,
    },
    {
      label: "社員数",
      value: `${data.employeeIds.length} 名`,
      filled: data.employeeIds.length > 0,
    },
  ];

  const filledCount = fields.filter((f) => f.filled).length;
  const progressPercent = Math.round((filledCount / fields.length) * 100);

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-primary/8 p-1.5">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-semibold">契約プレビュー</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-16">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  filledCount === fields.length
                    ? "bg-[var(--color-status-ok)]"
                    : "bg-primary"
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {filledCount}/{fields.length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <div
            key={field.label}
            className={cn(
              "flex items-start gap-2.5 rounded-md p-2 text-sm transition-colors",
              field.filled ? "bg-[var(--color-status-ok-muted)]" : "bg-muted/30"
            )}
          >
            {field.filled ? (
              <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-status-ok)_15%,transparent)]">
                <Check className="h-3 w-3 text-[var(--color-status-ok)]" />
              </div>
            ) : (
              <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-status-error)_12%,transparent)]">
                <X className="h-3 w-3 text-[var(--color-status-error)]" />
              </div>
            )}
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-muted-foreground/70">
                {field.label}
              </span>
              <p className={cn(
                "truncate text-sm",
                field.filled ? "font-medium" : "text-muted-foreground/50"
              )}>
                {field.value || "未入力"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
