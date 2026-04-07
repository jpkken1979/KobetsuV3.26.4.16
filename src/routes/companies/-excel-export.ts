import type { Company, Factory } from "@/lib/api";
import type { CompanyTableColumn, CompanyTableColumnGroup } from "./-table-config";
import { createExcelWorkbook } from "@/lib/excel/workbook-loader";

interface ExportCompaniesWorkbookOptions {
  companies: Company[];
  factories: Factory[];
  companyColors: Map<string, number>;
  columns: CompanyTableColumn[];
  columnGroups: Record<string, CompanyTableColumnGroup>;
  companyPalette: string[];
}

export async function exportCompaniesWorkbook({
  companies,
  factories,
  companyColors,
  columns,
  columnGroups,
  companyPalette,
}: ExportCompaniesWorkbookOptions): Promise<void> {
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const workbook = await createExcelWorkbook();
  workbook.creator = "JP個別契約書 v26.3.31";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("企業データ一覧", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 2 }],
  });

  const groupColors: Record<string, string> = {
    basic: "3B82F6",
    hakensakiManager: "6366F1",
    supervisor: "10B981",
    complaintClient: "F59E0B",
    complaintUns: "F97316",
    managerUns: "A855F7",
    work: "14B8A6",
    contract: "F43F5E",
    worker: "06B6D4",
    legal: "64748B",
  };

  const groupTints: Record<string, string> = {
    basic: "D6E4FD",
    hakensakiManager: "DDDEFE",
    supervisor: "CCFBEF",
    complaintClient: "FEF3C7",
    complaintUns: "FFEDD5",
    managerUns: "EDE9FE",
    work: "CCFBF1",
    contract: "FFE4E6",
    worker: "CFFAFE",
    legal: "E2E8F0",
  };

  columns.forEach((column, index) => {
    worksheet.getColumn(index + 1).width = Math.max(Math.round(column.width / 7), 6);
  });

  const groupSpans: { group: string; start: number; end: number }[] = [];
  let currentGroup = columns[0].group;
  let groupStartIndex = 0;
  for (let index = 1; index <= columns.length; index += 1) {
    if (index === columns.length || columns[index].group !== currentGroup) {
      groupSpans.push({ group: currentGroup, start: groupStartIndex + 1, end: index });
      if (index < columns.length) {
        currentGroup = columns[index].group;
        groupStartIndex = index;
      }
    }
  }

  worksheet.addRow(columns.map(() => ""));
  worksheet.getRow(1).height = 24;
  for (const span of groupSpans) {
    const groupConfig = columnGroups[span.group];
    const color = groupColors[span.group] ?? "333333";
    if (span.end > span.start) {
      worksheet.mergeCells(1, span.start, 1, span.end);
    }

    const cell = worksheet.getCell(1, span.start);
    cell.value = groupConfig?.label ?? span.group;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${color}` } };
    cell.font = { name: "メイリオ", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }

  const headerRow = worksheet.addRow(columns.map((column) => column.label));
  headerRow.height = 22;
  columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    const tint = groupTints[column.group] ?? "F3F4F6";
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${tint}` } };
    cell.font = { name: "メイリオ", size: 8, bold: true, color: { argb: "FF374151" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: "FFD1D5DB" } } };
  });

  worksheet.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2, column: columns.length },
  };

  const solidFill = (argb: string) => ({
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb },
  });

  let previousCompanyName = "";
  let rowParity = 0;

  factories.forEach((factory) => {
    const companyName = factory.company?.name ?? "";
    const isNewCompany = companyName !== previousCompanyName;
    rowParity = isNewCompany ? 0 : rowParity + 1;
    previousCompanyName = companyName;

    const colorIndex = companyColors.get(companyName) ?? 0;
    const companyHex = companyPalette[colorIndex % companyPalette.length]
      .replace("#", "")
      .toUpperCase();

    const values = columns.map((column) => {
      const value = column.getter(factory);
      if (column.type === "number" && value) {
        const numericValue = Number.parseFloat(value);
        return Number.isNaN(numericValue) ? value : numericValue;
      }
      return value;
    });

    const row = worksheet.addRow(values);
    row.height = 18;
    const backgroundColor = rowParity % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB";

    columns.forEach((column, index) => {
      const cell = row.getCell(index + 1);
      const isCompanyCell = column.key === "companyName";
      cell.fill = solidFill(backgroundColor);
      cell.font = {
        name: "メイリオ",
        size: 8,
        bold: isCompanyCell,
        color: isCompanyCell ? { argb: `FF${companyHex}` } : { argb: "FF4B5563" },
      };
      cell.alignment = {
        horizontal: column.type === "number" ? "right" : "left",
        vertical: "middle",
      };
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
        right: { style: "hair", color: { argb: "FFF3F4F6" } },
        ...(isNewCompany
          ? { top: { style: "thin", color: { argb: `FF${companyHex}` } } }
          : {}),
      };
    });
  });

  const companyWorksheet = workbook.addWorksheet("企業情報", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const companyHeaders = ["会社名", "会社名カナ", "略称", "住所", "TEL", "代表者", "有効"];
  companyWorksheet.addRow(companyHeaders);
  companyWorksheet.getRow(1).font = { name: "メイリオ", size: 9, bold: true };
  companyWorksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD6E4FD" },
  };
  companyWorksheet.columns = [
    { width: 34 },
    { width: 26 },
    { width: 16 },
    { width: 42 },
    { width: 18 },
    { width: 18 },
    { width: 10 },
  ];

  companies
    .slice()
    .sort((left, right) => (left.name || "").localeCompare(right.name || ""))
    .forEach((company) => {
      companyWorksheet.addRow([
        company.name ?? "",
        company.nameKana ?? "",
        company.shortName ?? "",
        company.address ?? "",
        company.phone ?? "",
        company.representative ?? "",
        company.isActive ? "1" : "0",
      ]);
    });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `企業データ一覧_${localDate}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
