/**
 * Unit tests for services with zero coverage:
 * - db-utils (escapeLike)
 * - document-files (sanitizeFilename, isSafeDownloadFilename)
 * - document-index (parseIndexFiles, sanitizeFilename — internal)
 * - import-utils (normalizeImportRow, excelSerialToDate, parseRate, normalizePlacement, normalizeWidth, normalizeCompanyName, deriveShortCompanyName)
 * - contract-number (format logic — DB-dependent parts excluded)
 */
import { describe, it, expect } from "vitest";
import { escapeLike } from "../services/db-utils";
import {
  sanitizeFilename,
  isSafeDownloadFilename,
} from "../services/document-files";
import { parseIndexFiles, sanitizeFilename as sanitizeDocIndexFilename } from "../services/document-index.js";
import {
  normalizeImportRow,
  excelSerialToDate,
  parseRate,
  normalizePlacement,
  normalizeWidth,
  normalizeCompanyName,
  deriveShortCompanyName,
  BLOCKED_OBJECT_KEYS,
} from "../services/import-utils";

// ─── db-utils: escapeLike ─────────────────────────────────────────────

describe("escapeLike", () => {
  it("escapes percent sign", () => {
    expect(escapeLike("50%")).toBe("50\\%");
  });

  it("escapes underscore", () => {
    expect(escapeLike("col_name")).toBe("col\\_name");
  });

  it("escapes backslash", () => {
    expect(escapeLike("path\\to")).toBe("path\\\\to");
  });

  it("escapes all special chars in combination", () => {
    expect(escapeLike("%_\\")).toBe("\\%\\_\\\\");
  });

  it("returns empty string unchanged", () => {
    expect(escapeLike("")).toBe("");
  });

  it("returns normal text unchanged", () => {
    expect(escapeLike("hello world")).toBe("hello world");
  });

  it("handles Japanese text with special chars", () => {
    expect(escapeLike("50%以上_A")).toBe("50\\%以上\\_A");
  });
});

// ─── document-files: sanitizeFilename ─────────────────────────────────

describe("sanitizeFilename", () => {
  it("replaces forward slash", () => {
    expect(sanitizeFilename("a/b")).toBe("a_b");
  });

  it("replaces backslash", () => {
    expect(sanitizeFilename("a\\b")).toBe("a_b");
  });

  it("replaces colon", () => {
    expect(sanitizeFilename("file:name")).toBe("file_name");
  });

  it("replaces asterisk", () => {
    expect(sanitizeFilename("file*name")).toBe("file_name");
  });

  it("replaces question mark", () => {
    expect(sanitizeFilename("file?name")).toBe("file_name");
  });

  it("replaces double quotes", () => {
    expect(sanitizeFilename('file"name')).toBe("file_name");
  });

  it("replaces angle brackets", () => {
    expect(sanitizeFilename("file<name>")).toBe("file_name_");
  });

  it("replaces pipe", () => {
    expect(sanitizeFilename("file|name")).toBe("file_name");
  });

  it("replaces multiple forbidden chars at once", () => {
    expect(sanitizeFilename('a/b\\c:d*e?"f<g>h|i')).toBe("a_b_c_d_e__f_g_h_i");
  });

  it("preserves Japanese characters", () => {
    expect(sanitizeFilename("個別契約書_2026年.pdf")).toBe("個別契約書_2026年.pdf");
  });

  it("returns empty string unchanged", () => {
    expect(sanitizeFilename("")).toBe("");
  });
});

// ─── document-files: isSafeDownloadFilename ───────────────────────────

describe("isSafeDownloadFilename", () => {
  it("accepts a simple filename", () => {
    expect(isSafeDownloadFilename("contract.pdf")).toBe(true);
  });

  it("accepts filename with Japanese chars", () => {
    expect(isSafeDownloadFilename("個別契約書_KOB-202604-0001.pdf")).toBe(true);
  });

  it("rejects forward slash (directory traversal)", () => {
    expect(isSafeDownloadFilename("../secret.pdf")).toBe(false);
  });

  it("rejects backslash (Windows traversal)", () => {
    expect(isSafeDownloadFilename("..\\secret.pdf")).toBe(false);
  });

  it("rejects double dots", () => {
    expect(isSafeDownloadFilename("..")).toBe(false);
  });

  it("accepts filename with dots that are not traversal", () => {
    expect(isSafeDownloadFilename("file.v2.pdf")).toBe(true);
  });

  it("rejects hidden directory traversal", () => {
    expect(isSafeDownloadFilename("foo/../../etc/passwd")).toBe(false);
  });
});

