import { useState } from "react";
import { CalendarDays, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useFactoryYearlyConfigs,
  useCreateFactoryYearlyConfig,
  useUpdateFactoryYearlyConfig,
  useDeleteFactoryYearlyConfig,
  useCopyFactoryYearlyConfig,
} from "@/lib/hooks/use-factory-yearly-config";
import { useFactories } from "@/lib/hooks/use-factories";
import type { FactoryYearlyConfig, FactoryYearlyConfigCreate } from "@/lib/api-types";

// Determina el año fiscal desde la fecha de inicio (misma lógica que el servidor)
function getFiscalYear(date: Date): number {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month >= 10 ? year : year - 1;
}

const CURRENT_FISCAL_YEAR = getFiscalYear(new Date());

interface FormState {
  fiscalYear: number;
  sagyobiText: string;
  kyujitsuText: string;
  kyuukashori: string;
  supervisorName: string;
  supervisorDept: string;
  supervisorRole: string;
  supervisorPhone: string;
  hakensakiManagerName: string;
  hakensakiManagerDept: string;
  hakensakiManagerRole: string;
  hakensakiManagerPhone: string;
}

const EMPTY_FORM: FormState = {
  fiscalYear: CURRENT_FISCAL_YEAR,
  sagyobiText: "",
  kyujitsuText: "",
  kyuukashori: "",
  supervisorName: "",
  supervisorDept: "",
  supervisorRole: "",
  supervisorPhone: "",
  hakensakiManagerName: "",
  hakensakiManagerDept: "",
  hakensakiManagerRole: "",
  hakensakiManagerPhone: "",
};

function configToForm(c: FactoryYearlyConfig): FormState {
  return {
    fiscalYear: c.fiscalYear,
    sagyobiText: c.sagyobiText ?? "",
    kyujitsuText: c.kyujitsuText ?? "",
    kyuukashori: c.kyuukashori ?? "",
    supervisorName: c.supervisorName ?? "",
    supervisorDept: c.supervisorDept ?? "",
    supervisorRole: c.supervisorRole ?? "",
    supervisorPhone: c.supervisorPhone ?? "",
    hakensakiManagerName: c.hakensakiManagerName ?? "",
    hakensakiManagerDept: c.hakensakiManagerDept ?? "",
    hakensakiManagerRole: c.hakensakiManagerRole ?? "",
    hakensakiManagerPhone: c.hakensakiManagerPhone ?? "",
  };
}

function formToNullable(f: FormState) {
  const n = (v: string) => (v.trim() === "" ? null : v.trim());
  return {
    sagyobiText: n(f.sagyobiText),
    kyujitsuText: n(f.kyujitsuText),
    kyuukashori: n(f.kyuukashori),
    supervisorName: n(f.supervisorName),
    supervisorDept: n(f.supervisorDept),
    supervisorRole: n(f.supervisorRole),
    supervisorPhone: n(f.supervisorPhone),
    hakensakiManagerName: n(f.hakensakiManagerName),
    hakensakiManagerDept: n(f.hakensakiManagerDept),
    hakensakiManagerRole: n(f.hakensakiManagerRole),
    hakensakiManagerPhone: n(f.hakensakiManagerPhone),
  };
}

// ─── Inner form ─────────────────────────────────────────────────────

