# Contract Grouping + SET Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Group contracts by factory/line in the UI, generate combined PDF sets per group (kobetsu duplex + daicho simplex), and export as ZIP.

**Architecture:**
- Frontend groups contracts by `factoryId` with collapsible sections
- New API endpoint `POST /api/documents/generate-set` takes a list of contractIds and generates combined PDFs
- ZIP bundling via `yazl` (already in dependencies) served through existing download endpoint

**Tech Stack:** React + TanStack Router (frontend), Hono (API), PDFKit (PDF gen), yazl (ZIP)

---

## Task 1: Group contracts by factory in the UI

**Files:**
- Modify: `src/routes/contracts/index.tsx`

**What:** Instead of rendering a flat `<table>`, group contracts by `factoryId` into collapsible sections. Each group shows company + factory + dept + line as a header with contract count and employee count.

**Step 1: Add grouping logic**

After `sortedContracts` memo (line ~148), add a new memo that groups contracts:

```typescript
interface ContractGroup {
  key: string; // factoryId as string
  companyName: string;
  factoryName: string;
  department: string;
  lineName: string;
  contracts: Contract[];
  totalEmployees: number;
}

const groupedContracts = useMemo(() => {
  const list = sortedContracts ?? contracts ?? [];
  const groups = new Map<number, ContractGroup>();

  for (const c of list) {
    const fid = c.factoryId ?? 0;
    if (!groups.has(fid)) {
      groups.set(fid, {
        key: String(fid),
        companyName: c.company?.name ?? "--",
        factoryName: c.factory?.factoryName ?? "--",
        department: c.factory?.department ?? "",
        lineName: c.factory?.lineName ?? "",
        contracts: [],
        totalEmployees: 0,
      });
    }
    const g = groups.get(fid)!;
    g.contracts.push(c);
    g.totalEmployees += c.employees?.length ?? 0;
  }

  return [...groups.values()];
}, [sortedContracts, contracts]);
```

**Step 2: Add collapsed state**

```typescript
const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
const toggleCollapse = useCallback((key: string) => {
  setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
}, []);
```

**Step 3: Replace flat table body with grouped rendering**

Replace the `<tbody>` section. Each group gets:
- A group header row (full-width, clickable to collapse)
- Contract rows (hidden when collapsed)
- A group footer with "SET生成" button

Group header row:
```tsx
<tr className="bg-muted/30 border-b border-border cursor-pointer hover:bg-muted/50" onClick={() => toggleCollapse(group.key)}>
  <td colSpan={6} className="px-4 py-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <ChevronRight className={cn("h-4 w-4 transition-transform", !collapsed.has(group.key) && "rotate-90")} />
        <FolderOpen className="h-4 w-4 text-primary" />
        <span className="font-semibold">{group.companyName}</span>
        <span className="text-xs text-muted-foreground">
          {group.factoryName} / {group.department} / {group.lineName}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{group.contracts.length}件 · {group.totalEmployees}名</span>
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleGenerateSet(group); }}>
          <FileText className="h-3.5 w-3.5 mr-1" />SET生成
        </Button>
      </div>
    </div>
  </td>
</tr>
```

**Step 4: Add imports**

Add `ChevronRight, FolderOpen, Download` to lucide imports.

**Step 5: Commit**

```
feat(ui): agrupar contratos por fábrica/línea con secciones colapsables
```

---

## Task 2: Backend — generate-set endpoint

**Files:**
- Modify: `server/routes/documents-generate.ts`

**What:** New endpoint `POST /api/documents/generate-set` that receives `{ contractIds: number[] }` and generates:
1. ONE combined 個別契約書 PDF (each contract = front kobetsu + back tsuchisho as consecutive pages)
2. ONE combined 派遣先管理台帳 PDF (all employees from all contracts)
3. ONE combined 派遣元管理台帳 PDF (all employees from all contracts)
Returns filenames of generated files.

**Step 1: Add the endpoint**

After the existing `generate-batch` endpoint, add:

```typescript
documentsGenerateRouter.post("/generate-set", async (c) => {
  // 1. Parse contractIds from body
  // 2. Fetch all contracts with employees, factories, companies
  // 3. Group employees across all contracts
  // 4. Generate combined kobetsu PDF (alternating kobetsu/tsuchisho pages)
  // 5. Generate combined hakensaki daicho (all employees)
  // 6. Generate combined hakenmoto daicho (all employees)
  // 7. Return generated filenames
});
```

**Key logic for kobetsu duplex:**
```typescript
const docKobetsu = createDoc();
for (let i = 0; i < contracts.length; i++) {
  if (i > 0) docKobetsu.addPage({ size: "A4", margin: 0 });
  // Front: kobetsu
  generateKobetsuPDF(docKobetsu, kobetsuData);
  // Back: tsuchisho (on next page for duplex)
  docKobetsu.addPage({ size: "A4", margin: 0 });
  generateTsuchishoPDF(docKobetsu, tsuchishoData);
}
```

