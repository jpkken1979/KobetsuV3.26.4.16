import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Factory as FactoryIcon,
  FileDown,
  FileText,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";

import { AnimatedPage } from "@/components/ui/animated";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { api, downloadZip, type Contract, type Employee, type EmployeeCreate, type Factory } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useCompanies } from "@/lib/hooks/use-companies";
import { useFactoryCascade } from "@/lib/hooks/use-factories";
import { calculateContractDates, calculateDefaultEndDate } from "@/lib/contract-dates";

export const Route = createFileRoute("/shouheisha")({
  component: ShouheishaPage,
  errorComponent: ({ reset }) => (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <p className="text-lg font-semibold text-destructive">エラーが発生しました</p>
      <Button variant="outline" onClick={reset}>再試行</Button>
    </div>
  ),
});

type GeneratedArtifact = {
  label: string;
  filename: string;
  path: string;
};

type GenerationResult = {
  employees: Employee[];
  contract: Contract | null;
  mode: "bundle" | "laborOnly";
  artifacts: GeneratedArtifact[];
  zipFilename: string | null;
  warnings: string[];
};

type RecruitForm = {
  id: string;
  employeeNumber: string;
  fullName: string;
  katakanaName: string;
  nationality: string;
  gender: string;
  birthDate: string;
  hireDate: string;
  actualHireDate: string;
  postalCode: string;
  address: string;
  visaExpiry: string;
  visaType: string;
};

