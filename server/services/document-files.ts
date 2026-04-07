import fs from "node:fs";
import path from "node:path";

export function sanitizeFilename(value: string): string {
  return value.replace(/[/\\:*?"<>|]/g, "_");
}

export function isSafeDownloadFilename(filename: string): boolean {
  return !(filename.includes("/") || filename.includes("\\") || filename.includes(".."));
}

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
