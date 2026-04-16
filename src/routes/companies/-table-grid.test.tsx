// @vitest-environment jsdom
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Factory } from "@/lib/api";
import { CompanyTableGrid, type CompanyTableRowData } from "./-table-grid";

vi.mock("./-editable-cell", () => ({
  EditableCell: ({
    value,
    fieldKey,
  }: {
    value: string;
    fieldKey: string;
  }) => <span data-testid={`cell-${fieldKey}`}>{value}</span>,
}));

function makeFactory(id: number, overrides: Partial<Factory> = {}): Factory {
  return {
    id,
    companyId: 1,
    factoryName: `工場${id}`,
    ...overrides,
  } as Factory;
}

function makeRowData(): CompanyTableRowData[] {
  return [
    {
      factory: makeFactory(1, { department: "第一部", lineName: "Aライン" }),
      companyName: "会社A",
      color: "#3b82f6",
      isNewCompany: true,
      isEvenWithin: true,
    },
    {
      factory: makeFactory(2, { department: "第二部", lineName: "Bライン" }),
      companyName: "会社B",
      color: "#10b981",
      isNewCompany: false,
      isEvenWithin: false,
    },
  ];
}

describe("CompanyTableGrid", () => {
  it("renders loading skeletons", () => {
    const { container } = render(
      <CompanyTableGrid
        isLoading
        isFullscreen={false}
        rowData={[]}
        scrollRef={createRef<HTMLDivElement>()}
      />,
    );

    const skeletons = container.querySelectorAll(".skeleton");
    expect(skeletons.length).toBe(8);
  });

  it("renders empty state", () => {
    render(
      <CompanyTableGrid
        isLoading={false}
        isFullscreen={false}
        rowData={[]}
        scrollRef={createRef<HTMLDivElement>()}
      />,
    );

    expect(screen.getByText("データが見つかりません")).toBeTruthy();
  });

  it("renders headers, row data and fullscreen-specific height class", () => {
    const { container, rerender } = render(
      <CompanyTableGrid
        isLoading={false}
        isFullscreen={false}
        rowData={makeRowData()}
        scrollRef={createRef<HTMLDivElement>()}
      />,
    );

    expect(screen.getByText("派遣先責任者")).toBeTruthy();
    expect(screen.getByText("銀行口座")).toBeTruthy();
    expect(screen.getByText("会社A")).toBeTruthy();
    expect(screen.getByText("工場1")).toBeTruthy();
    expect(screen.getByText("会社B")).toBeTruthy();
    expect(screen.getByText("工場2")).toBeTruthy();

    const normalHeightContainer = Array.from(container.querySelectorAll("div")).find(
      (node) =>
        typeof node.className === "string" &&
        node.className.includes("max-h-[calc(100vh-350px)]"),
    );
    expect(normalHeightContainer).toBeTruthy();

    rerender(
      <CompanyTableGrid
        isLoading={false}
        isFullscreen
        rowData={makeRowData()}
        scrollRef={createRef<HTMLDivElement>()}
      />,
    );

    const fullscreenHeightContainer = Array.from(container.querySelectorAll("div")).find(
      (node) =>
        typeof node.className === "string" &&
        node.className.includes("max-h-[calc(100vh-270px)]"),
    );
    expect(fullscreenHeightContainer).toBeTruthy();
  });

  it("renders yearly config action and highlights configured factories", () => {
    const onYearlyConfig = vi.fn();
    render(
      <CompanyTableGrid
        isLoading={false}
        isFullscreen={false}
        rowData={makeRowData()}
        scrollRef={createRef<HTMLDivElement>()}
        onYearlyConfig={onYearlyConfig}
        factoryConfigIds={new Set([1])}
      />,
    );

    const yearlyButtons = screen.getAllByTitle("年度別設定");
    expect(yearlyButtons).toHaveLength(2);

    const firstYearlyButton = yearlyButtons[0];
    expect(firstYearlyButton.textContent).toContain("年度");
    expect(firstYearlyButton.querySelector(".bg-emerald-400")).toBeTruthy();

    fireEvent.click(firstYearlyButton);
    expect(onYearlyConfig).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});
