import type { FormValue } from "./-shared";

// ─── Shared Step Props ───────────────────────────────────────────────

export interface StepProps {
  form: Record<string, FormValue>;
  updateForm: (key: string, value: FormValue) => void;
}
