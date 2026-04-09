import { useEffect, useState } from "react";
import { Dialog, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateCompany } from "@/lib/hooks/use-companies";
import type { Company } from "@/lib/api-types";

interface Props {
  company: Company | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompanyEditDialog({ company, open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [nameKana, setNameKana] = useState("");
  const [conflictDate, setConflictDate] = useState("");
  const [contractPeriod, setContractPeriod] = useState<string>("");

  const updateCompany = useUpdateCompany();

  useEffect(() => {
    if (company) {
      setName(company.name ?? "");
      setNameKana(company.nameKana ?? "");
      setConflictDate(company.conflictDate ?? "");
      setContractPeriod(company.contractPeriod ? String(company.contractPeriod) : "");
    }
  }, [company]);

  const handleSave = async () => {
    if (!company) return;
    try {
      await updateCompany.mutateAsync({
        id: company.id,
        data: {
          name: name || undefined,
          nameKana: nameKana || null,
          conflictDate: conflictDate || null,
          contractPeriod: contractPeriod ? Number(contractPeriod) : null,
        },
      });
      onOpenChange(false);
    } catch {
      // error handled by mutation hook (onMutationError toast)
    }
  };

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)}>
      <DialogHeader>
        <DialogTitle>企業情報を編集</DialogTitle>
        <DialogClose onClose={() => onOpenChange(false)} />
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-1">
          <label className="text-sm font-medium">企業名</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">企業名（カナ）</label>
          <Input
            value={nameKana}
            onChange={(e) => setNameKana(e.target.value)}
            placeholder="カナ名（任意）"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">抵触日（会社）</label>
          <Input
            type="date"
            value={conflictDate}
            onChange={(e) => setConflictDate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            途中入社契約のデフォルト抵触日。各工場で個別設定可能。
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">契約期間（ヶ月）</label>
          <Input
            type="number"
            min={1}
            max={60}
            value={contractPeriod}
            onChange={(e) => setContractPeriod(e.target.value)}
            placeholder="12"
          />
          <p className="text-xs text-muted-foreground">
            抵触日から遡って何ヶ月分を検索対象とするか（例: 12）
          </p>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          キャンセル
        </Button>
        <Button onClick={handleSave} disabled={updateCompany.isPending}>
          {updateCompany.isPending ? "保存中..." : "保存"}
        </Button>
      </div>
    </Dialog>
  );
}
