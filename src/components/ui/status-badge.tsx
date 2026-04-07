import { Badge } from "./badge";

// Shared contract status config — used across contract list, detail, and history pages
const CONTRACT_STATUS: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "default"; pulse?: boolean }> = {
  draft: { label: "下書き", variant: "secondary" },
  active: { label: "有効", variant: "success", pulse: true },
  expired: { label: "期限切れ", variant: "destructive" },
  cancelled: { label: "取消", variant: "warning" },
  renewed: { label: "更新済", variant: "default" },
};

export function ContractStatusBadge({ status, className, "aria-label": ariaLabel }: { status: string; className?: string; "aria-label"?: string }) {
  const config = CONTRACT_STATUS[status] ?? { label: status, variant: "secondary" as const };
  return (
    <Badge variant={config.variant} dot pulse={config.pulse} className={className} aria-label={ariaLabel ?? config.label}>
      {config.label}
    </Badge>
  );
}

// Employee status config
const EMPLOYEE_STATUS: Record<string, { label: string; variant: "success" | "warning" | "secondary" }> = {
  active: { label: "在籍", variant: "success" },
  inactive: { label: "退職", variant: "secondary" },
  leave: { label: "休職", variant: "warning" },
};

export function EmployeeStatusBadge({ status, className, "aria-label": ariaLabel }: { status: string; className?: string; "aria-label"?: string }) {
  const config = EMPLOYEE_STATUS[status] ?? { label: status, variant: "secondary" as const };
  return (
    <Badge variant={config.variant} dot className={className} aria-label={ariaLabel ?? config.label}>
      {config.label}
    </Badge>
  );
}

// Audit action config
const AUDIT_ACTION: Record<string, { label: string; variant: "success" | "default" | "destructive" | "warning" | "secondary" }> = {
  create: { label: "作成", variant: "success" },
  update: { label: "更新", variant: "default" },
  delete: { label: "削除", variant: "destructive" },
  export: { label: "出力", variant: "secondary" },
  import: { label: "取込", variant: "warning" },
};

export function AuditActionBadge({ action, className, "aria-label": ariaLabel }: { action: string; className?: string; "aria-label"?: string }) {
  const config = AUDIT_ACTION[action] ?? { label: action, variant: "secondary" as const };
  return (
    <Badge variant={config.variant} dot className={className} aria-label={ariaLabel ?? config.label}>
      {config.label}
    </Badge>
  );
}
