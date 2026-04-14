export interface AppSettings {
  conflictWarningDays: number;
  adminMode: boolean;
  nenmatsuFrom: string;
  nenmatsuTo: string;
  gwFrom: string;
  gwTo: string;
  obonFrom: string;
  obonTo: string;
}

const STORAGE_KEY = "app_settings_v1";
const DEFAULT_SETTINGS: AppSettings = {
  conflictWarningDays: 90,
  adminMode: false,
  nenmatsuFrom: "12月26日",
  nenmatsuTo: "1月5日",
  gwFrom: "4月29日",
  gwTo: "5月5日",
  obonFrom: "8月8日",
  obonTo: "8月16日",
};

function clampWarningDays(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.conflictWarningDays;
  return Math.min(365, Math.max(1, Math.round(n)));
}

function parseString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
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
      nenmatsuFrom: parseString(parsed.nenmatsuFrom, DEFAULT_SETTINGS.nenmatsuFrom),
      nenmatsuTo: parseString(parsed.nenmatsuTo, DEFAULT_SETTINGS.nenmatsuTo),
      gwFrom: parseString(parsed.gwFrom, DEFAULT_SETTINGS.gwFrom),
      gwTo: parseString(parsed.gwTo, DEFAULT_SETTINGS.gwTo),
      obonFrom: parseString(parsed.obonFrom, DEFAULT_SETTINGS.obonFrom),
      obonTo: parseString(parsed.obonTo, DEFAULT_SETTINGS.obonTo),
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
    nenmatsuFrom: parseString(next.nenmatsuFrom, prev.nenmatsuFrom),
    nenmatsuTo: parseString(next.nenmatsuTo, prev.nenmatsuTo),
    gwFrom: parseString(next.gwFrom, prev.gwFrom),
    gwTo: parseString(next.gwTo, prev.gwTo),
    obonFrom: parseString(next.obonFrom, prev.obonFrom),
    obonTo: parseString(next.obonTo, prev.obonTo),
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  }
  return merged;
}
