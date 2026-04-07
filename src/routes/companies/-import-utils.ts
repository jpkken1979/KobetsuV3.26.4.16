import type { Worksheet } from "exceljs";

export type CompanyImportKind = "factories" | "companies";

const GROUPED_PREFIXED = new Set([
  "派遣先責任者",
  "指揮命令者",
  "苦情処理(派遣先)",
  "苦情処理(派遣元)",
  "派遣元責任者",
]);

function worksheetToMatrix(worksheet: Worksheet): string[][] {
  const maxColumns = Math.max(
    worksheet.columnCount,
    worksheet.getRow(1).cellCount,
    worksheet.getRow(2).cellCount,
  );
  const matrix: string[][] = [];

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values: string[] = [];

    for (let columnNumber = 1; columnNumber <= maxColumns; columnNumber += 1) {
      values.push(String(row.getCell(columnNumber).text ?? "").trim());
    }

    matrix.push(values);
  }

  return matrix;
}

export function parseCompanySheet(worksheet: Worksheet): Record<string, unknown>[] {
  const rawRows = worksheetToMatrix(worksheet);
  if (rawRows.length < 2) {
    return [];
  }

  const firstRow = rawRows[0] as string[];
  const isGroupedHeader = firstRow.some(
    (value) =>
      typeof value === "string" &&
      ["基本情報", "派遣先責任者", "指揮命令者"].includes(String(value).trim()),
  );

  if (!isGroupedHeader) {
    const headers = rawRows[0].map((value) => String(value || "").trim());
    return rawRows
      .slice(1)
      .filter((row) => row.some((value) => value !== "" && value != null))
      .map((row) => {
        const entry: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          if (!header) {
            return;
          }
          entry[header] = row[index] ?? "";
        });
        return entry;
      });
  }

  const groups: string[] = [];
  let currentGroup = "";

  for (let index = 0; index < firstRow.length; index += 1) {
    const value = firstRow[index];
    if (value && String(value).trim()) {
      currentGroup = String(value).trim();
    }
    groups.push(currentGroup);
  }

  const subHeaders = (rawRows[1] as string[]).map((value) => String(value || "").trim());
  const columnNames = subHeaders.map((subHeader, index) => {
    const group = groups[index];
    return GROUPED_PREFIXED.has(group) ? `${group}${subHeader}` : subHeader;
  });

  return rawRows
    .slice(2)
    .filter((row) => (row as unknown[]).some((value) => value !== "" && value != null))
    .map((row) => {
      const entry: Record<string, unknown> = {};
      columnNames.forEach((columnName, index) => {
        entry[columnName] = (row as unknown[])[index] ?? "";
      });
      return entry;
    });
}

export function inferCompanyImportKind(
  sheetName: string,
  rows: Record<string, unknown>[],
): CompanyImportKind {
  const normalizedSheetName = sheetName.toLowerCase();
  if (
    normalizedSheetName.includes("企業情報") ||
    normalizedSheetName.includes("company")
  ) {
    return "companies";
  }

  const firstRow = rows[0] ?? {};
  const hasFactoryColumns =
    "工場名" in firstRow || "部署" in firstRow || "ライン名" in firstRow;
  const hasCompanyColumns =
    "会社名" in firstRow &&
    (
      "会社名カナ" in firstRow ||
      "略称" in firstRow ||
      "代表者" in firstRow ||
      "有効" in firstRow
    );

  if (hasCompanyColumns && !hasFactoryColumns) {
    return "companies";
  }

  return "factories";
}
