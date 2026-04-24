import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Contract, Employee, Factory } from "@/lib/api-types";
import { Dialog, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";

interface Props {
  contract: Contract;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditContractDialog({ contract, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("employee");

  // Employee fields
  const [fullName, setFullName] = useState("");
  const [katakanaName, setKatakanaName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nationality, setNationality] = useState("");

  // Factory fields
  const [department, setDepartment] = useState("");
  const [lineName, setLineName] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [supervisorPhone, setSupervisorPhone] = useState("");
  const [address, setAddress] = useState("");

  // Mutations
  const [employeePending, setEmployeePending] = useState(false);
  const [factoryPending, setFactoryPending] = useState(false);

  // Get first employee from contract
  const employee = contract.employees?.[0] && "fullName" in contract.employees[0]
    ? (contract.employees[0] as Employee)
    : null;

  const factory = contract.factory as Factory | undefined;

  useEffect(() => {
    if (employee) {
      setFullName(employee.fullName ?? "");
      setKatakanaName(employee.katakanaName ?? "");
      setBirthDate(employee.birthDate ?? "");
      setNationality(employee.nationality ?? "");
    }
    if (factory) {
      setDepartment(factory.department ?? "");
      setLineName(factory.lineName ?? "");
      setSupervisorName(factory.supervisorName ?? "");
      setSupervisorPhone(factory.supervisorPhone ?? "");
      setAddress(factory.address ?? "");
    }
  }, [employee, factory, open]);

  const handleSaveEmployee = async () => {
    if (!employee) return false;
    setEmployeePending(true);
    try {
      await api.updateEmployee(employee.id, {
        fullName: fullName || undefined,
        katakanaName: katakanaName || null,
        birthDate: birthDate || null,
        nationality: nationality || null,
      });
      toast.success("社員情報を更新しました");
      return true;
    } catch {
      // error handled by api
      return false;
    } finally {
      setEmployeePending(false);
    }
  };

  const handleSaveFactory = async () => {
    if (!factory) return false;
    setFactoryPending(true);
    try {
      await api.updateFactory(factory.id, {
        department: department || null,
        lineName: lineName || null,
        supervisorName: supervisorName || null,
        supervisorPhone: supervisorPhone || null,
        address: address || null,
      });
      toast.success("派遣先情報を更新しました");
      return true;
    } catch {
      // error handled by api
      return false;
    } finally {
      setFactoryPending(false);
    }
  };

  const handleSave = async () => {
    const saved =
      activeTab === "employee"
        ? await handleSaveEmployee()
        : await handleSaveFactory();

    if (!saved) return;

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.detail(contract.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.contracts.invalidateAll }),
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.invalidateAll }),
      queryClient.invalidateQueries({ queryKey: queryKeys.factories.invalidateAll }),
      queryClient.invalidateQueries({ queryKey: queryKeys.companies.invalidateAll }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dataCheck.invalidateAll }),
    ]);
  };

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} className="max-w-md">
      <DialogHeader>
        <DialogTitle>契約を編集</DialogTitle>
        <DialogClose onClose={() => onOpenChange(false)} />
      </DialogHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="employee">社員</TabsTrigger>
          <TabsTrigger value="factory">派遣先</TabsTrigger>
        </TabsList>

        <TabsContent value="employee">
          <div className="space-y-4 py-3">
            <div className="space-y-1">
              <label htmlFor="ec-fullname" className="text-sm font-medium">氏名</label>
              <Input
                id="ec-fullname"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={employeePending}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="ec-katakana" className="text-sm font-medium">カタカナ名</label>
              <Input
                id="ec-katakana"
                value={katakanaName}
                onChange={(e) => setKatakanaName(e.target.value)}
                disabled={employeePending}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="ec-birth" className="text-sm font-medium">生年月日</label>
              <Input
                id="ec-birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                disabled={employeePending}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="ec-nationality" className="text-sm font-medium">国籍</label>
              <Input
                id="ec-nationality"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                disabled={employeePending}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="factory">
          <div className="space-y-4 py-3">
            <div className="space-y-1">
              <label htmlFor="ec-dept" className="text-sm font-medium">部署</label>
              <Input
                id="ec-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={factoryPending}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="ec-line" className="text-sm font-medium">ライン</label>
              <Input
                id="ec-line"
                value={lineName}
                onChange={(e) => setLineName(e.target.value)}
                disabled={factoryPending}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="ec-supname" className="text-sm font-medium">指揮命令者</label>
              <Input
                id="ec-supname"
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                disabled={factoryPending}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="ec-supphone" className="text-sm font-medium">電話番号</label>
              <Input
                id="ec-supphone"
                value={supervisorPhone}
                onChange={(e) => setSupervisorPhone(e.target.value)}
                disabled={factoryPending}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="ec-address" className="text-sm font-medium">住所</label>
              <Input
                id="ec-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={factoryPending}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          キャンセル
        </Button>
        <Button
          onClick={handleSave}
          disabled={employeePending || factoryPending}
        >
          {employeePending || factoryPending ? "保存中..." : "保存"}
        </Button>
      </div>
    </Dialog>
  );
}
