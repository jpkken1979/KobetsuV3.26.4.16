// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Button } from "../button";

describe("Button", () => {
  afterEach(() => cleanup());

  it("renderiza children", () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole("button", { name: "Click" })).toBeTruthy();
  });

  it("dispara onClick al hacer click", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Submit</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("queda disabled cuando loading=true (no dispara onClick)", () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const btn = screen.getByRole("button");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("queda disabled cuando disabled=true", () => {
    render(<Button disabled>Off</Button>);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("muestra spinner Loader2 cuando loading", () => {
    const { container } = render(<Button loading>Save</Button>);
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("aplica variant=destructive con clase correspondiente", () => {
    render(<Button variant="destructive">Del</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/bg-destructive/);
  });

  it("aplica size=sm con altura h-8", () => {
    render(<Button size="sm">tiny</Button>);
    expect(screen.getByRole("button").className).toMatch(/h-8/);
  });

  it("size=icon usa cuadrado h-9 w-9", () => {
    render(<Button size="icon" aria-label="settings">⚙</Button>);
    const btn = screen.getByRole("button", { name: "settings" });
    expect(btn.className).toMatch(/h-9/);
    expect(btn.className).toMatch(/w-9/);
  });

  it("permite type='submit' (default es button)", () => {
    render(<Button type="submit">Go</Button>);
    expect((screen.getByRole("button") as HTMLButtonElement).type).toBe("submit");
  });

  it("merge className personalizada con variants", () => {
    render(<Button className="my-extra-class">X</Button>);
    expect(screen.getByRole("button").className).toMatch(/my-extra-class/);
  });

  it("forwarea ref al elemento button nativo", () => {
    let capturedRef: HTMLButtonElement | null = null;
    render(
      <Button
        ref={(el) => {
          capturedRef = el;
        }}
      >
        ref test
      </Button>,
    );
    expect(capturedRef).toBeInstanceOf(HTMLButtonElement);
  });
});
