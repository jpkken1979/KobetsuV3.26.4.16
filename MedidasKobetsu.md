# MedidasKobetsu.md — Especificaciones del PDF 個別契約書

Referencia completa de medidas, grid y técnicas usadas para generar el PDF
que replica el formato Excel `個別契約書TEXPERT2026.1BLANCONADADATOS.xlsx`.

## 1. Página A4

| Parámetro | Valor (pt) | Nota |
|-----------|-----------|------|
| Page Width | 595.28 | A4 estándar |
| Page Height (PH) | 841.89 | A4 estándar |
| Margin Left (ML) | 30 | Balanceado con derecha |
| Margin Top (MT) | 11 | |
| Margin Bottom (MB) | 15 | Previene auto-paginación de PDFKit |
| Table Width (TW) | 535 | ML + TW + MR ≈ 595.28 |
| Margin Right | ~30.28 | Calculado: 595.28 - 30 - 535 |

## 2. Sistema de columnas (27 columnas: A-AA)

Basado en los anchos de columna del Excel original.

| Columna | Índice | Ancho (chars) | Uso principal |
|---------|--------|---------------|---------------|
| A | 0 | 3.625 | Side labels (派遣先, 派遣元, 派遣内容) |
| B | 1 | 11.375 | Side labels (cont.) |
| C-G | 2-6 | 11.375 c/u | Row labels (派遣先事業所, 指揮命令者, etc.) |
| H | 7 | 11.375 | 名称 / 部署 |
| I-N | 8-13 | 11.375 c/u | Valores (company name, dept, etc.) |
| O-P | 14-15 | 11.375 c/u | 所在地 / 役職 / 抵触日 |
| Q-W | 16-22 | 11.375 c/u | Valores (address, name, etc.) |
| X | 23 | 11.375 | TEL label |
| Y-Z | 24-25 | 11.375 c/u | Phone values |
| AA | 26 | 4.625 | Phone (cont.) |

**Total chars**: 292.625
**Fórmula posición X**: `ML + (sum_chars_before / 292.625) * TW`

### Funciones de acceso

```typescript
const cx = (c: number) => CX[c];           // X position of column start
const cw = (s: number, e: number) => CX[e + 1] - CX[s]; // Width spanning cols s to e
```

## 3. Sistema de filas (64 filas)

Alturas en puntos del Excel original. Se comprimen con factor YS para caber en A4.

| Fila | Altura (pt) | Contenido |
|------|-------------|-----------|
| 1 | 29.25 | Título 人材派遣個別契約書 |
| 2 | 17.25 | Intro texto |
| 3 | 13.5 | Intro (cont.) |
| 4-9 | 15.75 c/u | 派遣先 (事業所, 就業場所, 組織単位, person rows) |
| 10-11 | 15.75 c/u | 派遣元 (person rows) |
| 12-13 | 13.5 c/u | 協定対象 (checkboxes) |
| 14 | 18.75 | 責任の程度 |
| 15 | 15.75 | 業務内容 |
| 16 | 15.75 | 派遣期間 |
| 17 | 15.75 | 就業日 |
| 18-21 | 9 c/u | 就業時間 |
| 22-25 | 9 c/u | 休憩時間 |
| 26 | 15.75 | 就業日外労働 |
| 27 | 13.5 | 時間外労働 |
| 28 | 8.25 | 時間外労働 (cont.) |
| 29-31 | 13.5 c/u | 派遣料金 |
| 32 | 15 | 支払い条件 |
| 33 | 13.5 | 振込先 |
| 34 | 20.25 | 安全・衛生 |
| 35 | 11.25 | 安全・衛生 (cont.) |
| 36 | 24.75 | 便宜供与 |
| 37 | 9.75 | 苦情処理方法 |
| 38-39 | 15 c/u | 苦情処理 (cont.) |
| 40 | 34.5 | 苦情処理 (cont.) |
| 41 | 10.5 | 契約解除 (1) |
| 42 | 18 | 契約解除 (1) cont. |
| 43-44 | 13.5 c/u | 契約解除 (2) |
| 45-50 | 13.5 c/u | 契約解除 (3) |
| 51 | 9.75 | 契約解除 (3) cont. |
| 52-53 | 13.5 c/u | 契約解除 (4) |
| 54-55 | 13.5 c/u | 紛争防止措置 |
| 56-57 | 13.5 c/u | 無期雇用限定 |
| 58 | 15 | 署名文 |
| 59 | 14.25 | 契約日 |
| 60-64 | 13.5 c/u | 署名 (甲)/(乙) |