function YearlyConfigForm({
  factoryId,
  editingConfig,
  onClose,
}: {
  factoryId: number;
  editingConfig: FactoryYearlyConfig | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(
    editingConfig ? configToForm(editingConfig) : EMPTY_FORM
  );
  const create = useCreateFactoryYearlyConfig();
  const update = useUpdateFactoryYearlyConfig(factoryId);

  const set = (k: keyof FormState, v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    if (editingConfig) {
      update.mutate({ id: editingConfig.id, data: formToNullable(form) }, { onSuccess: onClose });
    } else {
      const payload: FactoryYearlyConfigCreate = { factoryId, fiscalYear: form.fiscalYear, ...formToNullable(form) };
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

      {/* 就業日 */}
      <div className="border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">就業条件</p>
        {textarea("就業日テキスト", "sagyobiText", 3)}
        {textarea("休日テキスト", "kyujitsuText", 2)}
        {textarea("休暇処理", "kyuukashori", 2)}
      </div>

      {/* 指揮命令者 */}
      <div className="border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">指揮命令者</p>
        {field("氏名", "supervisorName")}
        {field("部署", "supervisorDept")}
        {field("役職", "supervisorRole", "工長、班長…")}
        {field("電話", "supervisorPhone")}
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

export function FactoryYearlyConfigDialog({
  factoryId,
  companyId,
  factoryLabel,
  open,
  onClose,
}: {
  factoryId: number;
  companyId: number;
  factoryLabel: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data: configs, isLoading } = useFactoryYearlyConfigs(open ? factoryId : null);
  const deleteConfig = useDeleteFactoryYearlyConfig(factoryId);
  const copyMutation = useCopyFactoryYearlyConfig();
  const { data: allFactories } = useFactories();

  const [formMode, setFormMode] = useState<"new" | FactoryYearlyConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FactoryYearlyConfig | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copyingConfig, setCopyingConfig] = useState<FactoryYearlyConfig | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<number[]>([]);

  // Fábricas de la misma empresa, excluyendo la actual
  const siblingFactories = (allFactories ?? []).filter(
    (f) => f.companyId === companyId && f.id !== factoryId
  );

  const handleClose = () => {
    setFormMode(null);
    setCopyingConfig(null);
    setSelectedTargets([]);
    onClose();
  };

  const handleCopyClick = (e: React.MouseEvent, c: FactoryYearlyConfig) => {
    e.stopPropagation();
    if (copyingConfig?.id === c.id) {
      setCopyingConfig(null);
      setSelectedTargets([]);
    } else {
      setCopyingConfig(c);
      setSelectedTargets([]);
    }
  };

  const handleTargetToggle = (id: number, checked: boolean) => {
    setSelectedTargets((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    );
  };

  const handleCopyExecute = (c: FactoryYearlyConfig) => {
    copyMutation.mutate(
      { sourceFactoryId: factoryId, fiscalYear: c.fiscalYear, targetFactoryIds: selectedTargets },
      {
        onSuccess: () => {
          setCopyingConfig(null);
          setSelectedTargets([]);
        },
      }
    );
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="size-4" />
              年度別設定 — {factoryLabel}
            </DialogTitle>
          </DialogHeader>

          {/* Form for new / edit */}
          {formMode !== null && (
            <div className="rounded-lg border bg-muted/30 p-4 mb-2">
              <p className="text-sm font-medium mb-3">
                {formMode === "new" ? "新しい年度設定を追加" : `${(formMode as FactoryYearlyConfig).fiscalYear}年度を編集`}
              </p>
              <YearlyConfigForm
                factoryId={factoryId}
                editingConfig={formMode === "new" ? null : (formMode as FactoryYearlyConfig)}
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
                      <span className="font-medium text-sm">
                        {c.fiscalYear}年度
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {c.fiscalYear}/10/01 〜 {c.fiscalYear + 1}/09/30
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {siblingFactories.length > 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          title="他のラインにコピー"
                          onClick={(e) => handleCopyClick(e, c)}
                        >
                          <Copy className="size-3" />
                        </Button>
                      )}
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

                  {/* Copy panel */}
                  {copyingConfig?.id === c.id && (
                    <div className="px-4 pb-3 border-t bg-muted/20">
                      <p className="text-xs font-medium text-muted-foreground py-2">コピー先ラインを選択:</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {siblingFactories.map((f) => (
                          <label
                            key={f.id}
                            className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/40 px-2 py-1 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={selectedTargets.includes(f.id)}
                              onChange={(e) => handleTargetToggle(f.id, e.target.checked)}
                            />
                            {f.department ?? "—"} / {f.lineName ?? "—"}
                          </label>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setCopyingConfig(null); setSelectedTargets([]); }}
                        >
                          キャンセル
                        </Button>
                        <Button
                          size="sm"
                          disabled={selectedTargets.length === 0 || copyMutation.isPending}
                          onClick={() => handleCopyExecute(c)}
                        >
                          {copyMutation.isPending ? "コピー中…" : `${selectedTargets.length}件にコピー`}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Expanded detail */}
                  {expandedId === c.id && (
                    <div className="px-4 pb-3 border-t grid grid-cols-2 gap-x-6 gap-y-1 text-xs pt-2">
                      {c.sagyobiText && <Row label="就業日" value={c.sagyobiText} />}
                      {c.kyujitsuText && <Row label="休日" value={c.kyujitsuText} />}
                      {c.kyuukashori && <Row label="休暇処理" value={c.kyuukashori} />}
                      {c.supervisorName && <Row label="指揮命令者" value={`${c.supervisorName}（${c.supervisorRole ?? ""}）`} />}
                      {c.hakensakiManagerName && <Row label="派遣先責任者" value={`${c.hakensakiManagerName}（${c.hakensakiManagerRole ?? ""}）`} />}
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
        title="年度設定を削除"
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
