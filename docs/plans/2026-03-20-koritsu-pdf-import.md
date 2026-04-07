# Koritsu PDF Import + Employee Assignment Fix

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Import supervisor/commander data from Koritsu's annual PDF into the factories table, expand factory rows to 工区 level, and fix employee assignment resolution so `配属先` strings are properly parsed.

**Architecture:** Two-piece approach: (1) New page `/companies/koritsu` with PDF upload → server parses with `pdf-parse` → preview diff → upsert factories. (2) Fix `resolveFactoryAssignment` to parse composite `配属先` strings like "本社工場製造1課1工区1班" into (factoryName, department, lineName) components.

**Tech Stack:** pdf-parse (PDF text extraction), Hono routes, React + TanStack Query, existing factory upsert patterns.

---

## Context: Data Structure

### PDF Structure (派遣先責任者・指揮命令者一覧)
```
工場 → 課(派遣先責任者=課長) → 工区/係(指揮命令者=工・係長) + TEL
Plus: 苦情申出先, 住所 (5 locations), 時間外労働
```

### DB Mapping (factories table columns)
| PDF Field | DB Column |
|-----------|-----------|
| 派遣先責任者(課長) name | `hakensakiManagerName` |
| 派遣先責任者(課長) dept | `hakensakiManagerDept` |
| 指揮命令者(工・係長) name | `supervisorName` |
| 指揮命令者(工・係長) dept | `supervisorDept` |
| 電話番号 | `supervisorPhone` + `hakensakiManagerPhone` |
| 住所 | `address` |
| 苦情申出先 name | `complaintClientName` |
| 苦情申出先 dept | `complaintClientDept` |
| 苦情申出先 TEL | `complaintClientPhone` |

### Current State of Koritsu in DB
- Company: コーリツ株式会社 (id: 30)
- 5 factory rows (coarse — only 課 level, no 工区)
- ALL supervisor fields are null
- 119 employees, ALL with factoryId = null
- Dispatch mapping factory names DON'T match DB names

### Target State After Implementation
- ~25 factory rows at 工区 level (one per supervisor assignment point)
- All supervisor/commander/complaint fields populated
- Dispatch mapping updated to match actual factory names
- Employee import properly resolves `配属先` → factoryId

---

## Task 1: Install pdf-parse + create Koritsu PDF parser service

**Files:**
- Modify: `package.json` (add pdf-parse dependency)
- Create: `server/services/koritsu-pdf-parser.ts`
- Create: `server/__tests__/koritsu-pdf-parser.test.ts`

### Step 1: Install pdf-parse

Run: `npm install pdf-parse && npm install -D @types/pdf-parse`

### Step 2: Write the failing tests

```typescript
// server/__tests__/koritsu-pdf-parser.test.ts
import { describe, it, expect } from "vitest";
import {
  parseKoritsuPdfText,
  parseHaizokusaki,
  type KoritsuParsedFactory,
} from "../services/koritsu-pdf-parser.js";

describe("parseHaizokusaki", () => {
  it("parses full composite string", () => {
    const result = parseHaizokusaki("本社工場製造1課1工区1班");
    expect(result).toEqual({
      factoryName: "本社工場",
      department: "製造1課",
      lineName: "1工区",
    });
  });

  it("parses full-width numbers", () => {
    const result = parseHaizokusaki("州の崎工場製造2課2工区３班");
    expect(result).toEqual({
      factoryName: "州の崎工場",
      department: "製造2課",
      lineName: "2工区",
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

  it("returns null for empty string", () => {
    expect(parseHaizokusaki("")).toBeNull();
    expect(parseHaizokusaki("0")).toBeNull();
  });
});

describe("parseKoritsuPdfText", () => {
  // Minimal representative text from the PDF
  const sampleText = `派遣先責任者・指揮命令者一覧 【2025年 4月】
