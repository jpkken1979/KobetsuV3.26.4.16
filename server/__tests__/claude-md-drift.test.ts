/**
 * Drift guard: keeps the counts in CLAUDE.md honest.
 *
 * After the v1↔v3 audit we found CLAUDE.md was lying about routers (17 vs 30)
 * and services (21 vs 25). When the doc drifts, future Claude sessions get
 * misled. This test fails if either count goes out of sync, forcing a doc
 * update at the same time as the code change.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function countTsFiles(dir: string): number {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts") && !f.endsWith(".test.ts"))
    .length;
}

function readClaudeMd(): string {
  return fs.readFileSync(path.join(repoRoot, "CLAUDE.md"), "utf-8");
}

describe("CLAUDE.md drift guard", () => {
  it("router count matches server/routes/", () => {
    const actual = countTsFiles(path.join(repoRoot, "server", "routes"));
    const md = readClaudeMd();
    const match = md.match(/Route files \((\d+)/);
    expect(match, "CLAUDE.md must declare a 'Route files (N' count").toBeTruthy();
    const declared = Number(match![1]);
    expect(
      declared,
      `Drift: server/routes/ has ${actual} .ts files but CLAUDE.md says ${declared}. Update the doc.`,
    ).toBe(actual);
  });

  it("service count matches server/services/", () => {
    const actual = countTsFiles(path.join(repoRoot, "server", "services"));
    const md = readClaudeMd();
    const match = md.match(/Service modules \((\d+)/);
    expect(match, "CLAUDE.md must declare a 'Service modules (N' count").toBeTruthy();
    const declared = Number(match![1]);
    expect(
      declared,
      `Drift: server/services/ has ${actual} .ts files but CLAUDE.md says ${declared}. Update the doc.`,
    ).toBe(actual);
  });

  it("does not mention sharp (the audit confirmed it was never used)", () => {
    const md = readClaudeMd();
    // Allow the word inside "sharing" / "sharp drop" prose, but block ` sharp ` or `sharp\n` standalone references.
    const standaloneSharp = /(?:^|[^a-z])sharp(?:[^a-z]|$)/i;
    expect(
      standaloneSharp.test(md),
      "CLAUDE.md mentions `sharp` again — this dep was never installed; PDFKit handles seal embedding natively.",
    ).toBe(false);
  });
});
