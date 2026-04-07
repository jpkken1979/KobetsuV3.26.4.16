import { useState, useCallback } from "react";
import { toast } from "sonner";
import { api, type RoleKey, type RoleValue } from "@/lib/api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldInput, INPUT_CLS } from "./-shared";
import { PersonnelTable } from "./-personnel-table";
import type { StepProps } from "./-factory-step-types";

// ─── Step 4: Personnel ───────────────────────────────────────────────

// Mapping from ROLE_GROUPS keys to form field prefixes
const ROLE_FIELD_MAP: Record<RoleKey, { name: string; dept: string; phone: string; address?: string }> = {
  hakensakiManager: { name: "hakensakiManagerName", dept: "hakensakiManagerDept", phone: "hakensakiManagerPhone" },
  complaintClient: { name: "complaintClientName", dept: "complaintClientDept", phone: "complaintClientPhone" },
  complaintUns: { name: "complaintUnsName", dept: "complaintUnsDept", phone: "complaintUnsPhone", address: "complaintUnsAddress" },
  managerUns: { name: "managerUnsName", dept: "managerUnsDept", phone: "managerUnsPhone", address: "managerUnsAddress" },
};

export function StepPersonnel({
  form,
  updateForm,
  companyId,
}: StepProps & { editingId: number | null; companyId: number }) {
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);

  const factoryName = String(form.factoryName ?? "");

  const handleBulkApply = useCallback(async () => {
    if (!factoryName) {
      toast.error("工場名が設定されていません");
      setBulkConfirmOpen(false);
      return;
    }

    setBulkPending(true);
    let totalUpdated = 0;

    try {
      for (const [roleKey, fields] of Object.entries(ROLE_FIELD_MAP)) {
        const value: RoleValue = {
          name: (form[fields.name] as string) ?? null,
          dept: (form[fields.dept] as string) ?? null,
          phone: (form[fields.phone] as string) ?? null,
        };
        if (fields.address) {
          value.address = (form[fields.address] as string) ?? null;
        }

        const result = await api.bulkUpdateFactoryRoles({
          companyId,
          factoryName,
          roleKey: roleKey as RoleKey,
          value,
        });
        totalUpdated = Math.max(totalUpdated, result.updated);
      }

      toast.success(`${totalUpdated}件のラインに適用しました`);
      setBulkConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "一括適用に失敗しました");
    } finally {
      setBulkPending(false);
    }
  }, [companyId, factoryName, form]);

  return (
    <div className="space-y-4">
      <PersonnelTable form={form} onChange={updateForm} />

      {/* Bulk apply to all lines */}
      {factoryName && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setBulkConfirmOpen(true)}
            className="text-xs text-primary hover:bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5"
          >
            全ラインに適用
          </button>
        </div>
      )}

      <ConfirmDialog
        open={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkApply}
        title="全ラインに担当者を適用"
        description="この操作で同じ工場の全ラインの担当者が上書きされます。続けますか？"
        confirmLabel="適用する"
        variant="destructive"
        isPending={bulkPending}
      />

      {/* Explainer */}
      <div className="border-t border-border/30 pt-4">
        <FieldInput
          label="説明者"
          value={form.explainerName}
          onChange={(v) => updateForm("explainerName", v)}
          placeholder="説明者名"
        />
      </div>

      {/* UNS address section */}
      <div className="space-y-2 rounded-xl border border-border/40 bg-card/50 p-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            派遣元責任者　所在地
          </label>
          <input
            type="text"
            value={String(form.managerUnsAddress ?? "")}
            onChange={(e) => {
              updateForm("managerUnsAddress", e.target.value || null);
              // If same address is checked, sync both
              const isSame =
                !form.complaintUnsAddress ||
                form.complaintUnsAddress === form.managerUnsAddress;
              if (isSame) {
                updateForm(
                  "complaintUnsAddress",
                  e.target.value || null,
                );
              }
            }}
            className={INPUT_CLS}
            placeholder="例：岡山県岡山市北区御津田1028番地19"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={
              !form.managerUnsAddress ||
              !form.complaintUnsAddress ||
              form.managerUnsAddress === form.complaintUnsAddress
            }
            onChange={(e) => {
              if (e.target.checked) {
                updateForm(
                  "complaintUnsAddress",
                  form.managerUnsAddress ?? null,
                );
              } else {
                updateForm("complaintUnsAddress", "");
              }
            }}
            className="h-4 w-4 rounded border-border text-primary accent-primary"
          />
          <span className="text-xs text-muted-foreground">
            苦情処理（UNS）と同じ所在地
          </span>
        </label>

        {form.complaintUnsAddress !== undefined &&
          form.managerUnsAddress !== form.complaintUnsAddress &&
          form.complaintUnsAddress !== null && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                苦情処理（UNS）所在地
              </label>
              <input
                type="text"
                value={String(form.complaintUnsAddress ?? "")}
                onChange={(e) =>
                  updateForm(
                    "complaintUnsAddress",
                    e.target.value || null,
                  )
                }
                className={INPUT_CLS}
                placeholder="例：愛知県名古屋市東区徳川2-18-18"
              />
            </div>
          )}
      </div>
    </div>
  );
}
