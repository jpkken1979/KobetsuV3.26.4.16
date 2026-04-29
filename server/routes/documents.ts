/**
 * Documents API — Catalog and utility endpoints
 *
 * Endpoints:
 *   GET  /api/documents/download/:filename          — Download a generated PDF
 *   GET  /api/documents/list/:contractId            — List generated documents for a contract
 *   GET  /api/documents/labor-history               — List labor contract docs
 *   POST /api/documents/open-folder                 — Open output folder in OS
 *   POST /api/documents/download-zip               — Bundle multiple files into a ZIP download
 */
import { Hono } from "hono";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { ZipFile } from "yazl";
import { isSafeDownloadFilename, resolveDownloadFilePath } from "../services/document-files.js";
import { getContractData } from "../services/document-generation.js";
import { sanitizeErrorMessage } from "../services/error-utils.js";
import {
  readContractDocIndex,
  KOBETSU_OUTPUT_DIR,
  ROUDOU_OUTPUT_DIR,
  KORITSU_OUTPUT_DIR,
} from "./documents-generate.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, "..", "..", "output");

export const documentsRouter = new Hono();

function ensureDirExists(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function openFolderInOs(dir: string) {
  ensureDirExists(dir);

  if (process.platform === "win32") {
    spawn("explorer.exe", [dir], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  if (process.platform === "darwin") {
    spawn("open", [dir], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  spawn("xdg-open", [dir], { detached: true, stdio: "ignore" }).unref();
}

// ─── GET /api/documents/download/:filename ──────────────────────────
//
// Modelo de autorización (M-5, audit 2026-04-28):
//
//   Esta ruta es INTENCIONALMENTE pública (sin auth) en el contexto local-first
//   actual. Cualquier usuario con acceso al puerto 8026 puede descargar
//   cualquier PDF generado en `output/{kobetsu,koritsu,roudou}` con sólo
//   adivinar el nombre de archivo.
//
//   Defensa actual:
//     - `isSafeDownloadFilename`: bloquea `..`, `/`, `\`, NUL, etc.
//     - `resolveDownloadFilePath`: confina la búsqueda a directorios whitelist.
//     - Filenames son `KOB-YYYYMM-NNNN_*.pdf`: difíciles de adivinar a ciegas
//       pero NO criptográficamente impredecibles.
//
//   Si en el futuro la app se expone fuera de localhost:
//     1. Agregar middleware de auth (tipo admin token o JWT por usuario).
//     2. Validar que el usuario tiene permiso sobre el contrato dueño del PDF
//        (parsear el contractNumber del filename, lookup contracts.id, check
//        ownership/role).
//     3. Considerar URLs firmadas con expiración corta para downloads.
documentsRouter.get("/download/:filename", async (c) => {
  try {
    const filename = decodeURIComponent(c.req.param("filename")).replace(/\0/g, "");

    if (!isSafeDownloadFilename(filename)) {
      return c.json({ error: "Access denied" }, 403);
    }

    const filepath = resolveDownloadFilePath(filename, [
      KOBETSU_OUTPUT_DIR,
      KORITSU_OUTPUT_DIR,
      ROUDOU_OUTPUT_DIR,
      OUTPUT_DIR, // backward compatibility
    ]);
    if (!filepath) {
      return c.json({ error: "File not found" }, 404);
    }

    const buffer = await fs.promises.readFile(filepath);
    const isZip = filename.toLowerCase().endsWith(".zip");
    const contentType = isZip ? "application/zip" : "application/pdf";
    const disposition = isZip ? "attachment" : "inline";

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (err: unknown) {
    return c.json({ error: `Failed to download document: ${sanitizeErrorMessage(err)}` }, 500);
  }
});

// ─── GET /api/documents/list/:contractId ────────────────────────────

documentsRouter.get("/list/:contractId", async (c) => {
  try {
    const contractId = Number(c.req.param("contractId"));
    const contract = await getContractData(contractId);

    if (!contract) {
      return c.json({ error: "Contract not found" }, 404);
    }

    const indexedFiles = await readContractDocIndex(contractId);
    const searchDirs = [KOBETSU_OUTPUT_DIR, KORITSU_OUTPUT_DIR];
    const files: { filename: string; path: string; size: number }[] = [];
    for (const filename of indexedFiles) {
      if (!filename.endsWith(".pdf") && !filename.endsWith(".zip")) continue;
      for (const dir of searchDirs) {
        const filepath = path.join(dir, filename);
        if (!fs.existsSync(filepath)) continue;
        const stat = await fs.promises.stat(filepath);
        files.push({
          filename,
          path: `/api/documents/download/${encodeURIComponent(filename)}`,
          size: stat.size,
        });
        break;
      }
    }

    return c.json({ files });
  } catch (err: unknown) {
    return c.json({ error: `Failed to list documents: ${sanitizeErrorMessage(err)}` }, 500);
  }
});

// ─── GET /api/documents/labor-history ───────────────────────────────
// List generated labor-contract documents (労働契約書 / 就業条件明示書) from output/roudou
documentsRouter.get("/labor-history", async (c) => {
  try {
    if (!fs.existsSync(ROUDOU_OUTPUT_DIR)) return c.json({ files: [] });

    const entries = await fs.promises.readdir(ROUDOU_OUTPUT_DIR, { withFileTypes: true });
    const files: {
      filename: string;
      path: string;
      size: number;
      createdAt: string;
      type: "shugyojoken" | "keiyakusho";
    }[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filename = entry.name;
      if (!filename.endsWith(".pdf")) continue;
      const stat = await fs.promises.stat(path.join(ROUDOU_OUTPUT_DIR, filename));
      files.push({
        filename,
        path: `/api/documents/download/${encodeURIComponent(filename)}`,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
        type: filename.startsWith("就業条件明示書_") ? "shugyojoken" : "keiyakusho",
      });
    }
    files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({ files });
  } catch (err: unknown) {
    return c.json({ error: `Failed to list labor history: ${sanitizeErrorMessage(err)}` }, 500);
  }
});

// ─── POST /api/documents/open-folder ────────────────────────────────
// Open output folder in OS file explorer.
documentsRouter.post("/open-folder", async (c) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return c.json({ error: "open-folder is disabled in production" }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const type = body?.type === "roudou" ? "roudou" : "kobetsu";
    const dir = type === "roudou" ? ROUDOU_OUTPUT_DIR : KOBETSU_OUTPUT_DIR;

    openFolderInOs(dir);
    return c.json({ success: true, type, path: dir });
  } catch (err: unknown) {
    return c.json({ error: `Failed to open folder: ${sanitizeErrorMessage(err)}` }, 500);
  }
});

// ─── POST /api/documents/download-zip ───────────────────────────────
// Bundle a list of filenames into a ZIP and return it as binary.
// Body: { filenames: string[], zipName?: string }
// Filenames are relative to output/ — searched across output/set/, output/kobetsu/, output/koritsu/, output/
const downloadZipSchema = z.object({
  filenames: z.array(z.string()).min(1, "filenames must be a non-empty array"),
  zipName: z.string().min(1).default("contract-set.zip"),
});

documentsRouter.post("/download-zip", async (c) => {
  try {
    const raw = await c.req.json();
    const parsed = downloadZipSchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
    const { filenames, zipName } = parsed.data;

    // Security: reject any filename with path traversal sequences
    const safeFilenames = (filenames as unknown[]).filter(
      (f): f is string =>
        typeof f === "string" &&
        !f.includes("..") &&
        !f.includes("/") &&
        !f.includes("\\")
    );

    if (safeFilenames.length === 0) {
      return c.json({ error: "No valid filenames provided" }, 400);
    }

    // Search candidate directories in priority order
    const SET_OUTPUT_DIR = path.join(OUTPUT_DIR, "set");
    const candidateDirs = [
      SET_OUTPUT_DIR,
      KOBETSU_OUTPUT_DIR,
      KORITSU_OUTPUT_DIR,
      ROUDOU_OUTPUT_DIR,
      OUTPUT_DIR,
    ];

    // Collect buffer from yazl ZipFile
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const zip = new ZipFile();
      const chunks: Buffer[] = [];

      zip.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      zip.outputStream.on("error", reject);
      zip.outputStream.on("end", () => resolve(Buffer.concat(chunks)));

      let added = 0;
      for (const filename of safeFilenames) {
        // Find the file in one of the candidate directories
        let resolved: string | null = null;
        for (const dir of candidateDirs) {
          const candidate = path.join(dir, filename);
          const resolvedDir = path.resolve(dir);
          const resolvedCandidate = path.resolve(candidate);
          // Ensure path stays inside the candidate directory
          if (
            resolvedCandidate.startsWith(resolvedDir + path.sep) &&
            fs.existsSync(resolvedCandidate)
          ) {
            resolved = resolvedCandidate;
            break;
          }
        }
        if (resolved) {
          zip.addFile(resolved, filename);
          added++;
        }
      }

      if (added === 0) {
        reject(new Error("None of the requested files were found"));
        return;
      }

      zip.end();
    });

    return new Response(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(zipName)}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err: unknown) {
    return c.json({ error: `Failed to create ZIP: ${sanitizeErrorMessage(err)}` }, 500);
  }
});
