/**
 * Tests for koritsu-pdf-parser — parseHaizokusaki + parseKoritsuPdfText
 *
 * Source: server/services/koritsu-pdf-parser.ts
 *
 * parseHaizokusaki: decomposes composite 配属先 strings from DBGenzaiX Excel
 *   "本社工場製造1課1工区1班" → { factoryName, department, lineName }
 *
 * parseKoritsuPdfText: extracts supervisor/commander data from Koritsu's
 *   annual PDF (派遣先責任者・指揮命令者一覧)
 *   Uses REAL scrambled text from pdf-parse (column-by-column extraction).
 */
import { describe, it, expect } from "vitest";
import { parseHaizokusaki } from "../services/haizokusaki-parser.js";
import { parseKoritsuPdfText } from "../services/koritsu-pdf-parser.js";

// ─── parseHaizokusaki ────────────────────────────────────────────────────────

describe("parseHaizokusaki", () => {
  it("parses 本社工場 composite string", () => {
    const result = parseHaizokusaki("本社工場製造1課1工区1班");
    expect(result).toEqual({
      factoryName: "本社工場",
      department: "製造1課",
      lineName: "1工区",
    });
  });

  it("parses 本社工場 with different numbers", () => {
    const result = parseHaizokusaki("本社工場製造2課3工区6班");
    expect(result).toEqual({
      factoryName: "本社工場",
      department: "製造2課",
      lineName: "3工区",
    });
  });

  it("parses 州の崎工場", () => {
    const result = parseHaizokusaki("州の崎工場製造1課1工区1班");
    expect(result).toEqual({
      factoryName: "州の崎工場",
      department: "製造1課",
      lineName: "1工区",
    });
  });

  it("parses 州の崎工場 with different department/line", () => {
    const result = parseHaizokusaki("州の崎工場製造3課5工区6班");
    expect(result).toEqual({
      factoryName: "州の崎工場",
      department: "製造3課",
      lineName: "5工区",
    });
  });

  it("parses 乙川工場", () => {
    const result = parseHaizokusaki("乙川工場製造3課5工区7班");
    expect(result).toEqual({
      factoryName: "乙川工場",
      department: "製造3課",
      lineName: "5工区",
    });
  });

  it("parses 乙川工場 with 6工区", () => {
    const result = parseHaizokusaki("乙川工場製造3課6工区8班");
    expect(result).toEqual({
      factoryName: "乙川工場",
      department: "製造3課",
      lineName: "6工区",
    });
  });

  it("parses 亀崎工場", () => {
    const result = parseHaizokusaki("亀崎工場製造5課6工区8班");
    expect(result).toEqual({
      factoryName: "亀崎工場",
      department: "製造5課",
      lineName: "6工区",
    });
  });

  it("parses 亀崎工場 with 7工区", () => {
    const result = parseHaizokusaki("亀崎工場製造5課7工区9班");
    expect(result).toEqual({
      factoryName: "亀崎工場",
      department: "製造5課",
      lineName: "7工区",
    });
  });

  it("handles full-width numbers (３班 → 3班)", () => {
    const result = parseHaizokusaki("州の崎工場製造2課2工区３班");
    expect(result).toEqual({
      factoryName: "州の崎工場",
      department: "製造2課",
      lineName: "2工区",
    });
  });

  it("handles full-width in all positions", () => {
    // All full-width: ５課７工区９班
    const result = parseHaizokusaki("亀崎工場製造５課７工区９班");
    expect(result).toEqual({
      factoryName: "亀崎工場",
      department: "製造5課",
      lineName: "7工区",
    });
  });

  it("returns null for empty string", () => {
    expect(parseHaizokusaki("")).toBeNull();
  });

  it("returns null for '0'", () => {
    expect(parseHaizokusaki("0")).toBeNull();
  });

  it("returns null for '-'", () => {
    expect(parseHaizokusaki("-")).toBeNull();
  });

  it("returns null for 'ー'", () => {
    expect(parseHaizokusaki("ー")).toBeNull();
  });

  it("returns null for non-matching string", () => {
    expect(parseHaizokusaki("本社事務所")).toBeNull();
    expect(parseHaizokusaki("何か別の部署")).toBeNull();
  });

  it("strips leading/trailing whitespace", () => {
    const result = parseHaizokusaki("  本社工場製造1課1工区1班  ");
    expect(result).toEqual({
      factoryName: "本社工場",
      department: "製造1課",
      lineName: "1工区",
    });
  });
});

// ─── parseKoritsuPdfText ─────────────────────────────────────────────────────

