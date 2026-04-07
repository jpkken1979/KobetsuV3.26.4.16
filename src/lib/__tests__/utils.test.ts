import { describe, it, expect } from "vitest";
import { cn } from "../utils";

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
