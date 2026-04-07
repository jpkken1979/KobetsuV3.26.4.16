import type { Workbook } from "exceljs";

let excelModulePromise: Promise<typeof import("exceljs")> | null = null;
type ExcelJSImport = typeof import("exceljs") & { default?: typeof import("exceljs") };

async function loadExcelModule() {
  if (!excelModulePromise) {
    excelModulePromise = import("exceljs");
  }
  return excelModulePromise;
}

export async function loadExcelWorkbook(file: File): Promise<Workbook> {
  const ExcelJSImport = (await loadExcelModule()) as ExcelJSImport;
  const ExcelJS = ExcelJSImport.default || ExcelJSImport;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  return workbook as Workbook;
}

export async function createExcelWorkbook(): Promise<Workbook> {
  const ExcelJSImport = (await loadExcelModule()) as ExcelJSImport;
  const ExcelJS = ExcelJSImport.default || ExcelJSImport;
  return new ExcelJS.Workbook() as Workbook;
}
