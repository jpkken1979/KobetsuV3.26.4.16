import { describe, it, expect } from "vitest";
import { COMPLETENESS_CONFIG, FIELD_LABELS } from "./-completeness";

describe("COMPLETENESS_CONFIG", () => {
  it("has all 4 levels defined", () => {
    expect(Object.keys(COMPLETENESS_CONFIG)).toEqual(["green", "yellow", "red", "gray"]);
  });

  it("each level has label, dotClass, badgeClass", () => {
    for (const level of Object.values(COMPLETENESS_CONFIG)) {
      expect(level.label).toBeTruthy();
      expect(level.dotClass).toMatch(/^bg-/);
      expect(level.badgeClass).toBeTruthy();
    }
  });

  it("green label is 準備完了", () => {
    expect(COMPLETENESS_CONFIG.green.label).toBe("準備完了");
  });

  it("gray label is 未配属", () => {
    expect(COMPLETENESS_CONFIG.gray.label).toBe("未配属");
  });
});

describe("FIELD_LABELS", () => {
  it("contains labels for all required employee fields", () => {
    expect(FIELD_LABELS["fullName"]).toBe("氏名");
    expect(FIELD_LABELS["katakanaName"]).toBe("カナ");
    expect(FIELD_LABELS["nationality"]).toBe("国籍");
    expect(FIELD_LABELS["gender"]).toBe("性別");
    expect(FIELD_LABELS["birthDate"]).toBe("生年月日");
  });

  it("contains labels for all required factory fields", () => {
    expect(FIELD_LABELS["supervisorName"]).toBe("指揮命令者");
    expect(FIELD_LABELS["hakensakiManagerName"]).toBe("派遣先責任者");
    expect(FIELD_LABELS["managerUnsName"]).toBe("派遣元責任者");
    expect(FIELD_LABELS["workHours"]).toBe("就業時間");
    expect(FIELD_LABELS["conflictDate"]).toBe("抵触日");
  });

  it("has billingRate|hourlyRate combo label", () => {
    expect(FIELD_LABELS["billingRate|hourlyRate"]).toBe("単価/時給");
  });
});