工　場 派遣先責任者（課長） 指揮命令者（工・係長） 電話番号
本社工場
製造１課 冨田 正志 １ 工 区 濵崎 純平 工長 0566-21-5128
２ 工 区 赤崎　 龍 工長
製造２課 佐々木 大介 ３ 工 区 皆倉 真理 工長
製造３課（乙川工場） 岡原 祐介 ５ 工 区 長谷川 知宏 工長 0569-47-6731
６ 工 区 田﨑 康孝 工長
7 工 区 中村 祐太 工長
品質係（本社） 上瀧 伸治 係長 0566-21-5128
品質係（乙川） 松本　 剛 係長 0569-47-6731
工務係（本社） 杉浦 弘樹 係長 0566-21-5132
工務係（乙川） 石川 佑治 係長 0569-47-6731
品 質 課 服部 篤実
工 務 課 石川　寛明
州の崎工場
製造１課 本多 孝博 １ 工 区 小谷 伸一 工長 0569-20-0332
製造２課 坪井 友和 ２ 工 区 鳥居 英司 工長
３ 工 区 堀川 義人 工長
製造３課 船附 秀平 ５ 工 区 山田 真樹 工長
製造５課（亀崎工場） 奥村 維久 6 工 区 伊藤 貴司 工長 0569-29-3771
7 工 区 滝川　 隆 工長
品 質 課 古川 市朗 品質係（州の崎） 渡部 浩司 係長 0569-20-0332
品質係（亀崎） 0569-29-3772
工 務 課 池田　 司 工務係（州の崎） 牧野 孝太郎 係長 0569-20-0331
工務係（亀崎） 小野 智人 係長 0569-29-3772
苦情申出先（派遣先） 財務部 リスク管理課．課長　大場 明宏
ＴＥＬ ： 0566-21-5139　、　ＦＡＸ ： 0566-24-7470
住所
本社工場 〒448-0813 刈谷市小垣江町本郷下３３番地３
州の崎工場 〒475-0021 半田市州の崎町２番１７１
亀崎工場 〒475-0026　半田市亀崎新田町５丁目１３番地１
乙川工場 〒475-0806　半田市古浜町９１番地
親和寮 〒448-0813 刈谷市小垣江町古浜田５８番地`;

  it("extracts factories with supervisors", () => {
    const result = parseKoritsuPdfText(sampleText);
    expect(result.factories.length).toBeGreaterThan(10);

    // Check a specific entry
    const honsha1ku = result.factories.find(
      (f) => f.factoryName === "本社工場" && f.department === "製造1課" && f.lineName === "1工区"
    );
    expect(honsha1ku).toBeDefined();
    expect(honsha1ku!.hakensakiManagerName).toBe("冨田 正志");
    expect(honsha1ku!.supervisorName).toBe("濵崎 純平");
    expect(honsha1ku!.supervisorDept).toBe("1工区");
  });

  it("extracts addresses", () => {
    const result = parseKoritsuPdfText(sampleText);
    expect(result.addresses["本社工場"]).toContain("刈谷市");
    expect(result.addresses["州の崎工場"]).toContain("半田市");
    expect(result.addresses["亀崎工場"]).toContain("半田市");
    expect(result.addresses["乙川工場"]).toContain("半田市");
  });

  it("extracts complaint handler", () => {
    const result = parseKoritsuPdfText(sampleText);
    expect(result.complaint.name).toBe("大場 明宏");
    expect(result.complaint.dept).toContain("リスク管理課");
    expect(result.complaint.phone).toBe("0566-21-5139");
  });

  it("maps 乙川 entries under 本社工場 to 乙川工場", () => {
    const result = parseKoritsuPdfText(sampleText);
    const otogawa5ku = result.factories.find(
      (f) => f.factoryName === "乙川工場" && f.lineName === "5工区"
    );
    expect(otogawa5ku).toBeDefined();
    expect(otogawa5ku!.hakensakiManagerName).toBe("岡原 祐介");
    expect(otogawa5ku!.supervisorName).toBe("長谷川 知宏");
  });
});
```

Run: `npx vitest run server/__tests__/koritsu-pdf-parser.test.ts`
Expected: FAIL (module not found)

### Step 3: Implement the parser

