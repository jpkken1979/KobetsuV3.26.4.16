# 🏎️ Manifiesto Hyper-Design: Estética de Superdeportivo

Este documento define el sistema de diseño **Hyper-Design** implementado en el proyecto JP-v26.3.10. Inspirado en la ingeniería de precisión de marcas como Ferrari y Lamborghini, este diseño combina elegancia agresiva con funcionalidad técnica de alto nivel.

---

## 🎨 ADN Visual

### 🌌 Colores Primarios (Deep Obsidian)
- **Fondo Base:** `#050505` (Negro absoluto para máximo contraste)
- **Superficie de Cristal:** `rgba(20, 20, 20, 0.9)` con `backdrop-blur-2xl`
- **Bordes Técnicos:** `rgba(255, 255, 255, 0.08)` (Ultra-finos)

### ⚡ Colores de Rendimiento (Neon Accents)
- **Azul Eléctrico (Optimización):** `#0052CC` / `#00b3ff` (Glow: `0 0 15px rgba(0, 82, 204, 0.3)`)
- **Rojo Rosso Corsa (Crítico):** `#DC143C` / `#ff2d55` (Glow: `0 0 15px rgba(220, 20, 60, 0.3)`)
- **Verde Neón (Métricas/Tasas):** `#00ff88` (Glow: `0 0 10px rgba(0, 255, 136, 0.1)`)

---

## 🛠️ Utilidades CSS (Tailwind)

Hemos inyectado clases personalizadas en `src/index.css` para facilitar el uso de este estilo:

| Clase | Descripción | Efecto |
|---|---|---|
| `.hyper-dark-bg` | Fondo Obsidian | Aplicar al contenedor raíz de la página. |
| `.hyper-grid` | Rejilla Técnica | Patrón de líneas láser azul sutil (estilo radar). |
| `.card-hyper` | Carrocería de Cristal | Efecto Glassmorphism con bordes que brillan al hover. |
| `.gauge-value` | Medidor Digital | Tipografía monoespaciada para datos numéricos. |
| `.bg-orb` | Iluminación de Ambiente | Orbes de luz desenfocados para dar profundidad. |

---

## 🧱 Desglose de Componentes

### 1. El Circuito (Páginas Principales)
- **Estructura:** Uso de `AnimatedPage` con `hyper-dark-bg` y `hyper-grid`.
- **Atmósfera:** Inserción de `div` con clase `bg-orb` en las esquinas para evitar una interfaz plana.

### 2. La Carrocería (Tarjetas de Empresa)
- **Hover:** La tarjeta debe elevarse (`scale-101`) y proyectar un resplandor del color de su estado.
- **Badge:** Estilo `NEED CHECK` (Rojo láser) o `OPTIMIZED` (Azul neón) con tracking de texto extra ancho.

### 3. El Centro de Mando (Factory Panel)
- **Header:** Títulos en mayúsculas, fuente pesada (`font-black`) y tracking apretado.
- **Separadores:** Gradientes que nacen del centro hacia los lados (`via-white/10`) para dividir secciones sin saturar.

### 4. Módulos Tácticos (Factory Cards)
- **Gauges:** Las tarifas (Yenes) deben destacar en verde neón dentro de un contenedor con fondo `bg-emerald-500/10`.
- **Alertas:** El indicador de `LIMIT` (抵触日) usa el estilo de luz de advertencia de motor.

---

## 🚀 Cómo extender el diseño

Para aplicar este estilo a una nueva página (ej. Empleados):

1. Envuelve el contenido en un div con `hyper-dark-bg` y `hyper-grid`.
2. Usa `card-hyper` para todas las tarjetas de datos.
3. Asegúrate de que los botones tengan el efecto `btn-press` y sombras de color (`shadow-blue-500/20`).
4. **Regla de Oro:** Si no brilla o no parece fibra de carbono, no es Hyper-Design.

---
*Diseñado con precisión por Gemini CLI & Antigravity Kit — 2026*
