// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CompanyTableControls } from "./-table-controls";

describe("CompanyTableControls", () => {
  it("renders summary and calls callbacks from controls", () => {
    const onSearchChange = vi.fn();
    const onFilterCompanyChange = vi.fn();
    const onScroll = vi.fn();
    const onOpenImport = vi.fn();
    const onExport = vi.fn();
    const onToggleExpand = vi.fn();

    render(
      <CompanyTableControls
        sortedCount={12}
        companyCount={3}
        search=""
        filterCompany="all"
        companyNames={["会社A", "会社B"]}
        isExpandMode={false}
        exporting={false}
        onSearchChange={onSearchChange}
        onFilterCompanyChange={onFilterCompanyChange}
        onScroll={onScroll}
        onOpenImport={onOpenImport}
        onExport={onExport}
        onToggleExpand={onToggleExpand}
      />,
    );

    expect(screen.getByText("企業データ一覧")).toBeTruthy();
    expect(screen.getByText("全12件 ・ 3社 ・ TBKaisha準拠レイアウト")).toBeTruthy();

    fireEvent.click(screen.getByTitle("左スクロール"));
    fireEvent.click(screen.getByTitle("右スクロール"));
    expect(onScroll).toHaveBeenNthCalledWith(1, "left");
    expect(onScroll).toHaveBeenNthCalledWith(2, "right");

    fireEvent.click(screen.getByText("Excel取込"));
    expect(onOpenImport).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Excel出力"));
    expect(onExport).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /全画面表示/i }));
    expect(onToggleExpand).toHaveBeenCalledTimes(1);

    fireEvent.change(
      screen.getByPlaceholderText("会社名・工場名・住所で検索..."),
      { target: { value: "検索語" } },
    );
    expect(onSearchChange).toHaveBeenCalledWith("検索語");

    fireEvent.change(screen.getByDisplayValue("全企業"), {
      target: { value: "会社A" },
    });
    expect(onFilterCompanyChange).toHaveBeenCalledWith("会社A");
  });

  it("shows exporting state and disables export button", () => {
    render(
      <CompanyTableControls
        sortedCount={1}
        companyCount={1}
        search=""
        filterCompany="all"
        companyNames={["会社A"]}
        isExpandMode={true}
        exporting={true}
        onSearchChange={() => {}}
        onFilterCompanyChange={() => {}}
        onScroll={() => {}}
        onOpenImport={() => {}}
        onExport={() => {}}
        onToggleExpand={() => {}}
      />,
    );

    const exportButton = screen.getByRole("button", { name: "出力中..." });
    expect(exportButton).toBeTruthy();
    expect(exportButton).toHaveProperty("disabled", true);
    expect(screen.getByText("sidebar 非表示中 ・ URLの?expand=1で切り替え")).toBeTruthy();
  });
});