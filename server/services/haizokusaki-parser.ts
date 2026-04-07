/**
 * Haizokusaki Parser — decomposes composite 配属先 strings from DBGenzaiX Excel.
 *
 * Examples:
 *   "本社工場製造1課1工区1班" → { factoryName: "本社工場", department: "製造1課", lineName: "1工区" }
 *   "州の崎工場製造2課2工区３班" → { factoryName: "州の崎工場", department: "製造2課", lineName: "2工区" }
 *   "亀崎工場製造5課6工区8班" → { factoryName: "亀崎工場", department: "製造5課", lineName: "6工区" }
 */
import { normalizeWidth } from "./import-utils.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HaizokusakiResult {
  factoryName: string;
  department: string;
  lineName: string;
}

// ─── parseHaizokusaki ────────────────────────────────────────────────────────

/**
 * Parse the composite 配属先 string from DBGenzaiX Excel.
 *
 * Examples:
 *   "本社工場製造1課1工区1班" → { factoryName: "本社工場", department: "製造1課", lineName: "1工区" }
 *   "州の崎工場製造2課2工区３班" → { factoryName: "州の崎工場", department: "製造2課", lineName: "2工区" }
 *   "亀崎工場製造5課6工区8班" → { factoryName: "亀崎工場", department: "製造5課", lineName: "6工区" }
 *
 * Returns null for empty/invalid input.
 */
export function parseHaizokusaki(raw: string): HaizokusakiResult | null {
  if (!raw || raw === "0" || raw === "-" || raw === "ー") return null;

  const s = normalizeWidth(raw.trim());

  // Pattern: {factoryName ending in 工場}{製造N課}{N工区}{optional N班}
  const m = s.match(/^(.+?工場)(製造\d+課)(\d+工区)(?:\d+班)?$/);
  if (m) {
    return { factoryName: m[1], department: m[2], lineName: m[3] };
  }

  return null;
}
