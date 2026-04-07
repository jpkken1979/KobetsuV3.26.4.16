// server/__tests__/validation.test.ts
import { describe, it, expect } from "vitest";
import { validateForPdf } from "../services/validation.js";

const completeFactory = {
  supervisorName: "田中太郎",
  supervisorPhone: "086-111-2222",
  hakensakiManagerName: "佐藤花子",
  hakensakiManagerPhone: "086-333-4444",
  address: "岡山県倉敷市1-2-3",
  workHours: "08:00~17:00",
  conflictDate: "2027-03-31",
  closingDayText: "当月末",
  paymentDayText: "翌月20日",
  managerUnsName: "高橋次郎",
  managerUnsPhone: "052-111-2222",
  complaintUnsName: "鈴木一郎",
  complaintUnsPhone: "052-333-4444",
  complaintClientName: "山田健太",
  complaintClientPhone: "086-555-6666",
};

const completeEmployee = {
  fullName: "NGUYEN VAN A",
  billingRate: 1200,
  hourlyRate: 1000,
};

describe("validateForPdf (R17)", () => {
  it("returns valid when all fields present", () => {
    const result = validateForPdf(completeFactory, [completeEmployee]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns errors when factory is null", () => {
    const result = validateForPdf(null, [completeEmployee]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("工場情報が見つかりません");
  });

  it("detects missing factory fields", () => {
    const incomplete = { ...completeFactory, supervisorName: null, hakensakiManagerPhone: null };
    const result = validateForPdf(incomplete, [completeEmployee]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("指揮命令者氏名が未入力です");
    expect(result.errors).toContain("派遣先責任者電話番号が未入力です");
  });

  it("detects missing employee rate using nullish coalescing", () => {
    const empNoRate = { fullName: "TEST USER", billingRate: null, hourlyRate: null };
    const result = validateForPdf(completeFactory, [empNoRate]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("TEST USER: 単価または時給が未設定です");
  });

  it("accepts employee with only hourlyRate (billingRate null)", () => {
    const empHourlyOnly = { fullName: "TEST", billingRate: null, hourlyRate: 1000 };
    const result = validateForPdf(completeFactory, [empHourlyOnly]);
    expect(result.valid).toBe(true);
  });

  it("accepts employee with billingRate = 0 (valid rate)", () => {
    const empZero = { fullName: "TEST", billingRate: 0, hourlyRate: null };
    const result = validateForPdf(completeFactory, [empZero]);
    // billingRate = 0 is not null, so it passes the nullish check
    expect(result.valid).toBe(true);
  });
});
