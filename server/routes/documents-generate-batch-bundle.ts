// Handler for POST /api/documents/generate-batch — per-contract bundles
import type { Context } from "hono";
import { z } from "zod";
import path from "node:path";
import { db } from "../db/index.js";
import { contracts, auditLog } from "../db/schema.js";
import { inArray } from "drizzle-orm";
import { generateKobetsuPDF } from "../pdf/kobetsu-pdf.js";
import { generateTsuchishoPDF } from "../pdf/tsuchisho-pdf.js";
import { generateHakensakiKanriDaichoPDF } from "../pdf/hakensakikanridaicho-pdf.js";
import { generateHakenmotoKanriDaichoPDF } from "../pdf/hakenmotokanridaicho-pdf.js";
import { generateKoritsuKobetsuPDF } from "../pdf/koritsu-kobetsu-pdf.js";
import { generateKoritsuDaichoPDF } from "../pdf/koritsu-hakensakidaicho-pdf.js";
import { generateKoritsuTsuchishoPDF } from "../pdf/koritsu-tsuchisho-pdf.js";
import { toLocalDateStr } from "../services/contract-dates.js";
import { mapContractEmployeesToPDF } from "../services/employee-mapper.js";
import { sanitizeFilename } from "../services/document-files.js";
import {
  createDoc,
  writeToFile,
  createZipArchive,
  buildCommonData,
  appendContractDocIndex,
  KOBETSU_OUTPUT_DIR,
  KORITSU_OUTPUT_DIR,
} from "../services/document-generation.js";
import {
  buildKoritsuKobetsuData,
  buildKoritsuTsuchishoData,
  buildKoritsuDaichoData,
  buildStandardKobetsuData,
  buildStandardTsuchishoData,
  buildStandardDaichoData,
  buildHakenmotoDaichoData,
} from "../services/pdf-data-builders.js";
import { recordPdfVersion } from "../services/pdf-versioning.js";
import { readFile } from "node:fs/promises";

const generateBatchSchema = z.object({
  contractIds: z.array(z.number().int().positive()).min(1, "contractIds must be a non-empty array"),
});

