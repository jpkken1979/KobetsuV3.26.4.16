// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import {
  ContractStatusBadge,
  EmployeeStatusBadge,
  AuditActionBadge,
} from "../status-badge";

describe("ContractStatusBadge", () => {
  afterEach(() => cleanup());

  it.each([
    ["draft", "下書き"],
    ["active", "有効"],
    ["expired", "期限切れ"],
    ["cancelled", "取消"],
    ["renewed", "更新済"],
  ])("muestra label correcto para status='%s'", (status, label) => {
    render(<ContractStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it("hace fallback al status raw si no esta en el mapa", () => {
    render(<ContractStatusBadge status="unknown-status" />);
    expect(screen.getByText("unknown-status")).toBeTruthy();
  });

  it("respeta aria-label custom", () => {
    const { container } = render(
      <ContractStatusBadge status="active" aria-label="contrato activo" />,
    );
    expect(container.querySelector('[aria-label="contrato activo"]')).toBeTruthy();
  });

  it("usa label como aria-label default", () => {
    const { container } = render(<ContractStatusBadge status="draft" />);
    expect(container.querySelector('[aria-label="下書き"]')).toBeTruthy();
  });

  it("propaga className custom", () => {
    const { container } = render(
      <ContractStatusBadge status="active" className="my-cls" />,
    );
    expect(container.querySelector(".my-cls")).toBeTruthy();
  });
});

describe("EmployeeStatusBadge", () => {
  afterEach(() => cleanup());

  it.each([
    ["active", "在籍"],
    ["inactive", "退職"],
    ["leave", "休職"],
  ])("muestra label correcto para status='%s'", (status, label) => {
    render(<EmployeeStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it("fallback para status desconocido", () => {
    render(<EmployeeStatusBadge status="x" />);
    expect(screen.getByText("x")).toBeTruthy();
  });
});

describe("AuditActionBadge", () => {
  afterEach(() => cleanup());

  it.each([
    ["create", "作成"],
    ["update", "更新"],
    ["delete", "削除"],
    ["export", "出力"],
    ["import", "取込"],
  ])("muestra label correcto para action='%s'", (action, label) => {
    render(<AuditActionBadge action={action} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it("fallback para action desconocida", () => {
    render(<AuditActionBadge action="lol" />);
    expect(screen.getByText("lol")).toBeTruthy();
  });
});
