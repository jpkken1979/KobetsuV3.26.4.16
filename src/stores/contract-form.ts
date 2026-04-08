import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ContractFormData {
  // Step 1: Select destination
  companyId: number | null;
  factoryId: number | null;

  // Step 2: Dates
  startDate: string;
  endDate: string;
  contractDate: string;
  notificationDate: string;
  conflictDateOverride: string | null;
  useConflictDateOverride: boolean;

  // Step 3: Work conditions (auto-filled from factory)
  workDays: string;
  workStartTime: string;
  workEndTime: string;
  breakMinutes: number;
  jobDescription: string;
  responsibilityLevel: string;
  overtimeMax: string;

  // Step 3: Legal contacts (auto-filled from factory)
  supervisorName: string;
  supervisorDept: string;
  supervisorPhone: string;
  complaintHandlerClient: string;
  complaintHandlerUns: string;
  hakenmotoManager: string;

  // Step 3: Legal fields
  safetyMeasures: string;
  terminationMeasures: string;
  welfare: string;
  isKyoteiTaisho: boolean;

  // Step 4: Rates
  hourlyRate: number;
  overtimeRate: number;
  nightShiftRate: number;
  holidayRate: number;

  // Step 5: Employees
  employeeIds: number[];

  // Factory metadata (read from factory, used for date auto-calc)
  factoryConflictDate: string;
  factoryContractPeriod: string;

  // Step 1 UI state (cascading select navigation)
  selectedFactoryName: string;
  selectedDeptName: string;

  // Meta
  notes: string;
}

interface ContractFormStore {
  currentStep: number;
  data: ContractFormData;
  isDirty: boolean;

  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateField: <K extends keyof ContractFormData>(
    field: K,
    value: ContractFormData[K]
  ) => void;
  updateFields: (fields: Partial<ContractFormData>) => void;
  reset: () => void;
  clearDraft: () => void;
  setConflictDateOverride: (date: string | null) => void;
  setUseConflictDateOverride: (val: boolean) => void;
}

const INITIAL_DATA: ContractFormData = {
  companyId: null,
  factoryId: null,
  startDate: "",
  endDate: "",
  contractDate: "",
  notificationDate: "",
  conflictDateOverride: null,
  useConflictDateOverride: false,
  workDays: "",
  workStartTime: "",
  workEndTime: "",
  breakMinutes: 0,
  jobDescription: "",
  responsibilityLevel: "付与される権限なし",
  overtimeMax: "",
  supervisorName: "",
  supervisorDept: "",
  supervisorPhone: "",
  complaintHandlerClient: "",
  complaintHandlerUns: "",
  hakenmotoManager: "",
  safetyMeasures: "労働安全衛生法に基づき、安全衛生に関する措置を講ずること。",
  terminationMeasures:
    "労働者派遣契約の解除に当たって講ずる派遣労働者の雇用の安定を図るための措置。",
  welfare: "☑食堂、☑駐車場、☑更衣室、□シャワー室、制服（□有償・☑無償）〔その他　　　　　　　　　　〕",
  isKyoteiTaisho: true,
  hourlyRate: 0,
  overtimeRate: 0,
  nightShiftRate: 0,
  holidayRate: 0,
  employeeIds: [],
  factoryConflictDate: "",
  factoryContractPeriod: "",
  selectedFactoryName: "",
  selectedDeptName: "",
  notes: "",
};

const TOTAL_STEPS = 5;

const INITIAL_STATE = {
  currentStep: 1,
  data: { ...INITIAL_DATA },
  isDirty: false,
};

export const useContractFormStore = create<ContractFormStore>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setStep: (step) =>
        set({ currentStep: Math.max(1, Math.min(TOTAL_STEPS, step)) }),

      nextStep: () =>
        set((state) => ({
          currentStep: Math.min(TOTAL_STEPS, state.currentStep + 1),
        })),

      prevStep: () =>
        set((state) => ({
          currentStep: Math.max(1, state.currentStep - 1),
        })),

      updateField: (field, value) =>
        set((state) => ({
          data: { ...state.data, [field]: value },
          isDirty: true,
        })),

      updateFields: (fields) =>
        set((state) => ({
          data: { ...state.data, ...fields },
          isDirty: true,
        })),

      reset: () =>
        set({
          currentStep: 1,
          data: { ...INITIAL_DATA },
          isDirty: false,
        }),

      clearDraft: () => {
        set({ ...INITIAL_STATE, isDirty: false });
      },

      setConflictDateOverride: (date) =>
        set((s) => ({ ...s, data: { ...s.data, conflictDateOverride: date } })),

      setUseConflictDateOverride: (val) =>
        set((s) => ({
          ...s,
          data: {
            ...s.data,
            useConflictDateOverride: val,
            conflictDateOverride: val ? s.data.conflictDateOverride : null,
          },
        })),
    }),
    {
      name: "contract-form-draft",
      version: 1,
      migrate: (persisted: unknown) => {
        const s = persisted as { data?: Partial<ContractFormData> };
        return { ...s, data: { ...INITIAL_DATA, ...(s.data ?? {}) } };
      },
      partialize: (state) => ({
        data: state.data,
        currentStep: state.currentStep,
        isDirty: state.isDirty,
      }),
    }
  )
);
