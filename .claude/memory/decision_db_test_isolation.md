---
name: Aislar DB de tests con DATABASE_PATH + cross-env
description: npm test era destructivo (borraba data/kobetsu.db); ahora usa data/kobetsu.test.db separada
type: project
auto_saved: true
trigger: decision
date: 2026-04-07
---

## Problema

`npm test` ejecutaba `npm run test:prepare` que corre `tsx server/db/seed.ts --force`. El seed hacia `DROP TABLE` de todo y re-creaba con datos del seed. Esto **borraba `data/kobetsu.db`** cada vez que el dev corria tests.

Hipotesis confirmada en el audit v1↔v3: la sensacion del usuario de "v1 funcionaba mejor" probablemente venia de aca. Si corria tests con frecuencia en v3, perdia datos repetidas veces.

## Decision

Aislar la DB de tests usando una ruta separada `data/kobetsu.test.db`, controlada por la env var `DATABASE_PATH`.

## Implementacion

1. **`server/db/index.ts`**: lee `process.env.DATABASE_PATH`. Si VITEST esta activo, default es `data/kobetsu.test.db`. Si no, default es `data/kobetsu.db`.

```ts
const isVitest = process.env.VITEST === "true" || process.env.VITEST === "1";
const defaultDbFile = isVitest ? "data/kobetsu.test.db" : "data/kobetsu.db";
const requestedDbPath = process.env.DATABASE_PATH || defaultDbFile;
```

2. **`server/db/seed.ts`**: tambien honra `DATABASE_PATH`. Critico porque seed corre desde `tsx` ANTES de vitest, sin VITEST=true seteado.

3. **`package.json` scripts**: usan `cross-env DATABASE_PATH=data/kobetsu.test.db` para portabilidad Windows/POSIX:

```json
"test:prepare": "cross-env DATABASE_PATH=data/kobetsu.test.db tsx server/db/seed.ts --force",
"test:run": "npm run test:prepare && cross-env DATABASE_PATH=data/kobetsu.test.db vitest run --no-file-parallelism",
```

4. **`cross-env` instalado** como devDep (`npm install -D cross-env` → 10.1.0). Necesario porque sintaxis `VAR=value command` no funciona en cmd de Windows; cross-env es la opcion estandar.

## Alternativas descartadas

- **`node --env-file=.env.test`** (Node 22 nativo): requeriria archivo `.env.test` adicional, mas magia oculta.
- **Wrapper script en `scripts/test-prepare.mjs`**: mas verbose, otro archivo a mantener.
- **Setear VITEST=true en test:prepare**: hack feo, abusa de un flag que pertenece al test runner.
- **CHECK en seed.ts para abortar si DB es la real**: no resolveria el caso del flag `--force`.

## Como aplicarla

- Cuando agregues nuevos scripts que necesiten DB, decidi cual: si es para tests, prefijalo con `cross-env DATABASE_PATH=data/kobetsu.test.db`. Si es para dev/prod, dejalo sin el prefijo (usa el default `data/kobetsu.db`).
- En CI, los tests corren con `DATABASE_PATH=data/kobetsu.test.db` por el script. La DB de prod no existe en CI.

## Verificacion

```
$ npm run test:run
[seed] DB path: .../data/kobetsu.test.db   ← test DB, no la real
35 test files, 643 tests passed
$ ls -lh data/kobetsu.db data/kobetsu.test.db
-rw-r--r-- ... 276K data/kobetsu.db        ← intacta
-rw-r--r-- ... 280K data/kobetsu.test.db   ← seed de tests
```