// REAL scrambled text from pdf-parse (column-by-column extraction from Koritsu PDF)
const REAL_PDF_TEXT = `工 場 電話番号
１ 工 区 濵崎 純平 工長
２ 工 区 赤崎 龍 工長
製造２課 佐々木 大介 ３ 工 区 皆倉 真理 工長
５ 工 区 長谷川 知宏 工長
６ 工 区 田﨑 康孝 工長
7 工 区 中村 祐太 工長
品質係（本社） 上瀧 伸治 係長 0566-21-5128
品質係（乙川） 松本 剛 係長 0569-47-6731
工務係（本社） 杉浦 弘樹 係長 0566-21-5132
工務係（乙川） 石川 佑治 係長 0569-47-6731
製造１課 本多 孝博 １ 工 区 小谷 伸一 工長
２ 工 区 鳥居 英司 工長
３ 工 区 堀川 義人 工長
製造３課 船附 秀平 ５ 工 区 山田 真樹 工長
6 工 区 伊藤 貴司 工長
7 工 区 滝川 隆 工長
品質係（州の崎） 0569-20-0332
品質係（亀崎） 0569-29-3772
工務係（州の崎） 牧野 孝太郎 係長 0569-20-0331
工務係（亀崎） 小野 智人 係長 0569-29-3772
業務部 営 業 課 古澤 靖之 営 業 係 古澤 靖之 （兼任） 0569-21-5130
経営企画係（本社） 0566-21-5139
経営企画係（州の崎） 0569-20-0332
経営企画係（亀崎） 0569-29-3771
経営企画係（乙川） 0569-47-6731
経営企画係（親和寮） 0566-22-3173
財務部 経 理 課 池場 友祐 経 理 係 池場 友祐 （兼任） 0566-21-5139
本社工場
州の崎工場
亀崎工場
乙川工場
親和寮
通 常
３組２交替
時 間 外 特別条項
1日：7 時間、1ヶ月： 42 時間、1年：320 時間以内 1日： 8 時間、1ヶ月： 80 時間、1年：720 時間以内
1日：5 時間、1ヶ月： 42 時間、1年：320 時間以内 1日：10 時間、1ヶ月： 50 時間、1年：552 時間以内
住所
〒448-0813 刈谷市小垣江町本郷下３３番地３
〒475-0021 半田市州の崎町２番１７１
〒475-0026 半田市亀崎新田町５丁目１３番地１
〒475-0806 半田市古浜町９１番地
〒448-0813 刈谷市小垣江町古浜田５８番地
経
営
企
画
部
経営企画課 満留 正和 杉浦 紀子 係長
苦情申出先（派遣先） 財務部 リスク管理課．課長 大場 明宏
ＴＥＬ ： 0566-21-5139 、 ＦＡＸ ： 0566-24-7470
0569-29-3771
品 質 課 古川 市朗 渡部 浩司 係長
工 務 課 池田 司
品 質 課 服部 篤実
工 務 課 石川 寛明
州
の
崎
工
場
0569-20-0332	製造２課 坪井 友和
製造５課
（亀崎工場） 奥村 維久
派遣先責任者・指揮命令者一覧 【2025年 4月】
派遣先責任者（課長） 指揮命令者（工・係長）
本
社
工
場
製造１課 冨田 正志 0566-21-5128
製造３課
（乙川工場） 岡原 祐介 0569-47-6731`;

