import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea una fecha como YYYY-MM-DD usando la zona horaria local.
 * Evita el bug de toISOString() que en JST (UTC+9) puede retornar el día anterior.
 */
export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Permite sólo URLs internas relativas (`/api/...` o `/output/...`) para usarse
 * como `src` de un `<iframe>`. Cierra FRONT-MED-3 (audit 2026-04-29): si en
 * algún flujo futuro `previewUrl` viniera de un input externo, esto evita que
 * el iframe cargue contenido arbitrario (ej. `javascript:`, `data:`, dominio externo).
 */
export function isSafePreviewUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  return url.startsWith("/api/") || url.startsWith("/output/");
}
