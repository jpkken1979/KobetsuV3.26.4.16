import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Density = "comfortable" | "compact";

interface UIPrefsState {
  density: Density;
  sidebarCollapsed: boolean;
  setDensity: (density: Density) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useUIPrefs = create<UIPrefsState>()(
  persist(
    (set) => ({
      density: "comfortable",
      sidebarCollapsed: false,
      setDensity: (density) => {
        set({ density });
        document.documentElement.setAttribute("data-density", density);
      },
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    {
      name: "ui-prefs",
      onRehydrateStorage: () => (state) => {
        if (state) {
          document.documentElement.setAttribute("data-density", state.density);
        }
      },
    }
  )
);