// ─── POST /api/documents/generate-batch ──────────────────────────────
export async function handleGenerateBatch(c: Context) {
  const parsed = generateBatchSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: "Invalid request body", details: parsed.error.flatten() }, 400);
  }

  const { contractIds } = parsed.data;

  // Load all contracts in a single bulk query (avoids N+1)
  const contractsData = await db.query.contracts.findMany({
    where: inArray(contracts.id, contractIds),
    with: {
      company: true,
      factory: true,
      employees: { with: { employee: true } },
    },
  });

  if (contractsData.length === 0) {
    return c.json({ error: "No valid contracts found" }, 404);
  }

  const generatedFiles: { type: string; filename: string; path: string }[] = [];
  let totalEmployees = 0;

  for (const contract of contractsData) {
    const common = buildCommonData(contract);
    const empList = mapContractEmployeesToPDF(contract.employees);
    totalEmployees += empList.length;
    const batchIsKoritsu = common.companyName.includes("コーリツ");
    const batchOutputDir = batchIsKoritsu ? KORITSU_OUTPUT_DIR : KOBETSU_OUTPUT_DIR;

    const timestamp = toLocalDateStr(new Date());
    const prefix = sanitizeFilename(`${common.companyName}_${contract.contractNumber}_${common.lineName || common.department}_${timestamp}`);
    const perContractFiles: { type: string; filename: string; path: string }[] = [];

    if (batchIsKoritsu) {
      // ── KORITSU batch: use Koritsu generators ──
      try {
        const doc1 = createDoc();
        generateKoritsuKobetsuPDF(doc1, buildKoritsuKobetsuData(common, contract, empList));

        doc1.addPage({ size: "A4", margin: 0 });
        generateKoritsuTsuchishoPDF(doc1, buildKoritsuTsuchishoData(common, contract, empList));

        const fn1 = `個別契約書_${prefix}.pdf`;
        await writeToFile(doc1, path.join(batchOutputDir, fn1));
        perContractFiles.push({ type: "kobetsu", filename: fn1, path: `/api/documents/download/${encodeURIComponent(fn1)}` });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        perContractFiles.push({ type: "kobetsu", filename: "", path: `ERROR: ${message}` });
      }

      try {
        const doc3 = createDoc();
        empList.forEach((emp, idx) => {
          if (idx > 0) doc3.addPage({ size: "A4", margin: 0 });
          generateKoritsuDaichoPDF(doc3, buildKoritsuDaichoData(common, contract, empList, emp));
        });
        const fn3 = `派遣先管理台帳_${prefix}.pdf`;
        await writeToFile(doc3, path.join(batchOutputDir, fn3));
        perContractFiles.push({ type: "hakensakiDaicho", filename: fn3, path: `/api/documents/download/${encodeURIComponent(fn3)}` });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        perContractFiles.push({ type: "hakensakiDaicho", filename: "", path: `ERROR: ${message}` });
      }

      try {
        const doc4 = createDoc();
        empList.forEach((emp, idx) => {
          if (idx > 0) doc4.addPage({ size: "A4", margin: 0 });
          generateHakenmotoKanriDaichoPDF(doc4, buildHakenmotoDaichoData(common, emp));
        });
        const fn4 = `派遣元管理台帳_${prefix}.pdf`;
        await writeToFile(doc4, path.join(batchOutputDir, fn4));
        perContractFiles.push({ type: "hakenmotoDaicho", filename: fn4, path: `/api/documents/download/${encodeURIComponent(fn4)}` });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        perContractFiles.push({ type: "hakenmotoDaicho", filename: "", path: `ERROR: ${message}` });
      }
    } else {
    // ── STANDARD batch ──
    try {
      const doc1 = createDoc();
      generateKobetsuPDF(doc1, buildStandardKobetsuData(common, contract, empList));

      doc1.addPage({ size: "A4", margin: 0 });
      generateTsuchishoPDF(doc1, buildStandardTsuchishoData(common, empList));

      const fn1 = `個別契約書_${prefix}.pdf`;
      await writeToFile(doc1, path.join(batchOutputDir, fn1));
      try {
        const buf1 = await readFile(path.join(batchOutputDir, fn1));
        await recordPdfVersion({
          pdfType: "kobetsu",
          buffer: buf1,
          contractId: contract.id,
          factoryId: contract.factoryId,
          metadata: { employeeCount: empList.length, contractNumber: contract.contractNumber },
        });
      } catch { /* versioning no bloquea la entrega */ }
      perContractFiles.push({ type: "kobetsu", filename: fn1, path: `/api/documents/download/${encodeURIComponent(fn1)}` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      perContractFiles.push({ type: "kobetsu", filename: "", path: `ERROR: ${message}` });
    }

    try {
      const doc3 = createDoc();
      empList.forEach((emp, idx) => {
        if (idx > 0) doc3.addPage({ size: "A4", margin: 0 });
        generateHakensakiKanriDaichoPDF(doc3, buildStandardDaichoData(common, emp));
      });
      const fn3 = `派遣先管理台帳_${prefix}.pdf`;
      await writeToFile(doc3, path.join(batchOutputDir, fn3));
      perContractFiles.push({ type: "hakensakiDaicho", filename: fn3, path: `/api/documents/download/${encodeURIComponent(fn3)}` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      perContractFiles.push({ type: "hakensakiDaicho", filename: "", path: `ERROR: ${message}` });
    }

    try {
      const doc4 = createDoc();
      empList.forEach((emp, idx) => {
        if (idx > 0) doc4.addPage({ size: "A4", margin: 0 });
        generateHakenmotoKanriDaichoPDF(doc4, buildHakenmotoDaichoData(common, emp));
      });
      const fn4 = `派遣元管理台帳_${prefix}.pdf`;
      await writeToFile(doc4, path.join(batchOutputDir, fn4));
      perContractFiles.push({ type: "hakenmotoDaicho", filename: fn4, path: `/api/documents/download/${encodeURIComponent(fn4)}` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      perContractFiles.push({ type: "hakenmotoDaicho", filename: "", path: `ERROR: ${message}` });
    }
    } // end standard batch

    const zipSources = perContractFiles
      .filter((f) =>
        (f.type === "kobetsu" || f.type === "hakensakiDaicho" || f.type === "hakenmotoDaicho") &&
        Boolean(f.filename) &&
        !f.path.startsWith("ERROR")
      )
      .map((f) => f.filename);

    const indexedFiles = perContractFiles
      .map((f) => f.filename)
      .filter((filename): filename is string => Boolean(filename));

    if (zipSources.length > 0) {
      try {
        const zipFilename = `契約書類一式_${prefix}.zip`;
        await createZipArchive(zipFilename, zipSources, batchOutputDir);
        generatedFiles.push({
          type: "contractBundleZip",
          filename: zipFilename,
          path: `/api/documents/download/${encodeURIComponent(zipFilename)}`,
        });
        indexedFiles.push(zipFilename);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        generatedFiles.push({ type: "contractBundleZip", filename: "", path: `ERROR: ${message}` });
      }
    }

    await appendContractDocIndex(contract.id, indexedFiles);
  }

  const batchHasErrors = generatedFiles.some((f) => f.path.startsWith("ERROR:"));

  db.insert(auditLog).values({
    action: "export",
    entityType: "document",
    entityId: null,
    detail: `一括PDF生成: ${contractsData.length}契約 / ${totalEmployees}名 / ${generatedFiles.length}ファイル (IDs: ${contractIds.join(", ")})`,
    userName: "system",
  }).run();

  return c.json(
    {
      success: !batchHasErrors,
      contractCount: contractsData.length,
      employeeCount: totalEmployees,
      files: generatedFiles,
      summary: {
        total: generatedFiles.length,
        errors: generatedFiles.filter((f) => f.path.startsWith("ERROR")).length,
      },
    },
    batchHasErrors ? 207 : 200,
  );
}