**Total Row Heights**: 912 pt
**Available Height**: PH - MT - MB = 841.89 - 11 - 15 = 815.89 pt
**Scale Factor (YS)**: 815.89 / 912 ≈ 0.8946

### Funciones de acceso

```typescript
const ry = (r: number) => RY[r];           // Y position of row start
const rh = (s: number, e: number) => RY[e + 1] - RY[s]; // Height spanning rows s to e
```

## 4. Función cell() — Auto-shrink + Clipping

La función principal de dibujo. Acepta coordenadas de grid (row, col) y renderiza texto.

```typescript
function cell(doc, r1, c1, r2, c2, text, fs, opts)
```

### Parámetros
- `r1, c1`: Fila/columna inicio (1-indexed rows, 0-indexed cols)
- `r2, c2`: Fila/columna fin (inclusive)
- `text`: Contenido
- `fs`: Font size inicial (se reduce automáticamente si no cabe)
- `opts`: `{ align, valign, wrap, noBorder }`

### Auto-shrink
1. Mide `doc.heightOfString(text, { width })` al font size dado
2. Si excede la altura de celda, reduce 0.5pt
3. Repite hasta que quepa (mínimo 3pt)

### Clipping
- `doc.save() → doc.rect(x,y,w,h).clip() → doc.text() → doc.restore()`
- Red de seguridad: si auto-shrink no basta, el texto se corta visualmente

### Centrado vertical
- `valign: "center"`: `y + (cellHeight - textHeight) / 2`
- `valign: "top"`: `y + 2` (padding)

## 5. Font Sizes por sección

Ajuste 2026-04-21: subidos ~+1pt across the board para mejorar legibilidad visual
respetando el balance con las zonas densas de texto legal. El auto-shrink de `cell()`
sigue cuidando los casos edge (nombres largos, calendars extensos).

| Sección | Font Size | Nota |
|---------|-----------|------|
| Título | 13 pt | noBorder |
| Intro texto | 8.5 pt | noBorder, wrap |
| Side labels (派遣先, 派遣元) | 8 pt | |
| Side label (派遣内容) | 5 pt | Narrow cell, no wrap |
| Row labels (派遣先事業所, etc.) | 7 pt | center |
| Inner labels (名称/所在地/部署/役職/TEL) | 7.5 pt | center |
| Content values | 8 pt | |
| Person row labels | 7 pt | center |
| Legal labels (安全・衛生, etc.) | 7.5 pt | center, wrap |
| Legal text (安全衛生/便宜/紛争/無期) | 7 pt | top, wrap |
| Legal text (苦情/契約解除) | 6.5 pt | top, wrap (longer text) |
| Checkboxes (☑/□) | 8 pt | value / 7 pt label |
| Shifts 1-2 (就業時間/休憩) | 8 pt | renderMultiShift |
| Shifts 3+ cascade | 7.5 → 4.5 pt | degrades if >2 shifts |
| Signature text | 8 pt | noBorder |
| Contract date | 11 pt | noBorder |
| (甲)/(乙) labels | 10 pt | noBorder, bold |
| UNS name | 12 pt | auto-shrink if narrow |
| UNS address / rep / license | 10 pt | bold |

## 6. Patrones de layout

### Patrón: Borde exterior + texto distribuido (sin bordes internos)

Usado en rows 4-5 (派遣先事業所) y rows 7-11 (person rows).

```typescript
// 1. Draw single outer border
doc.lineWidth(0.4).rect(cx(7), ry(row), cw(7, 26), rh(row, row)).stroke();

// 2. Place text at column positions with noBorder
cell(doc, row, 7, row, 8, "部署", 7, { align: "center", noBorder: true });
cell(doc, row, 9, row, 13, dept, 7, { noBorder: true });
cell(doc, row, 14, row, 15, "役職", 7, { align: "center", noBorder: true });
// ... etc
```

**Resultado**: Texto distribuido uniformemente como en Excel, sin líneas verticales internas.

### Patrón: Celda única sin divisiones

Usado en rows 29-31 (派遣料金), row 32 (支払い条件), row 16 (派遣期間).