**Key logic for combined daicho:**
```typescript
const allEmployees = contracts.flatMap(c => c.employees);
const docDaicho = createDoc();
allEmployees.forEach((emp, idx) => {
  if (idx > 0) docDaicho.addPage({ size: "A4", margin: 0 });
  generateHakensakiKanriDaichoPDF(docDaicho, { ...common, employee: emp });
});
```

**Output directory:** `output/set/` with filenames like:
- `SET_個別契約書_高雄工業_HUB工場_製作1課_1次旋係.pdf`
- `SET_派遣先管理台帳_高雄工業_HUB工場_製作1課_1次旋係.pdf`
- `SET_派遣元管理台帳_高雄工業_HUB工場_製作1課_1次旋係.pdf`

**Step 2: Commit**

```
feat(api): endpoint generate-set para PDFs combinados por grupo de fábrica
```

---

## Task 3: Backend — ZIP download

**Files:**
- Modify: `server/routes/documents.ts`

**What:** New endpoint `POST /api/documents/download-zip` that takes `{ filenames: string[] }` and returns a ZIP file containing all the specified PDFs.

**Step 1: Add ZIP endpoint**

```typescript
import yazl from "yazl";

documentsRouter.post("/download-zip", async (c) => {
  const { filenames } = await c.req.json();
  const zipFile = new yazl.ZipFile();

  for (const filename of filenames) {
    const filePath = path.join(outputDir, filename);
    if (fs.existsSync(filePath)) {
      zipFile.addFile(filePath, filename);
    }
  }

  zipFile.end();

  // Stream ZIP to response
  const chunks: Buffer[] = [];
  for await (const chunk of zipFile.outputStream) {
    chunks.push(chunk as Buffer);
  }
  const buffer = Buffer.concat(chunks);

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="contract-set.zip"`,
    },
  });
});
```

**Step 2: Commit**

```
feat(api): endpoint download-zip para descargar SET como archivo ZIP
```

---

## Task 4: Frontend — Connect SET generation + ZIP download

**Files:**
- Modify: `src/routes/contracts/index.tsx`
- Modify: `src/lib/api.ts`

**What:** Wire the "SET生成" button to call the API, show progress, then offer ZIP download.

**Step 1: Add API methods**

```typescript
// In api.ts
generateSet: (contractIds: number[]) =>
  request<{ files: { type: string; filename: string; path: string }[] }>(
    "/documents/generate-set",
    { method: "POST", body: JSON.stringify({ contractIds }) },
    120000 // 2 min timeout for large sets
  ),
downloadZip: async (filenames: string[], zipName: string) => {
  const res = await fetch("/api/documents/download-zip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filenames }),
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  a.click();
  URL.revokeObjectURL(url);
},
```

**Step 2: Add handler in contracts page**

```typescript
const handleGenerateSet = useCallback(async (group: ContractGroup) => {
  const contractIds = group.contracts.map(c => c.id);
  toast.loading("SET生成中...", { id: "set-gen" });
  try {
    const result = await api.generateSet(contractIds);
    toast.success(`${result.files.length}件のPDFを生成しました`, { id: "set-gen" });
    // Offer ZIP download
    const filenames = result.files.map(f => f.filename).filter(Boolean);
    const zipName = `SET_${group.companyName}_${group.factoryName}.zip`;
    await api.downloadZip(filenames, zipName);
  } catch (err) {
    toast.error("SET生成に失敗しました", { id: "set-gen" });
  }
}, []);
```

**Step 3: Commit**

```
feat(contracts): SET生成 + ZIP一括ダウンロード conectado al UI
```

---

## Task 5: Final cleanup + test

**Step 1: Run typecheck, lint, tests**
```bash
npx tsc --noEmit
npx eslint src/ server/
npx vitest run
npm run build
```

**Step 2: Manual test**
1. Start `npm run dev`
2. Go to `/contracts` — verify groups are visible
3. Click a group header — verify collapse/expand
4. Click "SET生成" — verify PDFs generate
5. Verify ZIP downloads with all 3 PDFs
6. Open kobetsu PDF — verify front+back alternating pages
7. Open daicho PDFs — verify all employees from all contracts combined

**Step 3: Final commit**

```
feat(contracts): agrupación por fábrica + SET生成 + ZIP export completo
```

---

## Summary

| Task | Scope | Files | Est. |
|------|-------|-------|------|
| 1 | UI grouping | contracts/index.tsx | Frontend |
| 2 | generate-set API | documents-generate.ts | Backend |
| 3 | ZIP download API | documents.ts | Backend |
| 4 | Connect UI → API | contracts/index.tsx, api.ts | Full-stack |
| 5 | Test + cleanup | All | QA |

## Notes

- `yazl` is already in `package.json` — no new dependencies needed
- The SET generation reuses ALL existing PDF generators — no PDF code changes
- Koritsu companies automatically use Koritsu generators (detection is in documents-generate.ts)
- Output goes to `output/set/` to keep it separate from individual contract PDFs
