// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "../hooks/use-debounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve el valor inicial sin esperar", () => {
    const { result } = renderHook(() => useDebounce("foo", 300));
    expect(result.current).toBe("foo");
  });

  it("retrasa la actualizacion del valor", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 300),
      { initialProps: { value: "foo" } },
    );
    expect(result.current).toBe("foo");

    rerender({ value: "bar" });
    expect(result.current).toBe("foo"); // sigue siendo el viejo

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("foo"); // todavia no

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("bar"); // ahora si
  });

  it("cancela actualizaciones pendientes cuando cambia el valor antes del delay", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 300),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "b" });
    act(() => { vi.advanceTimersByTime(150); });
    rerender({ value: "c" });
    act(() => { vi.advanceTimersByTime(150); });
    expect(result.current).toBe("a"); // ni "b" ni "c" todavia
    act(() => { vi.advanceTimersByTime(150); });
    expect(result.current).toBe("c"); // saltea "b" directamente a "c"
  });

  it("usa delay default de 300ms cuando no se pasa", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => useDebounce(value),
      { initialProps: { value: 1 } },
    );
    rerender({ value: 2 });
    act(() => { vi.advanceTimersByTime(299); });
    expect(result.current).toBe(1);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(2);
  });

  it("respeta delays distintos", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebounce(value, delay),
      { initialProps: { value: "a", delay: 100 } },
    );

    rerender({ value: "b", delay: 100 });
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe("b");
  });

  it("funciona con tipos no-string (numbers, objetos)", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => useDebounce(value, 50),
      { initialProps: { value: 42 } },
    );
    rerender({ value: 100 });
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current).toBe(100);
  });
});