```typescript
cell(doc, 29, 7, 29, 26,
  `基本 ${yen(rate)}　　　残業(1.25%) ${yen(rate * 1.25)}　　　深夜(1.25%) ${yen(rate * 1.25)}`, 7);
```

**Resultado**: Todo el contenido en una sola celda con espacios `　` (ideographic space) para separación visual.

### Patrón: Legal block (label + text spanning rows)

```typescript
function legalBlock(doc, r1, r2l, r2v, c2v, label, text, labelFs, textFs)
```

- Label en cols 2-6, centered, wrap
- Value en cols 7-26, top-aligned, wrap
- Auto-shrink maneja textos legales largos automáticamente

### Patrón: Signature (甲)/(乙) lado a lado

- (甲): cols 0-12, solo label — espacio en blanco para 印鑑 del cliente
- (乙): cols 14-26, datos completos de UNS (address, name, representative, 許可番号)

## 7. Reglas de diseño

1. **Sin bordes**: Título (row 1), intro (rows 2-3), firma (rows 58-64)
2. **Borde solo exterior**: Rows 4-5 (事業所/就業場所), rows 7-11 (person rows)
3. **Con bordes de celda**: Row 6 (組織単位 + 抵触日), rows 12-57 (派遣内容)
4. **抵触日 es el ÚNICO campo con borde interno** en la sección 派遣先
5. **Line width**: 0.4pt para todos los bordes
6. **Padding**: 2pt dentro de cada celda
7. **Fuente**: NotoSansJP-Regular.ttf (9.2MB), registrada como "JP"

## 8. Estructura del grid por sección

```
Row 1:        [────────── Título (noBorder) ──────────]
Rows 2-3:     [────────── Intro (noBorder) ───────────]

              ┌──────┐┌─────────────────────────────────┐
Row 4:        │事業所││名称 [company] 所在地 [addr] TEL │  ← outer border only
Row 5:        │就業場所││名称 [factory] 所在地 [addr] TEL │  ← outer border only
Row 6:        │組織単位││[dept line]│抵触日│[date]       │  ← 抵触日 with border
              │派遣先 │├─────────────────────────────────┤
Row 7:        │      ││部署 [dept]  役職 [name]  TEL    │  ← outer border only
Row 8:        │      ││部署 [dept]  役職 [name]  TEL    │
Row 9:        │      ││部署 [dept]  役職 [name]  TEL    │
              ├──────┤├─────────────────────────────────┤
Row 10:       │派遣元││部署 [dept]  役職 [name]  TEL    │
Row 11:       │      ││部署 [dept]  役職 [name]  TEL    │
              ├──────┤├─────────────────────────────────┤
Rows 12-57:   │派遣  ││ 協定, 責任, 業務, 期間, 就業日  │
              │内容  ││ 就業時間, 休憩, 残業, 料金, etc. │
              │      ││ 安全, 便宜, 苦情, 契約解除, etc. │
              └──────┘└─────────────────────────────────┘

Row 58:       上記契約の証として... (noBorder)
Row 59:       [date] (noBorder)
Rows 60-64:   (甲) [blank for 印鑑]    (乙) [UNS info]
```

## 9. Origen de medidas

- **Column widths**: Extraídas con `openpyxl` de `個別契約書TEXPERT2026.1BLANCONADADATOS.xlsx`
  - Excel columnas A=3.625, B-Z=11.375, AA=4.625 (character widths)
- **Row heights**: Extraídas con `openpyxl` en puntos (pt)
- **Page setup Excel**: Left=0.59in, Right=0.31in, Top=0.16in, Bottom=0
- **Márgenes PDF**: Ajustados a ML=30, MR≈30 para balance visual (difiere del Excel original)

## 10. Archivos relacionados

| Archivo | Propósito |
|---------|-----------|
| `server/pdf/kobetsu-pdf.ts` | Generador principal (este documento describe sus medidas) |
| `server/pdf/helpers.ts` | Primitivas compartidas (C, L, V, yen, UNS, etc.) |
| `server/pdf/fonts/NotoSansJP-Regular.ttf` | Fuente principal (9.2MB) |
| `server/pdf/fonts/BIZUDMincho-0.ttf` | Fuente alternativa Mincho (extraída de .ttc) |
| `test-pdf.ts` | Test harness con datos de ティーケーエンジニアリング |
| `output/TEST_個別契約書_*.pdf` | PDFs de prueba generados |
