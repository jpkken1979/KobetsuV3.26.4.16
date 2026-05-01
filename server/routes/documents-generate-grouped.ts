/**
 * POST /api/documents/generate-grouped
 *
 * Generates grouped PDFs from selected contracts:
 * - kobetsu: all 個別契約書 combined into 1 PDF
 * - tsuchisho: all 通知書 combined into 1 PDF
 * - daicho: 派遣先 + 派遣元 interleaved in 1 PDF
 * - all: ZIP with all 3 types
 *
 * Reuses existing PDF generators (kobetsu, tsuchisho, hakensaki/hakenmoto daicho).
 * Supports both standard and koritsu variants (auto-detected per contract).
 */
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
import { generateKoritsuTsuchishoPDF } from "../pdf/koritsu-tsuchisho-pdf.js";
import { generateKoritsuDaichoPDF } from "../pdf/koritsu-hakensakidaicho-pdf.js";
import { toLocalDateStr } from "../services/contract-dates.js";
import { mapContractEmployeesToPDF } from "../services/employee-mapper.js";
import {
  createDoc,
  writeToFile,
  createZipArchive,
  buildCommonDataForPDF,
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

const generateGroupedSchema = z.object({
  contractIds: z.array(z.number().int().positive()).min(1, "contractIds must be a non-empty array"),
  groupBy: z.enum(["kobetsu", "tsuchisho", "daicho", "kobetsu-tsuchisho", "all"]).default("all"),
});

export async function handleGenerateGrouped(c: Context) {
  const parsed = generateGroupedSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: "Invalid request body", details: parsed.error.flatten() }, 400);
  }

  const { contractIds, groupBy } = parsed.data;

  // Bulk load contracts with all relations
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
  const timestamp = toLocalDateStr(new Date());

  // Group contracts by company type (standard vs koritsu)
  const standardContracts = contractsData.filter((c) => !c.company?.name?.includes("コーリツ"));
  const koritsuContracts = contractsData.filter((c) => c.company?.name?.includes("コーリツ"));

  // ── Kobetsu grouped PDF ──────────────────────────────────────────────
  if (groupBy === "kobetsu" || groupBy === "all") {
    if (standardContracts.length > 0) {
      const doc = createDoc();
      for (let idx = 0; idx < standardContracts.length; idx++) {
        const contract = standardContracts[idx];
        if (idx > 0) doc.addPage({ size: "A4", margin: 0 });
        const common = await buildCommonDataForPDF(contract);
        const empList = mapContractEmployeesToPDF(contract.employees);
        generateKobetsuPDF(doc, buildStandardKobetsuData(common, contract, empList));
      }
      const fn = `kobetsu_全部_${timestamp}.pdf`;
      await writeToFile(doc, path.join(KOBETSU_OUTPUT_DIR, fn));
      generatedFiles.push({ type: "kobetsu", filename: fn, path: `/api/documents/download/${encodeURIComponent(fn)}` });
    }
    if (koritsuContracts.length > 0) {
      const doc = createDoc();
      for (let idx = 0; idx < koritsuContracts.length; idx++) {
        const contract = koritsuContracts[idx];
        if (idx > 0) doc.addPage({ size: "A4", margin: 0 });
        const common = await buildCommonDataForPDF(contract);
        const empList = mapContractEmployeesToPDF(contract.employees);
        generateKoritsuKobetsuPDF(doc, buildKoritsuKobetsuData(common, contract, empList));
      }
      const fn = `kobetsu_全部_${timestamp}.pdf`;
      await writeToFile(doc, path.join(KORITSU_OUTPUT_DIR, fn));
      generatedFiles.push({ type: "kobetsu", filename: fn, path: `/api/documents/download/${encodeURIComponent(fn)}` });
    }
  }

  // ── Tsuchisho grouped PDF ───────────────────────────────────────────
  if (groupBy === "tsuchisho" || groupBy === "all") {
    if (standardContracts.length > 0) {
      const doc = createDoc();
      let pageIdx = 0;
      for (const contract of standardContracts) {
        const common = await buildCommonDataForPDF(contract);
        const empList = mapContractEmployeesToPDF(contract.employees);
        if (pageIdx > 0) doc.addPage({ size: "A4", margin: 0 });
        pageIdx++;
        generateTsuchishoPDF(doc, buildStandardTsuchishoData(common, empList));
      }
      const fn = `tsuchisho_全部_${timestamp}.pdf`;
      await writeToFile(doc, path.join(KOBETSU_OUTPUT_DIR, fn));
      generatedFiles.push({ type: "tsuchisho", filename: fn, path: `/api/documents/download/${encodeURIComponent(fn)}` });
    }
    if (koritsuContracts.length > 0) {
      const doc = createDoc();
      let pageIdx = 0;
      for (const contract of koritsuContracts) {
        const common = await buildCommonDataForPDF(contract);
        const empList = mapContractEmployeesToPDF(contract.employees);
        if (pageIdx > 0) doc.addPage({ size: "A4", margin: 0 });
        pageIdx++;
        generateKoritsuTsuchishoPDF(doc, buildKoritsuTsuchishoData(common, contract, empList));
      }
      const fn = `tsuchisho_全部_${timestamp}.pdf`;
      await writeToFile(doc, path.join(KORITSU_OUTPUT_DIR, fn));
      generatedFiles.push({ type: "tsuchisho", filename: fn, path: `/api/documents/download/${encodeURIComponent(fn)}` });
    }
  }

  // ── Daicho grouped PDF (派遣先 + 派遣元 interleaved) ────────────────
  if (groupBy === "daicho" || groupBy === "all") {
    if (standardContracts.length > 0) {
      const doc = createDoc();
      let pageIdx = 0;
      for (const contract of standardContracts) {
        const common = await buildCommonDataForPDF(contract);
        const empList = mapContractEmployeesToPDF(contract.employees);
        for (const emp of empList) {
          if (pageIdx > 0) doc.addPage({ size: "A4", margin: 0 });
          pageIdx++;
          // 派遣先管理台帳
          generateHakensakiKanriDaichoPDF(doc, buildStandardDaichoData(common, emp));
          doc.addPage({ size: "A4", margin: 0 });
          pageIdx++;
          // 派遣元管理台帳
          generateHakenmotoKanriDaichoPDF(doc, buildHakenmotoDaichoData(common, emp));
        }
      }
      const fn = `daicho_全部_${timestamp}.pdf`;
      await writeToFile(doc, path.join(KOBETSU_OUTPUT_DIR, fn));
      generatedFiles.push({ type: "daicho", filename: fn, path: `/api/documents/download/${encodeURIComponent(fn)}` });
    }
    if (koritsuContracts.length > 0) {
      const doc = createDoc();
      let pageIdx = 0;
      for (const contract of koritsuContracts) {
        const common = await buildCommonDataForPDF(contract);
        const empList = mapContractEmployeesToPDF(contract.employees);
        for (const emp of empList) {
          if (pageIdx > 0) doc.addPage({ size: "A4", margin: 0 });
          pageIdx++;
          // コーリツ uses 派遣先台帳 only (Koritsu variant)
          generateKoritsuDaichoPDF(doc, buildKoritsuDaichoData(common, contract, empList, emp));
          doc.addPage({ size: "A4", margin: 0 });
          pageIdx++;
          // 派遣元管理台帳 (standard generator works for koritsu too)
          generateHakenmotoKanriDaichoPDF(doc, buildHakenmotoDaichoData(common, emp));
        }
      }
      const fn = `daicho_全部_${timestamp}.pdf`;
      await writeToFile(doc, path.join(KORITSU_OUTPUT_DIR, fn));
      generatedFiles.push({ type: "daicho", filename: fn, path: `/api/documents/download/${encodeURIComponent(fn)}` });
    }
  }

  // ── Kobetsu + Tsuchisho INTERCALADO (un solo PDF, frentes + traseras) ──
  if (groupBy === "kobetsu-tsuchisho") {
    // Standard companies: kobetsu + tsuchisho alternados en un solo PDF
    if (standardContracts.length > 0) {
      const doc = createDoc();
      let pageIdx = 0;
      for (let idx = 0; idx < standardContracts.length; idx++) {
        const contract = standardContracts[idx];
        const common = await buildCommonDataForPDF(contract);
        const empList = mapContractEmployeesToPDF(contract.employees);
        // Por cada empleado: kobetsu (frente) + tsuchisho (atras)
        for (const emp of empList) {
          // Frente: kobetsu
          if (pageIdx > 0) doc.addPage({ size: "A4", margin: 0 });
          pageIdx++;
          generateKobetsuPDF(doc, buildStandardKobetsuData(common, contract, empList));
          // Atras: tsuchisho (empList = todos los empleados del contrato)
          doc.addPage({ size: "A4", margin: 0 });
          pageIdx++;
          generateTsuchishoPDF(doc, buildStandardTsuchishoData(common, empList));
        }
      }
      const fn = `kobetsu_tsuchisho_全部_${timestamp}.pdf`;
      await writeToFile(doc, path.join(KOBETSU_OUTPUT_DIR, fn));
      generatedFiles.push({ type: "kobetsu-tsuchisho", filename: fn, path: `/api/documents/download/${encodeURIComponent(fn)}` });
    }
    // Koritsu companies: same pattern
    if (koritsuContracts.length > 0) {
      const doc = createDoc();
      let pageIdx = 0;
      for (const contract of koritsuContracts) {
        const common = await buildCommonDataForPDF(contract);
        const empList = mapContractEmployeesToPDF(contract.employees);
        for (const emp of empList) {
          if (pageIdx > 0) doc.addPage({ size: "A4", margin: 0 });
          pageIdx++;
          generateKoritsuKobetsuPDF(doc, buildKoritsuKobetsuData(common, contract, empList));
          doc.addPage({ size: "A4", margin: 0 });
          pageIdx++;
          generateKoritsuTsuchishoPDF(doc, buildKoritsuTsuchishoData(common, contract, empList));
        }
      }
      const fn = `kobetsu_tsuchisho_全部_${timestamp}.pdf`;
      await writeToFile(doc, path.join(KORITSU_OUTPUT_DIR, fn));
      generatedFiles.push({ type: "kobetsu-tsuchisho", filename: fn, path: `/api/documents/download/${encodeURIComponent(fn)}` });
    }
  }

  // ── ZIP with all PDFs ────────────────────────────────────────────────
  if (groupBy === "all") {
    const zipName = `grouped_all_${timestamp}.zip`;
    const zipFiles = generatedFiles.map((f) => f.filename).filter(Boolean) as string[];

    if (zipFiles.length > 0) {
      await createZipArchive(zipName, zipFiles, KOBETSU_OUTPUT_DIR);
      generatedFiles.push({
        type: "zip",
        filename: zipName,
        path: `/api/documents/download/${encodeURIComponent(zipName)}`,
      });
    }
  }

  // ── Audit log ────────────────────────────────────────────────────────
  db.insert(auditLog).values({
    action: "export",
    entityType: "document",
    entityId: null,
    detail: `grouped PDF生成: ${contractsData.length}契約, groupBy=${groupBy}, ${generatedFiles.length}ファイル`,
    userName: "system",
  }).run();

  return c.json({
    success: true,
    contractCount: contractsData.length,
    files: generatedFiles,
    groupBy,
  });
}
