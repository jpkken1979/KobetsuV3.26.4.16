import { create } from "zustand";

export type Theme = "dark" | "light";

const STORAGE_KEY = "theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.add("transitioning");
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  setTimeout(() => {
    document.documentElement.classList.remove("transitioning");
  }, 300);
}

interface ThemeState {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
}

export const useTheme = create<ThemeState>()((set) => {
  const initial = getInitialTheme();
  applyTheme(initial);
  return {
    theme: initial,
    isDark: initial === "dark",
    toggleTheme: () =>
      set((state) => {
        const next: Theme = state.theme === "dark" ? "light" : "dark";
        applyTheme(next);
        return { theme: next, isDark: next === "dark" };
      }),
  };
});
