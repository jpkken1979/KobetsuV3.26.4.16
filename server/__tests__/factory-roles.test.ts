import { describe, it, expect } from "vitest";
import { detectSharedRoles } from "../services/factory-roles.js";

// Helper to build a line with all role fields
function makeLine(
  id: number,
  lineName: string,
  department: string,
  overrides: Partial<Record<string, string | null>> = {}
) {
  return {
    id,
    lineName,
    department,
    hakensakiManagerName: "田中",
    hakensakiManagerDept: "営業",
    hakensakiManagerPhone: "090",
    complaintClientName: "山田",
    complaintClientDept: "人事",
    complaintClientPhone: "080",
    complaintUnsName: "中山",
    complaintUnsDept: "営業部",
    complaintUnsPhone: "052",
    complaintUnsAddress: null,
    managerUnsName: "景森",
    managerUnsDept: "岡山",
    managerUnsPhone: "086",
    managerUnsAddress: "岡山県...",
    ...overrides,
  };
}

describe("factory-roles", () => {
  describe("detectSharedRoles", () => {
    it("detects all shared when all lines have same values", () => {
      const lines = [
        makeLine(1, "A", "製作課"),
        makeLine(2, "B", "製作課"),
      ];
      const result = detectSharedRoles(lines);
      expect(result.hakensakiManager.shared).toBe(true);
      expect(result.complaintClient.shared).toBe(true);
      expect(result.complaintUns.shared).toBe(true);
      expect(result.managerUns.shared).toBe(true);
      expect(result.hakensakiManager.overrides).toHaveLength(0);
    });

    it("detects override when one line differs (リフト作業 pattern)", () => {
      const lines = [
        makeLine(1, "Aライン", "製作課"),
        makeLine(2, "Bライン", "製作課"),
        makeLine(3, "リフト作業", "営業本部", {
          hakensakiManagerName: "安藤",
        }),
      ];
      const result = detectSharedRoles(lines);
      // hakensakiManager differs for リフト
      expect(result.hakensakiManager.shared).toBe(false);
      expect(result.hakensakiManager.majority.name).toBe("田中");
      expect(result.hakensakiManager.overrides).toHaveLength(1);
      expect(result.hakensakiManager.overrides[0].lineId).toBe(3);
      expect(result.hakensakiManager.overrides[0].lineName).toBe("リフト作業");
      expect(result.hakensakiManager.overrides[0].value.name).toBe("安藤");
      // Other roles still shared
      expect(result.complaintClient.shared).toBe(true);
      expect(result.complaintUns.shared).toBe(true);
      expect(result.managerUns.shared).toBe(true);
    });

    it("handles single line (always shared)", () => {
      const lines = [makeLine(1, "A", "製作課")];
      const result = detectSharedRoles(lines);
      expect(result.hakensakiManager.shared).toBe(true);
      expect(result.hakensakiManager.overrides).toHaveLength(0);
    });

    it("majority is the most common value, not first (海南第二 pattern)", () => {
      const lines = [
        makeLine(1, "品証課", "品証課", { hakensakiManagerName: "副部長 服部" }),
        makeLine(2, "営業", "営業", { hakensakiManagerName: "部長 金沢" }),
        makeLine(3, "P研磨", "製作課", { hakensakiManagerName: "工場長 鬼頭" }),
        makeLine(4, "W研磨", "製作課", { hakensakiManagerName: "工場長 鬼頭" }),
        makeLine(5, "ト精密", "製作課", { hakensakiManagerName: "工場長 鬼頭" }),
        makeLine(6, "組立", "製作課", { hakensakiManagerName: "工場長 鬼頭" }),
      ];
      const result = detectSharedRoles(lines);
      // 鬼頭 appears 4 times (majority), 服部 and 金沢 are overrides
      expect(result.hakensakiManager.shared).toBe(false);
      expect(result.hakensakiManager.majority.name).toBe("工場長 鬼頭");
      expect(result.hakensakiManager.overrides).toHaveLength(2);
      expect(result.hakensakiManager.overrides.map((o) => o.lineId)).toEqual([1, 2]);
    });

    it("includes address fields for UNS roles", () => {
      const lines = [
        makeLine(1, "A", "製作課", {
          complaintUnsAddress: "名古屋市",
          managerUnsAddress: "岡山県",
        }),
      ];
      const result = detectSharedRoles(lines);
      expect(result.complaintUns.majority.address).toBe("名古屋市");
      expect(result.managerUns.majority.address).toBe("岡山県");
      // hakensakiManager and complaintClient should NOT have address
      expect(result.hakensakiManager.majority.address).toBeUndefined();
      expect(result.complaintClient.majority.address).toBeUndefined();
    });

    it("treats null and undefined consistently", () => {
      const lines = [
        makeLine(1, "A", "製作課", { managerUnsAddress: null }),
        makeLine(2, "B", "製作課", { managerUnsAddress: null }),
      ];
      const result = detectSharedRoles(lines);
      expect(result.managerUns.shared).toBe(true);
      expect(result.managerUns.majority.address).toBeNull();
    });
  });
});
