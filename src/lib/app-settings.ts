export interface AppSettings {
  conflictWarningDays: number;
  adminMode: boolean;
}

const STORAGE_KEY = "app_settings_v1";
const DEFAULT_SETTINGS: AppSettings = {
  conflictWarningDays: 90,
  adminMode: false,
};

function clampWarningDays(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.conflictWarningDays;
  return Math.min(365, Math.max(1, Math.round(n)));
}

export function getAppSettings(): AppSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      conflictWarningDays: clampWarningDays(parsed.conflictWarningDays),
      adminMode: typeof parsed.adminMode === "boolean" ? parsed.adminMode : false,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function updateAppSettings(next: Partial<AppSettings>): AppSettings {
  const prev = getAppSettings();
  const merged: AppSettings = {
    conflictWarningDays: clampWarningDays(next.conflictWarningDays ?? prev.conflictWarningDays),
    adminMode: typeof next.adminMode === "boolean" ? next.adminMode : prev.adminMode,
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  }
  return merged;
}
