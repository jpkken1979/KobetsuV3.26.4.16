// src/lib/hooks/use-contract-wizard.ts
import { useState, useCallback } from 'react';
import { addMonths } from 'date-fns';

interface WizardState {
  step: 1 | 2;
  // Step 1
  companyId: number | null;
  factoryId: number | null;
  startDate: string;
  period: string; // "1month" | "2months" | "3months" | "6months" | "1year" | "teishokubi"
  endDate: string;
  endDateOverride: boolean; // true if user manually edited endDate
  conflictDateOverride: string | null;
  useConflictDateOverride: boolean;
  // Step 2
  employeeIds: number[];
  generatePdfs: boolean;
}

const PERIOD_TO_MONTHS: Record<string, number> = {
  "1month": 1,
  "2months": 2,
  "3months": 3,
  "6months": 6,
  "1year": 12,
  "teishokubi": Infinity,
};

export function calculateEndDate(startDate: Date, period: string, conflictDate: Date | null): Date {
  if (period === "teishokubi") {
    return conflictDate ?? startDate;
  }
  const months = PERIOD_TO_MONTHS[period] ?? 3;
  const calculated = addMonths(startDate, months);
  if (conflictDate && calculated > conflictDate) {
    return conflictDate;
  }
  return calculated;
}

export function useContractWizard() {
  const [state, setState] = useState<WizardState>({
    step: 1,
    companyId: null,
    factoryId: null,
    startDate: '',
    period: '3months',
    endDate: '',
    endDateOverride: false,
    conflictDateOverride: null,
    useConflictDateOverride: false,
    employeeIds: [],
    generatePdfs: false,
  });

  const setStep = useCallback((step: 1 | 2) => {
    setState((s) => ({ ...s, step }));
  }, []);

  const setCompany = useCallback((companyId: number) => {
    setState((s) => ({ ...s, companyId, factoryId: null, startDate: '', endDate: '', endDateOverride: false }));
  }, []);

  const setFactory = useCallback((factoryId: number, factory?: { contractStartDate?: string; contractPeriod?: string; conflictDate?: string }) => {
    // Auto-fill from factory: startDate from factory.contractStartDate, period from factory.contractPeriod
    const startDate = factory?.contractStartDate ?? state.startDate;
    const period = factory?.contractPeriod ?? state.period;
    let endDate = state.endDate;
    const endDateOverride = state.endDateOverride;

    if (startDate && !endDateOverride) {
      const conflictDate = factory?.conflictDate ? new Date(factory.conflictDate) : null;
      const calculated = calculateEndDate(new Date(startDate), period, conflictDate);
      endDate = calculated.toISOString().split('T')[0];
    }

    setState((s) => ({ ...s, factoryId, startDate, period, endDate, endDateOverride }));
  }, [state.startDate, state.period, state.endDate, state.endDateOverride]);

  const setStartDate = useCallback((startDate: string) => {
    setState((s) => {
      if (!startDate) return { ...s, startDate, endDate: '', endDateOverride: false };
      return { ...s, startDate };
    });
  }, []);

  const setPeriod = useCallback((period: string) => {
    setState((s) => ({ ...s, period, endDateOverride: false }));
  }, []);

  const setEndDate = useCallback((endDate: string, override = true) => {
    setState((s) => ({ ...s, endDate, endDateOverride: override }));
  }, []);

  const setEmployeeIds = useCallback((employeeIds: number[]) => {
    setState((s) => ({ ...s, employeeIds }));
  }, []);

  const setGeneratePdfs = useCallback((generatePdfs: boolean) => {
    setState((s) => ({ ...s, generatePdfs }));
  }, []);

  const setConflictDateOverride = useCallback((conflictDateOverride: string | null) => {
    setState((s) => ({ ...s, conflictDateOverride }));
  }, []);

  const setUseConflictDateOverride = useCallback((useConflictDateOverride: boolean) => {
    setState((s) => ({ ...s, useConflictDateOverride }));
  }, []);

  const reset = useCallback(() => {
    setState({
      step: 1,
      companyId: null,
      factoryId: null,
      startDate: '',
      period: '3months',
      endDate: '',
      endDateOverride: false,
      conflictDateOverride: null,
      useConflictDateOverride: false,
      employeeIds: [],
      generatePdfs: false,
    });
  }, []);

  return {
    state,
    setStep,
    setCompany,
    setFactory,
    setStartDate,
    setPeriod,
    setEndDate,
    setEmployeeIds,
    setGeneratePdfs,
    setConflictDateOverride,
    setUseConflictDateOverride,
    reset,
    calculateEndDate,
  };
}
