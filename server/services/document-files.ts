import fs from "node:fs";
import path from "node:path";

/**
 * Elimina caracteres invalidos de Windows para nombres de archivo (/ \ : * ? " < > |).
 */
export function sanitizeFilename(value: string): string {
  return value.replace(/[/\\:*?"<>|]/g, "_");
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