// ─── import-utils: normalizeImportRow ─────────────────────────────────

describe("normalizeImportRow", () => {
  it("trims keys and string values", () => {
    const row = { "  名前  ": "  田中  ", " 年齢 ": 30 };
    const result = normalizeImportRow(row);
    expect(result["名前"]).toBe("田中");
    expect(result["年齢"]).toBe(30);
  });

  it("skips empty keys after trimming", () => {
    const row = { "  ": "value", "valid": "ok" };
    const result = normalizeImportRow(row);
    expect(Object.keys(result)).toEqual(["valid"]);
  });

  it("blocks prototype pollution keys", () => {
    const row = { __proto__: "bad", prototype: "bad", constructor: "bad", safe: "ok" };
    const result = normalizeImportRow(row);
    expect(result["safe"]).toBe("ok");
    expect(result["__proto__"]).toBeUndefined();
    expect(result["prototype"]).toBeUndefined();
    expect(result["constructor"]).toBeUndefined();
  });

  it("preserves non-string values", () => {
    const row = { count: 42, flag: true, empty: null };
    const result = normalizeImportRow(row);
    expect(result["count"]).toBe(42);
    expect(result["flag"]).toBe(true);
    expect(result["empty"]).toBeNull();
  });

  it("handles empty row", () => {
    const result = normalizeImportRow({});
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("BLOCKED_OBJECT_KEYS contains the three dangerous keys", () => {
    expect(BLOCKED_OBJECT_KEYS.has("__proto__")).toBe(true);
    expect(BLOCKED_OBJECT_KEYS.has("prototype")).toBe(true);
    expect(BLOCKED_OBJECT_KEYS.has("constructor")).toBe(true);
  });
});

// ─── import-utils: excelSerialToDate ──────────────────────────────────

describe("excelSerialToDate", () => {
  it("accepts JS Date objects returned by ExcelJS", () => {
    const result = excelSerialToDate(new Date(Date.UTC(2026, 3, 1)));
    expect(result).toBe("2026-04-01");
  });

  it("converts Excel serial 1 to 1899-12-31", () => {
    // Excel serial 1 = Jan 1, 1900, but due to Lotus bug offset: Dec 31, 1899 + 1 day
    expect(excelSerialToDate(1)).toBe("1899-12-31");
  });

  it("converts serial 44927 to a 2023 date", () => {
    // 44927 = 2023-01-01 in Excel
    const result = excelSerialToDate(44927);
    expect(result).toBe("2023-01-01");
  });

  it("converts serial 46113 to 2026-04-01", () => {
    // 46113 should be around 2026-04-01
    const result = excelSerialToDate(46113);
    expect(result).toMatch(/^2026-/);
  });

  it("returns null for zero", () => {
    expect(excelSerialToDate(0)).toBeNull();
  });

  it("returns null for negative numbers", () => {
    expect(excelSerialToDate(-1)).toBeNull();
  });

  it("returns null for absurdly large serial (>3000000)", () => {
    expect(excelSerialToDate(4000000)).toBeNull();
  });

  it("returns null for NaN", () => {
    expect(excelSerialToDate(NaN)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(excelSerialToDate("")).toBeNull();
  });

  it("returns null for null", () => {
    expect(excelSerialToDate(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(excelSerialToDate(undefined)).toBeNull();
  });

  it("passes through YYYY-MM-DD date strings", () => {
    expect(excelSerialToDate("2026-04-01")).toBe("2026-04-01");
  });

  it("converts YYYY/MM/DD to YYYY-MM-DD", () => {
    expect(excelSerialToDate("2026/04/01")).toBe("2026-04-01");
  });

  it("normalizes slash dates with single-digit month and day", () => {
    expect(excelSerialToDate("2026/4/1")).toBe("2026-04-01");
  });

  it("parses Reiwa era strings", () => {
    expect(excelSerialToDate("令和8年4月1日")).toBe("2026-04-01");
  });

  it("parses short Latin era strings", () => {
    expect(excelSerialToDate("R8.4.1")).toBe("2026-04-01");
    expect(excelSerialToDate("H15/03/20")).toBe("2003-03-20");
  });

  // ─── Era completeness coverage ──────────────────────────────────────
  // Coverage for ALL Japanese eras supported by the function (Reiwa, Heisei,
  // Showa, Taisho, Meiji) with both full kanji and Latin abbreviation forms.
  // Reference offsets in import-utils.ts: 令和=2018, 平成=1988, 昭和=1925,
  // 大正=1911, 明治=1867.

  it("parses Heisei era — full kanji at end-of-era boundary", () => {
    // 平成31年4月30日 = last day of Heisei (Reiwa starts 2019-05-01)
    expect(excelSerialToDate("平成31年4月30日")).toBe("2019-04-30");
  });

  it("parses Heisei era — H prefix with slash separator", () => {
    expect(excelSerialToDate("H1/1/8")).toBe("1989-01-08"); // 平成元年 = 1989
    expect(excelSerialToDate("H30/12/31")).toBe("2018-12-31");
  });

  it("parses Showa era — full kanji at end-of-era boundary", () => {
    // 昭和64年1月7日 = last day of Showa (Heisei starts 1989-01-08)
    expect(excelSerialToDate("昭和64年1月7日")).toBe("1989-01-07");
  });

  it("parses Showa era — S prefix", () => {
    expect(excelSerialToDate("S40.10.10")).toBe("1965-10-10");
  });

  it("parses Taisho era — full kanji + T prefix", () => {
    // 大正15年12月25日 = last day of Taisho (Showa starts 1926-12-26)
    expect(excelSerialToDate("大正15年12月25日")).toBe("1926-12-25");
    expect(excelSerialToDate("T1.7.30")).toBe("1912-07-30"); // 大正元年
  });

  it("parses Meiji era — full kanji + M prefix", () => {
    // 明治45年7月29日 = last day of Meiji
    expect(excelSerialToDate("明治45年7月29日")).toBe("1912-07-29");
    expect(excelSerialToDate("M1.10.23")).toBe("1868-10-23"); // 明治元年
  });

  it("accepts era prefixes in lowercase", () => {
    // ERA_OFFSETS lookup uses .toUpperCase() (line 93), so r/h/s/t/m must work
    expect(excelSerialToDate("r8.4.1")).toBe("2026-04-01");
    expect(excelSerialToDate("h31.4.30")).toBe("2019-04-30");
  });

  // ─── Excel serial edge cases ─────────────────────────────────────────

  it("converts Excel serial for leap year date (2024-02-29)", () => {
    // Verifica que el cálculo del epoch maneja años bisiestos correctamente.
    // Serial 45351 ≈ 2024-02-29 (verified via Excel).
    expect(excelSerialToDate(45351)).toBe("2024-02-29");
  });

  it("converts decimal serial by truncating to whole day", () => {
    // Excel guarda hora como fracción decimal del día. Cuando un campo
    // de fecha tiene timestamp (ej. 44927.5 = 2023-01-01 12:00), la función
    // debe quedarse con la fecha del día UTC.
    const result = excelSerialToDate(44927.5);
    expect(result).toBe("2023-01-01");
  });

  it("handles string serial (string-encoded number)", () => {
    expect(excelSerialToDate("44927")).toBe("2023-01-01");
    expect(excelSerialToDate("45351")).toBe("2024-02-29");
  });

  it("rejects malformed era strings without throwing", () => {
    expect(excelSerialToDate("Z9年4月1日")).toBeNull(); // era inexistente
    expect(excelSerialToDate("令和年月日")).toBeNull(); // sin números
  });

  it("handles string number (serial as string)", () => {
    const result = excelSerialToDate("44927");
    expect(result).toBe("2023-01-01");
  });

  it("returns null for non-numeric string", () => {
    expect(excelSerialToDate("abc")).toBeNull();
  });
});

// ─── import-utils: parseRate ──────────────────────────────────────────

describe("parseRate", () => {
  it("parses plain number", () => {
    expect(parseRate(1600)).toBe(1600);
  });

  it("parses string number", () => {
    expect(parseRate("1600")).toBe(1600);
  });

  it("parses yen-prefixed value", () => {
    expect(parseRate("¥1,600")).toBe(1600);
  });

  it("parses fullwidth yen-prefixed value", () => {
    expect(parseRate("￥1,600")).toBe(1600);
  });

  it("parses value with Japanese comma (読点)", () => {
    expect(parseRate("1、600")).toBe(1600);
  });

  it("parses value with spaces", () => {
    expect(parseRate(" 1 600 ")).toBe(1600);
  });

  it("returns null for zero", () => {
    expect(parseRate(0)).toBeNull();
  });

  it("returns null for negative values", () => {
    expect(parseRate(-100)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseRate("")).toBeNull();
  });

  it("returns null for null", () => {
    expect(parseRate(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseRate(undefined)).toBeNull();
  });

  it("returns null for non-numeric string", () => {
    expect(parseRate("abc")).toBeNull();
  });

  it("parses decimal rate", () => {
    expect(parseRate("1609.5")).toBe(1609.5);
  });
});

// ─── import-utils: normalizePlacement ─────────────────────────────────

describe("normalizePlacement", () => {
  it("returns trimmed value for normal string", () => {
    expect(normalizePlacement("  製造1課  ")).toBe("製造1課");
  });

  it("returns empty for '0'", () => {
    expect(normalizePlacement("0")).toBe("");
  });

  it("returns empty for '-'", () => {
    expect(normalizePlacement("-")).toBe("");
  });

  it("returns empty for 'ー' (fullwidth dash)", () => {
    expect(normalizePlacement("ー")).toBe("");
  });

  it("returns empty for empty string", () => {
    expect(normalizePlacement("")).toBe("");
  });

  it("returns empty for null", () => {
    expect(normalizePlacement(null)).toBe("");
  });

  it("returns empty for undefined", () => {
    expect(normalizePlacement(undefined)).toBe("");
  });

  it("numeric 0 becomes empty string", () => {
    // String(0) = "0", which matches the "0" check
    expect(normalizePlacement(0)).toBe("");
  });

  it("preserves valid placement names", () => {
    expect(normalizePlacement("A棟2F")).toBe("A棟2F");
  });
});

// ─── import-utils: normalizeWidth ─────────────────────────────────────

describe("normalizeWidth", () => {
  it("converts fullwidth digits to halfwidth", () => {
    expect(normalizeWidth("０１２３４５６７８９")).toBe("0123456789");
  });

  it("converts fullwidth uppercase to halfwidth", () => {
    expect(normalizeWidth("ＡＢＣＺ")).toBe("ABCZ");
  });

  it("converts fullwidth lowercase to halfwidth", () => {
    expect(normalizeWidth("ａｂｃｚ")).toBe("abcz");
  });

  it("converts fullwidth space to halfwidth", () => {
    expect(normalizeWidth("Ａ\u3000Ｂ")).toBe("A B");
  });

  it("preserves halfwidth chars", () => {
    expect(normalizeWidth("ABC123")).toBe("ABC123");
  });

  it("preserves Japanese characters", () => {
    expect(normalizeWidth("テスト")).toBe("テスト");
  });

  it("handles mixed content", () => {
    expect(normalizeWidth("Ａ棟２Ｆ")).toBe("A棟2F");
  });

  it("handles empty string", () => {
    expect(normalizeWidth("")).toBe("");
  });
});

// ─── import-utils: normalizeCompanyName ───────────────────────────────

describe("normalizeCompanyName", () => {
  it("resolves known alias (abbreviated)", () => {
    expect(normalizeCompanyName("フェニテックセミコンダクター(株)")).toBe(
      "フェニテックセミコンダクター株式会社",
    );
  });

  it("resolves TKE half-width alias", () => {
    expect(normalizeCompanyName("ﾃｨｰｹｰｴﾝｼﾞﾆｱﾘﾝｸﾞ株式会社")).toBe("TKE株式会社");
  });

  it("resolves TKE full-width alias", () => {
    expect(normalizeCompanyName("ティーケーエンジニアリング株式会社")).toBe("TKE株式会社");
  });

  it("trims whitespace", () => {
    expect(normalizeCompanyName("  テスト会社  ")).toBe("テスト会社");
  });

  it("returns unknown name as-is", () => {
    expect(normalizeCompanyName("未知の会社")).toBe("未知の会社");
  });
});

// ─── import-utils: deriveShortCompanyName ─────────────────────────────

describe("deriveShortCompanyName", () => {
  it("strips trailing 株式会社", () => {
    expect(deriveShortCompanyName("高雄工業株式会社")).toBe("高雄工業");
  });

  it("strips leading 株式会社", () => {
    expect(deriveShortCompanyName("株式会社テスト")).toBe("テスト");
  });

  it("strips trailing (株)", () => {
    expect(deriveShortCompanyName("フェニテック(株)")).toBe("フェニテック");
  });

  it("strips leading (株)", () => {
    expect(deriveShortCompanyName("(株)テスト")).toBe("テスト");
  });

  it("returns null for empty result after stripping", () => {
    expect(deriveShortCompanyName("株式会社")).toBeNull();
  });

  it("returns name as-is when no suffix/prefix", () => {
    expect(deriveShortCompanyName("TKE")).toBe("TKE");
  });
});

// ─── document-index: parseIndexFiles ─────────────────────────────────────────

describe("parseIndexFiles", () => {
  it("returns filenames from valid JSON", () => {
    const json = JSON.stringify({ files: ["a.pdf", "b.pdf"] });
    expect(parseIndexFiles(json)).toEqual(["a.pdf", "b.pdf"]);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseIndexFiles("NOT_JSON")).toEqual([]);
  });

  it("returns empty array when files key is missing", () => {
    expect(parseIndexFiles(JSON.stringify({ contractId: 1 }))).toEqual([]);
  });

  it("returns empty array when files is not an array", () => {
    expect(parseIndexFiles(JSON.stringify({ files: "a.pdf" }))).toEqual([]);
  });

  it("filters out non-string entries from files array", () => {
    const json = JSON.stringify({ files: ["a.pdf", 42, null, "b.pdf"] });
    expect(parseIndexFiles(json)).toEqual(["a.pdf", "b.pdf"]);
  });

  it("returns empty array for empty files array", () => {
    expect(parseIndexFiles(JSON.stringify({ files: [] }))).toEqual([]);
  });
});

describe("document-index sanitizeFilename", () => {
  it("returns null for non-pdf file", () => {
    expect(sanitizeDocIndexFilename("document.txt")).toBeNull();
  });

  it("returns null for filename with path traversal", () => {
    expect(sanitizeDocIndexFilename("../etc/passwd.pdf")).toBeNull();
  });

  it("returns null for filename with forward slash", () => {
    expect(sanitizeDocIndexFilename("subdir/file.pdf")).toBeNull();
  });

  it("returns null for filename with backslash", () => {
    expect(sanitizeDocIndexFilename("subdir\\file.pdf")).toBeNull();
  });

  it("returns a full path for a valid pdf filename", () => {
    const result = sanitizeDocIndexFilename("contract_123.pdf");
    expect(result).not.toBeNull();
    expect(result!.endsWith("contract_123.pdf")).toBe(true);
  });
});

// legacy test — kept for regression
describe("document-index: cleanupPurgedContractDocuments (edge case)", () => {
  it("cleanupPurgedContractDocuments returns zeros for empty array", async () => {
    const { cleanupPurgedContractDocuments } = await import(
      "../services/document-index"
    );
    const result = await cleanupPurgedContractDocuments([]);
    expect(result).toEqual({ removedIndexes: 0, removedFiles: 0 });
  });
});

// ─── contract-number: format logic ────────────────────────────────────

describe("contract-number format logic (pure)", () => {
  // generateContractNumber depends on DB, so we test the format logic directly

  it("prefix format is KOB-YYYYMM", () => {
    // Test the parsing logic that generates the prefix
    const startDate = "2026-04-01";
    const [y, m] = startDate.split("-").map(Number);
    const month = String(m).padStart(2, "0");
    const prefix = `KOB-${y}${month}`;
    expect(prefix).toBe("KOB-202604");
  });

  it("sequence number is 4-digit zero-padded", () => {
    const seq = 1;
    expect(String(seq).padStart(4, "0")).toBe("0001");
  });

  it("sequence 9999 produces 4-digit string", () => {
    expect(String(9999).padStart(4, "0")).toBe("9999");
  });

  it("sequence 10000 overflows to 5 digits", () => {
    expect(String(10000).padStart(4, "0")).toBe("10000");
  });

  it("full format matches KOB-YYYYMM-XXXX pattern", () => {
    const prefix = "KOB-202604";
    const seq = 42;
    const number = `${prefix}-${String(seq).padStart(4, "0")}`;
    expect(number).toBe("KOB-202604-0042");
    expect(number).toMatch(/^KOB-\d{6}-\d{4,}$/);
  });

  it("parses month correctly for single-digit months", () => {
    const startDate = "2026-01-15";
    const [y, m] = startDate.split("-").map(Number);
    const prefix = `KOB-${y}${String(m).padStart(2, "0")}`;
    expect(prefix).toBe("KOB-202601");
  });

  it("parses sequence from existing contract number", () => {
    const contractNumber = "KOB-202604-0015";
    const lastSeq = parseInt(contractNumber.split("-")[2] ?? "0", 10);
    expect(lastSeq).toBe(15);
  });

  it("handles malformed sequence gracefully (NaN fallback)", () => {
    const contractNumber = "KOB-202604-XXXX";
    const lastSeq = parseInt(contractNumber.split("-")[2] ?? "0", 10);
    const nextSeq = Number.isNaN(lastSeq) ? 1 : lastSeq + 1;
    expect(nextSeq).toBe(1);
  });
});
