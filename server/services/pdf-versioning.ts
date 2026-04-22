// Servicio de trazabilidad legal de PDFs generados.
// Registra SHA256 + metadata de cada PDF para cumplimiento 派遣法.
// No almacena el binario — solo el fingerprint y contexto.
import crypto from "node:crypto";
import { db } from "../db/index.js";
import { pdfVersions, auditLog, type PdfType, type PdfVersion } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";

// ─── recordPdfVersion ────────────────────────────────────────────────

export async function recordPdfVersion(input: {
  pdfType: PdfType;
  buffer: Buffer;
  contractId?: number | null;
  factoryId?: number | null;
  metadata?: Record<string, unknown>;
  regeneratedFrom?: number | null;
}): Promise<PdfVersion> {
  const sha256 = crypto.createHash("sha256").update(input.buffer).digest("hex");
  const byteLength = input.buffer.byteLength;

  // Auto-detect regeneratedFrom: busca la última versión del mismo (pdfType, contractId)
  let regeneratedFrom = input.regeneratedFrom ?? null;
  if (regeneratedFrom === undefined || regeneratedFrom === null) {
    if (input.contractId != null) {
      const prev = db
        .select({ id: pdfVersions.id })
        .from(pdfVersions)
        .where(
          and(
            eq(pdfVersions.pdfType, input.pdfType),
            eq(pdfVersions.contractId, input.contractId)
          )
        )
        .orderBy(desc(pdfVersions.generatedAt))
        .limit(1)
        .all();
      regeneratedFrom = prev[0]?.id ?? null;
    }
  }

  const inserted = db
    .insert(pdfVersions)
    .values({
      pdfType: input.pdfType,
      contractId: input.contractId ?? null,
      factoryId: input.factoryId ?? null,
      sha256,
      byteLength,
      generatedBy: "system",
      regeneratedFrom,
      metadata: input.metadata != null ? JSON.stringify(input.metadata) : null,
    })
    .returning()
    .get();

  // Audit log
  db.insert(auditLog)
    .values({
      action: "create",
      entityType: "pdf_version",
      entityId: inserted.id,
      detail: `PDF versionado: ${input.pdfType} sha256=${sha256.slice(0, 12)}… bytes=${byteLength}${input.contractId != null ? ` contractId=${input.contractId}` : ""}`,
      userName: "system",
    })
    .run();

  return inserted;
}

// ─── listPdfVersions ─────────────────────────────────────────────────

export async function listPdfVersions(filters: {
  contractId?: number;
  factoryId?: number;
  pdfType?: string;
  limit?: number;
}): Promise<PdfVersion[]> {
  const conditions = [];

  if (filters.contractId != null) {
    conditions.push(eq(pdfVersions.contractId, filters.contractId));
  }
  if (filters.factoryId != null) {
    conditions.push(eq(pdfVersions.factoryId, filters.factoryId));
  }
  if (filters.pdfType != null) {
    conditions.push(eq(pdfVersions.pdfType, filters.pdfType));
  }

  const query = db
    .select()
    .from(pdfVersions)
    .orderBy(desc(pdfVersions.generatedAt))
    .limit(filters.limit ?? 100);

  if (conditions.length === 0) {
    return query.all();
  }
  if (conditions.length === 1) {
    return query.where(conditions[0]).all();
  }
  return query.where(and(...conditions)).all();
}

// ─── getPdfVersion ───────────────────────────────────────────────────

/**
 * Obtiene una version de PDF por su ID. Retorna null si no existe.
 */
export async function getPdfVersion(id: number): Promise<PdfVersion | null> {
  const result = db
    .select()
    .from(pdfVersions)
    .where(eq(pdfVersions.id, id))
    .limit(1)
    .all();
  return result[0] ?? null;
}
