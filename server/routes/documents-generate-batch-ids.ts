// Handler for POST /api/documents/generate-by-ids — ID-based employee grouping + generation
import type { Context } from "hono";
import crypto from "node:crypto";
import path from "node:path";
import { db, sqlite } from "../db/index.js";
import { contracts, contractEmployees, factories, auditLog } from "../db/schema.js";
import { inArray } from "drizzle-orm";
import { generateKobetsuPDF } from "../pdf/kobetsu-pdf.js";
import { generateTsuchishoPDF } from "../pdf/tsuchisho-pdf.js";
import { generateHakensakiKanriDaichoPDF } from "../pdf/hakensakikanridaicho-pdf.js";
import { generateHakenmotoKanriDaichoPDF } from "../pdf/hakenmotokanridaicho-pdf.js";
import { generateKoritsuKobetsuPDF } from "../pdf/koritsu-kobetsu-pdf.js";
import { generateKoritsuDaichoPDF } from "../pdf/koritsu-hakensakidaicho-pdf.js";
import { generateKoritsuTsuchishoPDF } from "../pdf/koritsu-tsuchisho-pdf.js";
import { toLocalDateStr, calculateContractDate, calculateNotificationDate } from "../services/contract-dates.js";
import { generateContractNumber } from "../services/contract-number.js";
import { groupEmployeesByIds } from "./contracts-batch.js";
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