```typescript
// server/services/koritsu-pdf-parser.ts
import { normalizeWidth } from "./import-utils.js";

export interface KoritsuParsedFactory {
  factoryName: string;         // 本社工場, 州の崎工場, 亀崎工場, 乙川工場
  department: string;          // 製造1課, 品質課, 工務課
  lineName: string | null;     // 1工区, 品質係(本社), etc. — null for 課-level only
  hakensakiManagerName: string | null;  // 派遣先責任者 (課長)
  hakensakiManagerDept: string | null;
  supervisorName: string | null;        // 指揮命令者 (工長/係長)
  supervisorDept: string | null;
  phone: string | null;
}

export interface KoritsuParsedResult {
  period: string;              // "2025年 4月"
  factories: KoritsuParsedFactory[];
  addresses: Record<string, string>;  // factoryName → full address
  complaint: {
    name: string | null;
    dept: string | null;
    phone: string | null;
    fax: string | null;
  };
  overtime: {
    regular: string | null;
    threeShift: string | null;
  };
}

/**
 * Parse the composite 配属先 string from DBGenzaiX Excel.
 * "本社工場製造1課1工区1班" → { factoryName, department, lineName }
 */
export function parseHaizokusaki(raw: string): {
  factoryName: string;
  department: string;
  lineName: string;
} | null {
  if (!raw || raw === "0" || raw === "-") return null;

  const s = normalizeWidth(raw.trim());

  // Pattern: {工場名}製造{N}課{N}工区{N}班?
  const m = s.match(/^(.+?工場)(製造\d+課)(\d+工区)(?:\d+班)?$/);
  if (m) {
    return { factoryName: m[1], department: m[2], lineName: m[3] };
  }

  // Fallback: try without 工区 (e.g. "本社工場品質課")
  const m2 = s.match(/^(.+?工場)(.+課)$/);
  if (m2) {
    return { factoryName: m2[1], department: m2[2], lineName: null as unknown as string };
  }

  return null;
}

/**
 * Parse raw text extracted from Koritsu's 派遣先責任者・指揮命令者 PDF.
 * This is a HARDCODED parser for Koritsu's specific document format.
 *
 * Structure:
 *   - Factory headers: 本社工場, 州の崎工場
 *   - Department rows: 製造X課 + manager name (派遣先責任者)
 *   - Line rows: X工区 + supervisor name (指揮命令者) + phone
 *   - Support rows: 品質課/品質係, 工務課/工務係
 *   - Addresses section with 〒 postal codes
 *   - Complaint handler section
 *   - Overtime section
 */
export function parseKoritsuPdfText(text: string): KoritsuParsedResult {
  const norm = normalizeWidth(text);
  const lines = norm.split("\n").map((l) => l.trim()).filter(Boolean);

  const result: KoritsuParsedResult = {
    period: "",
    factories: [],
    addresses: {},
    complaint: { name: null, dept: null, phone: null, fax: null },
    overtime: { regular: null, threeShift: null },
  };

  // Extract period
  const periodMatch = norm.match(/【(\d+年\s*\d+月)】/);
  if (periodMatch) result.period = periodMatch[1];

  // ── Parse main table ──
  let currentFactory = "";
  let currentDept = "";
  let currentManagerName = "";
  let currentPhone = "";

  // Known factory mapping: 製造3課(乙川工場) → remap to 乙川工場
  // 製造5課(亀崎工場) → remap to 亀崎工場
  const REMAP: Record<string, string> = {
    "乙川工場": "乙川工場",
    "乙川": "乙川工場",
    "亀崎工場": "亀崎工場",
    "亀崎": "亀崎工場",
  };

  function resolveFactory(deptText: string): { factory: string; dept: string } {
    // Check for parenthetical factory reference: 製造3課（乙川工場）
    const parenMatch = deptText.match(/^(.+?)[(（](.+?)[)）]$/);
    if (parenMatch) {
      const innerText = parenMatch[2].replace(/工場$/, "");
      const remapped = REMAP[innerText] || REMAP[innerText + "工場"] || currentFactory;
      return { factory: remapped, dept: parenMatch[1] };
    }
    return { factory: currentFactory, dept: deptText };
  }

  let inAddresses = false;
  let inComplaint = false;
  let inOvertime = false;

  for (const line of lines) {
    // Skip headers
    if (line.includes("派遣先責任者") && line.includes("指揮命令者")) continue;
    if (line.startsWith("工") && line.includes("場") && line.includes("電話番号")) continue;

    // ── Address section ──
    if (line.startsWith("住所") || line === "住所") {
      inAddresses = true;
      inComplaint = false;
      inOvertime = false;
      continue;
    }

    if (inAddresses) {
      // Match: "本社工場 〒448-0813 刈谷市..."
      const addrMatch = line.match(/^(.+?工場|親和寮)\s*(〒.+)$/);
      if (addrMatch) {
        result.addresses[addrMatch[1]] = addrMatch[2];
        continue;
      }
      // End of addresses when we hit overtime section
      if (line.includes("時間外") || line.includes("通常") || line.includes("特別条項")) {
        inAddresses = false;
        inOvertime = true;
      }
    }

    // ── Complaint section ──
    if (line.includes("苦情申出先")) {
      inComplaint = true;
      inAddresses = false;
      // Try to extract from same line: "財務部 リスク管理課.課長 大場 明宏"
      const complaintMatch = line.match(/苦情申出先[（(]派遣先[)）]\s*(.+)/);
      if (complaintMatch) {
        const cText = complaintMatch[1];
        // "財務部 リスク管理課．課長　大場 明宏"
        const nameMatch = cText.match(/(.+[課部])[.．]?\s*課長\s+(.+)/);
        if (nameMatch) {
          result.complaint.dept = nameMatch[1].trim();
          result.complaint.name = nameMatch[2].trim();
        }
      }
      continue;
    }

    if (inComplaint) {
      // TEL line: "TEL : 0566-21-5139 、 FAX : 0566-24-7470"
      const telMatch = line.match(/TEL\s*[：:]\s*([\d-]+)/);
      const faxMatch = line.match(/FAX\s*[：:]\s*([\d-]+)/);
      if (telMatch) result.complaint.phone = telMatch[1];
      if (faxMatch) result.complaint.fax = faxMatch[1];
      if (telMatch || faxMatch) {
        inComplaint = false;
        continue;
      }
    }

    // ── Overtime section ──
    if (inOvertime) {
      if (line.includes("通常") || line.includes("通 常")) {
        // Next portion has the hours
        const hoursMatch = line.match(/1日[：:](.+)/);
        if (hoursMatch) result.overtime.regular = hoursMatch[1].trim();
      }
      if (line.includes("3組2交替") || line.includes("3組2交替")) {
        const hoursMatch = line.match(/1日[：:](.+)/);
        if (hoursMatch) result.overtime.threeShift = hoursMatch[1].trim();
      }
      continue;
    }

    // ── Factory header detection ──
    if (/^(本社工場|州の崎工場)$/.test(line)) {
      currentFactory = line;
      currentDept = "";
      currentManagerName = "";
      currentPhone = "";
      continue;
    }

    // ── Phone number extraction ──
    const phoneInLine = line.match(/(\d{4}-\d{2}-\d{4})/);
    if (phoneInLine) currentPhone = phoneInLine[1];

    // ── 課 (department) line with manager name ──
    // Pattern: "製造1課 冨田 正志" or "品 質 課 服部 篤実"
    const deptMatch = line.match(
      /^(製造\d+課(?:[（(].+?[)）])?|品\s*質\s*課|工\s*務\s*課|営\s*業\s*課|経\s*理\s*課|経営企画課)\s+(.+?)$/
    );
    if (deptMatch) {
      const rawDept = deptMatch[1].replace(/\s+/g, "");
      const managerName = deptMatch[2].replace(/\s+/g, " ").trim();
      const resolved = resolveFactory(rawDept);
      currentFactory = resolved.factory || currentFactory;
      currentDept = resolved.dept;
      currentManagerName = managerName;
      currentPhone = phoneInLine ? phoneInLine[1] : "";
      continue;
    }

    // ── 工区 (line) with supervisor name ──
    // Pattern: "1 工 区 濵崎 純平 工長" or "１ 工 区 濵崎 純平 工長"
    const lineMatch = line.match(
      /^(\d+)\s*工\s*区\s+(.+?)\s+(工長|係長)$/
    );
    if (lineMatch) {
      const lineNum = lineMatch[1];
      const supervisorName = lineMatch[2].replace(/\s+/g, " ").trim();
      const lineName = `${lineNum}工区`;

      result.factories.push({
        factoryName: currentFactory,
        department: currentDept,
        lineName,
        hakensakiManagerName: currentManagerName || null,
        hakensakiManagerDept: currentDept || null,
        supervisorName,
        supervisorDept: lineName,
        phone: currentPhone || null,
      });
      continue;
    }

    // ── 係 (section) with supervisor name ──
    // Pattern: "品質係（本社） 上瀧 伸治 係長 0566-21-5128"
    const kakariMatch = line.match(
      /^(.+係(?:[（(].+?[)）])?)\s+(.+?)\s+(係長)(?:\s+(\d{4}-\d{2}-\d{4}))?$/
    );
    if (kakariMatch) {
      const kakariName = kakariMatch[1].replace(/\s+/g, "");
      const supervisorName = kakariMatch[2].replace(/\s+/g, " ").trim();
      const kakariPhone = kakariMatch[4] || currentPhone || null;

      // Determine which factory this kakari belongs to
      let factory = currentFactory;
      const locationMatch = kakariName.match(/[（(](.+?)[)）]/);
      if (locationMatch) {
        const location = locationMatch[1];
        if (location === "乙川") factory = "乙川工場";
        else if (location === "亀崎") factory = "亀崎工場";
        else if (location === "州の崎") factory = "州の崎工場";
        else if (location === "本社") factory = "本社工場";
      }

      // Determine parent department from kakari name
      let parentDept = currentDept;
      if (kakariName.startsWith("品質")) parentDept = "品質課";
      else if (kakariName.startsWith("工務")) parentDept = "工務課";
      else if (kakariName.startsWith("経営企画")) parentDept = "経営企画課";
      else if (kakariName.startsWith("経理")) parentDept = "経理課";

      result.factories.push({
        factoryName: factory,
        department: parentDept,
        lineName: kakariName,
        hakensakiManagerName: currentManagerName || null,
        hakensakiManagerDept: parentDept,
        supervisorName,
        supervisorDept: kakariName,
        phone: kakariPhone,
      });
      continue;
    }

    // ── 係 without supervisor (phone only) ──
    // Pattern: "品質係（亀崎） 0569-29-3772"
    const kakariPhoneOnly = line.match(
      /^(.+係(?:[（(].+?[)）])?)\s+(\d{4}-\d{2}-\d{4})$/
    );
    if (kakariPhoneOnly) {
      const kakariName = kakariPhoneOnly[1].replace(/\s+/g, "");
      const kakariPhone = kakariPhoneOnly[2];

      let factory = currentFactory;
      const locationMatch = kakariName.match(/[（(](.+?)[)）]/);
      if (locationMatch) {
        const location = locationMatch[1];
        if (location === "乙川") factory = "乙川工場";
        else if (location === "亀崎") factory = "亀崎工場";
        else if (location === "州の崎") factory = "州の崎工場";
        else if (location === "本社") factory = "本社工場";
      }

      let parentDept = currentDept;
      if (kakariName.startsWith("品質")) parentDept = "品質課";
      else if (kakariName.startsWith("工務")) parentDept = "工務課";

      result.factories.push({
        factoryName: factory,
        department: parentDept,
        lineName: kakariName,
        hakensakiManagerName: currentManagerName || null,
        hakensakiManagerDept: parentDept,
        supervisorName: null,
        supervisorDept: kakariName,
        phone: kakariPhone,
      });
      continue;
    }
  }

  return result;
}
```

