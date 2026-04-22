export interface FactoryLookupEntry {
  id: number;
  companyId: number;
  factoryName: string;
  department: string | null;
  lineName: string | null;
}

/** Normalize full-width digits/letters for consistent key matching. */
function normKey(s: string): string {
  return s
    .replace(/[\uff10-\uff19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\uff21-\uff3a]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\uff41-\uff5a]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ");
}

/**
 * Construye un mapa de busqueda multi-nivel para resolver配属先 por companyId + factoryName + department + lineName.
 * Genera claves en cascada: full key, dept+line, line-only, factory-name-only.
 */
export function buildFactoryLookup(allFactories: FactoryLookupEntry[]): Map<string, number> {
  const lookup = new Map<string, number>();
  for (const factory of allFactories) {
    // Full key: companyId|factoryName|department|lineName (most specific)
    const fullKey = normKey(`${factory.companyId}|${factory.factoryName}|${factory.department || ""}|${factory.lineName || ""}`);
    lookup.set(fullKey, factory.id);

    // Legacy key without factoryName: companyId|department|lineName
    // Only set if not already taken (avoids collisions when same dept+line exists in multiple factories)
    const deptLineKey = normKey(`${factory.companyId}|${factory.department || ""}|${factory.lineName || ""}`);
    if (!lookup.has(deptLineKey)) {
      lookup.set(deptLineKey, factory.id);
    }

    const lineFallback = normKey(`${factory.companyId}||${factory.lineName || ""}`);
    if (!lookup.has(lineFallback)) {
      lookup.set(lineFallback, factory.id);
    }

    const factoryFallback = normKey(`${factory.companyId}|${factory.factoryName}`);
    if (!lookup.has(factoryFallback)) {
      lookup.set(factoryFallback, factory.id);
    }
  }
  return lookup;
}

interface ResolveFactoryAssignmentInput {
  companyId: number | null;
  department: string;
  lineName: string;
  resolvedFactoryName: string | null;
  allFactories: FactoryLookupEntry[];
  factoryLookup: Map<string, number>;
}

/**
 * Resuelve el factoryId a partir de department + lineName + resolvedFactoryName.
 * Prueba claves en orden de especificidad: full key > dept+line > line > factoryName.
 */
export function resolveFactoryAssignment({
  companyId,
  department,
  lineName,
  resolvedFactoryName,
  allFactories,
  factoryLookup,
}: ResolveFactoryAssignmentInput): number | null {
  if (!companyId) {
    return null;
  }

  const hasExplicitPlacement = Boolean(department || lineName);
  if (!hasExplicitPlacement) {
    return null;
  }

  // Try full key first (with factory name) — most specific, avoids collisions
  if (resolvedFactoryName) {
    const fullKey = normKey(`${companyId}|${resolvedFactoryName}|${department}|${lineName}`);
    const byFull = factoryLookup.get(fullKey) ?? null;
    if (byFull) return byFull;
  }

  // Fallback: dept+line without factory name (works when dept+line is unique within company)
  const exact = factoryLookup.get(normKey(`${companyId}|${department}|${lineName}`)) ?? null;
  if (exact) {
    return exact;
  }

  if (lineName) {
    const byLine = factoryLookup.get(normKey(`${companyId}||${lineName}`)) ?? null;
    if (byLine) {
      return byLine;
    }
  }

  if (!resolvedFactoryName) {
    return null;
  }

  const sameFactoryName = allFactories.filter(
    (factory) => factory.companyId === companyId && normKey(factory.factoryName) === normKey(resolvedFactoryName),
  );
  if (sameFactoryName.length === 1) {
    return sameFactoryName[0].id;
  }

  return null;
}
