// Handler for POST /api/documents/generate-set — combined PDF set for shared factory/line
import type { Context } from "hono";
import fs from "node:fs";
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
import { mapContractEmployeesToPDF } from "../services/employee-mapper.js";
import { sanitizeFilename } from "../services/document-files.js";
import {
  createDoc,
  writeToFile,
  buildCommonData,
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
import { SET_OUTPUT_DIR } from "./documents-generate-batch-utils.js";
import { recordPdfVersion } from "../services/pdf-versioning.js";

// ─── POST /api/documents/generate-set ────────────────────────────────
export async function handleGenerateSet(c: Context) {
  try {
    let body: { contractIds: number[]; kobetsuCopies?: number };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const { contractIds } = body;
    const kobetsuCopies = body.kobetsuCopies === 1 ? 1 : 2; // default: 2 copies (甲+乙)
    if (!contractIds || !Array.isArray(contractIds) || contractIds.length === 0) {
      return c.json({ error: "contractIds array is required" }, 400);
    }

    // Bulk-fetch all contracts with relations (avoids N+1)
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

    // Ensure output/set/ exists
    if (!fs.existsSync(SET_OUTPUT_DIR)) {
      fs.mkdirSync(SET_OUTPUT_DIR, { recursive: true });
    }

    // Build common data from the FIRST contract (all contracts share the same factory)
    const firstContract = contractsData[0];
    const common = buildCommonData(firstContract);
    const isKoritsu = common.companyName.includes("コーリツ");

    // Build filename prefix: SET_個別契約書_会社名_工場名_部門_ライン
    const setPrefix = sanitizeFilename(
      `${common.companyName}_${common.factoryName}_${common.department}_${common.lineName}`.replace(/_+$/, ""),
    );

    // Collect ALL employees across ALL contracts in order
    const allEmpLists = contractsData.map((contract) => ({
      contract,
      empList: mapContractEmployeesToPDF(contract.employees),
    }));
    const allEmployees = allEmpLists.flatMap(({ empList }) => empList);

    const generatedFiles: { type: string; filename: string; path: string }[] = [];

    if (isKoritsu) {
      // ── KORITSU SET BRANCH ──

      // 1. Combined 個別契約書: front (KoritsuKobetsu) + back (KoritsuTsuchisho) per contract
      try {
        const docKobetsu = createDoc();
        let pageIndex = 0;
        for (const { contract, empList } of allEmpLists) {
          const contractCommon = buildCommonData(contract);
          const koritsuKobetsuData = buildKoritsuKobetsuData(contractCommon, contract, empList);
          const koritsuTsuchishoData = buildKoritsuTsuchishoData(contractCommon, contract, empList);
          // 2 copies per contract: 甲(client) + 乙(UNS) for duplex printing
          for (let copy = 0; copy < kobetsuCopies; copy++) {
            if (pageIndex > 0) docKobetsu.addPage({ size: "A4", margin: 0 });
            generateKoritsuKobetsuPDF(docKobetsu, koritsuKobetsuData);
            docKobetsu.addPage({ size: "A4", margin: 0 });
            generateKoritsuTsuchishoPDF(docKobetsu, koritsuTsuchishoData);
            pageIndex += 2;
          }
        }
        const fnKobetsu = `SET_個別契約書_${setPrefix}.pdf`;
        await writeToFile(docKobetsu, path.join(SET_OUTPUT_DIR, fnKobetsu));
        generatedFiles.push({ type: "kobetsu", filename: fnKobetsu, path: `/api/documents/download/${encodeURIComponent(fnKobetsu)}` });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        generatedFiles.push({ type: "kobetsu", filename: "", path: `ERROR: ${message}` });
      }

      // 2. Combined 派遣先管理台帳 (Koritsu)
      try {
        const docHakensaki = createDoc();
        allEmployees.forEach((emp, idx) => {
          if (idx > 0) docHakensaki.addPage({ size: "A4", margin: 0 });
          generateKoritsuDaichoPDF(docHakensaki, buildKoritsuDaichoData(common, firstContract, allEmployees, emp));
        });
        const fnHakensaki = `SET_派遣先管理台帳_${setPrefix}.pdf`;
        await writeToFile(docHakensaki, path.join(SET_OUTPUT_DIR, fnHakensaki));
        generatedFiles.push({ type: "hakensakiDaicho", filename: fnHakensaki, path: `/api/documents/download/${encodeURIComponent(fnHakensaki)}` });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        generatedFiles.push({ type: "hakensakiDaicho", filename: "", path: `ERROR: ${message}` });
      }

      // 3. Combined 派遣元管理台帳 (standard generator per CLAUDE.md)
      try {
        const docHakenmoto = createDoc();
        allEmployees.forEach((emp, idx) => {
          if (idx > 0) docHakenmoto.addPage({ size: "A4", margin: 0 });
          generateHakenmotoKanriDaichoPDF(docHakenmoto, buildHakenmotoDaichoData(common, emp));
        });
        const fnHakenmoto = `SET_派遣元管理台帳_${setPrefix}.pdf`;
        await writeToFile(docHakenmoto, path.join(SET_OUTPUT_DIR, fnHakenmoto));
        generatedFiles.push({ type: "hakenmotoDaicho", filename: fnHakenmoto, path: `/api/documents/download/${encodeURIComponent(fnHakenmoto)}` });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        generatedFiles.push({ type: "hakenmotoDaicho", filename: "", path: `ERROR: ${message}` });
      }
    } else {
      // ── STANDARD SET BRANCH ──

      // 1. Combined 個別契約書: front (Kobetsu) + back (Tsuchisho) per contract (duplex-ready)
      try {
        const docKobetsu = createDoc();
        let pageIndex = 0;
        for (const { contract, empList } of allEmpLists) {
          const contractCommon = buildCommonData(contract);
          const kobetsuData = buildStandardKobetsuData(contractCommon, contract, empList);
          const tsuchishoData = buildStandardTsuchishoData(contractCommon, empList);
          // 2 copies per contract: 甲(client) + 乙(UNS) for duplex printing
          for (let copy = 0; copy < kobetsuCopies; copy++) {
            if (pageIndex > 0) docKobetsu.addPage({ size: "A4", margin: 0 });
            generateKobetsuPDF(docKobetsu, kobetsuData);
            docKobetsu.addPage({ size: "A4", margin: 0 });
            generateTsuchishoPDF(docKobetsu, tsuchishoData);
            pageIndex += 2;
          }
        }
        const fnKobetsu = `SET_個別契約書_${setPrefix}.pdf`;
        await writeToFile(docKobetsu, path.join(SET_OUTPUT_DIR, fnKobetsu));
        try {
          const bufSet = fs.readFileSync(path.join(SET_OUTPUT_DIR, fnKobetsu));
          await recordPdfVersion({
            pdfType: "kobetsu",
            buffer: bufSet,
            contractId: firstContract.id,
            factoryId: firstContract.factoryId,
            metadata: { contractCount: contractsData.length, employeeCount: allEmployees.length },
          });
        } catch { /* versioning no bloquea la entrega */ }
        generatedFiles.push({ type: "kobetsu", filename: fnKobetsu, path: `/api/documents/download/${encodeURIComponent(fnKobetsu)}` });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        generatedFiles.push({ type: "kobetsu", filename: "", path: `ERROR: ${message}` });
      }

      // 2. Combined 派遣先管理台帳: all employees from all contracts
      try {
        const docHakensaki = createDoc();
        allEmployees.forEach((emp, idx) => {
          if (idx > 0) docHakensaki.addPage({ size: "A4", margin: 0 });
          generateHakensakiKanriDaichoPDF(docHakensaki, buildStandardDaichoData(common, emp));
        });
        const fnHakensaki = `SET_派遣先管理台帳_${setPrefix}.pdf`;
        await writeToFile(docHakensaki, path.join(SET_OUTPUT_DIR, fnHakensaki));
        generatedFiles.push({ type: "hakensakiDaicho", filename: fnHakensaki, path: `/api/documents/download/${encodeURIComponent(fnHakensaki)}` });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        generatedFiles.push({ type: "hakensakiDaicho", filename: "", path: `ERROR: ${message}` });
      }

      // 3. Combined 派遣元管理台帳: all employees from all contracts
      try {
        const docHakenmoto = createDoc();
        allEmployees.forEach((emp, idx) => {
          if (idx > 0) docHakenmoto.addPage({ size: "A4", margin: 0 });
          generateHakenmotoKanriDaichoPDF(docHakenmoto, buildHakenmotoDaichoData(common, emp));
        });
        const fnHakenmoto = `SET_派遣元管理台帳_${setPrefix}.pdf`;
        await writeToFile(docHakenmoto, path.join(SET_OUTPUT_DIR, fnHakenmoto));
        generatedFiles.push({ type: "hakenmotoDaicho", filename: fnHakenmoto, path: `/api/documents/download/${encodeURIComponent(fnHakenmoto)}` });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        generatedFiles.push({ type: "hakenmotoDaicho", filename: "", path: `ERROR: ${message}` });
      }
    }

    // 4. All-in-one PDF: kobetsu(甲+乙) + hakensaki + hakenmoto in one file
    try {
      const docAll = createDoc();
      let allPageIndex = 0;

      // Part 1: 個別契約書 (甲+乙 duplex copies)
      for (const { contract, empList } of allEmpLists) {
        const contractCommon = buildCommonData(contract);

        if (isKoritsu) {
          const kData = buildKoritsuKobetsuData(contractCommon, contract, empList);
          const kTsuchisho = buildKoritsuTsuchishoData(contractCommon, contract, empList);
          for (let copy = 0; copy < kobetsuCopies; copy++) {
            if (allPageIndex > 0) docAll.addPage({ size: "A4", margin: 0 });
            generateKoritsuKobetsuPDF(docAll, kData);
            docAll.addPage({ size: "A4", margin: 0 });
            generateKoritsuTsuchishoPDF(docAll, kTsuchisho);
            allPageIndex += 2;
          }
        } else {
          const kData = buildStandardKobetsuData(contractCommon, contract, empList);
          const tsuchishoDataAll = buildStandardTsuchishoData(contractCommon, empList);
          for (let copy = 0; copy < kobetsuCopies; copy++) {
            if (allPageIndex > 0) docAll.addPage({ size: "A4", margin: 0 });
            generateKobetsuPDF(docAll, kData);
            docAll.addPage({ size: "A4", margin: 0 });
            generateTsuchishoPDF(docAll, tsuchishoDataAll);
            allPageIndex += 2;
          }
        }
      }

      // Part 2: 派遣先管理台帳
      allEmployees.forEach((emp) => {
        docAll.addPage({ size: "A4", margin: 0 });
        if (isKoritsu) {
          generateKoritsuDaichoPDF(docAll, buildKoritsuDaichoData(common, firstContract, allEmployees, emp));
        } else {
          generateHakensakiKanriDaichoPDF(docAll, buildStandardDaichoData(common, emp));
        }
      });

      // Part 3: 派遣元管理台帳
      allEmployees.forEach((emp) => {
        docAll.addPage({ size: "A4", margin: 0 });
        generateHakenmotoKanriDaichoPDF(docAll, buildHakenmotoDaichoData(common, emp));
      });

      const fnAll = `SET_全書類_${setPrefix}.pdf`;
      await writeToFile(docAll, path.join(SET_OUTPUT_DIR, fnAll));
      generatedFiles.push({ type: "allInOne", filename: fnAll, path: `/api/documents/download/${encodeURIComponent(fnAll)}` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      generatedFiles.push({ type: "allInOne", filename: "", path: `ERROR: ${message}` });
    }

    const hasErrors = generatedFiles.some((f) => f.path.startsWith("ERROR:"));
    const allFailed = generatedFiles.length > 0 && generatedFiles.every((f) => f.path.startsWith("ERROR:"));

    db.insert(auditLog).values({
      action: "export",
      entityType: "document",
      entityId: null,
      detail: `セットPDF生成: ${contractsData.length}契約 / ${allEmployees.length}名 / ${generatedFiles.length}ファイル (IDs: ${contractIds.join(", ")})`,
      userName: "system",
    }).run();

    return c.json(
      {
        success: !hasErrors,
        contractCount: contractsData.length,
        employeeCount: allEmployees.length,
        files: generatedFiles,
        summary: {
          total: generatedFiles.length,
          errors: generatedFiles.filter((f) => f.path.startsWith("ERROR")).length,
        },
      },
      allFailed ? 500 : hasErrors ? 207 : 200,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "SET generation failed";
    return c.json({ error: message }, 500);
  }
}
