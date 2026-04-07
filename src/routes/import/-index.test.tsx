// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadExcelWorkbook = vi.fn();
const diffEmployees = vi.fn();
const importEmployees = vi.fn();

vi.mock("@/lib/excel/workbook-loader", () => ({
  loadExcelWorkbook: (...args: unknown[]) => loadExcelWorkbook(...args),
}));

vi.mock("@/lib/api", () => ({
  api: {
    diffEmployees: (...args: unknown[]) => diffEmployees(...args),
    importEmployees: (...args: unknown[]) => importEmployees(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { ImportPage } from "./-import-page";

type MockCell = {
  value: unknown;
  text: string;
};

function makeCell(value: unknown, text = ""): MockCell {
  return { value, text };
}

function makeRow(cells: MockCell[]) {
  return {
    cellCount: cells.length,
    actualCellCount: cells.length,
    getCell: (col: number) => cells[col - 1] ?? makeCell("", ""),
  };
}

function makeWorkbook() {
  const headerRow = makeRow([
    makeCell("社員№", "社員№"),
    makeCell("氏名", "氏名"),
    makeCell("生年月日", "生年月日"),
    makeCell("入社日", "入社日"),
    makeCell("現入社", "現入社"),
  ]);

  const dataRow = makeRow([
    makeCell("E001", "E001"),
    makeCell("テスト 太郎", "テスト 太郎"),
    makeCell(new Date(Date.UTC(2026, 3, 1)), "令和8年4月1日"),
    makeCell(new Date(Date.UTC(2026, 3, 1)), "令和8年4月1日"),
    makeCell(
      { formula: "=TODAY()+1", result: new Date(Date.UTC(2026, 3, 2)) },
      "令和8年4月2日",
    ),
  ]);

  const sheet = {
    name: "DBGenzaiX",
    rowCount: 2,
    getRow: (row: number) => (row === 1 ? headerRow : dataRow),
  };

  return {
    worksheets: [sheet],
    getWorksheet: (name: string) => (name === "DBGenzaiX" ? sheet : undefined),
  };
}

function renderWithProviders(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
  );
}

describe("ImportPage smoke flow", () => {
  beforeEach(() => {
    loadExcelWorkbook.mockReset();
    diffEmployees.mockReset();
    importEmployees.mockReset();
  });

  it("normalizes ExcelJS date cells to ISO in preview and API payload", async () => {
    loadExcelWorkbook.mockResolvedValue(makeWorkbook());
    diffEmployees.mockResolvedValue({
      inserts: [
        {
          employeeNumber: "E001",
          fullName: "テスト 太郎",
          company: null,
          factory: null,
        },
      ],
      updates: [],
      unchanged: 0,
      skipped: 0,
      errors: [],
    });
    importEmployees.mockResolvedValue({
      success: true,
      summary: {
        total: 1,
        inserted: 1,
        updated: 0,
        deleted: 0,
        skipped: 0,
        errors: 0,
      },
      errors: [],
    });

    const { container } = renderWithProviders(<ImportPage />);

    const input = container.querySelector("#excel-file") as HTMLInputElement | null;
    expect(input).toBeTruthy();

    const file = new File(["dummy"], "employees.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    fireEvent.change(input!, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("データプレビュー")).toBeTruthy();
    });

    expect(screen.getAllByText("2026-04-01").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2026-04-02").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("変更をチェック"));

    await waitFor(() => {
      expect(diffEmployees).toHaveBeenCalledTimes(1);
    });

    expect(diffEmployees).toHaveBeenCalledWith({
      data: [
        {
          "社員№": "E001",
          "氏名": "テスト 太郎",
          "生年月日": "2026-04-01",
          "入社日": "2026-04-01",
          "現入社": "2026-04-02",
        },
      ],
    });

    const importButton = await screen.findByText(/1件追加.*を実行/);
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(importEmployees).toHaveBeenCalledTimes(1);
    });

    expect(importEmployees).toHaveBeenCalledWith({
      data: [
        {
          "社員№": "E001",
          "氏名": "テスト 太郎",
          "生年月日": "2026-04-01",
          "入社日": "2026-04-01",
          "現入社": "2026-04-02",
        },
      ],
      mode: "upsert",
    });
  });
});