### Step 4: Run tests

Run: `npx vitest run server/__tests__/koritsu-pdf-parser.test.ts`
Expected: All tests pass (may need iteration on regex patterns to match real PDF text)

**NOTE:** The PDF text extraction from `pdf-parse` may produce slightly different formatting than the sample. After Task 2, test with the REAL PDF and adjust regex patterns accordingly.

### Step 5: Commit

```bash
git add server/services/koritsu-pdf-parser.ts server/__tests__/koritsu-pdf-parser.test.ts package.json package-lock.json
git commit -m "feat(koritsu): parser para PDF de responsables + parseHaizokusaki"
```

---

## Task 2: API endpoints for Koritsu PDF import

**Files:**
- Create: `server/routes/import-koritsu.ts`
- Modify: `server/index.ts` (mount new router)

### Step 1: Create the route file

```typescript
// server/routes/import-koritsu.ts
import { Hono } from "hono";
import pdfParse from "pdf-parse";
import { db, sqlite } from "../db/index.js";
import { factories, clientCompanies, auditLog } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { parseKoritsuPdfText, type KoritsuParsedResult } from "../services/koritsu-pdf-parser.js";

export const importKoritsuRouter = new Hono();

// ── POST /import/koritsu/parse — Parse PDF and return structured data + diff ──

importKoritsuRouter.post("/koritsu/parse", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body.file;

    if (!(file instanceof File)) {
      return c.json({ error: "PDF file required (field: 'file')" }, 400);
    }

    if (!file.name.endsWith(".pdf")) {
      return c.json({ error: "Only PDF files accepted" }, 400);
    }

    // Extract text from PDF
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfData = await pdfParse(buffer);
    const parsed = parseKoritsuPdfText(pdfData.text);

    // Find Koritsu company
    const company = await db.query.clientCompanies.findFirst({
      where: eq(clientCompanies.name, "コーリツ株式会社"),
    });

    if (!company) {
      return c.json({ error: "コーリツ株式会社 not found in database" }, 404);
    }

    // Load existing factories for diff
    const existingFactories = await db.query.factories.findMany({
      where: eq(factories.companyId, company.id),
    });

    // Load employees for cross-reference
    const allEmployees = await db.query.employees.findMany({
      where: eq((await import("../db/schema.js")).employees.companyId, company.id),
      columns: {
        id: true,
        employeeNumber: true,
        fullName: true,
        factoryId: true,
        status: true,
      },
    });

    // Build diff: for each parsed factory, check if it exists in DB
    const diff = parsed.factories.map((pf) => {
      const existing = existingFactories.find(
        (ef) =>
          ef.factoryName === pf.factoryName &&
          ef.department === pf.department &&
          (ef.lineName || null) === (pf.lineName || null),
      );

      const changes: Record<string, { old: string | null; new: string | null }> = {};
      if (existing) {
        if (pf.hakensakiManagerName && pf.hakensakiManagerName !== existing.hakensakiManagerName) {
          changes.hakensakiManagerName = { old: existing.hakensakiManagerName, new: pf.hakensakiManagerName };
        }
        if (pf.supervisorName && pf.supervisorName !== existing.supervisorName) {
          changes.supervisorName = { old: existing.supervisorName, new: pf.supervisorName };
        }
        if (pf.phone && pf.phone !== existing.phone) {
          changes.phone = { old: existing.phone, new: pf.phone };
        }
        // ... more fields
      }

      // Find employees assigned to this factory line
      const matchingEmployees = existing
        ? allEmployees.filter((e) => e.factoryId === existing.id)
        : [];

      return {
        ...pf,
        existingId: existing?.id ?? null,
        status: existing ? (Object.keys(changes).length > 0 ? "update" : "unchanged") : "insert",
        changes,
        employees: matchingEmployees,
      };
    });

    // Unassigned employees (factoryId is null)
    const unassigned = allEmployees.filter((e) => !e.factoryId && e.status === "active");

    return c.json({
      parsed,
      companyId: company.id,
      diff,
      unassigned,
      summary: {
        inserts: diff.filter((d) => d.status === "insert").length,
        updates: diff.filter((d) => d.status === "update").length,
        unchanged: diff.filter((d) => d.status === "unchanged").length,
        totalEmployees: allEmployees.filter((e) => e.status === "active").length,
        unassignedEmployees: unassigned.length,
      },
    });
  } catch (err: unknown) {
    return c.json({ error: String(err) }, 500);
  }
});

// ── POST /import/koritsu/apply — Apply parsed data to database ──

importKoritsuRouter.post("/koritsu/apply", async (c) => {
  try {
    const body = await c.req.json();
    const { companyId, factories: factoryRows, addresses, complaint } = body as {
      companyId: number;
      factories: Array<{
        existingId: number | null;
        factoryName: string;
        department: string;
        lineName: string | null;
        hakensakiManagerName: string | null;
        hakensakiManagerDept: string | null;
        supervisorName: string | null;
        supervisorDept: string | null;
        phone: string | null;
      }>;
      addresses: Record<string, string>;
      complaint: { name: string | null; dept: string | null; phone: string | null };
    };

    let inserted = 0;
    let updated = 0;

    sqlite.transaction(() => {
      for (const row of factoryRows) {
        const address = addresses[row.factoryName] || null;
        const updateData = {
          hakensakiManagerName: row.hakensakiManagerName,
          hakensakiManagerDept: row.hakensakiManagerDept,
          supervisorName: row.supervisorName,
          supervisorDept: row.supervisorDept,
          supervisorPhone: row.phone,
          hakensakiManagerPhone: row.phone,
          complaintClientName: complaint.name,
          complaintClientDept: complaint.dept,
          complaintClientPhone: complaint.phone,
          ...(address ? { address } : {}),
          updatedAt: new Date().toISOString(),
        };

        if (row.existingId) {
          // Update existing factory row
          db.update(factories)
            .set(updateData)
            .where(eq(factories.id, row.existingId))
            .run();
          updated++;
        } else {
          // Insert new factory row
          db.insert(factories)
            .values({
              companyId,
              factoryName: row.factoryName,
              department: row.department,
              lineName: row.lineName,
              ...updateData,
              isActive: true,
              createdAt: new Date().toISOString(),
            })
            .run();
          inserted++;
        }
      }

      // Audit log
      db.insert(auditLog)
        .values({
          action: "import",
          entityType: "factory",
          details: JSON.stringify({
            source: "koritsu-pdf",
            companyId,
            inserted,
            updated,
            total: factoryRows.length,
          }),
          createdAt: new Date().toISOString(),
        })
        .run();
    })();

    return c.json({ success: true, inserted, updated, total: factoryRows.length });
  } catch (err: unknown) {
    return c.json({ error: String(err) }, 500);
  }
});
```

