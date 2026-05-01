# Kobetsu+tsuchisho intercalado — print frente/atras

## Problema original

El kobetsu (個別契約書) se imprime en el frente de la hoja y el tsuchisho (通知書) en el atras. Cuando se generaban PDFs separados, era imposible alinear las paginas para imprimir frente/atras juntos.

## Solucion implementada

**Un solo PDF** con kobetsu y tsuchisho intercalados por empleado:
- Pagina N: kobetsu (frente)
- Pagina N+1: tsuchisho (atras)
- Por cada empleado se generan 2 paginas enfrentadas

## Detalles tecnicos

- El tsuchisho recibe `empList` (TODOS los empleados del contrato), no `emp` individual
- El loop itera sobre empleados solo para generar kobetsu 1 por empleado
- El tsuchisho se genera UNA vez por contrato con la lista completa de empleados
- Archivo: `server/routes/documents-generate-grouped.ts`

## Commits

- `288a0e4` fix(contracts): kobetsu+tsuchisho en un solo PDF intercalado
- `b8c9bbc` fix(tsuchisho): enviar empList completo en lugar de emp individual
- `05c7fe4` feat(contracts): agregar opcion kobetsu+tsuchisho como ZIP

## Pendiente

- Refactorizar para evitar duplicacion de logica kobetsu/tsuchisho
