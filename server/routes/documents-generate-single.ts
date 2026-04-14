// Handler for POST /api/documents/generate/:contractId
// Generates contract bundle PDFs (個別契約書 + 台帳 + optional 就業条件明示書)
import type { Context } from "hono";
import path from "node:path";
import { db } from "../db/index.js";
import { contracts, auditLog } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { generateKobetsuPDF } from "../pdf/kobetsu-pdf.js";
import { generateTsuchishoPDF } from "../pdf/tsuchisho-pdf.js";
import { generateHakensakiKanriDaichoPDF } from "../pdf/hakensakikanridaicho-pdf.js";
import { generateHakenmotoKanriDaichoPDF } from "../pdf/hakenmotokanridaicho-pdf.js";
import { generateShugyoJokenMeijishoPDF } from "../pdf/shugyojoken-pdf.js";
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
  getContractData,
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

export async function handleGenerateSingle(c: Context) {
  try {
  const contractId = Number(c.req.param("contractId"));
  if (!Number.isFinite(contractId) || contractId <= 0) {
    return c.json({ error: "Invalid contractId" }, 400);
  }
  const contract = await getContractData(contractId);
  let includeShugyojoken = false;
  let kobetsuCopies: 1 | 2 = 1;

  try {
    const body = await c.req.json<{ includeShugyojoken?: boolean; kobetsuCopies?: number }>();
    includeShugyojoken = body.includeShugyojoken === true;
    kobetsuCopies = body.kobetsuCopies === 2 ? 2 : 1;
  } catch {
    // keep defaults when body is missing/invalid
  }

  if (!contract) {
    return c.json({ error: "Contract not found" }, 404);
  }

  const common = buildCommonData(contract);
  const timestamp = toLocalDateStr(new Date());
  const prefix = sanitizeFilename(`${common.companyName}_${common.lineName || common.department}_${timestamp}`);
  const isKoritsu = common.companyName.includes("コーリツ");
  const outputDir = isKoritsu ? KORITSU_OUTPUT_DIR : KOBETSU_OUTPUT_DIR;

  const generatedFiles: { type: string; filename: string; path: string }[] = [];

  // Resolve employee list (時給 + 単価 separated)
  const empList = mapContractEmployeesToPDF(contract.employees);

  // ── KORITSU BRANCH: separate generators for コーリツ ──
  if (isKoritsu) {
    // 1. コーリツ 個別契約書 + 通知書
    try {
      const doc1 = createDoc();
      generateKoritsuKobetsuPDF(doc1, buildKoritsuKobetsuData(common, contract, empList));

      // Page 2+: コーリツ通知書
      doc1.addPage({ size: "A4", margin: 0 });
      generateKoritsuTsuchishoPDF(doc1, buildKoritsuTsuchishoData(common, contract, empList));

      const fn1 = `個別契約書_${prefix}.pdf`;
      await writeToFile(doc1, path.join(outputDir, fn1));
      generatedFiles.push({ type: "kobetsu", filename: fn1, path: `/api/documents/download/${encodeURIComponent(fn1)}` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      generatedFiles.push({ type: "kobetsu", filename: "", path: `ERROR: ${message}` });
    }

    // 2. コーリツ 派遣先管理台帳
    try {
      const doc3 = createDoc();
      empList.forEach((emp, idx) => {
        if (idx > 0) doc3.addPage({ size: "A4", margin: 0 });
        generateKoritsuDaichoPDF(doc3, buildKoritsuDaichoData(common, contract, empList, emp));
      });
      const fn3 = `派遣先管理台帳_${prefix}.pdf`;
      await writeToFile(doc3, path.join(outputDir, fn3));
      generatedFiles.push({ type: "hakensakiDaicho", filename: fn3, path: `/api/documents/download/${encodeURIComponent(fn3)}` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      generatedFiles.push({ type: "hakensakiDaicho", filename: "", path: `ERROR: ${message}` });
    }

    // 3. 派遣元管理台帳 — reuses standard generator (per CLAUDE.md)
    try {
      const doc4 = createDoc();
      empList.forEach((emp, idx) => {
        if (idx > 0) doc4.addPage({ size: "A4", margin: 0 });
        generateHakenmotoKanriDaichoPDF(doc4, buildHakenmotoDaichoData(common, emp));
      });
      const fn4 = `派遣元管理台帳_${prefix}.pdf`;
      await writeToFile(doc4, path.join(outputDir, fn4));
      generatedFiles.push({ type: "hakenmotoDaicho", filename: fn4, path: `/api/documents/download/${encodeURIComponent(fn4)}` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      generatedFiles.push({ type: "hakenmotoDaicho", filename: "", path: `ERROR: ${message}` });
    }
  } else {
  // ── STANDARD BRANCH: all other companies ──

  // ── 1. 個別契約書 + 通知書 (1 or 2 copies — 派遣先用 / 派遣元用) ──
  if (kobetsuCopies === 2) {
    // 2 copies: one for 派遣先, one for 派遣元
    for (const [copyLabel, typeKey] of [["派遣先用", "kobetsu_hakenSaki"], ["派遣元用", "kobetsu_hakenMoto"]] as [string, string][]) {
      try {
        const docCopy = createDoc();
        generateKobetsuPDF(docCopy, buildStandardKobetsuData(common, contract, empList));
        docCopy.addPage({ size: "A4", margin: 0 });
        generateTsuchishoPDF(docCopy, buildStandardTsuchishoData(common, empList));
        const fnCopy = `個別契約書_${copyLabel}_${prefix}.pdf`;
        await writeToFile(docCopy, path.join(outputDir, fnCopy));
        generatedFiles.push({ type: typeKey, filename: fnCopy, path: `/api/documents/download/${encodeURIComponent(fnCopy)}` });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        generatedFiles.push({ type: typeKey, filename: "", path: `ERROR: ${message}` });
      }
    }
  } else {
    // 1 copy (default)
    try {
      const doc1 = createDoc();
      generateKobetsuPDF(doc1, buildStandardKobetsuData(common, contract, empList));
      doc1.addPage({ size: "A4", margin: 0 });
      generateTsuchishoPDF(doc1, buildStandardTsuchishoData(common, empList));
      const fn1 = `個別契約書_${prefix}.pdf`;
      const filePath1 = path.join(outputDir, fn1);
      await writeToFile(doc1, filePath1);
      // Versionar el PDF para trazabilidad legal (派遣法)
      try {
        const buf1 = await readFile(filePath1);
        await recordPdfVersion({
          pdfType: "kobetsu",
          buffer: buf1,
          contractId,
          factoryId: contract.factoryId,
          metadata: { employeeCount: empList.length, contractNumber: contract.contractNumber },
        });
      } catch {
        // El versionado no debe bloquear la entrega del PDF
      }
      generatedFiles.push({ type: "kobetsu", filename: fn1, path: `/api/documents/download/${encodeURIComponent(fn1)}` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      generatedFiles.push({ type: "kobetsu", filename: "", path: `ERROR: ${message}` });
    }
  }

  // ── 3. 派遣先管理台帳 (one PDF, all employees — grouped by line) ──
  try {
    const doc3 = createDoc();
    empList.forEach((emp, idx) => {
      if (idx > 0) doc3.addPage({ size: "A4", margin: 0 });
      generateHakensakiKanriDaichoPDF(doc3, buildStandardDaichoData(common, emp));
    });
    const fn3 = `派遣先管理台帳_${prefix}.pdf`;
    await writeToFile(doc3, path.join(outputDir, fn3));
    generatedFiles.push({ type: "hakensakiDaicho", filename: fn3, path: `/api/documents/download/${encodeURIComponent(fn3)}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    generatedFiles.push({ type: "hakensakiDaicho", filename: "", path: `ERROR: ${message}` });
  }

  // ── 4. 派遣元管理台帳 (one PDF, all employees — grouped by line) ──
  try {
    const doc4 = createDoc();
    empList.forEach((emp, idx) => {
      if (idx > 0) doc4.addPage({ size: "A4", margin: 0 });
      generateHakenmotoKanriDaichoPDF(doc4, buildHakenmotoDaichoData(common, emp));
    });
    const fn4 = `派遣元管理台帳_${prefix}.pdf`;
    await writeToFile(doc4, path.join(outputDir, fn4));
    generatedFiles.push({ type: "hakenmotoDaicho", filename: fn4, path: `/api/documents/download/${encodeURIComponent(fn4)}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    generatedFiles.push({ type: "hakenmotoDaicho", filename: "", path: `ERROR: ${message}` });
  }

  if (includeShugyojoken) {
    // ── Optional. 就業条件明示書 (one PDF, all employees) ──
    try {
      const doc5 = createDoc();
      empList.forEach((emp, idx) => {
        if (idx > 0) doc5.addPage({ size: "A4", margin: 0 });
        generateShugyoJokenMeijishoPDF(doc5, { ...common, employee: emp });
      });
      const fn5 = `就業条件明示書_${prefix}.pdf`;
      await writeToFile(doc5, path.join(outputDir, fn5));
      generatedFiles.push({ type: "shugyoJoken", filename: fn5, path: `/api/documents/download/${encodeURIComponent(fn5)}` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      generatedFiles.push({ type: "shugyoJoken", filename: "", path: `ERROR: ${message}` });
    }
  }
  } // end standard branch

  // Update contract with pdfPath
  if (generatedFiles.length > 0 && generatedFiles[0].filename) {
    db.update(contracts)
      .set({ pdfPath: generatedFiles[0].filename, updatedAt: new Date().toISOString() })
      .where(eq(contracts.id, contractId))
      .run();
  }

  const indexedFiles = generatedFiles
    .map((f) => f.filename)
    .filter((filename): filename is string => Boolean(filename));

  const bundleSource = generatedFiles
    .filter((f) =>
      (f.type === "kobetsu" || f.type === "kobetsu_hakenSaki" || f.type === "kobetsu_hakenMoto" ||
       f.type === "hakensakiDaicho" || f.type === "hakenmotoDaicho") &&
      Boolean(f.filename) &&
      !f.path.startsWith("ERROR")
    )
    .map((f) => f.filename);

  if (bundleSource.length > 0) {
    try {
      const zipFilename = `契約書類一式_${prefix}.zip`;
      await createZipArchive(zipFilename, bundleSource, outputDir);
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

  await appendContractDocIndex(contractId, indexedFiles);

  // Audit log for document generation
  const successFiles = generatedFiles.filter((f) => !f.path.startsWith("ERROR:"));
  if (successFiles.length > 0) {
    db.insert(auditLog).values({
      action: "export",
      entityType: "document",
      entityId: contractId,
      detail: `PDF生成: ${successFiles.map((f) => f.type).join(", ")} (${contract.contractNumber})`,
      userName: "system",
    }).run();
  }

  const hasErrors = generatedFiles.some((f) => f.path.startsWith("ERROR:"));
  const allFailed = generatedFiles.length > 0 && generatedFiles.every((f) => f.path.startsWith("ERROR:"));
  return c.json(
    {
      success: !hasErrors,
      contractId,
      includeShugyojoken,
      files: generatedFiles,
      summary: {
        total: generatedFiles.length,
        errors: generatedFiles.filter((f) => f.path.startsWith("ERROR")).length,
      },
    },
    allFailed ? 500 : hasErrors ? 207 : 200,
  );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Document generation failed";
    return c.json({ error: message }, 500);
  }
}
