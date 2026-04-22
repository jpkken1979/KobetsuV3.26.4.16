import { useState } from "react";
import { Check, AlertTriangle, Pencil, X, Save, MapPin, Lock } from "lucide-react";
import type { FactoryGroupRoles, RoleKey, RoleValue, RoleSummary } from "@/lib/api";
import { useBulkUpdateRoles } from "@/lib/hooks/use-factories";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const ROLE_LABELS: Record<RoleKey, string> = {
  hakensakiManager: "派遣先責任者",
  complaintClient: "苦情処理（派遣先）",
  complaintUns: "苦情処理（UNS）",
  managerUns: "派遣元責任者",
};

const HAS_ADDRESS: RoleKey[] = ["complaintUns", "managerUns"];

interface Props {
  companyId: number;
  group: FactoryGroupRoles;
}

export function FactoryRolesHeader({ companyId, group }: Props) {
  const [editingRole, setEditingRole] = useState<RoleKey | null>(null);
  const [editValue, setEditValue] = useState<RoleValue>({
    name: null,
    dept: null,
    phone: null,
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const bulkUpdate = useBulkUpdateRoles();

  // Don't show for single-line factories — no grouping benefit
  if (group.lineCount <= 1) return null;

  function startEdit(roleKey: RoleKey, current: RoleValue) {
    setEditingRole(roleKey);
    setEditValue({ ...current });
  }

  function cancelEdit() {
    setEditingRole(null);
  }

  function requestSave() {
    setConfirmOpen(true);
  }

  // Apply to ALL lines in the factory (no exclusions)
  function confirmSave() {
    if (!editingRole) return;
    bulkUpdate.mutate(
      {
        companyId,
        factoryName: group.factoryName,
        roleKey: editingRole,
        value: editValue,
        excludeLineIds: [],
      },
      {
        onSuccess: () => {
          setEditingRole(null);
          setConfirmOpen(false);
        },
      }
    );
  }

  const editingOverrides = editingRole
    ? group.roles[editingRole].overrides
    : [];
  const roleLabel = editingRole ? ROLE_LABELS[editingRole] : "";

  return (
    <div className="mb-3 rounded-lg border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold text-foreground">
        <span>担当者（工場共通）</span>
      </div>
      <div className="space-y-1.5">
        {(Object.entries(ROLE_LABELS) as [RoleKey, string][]).map(
          ([roleKey, label]) => {
            const role = group.roles[roleKey];
            const isEditing = editingRole === roleKey;
            const hasAddress = HAS_ADDRESS.includes(roleKey);

            return (
              <RoleRow
                key={roleKey}
                label={label}
                role={role}
                isEditing={isEditing}
                editValue={editValue}
                hasAddress={hasAddress}
                onStartEdit={() => startEdit(roleKey, role.majority)}
                onCancelEdit={cancelEdit}
                onRequestSave={requestSave}
                onEditValueChange={setEditValue}
              />
            );
          }
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="担当者を一括更新"
        description={
          editingOverrides.length > 0
            ? `${group.factoryName}の全${group.lineCount}ラインに${roleLabel}を適用します。\n\n以下の${editingOverrides.length}件は現在異なる値ですが、すべて上書きされます:\n${editingOverrides.map((o) => `• ${o.lineName} (${o.value.name})`).join("\n")}`
            : `${group.factoryName}の全${group.lineCount}ラインに${roleLabel}を適用しますか？`
        }
        confirmLabel={`全${group.lineCount}件に適用`}
        onConfirm={confirmSave}
        isPending={bulkUpdate.isPending}
      />
    </div>
  );
}

// --- RoleRow sub-component ---

interface RoleRowProps {
  label: string;
  role: RoleSummary;
  isEditing: boolean;
  editValue: RoleValue;
  hasAddress: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onRequestSave: () => void;
  onEditValueChange: (v: RoleValue) => void;
}

function RoleRow({
  label,
  role,
  isEditing,
  editValue,
  hasAddress,
  onStartEdit,
  onCancelEdit,
  onRequestSave,
  onEditValueChange,
}: RoleRowProps) {
  if (isEditing) {
    return (
      <div className="rounded-md border border-primary/30 bg-primary/5 p-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-primary">{label}</span>
          <div className="flex gap-1">
            <button
              onClick={onCancelEdit}
              aria-label="キャンセル"
              className="rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onRequestSave}
              aria-label="保存"
              className="rounded bg-primary p-1 text-primary-foreground hover:bg-primary/90"
            >
              <Save className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <input
            className="rounded border border-border bg-background px-2 py-1 text-xs"
            placeholder="氏名"
            value={editValue.name ?? ""}
            onChange={(e) =>
              onEditValueChange({
                ...editValue,
                name: e.target.value || null,
              })
            }
          />
          <input
            className="rounded border border-border bg-background px-2 py-1 text-xs"
            placeholder="部署"
            value={editValue.dept ?? ""}
            onChange={(e) =>
              onEditValueChange({
                ...editValue,
                dept: e.target.value || null,
              })
            }
          />
          <input
            className="rounded border border-border bg-background px-2 py-1 text-xs"
            placeholder="電話番号"
            value={editValue.phone ?? ""}
            onChange={(e) =>
              onEditValueChange({
                ...editValue,
                phone: e.target.value || null,
              })
            }
          />
        </div>
        {hasAddress && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
            <input
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
              placeholder="住所（事業所）"
              value={editValue.address ?? ""}
              onChange={(e) =>
                onEditValueChange({
                  ...editValue,
                  address: e.target.value || null,
                })
              }
            />
          </div>
        )}
      </div>
    );
  }

  // Display mode
  const { majority, shared, overrides } = role;
  const displayName = majority.name || "未設定";
  const displayDept = majority.dept || "";
  const displayPhone = majority.phone || "";

  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-white/60 dark:hover:bg-white/5">
      {/* Shared/Override badge */}
      {shared ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-[var(--color-status-ok)]" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[var(--color-status-error)]" />
      )}

      {/* Label */}
      <span className="w-28 shrink-0 font-medium text-foreground">{label}</span>

      {/* Value */}
      <span className="flex-1 truncate font-bold text-foreground">{displayName}</span>
      <span className="hidden truncate font-medium text-foreground/70 sm:block">
        {displayDept}
      </span>
      <span className="hidden truncate font-medium text-foreground/70 md:block">
        {displayPhone}
      </span>

      {/* Override count */}
      {!shared && (
        <span
          className="shrink-0 rounded-md bg-[var(--color-status-error-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-status-error)]"
          title={overrides
            .map((o) => `${o.lineName}: ${o.value.name}`)
            .join("\n")}
        >
          <Lock className="mr-0.5 inline h-2.5 w-2.5" />
          {overrides.length}件異なる
        </span>
      )}

      {/* Address indicator */}
      {hasAddress && majority.address && (
        <span title={majority.address}>
          <MapPin className="h-3 w-3 shrink-0 text-blue-500 dark:text-blue-400" />
        </span>
      )}

      {/* Edit button */}
      <button
        onClick={onStartEdit}
        aria-label="編集"
        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}
