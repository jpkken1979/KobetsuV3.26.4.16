import { useState } from "react";
import { Building2, Plus, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useCompanyYearlyConfigs,
  useCreateCompanyYearlyConfig,
  useUpdateCompanyYearlyConfig,
  useDeleteCompanyYearlyConfig,
} from "@/lib/hooks/use-company-yearly-config";
import type { CompanyYearlyConfig, CompanyYearlyConfigCreate } from "@/lib/api-types";

function getFiscalYear(date: Date): number {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month >= 10 ? year : year - 1;
}

const CURRENT_FISCAL_YEAR = getFiscalYear(new Date());

interface FormState {
  fiscalYear: number;
  kyujitsuText: string;
  kyuukashori: string;
  hakensakiManagerName: string;
  hakensakiManagerDept: string;
  hakensakiManagerRole: string;
  hakensakiManagerPhone: string;
}

const EMPTY_FORM: FormState = {
  fiscalYear: CURRENT_FISCAL_YEAR,
  kyujitsuText: "",
  kyuukashori: "",
  hakensakiManagerName: "",
  hakensakiManagerDept: "",
  hakensakiManagerRole: "",
  hakensakiManagerPhone: "",
};

function configToForm(c: CompanyYearlyConfig): FormState {
  return {
    fiscalYear: c.fiscalYear,
    kyujitsuText: c.kyujitsuText ?? "",
    kyuukashori: c.kyuukashori ?? "",
    hakensakiManagerName: c.hakensakiManagerName ?? "",
    hakensakiManagerDept: c.hakensakiManagerDept ?? "",
    hakensakiManagerRole: c.hakensakiManagerRole ?? "",
    hakensakiManagerPhone: c.hakensakiManagerPhone ?? "",
  };
}

function formToNullable(f: FormState) {
  const n = (v: string) => (v.trim() === "" ? null : v.trim());
  return {
    kyujitsuText: n(f.kyujitsuText),
    kyuukashori: n(f.kyuukashori),
    hakensakiManagerName: n(f.hakensakiManagerName),
    hakensakiManagerDept: n(f.hakensakiManagerDept),
    hakensakiManagerRole: n(f.hakensakiManagerRole),
    hakensakiManagerPhone: n(f.hakensakiManagerPhone),
  };
}

// ─── Inner form ─────────────────────────────────────────────────────

