---
name: Decision — helper compartido para dashboard experimental
description: La UI experimental del dashboard usa un helper `SpotlightPanel` compartido para glow y spotlight interactivo.
type: project
date: 2026-04-16
---

## Decision
- Crear `src/routes/-dashboard-effects.tsx` con `SpotlightPanel`.

## Por que
- Evita duplicar logica de puntero, glassmorphism y glow en header, stats, charts y quick actions.
- Mantiene variantes y comportamiento de motion centralizados y mas faciles de ajustar.
- Reduce el riesgo de inconsistencias visuales entre cards.

## Consecuencias
- El dashboard ahora tiene una capa visual avanzada sin tocar componentes globales del design system.
- Si el patron demuestra valor, puede extraerse mas adelante a `src/components/ui/`.
