import { describe, it, expect } from "vitest";
import { queryKeys } from "../query-keys";

describe("queryKeys", () => {
  it("companies has all, detail", () => {
    expect(queryKeys.companies.all).toEqual(["companies"]);
    expect(queryKeys.companies.detail(1)).toEqual(["companies", 1]);
  });

  it("employees has all (function), detail, invalidateAll", () => {
    expect(queryKeys.employees.all()).toEqual(["employees", undefined]);
    expect(queryKeys.employees.all({ companyId: 2 })).toEqual(["employees", { companyId: 2 }]);
    expect(queryKeys.employees.detail(7)).toEqual(["employees", 7]);
    expect(queryKeys.employees.invalidateAll).toEqual(["employees"]);
  });

  it("contracts has all (function), detail, invalidateAll", () => {
    expect(queryKeys.contracts.all()).toEqual(["contracts", undefined]);
    expect(queryKeys.contracts.detail(5)).toEqual(["contracts", 5]);
    expect(queryKeys.contracts.invalidateAll).toEqual(["contracts"]);
  });

  it("factories has all (function), cascade, invalidateAll", () => {
    expect(queryKeys.factories.all()).toEqual(["factories", undefined]);
    expect(queryKeys.factories.cascade(3)).toEqual(["factories", "cascade", 3]);
    expect(queryKeys.factories.invalidateAll).toEqual(["factories"]);
  });

  it("dataCheck has all, byCompany, invalidateAll", () => {
    expect(queryKeys.dataCheck.all).toEqual(["dataCheck"]);
    expect(queryKeys.dataCheck.byCompany(3)).toEqual(["dataCheck", 3]);
    expect(queryKeys.dataCheck.invalidateAll).toEqual(["dataCheck"]);
  });

  it("dashboard has stats, invalidateAll", () => {
    expect(queryKeys.dashboard.stats(30)).toEqual(["dashboard", "stats", 30]);
    expect(queryKeys.dashboard.invalidateAll).toEqual(["dashboard"]);
  });

  it("all static keys are arrays", () => {
    expect(Array.isArray(queryKeys.companies.all)).toBe(true);
    expect(Array.isArray(queryKeys.dataCheck.all)).toBe(true);
    expect(Array.isArray(queryKeys.documents.all)).toBe(true);
    expect(Array.isArray(queryKeys.shiftTemplates.all)).toBe(true);
  });
});