describe("parseKoritsuPdfText", () => {
  it("extracts period", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    expect(result.period).toBe("2025年 4月");
  });

  it("extracts reasonable number of factory entries (>=18)", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    expect(result.factories.length).toBeGreaterThanOrEqual(18);
  });

  // ── 本社工場 entries ──

  it("extracts 本社工場 製造1課 1工区 with correct supervisor", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    const entry = result.factories.find(
      (f) => f.factoryName === "本社工場" && f.department === "製造1課" && f.lineName === "1工区",
    );
    expect(entry).toBeDefined();
    expect(entry!.hakensakiManagerName).toBe("冨田 正志");
    expect(entry!.supervisorName).toBe("濵崎 純平");
    expect(entry!.phone).toBe("0566-21-5128");
  });

  it("extracts 本社工場 製造1課 2工区 (continuation under same department)", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    const entry = result.factories.find(
      (f) => f.factoryName === "本社工場" && f.department === "製造1課" && f.lineName === "2工区",
    );
    expect(entry).toBeDefined();
    expect(entry!.hakensakiManagerName).toBe("冨田 正志");
    expect(entry!.supervisorName).toBe("赤崎 龍");
  });

  it("extracts 本社工場 製造2課 3工区", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    const entry = result.factories.find(
      (f) => f.factoryName === "本社工場" && f.department === "製造2課" && f.lineName === "3工区",
    );
    expect(entry).toBeDefined();
    expect(entry!.hakensakiManagerName).toBe("佐々木 大介");
    expect(entry!.supervisorName).toBe("皆倉 真理");
  });

  // ── 乙川工場 entries (from 製造3課（乙川工場）) ──

  it("maps 乙川工場 5工区 with correct manager and supervisor", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    const entry = result.factories.find(
      (f) => f.factoryName === "乙川工場" && f.lineName === "5工区",
    );
    expect(entry).toBeDefined();
    expect(entry!.department).toBe("製造3課");
    expect(entry!.hakensakiManagerName).toBe("岡原 祐介");
    expect(entry!.supervisorName).toBe("長谷川 知宏");
    expect(entry!.phone).toBe("0569-47-6731");
  });

  it("maps 乙川工場 6工区 and 7工区", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    const entry6 = result.factories.find(
      (f) => f.factoryName === "乙川工場" && f.lineName === "6工区",
    );
    const entry7 = result.factories.find(
      (f) => f.factoryName === "乙川工場" && f.lineName === "7工区",
    );
    expect(entry6).toBeDefined();
    expect(entry6!.supervisorName).toBe("田﨑 康孝");
    expect(entry7).toBeDefined();
    expect(entry7!.supervisorName).toBe("中村 祐太");
  });

  // ── 本社工場 係 entries ──

  it("maps 品質係（本社） to factoryName='本社工場'", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    const entry = result.factories.find(
      (f) => f.factoryName === "本社工場" && f.lineName === "品質係（本社）",
    );
    expect(entry).toBeDefined();
    expect(entry!.department).toBe("品質課");
    expect(entry!.hakensakiManagerName).toBe("服部 篤実");
    expect(entry!.supervisorName).toBe("上瀧 伸治");
    expect(entry!.phone).toBe("0566-21-5128");
  });

  it("maps 品質係（乙川） to factoryName='乙川工場'", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    const entry = result.factories.find(
      (f) => f.factoryName === "乙川工場" && f.lineName === "品質係（乙川）",
    );
    expect(entry).toBeDefined();
    expect(entry!.department).toBe("品質課");
    expect(entry!.hakensakiManagerName).toBe("服部 篤実");
    expect(entry!.supervisorName).toBe("松本 剛");
  });

  it("maps 工務係（本社） and 工務係（乙川）", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    const honsha = result.factories.find(
      (f) => f.factoryName === "本社工場" && f.lineName === "工務係（本社）",
    );
    const otogawa = result.factories.find(
      (f) => f.factoryName === "乙川工場" && f.lineName === "工務係（乙川）",
    );
    expect(honsha).toBeDefined();
    expect(honsha!.hakensakiManagerName).toBe("石川 寛明");
    expect(honsha!.supervisorName).toBe("杉浦 弘樹");
    expect(otogawa).toBeDefined();
    expect(otogawa!.hakensakiManagerName).toBe("石川 寛明");
    expect(otogawa!.supervisorName).toBe("石川 佑治");
  });

  // ── 州の崎工場 entries ──

  it("extracts 州の崎工場 製造1課 1工区", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    const entry = result.factories.find(
      (f) => f.factoryName === "州の崎工場" && f.department === "製造1課" && f.lineName === "1工区",
    );
    expect(entry).toBeDefined();
    expect(entry!.hakensakiManagerName).toBe("本多 孝博");
    expect(entry!.supervisorName).toBe("小谷 伸一");
    expect(entry!.phone).toBe("0569-20-0332");
  });

  it("extracts 州の崎工場 製造2課 with 2工区 and 3工区", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    const entry2 = result.factories.find(
      (f) => f.factoryName === "州の崎工場" && f.department === "製造2課" && f.lineName === "2工区",
    );
    const entry3 = result.factories.find(
      (f) => f.factoryName === "州の崎工場" && f.department === "製造2課" && f.lineName === "3工区",
    );
    expect(entry2).toBeDefined();
    expect(entry2!.hakensakiManagerName).toBe("坪井 友和");
    expect(entry2!.supervisorName).toBe("鳥居 英司");
    expect(entry3).toBeDefined();
    expect(entry3!.supervisorName).toBe("堀川 義人");
  });

  it("extracts 州の崎工場 製造3課 5工区", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    const entry = result.factories.find(
      (f) => f.factoryName === "州の崎工場" && f.department === "製造3課" && f.lineName === "5工区",
    );
    expect(entry).toBeDefined();
    expect(entry!.hakensakiManagerName).toBe("船附 秀平");
    expect(entry!.supervisorName).toBe("山田 真樹");
  });

  // ── 亀崎工場 entries (from 製造5課（亀崎工場）) ──

  it("maps 製造5課（亀崎工場） to factoryName='亀崎工場'", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    const entry6 = result.factories.find(
      (f) => f.factoryName === "亀崎工場" && f.lineName === "6工区",
    );
    const entry7 = result.factories.find(
      (f) => f.factoryName === "亀崎工場" && f.lineName === "7工区",
    );
    expect(entry6).toBeDefined();
    expect(entry6!.department).toBe("製造5課");
    expect(entry6!.hakensakiManagerName).toBe("奥村 維久");
    expect(entry6!.supervisorName).toBe("伊藤 貴司");
    expect(entry6!.phone).toBe("0569-29-3771");
    expect(entry7).toBeDefined();
    expect(entry7!.supervisorName).toBe("滝川 隆");
  });

  // ── 州の崎 係 entries ──

  it("extracts 品質係（州の崎） with phone only (no supervisor in real text)", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    const entry = result.factories.find(
      (f) => f.factoryName === "州の崎工場" && f.lineName === "品質係（州の崎）",
    );
    expect(entry).toBeDefined();
    expect(entry!.department).toBe("品質課");
    expect(entry!.hakensakiManagerName).toBe("古川 市朗");
    expect(entry!.phone).toBe("0569-20-0332");
  });

  it("extracts 品質係（亀崎） with phone only (no supervisor name)", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    const entry = result.factories.find(
      (f) => f.factoryName === "亀崎工場" && f.lineName === "品質係（亀崎）",
    );
    expect(entry).toBeDefined();
    expect(entry!.supervisorName).toBeNull();
    expect(entry!.phone).toBe("0569-29-3772");
  });

  it("extracts 工務係（州の崎） with supervisor", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    const entry = result.factories.find(
      (f) => f.factoryName === "州の崎工場" && f.lineName === "工務係（州の崎）",
    );
    expect(entry).toBeDefined();
    expect(entry!.hakensakiManagerName).toBe("池田 司");
    expect(entry!.supervisorName).toBe("牧野 孝太郎");
  });

  it("extracts 工務係（亀崎） with supervisor", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    const entry = result.factories.find(
      (f) => f.factoryName === "亀崎工場" && f.lineName === "工務係（亀崎）",
    );
    expect(entry).toBeDefined();
    expect(entry!.supervisorName).toBe("小野 智人");
  });

  // ── Addresses ──

  it("extracts all 5 addresses", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    expect(Object.keys(result.addresses)).toHaveLength(5);
    expect(result.addresses["本社工場"]).toContain("刈谷市");
    expect(result.addresses["州の崎工場"]).toContain("半田市");
    expect(result.addresses["亀崎工場"]).toContain("半田市");
    expect(result.addresses["乙川工場"]).toContain("半田市");
    expect(result.addresses["親和寮"]).toContain("刈谷市");
  });

  it("addresses include postal codes", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    expect(result.addresses["本社工場"]).toMatch(/^〒\d{3}-\d{4}/);
    expect(result.addresses["亀崎工場"]).toMatch(/^〒\d{3}-\d{4}/);
  });

  // ── Complaint handler ──

  it("extracts complaint handler name", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    expect(result.complaint.name).toBe("大場 明宏");
  });

  it("extracts complaint handler department", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    expect(result.complaint.dept).toContain("リスク管理課");
  });

  it("extracts complaint handler phone and fax", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    expect(result.complaint.phone).toBe("0566-21-5139");
    expect(result.complaint.fax).toBe("0566-24-7470");
  });

  // ── Edge cases ──

  it("handles empty text", () => {
    const result = parseKoritsuPdfText("");
    expect(result.factories).toHaveLength(0);
    expect(result.period).toBe("");
    expect(Object.keys(result.addresses)).toHaveLength(0);
  });

  it("handles text with only period", () => {
    const result = parseKoritsuPdfText("【2025年 4月】");
    expect(result.period).toBe("2025年 4月");
    expect(result.factories).toHaveLength(0);
  });

  // ── Verify all 4 factory names appear ──

  it("contains entries for all 4 factories", () => {
    const result = parseKoritsuPdfText(REAL_PDF_TEXT);
    const factoryNames = new Set(result.factories.map((f) => f.factoryName));
    expect(factoryNames.has("本社工場")).toBe(true);
    expect(factoryNames.has("州の崎工場")).toBe(true);
    expect(factoryNames.has("乙川工場")).toBe(true);
    expect(factoryNames.has("亀崎工場")).toBe(true);
  });
});
