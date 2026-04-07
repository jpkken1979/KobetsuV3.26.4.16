// src/lib/mutation-helpers.ts
// Shared toast helpers for React Query mutations.

import { toast } from "sonner";

export function onMutationSuccess(message: string): void {
  toast.success(message);
}

export function onMutationError(err: unknown): void {
  const message = err instanceof Error ? err.message : "エラーが発生しました";
  toast.error(message);
}
