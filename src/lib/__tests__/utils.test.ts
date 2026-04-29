import { describe, it, expect } from "vitest";
import { cn, isSafePreviewUrl, toLocalDateStr } from "../utils";

describe("cn (className merge)", () => {
  it("merges basic classes", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    const showHidden = false;
    expect(cn("base", showHidden ? "hidden" : undefined, "visible")).toBe("base visible");
  });

  it("resolves tailwind conflicts (last wins)", () => {
    const result = cn("px-2 py-1", "px-4");
    expect(result).toContain("px-4");
    expect(result).not.toContain("px-2");
  });

  it("handles undefined and null", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end");
  });

  it("handles empty string", () => {
    expect(cn("base", "", "end")).toBe("base end");
  });
});

describe("isSafePreviewUrl", () => {
  it("acepta /api/ prefix", () => {
    expect(isSafePreviewUrl("/api/documents/download/foo.pdf")).toBe(true);
  });

  it("acepta /output/ prefix", () => {
    expect(isSafePreviewUrl("/output/kobetsu/contract.pdf")).toBe(true);
  });

  it("rechaza null/undefined/empty", () => {
    expect(isSafePreviewUrl(null)).toBe(false);
    expect(isSafePreviewUrl(undefined)).toBe(false);
    expect(isSafePreviewUrl("")).toBe(false);
  });

  it("rechaza javascript: URIs", () => {
    expect(isSafePreviewUrl("javascript:alert(1)")).toBe(false);
  });

  it("rechaza data: URIs", () => {
    expect(isSafePreviewUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rechaza dominios externos", () => {
    expect(isSafePreviewUrl("https://evil.example.com/x")).toBe(false);
    expect(isSafePreviewUrl("http://localhost/x")).toBe(false);
    expect(isSafePreviewUrl("//evil.example.com/x")).toBe(false);
  });

  it("rechaza otros prefijos relativos", () => {
    expect(isSafePreviewUrl("/static/x.pdf")).toBe(false);
    expect(isSafePreviewUrl("./api/x")).toBe(false);
    expect(isSafePreviewUrl("api/x")).toBe(false);
  });
});

describe("toLocalDateStr", () => {
  it("formatea YYYY-MM-DD respetando zona horaria local", () => {
    // 2026-04-29 a media noche local — Date constructor es local time
    const date = new Date(2026, 3, 29); // mes es 0-indexed
    expect(toLocalDateStr(date)).toBe("2026-04-29");
  });

  it("padea mes y dia con cero", () => {
    const date = new Date(2026, 0, 5);
    expect(toLocalDateStr(date)).toBe("2026-01-05");
  });

  it("devuelve año de 4 digitos", () => {
    const date = new Date(2030, 11, 31);
    expect(toLocalDateStr(date)).toBe("2030-12-31");
  });
});
