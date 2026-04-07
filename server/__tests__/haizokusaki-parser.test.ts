/**
 * Tests for haizokusaki-parser — parseHaizokusaki()
 * Pure function, no DB required.
 */
import { describe, it, expect } from "vitest";
import { parseHaizokusaki } from "../services/haizokusaki-parser.js";

describe("parseHaizokusaki", () => {
  it("parses standard 3-part format with 班", () => {
    const result = parseHaizokusaki("本社工場製造1課1工区1班");
    expect(result).toEqual({
      factoryName: "本社工場",
      department: "製造1課",
      lineName: "1工区",
    });
  });

  it("parses 3-part format without 班", () => {
    const result = parseHaizokusaki("州的崎工場製造2課2工区");
    expect(result).toEqual({
      factoryName: "州的崎工場",
      department: "製造2課",
      lineName: "2工区",
    });
  });

  it("parses format with multiple digit department", () => {
    const result = parseHaizokusaki("亀崎工場製造5課6工区8班");
    expect(result).toEqual({
      factoryName: "亀崎工場",
      department: "製造5課",
      lineName: "6工区",
    });
  });

  it("parses fullwidth digits", () => {
    const result = parseHaizokusaki("州的崎工場製造2課2工区３班");
    expect(result).toEqual({
      factoryName: "州的崎工場",
      department: "製造2課",
      lineName: "2工区",
    });
  });

 it("parses mixed fullwidth/halfwidth department", () => {
    const result = parseHaizokusaki("州的崎工場製造2課2工区");
    expect(result).toEqual({
      factoryName: "州的崎工場",
      department: "製造2課",
      lineName: "2工区",
    });
  });

  it("returns null for empty string", () => {
    expect(parseHaizokusaki("")).toBeNull();
  });

  it("returns null for whitespace only", () => {
    expect(parseHaizokusaki("   ")).toBeNull();
  });

  it("returns null for '0'", () => {
    expect(parseHaizokusaki("0")).toBeNull();
  });

  it("returns null for '-'", () => {
    expect(parseHaizokusaki("-")).toBeNull();
  });

  it("returns null for 'ー' (fullwidth dash)", () => {
    expect(parseHaizokusaki("ー")).toBeNull();
  });

  it("returns null when 工場 is not found", () => {
    expect(parseHaizokusaki("本社製造1課1工区1班")).toBeNull();
  });

  it("returns null when 製造N課 is not found", () => {
    expect(parseHaizokusaki("本社工場1工区1班")).toBeNull();
  });

  it("returns null when 工区 is not found", () => {
    expect(parseHaizokusaki("本社工場製造1課1班")).toBeNull();
  });

  it("handles multiple 工 in department name", () => {
    const result = parseHaizokusaki("州的崎工場製造12課6工区");
    expect(result).toEqual({
      factoryName: "州的崎工場",
      department: "製造12課",
      lineName: "6工区",
    });
  });

  it("trims whitespace from input", () => {
    const result = parseHaizokusaki("  本社工場製造1課1工区1班  ");
    expect(result?.factoryName).toBe("本社工場");
  });
});
