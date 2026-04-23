/**
 * Koritsu PDF Parser — extracts supervisor/commander data from
 * コーリツ's annual PDF (派遣先責任者・指揮命令者一覧).
 *
 * Haizokusaki parsing (parseHaizokusaki) lives in haizokusaki-parser.ts
 * and is re-exported here for backward compatibility.
 *
 * Excel parsing lives in koritsu-excel-parser.ts — imported from koritsu-types.ts
 * for shared types to avoid circular deps.
 */
import { normalizeWidth } from "./import-utils.js";
import type { KoritsuParsedResult } from "./koritsu-types.js";

// Re-export haizokusaki parser for backward compatibility
export { parseHaizokusaki, type HaizokusakiResult } from "./haizokusaki-parser.js";

// Re-export shared types
export type { KoritsuParsedResult } from "./koritsu-types.js";

// ─── Internal types ──────────────────────────────────────────────────────────

interface KoukuEntry {
  lineIdx: number;
  num: number;
  name: string;
  phone: string | null;
  inlineDept: string | null;
  inlineManager: string | null;
}

interface KakariEntry {
  lineIdx: number;
  kakariName: string;
  supervisorName: string | null;
  phone: string | null;
}

interface SupportDeptManagerEntry {
  lineIdx: number;
  deptType: "品質課" | "重工課" | "工務課";
  managerName: string;
}

interface BottomDeptManager {
  lineIdx: number;
  rawDept: string;
  managerName: string;
  phone: string | null;
}

// ─── parseKoritsuPdfText ─────────────────────────────────────────────────────

/**
 * Location name → full factory name mapping for parenthetical references.
 */
const LOCATION_TO_FACTORY: Record<string, string> = {
  本社: "本社工場",
  乙川: "乙川工場",
  乙川工場: "乙川工場",
  亀崎: "亀崎工場",
  亀崎工場: "亀崎工場",
  "州の崎": "州の崎工場",
  "州の崎工場": "州の崎工場",
};

/**
 * Resolve a department name that may contain a parenthetical factory reference.
 */
function resolveDeptFactory(
  deptText: string,
  fallbackFactory: string,
): { factory: string; dept: string } {
  const parenMatch = deptText.match(/^(.+?)[（(](.+?)[）)]$/);
  if (parenMatch) {
    const cleanDept = parenMatch[1];
    const inner = parenMatch[2].replace(/工場$/, "");
    const resolved = LOCATION_TO_FACTORY[inner] ?? LOCATION_TO_FACTORY[inner + "工場"] ?? fallbackFactory;
    return { factory: resolved, dept: cleanDept };
  }
  return { factory: fallbackFactory, dept: deptText };
}

/**
 * Determine which factory a 係 (section) belongs to based on its location tag.
 */
function resolveKakariFactory(kakariName: string, fallbackFactory: string): string {
  const locMatch = kakariName.match(/[（(](.+?)[）)]/);
  if (locMatch) {
    const inner = locMatch[1];
    // Direct match first, then strip 工場 suffix and retry
    return LOCATION_TO_FACTORY[inner] ?? LOCATION_TO_FACTORY[inner.replace(/工場$/, "")] ?? fallbackFactory;
  }
  return fallbackFactory;
}

/**
 * Determine the parent department of a 係 (section) from its name prefix.
 */
function resolveKakariDept(kakariName: string, fallbackDept: string): string {
  if (kakariName.startsWith("品質")) return "品質課";
  if (kakariName.startsWith("重工")) return "重工課";
  if (kakariName.startsWith("工務")) return "工務課";
  if (kakariName.startsWith("経営企画")) return "経営企画課";
  if (kakariName.startsWith("経理")) return "経理課";
  if (kakariName.startsWith("営業")) return "営業課";
  return fallbackDept;
}