function CompanyYearlyConfigForm({
  companyId,
  editingConfig,
  onClose,
}: {
  companyId: number;
  editingConfig: CompanyYearlyConfig | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(
    editingConfig ? configToForm(editingConfig) : EMPTY_FORM
  );
  const create = useCreateCompanyYearlyConfig();
  const update = useUpdateCompanyYearlyConfig(companyId);

  const set = (k: keyof FormState, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (editingConfig) {
      update.mutate({ id: editingConfig.id, data: formToNullable(form) }, { onSuccess: onClose });
    } else {
      const payload: CompanyYearlyConfigCreate = { companyId, fiscalYear: form.fiscalYear, ...formToNullable(form) };
      create.mutate(payload, { onSuccess: onClose });
    }
  };

  const isPending = create.isPending || update.isPending;

  const field = (label: string, key: keyof FormState, placeholder?: string) => (
    <div className="grid grid-cols-3 items-center gap-2">
      <label className="text-xs text-muted-foreground text-right pr-2">{label}</label>
      <input
        className="col-span-2 rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        value={form[key] as string}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  const textarea = (label: string, key: keyof FormState, rows = 3) => (
    <div className="grid grid-cols-3 items-start gap-2">
      <label className="text-xs text-muted-foreground text-right pr-2 pt-1">{label}</label>
      <textarea
        className="col-span-2 rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        rows={rows}
        value={form[key] as string}
        onChange={(e) => set(key, e.target.value)}
      />
    </div>
  );

  return (
    <div className="space-y-4 py-2">
      {/* 年度 */}
      {!editingConfig && (
        <div className="grid grid-cols-3 items-center gap-2">
          <label className="text-xs text-muted-foreground text-right pr-2">年度 (fiscal year)</label>
          <input
            type="number"
            className="col-span-2 rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={form.fiscalYear}
            min={2000}
            max={2100}
            onChange={(e) => set("fiscalYear", Number(e.target.value))}
          />
        </div>
      )}

      {/* 就業条件 */}
      <div className="border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">就業条件</p>
        {textarea("休日テキスト", "kyujitsuText", 2)}
        {textarea("休暇処理", "kyuukashori", 2)}
      </div>

      {/* 派遣先責任者 */}
      <div className="border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">派遣先責任者</p>
        {field("氏名", "hakensakiManagerName")}
        {field("部署", "hakensakiManagerDept")}
        {field("役職", "hakensakiManagerRole")}
        {field("電話", "hakensakiManagerPhone")}
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
          キャンセル
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={isPending}>
          {isPending ? "保存中…" : "保存"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main dialog ─────────────────────────────────────────────────────

export function CompanyYearlyConfigDialog({
  companyId,
  companyLabel,
  open,
  onClose,
}: {
  companyId: number;
  companyLabel: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data: configs, isLoading } = useCompanyYearlyConfigs(open ? companyId : null);
  const deleteConfig = useDeleteCompanyYearlyConfig(companyId);
  const [formMode, setFormMode] = useState<"new" | CompanyYearlyConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyYearlyConfig | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleClose = () => {
    setFormMode(null);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-4" />
            企業年度別設定 — {companyLabel}
          </DialogTitle>
        </DialogHeader>

        {/* Form for new / edit */}
        {formMode !== null && (
          <div className="rounded-lg border bg-muted/30 p-4 mb-2">
            <p className="text-sm font-medium mb-3">
              {formMode === "new" ? "新しい年度設定を追加" : `${(formMode as CompanyYearlyConfig).fiscalYear}年度を編集`}
            </p>
            <CompanyYearlyConfigForm
              companyId={companyId}
              editingConfig={formMode === "new" ? null : (formMode as CompanyYearlyConfig)}
              onClose={() => setFormMode(null)}
            />
          </div>
        )}

        {/* Add button */}
        {formMode === null && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => setFormMode("new")}
          >
            <Plus className="size-3 mr-1" />
            年度設定を追加
          </Button>
        )}

        {/* List */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">読み込み中…</p>
        ) : !configs?.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            設定がありません。「年度設定を追加」から作成してください。
          </p>
        ) : (
          <div className="space-y-2 mt-2">
            {configs.map((c) => (
              <div key={c.id} className="rounded-lg border bg-card">
                {/* Header row */}
                <div
                  className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-muted/40"
                  onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{c.fiscalYear}年度</span>
                    <span className="text-xs text-muted-foreground">
                      {c.fiscalYear}/10/01 〜 {c.fiscalYear + 1}/09/30
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      onClick={(e) => { e.stopPropagation(); setFormMode(c); }}
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                    {expandedId === c.id
                      ? <ChevronUp className="size-3 text-muted-foreground" />
                      : <ChevronDown className="size-3 text-muted-foreground" />
                    }
                  </div>
                </div>

                {/* Expanded detail */}
                {expandedId === c.id && (
                  <div className="px-4 pb-3 border-t grid grid-cols-2 gap-x-6 gap-y-1 text-xs pt-2">
                    {c.kyujitsuText && <Row label="休日" value={c.kyujitsuText} />}
                    {c.kyuukashori && <Row label="休暇処理" value={c.kyuukashori} />}
                    {c.hakensakiManagerName && (
                      <Row label="派遣先責任者" value={`${c.hakensakiManagerName}（${c.hakensakiManagerRole ?? ""}）`} />
                    )}
                    {c.hakensakiManagerPhone && <Row label="電話" value={c.hakensakiManagerPhone} />}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Dialog>

      {/* Confirm delete */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="企業年度設定を削除"
        description={`${deleteTarget?.fiscalYear}年度の設定を削除します。この操作は元に戻せません。`}
        onConfirm={() => {
          if (deleteTarget) {
            deleteConfig.mutate(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="whitespace-pre-wrap break-words">{value}</span>
    </div>
  );
}