### Step 2: Mount the router in server/index.ts

Add import and route mount alongside existing import routes:
```typescript
import { importKoritsuRouter } from "./routes/import-koritsu.js";
// ...
api.route("/import", importKoritsuRouter);
```

### Step 3: Test with real PDF manually

Run: `npm run dev:server`
Then: `curl -F "file=@C:/Users/kenji/OneDrive/Desktop/Koritsu/派遣先責任者・指揮命令者2025.04.pdf" http://localhost:8026/api/import/koritsu/parse`

Inspect the JSON output. Adjust parser regex if needed based on actual `pdf-parse` text output.

### Step 4: Commit

```bash
git add server/routes/import-koritsu.ts server/index.ts
git commit -m "feat(koritsu): API endpoints para parse y apply del PDF de responsables"
```

---

## Task 3: Frontend page `/companies/koritsu`

**Files:**
- Create: `src/routes/companies/koritsu.tsx`
- Modify: `src/components/layout/sidebar.tsx` (add nav link)

### Step 1: Create the route file

The page has 3 states: upload → preview → result.

Key UI elements:
- **Upload state:** Drop zone for PDF, "PDFを解析" button
- **Preview state:** Tables grouped by factory (本社工場, 州の崎工場, etc.) showing:
  - 課 rows with 派遣先責任者
  - 工区 rows with 指揮命令者 + diff highlighting + assigned employees
  - Collapsible 未配属社員 section at bottom
  - Collapsible 苦情申出先 + 住所 section
  - "保存" button
