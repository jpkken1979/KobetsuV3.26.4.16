import fs from "node:fs";
import path from "node:path";

const OUTPUT_DIR = path.resolve("output");
const INDEX_DIR = path.join(OUTPUT_DIR, ".index");

function parseIndexFiles(content: string): string[] {
  try {
    const parsed = JSON.parse(content) as { files?: unknown };
    if (!Array.isArray(parsed.files)) return [];
    return parsed.files.filter((f): f is string => typeof f === "string");
  } catch {
    return [];
  }
}

function sanitizeFilename(filename: string): string | null {
  if (!filename.endsWith(".pdf")) return null;
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) return null;
  const fullPath = path.resolve(OUTPUT_DIR, filename);
  if (!fullPath.startsWith(path.resolve(OUTPUT_DIR) + path.sep)) return null;
  return fullPath;
}

async function readAllReferencedFiles(): Promise<Set<string>> {
  const refs = new Set<string>();
  if (!fs.existsSync(INDEX_DIR)) return refs;

  const indexFiles = fs.readdirSync(INDEX_DIR).filter((f) => f.endsWith(".json"));
  for (const file of indexFiles) {
    const indexPath = path.join(INDEX_DIR, file);
    const content = await fs.promises.readFile(indexPath, "utf-8");
    for (const filename of parseIndexFiles(content)) {
      refs.add(filename);
    }
  }
  return refs;
}

export async function cleanupPurgedContractDocuments(contractIds: number[]): Promise<{
  removedIndexes: number;
  removedFiles: number;
}> {
  if (contractIds.length === 0 || !fs.existsSync(INDEX_DIR)) {
    return { removedIndexes: 0, removedFiles: 0 };
  }

  const orphanCandidates = new Set<string>();
  let removedIndexes = 0;

  for (const contractId of contractIds) {
    const indexPath = path.join(INDEX_DIR, `${contractId}.json`);
    if (!fs.existsSync(indexPath)) continue;

    const content = await fs.promises.readFile(indexPath, "utf-8");
    for (const filename of parseIndexFiles(content)) {
      orphanCandidates.add(filename);
    }
    fs.unlinkSync(indexPath);
    removedIndexes++;
  }

  const stillReferenced = await readAllReferencedFiles();
  let removedFiles = 0;
  for (const filename of orphanCandidates) {
    if (stillReferenced.has(filename)) continue;
    const fullPath = sanitizeFilename(filename);
    if (!fullPath || !fs.existsSync(fullPath)) continue;
    fs.unlinkSync(fullPath);
    removedFiles++;
  }

  return { removedIndexes, removedFiles };
}

