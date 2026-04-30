// Script de auditoría visual para verificar detección de turnos en PDFs
// Uso: npx tsx test-pdf-shifts.ts

import { db } from "./server/db/index.js";
import { factories } from "./server/db/schema.js";
import { eq, like, or } from "drizzle-orm";
import { countNamedShifts, normalizeShiftText } from "./server/services/shift-utils.js";
import { buildCommonDataForPDF } from "./server/services/document-generation.js";
import { contracts } from "./server/db/schema.js";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

// Config
const OUTPUT_DIR = "output/shift-audit";
const SHIFT_PATTERNS = [
  { name: "multi-shift", pattern: "%昼勤%", desc: "Multiple named shifts" },
  { name: "circled", pattern: "%①%", desc: "Circled number shifts" },
  { name: "letter", pattern: "%勤務%", desc: "Letter-prefixed shifts" },
  { name: "single", pattern: "%8:00%", desc: "Single shift" },
  { name: "day-night", pattern: "%8:00%~%", desc: "Day shift pattern" },
];

async function main() {
  console.log("=== PDF Shift Detection Audit ===\n");

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Get all factories with workHours
  const allFactories = await db.query.factories.findMany({
    with: { company: true },
  });

  const withWorkHours = allFactories.filter(f => f.workHours || f.workHoursDay || f.workHoursNight);
  console.log(`Factories with shift data: ${withWorkHours.length}/${allFactories.length}\n`);

  // Categorize by shift pattern
  const categories: Record<string, typeof withWorkHours> = {
    "multi-shift": [],
    "circled": [],
    "letter": [],
    "single": [],
    "day-night": [],
    "other": [],
  };

  for (const factory of withWorkHours) {
    const workHours = factory.workHours || "";
    const count = countNamedShifts(workHours);

    if (count >= 2) {
      categories["multi-shift"].push(factory);
    } else if (/[①②③④⑤⑥⑦⑧⑨⑩]/.test(workHours)) {
      categories["circled"].push(factory);
    } else if (/[A-Za-z]勤務/.test(workHours)) {
      categories["letter"].push(factory);
    } else if (factory.workHoursDay && factory.workHoursNight) {
      categories["day-night"].push(factory);
    } else if (workHours.includes("8:00") || workHours.includes("9:00")) {
      categories["single"].push(factory);
    } else if (workHours.length > 0) {
      categories["other"].push(factory);
    }
  }

  // Generate report
  const lines: string[] = [
    "# Shift Detection Audit Report",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
  ];

  let totalExamples = 0;
  for (const [category, factories] of Object.entries(categories)) {
    if (factories.length === 0) continue;

    lines.push(`### ${category.toUpperCase()} (${factories.length} factories)`);
    lines.push("");

    const examples = factories.slice(0, 5);
    for (const f of examples) {
      const workHours = f.workHours || "(empty)";
      const normalized = normalizeShiftText(workHours);
      const count = countNamedShifts(workHours);

      lines.push(`- **${f.factoryName}**`);
      lines.push(`  - company: ${f.company?.name}`);
      lines.push(`  - workHours: \`${workHours}\``);
      lines.push(`  - shifts detected: ${count}`);
      if (normalized !== workHours) {
        lines.push(`  - normalized: \`${normalized.replace(/\n/g, " | ")}\``);
      }
      totalExamples++;
    }
    lines.push("");
  }

  // Check contracts with different Day/Night
  const contractsWithDayNight = await db.query.contracts.findMany({
    with: { factory: { with: { company: true } } },
    where: (contracts, { and, isNotNull, ne }) => and(
      isNotNull(contracts.startDate)
    ),
    limit: 100,
  });

  const arubaitoContracts = contractsWithDayNight.filter(c => {
    const day = c.factory.workHoursDay;
    const night = c.factory.workHoursNight;
    return day && night && day !== night;
  });

  lines.push("### ARUBAITO (Day != Night but single shift)");
  lines.push("");
  lines.push(`Found ${arubaitoContracts.length} factories with different Day/Night times:`);
  lines.push("");

  for (const c of arubaitoContracts.slice(0, 10)) {
    const day = c.factory.workHoursDay || "(empty)";
    const night = c.factory.workHoursNight || "(empty)";
    const workHours = c.factory.workHours || "(empty)";
    lines.push(`- **${c.factory.factoryName}** (${c.factory.company?.name})`);
    lines.push(`  - workHours: \`${workHours}\``);
    lines.push(`  - Day: \`${day}\` | Night: \`${night}\``);
  }
  lines.push("");

  // Write report
  const reportPath = path.join(OUTPUT_DIR, "shift-audit-report.md");
  writeFileSync(reportPath, lines.join("\n"), "utf-8");
  console.log(`Report written to: ${reportPath}`);

  // Generate sample data JSON for visual inspection
  const sampleData: Record<string, unknown>[] = [];

  for (const category of Object.keys(categories)) {
    const factories = categories[category];
    for (const f of factories.slice(0, 3)) {
      sampleData.push({
        category,
        factoryId: f.id,
        factoryName: f.factoryName,
        companyName: f.company?.name,
        workHours: f.workHours,
        workHoursDay: f.workHoursDay,
        workHoursNight: f.workHoursNight,
        shiftsDetected: countNamedShifts(f.workHours || ""),
        normalizedWorkHours: normalizeShiftText(f.workHours || ""),
      });
    }
  }

  const jsonPath = path.join(OUTPUT_DIR, "sample-shifts.json");
  writeFileSync(jsonPath, JSON.stringify(sampleData, null, 2), "utf-8");
  console.log(`Sample data written to: ${jsonPath}`);

  console.log(`\n=== Done! ${totalExamples} examples analyzed ===`);
}

main().catch(console.error);
