import { describe, it, expect } from "vitest";
import { sanitizeErrorMessage } from "../services/error-utils.js";

describe("sanitizeErrorMessage", () => {
  it("extrae mensaje de Error", () => {
    expect(sanitizeErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("acepta string raw", () => {
    expect(sanitizeErrorMessage("falló algo")).toBe("falló algo");
  });

  it("usa fallback para valores no-Error/no-string", () => {
    expect(sanitizeErrorMessage(null)).toBe("Unknown error");
    expect(sanitizeErrorMessage(undefined)).toBe("Unknown error");
    expect(sanitizeErrorMessage({ code: 500 })).toBe("Unknown error");
    expect(sanitizeErrorMessage(42, "custom fb")).toBe("custom fb");
  });

  it("oculta paths absolutos Unix /home/user/...", () => {
    const err = new Error("ENOENT: open /home/user/secret/file.db");
    const result = sanitizeErrorMessage(err);
    expect(result).not.toContain("/home/user");
    expect(result).toContain("<path>");
  });

  it("oculta paths absolutos /var/...", () => {
    const err = new Error("permission denied at /var/lib/postgres/data");
    const result = sanitizeErrorMessage(err);
    expect(result).not.toContain("/var/lib");
    expect(result).toContain("<path>");
  });

  it("oculta paths absolutos /etc/...", () => {
    const err = new Error("read /etc/passwd failed");
    expect(sanitizeErrorMessage(err)).not.toContain("/etc/passwd");
  });

  it("oculta paths Windows C:\\...", () => {
    const err = new Error("Cannot find C:\\Users\\Admin\\secret.json");
    const result = sanitizeErrorMessage(err);
    expect(result).not.toContain("C:\\Users");
    expect(result).toContain("<path>");
  });

  it("oculta paths Windows D:\\...", () => {
    const err = new Error("D:\\projects\\app\\dist\\bundle.js missing");
    const result = sanitizeErrorMessage(err);
    expect(result).not.toContain("D:\\projects");
  });

  it("preserva paths relativos (no absolutos)", () => {
    const err = new Error("Cannot find ./local/file.ts or src/utils.js");
    const result = sanitizeErrorMessage(err);
    expect(result).toContain("./local/file.ts");
    expect(result).toContain("src/utils.js");
  });

  it("trunca mensajes largos a 500 chars", () => {
    const long = "x".repeat(2000);
    const result = sanitizeErrorMessage(new Error(long));
    expect(result.length).toBe(500);
  });

  it("preserva mensajes cortos sin paths", () => {
    expect(sanitizeErrorMessage(new Error("Database is locked"))).toBe("Database is locked");
  });
});