function emptyRecruit(): RecruitForm {
  const id =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `r-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
  return {
    id,
    employeeNumber: "",
    fullName: "",
    katakanaName: "",
    nationality: "",
    gender: "",
    birthDate: "",
    hireDate: "",
    actualHireDate: "",
    postalCode: "",
    address: "",
    visaExpiry: "",
    visaType: "",
  };
}

function fieldClassName() {
  return "mt-1.5";
}

function pillClassName(active: boolean) {
  return cn(
    "w-full rounded-lg px-3 py-2 text-left text-sm transition-all",
    active ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted/60"
  );
}

function labelFromFilename(filename: string) {
  if (filename.includes("個別契約書")) return "個別契約書";
  if (filename.includes("通知書")) return "通知書";
  if (filename.includes("派遣先管理台帳")) return "派遣先管理台帳";
  if (filename.includes("派遣元管理台帳")) return "派遣元管理台帳";
  if (filename.includes("契約書類一式")) return "契約書類一式";
  if (filename.includes("労働契約書")) return "労働契約書";
  if (filename.includes("就業条件明示書")) return "就業条件明示書";
  return "PDF";
}

function normalizeNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function textOrNull(value: string) {
  return value.trim() ? value.trim() : null;
}

function ShouheishaPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: companies = [] } = useCompanies();

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [factoryName, setFactoryName] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [lineId, setLineId] = useState<number | null>(null);
  const [recruits, setRecruits] = useState<RecruitForm[]>(() => [emptyRecruit()]);
  const [hourlyRate, setHourlyRate] = useState("");
  const [billingRate, setBillingRate] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [shiftPattern, setShiftPattern] = useState("");
  const [workHours, setWorkHours] = useState("");
  const [workDays, setWorkDays] = useState("");
  const [workStartTime, setWorkStartTime] = useState("");
  const [workEndTime, setWorkEndTime] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("");
  const [supervisorDept, setSupervisorDept] = useState("");
  const [supervisorName, setSupervisorName] = useState("");
  const [supervisorPhone, setSupervisorPhone] = useState("");
  const [complaintHandlerClient, setComplaintHandlerClient] = useState("");
  const [complaintHandlerUns, setComplaintHandlerUns] = useState("");
  const [hakenmotoManager, setHakenmotoManager] = useState("");
  const [safetyMeasures, setSafetyMeasures] = useState("");
  const [terminationMeasures, setTerminationMeasures] = useState("");
  const [responsibilityLevel, setResponsibilityLevel] = useState("");
  const [overtimeMax, setOvertimeMax] = useState("");
  const [welfare, setWelfare] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [contractDateOverride, setContractDateOverride] = useState("");
  const [includeShugyojoken, setIncludeShugyojoken] = useState(true);
  const [autoFillEnabled, setAutoFillEnabled] = useState(true);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);

  const { data: cascade, isLoading: cascadeLoading } = useFactoryCascade(companyId ?? 0);

  const factoryOptions = useMemo(() => Object.keys(cascade?.grouped ?? {}), [cascade]);
  const departmentOptions = useMemo(() => {
    if (!cascade?.grouped || !factoryName) return [];
    return Object.keys(cascade.grouped[factoryName] ?? {});
  }, [cascade, factoryName]);
  const lineOptions = useMemo(() => {
    if (!cascade?.grouped || !factoryName || !departmentName) return [];
    return cascade.grouped[factoryName]?.[departmentName] ?? [];
  }, [cascade, factoryName, departmentName]);
  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === companyId) ?? null,
    [companies, companyId]
  );
  const selectedFactory = useMemo(
    () => cascade?.flat.find((factory) => factory.id === lineId) ?? null,
    [cascade, lineId]
  );
  const selectedFactoryLabel = selectedFactory
    ? [selectedFactory.factoryName, selectedFactory.department, selectedFactory.lineName].filter(Boolean).join(" / ")
    : "";
  const selectedFactoryAddress = selectedFactory?.address || selectedCompany?.address || "";
  const selectedFactoryPhone = selectedFactory?.phone || selectedCompany?.phone || "";

  useEffect(() => {
    if (selectedFactory) {
      applyFactoryDefaults(selectedFactory);
    }
  }, [selectedFactory?.id]);

  useEffect(() => {
    if (selectedFactory && autoFillEnabled) {
      applyScheduleDefaults(selectedFactory);
    }
  }, [selectedFactory?.id, autoFillEnabled]);

  const updateRecruit = (index: number, patch: Partial<RecruitForm>) => {
    setRecruits((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };
  const addRecruit = () => setRecruits((prev) => [...prev, emptyRecruit()]);
  const removeRecruit = (index: number) =>
    setRecruits((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));

  const applyFactoryDefaults = (factory: Factory) => {
    if (typeof factory.hourlyRate === "number" && !hourlyRate) {
      setHourlyRate(String(factory.hourlyRate));
    }
    if (typeof factory.hourlyRate === "number" && !billingRate) {
      setBillingRate(String(factory.hourlyRate));
    }
    setJobDescription(factory.jobDescription2 || factory.jobDescription || "");
    setShiftPattern(factory.shiftPattern || "");
    setWorkHours(factory.workHours || "");
    setWorkDays(factory.workDays || "");
    setSupervisorDept(factory.supervisorDept || "");
    setSupervisorName(factory.supervisorName || "");
    setSupervisorPhone(factory.supervisorPhone || "");
    setComplaintHandlerClient(
      [factory.complaintClientDept, factory.complaintClientName, factory.complaintClientPhone]
        .filter(Boolean)
        .join(" / ")
    );
    setComplaintHandlerUns(
      [factory.complaintUnsDept, factory.complaintUnsName, factory.complaintUnsPhone]
        .filter(Boolean)
        .join(" / ")
    );
    setHakenmotoManager(
      [factory.managerUnsDept, factory.managerUnsName, factory.managerUnsPhone]
        .filter(Boolean)
        .join(" / ")
    );
    setSafetyMeasures(factory.calendar || "");
    setTerminationMeasures(factory.agreementPeriodEnd || "");
    setResponsibilityLevel(factory.supervisorRole || factory.hakensakiManagerRole || "");
    setOvertimeMax(factory.overtimeHours || "");
    setWelfare(factory.workerCalendar || "");
  };

  const applyScheduleDefaults = (factory: Factory) => {
    setWorkStartTime(factory.workHoursDay || "");
    setWorkEndTime(factory.workHoursNight || "");
    setBreakMinutes(factory.breakTime !== null && factory.breakTime !== undefined ? String(factory.breakTime) : "");
  };

  const upsertEmployees = async (): Promise<Employee[]> => {
    if (!companyId || !lineId) {
      throw new Error("会社と配属先を選んでください");
    }

    const baseFallback = `SHO${(startDate || new Date().toISOString().slice(0, 10)).replaceAll("-", "").slice(2)}`;
    const output: Employee[] = [];
    const usedInBatch = new Set<string>();

    for (let i = 0; i < recruits.length; i++) {
      const recruit = recruits[i];
      const trimmedFullName = recruit.fullName.trim();
      const trimmedKatakana = recruit.katakanaName.trim();
      const effectiveFullName = trimmedFullName || trimmedKatakana;
      if (!effectiveFullName) {
        throw new Error(`招聘者 #${i + 1}: 氏名またはカタカナのどちらかを入力してください`);
      }

      const trimmedEmployeeNumber = recruit.employeeNumber.trim();
      let effectiveEmployeeNumber = trimmedEmployeeNumber || baseFallback;

      if (!trimmedEmployeeNumber) {
        const candidates = await api.getEmployees({ search: baseFallback });
        const sameDayMatches = candidates.filter(
          (c) => c.employeeNumber === baseFallback || c.employeeNumber.startsWith(`${baseFallback}-`)
        );
        const samePerson = sameDayMatches.find((c) => {
          if (trimmedKatakana && c.katakanaName === trimmedKatakana) return true;
          if (trimmedFullName && c.fullName === trimmedFullName) return true;
          return false;
        });
        if (samePerson) {
          effectiveEmployeeNumber = samePerson.employeeNumber;
        } else {
          const used = new Set([
            ...sameDayMatches.map((m) => m.employeeNumber),
            ...usedInBatch,
          ]);
          let index = 1;
          let candidate = baseFallback;
          while (used.has(candidate)) {
            index++;
            candidate = `${baseFallback}-${String(index).padStart(2, "0")}`;
          }
          effectiveEmployeeNumber = candidate;
        }
      }
      usedInBatch.add(effectiveEmployeeNumber);

      const matchedEmployees = await api.getEmployees({ search: effectiveEmployeeNumber });
      const existingEmployee = matchedEmployees.find(
        (employee) => employee.employeeNumber === effectiveEmployeeNumber
      ) ?? null;

      const effectiveHireDate = recruit.hireDate || startDate || undefined;
      const effectiveActualHireDate = recruit.actualHireDate || effectiveHireDate;
      const effectiveHourlyRate = normalizeNumber(hourlyRate);
      const effectiveBillingRate = normalizeNumber(billingRate) ?? effectiveHourlyRate;

      const employeePayload: EmployeeCreate = {
        employeeNumber: effectiveEmployeeNumber,
        fullName: effectiveFullName,
        status: "active",
        katakanaName: textOrNull(recruit.katakanaName),
        nationality: textOrNull(recruit.nationality),
        gender: recruit.gender || null,
        birthDate: recruit.birthDate || null,
        hireDate: effectiveHireDate ?? null,
        actualHireDate: effectiveActualHireDate ?? null,
        hourlyRate: effectiveHourlyRate,
        billingRate: effectiveBillingRate,
        visaExpiry: recruit.visaExpiry || null,
        visaType: textOrNull(recruit.visaType),
        postalCode: textOrNull(recruit.postalCode),
        address: textOrNull(recruit.address),
        companyId,
        factoryId: lineId,
      };

      const employee = existingEmployee
        ? await api.put<Employee>(`/employees/${existingEmployee.id}`, employeePayload)
        : await api.post<Employee>("/employees", employeePayload);
      output.push(employee);
    }

    return output;
  };

  const createContractForEmployees = async (employees: Employee[], mode: "bundle" | "laborOnly") => {
    if (!companyId || !lineId) {
      throw new Error("会社と配属先を選んでください");
    }
    if (!startDate || !endDate) {
      throw new Error("契約開始日と終了日を入力してください");
    }

    const contractDates = calculateContractDates(startDate);
    const effectiveContractDate = contractDateOverride || contractDates.contractDate;
    const effectiveNotificationDate = contractDateOverride || contractDates.notificationDate;
    const effectiveHourlyRate = normalizeNumber(hourlyRate);
    const effectiveBillingRate = normalizeNumber(billingRate) ?? effectiveHourlyRate;

    const contract = mode === "bundle"
      ? await api.createContract({
          companyId,
          factoryId: lineId,
          startDate,
          endDate,
          contractDate: effectiveContractDate,
          notificationDate: effectiveNotificationDate,
          status: "active",
          hourlyRate: effectiveHourlyRate,
          overtimeRate: null,
          nightShiftRate: null,
          holidayRate: null,
          workDays: textOrNull(workDays),
          workStartTime: textOrNull(workStartTime),
          workEndTime: textOrNull(workEndTime),
          breakMinutes: breakMinutes.trim() ? Number(breakMinutes) : null,
          supervisorName: textOrNull(supervisorName),
          supervisorDept: textOrNull(supervisorDept),
          supervisorPhone: textOrNull(supervisorPhone),
          complaintHandlerClient: textOrNull(complaintHandlerClient),
          complaintHandlerUns: textOrNull(complaintHandlerUns),
          hakenmotoManager: textOrNull(hakenmotoManager),
          safetyMeasures: textOrNull(safetyMeasures),
          terminationMeasures: textOrNull(terminationMeasures),
          jobDescription: textOrNull(jobDescription),
          responsibilityLevel: textOrNull(responsibilityLevel),
          overtimeMax: textOrNull(overtimeMax),
          welfare: textOrNull(welfare),
          previousContractId: null,
          notes: notes.trim() || null,
          employeeAssignments: employees.map((emp) => ({
            employeeId: emp.id,
            hourlyRate: effectiveHourlyRate ?? undefined,
            individualStartDate: startDate,
            individualEndDate: endDate,
            isIndefinite: false,
          })),
        })
      : null;

    return { contract, effectiveHourlyRate, effectiveBillingRate };
  };

  const buildZipPrefix = (employees: Employee[]) => {
    if (employees.length === 1) {
      return `招聘者_${employees[0].employeeNumber}`;
    }
    return `招聘者_${employees.length}名_${employees[0].employeeNumber}他`;
  };

  const bundleMutation = useMutation({
    mutationFn: async (): Promise<GenerationResult> => {
      const employees = await upsertEmployees();
      const { contract } = await createContractForEmployees(employees, "bundle");
      if (!contract) {
        throw new Error("契約の作成に失敗しました");
      }

      const artifacts: GeneratedArtifact[] = [];
      const warnings: string[] = [];

      const contractBundle = await api.generateContractDocuments(contract.id, {
        kobetsuCopies: 2,
        includeShugyojoken,
      });
      for (const file of contractBundle.files ?? []) {
        artifacts.push({
          label: labelFromFilename(file.filename),
          filename: file.filename,
          path: file.path,
        });
      }

      for (const employee of employees) {
        try {
          const keiyakusho = await api.generateKeiyakusho(employee.employeeNumber, { startDate, endDate });
          artifacts.push({
            label: employees.length === 1 ? "労働契約書" : `労働契約書 (${employee.fullName})`,
            filename: keiyakusho.filename,
            path: keiyakusho.path,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          warnings.push(`${employee.fullName}: 労働契約書の生成に失敗しました — ${msg}`);
        }
      }

      const zipFilename = `${buildZipPrefix(employees)}_${startDate.replaceAll("-", "")}.zip`;
      await downloadZip(artifacts.map((artifact) => artifact.filename), zipFilename);

      return { employees, contract, mode: "bundle", artifacts, zipFilename, warnings };
    },
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.employees.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.contracts.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.documents.all }),
      ]);
      setResult(data);
      const namesDesc =
        data.employees.length === 1
          ? data.employees[0].fullName
          : `${data.employees.length}名: ${data.employees.map((e) => e.fullName).join(", ")}`;
      toast.success("招聘者の書類一式を作成しました", {
        description: `${namesDesc} / 契約番号 ${data.contract?.contractNumber ?? "未発行"}`,
      });
      if (data.warnings.length > 0) {
        toast.warning("一部の書類は補助生成に失敗しました", { description: data.warnings[0] });
      }
    },
    onError: (error: Error) => {
      toast.error("書類生成に失敗しました", { description: error.message });
    },
  });

  const laborOnlyMutation = useMutation({
    mutationFn: async (): Promise<GenerationResult> => {
      const employees = await upsertEmployees();
      await createContractForEmployees(employees, "laborOnly");

      const artifacts: GeneratedArtifact[] = [];
      const warnings: string[] = [];

      for (const employee of employees) {
        try {
          const keiyakusho = await api.generateKeiyakusho(employee.employeeNumber, { startDate, endDate });
          artifacts.push({
            label: employees.length === 1 ? "労働契約書" : `労働契約書 (${employee.fullName})`,
            filename: keiyakusho.filename,
            path: keiyakusho.path,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          warnings.push(`${employee.fullName}: 労働契約書の生成に失敗しました — ${msg}`);
        }
      }

      const zipFilename = `${buildZipPrefix(employees)}_${startDate.replaceAll("-", "")}.zip`;
      await downloadZip(artifacts.map((artifact) => artifact.filename), zipFilename);
      return { employees, contract: null, mode: "laborOnly", artifacts, zipFilename, warnings };
    },
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.employees.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.documents.all }),
      ]);
      setResult(data);
      const namesDesc =
        data.employees.length === 1
          ? data.employees[0].fullName
          : `${data.employees.length}名`;
      toast.success("労働契約書を作成しました", { description: namesDesc });
    },
    onError: (error: Error) => {
      toast.error("労働契約書の作成に失敗しました", { description: error.message });
    },
  });

  const handleCompanyChange = (nextCompanyId: number) => {
    setCompanyId(nextCompanyId);
    setFactoryName("");
    setDepartmentName("");
    setLineId(null);
    setResult(null);
  };

  const handleFactoryChange = (name: string) => {
    setFactoryName(name);
    setDepartmentName("");
    setLineId(null);
    setResult(null);
  };

  const handleDepartmentChange = (name: string) => {
    setDepartmentName(name);
    setLineId(null);
    setResult(null);
  };

  const handleLineChange = (factory: Factory) => {
    setLineId(factory.id);
    applyFactoryDefaults(factory);
    setResult(null);
  };

  const applyDefaultEndDate = (nextStartDate: string) => {
    setStartDate(nextStartDate);
    if (!endDate && nextStartDate) {
      setEndDate(calculateDefaultEndDate(nextStartDate));
    }
  };

  const contractDates = startDate ? calculateContractDates(startDate) : null;
  const canGenerate =
    !!companyId &&
    !!lineId &&
    recruits.every((r) => r.fullName.trim() || r.katakanaName.trim()) &&
    !!startDate &&
    !!endDate;

  return (
    <AnimatedPage className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <PageHeader
          title="招聘者"
          tag="SHOUHEISHA"
          subtitle="外国人材の受け入れ用に、企業・工場・配属先を選び、必要書類を一括で作成します。工場マスタの担当者情報もそのまま反映し、社員台帳に未登録でも使えます。"
        />
      </div>

      <Card className="border-border/60 bg-gradient-to-br from-card to-muted/20 p-4 shadow-[var(--shadow-card)]">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            "1. 会社と工場を選ぶ",
            "2. 招聘者の情報を入力",
            "3. 価格と期間を設定",
            "4. ボタンで一括生成",
          ].map((step, index) => (
            <div key={step} className="rounded-xl border border-border/60 bg-background/70 px-4 py-3">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary/70">
                STEP {index + 1}
              </div>
              <div className="text-sm font-medium">{step}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">派遣先の選択</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                企業 → 工場 → 配属先 → ラインの順で選びます。
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  企業
                </div>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
                  {companies.map((company) => (
                    <button
                      key={company.id}
                      onClick={() => handleCompanyChange(company.id)}
                      className={pillClassName(company.id === companyId)}
                    >
                      {company.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <FactoryIcon className="h-3.5 w-3.5" />
                  工場
                </div>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
                  {cascadeLoading && (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      読み込み中...
                    </div>
                  )}
                  {!cascadeLoading && factoryOptions.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">企業を選んでください</div>
                  )}
                  {factoryOptions.map((name) => (
                    <button
                      key={name}
                      onClick={() => handleFactoryChange(name)}
                      className={pillClassName(name === factoryName)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  配属先
                </div>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
                  {departmentOptions.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">工場を選んでください</div>
                  )}
                  {departmentOptions.map((name) => (
                    <button
                      key={name}
                      onClick={() => handleDepartmentChange(name)}
                      className={pillClassName(name === departmentName)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  ライン
                </div>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
                  {lineOptions.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">配属先を選んでください</div>
                  )}
                  {lineOptions.map((factory) => (
                    <button
                      key={factory.id}
                      onClick={() => handleLineChange(factory)}
                      className={pillClassName(factory.id === lineId)}
                    >
                      {factory.lineName || "ライン未設定"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {(selectedCompany || selectedFactoryLabel) && (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-muted/30 px-3 py-3 text-sm">
                {selectedCompany && (
                  <span className="rounded-md bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
                    {selectedCompany.name}
                  </span>
                )}
                {selectedFactoryLabel && (
                  <>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                    <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {selectedFactoryLabel}
                    </span>
                  </>
                )}
              </div>
            )}

            {selectedFactory && (
              <div className="mt-4 rounded-xl border border-border/60 bg-background/70 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  工場サマリー
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg bg-muted/20 px-3 py-2">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">住所 / 連絡先</div>
                    <div className="mt-1 text-sm text-foreground">{selectedFactoryAddress || "未設定"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{selectedFactoryPhone || "電話未設定"}</div>
                  </div>
                  <div className="rounded-lg bg-muted/20 px-3 py-2">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">業務メモ</div>
                    <div className="mt-1 text-sm text-foreground">
                      {selectedFactory.jobDescription || selectedFactory.jobDescription2 || "未設定"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/20 px-3 py-2">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">時給 / シフト</div>
                    <div className="mt-1 text-sm text-foreground">
                      {selectedFactory.hourlyRate ? `${selectedFactory.hourlyRate} 円` : "単価未設定"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {selectedFactory.shiftPattern || "シフト未設定"}
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted/20 px-3 py-2">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">責任者</div>
                    <div className="mt-1 text-sm text-foreground">{selectedFactory.supervisorName || "未設定"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{selectedFactory.supervisorDept || "部署未設定"}</div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">招聘者の情報</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  ここに入れるデータを、そのまま個別契約書・台帳・労働契約書に流します。複数人を同じ工場・ラインに一括で登録できます。
                </p>
              </div>
              <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {recruits.length}名
              </span>
            </div>

            <div className="space-y-4">
              {recruits.map((recruit, index) => (
                <div
                  key={recruit.id}
                  className="rounded-xl border border-border/60 bg-background/40 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">
                        招聘者 #{index + 1}
                      </span>
                      {recruit.fullName.trim() || recruit.katakanaName.trim() ? (
                        <span className="text-sm text-muted-foreground">
                          {recruit.fullName.trim() || recruit.katakanaName.trim()}
                        </span>
                      ) : (
                        <span className="text-xs italic text-muted-foreground/60">未入力</span>
                      )}
                    </div>
                    {recruits.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRecruit(index)}
                        className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        削除
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">社員番号</label>
                      <Input
                        className={fieldClassName()}
                        value={recruit.employeeNumber}
                        onChange={(e) => updateRecruit(index, { employeeNumber: e.target.value })}
                        placeholder="空欄なら SHO<YYMMDD> を自動付番"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">氏名</label>
                      <Input
                        className={fieldClassName()}
                        value={recruit.fullName}
                        onChange={(e) => updateRecruit(index, { fullName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">カタカナ</label>
                      <Input
                        className={fieldClassName()}
                        value={recruit.katakanaName}
                        onChange={(e) => updateRecruit(index, { katakanaName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">国籍</label>
                      <Input
                        className={fieldClassName()}
                        value={recruit.nationality}
                        onChange={(e) => updateRecruit(index, { nationality: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">性別</label>
                      <Select
                        className={fieldClassName()}
                        value={recruit.gender}
                        onChange={(e) => updateRecruit(index, { gender: e.target.value })}
                      >
                        <option value="">未設定</option>
                        <option value="male">男性</option>
                        <option value="female">女性</option>
                        <option value="other">その他</option>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">生年月日</label>
                      <Input
                        className={fieldClassName()}
                        type="date"
                        value={recruit.birthDate}
                        onChange={(e) => updateRecruit(index, { birthDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">入社日</label>
                      <Input
                        className={fieldClassName()}
                        type="date"
                        value={recruit.hireDate}
                        onChange={(e) => updateRecruit(index, { hireDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">実入社日</label>
                      <Input
                        className={fieldClassName()}
                        type="date"
                        value={recruit.actualHireDate}
                        onChange={(e) => updateRecruit(index, { actualHireDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">郵便番号</label>
                      <Input
                        className={fieldClassName()}
                        value={recruit.postalCode}
                        onChange={(e) => updateRecruit(index, { postalCode: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">住所</label>
                      <Input
                        className={fieldClassName()}
                        value={recruit.address}
                        onChange={(e) => updateRecruit(index, { address: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">在留期限</label>
                      <Input
                        className={fieldClassName()}
                        type="date"
                        value={recruit.visaExpiry}
                        onChange={(e) => updateRecruit(index, { visaExpiry: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">在留資格</label>
                      <Input
                        className={fieldClassName()}
                        value={recruit.visaType}
                        onChange={(e) => updateRecruit(index, { visaType: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={addRecruit}
              className="mt-4 w-full border-dashed"
            >
              <Plus className="mr-2 h-4 w-4" />
              招聘者を追加
            </Button>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">工場の既定値</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  選択中の工場マスタから、台帳にまだいない担当者情報も含めて契約欄へ反映します。ここは必要なら手で上書きできます。
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={autoFillEnabled} onCheckedChange={setAutoFillEnabled} />
                  <span className="text-muted-foreground">自動反映</span>
                </label>
                <Button type="button" variant="outline" onClick={() => selectedFactory && applyFactoryDefaults(selectedFactory)}>
                  工場情報を反映
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">業務内容</label>
                <Textarea className={fieldClassName()} rows={3} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">シフトパターン</label>
                <Input className={fieldClassName()} value={shiftPattern} onChange={(e) => setShiftPattern(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">勤務時間</label>
                <Input className={fieldClassName()} value={workHours} onChange={(e) => setWorkHours(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">勤務日</label>
                <Input className={fieldClassName()} value={workDays} onChange={(e) => setWorkDays(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">開始時刻</label>
                <Input className={fieldClassName()} value={workStartTime} onChange={(e) => setWorkStartTime(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">終了時刻</label>
                <Input className={fieldClassName()} value={workEndTime} onChange={(e) => setWorkEndTime(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">休憩分</label>
                <Input className={fieldClassName()} inputMode="numeric" value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">責任区分</label>
                <Input className={fieldClassName()} value={responsibilityLevel} onChange={(e) => setResponsibilityLevel(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">指揮命令者</label>
                <Input className={fieldClassName()} value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">所属部署</label>
                <Input className={fieldClassName()} value={supervisorDept} onChange={(e) => setSupervisorDept(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">電話番号</label>
                <Input className={fieldClassName()} value={supervisorPhone} onChange={(e) => setSupervisorPhone(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">苦情窓口（顧客側）</label>
                <Input className={fieldClassName()} value={complaintHandlerClient} onChange={(e) => setComplaintHandlerClient(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">苦情窓口（派遣元）</label>
                <Input className={fieldClassName()} value={complaintHandlerUns} onChange={(e) => setComplaintHandlerUns(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">派遣元責任者</label>
                <Input className={fieldClassName()} value={hakenmotoManager} onChange={(e) => setHakenmotoManager(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">残業上限</label>
                <Input className={fieldClassName()} value={overtimeMax} onChange={(e) => setOvertimeMax(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">安全衛生措置</label>
                <Textarea className={fieldClassName()} rows={3} value={safetyMeasures} onChange={(e) => setSafetyMeasures(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">契約終了措置</label>
                <Textarea className={fieldClassName()} rows={3} value={terminationMeasures} onChange={(e) => setTerminationMeasures(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">福利厚生</label>
                <Textarea className={fieldClassName()} rows={3} value={welfare} onChange={(e) => setWelfare(e.target.value)} />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">価格と期間</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                開始日から契約日と通知日を自動計算します。すべての招聘者に同じ価格・期間が適用されます。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <div>
                <label className="text-sm font-medium">時給 / 単価</label>
                <Input className={fieldClassName()} inputMode="decimal" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">請求単価</label>
                <Input className={fieldClassName()} inputMode="decimal" value={billingRate} onChange={(e) => setBillingRate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">契約開始日</label>
                <Input className={fieldClassName()} type="date" value={startDate} onChange={(e) => applyDefaultEndDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">契約終了日</label>
                <Input className={fieldClassName()} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="md:col-span-2 xl:col-span-1">
                <label className="text-sm font-medium">契約日（作成日・任意）</label>
                <Input
                  className={fieldClassName()}
                  type="date"
                  value={contractDateOverride}
                  onChange={(e) => setContractDateOverride(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  空欄なら「契約開始日の2営業日前」で自動計算します。入力した場合、通知日も同じ日付になります。
                </p>
              </div>
            </div>

            {contractDates && (
              <div className="mt-4 rounded-xl bg-muted/30 px-4 py-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {contractDateOverride ? "反映される日付" : "自動計算"}
                </div>
                <div className="mt-2 grid gap-2 text-muted-foreground md:grid-cols-2">
                  <div>
                    契約日: {contractDateOverride || contractDates.contractDate}
                    {contractDateOverride && <span className="ml-2 text-[10px] uppercase tracking-wider text-primary">手動</span>}
                  </div>
                  <div>
                    通知日: {contractDateOverride || contractDates.notificationDate}
                    {contractDateOverride && <span className="ml-2 text-[10px] uppercase tracking-wider text-primary">手動</span>}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-dashed border-border/60 bg-background/50 p-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={includeShugyojoken}
                  onChange={(e) => setIncludeShugyojoken(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border"
                />
                <span>
                  <span className="block text-sm font-medium">就業条件明示書も作成する</span>
                  <span className="block text-xs text-muted-foreground">
                    生成が通れば、個別契約書セットと一緒に出します。
                  </span>
                </span>
              </label>
            </div>

            <div className="mt-4">
              <label className="text-sm font-medium">補足メモ</label>
              <Textarea
                className={fieldClassName()}
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="必要なら契約の補足を残してください"
              />
            </div>

            <div className="mt-5 grid gap-3">
              <Button
                className="w-full"
                disabled={!canGenerate || bundleMutation.isPending}
                onClick={() => bundleMutation.mutate()}
              >
                {bundleMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <FileDown className="mr-2 h-4 w-4" />
                    {recruits.length > 1
                      ? `${recruits.length}名分: 個別契約書 + 台帳 + 労働契約書を作成`
                      : "2個の個別契約書 + 台帳 + 労働契約書を作成"}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={!canGenerate || laborOnlyMutation.isPending}
                onClick={() => laborOnlyMutation.mutate()}
              >
                {laborOnlyMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    労働契約書を作成中...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    {recruits.length > 1 ? `${recruits.length}名分: 労働契約書だけ作成` : "労働契約書だけ作成"}
                  </>
                )}
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">生成結果</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                ボタンを押すと、ここにダウンロードリンクが出ます。
              </p>
            </div>

            {!result ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                まだ生成されていません。
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-muted/30 px-4 py-3 text-sm">
                  <div className="font-medium text-foreground">
                    {result.employees.length === 1
                      ? result.employees[0].fullName
                      : `${result.employees.length}名: ${result.employees.map((e) => e.fullName).join(", ")}`}
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {result.mode === "bundle" && result.contract
                      ? `契約番号: ${result.contract.contractNumber}`
                      : "労働契約書のみ生成しました"}
                  </div>
                </div>
                <div className="grid gap-2">
                  {result.artifacts.map((artifact) => (
                    <a
                      key={`${artifact.label}-${artifact.filename}`}
                      href={artifact.path}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
                    >
                      <span>{artifact.label}</span>
                      <span className="text-xs text-muted-foreground">{artifact.filename}</span>
                    </a>
                  ))}
                </div>
                {result.zipFilename && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary dark:text-primary/90">
                    ZIPでまとめて保存しました: {result.zipFilename}
                  </div>
                )}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => navigate({ to: "/documents" })}>
                    書類生成へ
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => navigate({ to: "/contracts" })}>
                    契約一覧へ
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AnimatedPage>
  );
}
