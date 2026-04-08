// Shared utilities for batch document generation handlers
import fs from "node:fs";
import path from "node:path";
import type { PDFPage } from "pdf-lib";

/**
 * Merge multiple PDF files into one using pdf-lib.
 * Skips unreadable files silently.
 */
export async function mergePdfs(filePaths: string[], outputPath: string): Promise<void> {
  const { PDFDocument } = await import("pdf-lib");
  const merged = await PDFDocument.create();
  for (const fp of filePaths) {
    try {
      const bytes = await fs.promises.readFile(fp);
      const src = await PDFDocument.load(bytes);
      const copied = await merged.copyPages(src, src.getPageIndices());
      copied.forEach((p: PDFPage) => merged.addPage(p));
    } catch { /* skip unreadable PDFs */ }
  }
  const out = await merged.save();
  await fs.promises.writeFile(outputPath, Buffer.from(out));
}

export const SET_OUTPUT_DIR = path.resolve("output", "set");