- **Result state:** Summary card with counts

Use existing UI patterns:
- `AnimatePresence` + `motion.div` for state transitions
- Color-coded diff: green (insert), amber (update), gray (unchanged)
- `toast.success()` on save
- `ConfirmDialog` before saving destructive changes

The page uses:
- `useMutation` for parse + apply API calls
- `queryKeys.factories.invalidateAll` + `queryKeys.companies.all` after save
- `queryKeys.employees.invalidateAll` after save (for cross-reference refresh)

### Step 2: Add sidebar link

In the `// MASTER` section of sidebar, add link to `/companies/koritsu`:
```tsx
{ to: "/companies/koritsu", icon: Building2, label: "コーリツ管理" }
```

### Step 3: Commit

```bash
git add src/routes/companies/koritsu.tsx src/components/layout/sidebar.tsx
git commit -m "feat(koritsu): pagina de importacion de PDF de responsables"
```

---

## Task 4: Fix 配属先 parsing in employee import

**Files:**
- Modify: `server/services/import-assignment.ts` (add `parseHaizokusaki` integration)
- Modify: `server/routes/import.ts` (use parsed components)
- Modify: `server/__tests__/import-assignment.test.ts` (add tests)

### Step 1: Write failing tests

Add to `server/__tests__/import-assignment.test.ts`:
```typescript
describe("resolveFactoryAssignment with composite 配属先", () => {
  const koritsuFactories: FactoryLookupEntry[] = [
    { id: 201, companyId: 30, factoryName: "本社工場", department: "製造1課", lineName: "1工区" },
    { id: 202, companyId: 30, factoryName: "本社工場", department: "製造1課", lineName: "2工区" },
    { id: 203, companyId: 30, factoryName: "本社工場", department: "製造2課", lineName: "3工区" },
    { id: 204, companyId: 30, factoryName: "乙川工場", department: "製造3課", lineName: "5工区" },
  ];

  it("resolves composite 配属先 to correct factoryId", () => {
    const lookup = buildFactoryLookup(koritsuFactories);
    const result = resolveFactoryAssignment({
      companyId: 30,
      department: "製造1課",
      lineName: "1工区",
      resolvedFactoryName: "本社工場",
      allFactories: koritsuFactories,
      factoryLookup: lookup,
    });
    expect(result).toBe(201);
  });
});
```

