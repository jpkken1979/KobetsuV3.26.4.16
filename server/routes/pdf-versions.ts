// Router para consulta de versiones de PDFs generados.
// NOTA: Este endpoint NO ofrece descarga del binario del PDF original —
// solo almacenamos el hash SHA256 como fingerprint legal. Para recuperar
// el PDF hay que regenerarlo usando la misma ruta de generación.
import { Hono } from "hono";
import { listPdfVersions, getPdfVersion } from "../services/pdf-versioning.js";

export const pdfVersionsRouter = new Hono();

// GET /api/pdf-versions?contractId=N&factoryId=N&pdfType=kobetsu&limit=50
pdfVersionsRouter.get("/", async (c) => {
  try {
    const contractId = c.req.query("contractId") ? Number(c.req.query("contractId")) : undefined;
    const factoryId = c.req.query("factoryId") ? Number(c.req.query("factoryId")) : undefined;
    const pdfType = c.req.query("pdfType") ?? undefined;
    const limit = c.req.query("limit") ? Number(c.req.query("limit")) : undefined;

    if (contractId !== undefined && !Number.isFinite(contractId)) {
      return c.json({ error: "Invalid contractId" }, 400);
    }
    if (factoryId !== undefined && !Number.isFinite(factoryId)) {
      return c.json({ error: "Invalid factoryId" }, 400);
    }

    const versions = await listPdfVersions({ contractId, factoryId, pdfType, limit });
    return c.json(versions);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list pdf versions";
    return c.json({ error: message }, 500);
  }
});

// GET /api/pdf-versions/:id
pdfVersionsRouter.get("/:id", async (c) => {
  try {
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id) || id <= 0) {
      return c.json({ error: "Invalid id" }, 400);
    }
    const version = await getPdfVersion(id);
    if (!version) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json(version);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to get pdf version";
    return c.json({ error: message }, 500);
  }
});