// ─── POST /api/documents/generate-by-ids ─────────────────────────────
export async function handleGenerateByIds(c: Context) {
  try {
    let body: { ids: string[]; idType: "hakensaki" | "hakenmoto"; contractStart: string; contractEnd: string; kobetsuCopies?: number };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const { ids, idType, contractStart, contractEnd } = body;
    const kobetsuCopies: 1 | 2 = body.kobetsuCopies === 2 ? 2 : 1;

    if (!ids?.length || !idType || !contractStart || !contractEnd) {
      return c.json({ error: "ids, idType, contractStart, contractEnd are required" }, 400);
    }

    const { groups, notFoundIds } = await groupEmployeesByIds(ids, idType, contractStart, contractEnd);

    if (groups.length === 0) {
      return c.json({ error: "No se encontraron empleados para los IDs proporcionados", notFoundIds }, 404);
    }

    // Pre-fetch all factories needed (async, before the transaction)
    const uniqueFactoryIds = [...new Set(groups.map((g) => g.factoryId))];
    const factoryRows = await db.query.factories.findMany({
      where: inArray(factories.id, uniqueFactoryIds),
    });
    const factoryById = new Map(factoryRows.map((f) => [f.id, f]));

    // ── Step 1: Create one contract per group (in a transaction) ──────
    const operationId = crypto.randomUUID();
    const createdContracts: { id: number; contractNumber: string; factoryName: string | null; startDate: string; endDate: string; employeeCount: number }[] = [];

    sqlite.transaction(() => {
      for (const group of groups) {
        const contractDate = calculateContractDate(group.startDate);
        const notificationDate = calculateNotificationDate(group.startDate);
        const contractNumber = generateContractNumber(group.startDate);
        const rate = group.billingRate;

        const factory = factoryById.get(group.factoryId);

        if (!factory) return;

        const { workStartTime = "", workEndTime = "" } = (() => {
          try {
            const wh = factory.workHours ?? "";
            const match = wh.match(/(\d{2}:\d{2})[^\d]*(\d{2}:\d{2})/);
            return match ? { workStartTime: match[1], workEndTime: match[2] } : {};
          } catch { return {}; }
        })();

        const contract = db.insert(contracts).values({
          contractNumber,
          status: "draft",
          companyId: group.companyId,
          factoryId: group.factoryId,
          startDate: group.startDate,
          endDate: group.endDate,
          contractDate,
          notificationDate,
          workDays: factory.workDays ?? "",
          workStartTime,
          workEndTime,
          breakMinutes: factory.breakTime ?? 60,
          supervisorName: factory.supervisorName ?? "",
          supervisorDept: factory.supervisorDept ?? "",
          supervisorPhone: factory.supervisorPhone ?? "",
          complaintHandlerClient: factory.complaintClientName ?? "",
          complaintHandlerUns: factory.complaintUnsName ?? "",
          hakenmotoManager: factory.managerUnsName ?? "",
          safetyMeasures: "派遣先責任者の指示に従い安全衛生に関する法令を遵守する",
          terminationMeasures: "契約期間中に契約を解除する場合は、30日以上前に予告する",
          jobDescription: factory.jobDescription ?? "",
          responsibilityLevel: "指示を受けて行う",
          overtimeMax: factory.overtimeHours ?? "",
          welfare: "派遣先の福利厚生施設の利用可",
          isKyoteiTaisho: true,
          hourlyRate: rate,
          overtimeRate: Math.round(rate * 1.25),
          nightShiftRate: Math.round(rate * 1.25),
          holidayRate: Math.round(rate * 1.35),
          notes: "ID指定作成",
        }).returning().get();

        const assignments = group.employees.map((emp) => ({
          contractId: contract.id,
          employeeId: emp.id,
          hourlyRate: emp.billingRate ?? emp.hourlyRate ?? rate,
        }));
        db.insert(contractEmployees).values(assignments).run();

        db.insert(auditLog).values({
          action: "create",
          entityType: "contract",
          entityId: contract.id,
          detail: `ID指定作成: ${contractNumber} (${group.factoryName ?? ""} ¥${rate}/h, ${group.employees.length}名)`,
          userName: "system",
          operationId,
        }).run();

        createdContracts.push({
          id: contract.id,
          contractNumber: contract.contractNumber,
          factoryName: group.factoryName,
          startDate: group.startDate,
          endDate: group.endDate,
          employeeCount: group.employees.length,
        });
      }
    })();

    if (createdContracts.length === 0) {
      return c.json({ error: "契約の作成に失敗しました" }, 500);
    }

    // ── Step 2: Generate PDFs for each created contract ───────────────
    const contractIds = createdContracts.map((ct) => ct.id);
    const contractsData = await db.query.contracts.findMany({
      where: inArray(contracts.id, contractIds),
      with: { company: true, factory: true, employees: { with: { employee: true } } },
    });

    const timestamp = toLocalDateStr(new Date());
    // File buckets by type for merging (standard only — koritsu stays individual)
    const bucketKobetsuHakensaki: string[] = [];
    const bucketKobetsuHakenmoto: string[] = [];
    const bucketKobetsuSingle: string[] = [];
    const bucketHakensaki: string[] = [];
    const bucketHakenmoto: string[] = [];
    const koritsuFiles: string[] = [];
    let totalEmployeeCount = 0;

    for (const contract of contractsData) {
      const common = buildCommonData(contract);
      const empList = mapContractEmployeesToPDF(contract.employees);
      totalEmployeeCount += empList.length;
      const isKoritsu = common.companyName.includes("コーリツ");
      const outputDir = isKoritsu ? KORITSU_OUTPUT_DIR : KOBETSU_OUTPUT_DIR;
      const prefix = sanitizeFilename(`${contract.contractNumber}_${common.lineName || common.department || common.factoryName}`);

      if (isKoritsu) {
        // Koritsu: individual files (no merge)
        try {
          const doc1 = createDoc();
          generateKoritsuKobetsuPDF(doc1, buildKoritsuKobetsuData(common, contract, empList));
          doc1.addPage({ size: "A4", margin: 0 });
          generateKoritsuTsuchishoPDF(doc1, buildKoritsuTsuchishoData(common, contract, empList));
          const fn1 = `個別契約書_${prefix}.pdf`;
          await writeToFile(doc1, path.join(outputDir, fn1));
          koritsuFiles.push(fn1);
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

      } else {
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
      }
    }

    // ── Merge standard PDFs by type ───────────────────────────────────
    const firstGroup = groups[0];
    const mergeLabel = sanitizeFilename(firstGroup.companyName);
    const mergedFiles: string[] = [];
    const stdOutputDir = KOBETSU_OUTPUT_DIR;

    if (kobetsuCopies === 2) {
      if (bucketKobetsuHakensaki.length > 0) {
        const fn = `個別契約書_派遣先用_一括_${mergeLabel}.pdf`;
        await mergePdfs(bucketKobetsuHakensaki, path.join(stdOutputDir, fn));
        mergedFiles.push(fn);
      }
      if (bucketKobetsuHakenmoto.length > 0) {
        const fn = `個別契約書_派遣元用_一括_${mergeLabel}.pdf`;
        await mergePdfs(bucketKobetsuHakenmoto, path.join(stdOutputDir, fn));
        mergedFiles.push(fn);
      }
    } else if (bucketKobetsuSingle.length > 0) {
      const fn = `個別契約書_一括_${mergeLabel}.pdf`;
      await mergePdfs(bucketKobetsuSingle, path.join(stdOutputDir, fn));
      mergedFiles.push(fn);
    }
    if (bucketHakensaki.length > 0) {
      const fn = `派遣先管理台帳_一括_${mergeLabel}.pdf`;
      await mergePdfs(bucketHakensaki, path.join(stdOutputDir, fn));
      mergedFiles.push(fn);
    }
    if (bucketHakenmoto.length > 0) {
      const fn = `派遣元管理台帳_一括_${mergeLabel}.pdf`;
      await mergePdfs(bucketHakenmoto, path.join(stdOutputDir, fn));
      mergedFiles.push(fn);
    }

    const allFiles = [...mergedFiles, ...koritsuFiles];

    // ── Step 3: Bundle into master ZIP ────────────────────────────────
    const zipLabel = sanitizeFilename(`${firstGroup.companyName}_ID指定_${timestamp}`);
    const zipFilename = `ID指定一括_${zipLabel}.zip`;
    const zipOutputDir = mergedFiles.length > 0 ? KOBETSU_OUTPUT_DIR : KORITSU_OUTPUT_DIR;

    if (allFiles.length > 0) {
      await createZipArchive(zipFilename, allFiles, zipOutputDir);
    }

    return c.json({
      success: true,
      contractCount: createdContracts.length,
      employeeCount: totalEmployeeCount,
      fileCount: allFiles.length,
      kobetsuCopies,
      notFoundIds,
      zipFilename: allFiles.length > 0 ? zipFilename : null,
      zipPath: allFiles.length > 0 ? `/api/documents/download/${encodeURIComponent(zipFilename)}` : null,
      contracts: createdContracts,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ID指定生成に失敗しました";
    return c.json({ error: message }, 500);
  }
}
