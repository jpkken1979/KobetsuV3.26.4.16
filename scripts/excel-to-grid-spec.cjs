/**
 * Excel → Grid Spec Parser
 *
 * Extracts EVERYTHING needed to clone an Excel sheet as a pixel-perfect PDF:
 * - Column widths (character units)
 * - Row heights (points)
 * - Merge ranges
 * - Cell content (resolved formulas)
 * - Cell borders (top/bottom/left/right style)
 * - Cell fonts (name, size, bold, italic, color)
 * - Cell alignment (horizontal, vertical, wrapText)
 * - Cell fills (background colors)
 *
 * Usage: node scripts/excel-to-grid-spec.cjs <excel-file> <sheet-name> [start-row] [end-row]
 * Output: JSON grid spec to stdout
 *
 * Example:
 *   node scripts/excel-to-grid-spec.cjs "Koritsu/コーリツ個別契約セット等26年1月3月末.xlsm" "労働者派遣個別契約書" 1 81
 */
const ExcelJS = require("exceljs");
const path = require("path");

async function main() {
  const [,, file, sheetName, startRowStr, endRowStr] = process.argv;

  if (!file || !sheetName) {
    console.error("Usage: node excel-to-grid-spec.cjs <file> <sheet-name> [start-row] [end-row]");
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.getWorksheet(sheetName);

  if (!ws) {
    console.error(`Sheet "${sheetName}" not found. Available: ${wb.worksheets.map(w => w.name).join(", ")}`);
    process.exit(1);
  }

  const startRow = parseInt(startRowStr) || 1;
  const endRow = parseInt(endRowStr) || ws.rowCount;
  const maxCol = ws.columnCount;

  // ─── Column widths ───
  const columns = [];
  for (let c = 1; c <= maxCol; c++) {
    const col = ws.getColumn(c);
    columns.push({
      index: c,
      letter: colLetter(c),
      width: col.width || 8.43,
    });
  }

  // ─── Row heights ───
  const rows = [];
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r);
    rows.push({
      index: r,
      height: row.height || 15,
    });
  }

  // ─── Merge ranges ───
  const merges = (ws.model.merges || []).map(m => {
    const match = m.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
    if (!match) return null;
    return {
      range: m,
      c1: colNum(match[1]), r1: parseInt(match[2]),
      c2: colNum(match[3]), r2: parseInt(match[4]),
      c1Letter: match[1], r1Row: parseInt(match[2]),
      c2Letter: match[3], r2Row: parseInt(match[4]),
    };
  }).filter(Boolean).filter(m => m.r1 >= startRow && m.r1 <= endRow)
    .sort((a, b) => a.r1 - b.r1 || a.c1 - b.c1);

  // ─── Build merge lookup ───
  const mergeMap = new Map();
  for (const m of merges) {
    for (let r = m.r1; r <= m.r2; r++) {
      for (let c = m.c1; c <= m.c2; c++) {
        mergeMap.set(`${r},${c}`, { ...m, isMaster: r === m.r1 && c === m.c1 });
      }
    }
  }

  // ─── Cell data ───
  const cells = [];
  for (let r = startRow; r <= endRow; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= maxCol; c++) {
      const cell = row.getCell(c);

      // Skip non-master merge cells
      const mg = mergeMap.get(`${r},${c}`);
      if (mg && !mg.isMaster) continue;

      // Resolve value
      let value = cell.value;
      let displayValue = "";
      if (value === null || value === undefined) {
        // Check if this is a master merge cell (still include it even if empty)
        if (!mg || !mg.isMaster) continue;
        displayValue = "";
      } else if (typeof value === "object") {
        if (value.formula) displayValue = String(value.result ?? "");
        else if (value.sharedFormula) displayValue = String(value.result ?? "");
        else if (value.richText) displayValue = value.richText.map(rt => rt.text).join("");
        else if (value instanceof Date) displayValue = value.toISOString();
        else displayValue = String(value);
      } else {
        displayValue = String(value);
      }

      // Extract formatting
      const font = cell.font || {};
      const alignment = cell.alignment || {};
      const border = cell.border || {};
      const fill = cell.fill || {};

      const cellData = {
        row: r,
        col: c,
        colLetter: colLetter(c),
        value: displayValue,
      };

      // Merge info
      if (mg && mg.isMaster) {
        cellData.merge = {
          range: mg.range,
          rows: mg.r2 - mg.r1 + 1,
          cols: mg.c2 - mg.c1 + 1,
          endCol: mg.c2,
          endRow: mg.r2,
          endColLetter: colLetter(mg.c2),
        };
      }

      // Font
      if (font.name || font.size || font.bold || font.italic || font.color) {
        cellData.font = {};
        if (font.name) cellData.font.name = font.name;
        if (font.size) cellData.font.size = font.size;
        if (font.bold) cellData.font.bold = true;
        if (font.italic) cellData.font.italic = true;
        if (font.color?.argb) cellData.font.color = "#" + font.color.argb.slice(2);
        if (font.color?.theme !== undefined) cellData.font.theme = font.color.theme;
      }

      // Alignment
      if (alignment.horizontal || alignment.vertical || alignment.wrapText) {
        cellData.alignment = {};
        if (alignment.horizontal) cellData.alignment.horizontal = alignment.horizontal;
        if (alignment.vertical) cellData.alignment.vertical = alignment.vertical;
        if (alignment.wrapText) cellData.alignment.wrapText = true;
      }

      // Borders (only report non-empty borders)
      const borderSides = {};
      for (const side of ["top", "bottom", "left", "right"]) {
        if (border[side] && border[side].style) {
          borderSides[side] = border[side].style;
          if (border[side].color?.argb) {
            borderSides[side + "Color"] = "#" + border[side].color.argb.slice(2);
          }
        }
      }
      if (Object.keys(borderSides).length > 0) {
        cellData.border = borderSides;
      }

      // Fill
      if (fill.type === "pattern" && fill.fgColor) {
        cellData.fill = fill.fgColor.argb ? "#" + fill.fgColor.argb.slice(2) : undefined;
      }

      cells.push(cellData);
    }
  }

  // ─── Output ───
  const spec = {
    sheet: sheetName,
    dimensions: { startRow, endRow, maxCol, totalRows: endRow - startRow + 1 },
    columns,
    rows,
    merges: merges.map(m => ({
      range: m.range,
      r1: m.r1, c1: m.c1, r2: m.r2, c2: m.c2,
      c1Letter: m.c1Letter, c2Letter: m.c2Letter,
    })),
    cells,
    summary: {
      totalCells: cells.length,
      cellsWithBorders: cells.filter(c => c.border).length,
      cellsWithContent: cells.filter(c => c.value).length,
      mergeCount: merges.length,
    },
  };

  console.log(JSON.stringify(spec, null, 2));
}

function colLetter(n) {
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function colNum(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    n = n * 26 + (s.charCodeAt(i) - 64);
  }
  return n;
}

main().catch(e => { console.error(e.message); process.exit(1); });
