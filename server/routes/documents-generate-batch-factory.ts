// Handler for POST /api/documents/generate-factory — all documents for a factory
import type { Context } from "hono";
import path from "node:path";
import { db } from "../db/index.js";
import { contracts, factories, auditLog } from "../db/schema.js";
import { eq } from "drizzle-orm";
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
import { mergePdfs } from "./documents-generate-batch-utils.js";
import { recordPdfVersion } from "../services/pdf-versioning.js";
import fs from "node:fs";

// ─── POST /api/documents/generate-factory ────────────────────────────
export async function handleGenerateFactory(c: Context) {
  try {
    let body: { factoryId: number; kobetsuCopies?: number };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const { factoryId } = body;
    const kobetsuCopies: 1 | 2 = body.kobetsuCopies === 2 ? 2 : 1;

    if (!factoryId || typeof factoryId !== "number" || factoryId <= 0) {
      return c.json({ error: "factoryId is required" }, 400);
    }

    // Verify factory exists
    const factory = await db.query.factories.findFirst({
      where: eq(factories.id, factoryId),
      with: { company: true },
    });

    if (!factory) {
      return c.json({ error: "Factory not found" }, 404);
    }

    // Get all contracts for this factory (filter active/draft in JS below)
    const activeContracts = await db.query.contracts.findMany({
      where: eq(contracts.factoryId, factoryId),
      with: {
        company: true,
        factory: true,
        employees: { with: { employee: true } },
      },
    });

    const filteredContracts = activeContracts.filter(
      (ct) => ct.status === "active" || ct.status === "draft"
    );

    if (filteredContracts.length === 0) {
      return c.json({ error: "稼働中の契約が見つかりません" }, 404);
    }

    const isKoritsu = (factory.company?.name ?? "").includes("コーリツ");
    const outputDir = isKoritsu ? KORITSU_OUTPUT_DIR : KOBETSU_OUTPUT_DIR;
    const timestamp = toLocalDateStr(new Date());
    const factoryLabel = sanitizeFilename(
      [factory.factoryName, factory.department, factory.lineName].filter(Boolean).join("_")
    );

    // File buckets by type (standard only — koritsu keeps individual files)
    const bucketKobetsuHakensaki: string[] = []; // 個別契約書_派遣先用 per contract
    const bucketKobetsuHakenmoto: string[] = []; // 個別契約書_派遣元用 per contract
    const bucketKobetsuSingle: string[] = [];    // 個別契約書 (1-copy mode)
    const bucketHakensaki: string[] = [];         // 派遣先管理台帳 per contract
    const bucketHakenmoto: string[] = [];         // 派遣元管理台帳 per contract
    const koritsuFiles: string[] = [];            // Koritsu: kept as individual files
    let totalEmployees = 0;

    for (const contract of filteredContracts) {
      const common = buildCommonData(contract);
      const empList = mapContractEmployeesToPDF(contract.employees);
      totalEmployees += empList.length;
      const prefix = sanitizeFilename(`${contract.contractNumber}_${common.lineName || common.department || common.factoryName}`);

      if (isKoritsu) {
        // ── Koritsu: individual files (no merge) ──
        try {
          const docK = createDoc();
          generateKoritsuKobetsuPDF(docK, buildKoritsuKobetsuData(common, contract, empList));
          docK.addPage({ size: "A4", margin: 0 });
          generateKoritsuTsuchishoPDF(docK, buildKoritsuTsuchishoData(common, contract, empList));
          const fnK = `個別契約書_${prefix}.pdf`;
          await writeToFile(docK, path.join(outputDir, fnK));
          koritsuFiles.push(fnK);
        } catch { /* skip */ }

        try {
          const docD = createDoc();
          empList.forEach((emp, idx) => {
            if (idx > 0) docD.addPage({ size: "A4", margin: 0 });
            generateKoritsuDaichoPDF(docD, buildKoritsuDaichoData(common, contract, empList, emp));
          });
          const fnD = `派遣先管理台帳_${prefix}.pdf`;
          await writeToFile(docD, path.join(outputDir, fnD));
          koritsuFiles.push(fnD);
        } catch { /* skip */ }

      } else {
        // ── Standard: 個別契約書+通知書 (1 or 2 copies) ──
        if (kobetsuCopies === 2) {
          try {
            const docHS = createDoc();
            generateKobetsuPDF(docHS, buildStandardKobetsuData(common, contract, empList));
            docHS.addPage({ size: "A4", margin: 0 });
            generateTsuchishoPDF(docHS, buildStandardTsuchishoData(common, empList));
            const fnHS = `個別契約書_派遣先用_${prefix}.pdf`;
            await writeToFile(docHS, path.join(outputDir, fnHS));
            try {
              const bufHS = fs.readFileSync(path.join(outputDir, fnHS));
              await recordPdfVersion({
                pdfType: "kobetsu",
                buffer: bufHS,
                contractId: contract.id,
                factoryId: contract.factoryId,
                metadata: { employeeCount: empList.length, contractNumber: contract.contractNumber },
              });
            } catch { /* versioning no bloquea la entrega */ }
            bucketKobetsuHakensaki.push(path.join(outputDir, fnHS));
          } catch { /* skip */ }

          try {
            const docHM = createDoc();
            generateKobetsuPDF(docHM, buildStandardKobetsuData(common, contract, empList));
            docHM.addPage({ size: "A4", margin: 0 });
            generateTsuchishoPDF(docHM, buildStandardTsuchishoData(common, empList));
            const fnHM = `個別契約書_派遣元用_${prefix}.pdf`;
            await writeToFile(docHM, path.join(outputDir, fnHM));
            bucketKobetsuHakenmoto.push(path.join(outputDir, fnHM));
          } catch { /* skip */ }
        } else {
          try {
            const doc1 = createDoc();
            generateKobetsuPDF(doc1, buildStandardKobetsuData(common, contract, empList));
            doc1.addPage({ size: "A4", margin: 0 });
            generateTsuchishoPDF(doc1, buildStandardTsuchishoData(common, empList));
            const fn1 = `個別契約書_${prefix}.pdf`;
            await writeToFile(doc1, path.join(outputDir, fn1));
            try {
              const bufK = fs.readFileSync(path.join(outputDir, fn1));
              await recordPdfVersion({
                pdfType: "kobetsu",
                buffer: bufK,
                contractId: contract.id,
                factoryId: contract.factoryId,
                metadata: { employeeCount: empList.length, contractNumber: contract.contractNumber },
              });
            } catch { /* versioning no bloquea la entrega */ }
            bucketKobetsuSingle.push(path.join(outputDir, fn1));
          } catch { /* skip */ }
        }

        // ── Standard: 派遣先管理台帳 ──
        try {
          const doc3 = createDoc();
          empList.forEach((emp, idx) => {
            if (idx > 0) doc3.addPage({ size: "A4", margin: 0 });
            generateHakensakiKanriDaichoPDF(doc3, buildStandardDaichoData(common, emp));
          });
          const fn3 = `派遣先管理台帳_${prefix}.pdf`;
          await writeToFile(doc3, path.join(outputDir, fn3));
          bucketHakensaki.push(path.join(outputDir, fn3));
        } catch { /* skip */ }
      }

      // ── 派遣元管理台帳 (standard only — koritsu handles separately above) ──
      if (!isKoritsu) {
        try {
          const doc4 = createDoc();
          empList.forEach((emp, idx) => {
            if (idx > 0) doc4.addPage({ size: "A4", margin: 0 });
            generateHakenmotoKanriDaichoPDF(doc4, buildHakenmotoDaichoData(common, emp));
          });
          const fn4 = `派遣元管理台帳_${prefix}.pdf`;
          await writeToFile(doc4, path.join(outputDir, fn4));
          bucketHakenmoto.push(path.join(outputDir, fn4));
        } catch { /* skip */ }
      } else {
        // Koritsu: 派遣元管理台帳 as individual file
        try {
          const doc4 = createDoc();
          empList.forEach((emp, idx) => {
            if (idx > 0) doc4.addPage({ size: "A4", margin: 0 });
            generateHakenmotoKanriDaichoPDF(doc4, buildHakenmotoDaichoData(common, emp));
          });
          const fn4 = `派遣元管理台帳_${prefix}.pdf`;
          await writeToFile(doc4, path.join(outputDir, fn4));
          koritsuFiles.push(fn4);
        } catch { /* skip */ }
      }
    }

    // ── Merge standard PDFs by type ───────────────────────────────────
    const mergedFiles: string[] = [];
    if (kobetsuCopies === 2) {
      if (bucketKobetsuHakensaki.length > 0) {
        const fn = `個別契約書_派遣先用_一括_${factoryLabel}.pdf`;
        await mergePdfs(bucketKobetsuHakensaki, path.join(outputDir, fn));
        mergedFiles.push(fn);
      }
      if (bucketKobetsuHakenmoto.length > 0) {
        const fn = `個別契約書_派遣元用_一括_${factoryLabel}.pdf`;
        await mergePdfs(bucketKobetsuHakenmoto, path.join(outputDir, fn));
        mergedFiles.push(fn);
      }
    } else if (bucketKobetsuSingle.length > 0) {
      const fn = `個別契約書_一括_${factoryLabel}.pdf`;
      await mergePdfs(bucketKobetsuSingle, path.join(outputDir, fn));
      mergedFiles.push(fn);
    }
    if (bucketHakensaki.length > 0) {
      const fn = `派遣先管理台帳_一括_${factoryLabel}.pdf`;
      await mergePdfs(bucketHakensaki, path.join(outputDir, fn));
      mergedFiles.push(fn);
    }
    if (bucketHakenmoto.length > 0) {
      const fn = `派遣元管理台帳_一括_${factoryLabel}.pdf`;
      await mergePdfs(bucketHakenmoto, path.join(outputDir, fn));
      mergedFiles.push(fn);
    }

    const allFiles = [...mergedFiles, ...koritsuFiles];

    if (allFiles.length === 0) {
      return c.json({ error: "PDF生成に失敗しました" }, 500);
    }

    // Create master ZIP with merged files (+ individual koritsu files)
    const zipFilename = `工場一括_${factoryLabel}_${timestamp}.zip`;
    await createZipArchive(zipFilename, allFiles, outputDir);

    // Audit log
    db.insert(auditLog).values({
      action: "export",
      entityType: "document",
      entityId: factoryId,
      detail: `工場一括PDF生成: ${factory.factoryName} / ${filteredContracts.length}契約 / ${totalEmployees}名 / ${allFiles.length}ファイル`,
      userName: "system",
    }).run();

    return c.json({
      success: true,
      factoryId,
      factoryName: factory.factoryName,
      department: factory.department,
      lineName: factory.lineName,
      contractCount: filteredContracts.length,
      employeeCount: totalEmployees,
      fileCount: allFiles.length,
      kobetsuCopies,
      zipFilename,
      zipPath: `/api/documents/download/${encodeURIComponent(zipFilename)}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "工場一括生成に失敗しました";
    return c.json({ error: message }, 500);
  }
}
