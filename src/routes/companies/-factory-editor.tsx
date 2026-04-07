// FactoryEditor — delegates to FactoryDrawer for full wizard-based editing
// Kept as a lightweight alias for the import tab (which only needs basic create/edit)
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateFactory, useUpdateFactory } from "@/lib/hooks/use-factories";
import type { FactoryUpdate } from "@/lib/api-types";

interface Props {
  open: boolean;
  onClose: () => void;
  factoryId: number | null;
  companyId: number;
}

export function FactoryEditor({ open, onClose, factoryId, companyId }: Props) {
  const create = useCreateFactory();
  const update = useUpdateFactory();
  const [form, setForm] = useState({
    factoryName: "",
    department: "",
    lineName: "",
    address: "",
    phone: "",
    hourlyRate: "",
    workHours: "",
    supervisorName: "",
    supervisorPhone: "",
    closingDayText: "",
    paymentDayText: "",
    conflictDate: "",
  });

  const isEditing = !!factoryId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      factoryName: form.factoryName,
      department: form.department || null,
      lineName: form.lineName || null,
      address: form.address || null,
      phone: form.phone || null,
      hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : null,
      workHours: form.workHours || null,
      supervisorName: form.supervisorName || null,
      supervisorPhone: form.supervisorPhone || null,
      closingDayText: form.closingDayText || null,
      paymentDayText: form.paymentDayText || null,
      conflictDate: form.conflictDate || null,
    };
    try {
      if (isEditing && factoryId) {
        await update.mutateAsync({ id: factoryId, data: payload as Partial<FactoryUpdate> });
      } else {
        await create.mutateAsync({ ...payload, companyId });
      }
      onClose();
    } catch {
      // error handled by mutation hook
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-4">{isEditing ? "工場編集" : "工場作成"}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-sm font-medium">工場名 *</label>
            <Input
              value={form.factoryName}
              onChange={(e) => setForm((f) => ({ ...f, factoryName: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">部署</label>
              <Input value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">ライン</label>
              <Input value={form.lineName} onChange={(e) => setForm((f) => ({ ...f, lineName: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">住所</label>
            <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium">時給</label>
            <Input type="number" value={form.hourlyRate} onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium">就業時間</label>
            <Input value={form.workHours} onChange={(e) => setForm((f) => ({ ...f, workHours: e.target.value }))} placeholder="08:00~17:00" />
          </div>
          <div>
            <label className="text-sm font-medium">指揮命令者氏名</label>
            <Input value={form.supervisorName} onChange={(e) => setForm((f) => ({ ...f, supervisorName: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm font-medium">指揮命令者電話</label>
            <Input value={form.supervisorPhone} onChange={(e) => setForm((f) => ({ ...f, supervisorPhone: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>キャンセル</Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {isEditing ? "更新" : "作成"}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