### Step 2: Modify import.ts to parse composite 配属先

In `server/routes/import.ts`, around line 173, add parsing:

```typescript
import { parseHaizokusaki } from "../services/koritsu-pdf-parser.js";

// ... inside the employee loop:

// Resolve factoryId from dispatch mapping + 配属先 + ライン
let dept = normalizePlacement(row.department || row["配属先"]);
let line = normalizePlacement(row.lineName || row["配属ライン"] || row["ライン"]);

// If dept contains a composite string (e.g. "本社工場製造1課1工区1班"),
// parse it into components
const composite = parseHaizokusaki(dept);
if (composite) {
  // Override resolved factory name with the one parsed from 配属先
  resolvedFactoryName = composite.factoryName;
  dept = composite.department;
  line = composite.lineName;
}

const factoryId = resolveFactoryAssignment({
  companyId,
  department: dept,
  lineName: line,
  resolvedFactoryName,
  allFactories,
  factoryLookup,
});
```

### Step 3: Run tests

Run: `npx vitest run server/__tests__/import-assignment.test.ts`
Expected: All pass

### Step 4: Commit

```bash
git add server/routes/import.ts server/services/import-assignment.ts server/__tests__/import-assignment.test.ts
git commit -m "fix(import): parsear 配属先 compuesto para resolver factoryId de Koritsu"
```