/**
 * Parse raw text extracted from Koritsu's 派遣先責任者・指揮命令者 PDF.
 *
 * pdf-parse extracts text COLUMN-by-column, producing SCRAMBLED output.
 * Uses global pattern extraction instead of sequential state machine.
 */
export function parseKoritsuPdfText(text: string): KoritsuParsedResult {
  const norm = normalizeWidth(text);
  // Split on newlines and tabs (scrambled text may use tabs as separators)
  const lines = norm.split(/[\n\t]/).map((l) => l.trim()).filter(Boolean);

  const result: KoritsuParsedResult = {
    period: "",
    factories: [],
    addresses: {},
    complaint: { name: null, dept: null, phone: null, fax: null },
    overtime: { regular: null, threeShift: null },
  };

  if (lines.length === 0) return result;

  // ── Extract period ──
  const periodMatch = norm.match(/【(\d+年\s*\d+月)】/);
  if (periodMatch) result.period = periodMatch[1];

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 1: Global pattern extraction
  // ════════════════════════════════════════════════════════════════════════════

  const allKouku: KoukuEntry[] = [];
  const allKakari: KakariEntry[] = [];
  const allSupportManagers: SupportDeptManagerEntry[] = [];
  const bottomDeptManagers: BottomDeptManager[] = [];
  const addressLines: string[] = [];
  // Track standalone phone numbers that appear before bottom dept lines
  let pendingPhone: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip headers, vertical text, standalone factory names
    if (line.includes("派遣先責任者") && line.includes("指揮命令者")) continue;
    if (/^工\s*場/.test(line) && line.includes("電話番号")) continue;
    if (line.length === 1) continue;
    if (/^(本社工場|州の崎工場|亀崎工場|乙川工場|親和寮)$/.test(line)) continue;
    if (/^(通\s*常|3組2交替|時\s*間\s*外|特別条項)$/.test(line)) continue;
    if (line === "住所") continue;

    // ── COMPOUND: Department + 工区 on same line ──
    const deptKoukuMatch = line.match(
      /^(製造\d+課(?:[（(].+?[）)])?)\s+(.+?)\s+(\d+)\s*工\s*区\s+(.+?)\s+(工長|係長)(?:\s+(\d{4}-\d{2}-\d{4}))?$/,
    );
    if (deptKoukuMatch) {
      const rawDept = deptKoukuMatch[1].replace(/\s+/g, "");
      const managerName = deptKoukuMatch[2].replace(/\s+/g, " ").trim();
      const koukuNum = parseInt(deptKoukuMatch[3], 10);
      const supervisorName = deptKoukuMatch[4].replace(/\s+/g, " ").trim();
      const phone = deptKoukuMatch[6] ?? null;

      allKouku.push({
        lineIdx: i, num: koukuNum, name: supervisorName, phone,
        inlineDept: rawDept, inlineManager: managerName,
      });
      pendingPhone = null;
      continue;
    }

    // ── Standalone 工区 ──
    const koukuMatch = line.match(
      /^(\d+)\s*工\s*区\s+(.+?)\s+(工長|係長)(?:\s+(\d{4}-\d{2}-\d{4}))?$/,
    );
    if (koukuMatch) {
      allKouku.push({
        lineIdx: i,
        num: parseInt(koukuMatch[1], 10),
        name: koukuMatch[2].replace(/\s+/g, " ").trim(),
        phone: koukuMatch[4] ?? null,
        inlineDept: null, inlineManager: null,
      });
      pendingPhone = null;
      continue;
    }

    // ── COMPOUND: 品質課/重工課 + 係 + supervisor on same line ──
    // Pattern: "品 質 課 古川 市朗 品質係（州の崎） 渡部 浩司 係長 0569-20-0332"
    const compoundKakariMatch = line.match(
      /^(品\s*質\s*課|工\s*務\s*課)\s+(.+?)\s+((?:品質|重工|工務)係(?:[（(].+?[）)])?)\s+(.+?)\s+(係長)(?:\s+(\d{4}-\d{2}-\d{4}))?$/,
    );
    if (compoundKakariMatch) {
      const deptType = compoundKakariMatch[1].replace(/\s+/g, "") as "品質課" | "重工課" | "工務課" | "工務課";
      const managerName = compoundKakariMatch[2].replace(/\s+/g, " ").trim();
      const kakariName = compoundKakariMatch[3].replace(/\s+/g, "");
      const supervisorName = compoundKakariMatch[4].replace(/\s+/g, " ").trim();
      const phone = compoundKakariMatch[6] ?? null;

      allSupportManagers.push({ lineIdx: i, deptType, managerName });
      allKakari.push({ lineIdx: i, kakariName, supervisorName, phone });
      pendingPhone = null;
      continue;
    }

    // ── Support dept with 2 names + 係長 (no explicit 係 location) ──
    // Pattern: "品 質 課 古川 市朗 渡部 浩司 係長"
    // Uses exact 2-name pattern: \S+ \S+ for each Japanese name (surname + given)
    const supportTwoNamesMatch = line.match(
      /^(品\s*質\s*課|工\s*務\s*課)\s+(\S+\s+\S+)\s+(\S+\s+\S+)\s+(係長)(?:\s+(\d{4}-\d{2}-\d{4}))?$/,
    );
    if (supportTwoNamesMatch) {
      const deptType = supportTwoNamesMatch[1].replace(/\s+/g, "") as "品質課" | "重工課" | "工務課";
      const managerName = supportTwoNamesMatch[2].trim();
      // The supervisor name is part2 — but we don't know which 係 they belong to
      // We just record the manager; the supervisor comes from separate 係 lines
      allSupportManagers.push({ lineIdx: i, deptType, managerName });
      pendingPhone = null;
      continue;
    }

    // ── 係 with supervisor name ──
    const kakariMatch = line.match(
      /^((?:品質|重工|工務|工務|経営企画|経理|営業)係(?:[（(].+?[）)])?)\s+(.+?)\s+(工長|係長)(?:\s+(\d{4}-\d{2}-\d{4}))?$/,
    );
    if (kakariMatch) {
      const kakariName = kakariMatch[1].replace(/\s+/g, "");
      const supervisorName = kakariMatch[2].replace(/\s+/g, " ").trim();
      const phone = kakariMatch[4] ?? null;
      if (kakariName.startsWith("品質") || kakariName.startsWith("重工") || kakariName.startsWith("工務") || kakariName.startsWith("工務")) {
        allKakari.push({ lineIdx: i, kakariName, supervisorName, phone });
      }
      pendingPhone = null;
      continue;
    }

    // ── 係 without supervisor (phone only) ──
    const kakariPhoneOnly = line.match(
      /^((?:品質|重工|工務|工務)係(?:[（(].+?[）)])?)\s+(\d{4}-\d{2}-\d{4})$/,
    );
    if (kakariPhoneOnly) {
      const kakariName = kakariPhoneOnly[1].replace(/\s+/g, "");
      const phone = kakariPhoneOnly[2];
      allKakari.push({ lineIdx: i, kakariName, supervisorName: null, phone });
      pendingPhone = null;
      continue;
    }

    // ── Support dept manager only (no supervisor, no 係長) ──
    const supportDeptMatch = line.match(
      /^(品\s*質\s*課|工\s*務\s*課)\s+(\S+\s+\S+)\s*$/,
    );
    if (supportDeptMatch && !line.includes("係")) {
      const deptType = supportDeptMatch[1].replace(/\s+/g, "") as "品質課" | "重工課" | "工務課";
      const managerName = supportDeptMatch[2].trim();
      allSupportManagers.push({ lineIdx: i, deptType, managerName });
      pendingPhone = null;
      continue;
    }

    // ── Complaint handler ──
    if (line.includes("苦情申出先")) {
      const complaintMatch = line.match(/苦情申出先[（(]派遣先[）)]\s*(.+)/);
      if (complaintMatch) {
        const cText = complaintMatch[1];
        const nameMatch = cText.match(/(.+[課部])[.．]\s*課長\s+(.+)/);
        if (nameMatch) {
          result.complaint.dept = nameMatch[1].trim();
          result.complaint.name = nameMatch[2].trim();
        }
      }
      pendingPhone = null;
      continue;
    }

    // ── TEL/FAX line ──
    const telMatch = line.match(/TEL\s*[：:]\s*([\d-]+)/);
    const faxMatch = line.match(/FAX\s*[：:]\s*([\d-]+)/);
    if (telMatch) result.complaint.phone = telMatch[1];
    if (faxMatch) result.complaint.fax = faxMatch[1];
    if (telMatch ?? faxMatch) { pendingPhone = null; continue; }

    // ── Addresses ──
    const withPrefixMatch = line.match(/^(.+?(?:工場|寮))\s*(〒\d{3}-\d{4}\s+.+)$/);
    if (withPrefixMatch) {
      result.addresses[withPrefixMatch[1]] = withPrefixMatch[2];
      pendingPhone = null;
      continue;
    }
    const bareAddrMatch = line.match(/^(〒\d{3}-\d{4}\s+.+)$/);
    if (bareAddrMatch) {
      addressLines.push(bareAddrMatch[1]);
      pendingPhone = null;
      continue;
    }

    // ── Overtime ──
    if (line.includes("1日") && line.includes("以内")) {
      if (!result.overtime.regular) {
        result.overtime.regular = line;
      } else if (!result.overtime.threeShift) {
        result.overtime.threeShift = line;
      }
      pendingPhone = null;
      continue;
    }

    // ── Bottom section: dept + manager + phone ──
    const deptPhoneMatch = line.match(
      /^(製造\d+課(?:[（(].+?[）)])?)\s+(.+?)\s+(\d{4}-\d{2}-\d{4})$/,
    );
    if (deptPhoneMatch) {
      const rawDept = deptPhoneMatch[1].replace(/\s+/g, "");
      const managerName = deptPhoneMatch[2].replace(/\s+/g, " ").trim();
      const phone = deptPhoneMatch[3];
      bottomDeptManagers.push({ lineIdx: i, rawDept, managerName, phone });
      pendingPhone = null;
      continue;
    }

    // ── Bottom section: dept + manager (no phone) ──
    const deptOnlyMatch = line.match(/^(製造\d+課)\s+(\S+\s+\S+)\s*$/);
    if (deptOnlyMatch && !line.includes("工区") && !line.includes("係")) {
      const rawDept = deptOnlyMatch[1].replace(/\s+/g, "");
      const managerName = deptOnlyMatch[2].trim();
      bottomDeptManagers.push({ lineIdx: i, rawDept, managerName, phone: pendingPhone });
      pendingPhone = null;
      continue;
    }

    // ── Bottom section: standalone dept (followed by parenthetical on next line) ──
    if (/^製造\d+課$/.test(line)) {
      const nextLine = i + 1 < lines.length ? lines[i + 1] : "";
      const parenNext = nextLine.match(
        /^[（(](.+?工場)[）)]\s+(.+?)(?:\s+(\d{4}-\d{2}-\d{4}))?$/,
      );
      if (parenNext) {
        const rawDept = `${line}（${parenNext[1]}）`;
        const managerName = parenNext[2].replace(/\s+/g, " ").trim();
        const phone = parenNext[3] ?? pendingPhone;
        bottomDeptManagers.push({ lineIdx: i, rawDept, managerName, phone });
        pendingPhone = null;
        i++; // consume next line
        continue;
      }
      bottomDeptManagers.push({ lineIdx: i, rawDept: line, managerName: "", phone: pendingPhone });
      pendingPhone = null;
      continue;
    }

    // ── Parenthetical factory line (orphan, attach to previous) ──
    const parenFactoryMatch = line.match(
      /^[（(](.+?工場)[）)]\s+(.+?)(?:\s+(\d{4}-\d{2}-\d{4}))?$/,
    );
    if (parenFactoryMatch && bottomDeptManagers.length > 0) {
      const last = bottomDeptManagers[bottomDeptManagers.length - 1];
      if (!last.rawDept.includes("（")) {
        last.rawDept = `${last.rawDept}（${parenFactoryMatch[1]}）`;
        last.managerName = parenFactoryMatch[2].replace(/\s+/g, " ").trim();
        last.phone = parenFactoryMatch[3] ?? last.phone;
        pendingPhone = null;
        continue;
      }
    }

    // ── Standalone phone number (may precede a bottom dept manager) ──
    const standalonePhone = line.match(/^(\d{4}-\d{2}-\d{4})$/);
    if (standalonePhone) {
      pendingPhone = standalonePhone[1];
      continue;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 2: Split 工区 into factory blocks and assign to departments
  // ════════════════════════════════════════════════════════════════════════════

  // The text has two blocks of 工区 entries separated by 係 entries.
  // Block 1 (本社工場): before any compound "製造1課" line
  //   - Bare 1工区, 2工区 → 製造1課
  //   - Compound 製造2課+3工区
  //   - Bare 5工区, 6工区, 7工区 → 製造3課（乙川工場）
  //
  // Block 2 (州の崎工場): from compound "製造1課" onwards
  //   - Compound 製造1課+1工区
  //   - Bare 2工区, 3工区 → 製造2課
  //   - Compound 製造3課+5工区
  //   - Bare 6工区, 7工区 → 製造5課（亀崎工場）

  // Find boundary: first compound line with 製造1課 (no parenthetical)
  const compoundLines = allKouku.filter(k => k.inlineDept !== null);
  let boundaryIdx = Infinity;

  for (const k of compoundLines) {
    const cleanDept = (k.inlineDept ?? "").replace(/[（(].+?[）)]/g, "");
    if (cleanDept === "製造1課") {
      boundaryIdx = k.lineIdx;
      break;
    }
  }

  const block1Kouku = allKouku.filter(k => k.lineIdx < boundaryIdx);
  const block2Kouku = allKouku.filter(k => k.lineIdx >= boundaryIdx);

  // ── Assign block1 (本社工場) ──
  assignKoukuBlock(result, block1Kouku, "本社工場", "0566-21-5128", bottomDeptManagers, compoundLines, boundaryIdx);

  // ── Assign block2 (州の崎工場) ──
  assignKoukuBlock(result, block2Kouku, "州の崎工場", "0569-20-0332", bottomDeptManagers, compoundLines, boundaryIdx);

  // ── Reassign post-compound bare 工区 using bottom dept managers ──
  // Each block has its OWN redirect: block1 → 乙川工場, block2 → 亀崎工場
  reassignPostCompound(result, block1Kouku, bottomDeptManagers, "本社工場", "乙川工場");
  reassignPostCompound(result, block2Kouku, bottomDeptManagers, "州の崎工場", "亀崎工場");

  // ── Reassign inter-compound bare 工区 (between two compounds in block2) ──
  reassignInterCompound(result, block2Kouku, bottomDeptManagers, "州の崎工場", boundaryIdx);

  // ── Apply bottom dept managers as 派遣先責任者 overrides ──
  for (const bm of bottomDeptManagers) {
    if (!bm.managerName) continue;
    const resolved = resolveDeptFactory(bm.rawDept, "");

    if (resolved.factory) {
      for (const entry of result.factories) {
        if (entry.department === resolved.dept && entry.factoryName === resolved.factory) {
          entry.hakensakiManagerName = bm.managerName;
          entry.hakensakiManagerDept = resolved.dept;
          if (bm.phone) entry.phone = bm.phone;
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 3: Build 係 entries with support dept managers
  // ════════════════════════════════════════════════════════════════════════════

  // Group support managers by factory block.
  // In real text, managers appear in pairs: 州の崎 pair first, then 本社 pair.
  // Detection: compound kakari lines tell us the block; standalone managers
  // are grouped by order (first of each deptType = 州の崎, second = 本社).

  interface ResolvedSupport {
    deptType: "品質課" | "重工課" | "工務課";
    managerName: string;
    block: "本社" | "州の崎";
  }

  const resolvedSupport: ResolvedSupport[] = [];
  const compoundKakariLineIdxs = new Set(
    allKakari.map(k => k.lineIdx).filter(idx =>
      allSupportManagers.some(sm => sm.lineIdx === idx),
    ),
  );

  for (const sm of allSupportManagers) {
    if (compoundKakariLineIdxs.has(sm.lineIdx)) {
      const ck = allKakari.find(k => k.lineIdx === sm.lineIdx);
      if (ck) {
        const factory = resolveKakariFactory(ck.kakariName, "");
        const block: "本社" | "州の崎" =
          factory.includes("州の崎") || factory.includes("亀崎") ? "州の崎" : "本社";
        resolvedSupport.push({ deptType: sm.deptType, managerName: sm.managerName, block });
        continue;
      }
    }
    // Standalone: first of each type = 州の崎, second = 本社
    const sameTypeCount = resolvedSupport.filter(r => r.deptType === sm.deptType).length;
    const block: "本社" | "州の崎" = sameTypeCount === 0 ? "州の崎" : "本社";
    resolvedSupport.push({ deptType: sm.deptType, managerName: sm.managerName, block });
  }

  // Build 係 factory entries
  for (const k of allKakari) {
    const factory = resolveKakariFactory(k.kakariName, "");
    const parentDept = resolveKakariDept(k.kakariName, "");

    let factoryBlock: "本社" | "州の崎";
    if (factory.includes("州の崎") || factory.includes("亀崎")) {
      factoryBlock = "州の崎";
    } else if (factory.includes("本社") || factory.includes("乙川")) {
      factoryBlock = "本社";
    } else {
      factoryBlock = k.lineIdx < boundaryIdx ? "本社" : "州の崎";
    }

    const matchingManager = resolvedSupport.find(
      sm => sm.deptType === parentDept && sm.block === factoryBlock,
    );

    result.factories.push({
      factoryName: factory || (factoryBlock === "本社" ? "本社工場" : "州の崎工場"),
      department: parentDept,
      lineName: k.kakariName,
      hakensakiManagerName: matchingManager?.managerName ?? null,
      hakensakiManagerDept: parentDept || null,
      hakensakiManagerRole: null,
      supervisorName: k.supervisorName,
      supervisorDept: k.kakariName,
      supervisorRole: null,
      phone: k.phone ?? null,
    });
  }

  // ── Build factory phone map and apply to entries with block-default phone ──
  // Priority: 経営企画係 phones (most reliable per-factory) > existing entry phones
  const factoryPhones: Record<string, string> = {};
  // First: extract from 経営企画係 lines (these have reliable per-factory phones)
  for (const line of lines) {
    const keieiMatch = line.match(/^経営企画係[（(](.+?)[）)]\s+(\d{4}-\d{2}-\d{4})$/);
    if (keieiMatch) {
      const factoryName = LOCATION_TO_FACTORY[keieiMatch[1]];
      if (factoryName) {
        factoryPhones[factoryName] = keieiMatch[2];
      }
    }
  }
  // Fill gaps from existing factory entries
  for (const entry of result.factories) {
    if (entry.phone && entry.factoryName && !factoryPhones[entry.factoryName]) {
      factoryPhones[entry.factoryName] = entry.phone;
    }
  }
  // Apply factory default phone to entries that inherited a block default
  for (const entry of result.factories) {
    if (entry.factoryName && factoryPhones[entry.factoryName]) {
      const factoryPhone = factoryPhones[entry.factoryName];
      // If the entry's phone is the block default (本社 or 州の崎) but its factory is different,
      // replace with the factory's own phone
      if (entry.phone === "0566-21-5128" && entry.factoryName !== "本社工場") {
        entry.phone = factoryPhone;
      }
      if (entry.phone === "0569-20-0332" && entry.factoryName !== "州の崎工場") {
        entry.phone = factoryPhone;
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 4: Addresses
  // ════════════════════════════════════════════════════════════════════════════

  const ADDRESS_ORDER = ["本社工場", "州の崎工場", "亀崎工場", "乙川工場", "親和寮"];
  if (addressLines.length > 0 && Object.keys(result.addresses).length === 0) {
    for (let i = 0; i < addressLines.length && i < ADDRESS_ORDER.length; i++) {
      result.addresses[ADDRESS_ORDER[i]] = addressLines[i];
    }
  }

  return result;
}

// ─── Helper: assign 工区 in a block to their departments ─────────────────────

function assignKoukuBlock(
  result: KoritsuParsedResult,
  koukuEntries: KoukuEntry[],
  defaultFactory: string,
  defaultPhone: string | null,
  bottomManagers: BottomDeptManager[],
  _compoundLines: KoukuEntry[],
  _boundaryIdx: number,
): void {
  if (koukuEntries.length === 0) return;

  const inlineDepts = koukuEntries
    .filter(k => k.inlineDept !== null && k.inlineManager !== null)
    .map(k => ({ rawDept: k.inlineDept!, managerName: k.inlineManager!, phone: k.phone }));

  let currentDept = "";
  let currentFactory = defaultFactory;
  let currentManager = "";
  let currentPhone = defaultPhone;
  let hitFirstCompound = false;
  const preDeptEntries: KoukuEntry[] = [];

  for (const k of koukuEntries) {
    if (k.inlineDept !== null && k.inlineManager !== null) {
      hitFirstCompound = true;
      const resolved = resolveDeptFactory(k.inlineDept, defaultFactory);
      currentDept = resolved.dept;
      currentFactory = resolved.factory;
      currentManager = k.inlineManager;
      currentPhone = k.phone ?? defaultPhone;
    } else if (!hitFirstCompound) {
      preDeptEntries.push(k);
      continue;
    }

    const lineName = `${k.num}工区`;
    result.factories.push({
      factoryName: currentFactory,
      department: currentDept,
      lineName,
      hakensakiManagerName: currentManager || null,
      hakensakiManagerDept: currentDept || null,
      hakensakiManagerRole: null,
      supervisorName: k.name,
      supervisorDept: lineName,
      supervisorRole: null,
      phone: k.phone ?? currentPhone,
    });
  }

  // Handle pre-compound bare 工区
  if (preDeptEntries.length > 0) {
    const inlineDeptNames = new Set(inlineDepts.map(d =>
      resolveDeptFactory(d.rawDept, defaultFactory).dept,
    ));

    let preDeptInfo: { factory: string; dept: string; manager: string; phone: string | null } | null = null;
    for (const bm of bottomManagers) {
      const resolved = resolveDeptFactory(bm.rawDept, "");
      if ((resolved.factory === defaultFactory || resolved.factory === "") &&
          !inlineDeptNames.has(resolved.dept)) {
        preDeptInfo = {
          factory: resolved.factory || defaultFactory,
          dept: resolved.dept,
          manager: bm.managerName,
          phone: bm.phone,
        };
        break;
      }
    }

    for (const k of preDeptEntries) {
      const lineName = `${k.num}工区`;
      result.factories.push({
        factoryName: preDeptInfo?.factory ?? defaultFactory,
        department: preDeptInfo?.dept ?? "",
        lineName,
        hakensakiManagerName: preDeptInfo?.manager ?? null,
        hakensakiManagerDept: preDeptInfo?.dept ?? null,
        hakensakiManagerRole: null,
        supervisorName: k.name,
        supervisorDept: lineName,
        supervisorRole: null,
        phone: k.phone ?? preDeptInfo?.phone ?? defaultPhone,
      });
    }
  }
}

// ─── Helper: reassign post-compound bare 工区 to their proper factory ────────

function reassignPostCompound(
  result: KoritsuParsedResult,
  blockKouku: KoukuEntry[],
  bottomManagers: BottomDeptManager[],
  defaultFactory: string,
  targetFactory: string,
): void {
  const blockCompounds = blockKouku.filter(k => k.inlineDept !== null);
  if (blockCompounds.length === 0) return;

  const lastCompoundIdx = Math.max(...blockCompounds.map(k => k.lineIdx));
  const bareAfterLast = blockKouku.filter(k =>
    k.inlineDept === null && k.lineIdx > lastCompoundIdx,
  );
  if (bareAfterLast.length === 0) return;

  // Find the bottom dept manager that redirects to the specific target factory
  const redirectManager = bottomManagers.find(bm => {
    const resolved = resolveDeptFactory(bm.rawDept, "");
    return resolved.factory === targetFactory;
  });

  if (redirectManager) {
    const resolved = resolveDeptFactory(redirectManager.rawDept, defaultFactory);
    const lastCompoundDept = blockCompounds[blockCompounds.length - 1]
      .inlineDept?.replace(/[（(].+?[）)]/g, "");

    for (const entry of result.factories) {
      const match = bareAfterLast.find(k => `${k.num}工区` === entry.lineName);
      if (match && entry.factoryName === defaultFactory && entry.department === lastCompoundDept) {
        entry.factoryName = resolved.factory;
        entry.department = resolved.dept;
        entry.hakensakiManagerName = redirectManager.managerName || null;
        entry.hakensakiManagerDept = resolved.dept;
        entry.phone = redirectManager.phone ?? entry.phone;
      }
    }
  }
}

// ─── Helper: reassign bare 工区 between two compounds to 製造2課 ─────────────

function reassignInterCompound(
  result: KoritsuParsedResult,
  blockKouku: KoukuEntry[],
  bottomManagers: BottomDeptManager[],
  defaultFactory: string,
  boundaryIdx: number,
): void {
  const compounds = blockKouku.filter(k => k.inlineDept !== null);
  if (compounds.length < 2) return;

  const first = compounds[0];
  const second = compounds[1];

  const bareInBetween = blockKouku.filter(k =>
    k.inlineDept === null &&
    k.lineIdx > first.lineIdx &&
    k.lineIdx < second.lineIdx,
  );
  if (bareInBetween.length === 0) return;

  // Find a bottom manager for this factory block whose dept is different from both compounds
  const firstDept = resolveDeptFactory(first.inlineDept!, defaultFactory).dept;
  const secondDept = resolveDeptFactory(second.inlineDept!, defaultFactory).dept;

  const interManager = bottomManagers.find(bm => {
    const clean = bm.rawDept.replace(/[（(].+?[）)]/g, "");
    const resolved = resolveDeptFactory(bm.rawDept, "");
    return clean !== firstDept &&
           clean !== secondDept &&
           (resolved.factory === defaultFactory || resolved.factory === "") &&
           bm.lineIdx >= boundaryIdx;
  });

  if (interManager) {
    const resolved = resolveDeptFactory(interManager.rawDept, defaultFactory);
    for (const entry of result.factories) {
      const match = bareInBetween.find(k => `${k.num}工区` === entry.lineName);
      if (match && entry.factoryName === defaultFactory && entry.department === firstDept) {
        entry.department = resolved.dept || interManager.rawDept;
        entry.hakensakiManagerName = interManager.managerName || null;
        entry.hakensakiManagerDept = resolved.dept || interManager.rawDept;
        if (interManager.phone) entry.phone = interManager.phone;
      }
    }
  }
}