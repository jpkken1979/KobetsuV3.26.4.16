// server/__tests__/takao-detection.test.ts
import { describe, it, expect } from "vitest";
import { detectTakaoReEntries } from "../services/takao-detection.js";

describe("detectTakaoReEntries (R11)", () => {
  it("returns empty when no 高雄 entries", () => {
    const entries = [
      { employeeNumber: "E001", companyName: "其他株式会社", fullName: "田中太郎", hireDate: "2024-01-01", exitDate: null, factoryName: null },
    ];
    expect(detectTakaoReEntries(entries)).toHaveLength(0);
  });

  it("detects re-entry within 365 days", () => {
    const entries = [
      { employeeNumber: "E001", companyName: "高雄工業株式会社", fullName: "佐藤一郎", hireDate: "2023-04-01", exitDate: "2024-03-31", factoryName: "工場A" },
      { employeeNumber: "E001", companyName: "高雄工業株式会社", fullName: "佐藤一郎", hireDate: "2024-04-01", exitDate: null, factoryName: "工場B" },
    ];
    const result = detectTakaoReEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].gapDays).toBe(1);
    expect(result[0].actualHireDate).toBe("2023-04-01");
  });

  it("ignores re-entry after 365 days", () => {
    const entries = [
      { employeeNumber: "E001", companyName: "高雄工業株式会社", fullName: "佐藤一郎", hireDate: "2023-04-01", exitDate: "2024-04-01", factoryName: "工場A" },
      { employeeNumber: "E001", companyName: "高雄工業株式会社", fullName: "佐藤一郎", hireDate: "2025-04-02", exitDate: null, factoryName: "工場B" },
    ];
    expect(detectTakaoReEntries(entries)).toHaveLength(0);
  });

  it("uses first hireDate as actualHireDate", () => {
    const entries = [
      { employeeNumber: "E001", companyName: "高雄工業株式会社", fullName: "佐藤一郎", hireDate: "2021-04-01", exitDate: null, factoryName: "工場A" },
      { employeeNumber: "E001", companyName: "高雄工業株式会社", fullName: "佐藤一郎", hireDate: "2023-04-01", exitDate: "2024-03-31", factoryName: "工場B" },
      { employeeNumber: "E001", companyName: "高雄工業株式会社", fullName: "佐藤一郎", hireDate: "2024-04-01", exitDate: null, factoryName: "工場C" },
    ];
    const result = detectTakaoReEntries(entries);
    expect(result).toHaveLength(1);
    expect(result[0].actualHireDate).toBe("2021-04-01");
  });
});