---

## Task 5: Update dispatch mapping for Koritsu

**Files:**
- Modify: `server/services/dispatch-mapping.ts`

### Step 1: Fix factory name mismatches

Current mapping has inconsistent names vs what the PDF uses:

```typescript
// BEFORE (mismatched)
"コーリツ 本社": { companyName: "コーリツ株式会社", factoryName: "本社", ... },
"コーリツ 州の崎": { companyName: "コーリツ株式会社", factoryName: "州の埼工場", ... },
"コーリツ 亀崎": { companyName: "コーリツ株式会社", factoryName: "亀崎", ... },
"コーリツ 乙川": { companyName: "コーリツ株式会社", factoryName: "乙川", ... },

// AFTER (matches PDF and 配属先 format)
"コーリツ 本社": { companyName: "コーリツ株式会社", factoryName: "本社工場", ... },
"コーリツ 州の崎": { companyName: "コーリツ株式会社", factoryName: "州の崎工場", ... },
"コーリツ 亀崎": { companyName: "コーリツ株式会社", factoryName: "亀崎工場", ... },
"コーリツ 乙川": { companyName: "コーリツ株式会社", factoryName: "乙川工場", ... },
```

### Step 2: Commit

```bash
git add server/services/dispatch-mapping.ts
git commit -m "fix(dispatch): normalizar nombres de fabricas Koritsu para match con PDF"
```

---

## Task 6: Clean up duplicate/orphan factory rows

**Files:**
- No new files — manual DB cleanup via the apply endpoint or direct query

### Step 1: After running the PDF import (Task 2-3), verify the new factory rows

The old coarse rows (id: 168-172) will likely become orphans since the new rows are at 工区 level. The apply endpoint should either:
- Update existing rows where possible (matching factoryName + department)
- Create new rows for 工区 level entries
- Mark old rows as inactive (don't delete — they may have historical contracts)

### Step 2: Add a cleanup check in the parse endpoint

Return old factory rows that don't match any parsed entry as `orphans` in the diff response, so the user can decide what to do with them in the UI.

---

## Execution Order

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6
  ↓         ↓         ↓         ↓         ↓
 Parser   API      Frontend  Import    Mapping
                              Fix       Fix
```

Tasks 4+5 can be done in parallel with Task 3 since they're independent.

## Testing Checklist

After all tasks:
1. `npm run test:run` — all 184+ tests pass
2. `npm run typecheck` — clean
3. `npm run lint` — clean
4. Manual test: upload real PDF → verify parsed data → save → verify DB
5. Manual test: reimport employees from DBGenzaiX → verify factoryId resolved
6. Manual test: generate Koritsu PDFs → verify supervisor data appears
