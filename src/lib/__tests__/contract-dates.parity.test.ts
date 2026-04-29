/**
 * Parity test entre src/lib/contract-dates.ts (cliente, preview UI) y
 * server/services/contract-dates.ts (servidor, persistencia).
 *
 * CLAUDE.md marca el cliente como "espejo parcial" del servidor. Si las dos
 * implementaciones divergen, el preview que ve el usuario en el wizard NO
 * coincide con la fecha que termina en la DB → bug silencioso difícil de cazar.
 *
 * Cubre 20 fechas representativas:
 *  - Lunes/miércoles normales
 *  - Viernes (cuando contractDate=miércoles, notificationDate=martes)
 *  - Cerca de fin de semana
 *  - Cierres del año (年末年始: 12/29-31 + 1/1-3)
 *  - Golden Week (4/29 + 5/3-6)
 *  - お盆 (8/13-16)
 *  - Año bisiesto (29/Feb)
 *  - Fin/inicio de mes
 */
import { describe, it, expect } from "vitest";
import { calculateContractDates as clientCalc } from "../contract-dates.js";
import {
  calculateContractDate as serverContractDate,
  calculateNotificationDate as serverNotifDate,
} from "@server/services/contract-dates.js";

const REPRESENTATIVE_START_DATES = [
  // Días normales
  "2026-04-15", // Wed
  "2026-04-13", // Mon
  "2026-04-17", // Fri
  "2026-04-20", // Mon — el viernes anterior + 2 días
  "2026-06-10",
  "2026-07-22",

  // Cierres: 年末年始
  "2026-01-05", // Mon — primer día hábil después de 1/1-3
  "2026-01-06",
  "2026-01-07",
  "2027-01-04", // Lunes hábil después del cierre

  // Cierres: Golden Week
  "2026-05-07", // Jueves después de 5/3-6
  "2026-05-08",
  "2026-05-11", // Lunes siguiente

  // Cierres: お盆
  "2026-08-17", // Lunes después de 8/13-16
  "2026-08-18",
  "2026-08-19",

  // Borde de cierre 年末年始 al cruzar año
  "2026-12-28", // Lunes — contractDate cae antes del cierre

  // Año bisiesto / cambios de mes
  "2024-03-01", // Vie — el día anterior es 29/Feb (bisiesto)
  "2026-03-02", // Mon — cambio de mes
  "2026-09-01", // Tue
];

describe("contract-dates parity: cliente ↔ servidor", () => {
  for (const startDate of REPRESENTATIVE_START_DATES) {
    it(`${startDate}: contractDate y notificationDate coinciden`, () => {
      const client = clientCalc(startDate);
      const serverContract = serverContractDate(startDate);
      const serverNotif = serverNotifDate(startDate);

      expect(client.contractDate).toBe(serverContract);
      expect(client.notificationDate).toBe(serverNotif);
    });
  }

  it("contractDate siempre cae 2 business days antes de startDate", () => {
    // Spot-check con servidor como ground truth.
    expect(serverContractDate("2026-04-15")).toBe("2026-04-13"); // Wed → Mon
  });

  it("notificationDate siempre cae 3 business days antes de startDate", () => {
    expect(serverNotifDate("2026-04-15")).toBe("2026-04-10"); // Wed → Fri prev
  });

  it("salta お盆 — startDate=2026-08-17 (lunes) → contractDate cruza el cierre", () => {
    // Lunes 17/8. Restar días saltando 16(Dom), 15(Sáb), 14(closure), 13(closure)
    // → 12 (Mié) = 1er día hábil. 11 (Mar) = 2do.
    const result = clientCalc("2026-08-17");
    expect(result.contractDate).toBe("2026-08-11");
    expect(result.contractDate).toBe(serverContractDate("2026-08-17"));
  });

  it("salta GW — startDate=2026-05-07 (jueves) → contractDate cruza GW", () => {
    // Jueves 7/5. Restar 2 días hábiles saltando 3-6/May + 2/May (sábado) + 1/May (viernes laborable) + 30/Abr (jue) + 29/Abr (cierre昭和の日).
    // Días hábiles antes: 1/May (Vie), 30/Abr (Jue), ...
    // 2 days back: 30/Abr.
    const result = clientCalc("2026-05-07");
    expect(result.contractDate).toBe(serverContractDate("2026-05-07"));
  });

  it("salta 年末年始 — startDate=2026-01-05 (lunes) cruza el cierre 12/29-1/3", () => {
    // Lunes 5/1. Días hábiles antes: 26/12 (vie 2025) + 25 + 24...
    // 2 days back: 25/12 (jue 2025).
    const result = clientCalc("2026-01-05");
    expect(result.contractDate).toBe(serverContractDate("2026-01-05"));
    expect(result.notificationDate).toBe(serverNotifDate("2026-01-05"));
  });
});
