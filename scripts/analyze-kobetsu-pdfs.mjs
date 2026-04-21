import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerPath = resolve(__dirname, "../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
const workerUrl  = pathToFileURL(workerPath).href;

const pdfjsModule = await import("pdfjs-dist/legacy/build/pdf.mjs");
const { getDocument, GlobalWorkerOptions } = pdfjsModule;
GlobalWorkerOptions.workerSrc = workerUrl;

const PDF_ORIGINAL  = "C:/Users/kenji/OneDrive/Desktop/20260420174445628.pdf";
const PDF_GENERATED = "//uns-kikaku/Scan_Ricoh_IM2500/20260420174428166.pdf";

const SECTION_KEYS = [
  "\u6D3E\u9063\u5148\u4E8B\u696D\u6240",
  "\u5C31\u696D\u5834\u6240",
  "\u7D44\u7E54\u5358\u4F4D",
  "\u6291\u89E6\u65E5",
  "\u6307\u63EE\u547D\u4EE4\u8005",
  "\u6D3E\u9063\u5148\u8CAC\u4EFB\u8005",
  "\u82E6\u60C5\u51E6\u7406\u62C5\u5F53\u8005",
  "\u5354\u5B9A\u5BFE\u8C61",
  "\u8CAC\u4EFB\u306E\u7A0B\u5EA6",
  "\u696D\u52D9\u5185\u5BB9",
  "\u6D3E\u9063\u671F\u9593",
  "\u5C31\u696D\u65E5",
  "\u5C31\u696D\u6642\u9593",
  "\u4F11\u686C\u6642\u9593",
  "\u5C31\u696D\u65E5\u5916\u52B4\u50CD",
  "\u6642\u9593\u5916\u52B4\u50CD",
  "\u6D3E\u9063\u6599\u91D1",
  "\u652F\u6255\u3044\u6761\u4EF6",
  "\u632F\u8FBC\u5148",
  "\u5B89\u5168\u30FB\u885B\u751F",
  "\u4FBF\u5B9C\u4F9B\u4E0E",
  "\u82E6\u60C5\u51E6\u7406\u65B9\u6CD5",
  "\u5951\u7D04\u89E3\u9664",
  "\u7D1B\u4E89\u9632\u6B62",
  "\u7121\u671F\u96C7\u7528",
  "\u7F72\u540D",
];

async function extractItems(pdfPath) {
  let data;
  try { data = readFileSync(pdfPath); }
  catch (e) { return { error: e.message, items: [], pageHeight: 841.89, numPages: 0, hasRaster: false }; }

  const pdf = await getDocument({ data: new Uint8Array(data) }).promise;
  const numPages = pdf.numPages;
  const allItems = [];
  let hasRaster = false;
  let pageHeight = 841.89;

  for (let p = 1; p <= numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    pageHeight = viewport.height;
    const content = await page.getTextContent();
    if (content.items.length === 0) hasRaster = true;
    for (const item of content.items) {
      if (!item.str || item.str.trim() === "") continue;
      const fs   = Math.abs(item.transform[0]);
      const x    = item.transform[4];
      const y    = item.transform[5];
      const yTop = pageHeight - y;
      allItems.push({
        str: item.str,
        fontSize: parseFloat(fs.toFixed(2)),
        x: parseFloat(x.toFixed(1)),
        y: parseFloat(y.toFixed(1)),
        yTop: parseFloat(yTop.toFixed(1)),
        width: parseFloat((item.width || 0).toFixed(1)),
        fontName: item.fontName || "?",
        page: p,
      });
    }
  }
  return { items: allItems, pageHeight, numPages, hasRaster };
}

function assignSections(items) {
  const sorted = [...items].sort((a, b) => a.yTop !== b.yTop ? a.yTop - b.yTop : a.x - b.x);
  const sectionMap = {};
  for (const k of SECTION_KEYS) sectionMap[k] = [];
  let lastSection = null;
  for (const item of sorted) {
    let matched = false;
    for (const key of SECTION_KEYS) {
      if (item.str.includes(key)) { lastSection = key; matched = true; break; }
    }
    if (!matched && lastSection) sectionMap[lastSection].push(item);
  }
  return sectionMap;
}

function stats(items) {
  const sizes = items.map(i => i.fontSize).filter(s => s > 0.5);
  if (sizes.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };
  const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  return {
    avg: parseFloat(avg.toFixed(2)),
    min: parseFloat(Math.min(...sizes).toFixed(2)),
    max: parseFloat(Math.max(...sizes).toFixed(2)),
    count: sizes.length,
  };
}

function heightUsed(items, pageHeight) {
  if (items.length === 0) return { minTop: 0, maxTop: 0, usedPt: 0, usedPct: 0 };
  const tops   = items.map(i => i.yTop);
  const minTop = Math.min(...tops);
  const maxTop = Math.max(...tops);
  const usedPt = maxTop - minTop;
  return {
    minTop: parseFloat(minTop.toFixed(1)),
    maxTop: parseFloat(maxTop.toFixed(1)),
    usedPt: parseFloat(usedPt.toFixed(1)),
    usedPct: parseFloat(((usedPt / pageHeight) * 100).toFixed(1)),
  };
}

function fsDist(items, label) {
  const counts = {};
  for (const i of items) {
    const r = (Math.round(i.fontSize * 2) / 2).toFixed(1);
    counts[r] = (counts[r] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
  console.log(label + ":");
  for (const [fs, cnt] of sorted.slice(0, 20))
    console.log("  " + String(fs).padStart(5) + "pt  x" + cnt);
}

// ── Main ─────────────────────────────────────────────────────────────────
console.log("Loading PDFs...\n");
const [orig, gen] = await Promise.all([extractItems(PDF_ORIGINAL), extractItems(PDF_GENERATED)]);

if (orig.error) console.error("ORIGINAL ERROR:", orig.error);
if (gen.error)  console.error("GENERATED ERROR:", gen.error);

console.log("ORIGINAL  -> items=" + orig.items.length + "  pages=" + orig.numPages + "  pageH=" + orig.pageHeight + "pt  raster=" + orig.hasRaster);
console.log("GENERATED -> items=" + gen.items.length  + "  pages=" + gen.numPages  + "  pageH=" + gen.pageHeight  + "pt  raster=" + gen.hasRaster);
console.log();

const origSec = assignSections(orig.items);
const genSec  = assignSections(gen.items);

console.log("=== SECTION FONT SIZE COMPARISON ===");
console.log(
  "Block".padEnd(22) +
  "ORIG avg".padStart(9) + "  " +
  "GEN avg".padStart(8) + "  " +
  "DIFF".padStart(6) + "  " +
  "ORIG mn/mx".padStart(12) + "  " +
  "GEN mn/mx".padStart(11) + "  " +
  "Severity"
);
console.log("-".repeat(105));

for (const key of SECTION_KEYS) {
  const os = stats(origSec[key]);
  const gs = stats(genSec[key]);
  if (os.count === 0 && gs.count === 0) continue;
  const diff = parseFloat((os.avg - gs.avg).toFixed(2));
  const sev = Math.abs(diff) > 2 ? "CRITICA >2pt" : Math.abs(diff) > 1 ? "MEDIA 1-2pt" : "OK <1pt";
  console.log(
    key.padEnd(22) +
    String(os.avg).padStart(9) + "  " +
    String(gs.avg).padStart(8) + "  " +
    String(diff).padStart(6) + "  " +
    (os.min + "/" + os.max).padStart(12) + "  " +
    (gs.min + "/" + gs.max).padStart(11) + "  " +
    sev
  );
}

console.log("\n=== HEIGHT ANALYSIS ===");
const oh = heightUsed(orig.items, orig.pageHeight);
const gh = heightUsed(gen.items,  gen.pageHeight);
console.log("ORIGINAL  pageH=" + orig.pageHeight + "pt  top=" + oh.minTop + "->" + oh.maxTop + "pt  used=" + oh.usedPt + "pt (" + oh.usedPct + "%)  whitespace=" + (orig.pageHeight - oh.usedPt).toFixed(1) + "pt");
console.log("GENERATED pageH=" + gen.pageHeight  + "pt  top=" + gh.minTop + "->" + gh.maxTop + "pt  used=" + gh.usedPt + "pt (" + gh.usedPct + "%)  whitespace=" + (gen.pageHeight - gh.usedPt).toFixed(1) + "pt");

console.log("\n=== JUSHUGYO/KYUKEI DETAIL ===");
for (const key of ["\u5C31\u696D\u6642\u9593", "\u4F11\u686C\u6642\u9593"]) {
  const oi = origSec[key] || [];
  const gi = genSec[key]  || [];
  console.log("\n[" + key + "] ORIGINAL (" + oi.length + " items):");
  for (const i of oi.slice(0, 12))
    console.log("  fs=" + i.fontSize + "pt  x=" + i.x + "  yTop=" + i.yTop + '  "' + i.str.slice(0, 40) + '"');
  console.log("[" + key + "] GENERATED (" + gi.length + " items):");
  for (const i of gi.slice(0, 12))
    console.log("  fs=" + i.fontSize + "pt  x=" + i.x + "  yTop=" + i.yTop + '  "' + i.str.slice(0, 40) + '"');
}

console.log("\n=== GLOBAL FONT SIZE DISTRIBUTION ===");
fsDist(orig.items, "ORIGINAL");
fsDist(gen.items,  "GENERATED");

console.log("\nDone.");
