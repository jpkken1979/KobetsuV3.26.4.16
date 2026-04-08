/**
 * Employee Form — Dialog for bulk edit operations.
 * Extracted from -employee-manager.tsx for maintainability.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import type { Company } from "@/lib/api";

/* ── Bulk edit dialog props ─────────────────────────────────────────── */
export interface BulkEditDialogProps {
  selectedCount: number;
  companies: Company[];
  onClose: () => void;
  onConfirm: (status: string | null, factoryId: number | null) => void;
}

/* ── Bulk edit dialog component ────────────────────────────────────── */
export function BulkEditDialog({
  selectedCount,
  companies,
  onClose,
  onConfirm,
}: BulkEditDialogProps) {
  const [newStatus, setNewStatus] = useState<string>("");
  const [newFactoryId, setNewFactoryId] = useState<string>("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const status = newStatus || null;
    const factoryId = newFactoryId ? Number(newFactoryId) : null;
    onConfirm(status, factoryId);
    onClose();
  }

  return (
    <Dialog open onClose={onClose} className="max-w-md">
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <div className="flex-1">
            <DialogTitle>一括編集 — {selectedCount}件</DialogTitle>
          </div>
          <DialogClose onClose={onClose} />
        </DialogHeader>

        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bulk-status" className="text-sm font-medium">
              状態を変更
            </label>
            <Select
              id="bulk-status"
              className="w-full"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
            >
              <option value="">変更しない</option>
              <option value="active">有効</option>
              <option value="inactive">無効</option>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="bulk-factory" className="text-sm font-medium">
              配属先を変更
            </label>
            <Select
              id="bulk-factory"
              className="w-full"
              value={newFactoryId}
              onChange={(e) => setNewFactoryId(e.target.value)}
            >
              <option value="">変更しない</option>
              {companies.map((c) => (
                <optgroup key={c.id} label={c.name}>
                  {c.factories?.map((f) => (
                    <option key={f.id} value={String(f.id)}>
                      {f.factoryName}
                      {f.department ? ` / ${f.department}` : ""}
                      {f.lineName ? ` / ${f.lineName}` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" variant="default">
            一括更新
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
