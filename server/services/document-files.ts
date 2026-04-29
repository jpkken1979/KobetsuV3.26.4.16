import fs from "node:fs";
import path from "node:path";

/**
 * Elimina caracteres invalidos de Windows para nombres de archivo (/ \ : * ? " < > |),
 * colapsa secuencias de `..` (defensa-en-profundidad contra path traversal vía datos
 * de DB usados como prefix de filename) y limita longitud a 200 caracteres.
 *
 * Cierra MED-2 (audit 2026-04-29): aunque los filenames se construyen con prefix
 * y sufijo `.pdf`, agregamos hardening por si algún flujo futuro usa el resultado
 * como filename "raw".
 */
export function sanitizeFilename(value: string): string {
  if (value.length === 0) return "";
  let out = value.replace(/[/\\:*?"<>|]/g, "_");
  // Colapsa secuencias de `..` que podrían interpretarse como traversal segments
  out = out.replace(/\.{2,}/g, "_");
  // Cap a 200 caracteres para evitar filenames excesivamente largos
  if (out.length > 200) out = out.slice(0, 200);
  return out;
}

/**
 * Verifica que un nombre de archivo no contenga path traversal ni separadores de directorio.
 */
export function isSafeDownloadFilename(filename: string): boolean {
  return !(filename.includes("/") || filename.includes("\\") || filename.includes(".."));
}

/**
 * Busca un archivo por nombre en una lista de directorios candidatos.
 * Posterior a la resolucion, el path debe estar contenido en el directorio candidato (previene traversal).
 */
export function resolveDownloadFilePath(filename: string, candidates: string[]): string | null {
  for (const dir of candidates) {
    const resolvedDir = path.resolve(dir);
    const candidatePath = path.resolve(dir, filename);
    // Post-resolution confinement: the resolved path must stay inside the candidate directory
    if (!candidatePath.startsWith(resolvedDir + path.sep)) continue;
    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  return null;
}
