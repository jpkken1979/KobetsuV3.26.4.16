// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("useTheme (Zustand store)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.resetModules();
    // Reset classList state
    document.documentElement.classList.remove("dark", "transitioning");
  });

  function mockMatchMedia(prefersDark: boolean) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: prefersDark && query === "(prefers-color-scheme: dark)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  it("defaults to dark when no saved preference and prefers-color-scheme is dark", async () => {
    mockMatchMedia(true);
    const { useTheme } = await import("../hooks/use-theme");
    const state = useTheme.getState();
    expect(state.theme).toBe("dark");
    expect(state.isDark).toBe(true);
  });

  it("defaults to light when no saved preference and prefers-color-scheme is light", async () => {
    mockMatchMedia(false);
    const { useTheme } = await import("../hooks/use-theme");
    const state = useTheme.getState();
    expect(state.theme).toBe("light");
    expect(state.isDark).toBe(false);
  });

  it("reads saved theme from localStorage", async () => {
    mockMatchMedia(true);
    localStorage.setItem("theme", "light");
    const { useTheme } = await import("../hooks/use-theme");
    const state = useTheme.getState();
    expect(state.theme).toBe("light");
    expect(state.isDark).toBe(false);
  });

  it("toggleTheme switches from dark to light", async () => {
    mockMatchMedia(true);
    const { useTheme } = await import("../hooks/use-theme");
    expect(useTheme.getState().theme).toBe("dark");

    useTheme.getState().toggleTheme();

    expect(useTheme.getState().theme).toBe("light");
    expect(useTheme.getState().isDark).toBe(false);
  });

  it("toggleTheme switches from light back to dark", async () => {
    mockMatchMedia(true);
    localStorage.setItem("theme", "light");
    const { useTheme } = await import("../hooks/use-theme");
    expect(useTheme.getState().theme).toBe("light");

    useTheme.getState().toggleTheme();

    expect(useTheme.getState().theme).toBe("dark");
    expect(useTheme.getState().isDark).toBe(true);
  });

  it("persists theme to localStorage on toggle", async () => {
    mockMatchMedia(true);
    const { useTheme } = await import("../hooks/use-theme");
    useTheme.getState().toggleTheme();
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("applies dark class to documentElement when dark", async () => {
    mockMatchMedia(true);
    const { useTheme } = await import("../hooks/use-theme");
    // Initial theme is dark
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    useTheme.getState().toggleTheme();
    // After toggle to light, dark class removed
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("adds transitioning class during theme change", async () => {
    mockMatchMedia(true);
    const { useTheme } = await import("../hooks/use-theme");
    const addSpy = vi.spyOn(document.documentElement.classList, "add");
    useTheme.getState().toggleTheme();
    expect(addSpy).toHaveBeenCalledWith("transitioning");
    addSpy.mockRestore();
  });

  it("ignores invalid saved values and falls back to system preference", async () => {
    mockMatchMedia(true);
    localStorage.setItem("theme", "invalid-value");
    const { useTheme } = await import("../hooks/use-theme");
    expect(useTheme.getState().theme).toBe("dark");
  });

  it("double toggle returns to original theme", async () => {
    mockMatchMedia(true);
    const { useTheme } = await import("../hooks/use-theme");
    expect(useTheme.getState().theme).toBe("dark");

    useTheme.getState().toggleTheme();
    useTheme.getState().toggleTheme();

    expect(useTheme.getState().theme).toBe("dark");
    expect(useTheme.getState().isDark).toBe(true);
  });
});
