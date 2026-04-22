import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { AnimatedPage } from "@/components/ui/animated";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, downloadZip, type Employee, type EmployeeCreate, type Factory } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { calculateContractDates } from "@/lib/contract-dates";

import { StepCompanySelect, RecruitFormList, type RecruitForm, FactoryDefaultsForm, PricingDatesForm, GenerationPanel, ResultPanel, type GenerationResult, ShouheishaPageHeader, StepIndicatorBar } from "./shouheisha/-index";

export const Route = createFileRoute("/shouheisha")({
  component: ShouheishaPage,
  errorComponent: ({ reset }) => (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <p className="text-lg font-semibold text-destructive">エラーが発生しました</p>
      <Button variant="outline" onClick={reset}>再試行</Button>
    </div>
  ),
});

// ─── Utilities ────────────────────────────────────────────────────────────────

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

// ─── Page component ───────────────────────────────────────────────────────────

function ShouheishaPage() {
  const queryClient = useQueryClient();

  // Step 1 — Company / Factory cascade
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [factoryName, setFactoryName] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [lineId, setLineId] = useState<number | null>(null);

  // Step 2 — Recruits
  const [recruits, setRecruits] = useState<RecruitForm[]>(() => [emptyRecruit()]);

  // Step 3 — Factory defaults
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
  const [autoFillEnabled, setAutoFillEnabled] = useState(true);
  const [selectedFactory, setSelectedFactory] = useState<Factory | null>(null);

  // Step 4 — Pricing & dates
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [contractDateOverride, setContractDateOverride] = useState("");
  const [includeShugyojoken, setIncludeShugyojoken] = useState(true);
  const [notes, setNotes] = useState("");

  // Result
  const [result, setResult] = useState<GenerationResult | null>(null);

  // Derived
  // Derived — cast Factory (db) to the narrower StepCompanySelect shape
  const stepSelectedFactory = selectedFactory
    ? {
        id: selectedFactory.id,
        factoryName: selectedFactory.factoryName,
        department: selectedFactory.department ?? "",
        lineName: selectedFactory.lineName ?? "",
        address: selectedFactory.address ?? "",
        phone: selectedFactory.phone ?? "",
        jobDescription: selectedFactory.jobDescription ?? "",
        jobDescription2: selectedFactory.jobDescription2 ?? "",
        hourlyRate: selectedFactory.hourlyRate,
        shiftPattern: selectedFactory.shiftPattern ?? "",
        supervisorName: selectedFactory.supervisorName ?? "",
        supervisorDept: selectedFactory.supervisorDept ?? "",
      }
    : null;
  const selectedFactoryLabel = selectedFactory
    ? [selectedFactory.factoryName, selectedFactory.department, selectedFactory.lineName].filter(Boolean).join(" / ")
    : "";
  const selectedFactoryAddress = selectedFactory?.address ?? "";
  const selectedFactoryPhone = selectedFactory?.phone ?? "";

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

  // ── Recruit list helpers ───────────────────────────────────────────────────────

  const updateRecruit = (index: number, patch: Partial<RecruitForm>) => {
    setRecruits((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };
  const addRecruit = () => setRecruits((prev) => [...prev, emptyRecruit()]);
  const removeRecruit = (index: number) =>
    setRecruits((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));

  // ── Factory defaults application ─────────────────────────────────────────────

  const applyFactoryDefaults = (factory: Factory) => {
    if (typeof factory.hourlyRate === "number" && !hourlyRate) {
      setHourlyRate(String(factory.hourlyRate));
    }
    if (typeof factory.hourlyRate === "number" && !billingRate) {
      setBillingRate(String(factory.hourlyRate));
    }
    setJobDescription(factory.jobDescription2 || factory.jobDescription || "");
    setShiftPattern(factory.shiftPattern || "");
    setWorkHours((factory.workHours || "").replace(/\s*\([^)]*8\.5[^)]*\)/g, "").trim());
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
    setBreakMinutes(
      factory.breakTime !== null && factory.breakTime !== undefined ? String(factory.breakTime) : "",
    );
  };

  // ── Cascade handlers ───────────────────────────────────────────────────────────

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
    setSelectedFactory(factory);
    setResult(null);
  };

  // ── Business logic (upsert + contract creation) ───────────────────────────────

  const upsertEmployees = async (): Promise<Employee[]> => {
    if (!companyId || !lineId) throw new Error("会社と配属先を選んでください");

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

      let effectiveEmployeeNumber = recruit.employeeNumber.trim() || baseFallback;
      if (!recruit.employeeNumber.trim()) {
        const candidates = await api.getEmployees({ search: baseFallback });
        const sameDayMatches = candidates.filter(
          (c) => c.employeeNumber === baseFallback || c.employeeNumber.startsWith(`${baseFallback}-`),
        );
        const samePerson = sameDayMatches.find((c) => {
          if (trimmedKatakana && c.katakanaName === trimmedKatakana) return true;
          if (trimmedFullName && c.fullName === trimmedFullName) return true;
          return false;
        });
        if (samePerson) {
          effectiveEmployeeNumber = samePerson.employeeNumber;
        } else {
          const used = new Set([...sameDayMatches.map((m) => m.employeeNumber), ...usedInBatch]);
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
      const existingEmployee =
        matchedEmployees.find((employee) => employee.employeeNumber === effectiveEmployeeNumber) ?? null;

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
    if (!companyId || !lineId) throw new Error("会社と配属先を選んでください");
    if (!startDate || !endDate) throw new Error("契約開始日と終了日を入力してください");

    const contractDates = calculateContractDates(startDate);
    const effectiveContractDate = contractDateOverride || contractDates.contractDate;
    const effectiveNotificationDate = contractDateOverride || contractDates.notificationDate;
    const effectiveHourlyRate = normalizeNumber(hourlyRate);
    const effectiveBillingRate = normalizeNumber(billingRate) ?? effectiveHourlyRate;

    const contract =
      mode === "bundle"
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
    if (employees.length === 1) return `招聘者_${employees[0].employeeNumber}`;
    return `招聘者_${employees.length}名_${employees[0].employeeNumber}他`;
  };

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const bundleMutation = useMutation({
    mutationFn: async (): Promise<GenerationResult> => {
      const employees = await upsertEmployees();
      const { contract } = await createContractForEmployees(employees, "bundle");
      if (!contract) throw new Error("契約の作成に失敗しました");

      const artifacts: GenerationResult["artifacts"] = [];
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
      await downloadZip(artifacts.map((a: { filename: string }) => a.filename), zipFilename);
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
          : `${data.employees.length}名: ${data.employees.map((e: { fullName: string }) => e.fullName).join(", ")}`;
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

      const artifacts: GenerationResult["artifacts"] = [];
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
      await downloadZip(artifacts.map((a: { filename: string }) => a.filename), zipFilename);
      return { employees, contract: null, mode: "laborOnly", artifacts, zipFilename, warnings };
    },
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.employees.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.documents.all }),
      ]);
      setResult(data);
      const namesDesc =
        data.employees.length === 1 ? data.employees[0].fullName : `${data.employees.length}名`;
      toast.success("労働契約書を作成しました", { description: namesDesc });
    },
    onError: (error: Error) => {
      toast.error("労働契約書の作成に失敗しました", { description: error.message });
    },
  });

  // ── Validity ──────────────────────────────────────────────────────────────────

  const canGenerate =
    !!companyId &&
    !!lineId &&
    recruits.every((r) => r.fullName.trim() || r.katakanaName.trim()) &&
    !!startDate &&
    !!endDate;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <AnimatedPage className="space-y-6">
      <ShouheishaPageHeader onBackHref="/" />
      <StepIndicatorBar />

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        {/* Left column */}
        <div className="space-y-6">
          {/* Step 1 — Company select */}
          <StepCompanySelect
            companyId={companyId}
            factoryName={factoryName}
            departmentName={departmentName}
            lineId={lineId}
            onCompanyChange={handleCompanyChange}
            onFactoryChange={handleFactoryChange}
            onDepartmentChange={handleDepartmentChange}
            onLineChange={handleLineChange}
            selectedCompany={null}
            selectedFactoryLabel={selectedFactoryLabel}
            selectedFactory={stepSelectedFactory}
            selectedFactoryAddress={selectedFactoryAddress}
            selectedFactoryPhone={selectedFactoryPhone}
          />

          {/* Step 2 — Recruit form */}
          <Card variant="default" className="p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">招聘者の情報</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  ここに入れるデータを、そのまま個別契約書・台帳・労働契約書に流します。複数人を同じ工場・ラインに一括で登録できます。
                </p>
              </div>
              <Badge variant="info" size="sm" className="mono-tabular">{recruits.length}名</Badge>
            </div>

            <RecruitFormList
              recruits={recruits}
              onChange={updateRecruit}
              onRemove={removeRecruit}
            />

            <Button type="button" variant="outline" onClick={addRecruit} className="mt-4 w-full border-dashed">
              <Plus className="mr-2 h-4 w-4" />
              招聘者を追加
            </Button>
          </Card>

          {/* Step 3 — Factory defaults */}
          <Card variant="default" className="p-6">
            <FactoryDefaultsForm
              jobDescription={jobDescription}
              shiftPattern={shiftPattern}
              workHours={workHours}
              workDays={workDays}
              workStartTime={workStartTime}
              workEndTime={workEndTime}
              breakMinutes={breakMinutes}
              supervisorName={supervisorName}
              supervisorDept={supervisorDept}
              supervisorPhone={supervisorPhone}
              complaintHandlerClient={complaintHandlerClient}
              complaintHandlerUns={complaintHandlerUns}
              hakenmotoManager={hakenmotoManager}
              safetyMeasures={safetyMeasures}
              terminationMeasures={terminationMeasures}
              responsibilityLevel={responsibilityLevel}
              overtimeMax={overtimeMax}
              welfare={welfare}
              autoFillEnabled={autoFillEnabled}
              onChange={(patch: Partial<{
                jobDescription: string; shiftPattern: string; workHours: string; workDays: string;
                workStartTime: string; workEndTime: string; breakMinutes: string; supervisorName: string;
                supervisorDept: string; supervisorPhone: string; complaintHandlerClient: string;
                complaintHandlerUns: string; hakenmotoManager: string; safetyMeasures: string;
                terminationMeasures: string; responsibilityLevel: string; overtimeMax: string; welfare: string;
              }>) => {
                if ("jobDescription" in patch) setJobDescription(patch.jobDescription!);
                if ("shiftPattern" in patch) setShiftPattern(patch.shiftPattern!);
                if ("workHours" in patch) setWorkHours(patch.workHours!);
                if ("workDays" in patch) setWorkDays(patch.workDays!);
                if ("workStartTime" in patch) setWorkStartTime(patch.workStartTime!);
                if ("workEndTime" in patch) setWorkEndTime(patch.workEndTime!);
                if ("breakMinutes" in patch) setBreakMinutes(patch.breakMinutes!);
                if ("supervisorName" in patch) setSupervisorName(patch.supervisorName!);
                if ("supervisorDept" in patch) setSupervisorDept(patch.supervisorDept!);
                if ("supervisorPhone" in patch) setSupervisorPhone(patch.supervisorPhone!);
                if ("complaintHandlerClient" in patch) setComplaintHandlerClient(patch.complaintHandlerClient!);
                if ("complaintHandlerUns" in patch) setComplaintHandlerUns(patch.complaintHandlerUns!);
                if ("hakenmotoManager" in patch) setHakenmotoManager(patch.hakenmotoManager!);
                if ("safetyMeasures" in patch) setSafetyMeasures(patch.safetyMeasures!);
                if ("terminationMeasures" in patch) setTerminationMeasures(patch.terminationMeasures!);
                if ("responsibilityLevel" in patch) setResponsibilityLevel(patch.responsibilityLevel!);
                if ("overtimeMax" in patch) setOvertimeMax(patch.overtimeMax!);
                if ("welfare" in patch) setWelfare(patch.welfare!);
              }}
              onAutoFillToggle={setAutoFillEnabled}
              onApplyFactoryDefaults={() => selectedFactory && applyFactoryDefaults(selectedFactory)}
            />
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Step 4 — Pricing & dates + generate buttons */}
          <Card variant="default" className="p-6">
            <PricingDatesForm
              hourlyRate={hourlyRate}
              billingRate={billingRate}
              startDate={startDate}
              endDate={endDate}
              contractDateOverride={contractDateOverride}
              includeShugyojoken={includeShugyojoken}
              notes={notes}
              onHourlyRateChange={setHourlyRate}
              onBillingRateChange={setBillingRate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onContractDateOverrideChange={setContractDateOverride}
              onIncludeShugyojokenChange={setIncludeShugyojoken}
              onNotesChange={setNotes}
            />
            <GenerationPanel
              recruitsCount={recruits.length}
              canGenerate={canGenerate}
              isBundlePending={bundleMutation.isPending}
              isLaborOnlyPending={laborOnlyMutation.isPending}
              onBundle={() => bundleMutation.mutate()}
              onLaborOnly={() => laborOnlyMutation.mutate()}
            />
          </Card>

          {/* Step 5 — Result panel */}
          <Card variant="default" className="p-6">
            <ResultPanel result={result} />
          </Card>
        </div>
      </div>
    </AnimatedPage>
  );
}